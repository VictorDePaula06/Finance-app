import { useState } from 'react';
import { ArrowRight, ArrowLeft, Sparkles, Target, TrendingUp, ShieldCheck, Bell, CheckCircle2, AlertTriangle, Landmark } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import aliviaFinal from '../assets/alivia/alivia-final.png';

const OBJECTIVES = [
  { id: 'independence', label: 'Viver de Renda', emoji: '🏝️', desc: 'Independência Financeira' },
  { id: 'start', label: 'Começar a Investir', emoji: '🌱', desc: 'Do zero' },
  { id: 'debt', label: 'Sair das Dívidas', emoji: '🔓', desc: 'Organizar e quitar' },
  { id: 'goal', label: 'Conquistar um Bem', emoji: '🏠', desc: 'Casa, carro ou viagem' },
  { id: 'control', label: 'Controle Total', emoji: '🧘', desc: 'Paz e organização' },
];

const RISK_PROFILES = [
  { id: 'conservative', label: 'Conservador', desc: 'Segurança absoluta e baixa volatilidade', color: 'from-blue-500 to-blue-600', emoji: '🛡️' },
  { id: 'moderate', label: 'Moderado', desc: 'Aceito oscilações por retornos acima da média', color: 'from-emerald-500 to-emerald-600', emoji: '⚖️' },
  { id: 'aggressive', label: 'Arrojado', desc: 'Foco em crescimento acelerado e ativos de risco', color: 'from-purple-500 to-purple-600', emoji: '🚀' },
];

