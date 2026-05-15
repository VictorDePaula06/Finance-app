import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, RefreshCw, Info, BarChart3, Calendar } from 'lucide-react';

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmtPct = (v) => (v >= 0 ? '+' : '') + v?.toFixed(2) + '%';

function buildCDILine(cdiAnual, totalTradingDays, numPoints) {
  const dailyRate = Math.pow(1 + cdiAnual / 100, 1 / 252) - 1;
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const dayIdx = Math.round((totalTradingDays * i) / Math.max(numPoints - 1, 1));
    const cumulative = Math.pow(1 + dailyRate, dayIdx);
    points.push(parseFloat(((cumulative - 1) * 100).toFixed(4)));
  }
  return points;
}

const PERIODS = [
  { id: '1m', label: '1 Mês', days: 30 },
  { id: '3m', label: '3 Meses', days: 90 },
  { id: '6m', label: '6 Meses', days: 180 },
  { id: '1y', label: '1 Ano', days: 252 },
];

const BENCHMARKS = {
  cdi:   { label: 'CDI',      color: '#6366f1', description: 'Taxa de referência renda fixa' },
  ibov:  { label: 'IBOVESPA', color: '#f59e0b', description: 'Índice da bolsa brasileira' },
  sp500: { label: 'S&P 500',  color: '#10b981', description: 'Via SPY ETF · 500 maiores EUA' },
};

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

