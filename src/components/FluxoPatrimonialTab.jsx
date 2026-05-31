import React, { useState, useMemo, useEffect } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Activity, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle,
  Wallet, Sparkles, Info, PiggyBank, Landmark, Building2, Coins, LineChart as LineChartIcon, Percent,
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useCdiRate, useUsdRate } from '../utils/marketRates';
import aliviaFinal from '../assets/alivia/alivia-final.png';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (v) => Math.abs(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtR = (v) => `${(Number(v) || 0) < 0 ? '-' : ''}R$ ${fmt(v)}`;
const pad = (n) => String(n).padStart(2, '0');
const keyLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const IPCA_ANUAL = 4.5; // estimativa de IPCA anualizado para o comparativo

const fmtAxis = (v) => {
  const n = Number(v) || 0; const abs = Math.abs(n); const sign = n < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}R$${(abs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  return `${sign}R$${Math.round(abs)}`;
};

function rangeFor(mode, anchor, custom) {
  const d = new Date(anchor);
  if (mode === 'mensal') return { start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 0) };
  if (mode === 'trimestral') { const q = Math.floor(d.getMonth() / 3); return { start: new Date(d.getFullYear(), q * 3, 1), end: new Date(d.getFullYear(), q * 3 + 3, 0) }; }
  if (mode === 'anual') return { start: new Date(d.getFullYear(), 0, 1), end: new Date(d.getFullYear(), 11, 31) };
  const s = custom.start ? new Date(custom.start + 'T00:00:00') : new Date(d.getFullYear(), d.getMonth(), 1);
  const e = custom.end ? new Date(custom.end + 'T00:00:00') : new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: s, end: e > s ? e : s };
}
function shiftAnchor(mode, anchor, dir, custom) {
  const d = new Date(anchor);
  if (mode === 'mensal') return new Date(d.getFullYear(), d.getMonth() + dir, 1);
  if (mode === 'trimestral') return new Date(d.getFullYear(), d.getMonth() + dir * 3, 1);
  if (mode === 'anual') return new Date(d.getFullYear() + dir, d.getMonth(), 1);
  const cur = rangeFor('custom', anchor, custom);
  const len = Math.round((cur.end - cur.start) / 86400000) + 1;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir * len);
}
function labelFor(mode, range) {
  const { start } = range;
  if (mode === 'mensal') return start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  if (mode === 'trimestral') return `${Math.floor(start.getMonth() / 3) + 1}º Trim · ${start.getFullYear()}`;
  if (mode === 'anual') return String(start.getFullYear());
  return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} – ${range.end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}`;
}

const CLASS_META = {
  acoes: { label: 'Ações', icon: TrendingUp, color: '#a855f7' },
  fiis: { label: 'Fundos Imobiliários', icon: Building2, color: '#14b8a6' },
  renda_fixa: { label: 'Tesouro / Renda Fixa', icon: Landmark, color: '#6366f1' },
  etfs: { label: 'ETFs / Fundos', icon: LineChartIcon, color: '#3b82f6' },
  crypto: { label: 'Criptomoedas', icon: Coins, color: '#f59e0b' },
  imoveis: { label: 'Imóveis', icon: Building2, color: '#f97316' },
  outros: { label: 'Outros', icon: Wallet, color: '#64748b' },
};

const PERIOD_MODES = [['mensal', 'Mensal'], ['trimestral', 'Trimestral'], ['anual', 'Anual'], ['custom', 'Personalizado']];

export default function FluxoPatrimonialTab() {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const isDark = theme !== 'light';
  const cdiAnual = useCdiRate();
  const usdRate = useUsdRate();

  const [jars, setJars] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [patrimonioTx, setPatrimonioTx] = useState([]);

  const [mode, setMode] = useState('mensal');
  const [anchor, setAnchor] = useState(() => new Date());
  const [custom, setCustom] = useState({ start: '', end: '' });
  const [chartGran, setChartGran] = useState('mensal'); // diario | mensal | acumulado
  const [openIn, setOpenIn] = useState(null);
  const [openOut, setOpenOut] = useState(null);

  // ── listeners (somente dados do módulo Patrimônio) ──
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'savings_jars'), where('userId', '==', currentUser.uid));
    return onSnapshot(q, snap => setJars(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'investments'), where('userId', '==', currentUser.uid));
    return onSnapshot(q, snap => setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'transactions'), where('userId', '==', currentUser.uid));
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // só reservas do módulo Patrimônio
      const isPat = (t) => t.source === 'patrimonio' || /^(Criação de Reserva|Aporte Reserva|Resgate\/Ajuste Reserva):/.test(t.description || '');
      setPatrimonioTx(all.filter(isPat));
    });
  }, [currentUser]);

  const range = useMemo(() => rangeFor(mode, anchor, custom), [mode, anchor, custom]);
  const prevRange = useMemo(() => {
    const a = shiftAnchor(mode, anchor, -1, custom);
    return rangeFor(mode, a, custom);
  }, [mode, anchor, custom]);
  const rangeLabel = useMemo(() => labelFor(mode, range), [mode, range]);

  // ── valor atual dos investimentos (mark-to-market) + custo, por classe ──
  const assetValues = useMemo(() => {
    return investments.map(inv => {
      const usdM = inv.isUSD ? (usdRate || 5) : 1;
      let cost, current;
      if (inv.type === 'renda_fixa') {
        cost = inv.totalApplied || (inv.quantity * inv.purchasePrice) || 0;
        current = inv.manualCurrentPrice || cost;
      } else {
        cost = (inv.quantity || 0) * (inv.purchasePrice || 0) * usdM;
        const price = inv.manualCurrentPrice || inv.purchasePrice || 0;
        current = (inv.quantity || 0) * price * usdM;
      }
      const cls = CLASS_META[inv.type] ? inv.type : 'outros';
      const date = inv.purchaseDate || (inv.createdAt ? String(inv.createdAt).slice(0, 10) : keyLocal(new Date()));
      return { inv, cls, cost, current, unrealized: current - cost, date, name: inv.name || inv.symbol || 'Ativo' };
    });
  }, [investments, usdRate]);

  const investmentsCurrent = assetValues.reduce((a, x) => a + x.current, 0);
  const jarsTotal = useMemo(() => jars.reduce((a, j) => a + (parseFloat(j.balance) || 0), 0), [jars]);
  const patrimonioAtual = investmentsCurrent + jarsTotal;

  // rendimento estimado (a.a. → no período) da renda fixa + reservas
  const dailyYield = useMemo(() => {
    const jarsY = jars.reduce((a, j) => {
      const cdiP = (j.cdiPercent || 100) / 100;
      const r = Math.pow(1 + (cdiAnual / 100) * cdiP, 1 / 365) - 1;
      return a + (parseFloat(j.balance) || 0) * r;
    }, 0);
    const fixedY = assetValues.reduce((a, x) => {
      if (x.inv.type !== 'renda_fixa') return a;
      let r = 0; const cdiP = parseFloat(String(x.inv.cdiPercent || 100).replace(',', '.'));
      r = Math.pow(1 + (cdiAnual / 100) * (cdiP / 100), 1 / 365) - 1;
      return a + x.current * r;
    }, 0);
    return jarsY + fixedY;
  }, [jars, assetValues, cdiAnual]);

  // ── eventos de fluxo realizado (entradas/saídas) ──
  const flowEvents = useMemo(() => {
    const ev = [];
    assetValues.forEach(x => ev.push({ date: x.date, dir: 'in', cat: 'aporte', label: `Aporte: ${x.name}`, amount: x.cost }));
    patrimonioTx.forEach(t => {
      const date = (t.date || '').slice(0, 10) || (t.month ? `${t.month}-01` : '');
      const amount = parseFloat(t.amount) || 0;
      if (t.type === 'income' || /Resgate/.test(t.description || '')) ev.push({ date, dir: 'out', cat: 'resgate', label: t.description || 'Resgate', amount });
      else ev.push({ date, dir: 'in', cat: 'aporte', label: t.description || 'Aporte reserva', amount });
    });
    return ev;
  }, [assetValues, patrimonioTx]);

  const inRange = (dateStr, r) => { const td = (dateStr || '').slice(0, 10); return td && td >= keyLocal(r.start) && td <= keyLocal(r.end); };

  // rendimento do período (estimado) tratado como entrada de origem "rendimento"
  const periodDays = Math.max(1, Math.round((range.end - range.start) / 86400000) + 1);
  const prevDays = Math.max(1, Math.round((prevRange.end - prevRange.start) / 86400000) + 1);
  const rendimentoPeriodo = dailyYield * periodDays;
  const rendimentoPrev = dailyYield * prevDays;

  const periodFlows = useMemo(() => flowEvents.filter(e => inRange(e.date, range)), [flowEvents, range]);
  const prevFlows = useMemo(() => flowEvents.filter(e => inRange(e.date, prevRange)), [flowEvents, prevRange]);

  const sumDir = (arr, dir) => arr.filter(e => e.dir === dir).reduce((a, e) => a + e.amount, 0);
  const entradas = sumDir(periodFlows, 'in') + rendimentoPeriodo;
  const saidas = sumDir(periodFlows, 'out');
  const variacaoLiquida = entradas - saidas;
  const entradasPrev = sumDir(prevFlows, 'in') + rendimentoPrev;
  const saidasPrev = sumDir(prevFlows, 'out');
  const variacaoLiquidaPrev = entradasPrev - saidasPrev;

  const pct = (cur, prev) => (prev && Math.abs(prev) > 0.005 ? ((cur - prev) / Math.abs(prev)) * 100 : null);

  // ── breakdown entradas / saídas ──
  const ENTRADA_CATS = [
    { id: 'aporte', label: 'Aportes', color: '#10b981' },
    { id: 'rendimento', label: 'Rendimentos', color: '#22c55e' },
    { id: 'dividendos', label: 'Dividendos / JCP', color: '#14b8a6' },
    { id: 'alugueis', label: 'Aluguéis', color: '#0ea5e9' },
    { id: 'ganho_capital', label: 'Ganho de capital realizado', color: '#84cc16' },
  ];
  const SAIDA_CATS = [
    { id: 'resgate', label: 'Resgates', color: '#f43f5e' },
    { id: 'ir', label: 'Imposto de Renda', color: '#ef4444' },
    { id: 'come_cotas', label: 'Come-cotas', color: '#fb7185' },
    { id: 'taxas', label: 'Taxas', color: '#f97316' },
  ];
  const entradaBreak = ENTRADA_CATS.map(c => {
    const items = periodFlows.filter(e => e.dir === 'in' && e.cat === c.id);
    let value = items.reduce((a, e) => a + e.amount, 0);
    if (c.id === 'rendimento') value = rendimentoPeriodo;
    return { ...c, value, items: c.id === 'rendimento' ? [{ label: 'Rendimento estimado (reservas + renda fixa)', amount: rendimentoPeriodo, date: keyLocal(range.end) }] : items };
  });
  const saidaBreak = SAIDA_CATS.map(c => {
    const items = periodFlows.filter(e => e.dir === 'out' && e.cat === c.id);
    return { ...c, value: items.reduce((a, e) => a + e.amount, 0), items };
  });

  // ── série do gráfico ──
  const series = useMemo(() => {
    const daily = chartGran === 'diario' && periodDays <= 62;
    const buckets = [];
    if (daily) {
      const cur = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
      while (cur <= range.end) { buckets.push({ key: keyLocal(cur), label: pad(cur.getDate()), entradas: 0, saidas: 0 }); cur.setDate(cur.getDate() + 1); }
    } else {
      let cur = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
      while (cur <= range.end) { buckets.push({ key: `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}`, label: cur.toLocaleDateString('pt-BR', { month: 'short' }), entradas: 0, saidas: 0 }); cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); }
    }
    const idx = {}; buckets.forEach((b, i) => { idx[b.key] = i; });
    const keyOf = (d) => daily ? d.slice(0, 10) : d.slice(0, 7);
    periodFlows.forEach(e => { const i = idx[keyOf(e.date)]; if (i != null) { if (e.dir === 'in') buckets[i].entradas += e.amount; else buckets[i].saidas += e.amount; } });
    // rendimento distribuído igualmente entre os baldes
    if (buckets.length) { const per = rendimentoPeriodo / buckets.length; buckets.forEach(b => { b.entradas += per; }); }
    // patrimônio acumulado (linha) — base = patrimônio atual menos fluxo líquido do período, somando ao longo do tempo
    const baseStart = patrimonioAtual - (entradas - saidas);
    let acc = baseStart;
    buckets.forEach(b => { acc += b.entradas - b.saidas; b.patrimonio = acc; });
    if (chartGran === 'acumulado') {
      let ae = 0, as = 0;
      buckets.forEach(b => { ae += b.entradas; as += b.saidas; b.entradas = ae; b.saidas = as; });
    }
    return buckets;
  }, [periodFlows, range, chartGran, rendimentoPeriodo, patrimonioAtual, entradas, saidas, periodDays]);

  // ── variação não realizada por classe ──
  const unrealizedByClass = useMemo(() => {
    const map = {};
    assetValues.forEach(x => {
      if (!map[x.cls]) map[x.cls] = { cls: x.cls, current: 0, cost: 0 };
      map[x.cls].current += x.current; map[x.cls].cost += x.cost;
    });
    return Object.values(map).map(m => ({
      ...m, ...CLASS_META[m.cls], unrealized: m.current - m.cost,
      pctTotal: m.cost > 0 ? ((m.current - m.cost) / m.cost) * 100 : 0,
    })).sort((a, b) => b.current - a.current);
  }, [assetValues]);
  const totalUnrealized = unrealizedByClass.reduce((a, m) => a + m.unrealized, 0);

  // ── comparativo vs inflação ──
  const rendPct = patrimonioAtual > 0 ? (rendimentoPeriodo / patrimonioAtual) * 100 : 0;
  const ipcaPeriodo = (Math.pow(1 + IPCA_ANUAL / 100, periodDays / 365) - 1) * 100;
  const realPct = rendPct - ipcaPeriodo;

  // ── insight automático ──
  const insight = useMemo(() => {
    const sources = [
      { label: 'aportes', value: entradaBreak.find(c => c.id === 'aporte')?.value || 0 },
      { label: 'rendimentos', value: rendimentoPeriodo },
      { label: 'dividendos/JCP', value: entradaBreak.find(c => c.id === 'dividendos')?.value || 0 },
      { label: 'aluguéis', value: entradaBreak.find(c => c.id === 'alugueis')?.value || 0 },
    ].filter(s => s.value > 0.005).sort((a, b) => b.value - a.value);
    const totalIn = sources.reduce((a, s) => a + s.value, 0);
    if (totalIn <= 0.005) return { text: 'Sem entradas registradas neste período. Lance aportes ou cadastre ativos no módulo de Patrimônio.' };
    const parts = sources.map(s => `${s.label} (${((s.value / totalIn) * 100).toFixed(0)}%)`);
    return { text: `O crescimento do patrimônio no período veio principalmente de ${parts.join(', ')}.`, top: sources[0] };
  }, [entradaBreak, rendimentoPeriodo]);

  // ── estilos ──
  const card = isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';
  const txt = isDark ? 'text-white' : 'text-slate-800';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';
  const inset = isDark ? 'bg-[#161b27] border-white/10' : 'bg-slate-50 border-slate-200';

  const goPrev = () => setAnchor(a => shiftAnchor(mode, a, -1, custom));
  const goNext = () => setAnchor(a => shiftAnchor(mode, a, +1, custom));

  return (
    <div className="max-w-full px-5 md:px-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Título + período */}
      <div className="flex items-center justify-between pt-8 pb-1 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}><Activity className="w-6 h-6 text-emerald-500" /></div>
          <h2 className={`text-xl font-medium tracking-wide uppercase ${txt}`}>Fluxo Patrimonial</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center justify-between rounded-xl border ${inset}`}>
            <button onClick={goPrev} className="p-2 text-slate-400 hover:text-emerald-400"><ChevronLeft className="w-4 h-4" /></button>
            <span className={`text-[11px] font-bold uppercase capitalize px-2 min-w-[110px] text-center ${txt}`}>{rangeLabel}</span>
            <button onClick={goNext} className="p-2 text-slate-400 hover:text-emerald-400"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className={`flex rounded-xl p-0.5 ${inset}`}>
            {PERIOD_MODES.map(([id, lbl]) => (
              <button key={id} onClick={() => setMode(id)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${mode === id ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>
      {mode === 'custom' && (
        <div className="flex gap-2">
          <input type="date" value={custom.start} onChange={e => setCustom(c => ({ ...c, start: e.target.value }))} className={`px-3 py-2 rounded-lg border text-[11px] ${inset} ${txt}`} />
          <input type="date" value={custom.end} onChange={e => setCustom(c => ({ ...c, end: e.target.value }))} className={`px-3 py-2 rounded-lg border text-[11px] ${inset} ${txt}`} />
        </div>
      )}

      {/* 4 cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <SummaryCard isDark={isDark} icon={ArrowDownCircle} color="text-emerald-500" label="Entradas totais" value={fmtR(entradas)} delta={pct(entradas, entradasPrev)} />
        <SummaryCard isDark={isDark} icon={ArrowUpCircle} color="text-rose-500" label="Saídas totais" value={fmtR(saidas)} delta={pct(saidas, saidasPrev)} invert />
        <SummaryCard isDark={isDark} icon={Activity} color={variacaoLiquida >= 0 ? 'text-emerald-500' : 'text-rose-500'} label="Variação líquida" value={fmtR(variacaoLiquida)} delta={pct(variacaoLiquida, variacaoLiquidaPrev)} />
        <SummaryCard isDark={isDark} icon={Wallet} color="text-blue-500" label="Patrimônio atual" value={fmtR(patrimonioAtual)} delta={pct(patrimonioAtual, patrimonioAtual - variacaoLiquida)} />
      </div>

      {/* Insight banner */}
      <div className={`flex items-start gap-3 p-4 rounded-2xl border ${isDark ? 'bg-emerald-500/[0.06] border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
        <Sparkles className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">De onde veio o crescimento</span>
          <p className={`text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{insight.text}</p>
        </div>
      </div>

      {/* Gráfico principal */}
      <div className={`p-5 rounded-2xl border ${card}`}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h4 className={`text-sm font-bold uppercase tracking-wider ${txt}`}>Entradas, saídas e patrimônio acumulado</h4>
          <div className={`flex rounded-lg p-0.5 ${inset}`}>
            {[['diario', 'Diário'], ['mensal', 'Mensal'], ['acumulado', 'Acumulado']].map(([id, lbl]) => (
              <button key={id} onClick={() => setChartGran(id)}
                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all ${chartGran === id ? 'bg-blue-500 text-white' : 'text-slate-400'}`}>{lbl}</button>
            ))}
          </div>
        </div>
        <div className="w-full h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#ffffff0d' : '#0000000d'} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: isDark ? '#64748b' : '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
              <YAxis yAxisId="left" tickFormatter={fmtAxis} tick={{ fontSize: 9, fill: isDark ? '#64748b' : '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={fmtAxis} tick={{ fontSize: 9, fill: '#3b82f6' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<FlowTooltip isDark={isDark} />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar yAxisId="left" name="Entradas" dataKey="entradas" stackId="a" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={26} />
              <Bar yAxisId="left" name="Saídas" dataKey="saidas" stackId="a" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={26} />
              <Line yAxisId="right" name="Patrimônio acumulado" type="monotone" dataKey="patrimonio" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 2.5, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Breakdown entradas / saídas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <BreakdownBlock isDark={isDark} card={card} txt={txt} sub={sub} title="Entradas por origem" total={entradas} data={entradaBreak} open={openIn} setOpen={setOpenIn} />
        <BreakdownBlock isDark={isDark} card={card} txt={txt} sub={sub} title="Saídas por tipo" total={saidas} data={saidaBreak} open={openOut} setOpen={setOpenOut} />
      </div>

      {/* Variação não realizada */}
      <div className={`p-5 rounded-2xl border ${isDark ? 'bg-indigo-500/[0.04] border-indigo-500/20' : 'bg-indigo-50/40 border-indigo-200'}`}>
        <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
          <div className="flex items-center gap-2">
            <h4 className={`text-sm font-bold uppercase tracking-wider ${txt}`}>Variação não realizada</h4>
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400">No papel</span>
          </div>
          <div className="text-right">
            <p className={`text-lg font-black ${totalUnrealized >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{fmtR(totalUnrealized)}</p>
            <p className={`text-[10px] ${sub}`}>total não realizado</p>
          </div>
        </div>
        <p className={`text-[11px] mb-4 leading-relaxed ${sub}`}>
          É o lucro ou prejuízo que existe “no papel” — a diferença entre o preço atual dos seus ativos e o preço que você pagou. Só vira dinheiro de verdade quando você vende. Não se mistura com as entradas e saídas realizadas acima.
        </p>
        {unrealizedByClass.length === 0 ? (
          <p className={`text-[11px] ${sub}`}>Nenhum investimento cadastrado.</p>
        ) : (
          <div className="space-y-2.5">
            {unrealizedByClass.map(m => {
              const Icon = m.icon || Wallet;
              return (
                <div key={m.cls} className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-white/[0.03]' : 'bg-white'}`}>
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${m.color}1f` }}><Icon className="w-4 h-4" style={{ color: m.color }} /></span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${txt}`}>{m.label}</p>
                    <p className={`text-[10px] ${sub}`}>Atual {fmtR(m.current)} · Custo {fmtR(m.cost)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-black ${m.unrealized >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{m.unrealized >= 0 ? '+' : '-'}R$ {fmt(m.unrealized)}</p>
                    <p className={`text-[10px] font-bold ${m.pctTotal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{m.pctTotal >= 0 ? '+' : ''}{m.pctTotal.toFixed(1)}% desde a compra</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Comparativo vs inflação */}
      <div className={`p-5 rounded-2xl border ${card}`}>
        <div className="flex items-center gap-2 mb-4">
          <Percent className="w-4 h-4 text-amber-500" />
          <h4 className={`text-sm font-bold uppercase tracking-wider ${txt}`}>Comparativo vs inflação</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`p-4 rounded-xl ${inset}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${sub}`}>Rendimento do patrimônio</p>
            <p className={`text-xl font-black ${rendPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{rendPct >= 0 ? '+' : ''}{rendPct.toFixed(2)}%</p>
            <p className={`text-[10px] ${sub}`}>estimado no período</p>
          </div>
          <div className={`p-4 rounded-xl ${inset}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${sub}`}>IPCA do período</p>
            <p className="text-xl font-black text-amber-500">{ipcaPeriodo.toFixed(2)}%</p>
            <p className={`text-[10px] ${sub}`}>≈ {IPCA_ANUAL}% a.a.</p>
          </div>
          <div className={`p-4 rounded-xl ${realPct >= 0 ? (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50') : (isDark ? 'bg-rose-500/10' : 'bg-rose-50')}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${sub}`}>Resultado real</p>
            <p className={`text-xl font-black ${realPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{realPct >= 0 ? '+' : ''}{realPct.toFixed(2)}%</p>
            <p className={`text-[10px] ${sub}`}>{realPct >= 0 ? 'acima da inflação' : 'abaixo da inflação'}</p>
          </div>
        </div>
      </div>

      {/* Alívia */}
      <div className={`flex items-start gap-3 p-4 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
        <img src={aliviaFinal} alt="Alívia" className="w-10 h-10 object-cover rounded-full border-2 border-white/20 shadow-md shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Alívia · análise do fluxo</span>
          <p className={`text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            <span className="font-bold">Principal fonte de crescimento:</span> {insight.top ? `${insight.top.label} (${fmtR(insight.top.value)} no período).` : 'ainda sem entradas no período.'}
          </p>
          <p className={`text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            <span className="font-bold text-amber-500">Atenção:</span> {realPct < 0
              ? `seu rendimento estimado (${rendPct.toFixed(1)}%) está abaixo da inflação do período (${ipcaPeriodo.toFixed(1)}%).`
              : totalUnrealized < 0
                ? `você tem ${fmtR(totalUnrealized)} de prejuízo não realizado — é no papel, só se concretiza na venda.`
                : `mantenha a consistência dos aportes para acelerar o crescimento.`}
          </p>
          <p className={`text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            <span className="font-bold text-blue-500">Ação sugerida:</span> {saidas > entradas
              ? 'as saídas superaram as entradas — reveja resgates antes de comprometer o patrimônio.'
              : entradaBreak.find(c => c.id === 'aporte')?.value > 0
                ? 'continue aportando com regularidade e considere diversificar em novas classes de ativo.'
                : 'registre um aporte para começar a construir consistência no período.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function FlowTooltip({ active, payload, label, isDark }) {
  if (!active || !payload?.length) return null;
  const get = (k) => payload.find(p => p.dataKey === k)?.value || 0;
  return (
    <div className={`px-3 py-2 rounded-xl border shadow-xl text-xs ${isDark ? 'bg-[#0f172a] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
      <p className="font-black mb-1">{label}</p>
      <p className="text-emerald-400 font-bold">Entradas: R$ {fmt(get('entradas'))}</p>
      <p className="text-rose-400 font-bold">Saídas: R$ {fmt(get('saidas'))}</p>
      <p className="text-blue-400 font-bold">Patrimônio: R$ {fmt(get('patrimonio'))}</p>
    </div>
  );
}

function SummaryCard({ isDark, icon, color, label, value, delta, invert }) {
  const card = isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';
  let deltaEl = <span className="text-[10px] text-slate-400 font-medium">—</span>;
  if (delta != null && isFinite(delta) && Math.abs(delta) >= 0.5) {
    const up = delta > 0; const good = invert ? !up : up;
    deltaEl = <span className={`text-[10px] font-bold ${good ? 'text-emerald-500' : 'text-rose-500'}`}>{up ? '↑' : '↓'} {Math.abs(delta).toFixed(0)}% <span className="text-slate-400 font-medium">vs anterior</span></span>;
  }
  return (
    <div className={`p-4 rounded-2xl border ${card}`}>
      <div className="flex items-center gap-2 mb-1.5">{React.createElement(icon, { className: `w-4 h-4 ${color}` })}<span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">{label}</span></div>
      <p className={`text-lg font-black tabular-nums truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{value}</p>
      {deltaEl}
    </div>
  );
}

function BreakdownBlock({ isDark, card, txt, sub, title, total, data, open, setOpen }) {
  return (
    <div className={`p-5 rounded-2xl border ${card}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className={`text-sm font-bold uppercase tracking-wider ${txt}`}>{title}</h4>
        <span className={`text-[10px] font-bold ${sub}`}>R$ {fmt(total)} total</span>
      </div>
      <div className="space-y-2">
        {data.map(c => {
          const pct = total > 0 ? (c.value / total) * 100 : 0;
          const isOpen = open === c.id;
          return (
            <div key={c.id}>
              <button onClick={() => setOpen(isOpen ? null : c.id)} disabled={c.value <= 0.005}
                className={`w-full text-left ${c.value > 0.005 ? 'cursor-pointer' : 'cursor-default opacity-60'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-2 text-xs font-bold"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} /><span className={txt}>{c.label}</span></span>
                  <span className={`text-xs font-bold ${txt}`}>R$ {fmt(c.value)} <span className="text-slate-400 font-medium">({pct.toFixed(0)}%)</span></span>
                </div>
                <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: c.color }} />
                </div>
              </button>
              {isOpen && c.items?.length > 0 && (
                <div className={`mt-2 mb-1 ml-4 pl-3 border-l space-y-1 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                  {c.items.map((it, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className={`truncate ${sub}`}>{it.label}{it.date ? ` · ${new Date(it.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` : ''}</span>
                      <span className={`font-bold tabular-nums ${txt}`}>R$ {fmt(it.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
