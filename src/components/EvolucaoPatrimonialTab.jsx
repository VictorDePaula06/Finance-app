import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, RefreshCw, Info, BarChart3, Calendar } from 'lucide-react';

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt2 = (v) => v?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '–';
const fmtPct = (v) => (v >= 0 ? '+' : '') + v?.toFixed(2) + '%';

// Simulate CDI daily compounding.
// totalTradingDays = real trading days in the period (e.g. 252 for 1 year).
// numPoints        = number of chart data points (weekly Yahoo data = ~52 for 1y).
// Each chart point i is mapped to its proportional trading day so the
// accumulation is always correct regardless of Yahoo's data interval.
function buildCDILine(cdiAnual, totalTradingDays, numPoints) {
    const dailyRate = Math.pow(1 + cdiAnual / 100, 1 / 252) - 1;
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        // How many trading days does this point represent?
        const dayIdx = Math.round((totalTradingDays * i) / Math.max(numPoints - 1, 1));
        const cumulative = Math.pow(1 + dailyRate, dayIdx);
        points.push(parseFloat(((cumulative - 1) * 100).toFixed(4)));
    }
    return points;
}

// Periods
const PERIODS = [
    { id: '1m',  label: '1 Mês',   days: 30  },
    { id: '3m',  label: '3 Meses', days: 90  },
    { id: '6m',  label: '6 Meses', days: 180 },
    { id: '1y',  label: '1 Ano',   days: 252 },
];

// Benchmarks config
const BENCHMARKS = {
    cdi:    { label: 'CDI',      color: '#6366f1', description: 'Taxa de referência renda fixa' },
    ibov:   { label: 'IBOVESPA', color: '#f59e0b', description: 'Índice da bolsa brasileira' },
    sp500:  { label: 'S&P 500',  color: '#10b981', description: 'Via SPY ETF · 500 maiores EUA' },
};

