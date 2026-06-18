import { useState, useEffect } from 'react';

// Cotações ao vivo dos ativos da carteira (versão mobile, simplificada do site):
// cripto via Binance, ações/ETFs/FIIs via brapi.dev, dólar via AwesomeAPI.
// Degrada com elegância: sem rede, mantém os preços manuais (livePrices vazio).
export function useLivePrices(investments = [], enabled = true) {
  const [livePrices, setLivePrices] = useState({ USD: 5.0 });

  const cryptoKey = investments.filter(a => a.type === 'crypto' && a.symbol).map(a => a.symbol).join(',');
  const stockKey = investments.filter(a => ['acoes', 'etfs', 'fiis'].includes(a.type) && a.symbol).map(a => a.symbol).join(',');

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const run = async () => {
      const next = {};

      // Dólar
      try {
        const r = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
        if (r.ok) { const d = await r.json(); const v = parseFloat(d?.USDBRL?.bid); if (v) next.USD = v; }
      } catch { /* mantém 5.0 */ }

      // Cripto (Binance)
      const cryptos = [...new Set(investments.filter(a => a.type === 'crypto' && a.symbol).map(a => a.symbol.toUpperCase()))];
      if (cryptos.length) {
        try {
          const r = await fetch('https://api.binance.com/api/v3/ticker/price');
          if (r.ok) {
            const all = await r.json();
            cryptos.forEach(t => {
              const usdt = all.find(p => p.symbol === `${t}USDT`);
              const brl = all.find(p => p.symbol === `${t}BRL`);
              if (usdt) next[`${t}_USD`] = parseFloat(usdt.price);
              if (brl) next[`${t}_BRL`] = parseFloat(brl.price);
            });
          }
        } catch { /* ignora */ }
      }

      // Ações / ETFs / FIIs (brapi.dev)
      const stocks = [...new Set(investments.filter(a => ['acoes', 'etfs', 'fiis'].includes(a.type) && a.symbol).map(a => a.symbol.toUpperCase()))];
      await Promise.all(stocks.map(async (t) => {
        try {
          const r = await fetch(`https://brapi.dev/api/quote/${t}`);
          if (r.ok) {
            const d = await r.json();
            const res = d?.results?.[0];
            if (res?.regularMarketPrice) next[t] = parseFloat(res.regularMarketPrice);
            if (res?.regularMarketChangePercent != null) next[`${t}_chg`] = parseFloat(res.regularMarketChangePercent);
          }
        } catch { /* ignora */ }
      }));

      if (!cancelled) setLivePrices(prev => ({ ...prev, ...next }));
    };

    run();
    const id = setInterval(run, 120000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, cryptoKey, stockKey]);

  return livePrices;
}
