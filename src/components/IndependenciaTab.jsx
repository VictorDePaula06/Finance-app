import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Wallet, Target, CalendarCheck, Flag, Info, Rocket, Home } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUsdRate, useCdiRate } from '../utils/marketRates';
import { summarizeInvestments, jarsDynamicTotal, bensTotal as calcBensTotal } from '../utils/investmentValue';
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
  const cdiRate = useCdiRate();

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

  // Patrimônio que CONTA para viver de renda = reservas + investimentos.
  // Bens (imóveis/veículos) NÃO entram, pois não geram renda de 4% ao ano.
  // Usa a MESMA fonte de valuation das demais telas (utils/investmentValue):
  // cofres com rendimento CDI (dinâmico) + carteira de investimentos.
  const investido = useMemo(
    () => jarsDynamicTotal(jars, cdiRate) + summarizeInvestments(investments, { usdRate }).current,
    [jars, investments, usdRate, cdiRate]
  );
  const bensTotal = useMemo(() => calcBensTotal(assets), [assets]);

  const fireTarget = (income * 12) / SWR; // número da independência
  const months = monthsToReach(investido, aporte, rate, fireTarget, compound);
  const fiDate = dateFromMonths(months);
  const alreadyFI = investido >= fireTarget;
  const progress = fireTarget > 0 ? Math.min(100, (investido / fireTarget) * 100) : 0;
  const faltam = Math.max(0, fireTarget - investido);

  // série do gráfico — por ano, separando "o que você guardou" de "o que rendeu (juros)".
  const series = useMemo(() => {
    const localMonths = monthsToReach(investido, aporte, rate, fireTarget, compound);
    let horizon = isFinite(localMonths) ? Math.ceil(localMonths / 12) + 2 : 40;
    horizon = Math.min(Math.max(horizon, 4), 40);
    const r = (rate / 100) / 12;
    const baseYear = new Date().getFullYear();
    const full = [];
    let bal = investido, contrib = investido; // 'contrib' = total que você colocou (inclui o que já tem)
    full.push({ year: baseYear, guardado: Math.round(contrib), rendeu: 0 });
    for (let y = 1; y <= horizon; y++) {
      for (let k = 0; k < 12; k++) { bal = compound ? bal * (1 + r) + aporte : bal + aporte; contrib += aporte; }
      full.push({ year: baseYear + y, guardado: Math.round(contrib), rendeu: Math.max(0, Math.round(bal - contrib)) });
    }
    // limita a ~13 barras para não poluir
    const step = Math.max(1, Math.ceil(horizon / 12));
    return full.filter((p, i) => i === 0 || i === full.length - 1 || i % step === 0);
  }, [investido, aporte, rate, fireTarget, compound]);

  const crossYear = isFinite(months) ? new Date().getFullYear() + Math.round(months / 12) : null;

  const milestones = [25, 50, 75, 100].map(pct => {
    const target = fireTarget * (pct / 100);
    const m = monthsToReach(investido, aporte, rate, target, compound);
    return { pct, target, reached: investido >= target, date: dateFromMonths(m), months: m };
  });

  const monthsPlus = monthsToReach(investido, aporte + 300, rate, fireTarget, compound);
  const saved = isFinite(months) && isFinite(monthsPlus) ? months - monthsPlus : null;

  const card = isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';
  const txt = isDark ? 'text-white' : 'text-slate-800';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';
  const inset = isDark ? 'bg-[#161b27] border-white/10' : 'bg-slate-50 border-slate-200';

  return (
    <div className="max-w-full px-5 md:px-8 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex items-center gap-3 pt-8 pb-1">
        <div className={`p-2 rounded-xl ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}><Rocket className="w-6 h-6 text-emerald-500" /></div>
        <div>
          <h2 className={`text-xl font-medium tracking-wide uppercase ${txt}`}>Independência Financeira</h2>
          <p className={`text-[11px] ${sub}`}>Descubra quando você poderá viver da sua renda, sem depender do salário.</p>
        </div>
      </div>

      {/* HERO: o número da independência + progresso */}
      <div className={`p-5 md:p-6 rounded-2xl border ${alreadyFI ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200') : card}`}>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/80 mb-1">Seu número da independência</p>
        <p className={`text-3xl md:text-4xl font-black tracking-tight ${txt}`}>R$ {fmt(fireTarget)}</p>
        <p className={`text-[12px] mt-1 ${sub}`}>
          É quanto você precisa ter investido para viver com <b className={txt}>R$ {fmt(income)}/mês</b> para sempre, sem depender do salário.
        </p>
        <div className="mt-4 space-y-1.5">
          <div className={`w-full h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-emerald-500">Você já tem R$ {fmt(investido)} ({progress.toFixed(0)}%)</span>
            {!alreadyFI && <span className={sub}>faltam R$ {fmt(faltam)}</span>}
          </div>
        </div>
      </div>

      {/* 3 números */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={`p-5 rounded-2xl border ${card}`}>
          <div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 text-blue-500" /><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Você já investiu</span></div>
          <p className={`text-2xl font-black ${txt}`}>R$ {fmt(investido)}</p>
          <p className={`text-[10px] ${sub}`}>reservas + investimentos (o que rende e pode virar renda)</p>
        </div>
        <div className={`p-5 rounded-2xl border ${card}`}>
          <div className="flex items-center gap-2 mb-1"><Target className="w-4 h-4 text-amber-500" /><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Renda desejada / mês</span></div>
          <div className="flex items-center gap-1">
            <span className={`text-2xl font-black ${txt}`}>R$</span>
            <input type="number" value={income} onChange={e => setIncome(Math.max(0, parseFloat(e.target.value) || 0))}
              className={`w-32 text-2xl font-black bg-transparent border-b-2 border-amber-500/50 focus:border-amber-500 focus:outline-none ${txt}`} />
          </div>
          <p className={`text-[10px] ${sub}`}>quanto quer receber por mês · pode editar</p>
        </div>
        <div className={`p-5 rounded-2xl border ${alreadyFI ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200') : card}`}>
          <div className="flex items-center gap-2 mb-1"><CalendarCheck className="w-4 h-4 text-emerald-500" /><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vai conseguir em</span></div>
          <p className="text-2xl font-black text-emerald-500">{alreadyFI ? 'Você já chegou! 🎉' : fiDate ? fiDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : '—'}</p>
          <p className={`text-[10px] ${sub}`}>{alreadyFI ? 'você já pode viver de renda' : `faltam ${fmtDuration(months)}`}</p>
        </div>
      </div>

      {/* Bens não contam */}
      {bensTotal > 0 && (
        <div className={`flex items-start gap-3 p-3.5 rounded-2xl border ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
          <Home className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
          <p className={`text-[11px] leading-relaxed ${sub}`}>
            Você também tem <b className={txt}>R$ {fmt(bensTotal)}</b> em imóveis/veículos. Eles <b>não entram nessa conta</b> porque não geram uma renda mensal de 4% ao ano — só viram dinheiro se você vender.
          </p>
        </div>
      )}

      {/* Como funciona (regra dos 4%) */}
      <div className={`flex items-start gap-3 p-4 rounded-2xl border ${isDark ? 'bg-blue-500/[0.06] border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <p className={`text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <b>Como funciona:</b> você pode retirar cerca de <b className="text-blue-500">4% do que tem investido por ano</b> que o dinheiro não acaba (ele rende acima disso). Então, para receber <b>R$ {fmt(income)}/mês</b> (R$ {fmt(income * 12)}/ano), precisa de <b>R$ {fmt(fireTarget)}</b> investidos. Considerei um rendimento de <b>{rate}% ao ano acima da inflação</b> — você ajusta abaixo.
        </p>
      </div>

      {/* Gráfico */}
      <div className={`p-5 rounded-2xl border ${card}`}>
        <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
          <h4 className={`text-sm font-bold uppercase tracking-wider ${txt}`}>Quanto você vai juntar com o tempo</h4>
          <div className={`flex rounded-lg p-0.5 ${inset}`}>
            {[[true, 'Com rendimento'], [false, 'Só guardando']].map(([v, lbl]) => (
              <button key={String(v)} onClick={() => setCompound(v)}
                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all ${compound === v ? 'bg-blue-500 text-white' : 'text-slate-400'}`}>{lbl}</button>
            ))}
          </div>
        </div>
        <p className={`text-[11px] mb-3 ${sub}`}>Cada barra é um ano. A parte <b className="text-emerald-500">verde</b> é o dinheiro que <b>você guardou</b>; a parte <b className="text-blue-500">azul</b> é o que <b>rendeu sozinho</b> (juros). A linha tracejada é a sua meta — quando a barra a alcança, você chega na independência.</p>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#ffffff0d' : '#0000000d'} vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 9, fill: isDark ? '#64748b' : '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={4} />
              <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 9, fill: isDark ? '#64748b' : '#94a3b8' }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<FireTooltip isDark={isDark} />} cursor={{ fill: isDark ? '#ffffff08' : '#0000000a' }} />
              <ReferenceLine y={fireTarget} stroke="#10b981" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: `Meta R$ ${fmt(fireTarget)}`, position: 'insideTopRight', fontSize: 10, fill: '#10b981' }} />
              <Bar dataKey="guardado" stackId="a" name="Guardado por você" fill="#10b981" maxBarSize={34} />
              <Bar dataKey="rendeu" stackId="a" name="Rendimento (juros)" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2 mt-2 pl-1">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Guardado por você</span>
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Rendimento (juros)</span>
          </div>
          {crossYear && !alreadyFI && <span className="text-[11px] text-emerald-500 font-bold">★ Independência por volta de {crossYear}</span>}
        </div>
      </div>

      {/* Simulador */}
      <div className={`p-5 rounded-2xl border ${card}`}>
        <h4 className={`text-sm font-bold uppercase tracking-wider mb-1 ${txt}`}>E se… ? Simule seu plano</h4>
        <p className={`text-[11px] mb-4 ${sub}`}>Arraste para ver como cada escolha muda a data da sua independência.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Slider label="Quanto você guarda por mês" value={aporte} min={0} max={10000} step={50} onChange={setAporte} fmtVal={v => `R$ ${fmt(v)}`} color="#10b981" isDark={isDark} sub={sub} />
          <Slider label="Rendimento ao ano (acima da inflação)" value={rate} min={0} max={20} step={0.5} onChange={setRate} fmtVal={v => `${v}%`} color="#3b82f6" isDark={isDark} sub={sub} />
          <Slider label="Renda desejada por mês" value={income} min={1000} max={30000} step={250} onChange={setIncome} fmtVal={v => `R$ ${fmt(v)}`} color="#f59e0b" isDark={isDark} sub={sub} />
        </div>
        <p className={`text-[12px] mt-4 text-center ${sub}`}>
          {alreadyFI ? <>Você já atingiu seu número! 🎉</> : <>No ritmo atual, você chega na independência em <span className="font-bold text-emerald-500">{fmtDuration(months)}</span>.</>}
          {saved > 0 && !alreadyFI && <> Guardar <b>R$ 300 a mais</b> por mês adiantaria em <span className="font-bold text-blue-500">{fmtDuration(saved)}</span>.</>}
        </p>
      </div>

      {/* Marcos */}
      <div className={`p-5 rounded-2xl border ${card}`}>
        <div className="flex items-center gap-2 mb-1"><Flag className="w-4 h-4 text-emerald-500" /><h4 className={`text-sm font-bold uppercase tracking-wider ${txt}`}>Sua jornada por etapas</h4><span className={`text-[10px] font-bold ${sub}`}>· {progress.toFixed(0)}% concluído</span></div>
        <p className={`text-[11px] mb-4 ${sub}`}>Quebrar o caminho em metas menores ajuda a manter o ritmo.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {milestones.map(m => (
            <div key={m.pct} className={`p-4 rounded-xl border ${m.reached ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200') : inset}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-lg font-black ${m.reached ? 'text-emerald-500' : txt}`}>{m.pct}%</span>
                {m.reached ? <span className="text-[9px] font-black uppercase text-emerald-500">✓ Atingido</span> : <span className="text-[9px] font-bold uppercase text-slate-400">{m.date ? m.date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) : '—'}</span>}
              </div>
              <p className={`text-sm font-black ${txt}`}>R$ {fmt(m.target)}</p>
              <p className={`text-[10px] ${sub}`}>{m.reached ? 'conquistado' : `daqui a ${fmtDuration(m.months)}`}</p>
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
              ? <>Parabéns! Você já tem <b className="text-emerald-500">R$ {fmt(investido)}</b> investidos — mais que o necessário (R$ {fmt(fireTarget)}). Já dá para viver com R$ {fmt(income)}/mês retirando até 4% ao ano.</>
              : aporte <= 0
                ? <>Sem guardar nada por mês, você depende só do rendimento. Defina quanto consegue guardar no simulador para acelerar — hoje você está em <b>{progress.toFixed(0)}%</b> da meta.</>
                : <>Você está em <b>{progress.toFixed(0)}%</b> do caminho. Guardando <b>R$ {fmt(aporte)}/mês</b> com rendimento de {rate}% ao ano, chega na independência em <b className="text-emerald-500">{fmtDuration(months)}</b>.</>}
          </p>
          {!alreadyFI && saved > 0 && (
            <p className={`text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <span className="font-bold text-blue-500">Dica:</span> guardar R$ 300 a mais por mês adiantaria sua independência em <b>{fmtDuration(saved)}</b>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function FireTooltip({ active, payload, label, isDark }) {
  if (!active || !payload?.length) return null;
  const g = payload.find(p => p.dataKey === 'guardado')?.value || 0;
  const r = payload.find(p => p.dataKey === 'rendeu')?.value || 0;
  return (
    <div className={`px-3 py-2 rounded-xl border shadow-xl text-xs ${isDark ? 'bg-[#0f172a] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
      <p className="font-black mb-1">{label}</p>
      <p className="text-emerald-400 font-bold">Guardado: R$ {fmt(g)}</p>
      <p className="text-blue-400 font-bold">Rendimento: R$ {fmt(r)}</p>
      <p className={`font-black mt-1 pt-1 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>Total: R$ {fmt(g + r)}</p>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, fmtVal, color, isDark, sub }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${sub}`}>{label}</span>
        <span className="text-sm font-black shrink-0" style={{ color }}>{fmtVal(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: color, background: isDark ? '#334155' : '#e2e8f0' }} />
    </div>
  );
}
