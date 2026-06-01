import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Activity, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle,
  Wallet, PiggyBank, Landmark, Building2, Coins, LineChart as LineChartIcon, Info, Scale,
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useCdiRate, useUsdRate } from '../utils/marketRates';
import aliviaFinal from '../assets/alivia/alivia-final.png';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (v) => Math.abs(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtSign = (v) => `${(Number(v) || 0) >= 0 ? '+' : '-'}R$ ${fmt(v)}`;
const pad = (n) => String(n).padStart(2, '0');
const keyLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const num = (v) => parseFloat(v) || 0;

const fmtAxis = (v) => {
  const n = Number(v) || 0; const abs = Math.abs(n); const sign = n < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}R$${(abs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  return `${sign}R$${Math.round(abs)}`;
};

function rangeFor(mode, anchor) {
  const d = new Date(anchor);
  if (mode === 'mensal') return { start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 0) };
  if (mode === 'trimestral') { const q = Math.floor(d.getMonth() / 3); return { start: new Date(d.getFullYear(), q * 3, 1), end: new Date(d.getFullYear(), q * 3 + 3, 0) }; }
  return { start: new Date(d.getFullYear(), 0, 1), end: new Date(d.getFullYear(), 11, 31) }; // anual
}
function shiftAnchor(mode, anchor, dir) {
  const d = new Date(anchor);
  if (mode === 'mensal') return new Date(d.getFullYear(), d.getMonth() + dir, 1);
  if (mode === 'trimestral') return new Date(d.getFullYear(), d.getMonth() + dir * 3, 1);
  return new Date(d.getFullYear() + dir, d.getMonth(), 1);
}
function labelFor(mode, range) {
  const { start } = range;
  if (mode === 'mensal') return start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  if (mode === 'trimestral') return `${Math.floor(start.getMonth() / 3) + 1}º Trimestre · ${start.getFullYear()}`;
  return String(start.getFullYear());
}

const CLASS_META = {
  reserva: { label: 'Reserva de emergência', icon: PiggyBank, color: '#10b981' },
  acoes: { label: 'Ações', icon: TrendingUp, color: '#a855f7' },
  fiis: { label: 'Fundos Imobiliários', icon: Building2, color: '#14b8a6' },
  renda_fixa: { label: 'Tesouro / Renda Fixa', icon: Landmark, color: '#6366f1' },
  etfs: { label: 'ETFs / Fundos', icon: LineChartIcon, color: '#3b82f6' },
  crypto: { label: 'Criptomoedas', icon: Coins, color: '#f59e0b' },
  imoveis: { label: 'Imóveis', icon: Building2, color: '#f97316' },
  outros: { label: 'Outros', icon: Wallet, color: '#64748b' },
};

const PERIOD_MODES = [['mensal', 'Mensal'], ['trimestral', 'Trimestral'], ['anual', 'Anual']];

export default function FluxoPatrimonialTab() {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const isDark = theme !== 'light';
  const cdiAnual = useCdiRate();
  const usdRate = useUsdRate();

  const [jars, setJars] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [patrimonioTx, setPatrimonioTx] = useState([]);
  const [mode, setMode] = useState('anual');
  const [anchor, setAnchor] = useState(() => new Date());

  // ── listeners (só dados do módulo Patrimônio) ──
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
      const isPat = (t) => t.source === 'patrimonio' || /^(Criação de Reserva|Aporte Reserva|Resgate\/Ajuste Reserva):/.test(t.description || '');
      setPatrimonioTx(all.filter(isPat));
    });
  }, [currentUser]);

  const range = useMemo(() => rangeFor(mode, anchor), [mode, anchor]);
  const prevRange = useMemo(() => rangeFor(mode, shiftAnchor(mode, anchor, -1)), [mode, anchor]);
  const rangeLabel = useMemo(() => labelFor(mode, range), [mode, range]);
  const inRange = (dateStr, r) => { const td = (dateStr || '').slice(0, 10); return td && td >= keyLocal(r.start) && td <= keyLocal(r.end); };

  // ── valor atual e custo dos investimentos (por classe) ──
  const assets = useMemo(() => investments.map(inv => {
    const usdM = inv.isUSD ? (usdRate || 5) : 1;
    let cost, current;
    if (inv.type === 'renda_fixa') {
      cost = inv.totalApplied || (inv.quantity * inv.purchasePrice) || 0;
      current = inv.manualCurrentPrice || cost;
    } else {
      cost = num(inv.quantity) * num(inv.purchasePrice) * usdM;
      current = num(inv.quantity) * (num(inv.manualCurrentPrice) || num(inv.purchasePrice)) * usdM;
    }
    const cls = CLASS_META[inv.type] ? inv.type : 'outros';
    const date = (inv.purchaseDate || (inv.createdAt ? String(inv.createdAt).slice(0, 10) : keyLocal(new Date()))).slice(0, 10);
    return { cls, cost, current, date, name: inv.name || inv.symbol || 'Ativo' };
  }), [investments, usdRate]);

  const investCurrent = assets.reduce((a, x) => a + x.current, 0);
  const investCost = assets.reduce((a, x) => a + x.cost, 0);
  const lucroInvest = investCurrent - investCost;

  const jarsTotal = useMemo(() => jars.reduce((a, j) => a + num(j.balance), 0), [jars]);
  const reserveApplied = useMemo(() => jars.reduce((a, j) => a + (j.appliedValue != null ? num(j.appliedValue) : 0), 0), [jars]);
  const reserveProfit = useMemo(() => jars.reduce((a, j) => (j.appliedValue != null && num(j.appliedValue) > 0 ? a + (num(j.balance) - num(j.appliedValue)) : a), 0), [jars]);

  const patrimonioAtual = investCurrent + jarsTotal;
  const lucroTotal = lucroInvest + reserveProfit;
  const lucroBase = investCost + (reserveApplied > 0 ? reserveApplied : 0);
  const lucroPct = lucroBase > 0 ? (lucroTotal / lucroBase) * 100 : 0;

  // ── movimentações realizadas (aportes/resgates) ──
  // Aporte = dinheiro que VOCÊ colocou (compra de investimento ou aporte na reserva).
  // Resgate = dinheiro que VOCÊ tirou da reserva.
  const flowEvents = useMemo(() => {
    const ev = [];
    assets.forEach(x => ev.push({ date: x.date, dir: 'aporte', label: `Compra: ${x.name}`, amount: x.cost }));
    patrimonioTx.forEach(t => {
      const date = (t.date || '').slice(0, 10) || (t.month ? `${t.month}-01` : '');
      const amount = num(t.amount);
      if (t.type === 'income' || /Resgate/.test(t.description || '')) ev.push({ date, dir: 'resgate', label: t.description || 'Resgate da reserva', amount });
      else ev.push({ date, dir: 'aporte', label: t.description || 'Aporte na reserva', amount });
    });
    return ev;
  }, [assets, patrimonioTx]);

  const periodFlows = useMemo(() => flowEvents.filter(e => inRange(e.date, range)), [flowEvents, range]);
  const prevFlows = useMemo(() => flowEvents.filter(e => inRange(e.date, prevRange)), [flowEvents, prevRange]);
  const sumDir = (arr, dir) => arr.filter(e => e.dir === dir).reduce((a, e) => a + e.amount, 0);

  const aportes = sumDir(periodFlows, 'aporte');
  const resgates = sumDir(periodFlows, 'resgate');
  const aporteLiquido = aportes - resgates;
  const aportesPrev = sumDir(prevFlows, 'aporte');
  const resgatesPrev = sumDir(prevFlows, 'resgate');
  const pct = (cur, prev) => (prev && Math.abs(prev) > 0.005 ? ((cur - prev) / Math.abs(prev)) * 100 : null);

  // ── gráfico: aportes x resgates por mês no período ──
  const series = useMemo(() => {
    const buckets = [];
    let cur = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
    while (cur <= range.end) { buckets.push({ key: `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}`, label: cur.toLocaleDateString('pt-BR', { month: 'short' }), Aportes: 0, Resgates: 0 }); cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); }
    const idx = {}; buckets.forEach((b, i) => { idx[b.key] = i; });
    periodFlows.forEach(e => { const i = idx[(e.date || '').slice(0, 7)]; if (i != null) { if (e.dir === 'aporte') buckets[i].Aportes += e.amount; else buckets[i].Resgates += e.amount; } });
    return buckets;
  }, [periodFlows, range]);

  // ── seus ativos por tipo (onde está + quanto rendeu) ──
  const byClass = useMemo(() => {
    const map = {};
    assets.forEach(x => { if (!map[x.cls]) map[x.cls] = { cls: x.cls, current: 0, cost: 0 }; map[x.cls].current += x.current; map[x.cls].cost += x.cost; });
    const rows = Object.values(map).map(m => ({ ...m, ...CLASS_META[m.cls], lucro: m.current - m.cost }));
    if (jarsTotal > 0) rows.push({ cls: 'reserva', ...CLASS_META.reserva, current: jarsTotal, cost: reserveApplied > 0 ? reserveApplied : jarsTotal, lucro: reserveProfit });
    return rows.sort((a, b) => b.current - a.current);
  }, [assets, jarsTotal, reserveApplied, reserveProfit]);

  // rendimento estimado/mês das reservas + renda fixa (informativo)
  const yieldMonth = useMemo(() => {
    const jarsY = jars.reduce((a, j) => a + num(j.balance) * (Math.pow(1 + (cdiAnual / 100) * ((j.cdiPercent || 100) / 100), 30 / 365) - 1), 0);
    const fixedY = assets.reduce((a, x) => x.cls === 'renda_fixa' ? a + x.current * (Math.pow(1 + (cdiAnual / 100), 30 / 365) - 1) : a, 0);
    return jarsY + fixedY;
  }, [jars, assets, cdiAnual]);

  // ── estilos ──
  const card = isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';
  const txt = isDark ? 'text-white' : 'text-slate-800';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';
  const inset = isDark ? 'bg-[#161b27] border-white/10' : 'bg-slate-50 border-slate-200';

  const hasData = patrimonioAtual > 0 || periodFlows.length > 0;

  return (
    <div className="max-w-full px-5 md:px-8 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Título + período */}
      <div className="flex items-center justify-between pt-8 pb-1 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}><Activity className="w-6 h-6 text-emerald-500" /></div>
          <div>
            <h2 className={`text-xl font-medium tracking-wide uppercase ${txt}`}>Fluxo Patrimonial</h2>
            <p className={`text-[11px] ${sub}`}>Como seu patrimônio se movimentou: o que você guardou, tirou e quanto rendeu.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center justify-between rounded-xl border ${inset}`}>
            <button onClick={() => setAnchor(a => shiftAnchor(mode, a, -1))} className="p-2 text-slate-400 hover:text-emerald-400"><ChevronLeft className="w-4 h-4" /></button>
            <span className={`text-[11px] font-bold uppercase capitalize px-2 min-w-[120px] text-center ${txt}`}>{rangeLabel}</span>
            <button onClick={() => setAnchor(a => shiftAnchor(mode, a, +1))} className="p-2 text-slate-400 hover:text-emerald-400"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className={`flex rounded-xl p-0.5 ${inset}`}>
            {PERIOD_MODES.map(([id, lbl]) => (
              <button key={id} onClick={() => setMode(id)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${mode === id ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className={`p-12 rounded-2xl border text-center ${card}`}>
          <Wallet className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className={`font-bold ${txt}`}>Você ainda não tem patrimônio cadastrado</p>
          <p className={`text-sm ${sub}`}>Cadastre reservas e investimentos no módulo de Patrimônio para acompanhar seu fluxo.</p>
        </div>
      ) : (
        <>
          {/* HERO: Patrimônio total */}
          <div className={`p-5 md:p-6 rounded-2xl border ${card}`}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/80 mb-1">Patrimônio total hoje</p>
            <p className={`text-3xl md:text-4xl font-black tracking-tight ${txt}`}>R$ {fmt(patrimonioAtual)}</p>
            <p className={`text-[11px] mt-1 ${sub}`}>É tudo que você tem guardado e investido somado.</p>
            {patrimonioAtual > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex rounded-full overflow-hidden h-2 bg-white/[0.06]">
                  <div style={{ width: `${(jarsTotal / patrimonioAtual) * 100}%`, background: '#10b981' }} />
                  <div style={{ width: `${(investCurrent / patrimonioAtual) * 100}%`, background: '#a855f7' }} />
                </div>
                <div className="flex justify-between flex-wrap gap-x-4 text-[10px] font-bold text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Reservas — R$ {fmt(jarsTotal)}</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Investimentos — R$ {fmt(investCurrent)}</span>
                </div>
              </div>
            )}
          </div>

          {/* MOVIMENTAÇÕES DO PERÍODO (3 cards simples) */}
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${sub}`}>Movimentações em {rangeLabel}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MoveCard isDark={isDark} icon={ArrowDownCircle} color="#10b981" label="Você guardou (aportes)" value={aportes} hint="Dinheiro que você colocou em reservas e investimentos." delta={pct(aportes, aportesPrev)} />
              <MoveCard isDark={isDark} icon={ArrowUpCircle} color="#f43f5e" label="Você retirou (resgates)" value={resgates} hint="Dinheiro que você tirou da reserva no período." delta={pct(resgates, resgatesPrev)} invert />
              <MoveCard isDark={isDark} icon={Scale} color={aporteLiquido >= 0 ? '#3b82f6' : '#f43f5e'} label="Aporte líquido" value={aporteLiquido} signed hint="Quanto o patrimônio cresceu só por causa dos aportes (guardou − retirou)." />
            </div>
          </div>

          {/* GRÁFICO: aportes x resgates por mês */}
          <div className={`p-5 rounded-2xl border ${card}`}>
            <h4 className={`text-sm font-bold uppercase tracking-wider mb-1 ${txt}`}>Quanto você guardou e retirou</h4>
            <p className={`text-[11px] mb-4 ${sub}`}>Barras verdes = aportes (dinheiro que entrou); vermelhas = resgates (dinheiro que saiu).</p>
            <div className="w-full h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#ffffff0d' : '#0000000d'} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: isDark ? '#64748b' : '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 9, fill: isDark ? '#64748b' : '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip cursor={{ fill: isDark ? '#ffffff08' : '#0000000a' }} formatter={(v, n) => [`R$ ${fmt(v)}`, n]} contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', borderColor: isDark ? '#1e293b' : '#e2e8f0', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: isDark ? '#e2e8f0' : '#0f172a' }} />
                  <Bar name="Aportes" dataKey="Aportes" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar name="Resgates" dataKey="Resgates" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 pl-1">
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Aportes</span>
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Resgates</span>
            </div>
          </div>

          {/* QUANTO SEU DINHEIRO RENDEU */}
          <div className={`p-5 rounded-2xl border ${card}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
              <h4 className={`text-sm font-bold uppercase tracking-wider ${txt}`}>Quanto seu dinheiro rendeu</h4>
              <div className="text-right">
                <p className={`text-xl font-black ${lucroTotal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{fmtSign(lucroTotal)}</p>
                <p className={`text-[10px] font-bold ${lucroTotal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{lucroPct >= 0 ? '+' : ''}{lucroPct.toFixed(1)}% sobre o que foi investido</p>
              </div>
            </div>
            <p className={`text-[11px] leading-relaxed mb-4 flex items-start gap-2 ${sub}`}>
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Rendimento é o lucro (ou prejuízo) que o seu dinheiro gerou sozinho — diferente dos aportes, que é dinheiro novo que você colocou. Nos investimentos é a diferença entre o valor de hoje e o que você pagou.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={`p-4 rounded-xl ${inset}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${sub}`}>Investimentos</p>
                <p className={`text-lg font-black ${lucroInvest >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{fmtSign(lucroInvest)}</p>
                <p className={`text-[10px] ${sub}`}>valor hoje R$ {fmt(investCurrent)} · você pagou R$ {fmt(investCost)}</p>
              </div>
              <div className={`p-4 rounded-xl ${inset}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${sub}`}>Reservas</p>
                <p className={`text-lg font-black ${reserveProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{reserveApplied > 0 ? fmtSign(reserveProfit) : '—'}</p>
                <p className={`text-[10px] ${sub}`}>{reserveApplied > 0 ? `rende ≈ R$ ${fmt(yieldMonth)}/mês (CDI)` : `informe o valor aplicado na reserva para ver o rendimento`}</p>
              </div>
            </div>
          </div>

          {/* SEUS ATIVOS POR TIPO */}
          <div className={`p-5 rounded-2xl border ${card}`}>
            <h4 className={`text-sm font-bold uppercase tracking-wider mb-1 ${txt}`}>Onde está seu dinheiro</h4>
            <p className={`text-[11px] mb-4 ${sub}`}>Seu patrimônio dividido por tipo, e quanto cada um já rendeu.</p>
            <div className="space-y-2.5">
              {byClass.map(m => {
                const Icon = m.icon || Wallet;
                const wpct = patrimonioAtual > 0 ? (m.current / patrimonioAtual) * 100 : 0;
                return (
                  <div key={m.cls} className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${m.color}1f` }}><Icon className="w-4 h-4" style={{ color: m.color }} /></span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-bold truncate ${txt}`}>{m.label}</span>
                        <span className={`text-sm font-black ${txt}`}>R$ {fmt(m.current)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <div className={`w-24 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}><div className="h-full rounded-full" style={{ width: `${wpct}%`, background: m.color }} /></div>
                        <span className={`text-[10px] font-bold ${m.lucro >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{m.cls === 'reserva' && reserveApplied <= 0 ? `${wpct.toFixed(0)}% do total` : `rendeu ${fmtSign(m.lucro)}`}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ALÍVIA */}
          <div className={`flex items-start gap-3 p-4 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
            <img src={aliviaFinal} alt="Alívia" className="w-10 h-10 object-cover rounded-full border-2 border-white/20 shadow-md shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Alívia · resumo simples</span>
              <p className={`text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {aporteLiquido > 0
                  ? <>Em {rangeLabel} você guardou <b className="text-emerald-500">R$ {fmt(aporteLiquido)}</b> a mais do que retirou — seu patrimônio cresceu por aporte.</>
                  : aporteLiquido < 0
                    ? <>Em {rangeLabel} você retirou <b className="text-rose-500">R$ {fmt(Math.abs(aporteLiquido))}</b> a mais do que guardou. Tudo bem se foi planejado, mas fique de olho.</>
                    : <>Em {rangeLabel} você não fez aportes nem resgates.</>}
              </p>
              <p className={`text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {lucroTotal >= 0
                  ? <>No total, seu dinheiro já rendeu <b className="text-emerald-500">{fmtSign(lucroTotal)}</b> ({lucroPct >= 0 ? '+' : ''}{lucroPct.toFixed(1)}%) sobre o que você investiu.</>
                  : <>No total, seus investimentos estão com <b className="text-rose-500">{fmtSign(lucroTotal)}</b> de prejuízo no papel — só vira perda de verdade se você vender.</>}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MoveCard({ isDark, icon, color, label, value, hint, delta, invert, signed }) {
  const card = isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';
  let deltaEl = null;
  if (delta != null && isFinite(delta) && Math.abs(delta) >= 0.5) {
    const up = delta > 0; const good = invert ? !up : up;
    deltaEl = <span className={`text-[10px] font-bold ${good ? 'text-emerald-500' : 'text-rose-500'}`}>{up ? '↑' : '↓'} {Math.abs(delta).toFixed(0)}% vs período anterior</span>;
  }
  return (
    <div className={`p-4 rounded-2xl border ${card}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}1f` }}>{React.createElement(icon, { className: 'w-4 h-4', style: { color } })}</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-black tabular-nums" style={{ color: signed && value < 0 ? '#f43f5e' : (isDark ? '#fff' : '#1e293b') }}>{signed ? fmtSign(value) : `R$ ${fmt(value)}`}</p>
      <p className={`text-[10px] mt-1 leading-snug ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{hint}</p>
      {deltaEl && <div className="mt-1">{deltaEl}</div>}
    </div>
  );
}
