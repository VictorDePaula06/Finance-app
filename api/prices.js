/**
 * Vercel Serverless Function: /api/prices
 * Fetches live market prices server-side (no CORS issues).
 * 
 * Query params:
 *   tickers=PETR4,MXRF11,NVDA,BTC   (comma-separated)
 *   types=acoes,fiis,etfs,crypto      (comma-separated, same order)
 */

import { sanitizePairs } from './_marketGuard.js';

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

    // F-07: valida formato dos tickers e limita a quantidade por request.
    const pairs = sanitizePairs(tickers, types, 'acoes');
    if (pairs.length === 0) return res.status(400).json({ error: 'No valid tickers provided' });

    const prices = {};
    const changes = {}; // variação diária { pct, abs } por chave (mesma chave de prices)

    await Promise.all(pairs.map(async ({ sym: ticker, meta: assetType }) => {

        if (assetType === 'crypto') {
            // Binance /ticker/24hr → preço (lastPrice) + variação do dia
            try {
                const [usdRes, brlRes] = await Promise.allSettled([
                    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${ticker}USDT`),
                    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${ticker}BRL`),
                ]);
                if (usdRes.status === 'fulfilled' && usdRes.value.ok) {
                    const d = await usdRes.value.json();
                    if (d.lastPrice) {
                        prices[`${ticker}_USD`] = parseFloat(d.lastPrice);
                        changes[`${ticker}_USD`] = { pct: parseFloat(d.priceChangePercent), abs: parseFloat(d.priceChange) };
                    }
                }
                if (brlRes.status === 'fulfilled' && brlRes.value.ok) {
                    const d = await brlRes.value.json();
                    if (d.lastPrice) {
                        prices[`${ticker}_BRL`] = parseFloat(d.lastPrice);
                        changes[`${ticker}_BRL`] = { pct: parseFloat(d.priceChangePercent), abs: parseFloat(d.priceChange) };
                    }
                }
            } catch (e) {}
            return;
        }

        // Ações/ETFs/FIIs. Yahoo é PRIMÁRIO (inclui pré/pós-mercado): dá o preço
        // atual e a variação do dia mesmo com o mercado fechado. Regra de variação:
        //   var = último preço negociado (regular/pré/pós) − fechamento do dia anterior
        // Isso cobre os 3 casos pedidos: mercado aberto → variação do dia; fechado com
        // pré-mercado → variação do pré-mercado; sem pré-mercado → variação do último dia.
        const isProbablyBR = /\d/.test(ticker) || assetType === 'fiis';
        const yahooTicker = isProbablyBR ? `${ticker}.SA` : ticker;
        const yahooUrls = [
            `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=5m&range=1d&includePrePost=true`,
            `https://query2.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=5m&range=1d&includePrePost=true`,
        ];

        let done = false;
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
                    const result = data?.chart?.result?.[0];
                    const meta = result?.meta;
                    if (meta) {
                        const prevClose = meta.chartPreviousClose ?? meta.previousClose;
                        let price = meta.regularMarketPrice;
                        // Último preço negociado da série (inclui pré/pós-mercado).
                        const closes = result?.indicators?.quote?.[0]?.close || [];
                        for (let i = closes.length - 1; i >= 0; i--) { if (closes[i] != null) { price = closes[i]; break; } }
                        if (price) {
                            prices[ticker] = parseFloat(price);
                            if (prevClose > 0) changes[ticker] = { pct: (price - prevClose) / prevClose * 100, abs: price - prevClose };
                            done = true;
                            break;
                        }
                    }
                }
            } catch (e) {}
        }
        if (done) return;

        // Fallback: brapi (preço; variação se vier).
        try {
            const brapiRes = await fetch(`https://brapi.dev/api/quote/${ticker}?token=guest`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (brapiRes.ok) {
                const data = await brapiRes.json();
                const r = data?.results?.[0];
                const price = r?.regularMarketPrice;
                if (price) {
                    prices[ticker] = parseFloat(price);
                    if (r.regularMarketChangePercent != null) changes[ticker] = { pct: parseFloat(r.regularMarketChangePercent), abs: parseFloat(r.regularMarketChange) || 0 };
                }
            }
        } catch (e) {}
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

    return res.status(200).json({ prices, changes, fetchedAt: new Date().toISOString() });
}
