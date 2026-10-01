/**
 * Vercel Serverless Function: /api/history
 *
 * Série histórica de preços para o gráfico do Monitor de Ativos (estilo Google).
 * Busca no Yahoo Finance no servidor (sem CORS). Cripto NÃO passa por aqui — é
 * buscada client-side na Binance (klines), pois a Binance bloqueia servidores.
 *
 * Query: symbol=NVDA&group=acoes_int&interval=1d&range=2y
 *     ou: symbol=NVDA&group=acoes_int&range=1D     (forma antiga, por faixa)
 * Resposta: {
 *   points:  [{ t: <ms>, c: <close> }],                  // linha (Monitor de Ativos)
 *   candles: [{ t, o, h, l, c, v }],                     // velas (/charts)
 *   currency
 * }
 * `points` continua no formato antigo para não quebrar o Monitor de Ativos.
 */

import { isValidTicker } from './_marketGuard.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const INDEX_ALIASES = {
    IBOV: '^BVSP', IBOVESPA: '^BVSP', BVSP: '^BVSP', IBX: '^BVSP',
    SPX: '^GSPC', SPX500: '^GSPC', SP500: '^GSPC', GSPC: '^GSPC', 'S&P500': '^GSPC',
    NASDAQ: '^IXIC', IXIC: '^IXIC', NASDAQ100: '^NDX', NDX: '^NDX',
    DOW: '^DJI', DJI: '^DJI', DJIA: '^DJI',
    RUSSELL: '^RUT', RUT: '^RUT', VIX: '^VIX',
    FTSE: '^FTSE', DAX: '^GDAXI', CAC: '^FCHI', NIKKEI: '^N225', N225: '^N225', HANGSENG: '^HSI', HSI: '^HSI',
};

// Commodities (sem ETF) → símbolo de futuros/spot do Yahoo Finance.
const COMMODITIES = {
    OURO: 'GC=F', GOLD: 'GC=F', XAU: 'XAUUSD=X', XAUUSD: 'XAUUSD=X',
    PRATA: 'SI=F', SILVER: 'SI=F', XAG: 'XAGUSD=X',
    PETROLEO: 'CL=F', OIL: 'CL=F', WTI: 'CL=F', BRENT: 'BZ=F',
    GAS: 'NG=F', GASNATURAL: 'NG=F',
    COBRE: 'HG=F', COPPER: 'HG=F',
    MILHO: 'ZC=F', CORN: 'ZC=F', SOJA: 'ZS=F', SOYBEAN: 'ZS=F',
    CAFE: 'KC=F', COFFEE: 'KC=F', ACUCAR: 'SB=F', SUGAR: 'SB=F', BOI: 'LE=F',
};

// range → parâmetros do Yahoo (intervalo / janela).
// O intervalo é o da faixa pedida, mas a JANELA buscada é maior de propósito:
// o gráfico mostra só a faixa e guarda o resto para quem arrasta para trás.
// (O Yahoo limita intervalos intradiários a 60 dias de histórico.)
const RANGE_MAP = {
    '1D': { interval: '5m', range: '5d' },
    '5D': { interval: '30m', range: '1mo' },
    '1M': { interval: '1d', range: '6mo' },
    '3M': { interval: '1d', range: '1y' },
    '6M': { interval: '1d', range: '2y' },
    'YTD': { interval: '1d', range: '2y' },
    '1A': { interval: '1d', range: '5y' },
    '5A': { interval: '1wk', range: 'max' },
    'TODOS': { interval: '1mo', range: 'max' },
    'MAX': { interval: '1wk', range: 'max' },
};

// Valores aceitos pelo Yahoo. Fora dessas listas, a requisição é recusada em
// vez de ir para o provedor com parâmetro inventado.
const YAHOO_INTERVALS = new Set(['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo', '3mo']);
const YAHOO_RANGES = new Set(['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max']);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { symbol = '', group = 'acoes_int', range = '1D', interval = '' } = req.query;
    if (!symbol) return res.status(400).json({ error: 'No symbol provided' });

    const sym = symbol.toUpperCase();
    // F-07: valida o formato do símbolo antes de montar a URL do provedor.
    if (!isValidTicker(sym)) return res.status(400).json({ error: 'Invalid symbol' });

    // Duas formas de pedir:
    //   interval + range  → a sala de gráficos escolhe os dois (vela e janela);
    //   range             → forma antiga, ainda usada pelo Monitor de Ativos.
    const rcfg = interval
        ? (YAHOO_INTERVALS.has(interval) && YAHOO_RANGES.has(range)
            ? { interval, range }
            : null)
        : (RANGE_MAP[range] || RANGE_MAP['1D']);
    if (!rcfg) return res.status(400).json({ error: 'Invalid interval or range' });

    // Resolve o símbolo Yahoo conforme o grupo.
    let ysym = sym;
    if (group === 'commodities') ysym = COMMODITIES[sym] || sym;
    else if (group === 'indices') ysym = INDEX_ALIASES[sym] || (sym.startsWith('^') ? sym : `^${sym}`);
    else if ((group === 'acoes_br' || group === 'fiis') && !sym.includes('.')) ysym = `${sym}.SA`;

    // Em intervalo intradiário, traz também pré e pós-mercado: é o que o
    // gráfico precisa mostrar fora do pregão (vela diária já é consolidada).
    const intraday = /m$|h$/.test(rcfg.interval);
    const qs = `interval=${rcfg.interval}&range=${rcfg.range}`
        + (intraday ? '&includePrePost=true' : '');
    const urls = [
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ysym)}?${qs}`,
        `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ysym)}?${qs}`,
    ];

    for (const url of urls) {
        try {
            const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
            if (r.ok) {
                const d = await r.json();
                const result = d?.chart?.result?.[0];
                const ts = result?.timestamp || [];
                const q = result?.indicators?.quote?.[0] || {};
                const closes = q.close || [];
                const opens = q.open || [];
                const highs = q.high || [];
                const lows = q.low || [];
                const vols = q.volume || [];
                const currency = result?.meta?.currency || 'USD';
                const points = ts
                    .map((t, i) => ({ t: t * 1000, c: closes[i] }))
                    .filter(p => p.c != null && isFinite(p.c));
                // Vela só entra completa; barra sem OHLC vira ruído no gráfico.
                const candles = ts
                    .map((t, i) => ({
                        t: t * 1000,
                        o: opens[i], h: highs[i], l: lows[i], c: closes[i],
                        v: vols[i] == null ? 0 : vols[i],
                    }))
                    .filter(k => [k.o, k.h, k.l, k.c].every(n => n != null && isFinite(n)));
                if (points.length) return res.status(200).json({ points, candles, currency });
            }
        } catch (e) { /* tenta próxima url */ }
    }

    return res.status(200).json({ points: [], candles: [], currency: 'USD' });
}
