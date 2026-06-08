/**
 * Vercel Serverless Function: /api/quotes
 *
 * Cotações com variação para o Monitor de Ativos (estilo TradingView).
 * Diferente de /api/prices (que só devolve preço), aqui devolvemos também
 * a variação do dia (absoluta e %) e a moeda nativa de cada ativo.
 *
 * Query params:
 *   symbols=NVDA,PETR4,BTC,^BVSP   (comma-separated, mesma ordem de groups)
 *   groups=acoes_int,acoes_br,cripto,indices
 *
 * Grupos suportados: indices | acoes_int | acoes_br | cripto | fiis
 *
 * Resposta: { quotes: { TICKER: { price, change, changePercent, currency, name, source } }, usd, fetchedAt }
 */

import { sanitizePairs } from './_marketGuard.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

// Apelidos comuns de índices → símbolo real (Yahoo Finance).
const INDEX_ALIASES = {
    IBOV: '^BVSP', IBOVESPA: '^BVSP', BVSP: '^BVSP', IBX: '^BVSP',
    SPX: '^GSPC', SPX500: '^GSPC', SP500: '^GSPC', SP: '^GSPC', GSPC: '^GSPC', 'S&P500': '^GSPC',
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

async function fetchBinance(sym) {
    try {
        const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}USDT`);
        if (r.ok) {
            const d = await r.json();
            if (d && d.lastPrice) {
                return {
                    price: parseFloat(d.lastPrice),
                    change: parseFloat(d.priceChange),
                    changePercent: parseFloat(d.priceChangePercent),
                    currency: 'USD',
                    source: 'binance',
                };
            }
        }
    } catch (e) { /* ignora */ }
    return null;
}

async function fetchBrapi(sym) {
    try {
        const r = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(sym)}?token=guest`, {
            headers: { 'User-Agent': UA }
        });
        if (r.ok) {
            const d = await r.json();
            const q = d?.results?.[0];
            if (q && q.regularMarketPrice != null) {
                return {
                    price: parseFloat(q.regularMarketPrice),
                    change: parseFloat(q.regularMarketChange || 0),
                    changePercent: parseFloat(q.regularMarketChangePercent || 0),
                    currency: q.currency || 'BRL',
                    name: q.shortName || q.longName || null,
                    logo: q.logourl || null,
                    source: 'brapi',
                };
            }
        }
    } catch (e) { /* ignora */ }
    return null;
}

async function fetchYahoo(sym) {
    // includePrePost=true para captar pré/pós-mercado; intraday 5m para o último preço.
    const urls = [
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=5m&range=1d&includePrePost=true`,
        `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=5m&range=1d&includePrePost=true`,
    ];
    for (const url of urls) {
        try {
            const r = await fetch(url, {
                headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' }
            });
            if (r.ok) {
                const d = await r.json();
                const result = d?.chart?.result?.[0];
                const meta = result?.meta;
                if (meta && meta.regularMarketPrice != null) {
                    const price = parseFloat(meta.regularMarketPrice);
                    // Variação do dia = preço regular vs. fechamento do pregão ANTERIOR.
                    const prev = parseFloat(meta.previousClose ?? meta.chartPreviousClose ?? price);
                    const change = price - prev;
                    const changePercent = prev ? (change / prev) * 100 : 0;

                    // Pré/pós-mercado: último ponto fora do horário regular.
                    let preMarket = null;
                    const tp = meta.currentTradingPeriod;
                    const ts = result.timestamp || [];
                    const closes = result.indicators?.quote?.[0]?.close || [];
                    if (tp && ts.length) {
                        for (let i = ts.length - 1; i >= 0; i--) {
                            const c = closes[i];
                            if (c == null) continue;
                            const t = ts[i];
                            if (tp.post && t >= tp.post.start && t <= tp.post.end) { preMarket = { price: +c, label: 'pos' }; break; }
                            if (tp.pre && tp.regular && t >= tp.pre.start && t < tp.regular.start) { preMarket = { price: +c, label: 'pre' }; break; }
                            if (tp.regular && t >= tp.regular.start && t <= tp.regular.end) break;
                        }
                    }
                    if (preMarket && isFinite(preMarket.price)) {
                        preMarket.change = preMarket.price - price;
                        preMarket.changePercent = price ? (preMarket.change / price) * 100 : 0;
                    } else {
                        preMarket = null;
                    }

                    return {
                        price, change, changePercent,
                        currency: meta.currency || 'USD',
                        name: meta.shortName || meta.longName || null,
                        source: 'yahoo',
                        preMarket,
                    };
                }
            }
        } catch (e) { /* tenta próxima url */ }
    }
    return null;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { symbols = '', groups = '' } = req.query;
    if (!symbols) return res.status(400).json({ error: 'No symbols provided' });

    // F-07: valida formato dos símbolos e limita a quantidade por request.
    const pairs = sanitizePairs(symbols, groups, 'acoes_int');
    if (pairs.length === 0) return res.status(400).json({ error: 'No valid symbols provided' });

    const quotes = {};

    await Promise.all(pairs.map(async ({ sym, meta: grp }) => {
        let q = null;

        if (grp === 'commodities') {
            q = await fetchYahoo(COMMODITIES[sym] || sym);
        } else if (grp === 'cripto') {
            q = await fetchBinance(sym);
            if (q) q.logo = `https://assets.coincap.io/assets/icons/${sym.toLowerCase()}@2x.png`;
        } else if (grp === 'acoes_br' || grp === 'fiis') {
            q = await fetchBrapi(sym);
            if (!q) q = await fetchYahoo(sym.includes('.') ? sym : `${sym}.SA`);
        } else if (grp === 'indices') {
            const cands = INDEX_ALIASES[sym] ? [INDEX_ALIASES[sym]] : [sym, `^${sym}`];
            for (const c of cands) { q = await fetchYahoo(c); if (q) break; }
            if (!q) q = await fetchBrapi(sym);
        } else { // acoes_int
            q = await fetchYahoo(sym);
            if (!q) q = await fetchBrapi(sym);
            if (q && !q.logo) q.logo = `https://financialmodelingprep.com/image-stock/${sym}.png`;
        }

        if (q) quotes[sym] = q;
    }));

    // USD/BRL para o front converter a moeda de exibição.
    let usd = 5.0;
    try {
        const fx = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
        if (fx.ok) {
            const d = await fx.json();
            usd = parseFloat(d.USDBRL?.bid) || 5.0;
        }
    } catch (e) { /* usa fallback */ }

    return res.status(200).json({ quotes, usd, fetchedAt: new Date().toISOString() });
}
