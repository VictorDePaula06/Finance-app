import { useState, useEffect, useCallback } from 'react';
import { getUsdRate } from '../utils/marketRates';

// Hook compartilhado de cotações ao vivo dos investimentos (cripto, ações/ETFs/FIIs)
// e taxas do Tesouro Direto. Centraliza a busca para que TODAS as telas avaliem o
// patrimônio com os mesmos preços (ex.: o medidor de Saúde na sidebar e o card da
// Visão Geral do Patrimônio ficam consistentes).
//
// @param {Array} investments  carteira (para descobrir quais tickers buscar)
// @param {boolean} enabled    só busca quando necessário (ex.: módulo Patrimônio ativo)
export function useLivePrices(investments = [], enabled = true) {
    const [livePrices, setLivePrices] = useState({ USD: 5.0 });
    const [tesouroData, setTesouroData] = useState([]);

    const getTesouroRate = useCallback((bondName) => {
        if (!bondName || tesouroData.length === 0) return null;
        const n = bondName.trim().toLowerCase();
        const match = tesouroData.find(b => b.nm && b.nm.trim().toLowerCase() === n);
        if (match) return { rate: parseFloat(match.anulRentPrcnt), unitPrice: parseFloat(match.untrPric) };
        const fuzzy = tesouroData.find(b => b.nm && (n.includes(b.nm.trim().toLowerCase()) || b.nm.trim().toLowerCase().includes(n)));
        if (fuzzy) return { rate: parseFloat(fuzzy.anulRentPrcnt), unitPrice: parseFloat(fuzzy.untrPric) };
        return null;
    }, [tesouroData]);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;

        const fetchLivePrices = async () => {
            try {
                const newPrices = {};
                const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

                // Cripto (Binance)
                const cryptoTickers = [...new Set(investments.filter(a => a.type === 'crypto' && a.symbol).map(a => a.symbol.toUpperCase()))];
                if (cryptoTickers.length > 0) {
                    try {
                        const binanceRes = await fetch('https://api.binance.com/api/v3/ticker/price');
                        const binanceData = await binanceRes.json();
                        cryptoTickers.forEach(ticker => {
                            const usdtPair = binanceData.find(p => p.symbol === `${ticker}USDT`);
                            const brlPair = binanceData.find(p => p.symbol === `${ticker}BRL`);
                            if (usdtPair) newPrices[`${ticker}_USD`] = parseFloat(usdtPair.price);
                            if (brlPair) newPrices[`${ticker}_BRL`] = parseFloat(brlPair.price);
                        });
                    } catch (e) { console.warn('Binance fetch failed', e); }
                }

                // Ações / ETFs / FIIs
                const stockTickers = [...new Set(investments.filter(a => ['acoes', 'etfs', 'fiis'].includes(a.type) && a.symbol).map(a => a.symbol.toUpperCase()))];
                const stockTypes = stockTickers.map(t => {
                    const asset = investments.find(a => a.symbol?.toUpperCase() === t);
                    return asset?.type || 'acoes';
                });
                if (stockTickers.length > 0) {
                    if (!isLocalhost) {
                        try {
                            const apiUrl = `/api/prices?tickers=${stockTickers.join(',')}&types=${stockTypes.join(',')}`;
                            const res = await fetch(apiUrl);
                            if (res.ok) { const data = await res.json(); Object.assign(newPrices, data.prices); }
                        } catch (e) { console.warn('Serverless fetch failed', e); }
                    } else {
                        await Promise.all(stockTickers.map(async (ticker) => {
                            try {
                                const brapiRes = await fetch(`https://brapi.dev/api/quote/${ticker}`);
                                if (brapiRes.ok) {
                                    const brapiData = await brapiRes.json();
                                    const price = brapiData?.results?.[0]?.regularMarketPrice;
                                    if (price) { newPrices[ticker] = parseFloat(price); return; }
                                }
                            } catch (e) { /* tenta fallback */ }
                            try {
                                const isProbablyBR = /\d/.test(ticker) || (ticker.length >= 5 && !ticker.includes('.'));
                                const yahooTicker = isProbablyBR ? `${ticker}.SA` : ticker;
                                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}`;
                                const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
                                if (res.ok) {
                                    const data = await res.json();
                                    const meta = data?.chart?.result?.[0]?.meta;
                                    const price = meta?.regularMarketPrice || meta?.previousClose;
                                    if (price) { newPrices[ticker] = parseFloat(price); return; }
                                }
                            } catch (e) { /* ignora */ }
                        }));
                    }
                }

                const usd = await getUsdRate();
                if (usd) newPrices.USD = usd;
                if (!cancelled) setLivePrices(prev => ({ ...prev, ...newPrices }));
            } catch (error) {
                console.error('Price fetch failed:', error);
            }
        };

        const fetchTesouro = async () => {
            try {
                const res = await fetch('/api/tesouro', { signal: AbortSignal.timeout(10000) });
                if (res.ok) {
                    const data = await res.json();
                    if (data.bonds && data.bonds.length > 0) { if (!cancelled) setTesouroData(data.bonds); return; }
                }
            } catch (e) { console.warn('/api/tesouro failed:', e.message); }

            const tesouroUrl = 'https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/service/api/treasurybondpriceandsavings.json';
            const proxies = [
                `https://api.allorigins.win/get?url=${encodeURIComponent(tesouroUrl)}`,
                `https://corsproxy.io/?${encodeURIComponent(tesouroUrl)}`,
            ];
            for (const proxyUrl of proxies) {
                try {
                    const res = await fetch(proxyUrl);
                    if (res.ok) {
                        const data = await res.json();
                        const rawContents = data.contents ? JSON.parse(data.contents) : data;
                        const list = rawContents?.response?.TrsryBondArr || [];
                        if (list.length > 0) { if (!cancelled) setTesouroData(list); break; }
                    }
                } catch (e) { /* tenta próximo proxy */ }
            }
        };

        fetchLivePrices();
        fetchTesouro();
        const interval = setInterval(() => { fetchLivePrices(); fetchTesouro(); }, 120000);
        return () => { cancelled = true; clearInterval(interval); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, investments.length]);

    return { livePrices, tesouroData, getTesouroRate };
}
