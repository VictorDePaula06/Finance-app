// ── Busca de símbolos ───────────────────────────────────────────────
// Uma barra só, todas as classes. Quem responde é /api/search — em produção
// pela Vercel e, em desenvolvimento, pelo plugin dev-api do vite.config.js.
//
// Não há fallback por proxy público: o corsproxy.io passou a exigir chave
// (403 keyless_legacy_url), então esse caminho seria código morto.

const INDEX_BY_YAHOO = {
    '^BVSP': 'IBOV', '^GSPC': 'SPX500', '^IXIC': 'NASDAQ', '^NDX': 'NASDAQ100',
    '^DJI': 'DOW', '^RUT': 'RUSSELL', '^VIX': 'VIX', '^FTSE': 'FTSE',
    '^GDAXI': 'DAX', '^FCHI': 'CAC', '^N225': 'NIKKEI', '^HSI': 'HANGSENG',
};
const COMMODITY_BY_YAHOO = {
    'GC=F': 'OURO', 'SI=F': 'PRATA', 'CL=F': 'PETROLEO', 'BZ=F': 'BRENT',
    'NG=F': 'GAS', 'HG=F': 'COBRE', 'ZC=F': 'MILHO', 'ZS=F': 'SOJA',
    'KC=F': 'CAFE', 'SB=F': 'ACUCAR', 'LE=F': 'BOI',
};
const EXCHANGE_LABEL = {
    cripto: 'BINANCE', acoes_br: 'B3', fiis: 'B3',
    indices: 'ÍNDICE', commodities: 'FUTUROS', acoes_int: 'NASDAQ',
};

function toAppSymbol(q) {
    const sym = String(q.symbol || '').toUpperCase();
    if (!sym) return null;
    const type = String(q.quoteType || '').toUpperCase();

    if (type === 'CRYPTOCURRENCY') {
        const base = sym.split('-')[0];
        return base ? { ticker: base, group: 'cripto' } : null;
    }
    if (type === 'INDEX') return { ticker: INDEX_BY_YAHOO[sym] || sym.replace(/^\^/, ''), group: 'indices' };
    if (type === 'FUTURE') return { ticker: COMMODITY_BY_YAHOO[sym] || sym.replace(/=F$/, ''), group: 'commodities' };
    if (type === 'EQUITY' || type === 'ETF') {
        if (sym.endsWith('.SA')) {
            const base = sym.slice(0, -3);
            return { ticker: base, group: /11$/.test(base) ? 'fiis' : 'acoes_br' };
        }
        if (sym.includes('.')) return null;
        return { ticker: sym, group: 'acoes_int' };
    }
    return null;
}

function normalize(quotes) {
    const seen = new Set();
    const out = [];
    for (const item of quotes || []) {
        const mapped = toAppSymbol(item);
        if (!mapped) continue;
        const key = `${mapped.group}:${mapped.ticker}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
            ...mapped,
            name: item.longname || item.shortname || mapped.ticker,
            exchange: EXCHANGE_LABEL[mapped.group],
        });
    }
    return out;
}

// Busca; só relança o cancelamento. `signal` corta a chamada anterior quando
// a pessoa continua digitando.
export async function searchSymbols(query, signal) {
    const q = String(query || '').trim();
    if (q.length < 1) return [];
    try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal });
        if (!r.ok) return [];
        const d = await r.json();
        // `results` já vem mapeado pelo servidor; `quotes` é a resposta crua do
        // Yahoo, aceita aqui para o caso de o endpoint mudar de formato.
        if (Array.isArray(d.results)) return d.results;
        return normalize(d.quotes);
    } catch (e) {
        if (e?.name === 'AbortError') throw e;
        return [];
    }
}
