// ── Séries de mercado para a tela /charts ───────────────────────────
// Busca e normaliza candles (OHLCV) de qualquer ativo da watchlist e deriva
// as estatísticas que a tela mostra (desempenho, sazonalidade, média móvel).
//
// Cripto vem da Binance direto do navegador: o servidor da Binance bloqueia
// chamadas vindas de datacenter (HTTP 451). O resto passa por /api/history.
//
// Duas coisas independentes governam o gráfico:
//   INTERVALO (INTERVALS) — o tamanho de cada vela;
//   FAIXA (RANGES)        — quanto do tempo aparece na tela ao abrir.
// Quem não escolhe intervalo fica no padrão da faixa (AUTO_INTERVAL).

export const GROUPS = {
    indices: { label: 'Índices', native: 'USD', kind: 'Índice' },
    acoes_int: { label: 'Ações Internacionais', native: 'USD', kind: 'Ação' },
    acoes_br: { label: 'Ações Brasileiras', native: 'BRL', kind: 'Ação' },
    cripto: { label: 'Criptomoedas', native: 'USD', kind: 'Cripto' },
    commodities: { label: 'Commodities', native: 'USD', kind: 'Commodity' },
    fiis: { label: 'Fundos Imobiliários', native: 'BRL', kind: 'FII' },
};

// Intervalos de vela oferecidos no seletor do cabeçalho.
//   binance / yahoo = o código de cada fonte;
//   yahooRange      = janela pedida ao Yahoo, respeitando os limites dele
//                     (1m só volta 7 dias; os demais intradiários, 60).
//   ms              = duração da vela, usada na contagem regressiva.
export const INTERVALS = [
    { id: '1m', label: '1m', ms: 60e3, binance: '1m', yahoo: '1m', yahooRange: '5d' },
    { id: '5m', label: '5m', ms: 5 * 60e3, binance: '5m', yahoo: '5m', yahooRange: '1mo' },
    { id: '15m', label: '15m', ms: 15 * 60e3, binance: '15m', yahoo: '15m', yahooRange: '1mo' },
    { id: '30m', label: '30m', ms: 30 * 60e3, binance: '30m', yahoo: '30m', yahooRange: '1mo' },
    { id: '1h', label: '1h', ms: 3600e3, binance: '1h', yahoo: '60m', yahooRange: '6mo' },
    // O Yahoo não tem 4h: buscamos 1h e juntamos de quatro em quatro, senão o
    // cabeçalho diria "4h" mostrando vela de uma hora.
    { id: '4h', label: '4h', ms: 4 * 3600e3, binance: '4h', yahoo: '60m', yahooRange: '6mo', groupBy: 4 * 3600e3 },
    { id: '1D', label: '1D', ms: 86400e3, binance: '1d', yahoo: '1d', yahooRange: '5y' },
    // 'max' com 1wk faz o Yahoo devolver vela MENSAL; 10y mantém a semanal.
    { id: '1S', label: '1S', ms: 7 * 86400e3, binance: '1w', yahoo: '1wk', yahooRange: '10y' },
    { id: '1M', label: '1M', ms: 30 * 86400e3, binance: '1M', yahoo: '1mo', yahooRange: 'max' },
];
export const INTERVAL_BY_ID = Object.fromEntries(INTERVALS.map(i => [i.id, i]));

// Faixas da barra inferior. `spanMs` é quanto a tela mostra ao abrir; sempre
// buscamos mais do que isso, senão não sobra passado para arrastar.
export const RANGES = [
    { id: '1D', label: '1D', spanMs: 1 * 86400e3 },
    { id: '5D', label: '5D', spanMs: 5 * 86400e3 },
    { id: '1M', label: '1M', spanMs: 30 * 86400e3 },
    { id: '3M', label: '3M', spanMs: 91 * 86400e3 },
    { id: '6M', label: '6M', spanMs: 182 * 86400e3 },
    { id: 'YTD', label: 'YTD', spanMs: null },        // até 1º de janeiro
    { id: '1A', label: '1A', spanMs: 365 * 86400e3 },
    { id: '5A', label: '5A', spanMs: 1826 * 86400e3 },
    { id: 'TODOS', label: 'Todos', spanMs: Infinity },
];