export default function PatrimonioRetornoChart({ jars, investments, cdiAnual: propCdi, usdRate, patrimonioTotal, isDark }) {
  const [period, setPeriod] = useState('3m');
  const [activeBenchmarks, setActiveBenchmarks] = useState(['cdi', 'ibov', 'sp500']);
  const [cdiAnual, setCdiAnual] = useState(propCdi || 10.75);
  const [benchmarkData, setBenchmarkData] = useState({ ibov: null, sp500: null, tickerHistory: {} });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const days = PERIODS.find(p => p.id === period)?.days ?? 90;

  // Keep CDI in sync with parent prop
  useEffect(() => {
    if (propCdi && propCdi > 0) setCdiAnual(propCdi);
  }, [propCdi]);

  // Build Yahoo ticker list from variable investments
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

  // Fetch benchmarks from serverless endpoint
  const fetchBenchmarks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const range = period === '1m' ? '1mo' : period === '3m' ? '3mo' : period === '6m' ? '6mo' : '1y';
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
      console.warn('[PatrimonioRetornoChart] fetchBenchmarks error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [period, variableTickers]);

  useEffect(() => { fetchBenchmarks(); }, [fetchBenchmarks]);

  // Classify all assets with their purchase dates
  const portfolioAssets = useMemo(() => {
    const assets = [];
    const today = new Date();

    jars.forEach(jar => {
      const balance = parseFloat(jar.balance) || 0;
      if (balance <= 0) return;
      const pct = (parseFloat(jar.cdiPercent) || 100) / 100;
      const pDate = jar.createdAt ? new Date(jar.createdAt) : today;
      assets.push({ value: balance, type: 'cdi', cdiMultiplier: pct, purchaseDate: pDate });
    });

    investments.forEach(inv => {
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
          const fixedPart = parseFloat(String(inv.fixedRate || 0).replace(',', '.'));
          assets.push({ value: applied, type: 'fixed', annualRate: (4.5 + fixedPart) / 100, purchaseDate: pDate });
        } else {
          const fixedPart = parseFloat(String(inv.fixedRate || 0).replace(',', '.'));
          assets.push({ value: applied, type: 'fixed', annualRate: fixedPart / 100, purchaseDate: pDate });
        }
      } else {
        const cost = (inv.quantity || 1) * (inv.purchasePrice || 0);
        let currentPrice = inv.manualCurrentPrice || inv.purchasePrice || 0;
        const usdM = inv.isUSD ? usdRate : 1;
        const current = (inv.quantity || 1) * currentPrice * usdM;
        const totalCost = cost * usdM;
        if (totalCost <= 0) return;
        const returnPct = ((current - totalCost) / totalCost) * 100;

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
  }, [jars, investments, usdRate]);

  const totalPortfolioValue = useMemo(() => {
    return portfolioAssets.reduce((acc, a) => acc + a.value, 0);
  }, [portfolioAssets]);

  // Build chart data with date-aware portfolio calculation
  const chartData = useMemo(() => {
    const numPoints = benchmarkData.ibov?.length || benchmarkData.sp500?.length || Math.ceil(days / 7) + 1;
    const cdiPoints = buildCDILine(cdiAnual, days, numPoints);

    const today = new Date();
    const calendarDaysInPeriod = Math.round(days * 365 / 252);
    const periodStart = new Date(today);
    periodStart.setDate(today.getDate() - calendarDaysInPeriod);

    return Array.from({ length: numPoints }, (_, i) => {
      const entry = { idx: i };

      const pointDate = new Date(periodStart);
      pointDate.setDate(periodStart.getDate() + Math.round((calendarDaysInPeriod * i) / Math.max(numPoints - 1, 1)));

      const d = benchmarkData.ibov?.[i]?.date || benchmarkData.sp500?.[i]?.date;
      entry.date = d || pointDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      entry.cdi = parseFloat(cdiPoints[i]?.toFixed(3) ?? 0);

      if (totalPortfolioValue > 0) {
        let weightedReturn = 0;
        portfolioAssets.forEach(asset => {
          const weight = asset.value / totalPortfolioValue;
          if (asset.purchaseDate > pointDate) return;
          const effectiveStart = asset.purchaseDate > periodStart ? asset.purchaseDate : periodStart;
          const calDaysHeld = Math.max(0, (pointDate - effectiveStart) / (1000 * 60 * 60 * 24));
          const tradingDaysHeld = Math.round(calDaysHeld * 252 / 365);

          if (asset.type === 'cdi') {
            const dailyRate = Math.pow(1 + (cdiAnual / 100) * asset.cdiMultiplier, 1 / 252) - 1;
            weightedReturn += weight * ((Math.pow(1 + dailyRate, tradingDaysHeld) - 1) * 100);
          } else if (asset.type === 'fixed') {
            const dailyRate = Math.pow(1 + asset.annualRate, 1 / 252) - 1;
            weightedReturn += weight * ((Math.pow(1 + dailyRate, tradingDaysHeld) - 1) * 100);
          } else if (asset.type === 'variable') {
            const history = asset.yahooTicker ? benchmarkData.tickerHistory?.[asset.yahooTicker] : null;
            if (history && history.length > 0) {
              const histIdx = Math.min(Math.round((i / Math.max(numPoints - 1, 1)) * (history.length - 1)), history.length - 1);
              weightedReturn += weight * (history[histIdx]?.value ?? 0);
            } else {
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

      if (benchmarkData.ibov?.[i]) entry.ibov = benchmarkData.ibov[i].value;
      if (benchmarkData.sp500?.[i]) entry.sp500 = benchmarkData.sp500[i].value;

      return entry;
    });
  }, [benchmarkData, cdiAnual, days, portfolioAssets, totalPortfolioValue]);

  // Final returns
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
      cdi: last.cdi ?? 0,
      ibov: lastOf('ibov'),
      sp500: lastOf('sp500'),
    };
  }, [chartData]);

  const toggleBenchmark = (id) => {
    setActiveBenchmarks(prev =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter(b => b !== id) : prev) : [...prev, id]
    );
  };

  const lines = [
    { key: 'portfolio', name: 'Meu Portfólio', color: '#00E5A0', strokeWidth: 3.5, isPortfolio: true },
    { key: 'cdi',       name: 'CDI',            color: BENCHMARKS.cdi.color,   strokeWidth: 1.5, strokeDasharray: '6 3' },
    { key: 'ibov',      name: 'IBOVESPA',       color: BENCHMARKS.ibov.color,  strokeWidth: 1.5, strokeDasharray: '6 3' },
    { key: 'sp500',     name: 'S&P 500',        color: BENCHMARKS.sp500.color, strokeWidth: 1.5, strokeDasharray: '6 3' },
  ];

  const visibleLines = lines.filter(l => l.key === 'portfolio' || activeBenchmarks.includes(l.key));

  if (patrimonioTotal <= 0) return null;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── PERFORMANCE CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Meu Portfólio', value: finalReturns.portfolio, color: '#00E5A0',             always: true },
          { label: 'CDI',           value: finalReturns.cdi,       color: BENCHMARKS.cdi.color,   always: true },
          { label: 'IBOVESPA',      value: finalReturns.ibov,      color: BENCHMARKS.ibov.color,  always: false },
          { label: 'S&P 500',       value: finalReturns.sp500,     color: BENCHMARKS.sp500.color, always: false },
        ].map(item => {
          const hasData = item.value !== null && item.value !== undefined;
          const positive = item.value >= 0;
          return (
            <div key={item.label} className={`p-4 rounded-2xl border transition-all ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">{item.label}</p>
              {hasData ? (
                <>
                  <p className={`text-xl font-black ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
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
      <div className={`p-4 rounded-2xl border flex flex-wrap gap-4 items-center justify-between ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
        {/* Period selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <div className="flex gap-1">
            {PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
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
          <span className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Comparar:</span>
          {Object.entries(BENCHMARKS).map(([id, bm]) => (
            <button
              key={id}
              onClick={() => toggleBenchmark(id)}
              className={`px-2.5 py-1 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                activeBenchmarks.includes(id)
                  ? 'border-transparent text-white'
                  : isDark ? 'border-white/10 text-slate-500 hover:border-white/20' : 'border-slate-200 text-slate-400 hover:border-slate-300'
              }`}
              style={activeBenchmarks.includes(id) ? { background: bm.color + '33', borderColor: bm.color, color: bm.color } : {}}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: activeBenchmarks.includes(id) ? bm.color : 'currentColor' }} />
              {bm.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CHART ── */}
      <div className={`p-5 md:p-6 rounded-[2rem] border ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-[#5CCEEA]" />
            <h3 className={`font-black text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Retorno Acumulado (%)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-[9px] font-bold px-2.5 py-1 rounded-xl ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              <Info className="w-3 h-3" />
              Base 0%
            </div>
            <button
              onClick={fetchBenchmarks}
              disabled={isLoading}
              className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-[9px] font-black ${isDark ? 'bg-slate-800 border-white/5 hover:bg-white/10 text-slate-400' : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-500'}`}
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              {lastUpdated ? lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 rounded-full border-2 border-[#5CCEEA] border-t-transparent animate-spin" />
              <p className="text-xs font-bold text-slate-500">Buscando dados de mercado...</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
              <defs>
                <filter id="patRetornoGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="glow" />
                  <feMerge>
                    <feMergeNode in="glow" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="patRetornoGradient" x1="0" y1="0" x2="1" y2="0">
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
                tick={{ fontSize: 9, fill: isDark ? '#64748b' : '#94a3b8', fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 9, fill: isDark ? '#64748b' : '#94a3b8', fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                width={55}
              />
              <Tooltip content={<CustomTooltip isDark={isDark} />} />
              <Legend
                wrapperStyle={{ fontSize: '9px', fontWeight: 700, paddingTop: '12px' }}
                formatter={(value) => <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{value}</span>}
              />
              <ReferenceLine y={0} stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} strokeDasharray="4 4" />
              {/* Benchmark lines */}
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
              {/* Portfolio line */}
              {visibleLines.filter(l => l.isPortfolio).map(line => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.name}
                  stroke="url(#patRetornoGradient)"
                  strokeWidth={line.strokeWidth}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 3, stroke: '#00E5A0', fill: isDark ? '#0f172a' : '#ffffff' }}
                  connectNulls
                  filter="url(#patRetornoGlow)"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── BENCHMARK LEGEND CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(BENCHMARKS).map(([id, bm]) => (
          <div key={id} className={`p-4 rounded-2xl border flex items-center gap-3 ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bm.color + '20' }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: bm.color }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black" style={{ color: bm.color }}>{bm.label}</p>
              <p className={`text-[9px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{bm.description}</p>
            </div>
            {finalReturns[id] !== null && finalReturns[id] !== undefined ? (
              <p className={`text-xs font-black ${finalReturns[id] >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {fmtPct(finalReturns[id])}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {/* ── DISCLAIMER ── */}
      <div className={`flex items-start gap-3 p-4 rounded-2xl border ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
        <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
        <p className={`text-[9px] leading-relaxed font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          O retorno do portfólio é calculado com base no custo médio e valor atual dos seus ativos cadastrados.
          IBOVESPA e S&amp;P 500 são obtidos via Yahoo Finance (dados defasados em até 15 minutos).
          Rentabilidade passada não é garantia de retorno futuro.
        </p>
      </div>
    </div>
  );
}
