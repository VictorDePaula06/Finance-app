import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, RefreshCw, Info, BarChart3, Calendar } from 'lucide-react';

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt2 = (v) => v?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '–';
const fmtPct = (v) => (v >= 0 ? '+' : '') + v?.toFixed(2) + '%';

// Simulate CDI daily compounding — returns % accumulated return starting at 0
function buildCDILine(cdiAnual, days) {
    const dailyRate = Math.pow(1 + cdiAnual / 100, 1 / 252) - 1;
    const points = [];
    let cumulative = 1;
    for (let i = 0; i <= days; i++) {
        points.push(parseFloat(((cumulative - 1) * 100).toFixed(4)));
        cumulative *= (1 + dailyRate);
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

export default function EvolucaoPatrimonialTab({ investments = [], jarsTotal = 0 }) {
    const { theme } = useTheme();
    const { currentUser } = useAuth();
    const isDark = theme !== 'light';

    const [period, setPeriod] = useState('3m');
    const [activeBenchmarks, setActiveBenchmarks] = useState(['cdi', 'ibov', 'sp500']);
    const [cdiAnual, setCdiAnual] = useState(10.75);
    const [benchmarkData, setBenchmarkData] = useState({ ibov: null, sp500: null });
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [error, setError] = useState(null);

    const days = PERIODS.find(p => p.id === period)?.days ?? 90;

    // ── Fetch all benchmark data from serverless endpoint (no CORS) ────────────
    const fetchBenchmarks = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        const range = period === '1m' ? '1mo' : period === '3m' ? '3mo' : period === '6m' ? '6mo' : '1y';

        try {
            const r = await fetch(`/api/benchmarks?range=${range}`, {
                signal: AbortSignal.timeout(20000),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();

            if (data.cdiAnual && data.cdiAnual > 0) setCdiAnual(data.cdiAnual);
            setBenchmarkData({ ibov: data.ibov ?? null, sp500: data.sp500 ?? null });
            setLastUpdated(new Date());
        } catch (err) {
            setError('Não foi possível buscar dados de mercado.');
            console.warn('[EvolucaoPatrimonial] fetchBenchmarks error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [period]);

    useEffect(() => { fetchBenchmarks(); }, [fetchBenchmarks]);

    // ── Portfolio Performance (from investment records) ────────────────────────
    const portfolioReturn = useMemo(() => {
        if (!investments.length) return 0;
        let totalInvested = 0, totalCurrent = 0;
        investments.forEach(a => {
            if (a.type === 'renda_fixa') {
                const applied = a.totalApplied || a.purchasePrice || 0;
                const current = a.manualCurrentPrice || applied;
                const pRate = parseFloat(a.purchaseRate || a.fixedRate || 0);
                const cRate = parseFloat(a.currentMarketRate || a.fixedRate || 0);
                const calc = (pRate > 0 && cRate > 0 && pRate !== cRate && !a.manualCurrentPrice)
                    ? applied * (pRate / cRate) : current;
                totalInvested += applied;
                totalCurrent  += calc;
            } else {
                const cost = (a.quantity || 1) * (a.purchasePrice || 0);
                const val  = (a.quantity || 1) * (a.manualCurrentPrice || a.purchasePrice || 0);
                totalInvested += cost;
                totalCurrent  += val;
            }
        });
        return totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;
    }, [investments]);

    // ── Build chart data ───────────────────────────────────────────────────────
    const chartData = useMemo(() => {
        const numPoints = benchmarkData.ibov?.length || benchmarkData.sp500?.length || Math.ceil(days / 7) + 1;
        const cdiPoints = buildCDILine(cdiAnual, numPoints - 1);

        return Array.from({ length: numPoints }, (_, i) => {
            const entry = { idx: i };

            // Date label
            const d = benchmarkData.ibov?.[i]?.date || benchmarkData.sp500?.[i]?.date;
            if (d) {
                entry.date = d;
            } else {
                const dt = new Date();
                dt.setDate(dt.getDate() - (numPoints - 1 - i) * Math.ceil(days / numPoints));
                entry.date = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            }

            // CDI (simulated)
            entry.cdi = parseFloat(cdiPoints[i]?.toFixed(3) ?? 0);

            // Portfolio: linearly interpolate from 0 to portfolioReturn
            entry.portfolio = parseFloat(((portfolioReturn / (numPoints - 1)) * i).toFixed(3));

            // IBOV
            if (benchmarkData.ibov?.[i]) entry.ibov = benchmarkData.ibov[i].value;

            // S&P 500
            if (benchmarkData.sp500?.[i]) entry.sp500 = benchmarkData.sp500[i].value;

            return entry;
        });
    }, [benchmarkData, cdiAnual, days, portfolioReturn]);

    // ── Final returns for each benchmark ──────────────────────────────────────
    const finalReturns = useMemo(() => {
        const last = chartData[chartData.length - 1] ?? {};
        // ibov/sp500 arrays may have different lengths from each other.
        // Use the last non-null value so the top cards always show a number.
        const lastOf = (key) => {
            for (let i = chartData.length - 1; i >= 0; i--) {
                if (chartData[i][key] != null) return chartData[i][key];
            }
            return null;
        };
        return {
            portfolio: portfolioReturn,
            cdi:       last.cdi ?? 0,
            ibov:      lastOf('ibov'),
            sp500:     lastOf('sp500'),
        };
    }, [chartData, portfolioReturn]);


    const toggleBenchmark = (id) => {
        setActiveBenchmarks(prev =>
            prev.includes(id) ? (prev.length > 1 ? prev.filter(b => b !== id) : prev) : [...prev, id]
        );
    };

    // ── Lines to render ────────────────────────────────────────────────────────
    const lines = [
        { key: 'portfolio', name: 'Meu Portfólio', color: '#5CCEEA', strokeWidth: 3 },
        { key: 'cdi',       name: 'CDI',            color: BENCHMARKS.cdi.color,   strokeWidth: 2, strokeDasharray: '4 2' },
        { key: 'ibov',      name: 'IBOVESPA',       color: BENCHMARKS.ibov.color,  strokeWidth: 2, strokeDasharray: '4 2' },
        { key: 'sp500',     name: 'S&P 500',        color: BENCHMARKS.sp500.color, strokeWidth: 2, strokeDasharray: '4 2' },
    ];

    const visibleLines = lines.filter(l => l.key === 'portfolio' || activeBenchmarks.includes(l.key));

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* ── HEADER ── */}
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

            {/* ── PERFORMANCE CARDS ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Meu Portfólio',  value: finalReturns.portfolio, color: '#5CCEEA',                   always: true },
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
            </div>

            {/* ── CONTROLS ── */}
            <div className={`p-5 rounded-[2rem] border flex flex-wrap gap-6 items-center justify-between ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>

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
            </div>

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
                            {visibleLines.map(line => (
                                <Line
                                    key={line.key}
                                    type="monotone"
                                    dataKey={line.key}
                                    name={line.name}
                                    stroke={line.color}
                                    strokeWidth={line.strokeWidth}
                                    strokeDasharray={line.strokeDasharray}
                                    dot={false}
                                    activeDot={{ r: 5, strokeWidth: 0 }}
                                    connectNulls
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
