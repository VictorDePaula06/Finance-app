import React, { useState } from 'react';
import { Landmark, ArrowRight, ShieldCheck, TrendingUp, CheckCircle2, Plus, Trash2, Home, Gem, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, addDoc } from 'firebase/firestore';

const OBJECTIVES = [
  { id: 'independence', label: 'Viver de Renda', emoji: '🏝️', desc: 'Conquistar independência financeira e não depender de salário' },
  { id: 'start',       label: 'Começar a Investir', emoji: '🌱', desc: 'Dar o primeiro passo e fazer o dinheiro trabalhar por você' },
  { id: 'debt',        label: 'Sair das Dívidas', emoji: '🔓', desc: 'Organizar, quitar e manter as finanças no azul' },
  { id: 'goal',        label: 'Conquistar um Bem', emoji: '🏠', desc: 'Juntar para casa própria, carro, viagem ou outro sonho' },
  { id: 'control',     label: 'Controle Total', emoji: '🧘', desc: 'Ter visão completa do patrimônio e paz financeira' },
];

const RISK_PROFILES = [
  {
    id: 'conservative',
    label: 'Conservador',
    desc: 'Priorizo segurança. Prefiro Tesouro Direto, CDB e poupança com rendimento estável.',
    color: 'from-blue-500 to-blue-600',
    emoji: '🛡️',
  },
  {
    id: 'moderate',
    label: 'Moderado',
    desc: 'Aceito oscilações controladas. Misturo renda fixa com ações e FIIs.',
    color: 'from-emerald-500 to-emerald-600',
    emoji: '⚖️',
  },
  {
    id: 'aggressive',
    label: 'Arrojado',
    desc: 'Foco em crescimento acelerado. Ações, ETFs e cripto sem medo de volatilidade.',
    color: 'from-purple-500 to-purple-600',
    emoji: '🚀',
  },
];

const STEPS_PREVIEW = [
  { emoji: '🎯', label: 'Objetivos' },
  { emoji: '📊', label: 'Perfil' },
  { emoji: '💎', label: 'Meta' },
  { emoji: '🛡️', label: 'Reservas' },
  { emoji: '📈', label: 'Investimentos' },
];

const INVESTMENT_TYPES = [
  { value: 'acoes',      label: 'Ações' },
  { value: 'crypto',     label: 'Criptomoedas' },
  { value: 'fiis',       label: 'Fundos Imobiliários (FIIs)' },
  { value: 'etfs',       label: 'ETFs' },
  { value: 'renda_fixa', label: 'Renda Fixa' },
  { value: 'imoveis',    label: 'Imóveis' },
];

function tickerPlaceholder(type) {
  if (type === 'imoveis') return 'Não aplicável';
  if (type === 'crypto')  return 'Ex: BTC, ETH, SOL';
  if (type === 'acoes')   return 'Ex: VALE3, AAPL, NVDA';
  if (type === 'fiis')    return 'Ex: MXRF11, HGLG11';
  if (type === 'etfs')    return 'Ex: IVVB11, BOVA11';
  return 'Ex: CDB Itaú';
}

