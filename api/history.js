/**
 * Vercel Serverless Function: /api/history
 *
 * Série histórica de preços para o gráfico do Monitor de Ativos (estilo Google).
 * Busca no Yahoo Finance no servidor (sem CORS). Cripto NÃO passa por aqui — é
 * buscada client-side na Binance (klines), pois a Binance bloqueia servidores.
 *
 * Query: symbol=NVDA&group=acoes_int&range=1D
 * Resposta: { points: [{ t: <ms>, c: <close> }], currency }
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const INDEX_ALIASES = {
    IBOV: '^BVSP', IBOVESPA: '^BVSP', BVSP: '^BVSP', IBX: '^BVSP',
    SPX: '^GSPC', SPX500: '^GSPC', SP500: '^GSPC', GSPC: '^GSPC', 'S&P500': '^GSPC',
    NASDAQ: '^IXIC', IXIC: '^IXIC', NASDAQ100: '^NDX', NDX: '^NDX',
    DOW: '^DJI', DJI: '^DJI', DJIA: '^DJI',
    RUSSELL: '^RUT', RUT: '^RUT', VIX: '^VIX',
    FTSE: '^FTSE', DAX: '^GDAXI', CAC: '^FCHI', NIKKEI: '^N225', N225: '^N225', HANGSENG: '^HSI', HSI: '^HSI',
};

// range → parâmetros do Yahoo (intervalo / janela).
const RANGE_MAP = {
    '1D': { interval: '5m', range: '1d' },
    '5D': { interval: '30m', range: '5d' },
    '1M': { interval: '1d', range: '1mo' },
    '6M': { interval: '1d', range: '6mo' },
    '1A': { interval: '1d', range: '1y' },
    'MAX': { interval: '1wk', range: 'max' },
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { symbol = '', group = 'acoes_int', range = '1D' } = req.query;
    if (!symbol) return res.status(400).json({ error: 'No symbol provided' });

    const sym = symbol.toUpperCase();
    const rcfg = RANGE_MAP[range] || RANGE_MAP['1D'];

    // Resolve o símbolo Yahoo conforme o grupo.
    let ysym = sym;
    if (group === 'indices') ysym = INDEX_ALIASES[sym] || (sym.startsWith('^') ? sym : `^${sym}`);
    else if ((group === 'acoes_br' || group === 'fiis') && !sym.includes('.')) ysym = `${sym}.SA`;

    const urls = [
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ysym)}?interval=${rcfg.interval}&range=${rcfg.range}`,
        `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ysym)}?interval=${rcfg.interval}&range=${rcfg.range}`,
    ];

    for (const url of urls) {
        try {
            const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
            if (r.ok) {
                const d = await r.json();
                const result = d?.chart?.result?.[0];
                const ts = result?.timestamp || [];
                const closes = result?.indicators?.quote?.[0]?.close || [];
                const currency = result?.meta?.currency || 'USD';
                const points = ts
                    .map((t, i) => ({ t: t * 1000, c: closes[i] }))
                    .filter(p => p.c != null && isFinite(p.c));
                if (points.length) return res.status(200).json({ points, currency });
            }
        } catch (e) { /* tenta próxima url */ }
    }

    return res.status(200).json({ points: [], currency: 'USD' });
}
