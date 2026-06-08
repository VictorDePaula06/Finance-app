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

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

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
                    source: 'brapi',
                };
            }
        }
    } catch (e) { /* ignora */ }
    return null;
}

async function fetchYahoo(sym) {
    const urls = [
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=2d`,
        `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=2d`,
    ];
    for (const url of urls) {
        try {
            const r = await fetch(url, {
                headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' }
            });
            if (r.ok) {
                const d = await r.json();
                const meta = d?.chart?.result?.[0]?.meta;
                if (meta && meta.regularMarketPrice != null) {
                    const price = parseFloat(meta.regularMarketPrice);
                    const prev = parseFloat(meta.chartPreviousClose || meta.previousClose || price);
                    const change = price - prev;
                    const changePercent = prev ? (change / prev) * 100 : 0;
                    return {
                        price, change, changePercent,
                        currency: meta.currency || 'USD',
                        name: meta.shortName || meta.longName || null,
                        source: 'yahoo',
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

    const symList = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const grpList = groups.split(',').map(s => s.trim().toLowerCase());

    const quotes = {};

    await Promise.all(symList.map(async (sym, i) => {
        const grp = grpList[i] || 'acoes_int';
        let q = null;

        if (grp === 'cripto') {
            q = await fetchBinance(sym);
        } else if (grp === 'acoes_br' || grp === 'fiis') {
            q = await fetchBrapi(sym);
            if (!q) q = await fetchYahoo(sym.includes('.') ? sym : `${sym}.SA`);
        } else if (grp === 'indices') {
            q = await fetchYahoo(sym);
            if (!q) q = await fetchBrapi(sym);
        } else { // acoes_int
            q = await fetchYahoo(sym);
            if (!q) q = await fetchBrapi(sym);
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
