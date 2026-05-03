/**
 * Vercel Serverless Function: /api/benchmarks
 * Fetches CDI, IBOVESPA (^BVSP) and S&P 500 (SPY) historical data server-side.
 * No CORS issues because this runs on the server.
 *
 * Query params:
 *   range=1mo|3mo|6mo|1y   (Yahoo Finance range string)
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    // Cache por 15 minutos — dados de mercado não precisam ser mais frequentes
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { range = '3mo' } = req.query;
    const validRanges = ['1mo', '3mo', '6mo', '1y'];
    const safeRange = validRanges.includes(range) ? range : '3mo';

    const yahooHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    };

    // ── helper: fetch one ticker from Yahoo Finance ──────────────────────────
    async function fetchYahooHistory(ticker) {
        const urls = [
            `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1wk&range=${safeRange}`,
            `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1wk&range=${safeRange}`,
        ];

        for (const url of urls) {
            try {
                const r = await fetch(url, { headers: yahooHeaders });
                if (!r.ok) continue;
                const json = await r.json();
                const result = json?.chart?.result?.[0];
                if (!result?.indicators?.quote?.[0]?.close) continue;

                const closes = result.indicators.quote[0].close;
                const timestamps = result.timestamp;
                if (!closes?.length) continue;

                const base = closes.find(c => c != null);
                if (!base) continue;

                return closes.map((c, i) => ({
                    date: new Date(timestamps[i] * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                    value: c != null ? parseFloat(((c / base - 1) * 100).toFixed(3)) : null,
                })).filter(p => p.value !== null);
            } catch (_) { continue; }
        }
        return null;
    }

    // ── CDI: taxa diária do BCB (série 12 = taxa Selic/CDI diária) ───────────
    async function fetchCDI() {
        try {
            const r = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json', {
                headers: { 'User-Agent': 'Mozilla/5.0' },
            });
            if (!r.ok) return null;
            const json = await r.json();
            // BCB retorna taxa diária em %, ex: "0.04855" = 0.04855% ao dia
            const dailyPct = parseFloat(json[0]?.valor);
            if (isNaN(dailyPct) || dailyPct <= 0) return null;
            // Anualiza: (1 + dailyPct/100)^252 - 1
            const annual = (Math.pow(1 + dailyPct / 100, 252) - 1) * 100;
            return parseFloat(annual.toFixed(4));
        } catch (_) { return null; }
    }

    // ── Run all fetches in parallel ──────────────────────────────────────────
    const [cdiAnual, ibovData, sp500Data] = await Promise.all([
        fetchCDI(),
        fetchYahooHistory('^BVSP'),
        fetchYahooHistory('SPY'),
    ]);

    return res.status(200).json({
        cdiAnual: cdiAnual ?? 10.75,   // fallback se BCB falhar
        ibov:     ibovData  ?? null,
        sp500:    sp500Data ?? null,
        fetchedAt: new Date().toISOString(),
    });
}
