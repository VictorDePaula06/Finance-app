import React, { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';
import { TrendingUp, Wallet, Target, CalendarCheck, Sparkles, Flag, Info, Rocket } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUsdRate } from '../utils/marketRates';
import aliviaFinal from '../assets/alivia/alivia-final.png';

const fmt = (v) => Math.abs(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtAxis = (v) => { const a = Math.abs(v); if (a >= 1e6) return `R$${(a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`; if (a >= 1e3) return `R$${Math.round(a / 1e3)}k`; return `R$${Math.round(a)}`; };
const SWR = 0.04; // regra dos 4%

function monthsToReach(start, aporte, annualPct, target, compound) {
  if (start >= target) return 0;
  if (!compound) { if (aporte <= 0) return Infinity; return Math.ceil((target - start) / aporte); }
  const r = (annualPct / 100) / 12;
  let bal = start, m = 0; const cap = 1200;
  while (bal < target && m < cap) { bal = bal * (1 + r) + aporte; m++; }
  return bal >= target ? m : Infinity;
}
function fmtDuration(months) {
  if (!isFinite(months)) return 'mais de 100 anos';
  if (months <= 0) return 'agora';
  const y = Math.floor(months / 12), m = months % 12;
  if (y === 0) return `${m} ${m === 1 ? 'mês' : 'meses'}`;
  if (m === 0) return `${y} ${y === 1 ? 'ano' : 'anos'}`;
  return `${y} ${y === 1 ? 'ano' : 'anos'} e ${m} ${m === 1 ? 'mês' : 'meses'}`;
}
function dateFromMonths(months) {
  if (!isFinite(months)) return null;
  const d = new Date(); d.setMonth(d.getMonth() + months); return d;
}

export default function IndependenciaTab() {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const isDark = theme !== 'light';
  const usdRate = useUsdRate();

  const [jars, setJars] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [assets, setAssets] = useState([]);

  const [income, setIncome] = useState(() => parseFloat(localStorage.getItem('fire_income')) || 5000);
  const [rate, setRate] = useState(() => parseFloat(localStorage.getItem('fire_rate')) || 6);
  const [aporte, setAporte] = useState(() => parseFloat(localStorage.getItem('fire_aporte')) || 500);
  const [compound, setCompound] = useState(true);

  useEffect(() => { localStorage.setItem('fire_income', String(income)); }, [income]);
  useEffect(() => { localStorage.setItem('fire_rate', String(rate)); }, [rate]);
  useEffect(() => { localStorage.setItem('fire_aporte', String(aporte)); }, [aporte]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'savings_jars'), where('userId', '==', currentUser.uid));
    return onSnapshot(q, s => setJars(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'investments'), where('userId', '==', currentUser.uid));
    return onSnapshot(q, s => setInvestments(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'tangible_assets'), where('userId', '==', currentUser.uid));
    return onSnapshot(q, s => setAssets(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);

  const patrimonioAtual = useMemo(() => {
    const jarsT = jars.reduce((a, j) => a + (parseFloat(j.balance) || 0), 0);
    const invT = investments.reduce((a, inv) => {
      if (inv.type === 'renda_fixa') return a + (parseFloat(inv.manualCurrentPrice || inv.totalApplied || (inv.quantity * inv.purchasePrice)) || 0);
      const usdM = inv.isUSD ? (usdRate || 5) : 1;
      const price = inv.manualCurrentPrice || inv.purchasePrice || 0;
      return a + (inv.quantity || 0) * price * usdM;
    }, 0);
    const bensT = assets.reduce((a, b) => a + (parseFloat(b.currentValue ?? b.manualCurrentValue ?? b.fipeValue ?? b.acquisitionValue) || 0), 0);
    return jarsT + invT + bensT;
  }, [jars, investments, assets, usdRate]);

  const fireTarget = (income * 12) / SWR; // patrimônio necessário
  const months = monthsToReach(patrimonioAtual, aporte, rate, fireTarget, compound);
  const fiDate = dateFromMonths(months);
  const alreadyFI = patrimonioAtual >= fireTarget;
  const progress = fireTarget > 0 ? Math.min(100, (patrimonioAtual / fireTarget) * 100) : 0;

  // série do gráfico (anual)
  const series = useMemo(() => {
    const localMonths = monthsToReach(patrimonioAtual, aporte, rate, fireTarget, compound);
    const horizonYears = Math.min(isFinite(localMonths) ? Math.ceil((localMonths / 12) * 1.2) + 1 : 50, 60);
    const r = (rate / 100) / 12;
    const pts = []; let bal = patrimonioAtual; const baseYear = new Date().getFullYear();
    pts.push({ year: baseYear, balance: Math.round(bal), alvo: Math.round(fireTarget) });
    for (let y = 1; y <= horizonYears; y++) {
      for (let k = 0; k < 12; k++) bal = compound ? bal * (1 + r) + aporte : bal + aporte;
      pts.push({ year: baseYear + y, balance: Math.round(bal), alvo: Math.round(fireTarget) });
    }
    return pts;
  }, [patrimonioAtual, aporte, rate, fireTarget, compound]);

  const crossYear = isFinite(months) ? new Date().getFullYear() + Math.round(months / 12) : null;
  const crossPoint = crossYear ? series.find(p => p.year === crossYear) : null;

  // marcos
  const milestones = [25, 50, 75, 100].map(pct => {
    const target = fireTarget * (pct / 100);
    const m = monthsToReach(patrimonioAtual, aporte, rate, target, compound);
    return { pct, target, reached: patrimonioAtual >= target, date: dateFromMonths(m), months: m };
  });

  // sugestão: +300/mês
  const monthsPlus = monthsToReach(patrimonioAtual, aporte + 300, rate, fireTarget, compound);
  const saved = isFinite(months) && isFinite(monthsPlus) ? months - monthsPlus : null;

  const card = isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';
  const txt = isDark ? 'text-white' : 'text-slate-800';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';
  const inset = isDark ? 'bg-[#161b27] border-white/10' : 'bg-slate-50 border-slate-200';

  return (
    <div className="max-w-full px-5 md:px-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex items-center gap-3 pt-8 pb-1">
        <div className={`p-2 rounded-xl ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}><Rocket className="w-6 h-6 text-emerald-500" /></div>
        <h2 className={`text-xl font-medium tracking-wide uppercase ${txt}`}>Independência Financeira</h2>
      </div>

      {/* 3 números de destaque */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={`p-5 rounded-2xl border ${card}`}>
          <div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 text-blue-500" /><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Patrimônio atual</span></div>
          <p className={`text-2xl font-black ${txt}`}>R$ {fmt(patrimonioAtual)}</p>
          <p className={`text-[10px] ${sub}`}>puxado do seu módulo de Patrimônio</p>
        </div>
        <div className={`p-5 rounded-2xl border ${card}`}>
          <div className="flex items-center gap-2 mb-1"><Target className="w-4 h-4 text-amber-500" /><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Renda desejada / mês</span></div>
          <div className="flex items-center gap-1">
            <span className={`text-2xl font-black ${txt}`}>R$</span>
            <input type="number" value={income} onChange={e => setIncome(Math.max(0, parseFloat(e.target.value) || 0))}
              className={`w-32 text-2xl font-black bg-transparent border-b-2 border-amber-500/50 focus:border-amber-500 focus:outline-none ${txt}`} />
          </div>
          <p className={`text-[10px] ${sub}`}>na aposentadoria · editável</p>
        </div>
        <div className={`p-5 rounded-2xl border ${alreadyFI ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200') : card}`}>
          <div className="flex items-center gap-2 mb-1"><CalendarCheck className="w-4 h-4 text-emerald-500" /><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Independência em</span></div>
          <p className="text-2xl font-black text-emerald-500">{alreadyFI ? 'Conquistada! 🎉' : fiDate ? fiDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : '—'}</p>
          <p className={`text-[10px] ${sub}`}>{alreadyFI ? 'você já pode viver de renda' : `faltam ${fmtDuration(months)}`}</p>
        </div>
      </div>

      {/* Explicação 4% */}
      <div className={`flex items-start gap-3 p-4 rounded-2xl border ${isDark ? 'bg-blue-500/[0.06] border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <p className={`text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Para ter <span className="font-bold">R$ {fmt(income)} por mês para sempre</span>, você precisa de <span className="font-bold text-blue-500">R$ {fmt(fireTarget)} investidos</span> rendendo acima da inflação (regra dos 4%: renda anual ÷ 0,04). A taxa de rendimento real considerada é de <span className="font-bold">{rate}% a.a.</span> — ajustável abaixo.
        </p>
      </div>

      {/* Gráfico */}
      <div className={`p-5 rounded-2xl border ${card}`}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h4 className={`text-sm font-bold uppercase tracking-wider ${txt}`}>Projeção do patrimônio</h4>
          <div className={`flex rounded-lg p-0.5 ${inset}`}>
            {[[true, 'Com juros compostos'], [false, 'Sem juros']].map(([v, lbl]) => (
              <button key={String(v)} onClick={() => setCompound(v)}
                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all ${compound === v ? 'bg-blue-500 text-white' : 'text-slate-400'}`}>{lbl}</button>
            ))}
          </div>
        </div>
        <div className="w-full h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="fireFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#ffffff0d' : '#0000000d'} vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 9, fill: isDark ? '#64748b' : '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={20} />
              <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 9, fill: isDark ? '#64748b' : '#94a3b8' }} axisLine={false} tickLine={false} width={52} />
              <Tooltip formatter={(v, n) => [`R$ ${fmt(v)}`, n === 'balance' ? 'Patrimônio projetado' : 'Alvo (4%)']} contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', borderColor: isDark ? '#1e293b' : '#e2e8f0', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: isDark ? '#e2e8f0' : '#0f172a' }} />
              <ReferenceLine y={fireTarget} stroke="#10b981" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: `Meta R$ ${fmt(fireTarget)}`, position: 'insideTopRight', fontSize: 10, fill: '#10b981' }} />
              <Area type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2.5} fill="url(#fireFill)" />
              {crossPoint && <ReferenceDot x={crossPoint.year} y={fireTarget} r={6} fill="#10b981" stroke="#fff" strokeWidth={2} />}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {crossYear && !alreadyFI && <p className="text-center text-[11px] text-emerald-500 font-bold mt-1">★ Independência estimada por volta de {crossYear}</p>}
      </div>

      {/* Simulador */}
      <div className={`p-5 rounded-2xl border ${card}`}>
        <h4 className={`text-sm font-bold uppercase tracking-wider mb-4 ${txt}`}>Simulador “e se?”</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Slider label="Aporte mensal adicional" value={aporte} min={0} max={10000} step={50} onChange={setAporte} fmtVal={v => `R$ ${fmt(v)}`} color="#10b981" isDark={isDark} sub={sub} />
          <Slider label="Taxa de rendimento (a.a.)" value={rate} min={0} max={15} step={0.5} onChange={setRate} fmtVal={v => `${v}%`} color="#3b82f6" isDark={isDark} sub={sub} />
          <Slider label="Renda desejada / mês" value={income} min={1000} max={30000} step={250} onChange={setIncome} fmtVal={v => `R$ ${fmt(v)}`} color="#f59e0b" isDark={isDark} sub={sub} />
        </div>
        <p className={`text-[11px] mt-4 text-center ${sub}`}>
          {alreadyFI ? 'Você já atingiu seu número!' : <>No ritmo atual, sua independência chega em <span className="font-bold text-emerald-500">{fmtDuration(months)}</span>.</>}
          {saved > 0 && !alreadyFI && <> Aportar R$ 300 a mais por mês anteciparia em <span className="font-bold text-blue-500">{fmtDuration(saved)}</span>.</>}
        </p>
      </div>

      {/* Marcos */}
      <div className={`p-5 rounded-2xl border ${card}`}>
        <div className="flex items-center gap-2 mb-4"><Flag className="w-4 h-4 text-emerald-500" /><h4 className={`text-sm font-bold uppercase tracking-wider ${txt}`}>Marcos da jornada</h4><span className={`text-[10px] font-bold ${sub}`}>· {progress.toFixed(0)}% concluído</span></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {milestones.map(m => (
            <div key={m.pct} className={`p-4 rounded-xl border ${m.reached ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200') : inset}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-lg font-black ${m.reached ? 'text-emerald-500' : txt}`}>{m.pct}%</span>
                {m.reached ? <span className="text-[9px] font-black uppercase text-emerald-500">✓ Atingido</span> : <span className="text-[9px] font-bold uppercase text-slate-400">{m.date ? m.date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) : '—'}</span>}
              </div>
              <p className={`text-sm font-black ${txt}`}>R$ {fmt(m.target)}</p>
              <p className={`text-[10px] ${sub}`}>{m.reached ? 'conquistado' : `em ${fmtDuration(m.months)}`}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alívia */}
      <div className={`flex items-start gap-3 p-4 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
        <img src={aliviaFinal} alt="Alívia" className="w-10 h-10 object-cover rounded-full border-2 border-white/20 shadow-md shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Alívia · seu ritmo</span>
          <p className={`text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {alreadyFI
              ? `Parabéns! Seu patrimônio (R$ ${fmt(patrimonioAtual)}) já supera o número da independência (R$ ${fmt(fireTarget)}). Você pode viver de renda mantendo retiradas de até 4% ao ano.`
              : progress >= 50
                ? `Você já percorreu ${progress.toFixed(0)}% do caminho — está bem encaminhado. No ritmo atual faltam ${fmtDuration(months)}.`
                : aporte <= 0
                  ? `Sem aportes mensais, sua independência depende só do rendimento — defina um aporte no simulador para acelerar.`
                  : `Você está em ${progress.toFixed(0)}% da meta. Mantendo R$ ${fmt(aporte)}/mês a ${rate}% a.a., chega lá em ${fmtDuration(months)}.`}
          </p>
          {!alreadyFI && saved > 0 && (
            <p className={`text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <span className="font-bold text-blue-500">Sugestão:</span> aumentar seu aporte em R$ 300 por mês anteciparia sua independência em <span className="font-bold">{fmtDuration(saved)}</span>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, fmtVal, color, isDark, sub }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${sub}`}>{label}</span>
        <span className="text-sm font-black" style={{ color }}>{fmtVal(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: color, background: isDark ? '#334155' : '#e2e8f0' }} />
    </div>
  );
}
