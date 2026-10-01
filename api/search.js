/**
 * Vercel Serverless Function: /api/search
 *
 * Busca de símbolos para a sala de gráficos (/charts): uma única barra, todas
 * as classes. Consulta o buscador do Yahoo Finance no servidor (sem CORS) e
 * devolve já traduzido para os grupos do app.
 *
 * Query: q=bitcoin
 * Resposta: { results: [{ ticker, group, name, exchange, yahoo }] }
 *
 * `ticker` é o código que o app guarda na watchlist (BTC, PETR4, NVDA) —
 * não o símbolo do Yahoo (BTC-USD, PETR4.SA), que vai em `yahoo` só para
 * referência.
 */

import { rateLimit } from './_rateLimit.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

// Índices que o app conhece pelo apelido; o resto entra pelo símbolo do Yahoo.
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

// Um resultado do Yahoo → { ticker, group } do app. Devolve null quando o
// tipo não tem lugar aqui (fundos mútuos, opções, etc.).
function toAppSymbol(q) {
    const sym = String(q.symbol || '').toUpperCase();
    if (!sym) return null;
    const type = String(q.quoteType || '').toUpperCase();

    if (type === 'CRYPTOCURRENCY') {
        // Vem como BTC-USD; o app usa o par USDT da Binance, então só a base.
        const base = sym.split('-')[0];
        if (!base) return null;
        return { ticker: base, group: 'cripto' };
    }
    if (type === 'INDEX') {
        return { ticker: INDEX_BY_YAHOO[sym] || sym.replace(/^\^/, ''), group: 'indices' };
    }
    if (type === 'FUTURE') {
        return { ticker: COMMODITY_BY_YAHOO[sym] || sym.replace(/=F$/, ''), group: 'commodities' };
    }
    if (type === 'EQUITY' || type === 'ETF') {
        if (sym.endsWith('.SA')) {
            const base = sym.slice(0, -3);
            // Na B3, papel terminado em 11 costuma ser FII ou unit; o app trata
            // os dois pelo mesmo caminho de cotação.
            return { ticker: base, group: /11$/.test(base) ? 'fiis' : 'acoes_br' };
        }
        if (sym.includes('.')) return null;      // outras bolsas: fora do escopo
        return { ticker: sym, group: 'acoes_int' };
    }
    return null;
}

const EXCHANGE_LABEL = {
    cripto: 'BINANCE', acoes_br: 'B3', fiis: 'B3',
    indices: 'ÍNDICE', commodities: 'FUTUROS', acoes_int: 'NASDAQ',
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const q = String(req.query.q || '').trim().slice(0, 40);
    if (q.length < 1) return res.status(200).json({ results: [] });

    // O buscador é aberto (sem login), então segura o volume por IP.
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'anon';
    const rl = await rateLimit(`search:${ip}`, { limit: 60, windowSec: 60 });
    if (!rl.ok) return res.status(429).json({ results: [], error: 'Too many requests' });

    const url = `https://query1.finance.yahoo.com/v1/finance/search`
        + `?q=${encodeURIComponent(q)}&quotesCount=20&newsCount=0&listsCount=0`;

    try {
        const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
        if (!r.ok) return res.status(200).json({ results: [] });
        const d = await r.json();

        const seen = new Set();
        const results = [];
        for (const item of d.quotes || []) {
            const mapped = toAppSymbol(item);
            if (!mapped) continue;
            const key = `${mapped.group}:${mapped.ticker}`;
            if (seen.has(key)) continue;          // o Yahoo repete o mesmo papel
            seen.add(key);
            results.push({
                ...mapped,
                name: item.longname || item.shortname || mapped.ticker,
                exchange: EXCHANGE_LABEL[mapped.group],
                yahoo: item.symbol,
            });
        }
        return res.status(200).json({ results });
    } catch {
        return res.status(200).json({ results: [] });
    }
}