export default function WelcomeJourney({ onComplete }) {
  const { theme } = useTheme();
  const { saveUserPreferences, currentUser } = useAuth();
  const [step, setStep] = useState(0);
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [data, setData] = useState({
    objectives: [],
    income: '',
    emergencyReserve: '',
    investments: '',
    riskProfile: '',
    investmentPercent: 20,
    alerts: { ceiling: true, weeklyReport: true },
  });

  const firstName = currentUser?.displayName?.split(' ')[0] || 'você';
  const totalSteps = 8;

  const isDark = theme !== 'light';
  const card = isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100 shadow-sm';
  const text = isDark ? 'text-white' : 'text-slate-900';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputCls = `w-full p-4 rounded-2xl border text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-emerald-500/40 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white'}`;

  const handleComplete = async () => {
    setIsSaving(true);
    const manualConfig = {
      income: parseFloat(data.income) || 0,
      invested: parseFloat(data.investments) || 0,
      fixedExpenses: 0,
      variableEstimate: 0,
      categoryBudgets: {},
      recurringSubs: [],
    };
    await saveUserPreferences({
      hasSeenWelcome: true,
      onboardingComplete: true,
      onboarding: {
        objectives: data.objectives,
        income: parseFloat(data.income) || 0,
        emergencyReserve: parseFloat(data.emergencyReserve) || 0,
        investments: parseFloat(data.investments) || 0,
        riskProfile: data.riskProfile,
        investmentPercent: data.investmentPercent,
        alerts: data.alerts,
        completedAt: new Date().toISOString(),
      },
      manualConfig,
    });
    setIsSaving(false);
    onComplete(manualConfig);
  };

  const next = () => { if (step < totalSteps - 1) setStep(s => s + 1); else handleComplete(); };
  const prev = () => { if (step > 0) setStep(s => s - 1); };

  const trySkip = () => setShowSkipWarning(true);
  const forceSkip = async () => {
    await saveUserPreferences({ hasSeenWelcome: true, onboardingComplete: false });
    onComplete({});
  };

  const aliviaComment = () => {
    if (step === 3 && data.income) {
      const inc = parseFloat(data.income);
      const suggested = (inc * data.investmentPercent / 100).toFixed(0);
      return `Com R$ ${inc.toLocaleString('pt-BR')} de renda, ${data.investmentPercent}% representa R$ ${Number(suggested).toLocaleString('pt-BR')}/mês investidos.`;
    }
    if (step === 4 && data.emergencyReserve && data.income) {
      const months = (parseFloat(data.emergencyReserve) / parseFloat(data.income)).toFixed(1);
      return `Sua reserva cobre ${months} meses de renda — ${parseFloat(months) >= 6 ? 'ótimo!' : 'o ideal é ter 6 meses.'}`;
    }
    if (step === 6 && data.riskProfile) {
      const map = { conservative: 'priorizar renda fixa e segurança', moderate: 'balancear entre segurança e crescimento', aggressive: 'buscar ativos de maior retorno' };
      return `Entendido! Vou te ajudar a ${map[data.riskProfile]}.`;
    }
    return null;
  };

  const comment = aliviaComment();

  const canProceed = () => {
    if (step === 1) return data.objectives.length > 0;
    return true;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-500">
      <div className={`relative w-full max-w-lg rounded-[2.5rem] border overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 ${card}`}>

        {/* Glow */}
        <div className="absolute top-[-30%] left-[-20%] w-[60%] h-[60%] rounded-full blur-[100px] pointer-events-none opacity-30 bg-emerald-500" />

        <div className="relative p-8 md:p-10 flex flex-col gap-6 max-h-[92vh] overflow-y-auto scrollbar-hide">

          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5 flex-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-500 ${i <= step ? 'bg-emerald-500' : isDark ? 'bg-white/10' : 'bg-slate-100'}`} />
              ))}
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest shrink-0 ${sub}`}>{step + 1}/{totalSteps}</span>
          </div>

          {/* STEP 0: Welcome */}
          {step === 0 && (
            <div className="flex flex-col items-center text-center gap-6 py-4">
              <div className="p-1 rounded-[2.5rem] bg-gradient-to-br from-emerald-500/20 to-blue-500/20 shadow-2xl animate-bounce-subtle">
                <div className="rounded-[2.4rem] overflow-hidden border-4 border-white/10">
                  <img src={aliviaFinal} alt="Alívia" className="w-32 h-32 object-cover" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-2">Bem-vindo(a)</p>
                <h2 className={`text-3xl font-black mb-3 ${text}`}>Olá, {firstName}! 👋</h2>
                <p className={`text-base leading-relaxed ${sub}`}>
                  Sou a Alívia, sua consultora financeira com IA. Antes de começarmos, quero entender sua situação pra que cada conselho seja feito pra você.
                </p>
              </div>
              <div className={`w-full p-4 rounded-2xl border flex items-start gap-3 text-left ${isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
                <Sparkles className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">Leva menos de 2 minutos e transforma completamente a qualidade das minhas análises.</p>
              </div>
            </div>
          )}

          {/* STEP 1: Objectives */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1`}>01 — SEU NORTE</p>
                <h2 className={`text-2xl font-black ${text}`}>Qual é o foco da sua jornada?</h2>
                <p className={`text-sm mt-1 ${sub}`}>Pode escolher mais de um.</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {OBJECTIVES.map(obj => {
                  const active = data.objectives.includes(obj.id);
                  return (
                    <button key={obj.id} onClick={() => {
                      setData(d => ({
                        ...d,
                        objectives: active ? d.objectives.filter(o => o !== obj.id) : [...d.objectives, obj.id]
                      }));
                    }}
                      className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-300 ${active ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]' : isDark ? 'border-white/10 bg-white/5 hover:border-white/20' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}>
                      <span className="text-2xl">{obj.emoji}</span>
                      <div>
                        <p className={`font-black text-sm ${active ? 'text-emerald-500' : text}`}>{obj.label}</p>
                        <p className={`text-xs ${sub}`}>{obj.desc}</p>
                      </div>
                      {active && <CheckCircle2 className="w-5 h-5 text-emerald-500 ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Income */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">02 — RENDA</p>
                <h2 className={`text-2xl font-black ${text}`}>Qual sua renda mensal líquida?</h2>
                <p className={`text-sm mt-1 ${sub}`}>O valor que cai na sua conta todo mês (já descontados impostos).</p>
              </div>
              <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-black text-sm ${sub}`}>R$</span>
                <input type="number" value={data.income} onChange={e => setData(d => ({ ...d, income: e.target.value }))}
                  placeholder="0,00" className={`${inputCls} pl-12`} />
              </div>
              <p className={`text-xs ${sub} italic`}>Esse dado é essencial para o Health Score e os alertas de ritmo de gastos.</p>
            </div>
          )}

          {/* STEP 3: Investment % */}
          {step === 3 && (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">03 — COMPROMISSO</p>
                <h2 className={`text-2xl font-black ${text}`}>Quanto da renda vai para investimentos?</h2>
                <p className={`text-sm mt-1 ${sub}`}>Essa porcentagem será protegida durante seus gastos mensais.</p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-bold ${sub}`}>1%</span>
                  <span className="text-3xl font-black text-emerald-500">{data.investmentPercent}%</span>
                  <span className={`text-xs font-bold ${sub}`}>50%</span>
                </div>
                <input type="range" min={1} max={50} value={data.investmentPercent}
                  onChange={e => setData(d => ({ ...d, investmentPercent: parseInt(e.target.value) }))}
                  className="w-full accent-emerald-500" />
                {comment && (
                  <div className={`p-4 rounded-2xl border ${isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
                    <p className="text-sm text-blue-500 font-semibold">💡 {comment}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Capital */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">04 — CAPITAL ATUAL</p>
                <h2 className={`text-2xl font-black ${text}`}>Seu combustível inicial</h2>
                <p className={`text-sm mt-1 ${sub}`}>Valores que você já tem guardados hoje.</p>
              </div>
              <div>
                <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${sub}`}>🛡️ Reserva de Emergência (R$)</label>
                <div className="relative">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-black text-sm ${sub}`}>R$</span>
                  <input type="number" value={data.emergencyReserve} onChange={e => setData(d => ({ ...d, emergencyReserve: e.target.value }))}
                    placeholder="0,00" className={`${inputCls} pl-12`} />
                </div>
              </div>
              <div>
                <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${sub}`}>📈 Investimentos (R$)</label>
                <div className="relative">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-black text-sm ${sub}`}>R$</span>
                  <input type="number" value={data.investments} onChange={e => setData(d => ({ ...d, investments: e.target.value }))}
                    placeholder="0,00" className={`${inputCls} pl-12`} />
                </div>
              </div>
              {comment && (
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
                  <p className="text-sm text-blue-500 font-semibold">💡 {comment}</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Risk Profile */}
          {step === 5 && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">05 — PERFIL</p>
                <h2 className={`text-2xl font-black ${text}`}>Seu perfil de investidor</h2>
                <p className={`text-sm mt-1 ${sub}`}>Como a Alívia deve sugerir alocações do seu patrimônio?</p>
              </div>
              <div className="flex flex-col gap-3">
                {RISK_PROFILES.map(profile => {
                  const active = data.riskProfile === profile.id;
                  return (
                    <button key={profile.id} onClick={() => setData(d => ({ ...d, riskProfile: profile.id }))}
                      className={`flex items-center gap-4 p-5 rounded-2xl border text-left transition-all duration-300 ${active ? `border-emerald-500 bg-gradient-to-r ${profile.color} text-white scale-[1.01]` : isDark ? 'border-white/10 bg-white/5 hover:border-white/20' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}>
                      <span className="text-2xl">{profile.emoji}</span>
                      <div>
                        <p className={`font-black text-sm ${active ? 'text-white' : text}`}>{profile.label}</p>
                        <p className={`text-xs ${active ? 'text-white/70' : sub}`}>{profile.desc}</p>
                      </div>
                      {active && <CheckCircle2 className="w-5 h-5 text-white ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {comment && (
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
                  <p className="text-sm text-blue-500 font-semibold">💡 {comment}</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 6: Alerts */}
          {step === 6 && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">06 — ALERTAS</p>
                <h2 className={`text-2xl font-black ${text}`}>Como devo te avisar?</h2>
                <p className={`text-sm mt-1 ${sub}`}>Configure como a Alívia vai te manter no caminho certo.</p>
              </div>
              <div className="flex flex-col gap-3">
                {[
                  { key: 'ceiling', label: 'Alertas de Teto', desc: 'Aviso ao atingir 80% do limite de gastos', icon: Bell },
                  { key: 'weeklyReport', label: 'Resumo Semanal', desc: 'Relatório de saúde financeira todo domingo', icon: TrendingUp },
                ].map(alert => {
                  const Icon = alert.icon;
                  const active = data.alerts[alert.key];
                  return (
                    <button key={alert.key} onClick={() => setData(d => ({ ...d, alerts: { ...d.alerts, [alert.key]: !d.alerts[alert.key] } }))}
                      className={`flex items-center gap-4 p-5 rounded-2xl border text-left transition-all duration-300 ${active ? 'border-emerald-500 bg-emerald-500/10' : isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                      <div className={`p-2 rounded-xl ${active ? 'bg-emerald-500 text-white' : isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-black text-sm ${active ? 'text-emerald-500' : text}`}>{alert.label}</p>
                        <p className={`text-xs ${sub}`}>{alert.desc}</p>
                      </div>
                      <div className={`w-10 h-6 rounded-full transition-all duration-300 flex items-center px-1 ${active ? 'bg-emerald-500 justify-end' : isDark ? 'bg-white/10 justify-start' : 'bg-slate-200 justify-start'}`}>
                        <div className="w-4 h-4 bg-white rounded-full shadow" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 7: Done */}
          {step === 7 && (
            <div className="flex flex-col items-center text-center gap-6 py-4">
              <div className="p-6 rounded-[2rem] bg-gradient-to-br from-emerald-500/20 to-blue-500/20">
                <Landmark className="w-16 h-16 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-2">Configuração Completa</p>
                <h2 className={`text-3xl font-black mb-3 ${text}`}>Tudo pronto, {firstName}! 🎉</h2>
                <p className={`text-base leading-relaxed ${sub}`}>Seu perfil foi criado. A Alívia já pode personalizar análises, alertas e o seu Health Score.</p>
              </div>
              <div className="w-full grid grid-cols-3 gap-3">
                {[
                  { label: 'Objetivo', value: data.objectives.length > 0 ? OBJECTIVES.find(o => o.id === data.objectives[0])?.emoji + ' ' + OBJECTIVES.find(o => o.id === data.objectives[0])?.label : '—' },
                  { label: 'Renda', value: data.income ? `R$ ${Number(data.income).toLocaleString('pt-BR')}` : '—' },
                  { label: 'Investir', value: `${data.investmentPercent}% /mês` },
                ].map(item => (
                  <div key={item.label} className={`p-4 rounded-2xl border text-center ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                    <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${sub}`}>{item.label}</p>
                    <p className={`text-xs font-black ${text}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skip Warning */}
          {showSkipWarning && (
            <div className={`p-5 rounded-2xl border ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-amber-600">Sem esses dados a Alívia não consegue personalizar seus alertas, calcular seu Health Score ou te dar conselhos reais.</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setShowSkipWarning(false)} className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-black">Voltar e preencher</button>
                    <button onClick={forceSkip} className="px-4 py-2 rounded-xl text-xs font-black text-amber-600 hover:underline">Pular mesmo assim</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex flex-col gap-3">
            <button onClick={next} disabled={!canProceed() || isSaving}
              className={`w-full py-5 rounded-2xl text-white font-black text-sm transition-all flex items-center justify-center gap-3 shadow-lg ${canProceed() ? 'bg-gradient-to-r from-blue-600 to-emerald-500 hover:scale-[1.02] active:scale-[0.98] shadow-emerald-500/20' : 'bg-slate-600 opacity-50 cursor-not-allowed'}`}>
              {isSaving ? <span className="animate-spin">⏳</span> : step === totalSteps - 1 ? <><CheckCircle2 className="w-5 h-5" /> Entrar no Dashboard</> : <><span>{step === 0 ? 'Vamos começar!' : 'Próximo'}</span><ArrowRight className="w-5 h-5" /></>}
            </button>
            <div className="flex items-center justify-center gap-6">
              {step > 0 && (
                <button onClick={prev} className={`flex items-center gap-2 text-sm font-bold ${sub} hover:text-emerald-500 transition-colors`}>
                  <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
              )}
              {step > 0 && step < totalSteps - 1 && !showSkipWarning && (
                <button onClick={trySkip} className={`text-sm font-bold ${sub} hover:text-rose-400 transition-colors`}>Pular</button>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes bounce-subtle { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        .animate-bounce-subtle { animation: bounce-subtle 3s ease-in-out infinite; }
        .scrollbar-hide::-webkit-scrollbar { display:none; }
        .scrollbar-hide { -ms-overflow-style:none; scrollbar-width:none; }
      `}</style>
    </div>
  );
}
