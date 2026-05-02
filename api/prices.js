/**
 * Vercel Serverless Function: /api/prices
 * Fetches live market prices server-side (no CORS issues).
 * 
 * Query params:
 *   tickers=PETR4,MXRF11,NVDA,BTC   (comma-separated)
 *   types=acoes,fiis,etfs,crypto      (comma-separated, same order)
 */

export default async function handler(req, res) {
    // CORS headers so the browser can call this from any domain
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { tickers = '', types = '' } = req.query;
    if (!tickers) return res.status(400).json({ error: 'No tickers provided' });

    const tickerList = tickers.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    const typeList   = types.split(',').map(t => t.trim().toLowerCase());

    const prices = {};

    await Promise.all(tickerList.map(async (ticker, idx) => {
        const assetType = typeList[idx] || 'acoes';

        if (assetType === 'crypto') {
            // Binance for crypto
            try {
                const [usdRes, brlRes] = await Promise.allSettled([
                    fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${ticker}USDT`),
                    fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${ticker}BRL`),
                ]);
                if (usdRes.status === 'fulfilled' && usdRes.value.ok) {
                    const d = await usdRes.value.json();
                    if (d.price) prices[`${ticker}_USD`] = parseFloat(d.price);
                }
                if (brlRes.status === 'fulfilled' && brlRes.value.ok) {
                    const d = await brlRes.value.json();
                    if (d.price) prices[`${ticker}_BRL`] = parseFloat(d.price);
                }
            } catch (e) {}
            return;
        }

        // For stocks/ETFs/FIIs: try Brapi first, then Yahoo Finance
        const isProbablyBR = /\d/.test(ticker) || (ticker.length >= 5 && ticker.length <= 6 && !ticker.includes('.'));
        
        // 1. Brapi (best for BR assets)
        try {
            const brapiRes = await fetch(`https://brapi.dev/api/quote/${ticker}?token=guest`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (brapiRes.ok) {
                const data = await brapiRes.json();
                const price = data?.results?.[0]?.regularMarketPrice;
                if (price) {
                    prices[ticker] = parseFloat(price);
                    return;
                }
            }
        } catch (e) {}

        // 2. Yahoo Finance (server-side, no CORS)
        const yahooTicker = isProbablyBR ? `${ticker}.SA` : ticker;
        const yahooUrls = [
            `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=1d`,
            `https://query2.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=1d`,
        ];

        for (const url of yahooUrls) {
            try {
                const yahooRes = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/json',
                        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                    }
                });
                if (yahooRes.ok) {
                    const data = await yahooRes.json();
                    const meta = data?.chart?.result?.[0]?.meta;
                    const price = meta?.regularMarketPrice || meta?.previousClose || meta?.chartPreviousClose;
                    if (price) {
                        prices[ticker] = parseFloat(price);
                        return;
                    }
                }
            } catch (e) {}
        }
    }));

    // Also fetch USD/BRL rate
    try {
        const fxRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        if (fxRes.ok) {
            const fxData = await fxRes.json();
            if (fxData?.rates?.BRL) prices['USD'] = parseFloat(fxData.rates.BRL);
        }
    } catch (e) {}

    // Fallback USD rate from BCB if above fails
    if (!prices['USD']) {
        try {
            const bcbRes = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
            if (bcbRes.ok) {
                const bcbData = await bcbRes.json();
                prices['USD'] = parseFloat(bcbData.USDBRL?.bid || 5.0);
            }
        } catch (e) {
            prices['USD'] = 5.0;
        }
    }

    return res.status(200).json({ prices, fetchedAt: new Date().toISOString() });
}