export default function PatrimonyWelcome({ onComplete }) {
  const { theme } = useTheme();
  const { saveUserPreferences, currentUser, userPrefs } = useAuth();
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const [objectives, setObjectives]           = useState([]);
  const [riskProfile, setRiskProfile]         = useState('');
  const [patrimonyGoalType, setPatrimonyGoalType] = useState('');
  const [patrimonyGoalValue, setPatrimonyGoalValue] = useState('');

  const [debtName, setDebtName]     = useState('');
  const [debtValue, setDebtValue]   = useState('');
  const [reserveGoal, setReserveGoal] = useState('');

  const [reserves, setReserves]       = useState([{ id: 1, name: '', value: '', cdi: '100' }]);
  const [investments, setInvestments] = useState([{ id: 1, type: 'acoes', ticker: '', name: '', quantity: '', purchasePrice: '', isUSD: false, purchaseDate: '' }]);

  const isDark = theme !== 'light';
  const cardBase = isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100 shadow-sm';
  const text  = isDark ? 'text-white'      : 'text-slate-900';
  const sub   = isDark ? 'text-slate-400'  : 'text-slate-500';
  const inp   = `w-full px-3 py-2.5 rounded-xl border text-sm transition-all outline-none focus:ring-1 focus:ring-emerald-500 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'}`;
  const sel   = `w-full px-3 py-2.5 rounded-xl border text-sm transition-all outline-none focus:ring-1 focus:ring-emerald-500 appearance-none ${isDark ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-800'}`;
  const lbl   = `text-xs font-semibold mb-1 block ${sub}`;
  const hint  = `text-[11px] mt-1.5 leading-snug ${sub}`;
  const infoBox = isDark ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200';

  const firstName  = currentUser?.displayName?.split(' ')[0] || 'você';
  const totalSteps = 6;

  // ── handlers ──────────────────────────────────────────────────────────────

  const addReserve    = ()         => setReserves([...reserves, { id: Date.now(), name: '', value: '', cdi: '100' }]);
  const removeReserve = (id)       => setReserves(reserves.filter(r => r.id !== id));
  const updateReserve = (id, f, v) => setReserves(reserves.map(r => r.id === id ? { ...r, [f]: v } : r));

  const addInvestment    = ()         => setInvestments([...investments, { id: Date.now(), type: 'acoes', ticker: '', name: '', quantity: '', purchasePrice: '', isUSD: false, purchaseDate: '' }]);
  const removeInvestment = (id)       => setInvestments(investments.filter(i => i.id !== id));
  const updateInvestment = (id, f, v) => setInvestments(investments.map(i => i.id === id ? { ...i, [f]: v } : i));

  const canProceed = () => {
    if (step === 1) return objectives.length > 0;
    if (step === 2) return riskProfile !== '';
    return true;
  };

  const next = () => { if (step < totalSteps - 1) setStep(s => s + 1); else handleComplete(); };
  const prev = () => { if (step > 0) setStep(s => s - 1); };

  const handleComplete = async () => {
    setIsSaving(true);
    let totalInvested = 0;

    try {
      for (const res of reserves) {
        if (parseFloat(res.value) > 0) {
          totalInvested += parseFloat(res.value);
          addDoc(collection(db, 'savings_jars'), {
            name: res.name || 'Reserva de Emergência',
            balance: parseFloat(res.value),
            cdiPercent: parseFloat(res.cdi) || 100,
            color: 'emerald',
            userId: currentUser.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }).catch(console.warn);
        }
      }

      for (const inv of investments) {
        if (parseFloat(inv.purchasePrice) > 0 && parseFloat(inv.quantity) > 0) {
          const val = parseFloat(inv.purchasePrice) * parseFloat(inv.quantity);
          totalInvested += val;
          addDoc(collection(db, 'investments'), {
            type: inv.type || 'acoes',
            name: inv.name || 'Investimento',
            symbol: inv.ticker || '',
            quantity: parseFloat(inv.quantity),
            purchasePrice: parseFloat(inv.purchasePrice),
            manualCurrentPrice: parseFloat(inv.purchasePrice),
            isUSD: inv.isUSD || false,
            purchaseDate: inv.purchaseDate || '',
            userId: currentUser.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }).catch(console.warn);
        }
      }
    } catch (e) {
      console.error('Erro ao criar dados de patrimônio no firebase:', e);
    }

    const currentManualConfig = userPrefs?.manualConfig || {};
    const updatedManualConfig  = {
      ...currentManualConfig,
      invested: (currentManualConfig.invested || 0) + totalInvested,
    };

    if (patrimonyGoalType && parseFloat(patrimonyGoalValue) > 0) {
      try {
        const { addDoc: addGoalDoc } = await import('firebase/firestore');
        await addGoalDoc(collection(db, 'goals'), {
          userId: currentUser.uid,
          title: patrimonyGoalType === 'imovel' ? 'Imóvel' : 'Meta de Patrimônio',
          target: parseFloat(patrimonyGoalValue),
          current: 0,
          status: 'active',
          isPatrimonyGoal: true,
          patrimonyGoalType,
          linkedJarIds: [],
          linkedInvIds: [],
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Erro ao criar meta de patrimônio:', e);
      }
    }

    if (objectives.includes('debt') && parseFloat(debtValue) > 0) {
      try {
        const { addDoc: addDebtDoc } = await import('firebase/firestore');
        const debtAmount = parseFloat(debtValue);
        await addDebtDoc(collection(db, 'debts'), {
          userId: currentUser.uid,
          name: debtName || 'Dívida',
          originalAmount: debtAmount,
          remainingAmount: debtAmount,
          monthlyPayment: 0,
          interestRate: 0,
          dueDay: 0,
          paidOff: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Erro ao registrar dívida:', e);
      }
    }

    const onboarding = userPrefs?.onboarding || {};
    await saveUserPreferences({
      hasSeenPatrimonyWelcome: true,
      hasSeenWelcome: true,
      manualConfig: {
        ...updatedManualConfig,
        reserveGoal: reserveGoal ? parseFloat(reserveGoal) : (updatedManualConfig.reserveGoal || 0),
      },
      onboarding: {
        ...onboarding,
        objectives: objectives.length > 0 ? objectives : (onboarding.objectives || []),
        riskProfile: riskProfile || onboarding.riskProfile || '',
        patrimonyGoalType: patrimonyGoalType || onboarding.patrimonyGoalType || '',
        patrimonyGoalValue: patrimonyGoalValue ? parseFloat(patrimonyGoalValue) : (onboarding.patrimonyGoalValue || 0),
      },
    });

    setIsSaving(false);
    onComplete();
  };

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-500">
      <div className={`relative w-full max-w-2xl rounded-2xl border overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 ${cardBase}`}>

        <div className="absolute top-[-30%] left-[-20%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none opacity-20 bg-emerald-500" />

        <div className="relative p-6 flex flex-col gap-5 max-h-[92vh] overflow-y-auto scrollbar-hide">

          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5 flex-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-500 ${i <= step ? 'bg-emerald-500' : isDark ? 'bg-white/10' : 'bg-slate-100'}`} />
              ))}
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest shrink-0 ${sub}`}>{step + 1}/{totalSteps}</span>
          </div>

          {/* ── STEP 0: Boas-vindas ─────────────────────────────────────── */}
          {step === 0 && (
            <div className="flex flex-col gap-5 py-1">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                <Landmark className="w-7 h-7 text-emerald-500" />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-2">Construção de Patrimônio</p>
                <h2 className={`text-2xl font-black mb-2 ${text}`}>Olá, {firstName}! Vamos começar 🚀</h2>
                <p className={`text-sm leading-relaxed ${sub}`}>
                  Leva menos de 3 minutos. Vou fazer algumas perguntas para montar seu painel de patrimônio do jeito certo — personalizado para você.
                </p>
              </div>

              {/* Prévia das etapas */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${sub}`}>O que vamos configurar agora</p>
                <div className="grid grid-cols-5 gap-2">
                  {STEPS_PREVIEW.map((s, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 text-center">
                      <span className="text-xl">{s.emoji}</span>
                      <span className={`text-[9px] font-semibold leading-tight ${sub}`}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`flex items-start gap-2.5 p-3.5 rounded-xl ${isDark ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
                <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                  Tudo que você preencher aqui pode ser editado depois nas abas do painel. Não precisa ser 100% preciso agora — o mais importante é começar.
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 1: Objetivos ───────────────────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">01 — OBJETIVO</p>
                <h2 className={`text-xl font-black ${text}`}>O que você quer conquistar?</h2>
                <p className={`text-xs mt-1 ${sub}`}>Pode selecionar mais de um. A Alívia vai personalizar o painel com base nisso.</p>
              </div>

              <div className="flex flex-col gap-2">
                {OBJECTIVES.map(obj => {
                  const active = objectives.includes(obj.id);
                  return (
                    <button
                      key={obj.id}
                      onClick={() => setObjectives(prev => active ? prev.filter(o => o !== obj.id) : [...prev, obj.id])}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-200 ${active ? 'border-emerald-500 bg-emerald-500/10' : isDark ? 'border-white/10 bg-white/5 hover:border-white/20' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
                    >
                      <span className="text-xl shrink-0">{obj.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm ${active ? 'text-emerald-500' : text}`}>{obj.label}</p>
                        <p className={`text-[11px] leading-tight mt-0.5 ${sub}`}>{obj.desc}</p>
                      </div>
                      {active && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {objectives.includes('debt') && (
                <div className={`p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300`}>
                  <div>
                    <h3 className={`text-sm font-bold ${text}`}>Sobre a sua dívida</h3>
                    <p className={`text-[11px] mt-0.5 ${sub}`}>Vamos criar uma meta automática para você acompanhar e quitar esse valor na aba Metas.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Nome da Dívida</label>
                      <input type="text" value={debtName} onChange={e => setDebtName(e.target.value)} placeholder="Ex: Empréstimo Itaú" className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Valor Total (R$)</label>
                      <input type="number" step="any" value={debtValue} onChange={e => setDebtValue(e.target.value)} placeholder="Ex: 5000" className={inp} />
                      <p className={hint}>Total da dívida, incluindo juros se souber.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Perfil de risco ─────────────────────────────────── */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">02 — PERFIL</p>
                <h2 className={`text-xl font-black ${text}`}>Qual é o seu perfil de investidor?</h2>
                <p className={`text-xs mt-1 ${sub}`}>Isso ajuda a Alívia a sugerir alocações ideais. Você pode mudar a qualquer momento em Ajustes.</p>
              </div>

              <div className="flex flex-col gap-2.5">
                {RISK_PROFILES.map(profile => {
                  const active = riskProfile === profile.id;
                  return (
                    <button
                      key={profile.id}
                      onClick={() => setRiskProfile(profile.id)}
                      className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200 ${active ? `border-emerald-500 bg-gradient-to-r ${profile.color}` : isDark ? 'border-white/10 bg-white/5 hover:border-white/20' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
                    >
                      <span className="text-2xl shrink-0">{profile.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm ${active ? 'text-white' : text}`}>{profile.label}</p>
                        <p className={`text-[11px] leading-snug mt-0.5 ${active ? 'text-white/75' : sub}`}>{profile.desc}</p>
                      </div>
                      {active && <CheckCircle2 className="w-4 h-4 text-white shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STEP 3: Meta de patrimônio ──────────────────────────────── */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">03 — META</p>
                <h2 className={`text-xl font-black ${text}`}>Qual é a sua grande meta financeira?</h2>
                <p className={`text-xs mt-1 ${sub}`}>Defina um valor concreto para perseguir. Você vai acompanhar a evolução aqui no painel.</p>
              </div>

              <div className="flex flex-col gap-2.5">
                {[
                  { id: 'patrimonio_total', label: 'Patrimônio Total', desc: 'Quero atingir um valor consolidado — soma de tudo que tenho investido e guardado.', emoji: '💎' },
                  { id: 'imovel',           label: 'Comprar um Imóvel', desc: 'Quero juntar para casa própria ou apartamento.', emoji: '🏠' },
                ].map(goalType => {
                  const active = patrimonyGoalType === goalType.id;
                  return (
                    <button
                      type="button"
                      key={goalType.id}
                      onClick={() => setPatrimonyGoalType(active ? '' : goalType.id)}
                      className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200 ${active ? 'border-emerald-500 bg-emerald-500/10' : isDark ? 'border-white/10 bg-white/5 hover:border-white/20' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
                    >
                      <span className="text-2xl shrink-0">{goalType.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm ${active ? 'text-emerald-500' : text}`}>{goalType.label}</p>
                        <p className={`text-[11px] mt-0.5 ${sub}`}>{goalType.desc}</p>
                      </div>
                      {active && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {patrimonyGoalType && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <label className={lbl}>Valor da Meta (R$)</label>
                  <input
                    type="number"
                    step="any"
                    value={patrimonyGoalValue}
                    onChange={e => setPatrimonyGoalValue(e.target.value)}
                    placeholder={patrimonyGoalType === 'imovel' ? 'Ex: 350000' : 'Ex: 500000'}
                    className={inp}
                  />
                  <p className={hint}>
                    {patrimonyGoalType === 'imovel'
                      ? 'Valor estimado do imóvel. Pode ser uma aproximação por enquanto.'
                      : 'Quanto você quer acumular no total. Uma referência comum: 25× o seu gasto mensal.'}
                  </p>
                </div>
              )}

              <div className={`flex items-start gap-2.5 p-3.5 rounded-xl ${infoBox}`}>
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p className={`text-[11px] ${sub}`}>
                  Esta etapa é opcional. Se preferir, pode pular e definir sua meta depois na aba <strong>Metas</strong>.
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 4: Reservas de emergência ─────────────────────────── */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">04 — RESERVA DE EMERGÊNCIA</p>
                <h2 className={`text-xl font-black ${text}`}>Você tem uma reserva guardada?</h2>
                <p className={`text-xs mt-1 ${sub}`}>
                  Reserva de emergência é o dinheiro em aplicações seguras e de fácil acesso — como Nubank, Tesouro Selic ou CDB com liquidez diária.
                </p>
              </div>

              <div className={`p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5`}>
                <label className={lbl}>Meta Total da Reserva (R$)</label>
                <input type="number" step="any" value={reserveGoal} onChange={e => setReserveGoal(e.target.value)} placeholder="Ex: 30000" className={inp} />
                <p className={hint}>Quanto você quer ter guardado no total. Recomendado: 3 a 6 meses de despesas mensais.</p>
              </div>

              <div className="flex flex-col gap-3">
                {reserves.map((res, idx) => (
                  <div key={res.id} className={`p-4 rounded-xl border relative ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    {reserves.length > 1 && (
                      <button onClick={() => removeReserve(res.id)} className="absolute top-3.5 right-3.5 text-rose-500 hover:text-rose-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <label className={`text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5 ${sub}`}>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Reserva {idx + 1}
                    </label>
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className={lbl}>Nome / Onde está guardada</label>
                        <input
                          type="text"
                          value={res.name}
                          onChange={e => updateReserve(res.id, 'name', e.target.value)}
                          placeholder="Ex: Nubank, Tesouro Selic, CDB Banco X..."
                          className={inp}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={lbl}>Valor Atual (R$)</label>
                          <input type="number" value={res.value} onChange={e => updateReserve(res.id, 'value', e.target.value)} placeholder="0,00" className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>Rendimento (% do CDI)</label>
                          <input type="number" value={res.cdi} onChange={e => updateReserve(res.id, 'cdi', e.target.value)} placeholder="100" className={inp} />
                          <p className={hint}>Nubank = 100%, muitos CDBs = 110% ou mais. Se não souber, deixe 100%.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addReserve}
                  className={`w-full py-3 rounded-xl border border-dashed flex items-center justify-center gap-2 text-sm font-semibold transition-all ${isDark ? 'border-white/20 text-emerald-400 hover:bg-white/5' : 'border-slate-300 text-emerald-600 hover:bg-slate-50'}`}
                >
                  <Plus className="w-4 h-4" /> Adicionar outra reserva
                </button>
              </div>

              <div className={`flex items-start gap-2.5 p-3.5 rounded-xl ${infoBox}`}>
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p className={`text-[11px] ${sub}`}>
                  Esta etapa é opcional. Se ainda não tiver reserva, pode pular. Você adiciona depois na aba <strong>Reserva</strong>.
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 5: Investimentos ───────────────────────────────────── */}
          {step === 5 && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">05 — INVESTIMENTOS</p>
                <h2 className={`text-xl font-black ${text}`}>Seus investimentos atuais</h2>
                <p className={`text-xs mt-1 ${sub}`}>Cadastre os ativos que você já possui — ações, FIIs, cripto, renda fixa ou imóveis.</p>
              </div>

              <div className="flex flex-col gap-3">
                {investments.map((inv, idx) => (
                  <div key={inv.id} className={`p-4 rounded-xl border relative ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    {investments.length > 1 && (
                      <button onClick={() => removeInvestment(inv.id)} className="absolute top-3.5 right-3.5 text-rose-500 hover:text-rose-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <label className={`text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5 ${sub}`}>
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Ativo {idx + 1}
                    </label>

                    <div className="flex flex-col gap-3">
                      {/* Categoria */}
                      <div>
                        <label className={lbl}>Categoria</label>
                        <select value={inv.type} onChange={e => updateInvestment(inv.id, 'type', e.target.value)} className={sel}>
                          {INVESTMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>

                      {/* Ticker + Nome */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={lbl}>Ticker / Código</label>
                          <input
                            type="text"
                            value={inv.ticker}
                            onChange={e => updateInvestment(inv.id, 'ticker', e.target.value.toUpperCase())}
                            placeholder={tickerPlaceholder(inv.type)}
                            className={inp}
                            disabled={inv.type === 'imoveis'}
                          />
                          <p className={hint}>
                            {inv.type === 'imoveis' ? 'Imóveis não possuem ticker.' : 'Código do ativo na bolsa ou exchange.'}
                          </p>
                        </div>
                        <div>
                          <label className={lbl}>Nome do Ativo</label>
                          <input
                            type="text"
                            value={inv.name}
                            onChange={e => updateInvestment(inv.id, 'name', e.target.value)}
                            placeholder={inv.type === 'imoveis' ? 'Ex: Apartamento SP' : 'Ex: Vale do Rio Doce'}
                            className={inp}
                          />
                        </div>
                      </div>

                      {/* USD toggle */}
                      <button
                        type="button"
                        onClick={() => updateInvestment(inv.id, 'isUSD', !inv.isUSD)}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 ${inv.isUSD ? (isDark ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-emerald-400 bg-emerald-50') : (isDark ? 'border-white/10 bg-white/5 hover:border-white/20' : 'border-slate-200 bg-white hover:border-slate-300')}`}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${inv.isUSD ? 'bg-emerald-500 border-emerald-500' : isDark ? 'border-white/30' : 'border-slate-300'}`}>
                          {inv.isUSD && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <p className={`text-xs font-semibold ${inv.isUSD ? 'text-emerald-500' : text}`}>Ativo negociado em dólar (USD)</p>
                          <p className={`text-[10px] ${sub}`}>Marque para ações americanas, ETFs internacionais ou criptomoedas</p>
                        </div>
                      </button>

                      {/* Quantidade + Preço Médio + Data */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className={lbl}>Quantidade</label>
                          <input
                            type="number"
                            step="any"
                            value={inv.quantity}
                            onChange={e => updateInvestment(inv.id, 'quantity', e.target.value)}
                            placeholder={inv.type === 'imoveis' ? '1' : 'Ex: 100'}
                            className={inp}
                          />
                          {inv.type === 'imoveis' && <p className={hint}>Para imóveis use 1.</p>}
                          {inv.type === 'crypto' && <p className={hint}>Pode ser fração. Ex: 0.5</p>}
                        </div>
                        <div>
                          <label className={lbl}>Preço Médio</label>
                          <div className="relative">
                            <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold opacity-50 pointer-events-none ${isDark ? 'text-white' : 'text-slate-800'}`}>
                              {inv.isUSD ? '$' : 'R$'}
                            </span>
                            <input
                              type="number"
                              step="any"
                              value={inv.purchasePrice}
                              onChange={e => updateInvestment(inv.id, 'purchasePrice', e.target.value)}
                              placeholder="0.00"
                              className={`${inp} pl-8`}
                            />
                          </div>
                          <p className={hint}>Custo médio por unidade na compra.</p>
                        </div>
                        <div>
                          <label className={lbl}>Data da Compra</label>
                          <input
                            type="date"
                            value={inv.purchaseDate || ''}
                            onChange={e => updateInvestment(inv.id, 'purchaseDate', e.target.value)}
                            className={inp}
                          />
                          <p className={hint}>Aproximada se não lembrar.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addInvestment}
                  className={`w-full py-3 rounded-xl border border-dashed flex items-center justify-center gap-2 text-sm font-semibold transition-all ${isDark ? 'border-white/20 text-emerald-400 hover:bg-white/5' : 'border-slate-300 text-emerald-600 hover:bg-slate-50'}`}
                >
                  <Plus className="w-4 h-4" /> Adicionar outro ativo
                </button>
              </div>

              <div className={`flex items-start gap-2.5 p-3.5 rounded-xl ${infoBox}`}>
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p className={`text-[11px] ${sub}`}>
                  Esta etapa é opcional. Se ainda não tiver investimentos, pode pular. Você adiciona depois na aba <strong>Investimentos</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex flex-col gap-2.5 mt-1">
            <button
              onClick={next}
              disabled={isSaving || !canProceed()}
              className={`w-full py-3 rounded-xl text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg ${canProceed() ? 'bg-emerald-700 hover:bg-emerald-600 active:scale-[0.98] shadow-emerald-900/20' : 'bg-slate-600 opacity-50 cursor-not-allowed'}`}
            >
              {isSaving
                ? <span className="animate-spin">⏳</span>
                : step === totalSteps - 1
                  ? <><CheckCircle2 className="w-4 h-4" /> Concluir e Acessar o Painel</>
                  : <>Continuar <ArrowRight className="w-4 h-4" /></>}
            </button>
            {step > 0 && (
              <button onClick={prev} disabled={isSaving} className={`flex items-center justify-center gap-2 text-sm font-semibold py-1.5 transition-colors ${sub} hover:text-emerald-500`}>
                Voltar
              </button>
            )}
          </div>

        </div>
      </div>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