// Custom Tooltip
function CustomTooltip({ active, payload, label, isDark }) {
    if (!active || !payload?.length) return null;
    return (
        <div className={`p-4 rounded-2xl border shadow-2xl text-xs ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
            <p className="font-black text-slate-500 uppercase tracking-widest mb-3">{label}</p>
            {payload.map(entry => (
                <div key={entry.dataKey} className="flex items-center justify-between gap-6 mb-1">
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                        <span className="font-bold">{entry.name}</span>
                    </span>
                    <span className="font-black" style={{ color: entry.color }}>
                        {entry.value >= 0 ? '+' : ''}{entry.value?.toFixed(2)}%
                    </span>
                </div>
            ))}
        </div>
    );
}

export default function EvolucaoPatrimonialTab({ hideHeader = false, compact = false }) {
    const { theme } = useTheme();
    const { currentUser } = useAuth();
    const isDark = theme !== 'light';

    const [investments, setInvestments] = useState([]);
    const [jars, setJars] = useState([]);

    const [period, setPeriod] = useState('3m');
    const [activeBenchmarks, setActiveBenchmarks] = useState(['cdi', 'ibov', 'sp500']);
    const [cdiAnual, setCdiAnual] = useState(10.75);
    const [benchmarkData, setBenchmarkData] = useState({ ibov: null, sp500: null, tickerHistory: {} });
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [error, setError] = useState(null);

    const days = PERIODS.find(p => p.id === period)?.days ?? 90;

    // ── Build Yahoo ticker list from variable investments ──────────────────────
    const variableTickers = useMemo(() => {
        const tickers = [];
        investments.forEach(inv => {
            if (['acoes', 'etfs', 'fiis', 'crypto'].includes(inv.type) && inv.symbol) {
                const sym = inv.symbol.toUpperCase();
                let yahooTicker;
                if (inv.type === 'crypto') {
                    yahooTicker = `${sym}-USD`;
                } else {
                    const isProbablyBR = /\d/.test(sym) || (sym.length >= 5 && !sym.includes('.'));
                    yahooTicker = isProbablyBR ? `${sym}.SA` : sym;
                }
                if (!tickers.find(t => t.yahoo === yahooTicker)) {
                    tickers.push({ symbol: sym, yahoo: yahooTicker, type: inv.type });
                }
            }
        });
        return tickers;
    }, [investments]);

    // ── Fetch all benchmark data from serverless endpoint (no CORS) ────────────
    const fetchBenchmarks = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        const range = period === '1m' ? '1mo' : period === '3m' ? '3mo' : period === '6m' ? '6mo' : '1y';

        // Include user portfolio tickers for historical data
        const tickerParam = variableTickers.map(t => t.yahoo).join(',');
        const tickerQuery = tickerParam ? `&tickers=${encodeURIComponent(tickerParam)}` : '';

        try {
            const r = await fetch(`/api/benchmarks?range=${range}${tickerQuery}`, {
                signal: AbortSignal.timeout(30000),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();

            if (data.cdiAnual && data.cdiAnual > 0) setCdiAnual(data.cdiAnual);
            setBenchmarkData({
                ibov: data.ibov ?? null,
                sp500: data.sp500 ?? null,
                tickerHistory: data.tickerHistory ?? {},
            });
            setLastUpdated(new Date());
        } catch (err) {
            setError('Não foi possível buscar dados de mercado.');
            console.warn('[EvolucaoPatrimonial] fetchBenchmarks error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [period, variableTickers]);

    useEffect(() => { fetchBenchmarks(); }, [fetchBenchmarks]);

    useEffect(() => {
        if (!currentUser) return;
        const unsubInv = onSnapshot(query(collection(db, 'investments'), where('userId', '==', currentUser.uid)), (snap) => {
            setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const unsubJars = onSnapshot(query(collection(db, 'savings_jars'), where('userId', '==', currentUser.uid)), (snap) => {
            setJars(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => { unsubInv(); unsubJars(); };
    }, [currentUser]);
    // ── Fetch live prices for variable assets ───────────────────────────────────
    const [livePrices, setLivePrices] = useState({});

    useEffect(() => {
        if (investments.length === 0) return;

        const fetchPrices = async () => {
            const newPrices = {};
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

            // Crypto from Binance
            const cryptoTickers = [...new Set(investments.filter(a => a.type === 'crypto' && a.symbol).map(a => a.symbol.toUpperCase()))];
            if (cryptoTickers.length > 0) {
                try {
                    const res = await fetch('https://api.binance.com/api/v3/ticker/price');
                    const data = await res.json();
                    cryptoTickers.forEach(ticker => {
                        const usdtPair = data.find(p => p.symbol === `${ticker}USDT`);
                        const brlPair = data.find(p => p.symbol === `${ticker}BRL`);
                        if (usdtPair) newPrices[`${ticker}_USD`] = parseFloat(usdtPair.price);
                        if (brlPair) newPrices[`${ticker}_BRL`] = parseFloat(brlPair.price);
                    });
                } catch (e) { console.warn('[EvolucaoPatrimonial] Binance fetch failed', e); }
            }

            // Stocks/ETFs/FIIs
            const stockTickers = [...new Set(investments.filter(a => ['acoes', 'etfs', 'fiis'].includes(a.type) && a.symbol).map(a => a.symbol.toUpperCase()))];
            if (stockTickers.length > 0) {
                const stockTypes = stockTickers.map(t => {
                    const asset = investments.find(a => a.symbol?.toUpperCase() === t);
                    return asset?.type || 'acoes';
                });
                if (!isLocalhost) {
                    try {
                        const res = await fetch(`/api/prices?tickers=${stockTickers.join(',')}&types=${stockTypes.join(',')}`);
                        if (res.ok) {
                            const data = await res.json();
                            Object.assign(newPrices, data.prices);
                        }
                    } catch (e) { console.warn('[EvolucaoPatrimonial] /api/prices failed', e); }
                } else {
                    await Promise.all(stockTickers.map(async (ticker) => {
                        try {
                            const brapiRes = await fetch(`https://brapi.dev/api/quote/${ticker}`);
                            if (brapiRes.ok) {
                                const brapiData = await brapiRes.json();
                                const price = brapiData?.results?.[0]?.regularMarketPrice;
                                if (price) { newPrices[ticker] = parseFloat(price); return; }
                            }
                        } catch (e) {}
                        try {
                            const isProbablyBR = /\d/.test(ticker) || (ticker.length >= 5 && !ticker.includes('.'));
                            const yahooTicker = isProbablyBR ? `${ticker}.SA` : ticker;
                            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}`;
                            const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
                            if (res.ok) {
                                const data = await res.json();
                                const meta = data?.chart?.result?.[0]?.meta;
                                const price = meta?.regularMarketPrice || meta?.previousClose;
                                if (price) { newPrices[ticker] = parseFloat(price); }
                            }
                        } catch (e) {}
                    }));
                }
            }

            // USD/BRL
            try {
                const usdRes = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
                const usdData = await usdRes.json();
                newPrices.USD = parseFloat(usdData.USDBRL.bid);
            } catch (e) { newPrices.USD = 5.0; }

            setLivePrices(newPrices);
        };

        fetchPrices();
    }, [investments.length]);

    // ── Classify all assets with their purchase dates ──────────────────────────
    const portfolioAssets = useMemo(() => {
        const assets = [];
        const today = new Date();

        // Savings jars → they earn CDI * cdiPercent
        jars.forEach(jar => {
            const balance = parseFloat(jar.balance) || 0;
            if (balance <= 0) return;
            const pct = (parseFloat(jar.cdiPercent) || 100) / 100;
            // Use createdAt as the purchase date for jars
            const pDate = jar.createdAt ? new Date(jar.createdAt) : today;
            assets.push({ value: balance, type: 'cdi', cdiMultiplier: pct, purchaseDate: pDate });
        });

        // Investments
        investments.forEach(inv => {
            // Determine purchase date: explicit purchaseDate > createdAt > today
            const pDate = inv.purchaseDate ? new Date(inv.purchaseDate)
                : inv.createdAt ? new Date(inv.createdAt) : today;

            if (inv.type === 'renda_fixa') {
                const qty = inv.quantity || 1;
                const applied = inv.totalApplied || (inv.purchasePrice * qty) || 0;
                if (applied <= 0) return;

                const yieldType = inv.yieldType || (inv.cdiPercent ? 'cdi' : 'pre');

                if (yieldType === 'cdi') {
                    const pct = (parseFloat(String(inv.cdiPercent || 100).replace(',', '.')) || 100) / 100;
                    assets.push({ value: applied, type: 'cdi', cdiMultiplier: pct, purchaseDate: pDate });
                } else if (yieldType === 'ipca') {
                    const ipcaApprox = 4.5;
                    const fixedPart = parseFloat(String(inv.fixedRate || 0).replace(',', '.'));
                    assets.push({ value: applied, type: 'fixed', annualRate: (ipcaApprox + fixedPart) / 100, purchaseDate: pDate });
                } else if (yieldType === 'pre') {
                    const fixedPart = parseFloat(String(inv.fixedRate || 0).replace(',', '.'));
                    assets.push({ value: applied, type: 'fixed', annualRate: fixedPart / 100, purchaseDate: pDate });
                } else {
                    assets.push({ value: applied, type: 'cdi', cdiMultiplier: 1, purchaseDate: pDate });
                }
            } else {
                // Variable income (stocks, crypto, ETFs, FIIs, etc.)
                const cost = (inv.quantity || 1) * (inv.purchasePrice || 0);

                // Resolve current price: manualCurrentPrice > live price > purchase price
                let currentPrice = inv.manualCurrentPrice || inv.purchasePrice || 0;
                if (!inv.manualCurrentPrice && inv.symbol) {
                    const sym = inv.symbol.toUpperCase();
                    if (inv.type === 'crypto') {
                        if (inv.isUSD && livePrices[`${sym}_USD`]) currentPrice = livePrices[`${sym}_USD`];
                        else if (!inv.isUSD && livePrices[`${sym}_BRL`]) currentPrice = livePrices[`${sym}_BRL`];
                        else if (!inv.isUSD && livePrices[`${sym}_USD`] && livePrices.USD) currentPrice = livePrices[`${sym}_USD`] * livePrices.USD;
                    } else if (['acoes', 'etfs', 'fiis'].includes(inv.type)) {
                        if (livePrices[sym]) currentPrice = livePrices[sym];
                    }
                }

                const usdMultiplier = inv.isUSD ? (livePrices.USD || 5.0) : 1;
                const current = (inv.quantity || 1) * currentPrice * usdMultiplier;
                const totalCost = cost * usdMultiplier;

                if (totalCost <= 0) return;
                const returnPct = ((current - totalCost) / totalCost) * 100;

                // Resolve Yahoo ticker for historical data lookup
                const sym = (inv.symbol || '').toUpperCase();
                let yahooTicker = null;
                if (sym) {
                    if (inv.type === 'crypto') {
                        yahooTicker = `${sym}-USD`;
                    } else {
                        const isProbablyBR = /\d/.test(sym) || (sym.length >= 5 && !sym.includes('.'));
                        yahooTicker = isProbablyBR ? `${sym}.SA` : sym;
                    }
                }

                assets.push({ value: current, type: 'variable', returnPct, purchaseDate: pDate, yahooTicker });
            }
        });

        return assets;
    }, [jars, investments, livePrices]);

    const totalPortfolioValue = useMemo(() => {
        return portfolioAssets.reduce((acc, a) => acc + a.value, 0);
    }, [portfolioAssets]);

    // ── Build chart data with date-aware portfolio calculation ─────────────────
    const chartData = useMemo(() => {
        const numPoints = benchmarkData.ibov?.length || benchmarkData.sp500?.length || Math.ceil(days / 7) + 1;
        const cdiPoints = buildCDILine(cdiAnual, days, numPoints);

        // Calculate the actual calendar date range for the chart
        const today = new Date();
        const calendarDaysInPeriod = Math.round(days * 365 / 252); // convert trading days to approx calendar days
        const periodStart = new Date(today);
        periodStart.setDate(today.getDate() - calendarDaysInPeriod);

        return Array.from({ length: numPoints }, (_, i) => {
            const entry = { idx: i };

            // Calculate the real calendar date for this chart point
            const pointDate = new Date(periodStart);
            pointDate.setDate(periodStart.getDate() + Math.round((calendarDaysInPeriod * i) / Math.max(numPoints - 1, 1)));

            // Date label from benchmarks or generated
            const d = benchmarkData.ibov?.[i]?.date || benchmarkData.sp500?.[i]?.date;
            entry.date = d || pointDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

            // CDI benchmark (simulated)
            entry.cdi = parseFloat(cdiPoints[i]?.toFixed(3) ?? 0);

            // Portfolio: date-aware weighted compound return
            if (totalPortfolioValue > 0) {
                let weightedReturn = 0;

                portfolioAssets.forEach(asset => {
                    const weight = asset.value / totalPortfolioValue;

                    // If the asset wasn't purchased yet at this point, it contributes 0
                    if (asset.purchaseDate > pointDate) {
                        // Asset didn't exist yet — no return contribution
                        return;
                    }

                    // The asset's return starts from the later of: period start or purchase date
                    const effectiveStart = asset.purchaseDate > periodStart ? asset.purchaseDate : periodStart;
                    const calDaysHeld = Math.max(0, (pointDate - effectiveStart) / (1000 * 60 * 60 * 24));
                    const tradingDaysHeld = Math.round(calDaysHeld * 252 / 365);

                    if (asset.type === 'cdi') {
                        const dailyRate = Math.pow(1 + (cdiAnual / 100) * asset.cdiMultiplier, 1 / 252) - 1;
                        const cumReturn = (Math.pow(1 + dailyRate, tradingDaysHeld) - 1) * 100;
                        weightedReturn += weight * cumReturn;
                    } else if (asset.type === 'fixed') {
                        const dailyRate = Math.pow(1 + asset.annualRate, 1 / 252) - 1;
                        const cumReturn = (Math.pow(1 + dailyRate, tradingDaysHeld) - 1) * 100;
                        weightedReturn += weight * cumReturn;
                    } else if (asset.type === 'variable') {
                        // Use real historical data if available, otherwise linear interpolation
                        const history = asset.yahooTicker ? benchmarkData.tickerHistory?.[asset.yahooTicker] : null;
                        if (history && history.length > 0) {
                            // Map chart point index to the closest history point
                            const histIdx = Math.min(Math.round((i / Math.max(numPoints - 1, 1)) * (history.length - 1)), history.length - 1);
                            weightedReturn += weight * (history[histIdx]?.value ?? 0);
                        } else {
                            // Fallback: linear interpolation
                            const totalCalDays = Math.max(1, (today - effectiveStart) / (1000 * 60 * 60 * 24));
                            const elapsed = Math.max(0, (pointDate - effectiveStart) / (1000 * 60 * 60 * 24));
                            const pointReturn = (asset.returnPct * elapsed) / totalCalDays;
                            weightedReturn += weight * pointReturn;
                        }
                    }
                });

                entry.portfolio = parseFloat(weightedReturn.toFixed(3));
            } else {
                entry.portfolio = 0;
            }

            // IBOV
            if (benchmarkData.ibov?.[i]) entry.ibov = benchmarkData.ibov[i].value;

            // S&P 500
            if (benchmarkData.sp500?.[i]) entry.sp500 = benchmarkData.sp500[i].value;

            return entry;
        });
    }, [benchmarkData, cdiAnual, days, portfolioAssets, totalPortfolioValue, benchmarkData.tickerHistory]);

    // ── Final returns for each benchmark ──────────────────────────────────────
    const finalReturns = useMemo(() => {
        const last = chartData[chartData.length - 1] ?? {};
        const lastOf = (key) => {
            for (let i = chartData.length - 1; i >= 0; i--) {
                if (chartData[i][key] != null) return chartData[i][key];
            }
            return null;
        };
        return {
            portfolio: last.portfolio ?? 0,
            cdi:       last.cdi ?? 0,
            ibov:      lastOf('ibov'),
            sp500:     lastOf('sp500'),
        };
    }, [chartData]);


    const toggleBenchmark = (id) => {
        setActiveBenchmarks(prev =>
            prev.includes(id) ? (prev.length > 1 ? prev.filter(b => b !== id) : prev) : [...prev, id]
        );
    };

    // ── Lines to render ────────────────────────────────────────────────────────
    const lines = [
        { key: 'portfolio', name: 'Meu Portfólio', color: '#00E5A0', strokeWidth: 3.5, isPortfolio: true },
        { key: 'cdi',       name: 'CDI',            color: BENCHMARKS.cdi.color,   strokeWidth: 1.5, strokeDasharray: '6 3' },
        { key: 'ibov',      name: 'IBOVESPA',       color: BENCHMARKS.ibov.color,  strokeWidth: 1.5, strokeDasharray: '6 3' },
        { key: 'sp500',     name: 'S&P 500',        color: BENCHMARKS.sp500.color, strokeWidth: 1.5, strokeDasharray: '6 3' },
    ];

    const visibleLines = lines.filter(l => l.key === 'portfolio' || activeBenchmarks.includes(l.key));

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* ── HEADER ── */}
            {!hideHeader && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500 mb-1">Análise Comparativa</p>
                    <h2 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Evolução Patrimonial</h2>
                    <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Compare sua carteira com os principais benchmarks do mercado.
                    </p>
                </div>
                <button
                    onClick={fetchBenchmarks}
                    disabled={isLoading}
                    className={`p-4 rounded-2xl border transition-all flex items-center gap-2 text-xs font-black ${isDark ? 'bg-slate-900 border-white/5 hover:bg-white/10 text-slate-400' : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-500'}`}
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    {lastUpdated ? `Atualizado ${lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Atualizar'}
                </button>
            </div>
            )}

            {/* ── PERFORMANCE CARDS ── */}
            {!compact && <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Meu Portfólio',  value: finalReturns.portfolio, color: '#00E5A0',                   always: true },
                    { label: 'CDI',            value: finalReturns.cdi,       color: BENCHMARKS.cdi.color,        always: true },
                    { label: 'IBOVESPA',       value: finalReturns.ibov,      color: BENCHMARKS.ibov.color,       always: false },
                    { label: 'S&P 500',        value: finalReturns.sp500,     color: BENCHMARKS.sp500.color,      always: false },
                ].map(item => {
                    const hasData = item.value !== null && item.value !== undefined;
                    const positive = item.value >= 0;
                    return (
                        <div key={item.label} className={`p-6 rounded-[2rem] border transition-all ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3">{item.label}</p>
                            {hasData ? (
                                <>
                                    <p className={`text-2xl font-black ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {fmtPct(item.value)}
                                    </p>
                                    <div className={`flex items-center gap-1 mt-1 text-[10px] font-bold ${positive ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {PERIODS.find(p => p.id === period)?.label}
                                    </div>
                                </>
                            ) : (
                                <p className="text-slate-500 text-sm font-bold">Carregando...</p>
                            )}
                        </div>
                    );
                })}
            </div>}

            {/* ── CONTROLS ── */}
            {!compact && <div className={`p-5 rounded-[2rem] border flex flex-wrap gap-6 items-center justify-between ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>

                {/* Period selector */}
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <div className="flex gap-1">
                        {PERIODS.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setPeriod(p.id)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    period === p.id
                                        ? 'bg-[#5CCEEA] text-slate-950 shadow-md'
                                        : isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Benchmark toggles */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Comparar com:</span>
                    {Object.entries(BENCHMARKS).map(([id, bm]) => (
                        <button
                            key={id}
                            onClick={() => toggleBenchmark(id)}
                            className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                                activeBenchmarks.includes(id)
                                    ? 'border-transparent text-white'
                                    : isDark ? 'border-white/10 text-slate-500 hover:border-white/20' : 'border-slate-200 text-slate-400 hover:border-slate-300'
                            }`}
                            style={activeBenchmarks.includes(id) ? { background: bm.color + '33', borderColor: bm.color, color: bm.color } : {}}
                        >
                            <span className="w-2 h-2 rounded-full" style={{ background: activeBenchmarks.includes(id) ? bm.color : 'currentColor' }} />
                            {bm.label}
                        </button>
                    ))}
                </div>
            </div>}

            {/* ── CHART ── */}
            <div className={`p-6 md:p-8 rounded-[2.5rem] border ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <BarChart3 className="w-5 h-5 text-[#5CCEEA]" />
                        <h3 className={`font-black text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            Retorno Acumulado (%)
                        </h3>
                    </div>
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-xl ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                        <Info className="w-3 h-3" />
                        Base 0% no início do período
                    </div>
                </div>

                {isLoading ? (
                    <div className="h-72 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-10 h-10 rounded-full border-2 border-[#5CCEEA] border-t-transparent animate-spin" />
                            <p className="text-sm font-bold text-slate-500">Buscando dados de mercado...</p>
                        </div>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={340}>
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <defs>
                                <filter id="portfolioGlow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="3" result="glow" />
                                    <feMerge>
                                        <feMergeNode in="glow" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                                <linearGradient id="portfolioGradient" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#00E5A0" />
                                    <stop offset="100%" stopColor="#00D4FF" />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}
                            />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10, fill: isDark ? '#64748b' : '#94a3b8', fontWeight: 700 }}
                                tickLine={false}
                                axisLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: isDark ? '#64748b' : '#94a3b8', fontWeight: 700 }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                                width={60}
                            />
                            <Tooltip content={<CustomTooltip isDark={isDark} />} />
                            <Legend
                                wrapperStyle={{ fontSize: '10px', fontWeight: 700, paddingTop: '16px' }}
                                formatter={(value) => <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{value}</span>}
                            />
                            <ReferenceLine y={0} stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} strokeDasharray="4 4" />
                            {/* Benchmark lines (thinner, dashed) */}
                            {visibleLines.filter(l => !l.isPortfolio).map(line => (
                                <Line
                                    key={line.key}
                                    type="monotone"
                                    dataKey={line.key}
                                    name={line.name}
                                    stroke={line.color}
                                    strokeWidth={line.strokeWidth}
                                    strokeDasharray={line.strokeDasharray}
                                    dot={false}
                                    activeDot={{ r: 4, strokeWidth: 0 }}
                                    connectNulls
                                    strokeOpacity={0.7}
                                />
                            ))}
                            {/* Portfolio line (thick, solid, glowing) */}
                            {visibleLines.filter(l => l.isPortfolio).map(line => (
                                <Line
                                    key={line.key}
                                    type="monotone"
                                    dataKey={line.key}
                                    name={line.name}
                                    stroke="url(#portfolioGradient)"
                                    strokeWidth={line.strokeWidth}
                                    dot={false}
                                    activeDot={{ r: 6, strokeWidth: 3, stroke: '#00E5A0', fill: isDark ? '#0f172a' : '#ffffff' }}
                                    connectNulls
                                    filter="url(#portfolioGlow)"
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* ── BENCHMARK LEGEND ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(BENCHMARKS).map(([id, bm]) => (
                    <div key={id} className={`p-5 rounded-[2rem] border flex items-center gap-4 ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: bm.color + '20' }}>
                            <div className="w-3 h-3 rounded-full" style={{ background: bm.color }} />
                        </div>
                        <div>
                            <p className="text-xs font-black" style={{ color: bm.color }}>{bm.label}</p>
                            <p className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{bm.description}</p>
                        </div>
                        {finalReturns[id] !== null && finalReturns[id] !== undefined ? (
                            <p className={`ml-auto text-sm font-black ${finalReturns[id] >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {fmtPct(finalReturns[id])}
                            </p>
                        ) : null}
                    </div>
                ))}
            </div>

            {/* ── DISCLAIMER ── */}
            <div className={`flex items-start gap-3 p-5 rounded-2xl border ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className={`text-[10px] leading-relaxed font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    O retorno do portfólio é calculado com base no custo médio e valor atual dos seus ativos cadastrados.
                    IBOVESPA e S&amp;P 500 são obtidos via Yahoo Finance (dados defasados em até 15 minutos).
                    Rentabilidade passada não é garantia de retorno futuro.
                </p>
            </div>

        </div>
    );
}