// Intervalo padrão de cada faixa: o que dá um gráfico legível sem escolher
// nada. Serve só enquanto a pessoa não escolhe um intervalo no cabeçalho.
const AUTO_INTERVAL = {
    '1D': '5m', '5D': '30m', '1M': '4h', '3M': '4h', '6M': '1D',
    'YTD': '1D', '1A': '1D', '5A': '1S', 'TODOS': '1M',
};
export const autoIntervalFor = (rangeId) => AUTO_INTERVAL[rangeId] || '1D';

// Janela visível de uma faixa. YTD é o único que depende da data de hoje.
export function viewSpanMs(rangeId) {
    if (rangeId === 'YTD') {
        const now = new Date();
        return now.getTime() - new Date(now.getFullYear(), 0, 1).getTime();
    }
    const r = RANGE_BY_ID[rangeId];
    return r ? r.spanMs : null;
}
export const RANGE_BY_ID = Object.fromEntries(RANGES.map(r => [r.id, r]));

const COMMODITIES = {
    OURO: 'GC=F', GOLD: 'GC=F', XAU: 'XAUUSD=X', XAUUSD: 'XAUUSD=X',
    PRATA: 'SI=F', SILVER: 'SI=F', XAG: 'XAGUSD=X',
    PETROLEO: 'CL=F', OIL: 'CL=F', WTI: 'CL=F', BRENT: 'BZ=F',
    GAS: 'NG=F', GASNATURAL: 'NG=F', COBRE: 'HG=F', COPPER: 'HG=F',
    MILHO: 'ZC=F', CORN: 'ZC=F', SOJA: 'ZS=F', SOYBEAN: 'ZS=F',
    CAFE: 'KC=F', COFFEE: 'KC=F', ACUCAR: 'SB=F', SUGAR: 'SB=F', BOI: 'LE=F',
};
const INDEX_ALIASES = {
    IBOV: '^BVSP', IBOVESPA: '^BVSP', BVSP: '^BVSP', IBX: '^BVSP',
    SPX: '^GSPC', SPX500: '^GSPC', SP500: '^GSPC', GSPC: '^GSPC', 'S&P500': '^GSPC',
    NASDAQ: '^IXIC', IXIC: '^IXIC', NASDAQ100: '^NDX', NDX: '^NDX',
    DOW: '^DJI', DJI: '^DJI', DJIA: '^DJI',
    RUSSELL: '^RUT', RUT: '^RUT', VIX: '^VIX',
    FTSE: '^FTSE', DAX: '^GDAXI', CAC: '^FCHI', NIKKEI: '^N225', N225: '^N225',
    HANGSENG: '^HSI', HSI: '^HSI',
};
export const yahooSymbol = (ticker, group) => {
    if (group === 'commodities') return COMMODITIES[ticker] || ticker;
    if (group === 'indices') return INDEX_ALIASES[ticker] || (ticker.startsWith('^') ? ticker : `^${ticker}`);
    if ((group === 'acoes_br' || group === 'fiis') && !ticker.includes('.')) return `${ticker}.SA`;
    return ticker;
};

// A Binance devolve só o par; estes são os nomes que ela não dá.
const CRYPTO_NAMES = {
    BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', BNB: 'BNB', XRP: 'XRP',
    ADA: 'Cardano', DOGE: 'Dogecoin', AVAX: 'Avalanche', DOT: 'Polkadot',
    MATIC: 'Polygon', LINK: 'Chainlink', LTC: 'Litecoin', TRX: 'TRON',
    SHIB: 'Shiba Inu', UNI: 'Uniswap', ATOM: 'Cosmos', XLM: 'Stellar',
    NEAR: 'NEAR Protocol', APT: 'Aptos', ARB: 'Arbitrum', OP: 'Optimism',
};

// Nome longo do par, como o TradingView mostra no topo ("Bitcoin / TetherUS").
export const pairLabel = (ticker, group, name) => {
    if (group === 'cripto') return `${CRYPTO_NAMES[ticker] || name || ticker} / TetherUS`;
    return name || ticker;
};

// Cotação de cripto tem de sair do navegador: a Binance responde 451 para
// chamadas vindas de servidor, então /api/quotes nunca cobre esse grupo.
// Usa o candle DIÁRIO (abre 00:00 UTC) para a variação "de hoje".
export async function fetchCryptoQuotes(items) {
    const out = {};
    await Promise.all((items || []).map(async ({ ticker }) => {
        try {
            const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${ticker}USDT&interval=1d&limit=1`);
            if (!r.ok) return;
            const [k] = await r.json();
            const open = +k[1], close = +k[4];
            if (!isFinite(close)) return;
            out[ticker] = {
                price: close,
                change: close - open,
                changePercent: open ? ((close - open) / open) * 100 : 0,
                currency: 'USD',
                name: CRYPTO_NAMES[ticker] || ticker,
            };
        } catch { /* ativo sem par USDT ou rede fora */ }
    }));
    return out;
}
export const exchangeOf = (group) => {
    if (group === 'cripto') return 'BINANCE';
    if (group === 'acoes_br' || group === 'fiis') return 'B3';
    if (group === 'indices') return 'ÍNDICE';
    if (group === 'commodities') return 'FUTUROS';
    return 'NASDAQ';
};

const okCandle = (k) => [k.o, k.h, k.l, k.c].every(n => n != null && isFinite(n));

// Junta candles em baldes de `bucketMs`, alinhados ao relógio. Abre no
// primeiro, fecha no último, máxima e mínima do conjunto, volume somado.
function aggregate(candles, bucketMs) {
    if (!bucketMs || !candles.length) return candles;
    const out = [];
    let cur = null;
    for (const k of candles) {
        const t = Math.floor(k.t / bucketMs) * bucketMs;
        if (!cur || cur.t !== t) {
            if (cur) out.push(cur);
            cur = { t, o: k.o, h: k.h, l: k.l, c: k.c, v: k.v || 0 };
        } else {
            cur.h = Math.max(cur.h, k.h);
            cur.l = Math.min(cur.l, k.l);
            cur.c = k.c;
            cur.v += k.v || 0;
        }
    }
    if (cur) out.push(cur);
    return out;
}

async function fetchCrypto(ticker, iv) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${ticker}USDT&interval=${iv.binance}&limit=1000`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Binance ${r.status}`);
    const d = await r.json();
    return d
        .map(k => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }))
        .filter(okCandle);
}

async function fetchViaApi(ticker, group, iv) {
    const r = await fetch(`/api/history?symbol=${encodeURIComponent(ticker)}&group=${group}`
        + `&interval=${encodeURIComponent(iv.yahoo)}&range=${encodeURIComponent(iv.yahooRange)}`);
    if (!r.ok) throw new Error(`history ${r.status}`);
    const d = await r.json();
    if (!d.candles?.length) throw new Error('sem candles');
    return aggregate(d.candles.filter(okCandle), iv.groupBy);
}

// Candles de um ativo no intervalo pedido. Nunca lança: devolve [] se falhar,
// para a tela mostrar o estado vazio em vez de quebrar.
export async function fetchCandles(ticker, group, intervalId) {
    const iv = INTERVAL_BY_ID[intervalId] || INTERVAL_BY_ID['1D'];
    const tries = group === 'cripto'
        ? [() => fetchCrypto(ticker, iv)]
        : [() => fetchViaApi(ticker, group, iv)];
    for (const run of tries) {
        try {
            const c = await run();
            if (c.length) return c;
        } catch { /* tenta a próxima fonte */ }
    }
    return [];
}

// ── Derivados ───────────────────────────────────────────────────────

// Espaçamento típico entre candles. Mediana, não média: um fim de semana ou
// um feriado no meio da série não desloca o resultado.
export function medianStep(candles) {
    if (!candles || candles.length < 3) return 0;
    const d = [];
    for (let i = 1; i < candles.length; i++) d.push(candles[i].t - candles[i - 1].t);
    d.sort((x, y) => x - y);
    return d[Math.floor(d.length / 2)] || 0;
}

// Rótulo do candle no cabeçalho (5min, 2h, 1D, 1S, 1M). Sai dos dados porque
// o intervalo muda conforme a fonte: a mesma janela de 1 mês vem em 2h pela
// Binance e em 1 dia pelo Yahoo.
export function intervalLabel(candles) {
    const ms = medianStep(candles);
    if (!ms) return '—';
    const min = ms / 60000;
    if (min < 60) return `${Math.round(min)}min`;
    const h = min / 60;
    if (h < 24) return `${Math.round(h)}h`;
    const d = h / 24;
    if (d < 6) return `${Math.round(d)}D`;
    if (d < 20) return `${Math.round(d / 7)}S`;
    if (d < 45) return '1M';
    return `${Math.round(d / 30)}M`;
}

// Média móvel simples sobre o fechamento. Devolve array alinhado aos candles,
// com null nas primeiras `period - 1` posições (sem base para calcular).
export function sma(candles, period) {
    const out = new Array(candles.length).fill(null);
    let acc = 0;
    for (let i = 0; i < candles.length; i++) {
        acc += candles[i].c;
        if (i >= period) acc -= candles[i - period].c;
        if (i >= period - 1) out[i] = acc / period;
    }
    return out;
}

// Variação percentual entre o primeiro e o último fechamento.
const pct = (from, to) => (from && isFinite(from) ? ((to - from) / from) * 100 : null);

// Desempenho por janela, a partir de uma série diária longa (1A/5A/Todos).
// Cada janela procura o candle mais próximo da data-alvo.
export function performance(daily) {
    if (!daily?.length) return {};
    const last = daily[daily.length - 1];
    const now = new Date(last.t);
    const at = (date) => {
        const target = date.getTime();
        // Primeiro candle com t >= alvo; se não houver, o mais antigo disponível.
        const hit = daily.find(k => k.t >= target);
        return hit || daily[0];
    };
    const back = (days) => at(new Date(now.getTime() - days * 86400000));
    const janFirst = new Date(now.getFullYear(), 0, 1);
    return {
        '1S': pct(back(7).c, last.c),
        '1M': pct(back(30).c, last.c),
        '3M': pct(back(91).c, last.c),
        '6M': pct(back(182).c, last.c),
        'YTD': pct(at(janFirst).c, last.c),
        '1A': pct(back(365).c, last.c),
    };
}

// Sazonalidade: variação média de cada mês do ano ao longo do histórico.
// Precisa de série longa (candles mensais de "Todos") para significar algo.
export function seasonality(monthly) {
    if (!monthly?.length) return [];
    const buckets = Array.from({ length: 12 }, () => []);
    for (const k of monthly) {
        const v = pct(k.o, k.c);
        if (v != null && isFinite(v)) buckets[new Date(k.t).getMonth()].push(v);
    }
    return buckets.map((vals, i) => ({
        month: i,
        avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
        n: vals.length,
    }));
}

// Resumo honesto do momento do ativo, calculado dos próprios candles.
// Substitui o bloco de notícias do TradingView — não inventamos manchete.
export function readSignal(candles) {
    if (!candles?.length) return null;
    const last = candles[candles.length - 1];
    const highs = candles.map(k => k.h);
    const lows = candles.map(k => k.l);
    const max = Math.max(...highs);
    const min = Math.min(...lows);
    const fromMax = pct(max, last.c);
    const fromMin = pct(min, last.c);
    const span = max - min;
    // Onde o preço está dentro da faixa do período (0 = fundo, 100 = topo).
    const position = span > 0 ? ((last.c - min) / span) * 100 : 50;
    return { max, min, fromMax, fromMin, position };
}

// Volume médio dos últimos `n` candles.
export function avgVolume(candles, n = 30) {
    if (!candles?.length) return null;
    const slice = candles.slice(-n).filter(k => isFinite(k.v));
    if (!slice.length) return null;
    return slice.reduce((a, k) => a + k.v, 0) / slice.length;
}

// Número compacto (15,48 K · 2,3 M · 1,2 B), como o painel do TradingView.
export function compact(n, locale = 'pt-BR') {
    if (n == null || !isFinite(n)) return '—';
    const abs = Math.abs(n);
    const fmt = (v, suffix) => `${v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${suffix}`;
    if (abs >= 1e9) return fmt(n / 1e9, 'B');
    if (abs >= 1e6) return fmt(n / 1e6, 'M');
    if (abs >= 1e3) return fmt(n / 1e3, 'K');
    return n.toLocaleString(locale, { maximumFractionDigits: 2 });
}

// Percentual no formato do idioma, com sinal. "+7,11%" em pt, "+7.11%" em en.
export function fmtPct(n, locale = 'pt-BR', digits = 2, signed = true) {
    if (n == null || !isFinite(n)) return '—';
    const v = n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return `${signed && n >= 0 ? '+' : ''}${v}%`;
}

// Preço com a precisão certa: ativo barato precisa de mais casas.
export function fmtPrice(n, locale = 'pt-BR') {
    if (n == null || !isFinite(n)) return '—';
    const abs = Math.abs(n);
    const d = abs === 0 || abs >= 1 ? 2 : abs >= 0.01 ? 4 : 8;
    return n.toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d });
}
