import React, { useState } from 'react';
import { Landmark, ArrowRight, ShieldCheck, TrendingUp, CheckCircle2, Target, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, addDoc } from 'firebase/firestore';

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

export default function PatrimonyWelcome({ onComplete }) {
  const { theme } = useTheme();
  const { saveUserPreferences, currentUser, userPrefs } = useAuth();
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  
  const [objectives, setObjectives] = useState([]);
  const [riskProfile, setRiskProfile] = useState('');
  
  const [reserves, setReserves] = useState([{ id: 1, name: '', value: '', cdi: '100' }]);
  const [investments, setInvestments] = useState([{ id: 1, type: 'acoes', ticker: '', name: '', quantity: '', purchasePrice: '', isUSD: false }]);

  const isDark = theme !== 'light';
  const card = isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100 shadow-sm';
  const text = isDark ? 'text-white' : 'text-slate-900';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputCls = `w-full p-4 rounded-2xl border text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-emerald-500/40 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white'}`;

  const firstName = currentUser?.displayName?.split(' ')[0] || 'você';
  const totalSteps = 5;

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
            updatedAt: new Date().toISOString()
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
            userId: currentUser.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }).catch(console.warn);
        }
      }
    } catch (e) {
      console.error("Erro ao criar dados de patrimônio no firebase:", e);
    }

    const currentManualConfig = userPrefs?.manualConfig || {};
    const updatedManualConfig = {
      ...currentManualConfig,
      invested: (currentManualConfig.invested || 0) + totalInvested
    };

    const onboarding = userPrefs?.onboarding || {};

    await saveUserPreferences({
      hasSeenPatrimonyWelcome: true,
      hasSeenWelcome: true, // Ensures main WelcomeJourney doesn't interrupt after this
      manualConfig: updatedManualConfig,
      onboarding: {
        ...onboarding,
        objectives: objectives.length > 0 ? objectives : (onboarding.objectives || []),
        riskProfile: riskProfile || onboarding.riskProfile || '',
      }
    });
    
    setIsSaving(false);
    onComplete();
  };

  const next = () => { if (step < totalSteps - 1) setStep(s => s + 1); else handleComplete(); };
  const prev = () => { if (step > 0) setStep(s => s - 1); };

  const addReserve = () => setReserves([...reserves, { id: Date.now(), name: '', value: '', cdi: '100' }]);
  const removeReserve = (id) => setReserves(reserves.filter(r => r.id !== id));
  const updateReserve = (id, field, val) => setReserves(reserves.map(r => r.id === id ? { ...r, [field]: val } : r));

  const addInvestment = () => setInvestments([...investments, { id: Date.now(), type: 'acoes', ticker: '', name: '', quantity: '', purchasePrice: '', isUSD: false }]);
  const removeInvestment = (id) => setInvestments(investments.filter(i => i.id !== id));
  const updateInvestment = (id, field, val) => setInvestments(investments.map(i => i.id === id ? { ...i, [field]: val } : i));

  const canProceed = () => {
    if (step === 1) return objectives.length > 0;
    if (step === 2) return riskProfile !== '';
    return true;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-500">
      <div className={`relative w-full max-w-lg rounded-[2.5rem] border overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 ${card}`}>
        
        {/* Glow */}
        <div className="absolute top-[-30%] left-[-20%] w-[60%] h-[60%] rounded-full blur-[100px] pointer-events-none opacity-30 bg-emerald-500" />

        <div className="relative p-8 md:p-10 flex flex-col gap-6 max-h-[92vh] overflow-y-auto scrollbar-hide">

          <div className="flex items-center gap-3">
            <div className="flex gap-1.5 flex-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-500 ${i <= step ? 'bg-emerald-500' : isDark ? 'bg-white/10' : 'bg-slate-100'}`} />
              ))}
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest shrink-0 ${sub}`}>{step + 1}/{totalSteps}</span>
          </div>

          {/* STEP 0: Welcome to Patrimony */}
          {step === 0 && (
            <div className="flex flex-col gap-6 py-4">
              <div className="w-16 h-16 rounded-[2rem] bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center shadow-inner mb-2">
                <Landmark className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-2">Construção de Patrimônio</p>
                <h2 className={`text-3xl font-black mb-3 ${text}`}>Seu ponto de partida 🚀</h2>
                <p className={`text-base leading-relaxed ${sub}`}>
                  {firstName}, para que eu possa montar seu painel de patrimônio corretamente, precisamos de alguns dados. Vamos alinhar seus objetivos e mapear o que você já possui guardado hoje.
                </p>
              </div>
            </div>
          )}

          {/* STEP 1: Objectives */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">01 — OBJETIVO</p>
                <h2 className={`text-2xl font-black ${text}`}>Qual é o foco da sua jornada?</h2>
                <p className={`text-sm mt-1 ${sub}`}>Pode escolher mais de um.</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {OBJECTIVES.map(obj => {
                  const active = objectives.includes(obj.id);
                  return (
                    <button key={obj.id} onClick={() => {
                      setObjectives(prev => active ? prev.filter(o => o !== obj.id) : [...prev, obj.id]);
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

          {/* STEP 2: Risk Profile */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">02 — PERFIL</p>
                <h2 className={`text-2xl font-black ${text}`}>Seu perfil de investidor</h2>
                <p className={`text-sm mt-1 ${sub}`}>Como a Alívia deve sugerir alocações do seu patrimônio?</p>
              </div>
              <div className="flex flex-col gap-3">
                {RISK_PROFILES.map(profile => {
                  const active = riskProfile === profile.id;
                  return (
                    <button key={profile.id} onClick={() => setRiskProfile(profile.id)}
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
            </div>
          )}

          {/* STEP 3: Reserve Values */}
          {step === 3 && (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">03 — RESERVAS DE EMERGÊNCIA</p>
                <h2 className={`text-2xl font-black ${text}`}>Suas Reservas</h2>
                <p className={`text-sm mt-1 ${sub}`}>Valores seguros e de alta liquidez.</p>
              </div>
              
              <div className="space-y-4">
                {reserves.map((res, idx) => (
                  <div key={res.id} className={`p-5 rounded-2xl border relative ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    {reserves.length > 1 && (
                      <button onClick={() => removeReserve(res.id)} className="absolute top-4 right-4 text-rose-500 hover:text-rose-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <label className={`text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${sub}`}>
                      <ShieldCheck className="w-4 h-4 text-emerald-500" /> Reserva {idx + 1}
                    </label>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                          <span className={`text-[10px] font-bold uppercase ${sub} mb-1 block`}>Nome da Reserva</span>
                          <input type="text" value={res.name} onChange={e => updateReserve(res.id, 'name', e.target.value)} placeholder="Ex: Nubank, Tesouro Selic..." className={inputCls} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className={`text-[10px] font-bold uppercase ${sub} mb-1 block`}>Valor (R$)</span>
                            <input type="number" value={res.value} onChange={e => updateReserve(res.id, 'value', e.target.value)} placeholder="0,00" className={inputCls} />
                          </div>
                          <div>
                            <span className={`text-[10px] font-bold uppercase ${sub} mb-1 block`}>CDI (%)</span>
                            <input type="number" value={res.cdi} onChange={e => updateReserve(res.id, 'cdi', e.target.value)} placeholder="100" className={inputCls} />
                          </div>
                        </div>
                    </div>
                  </div>
                ))}

                <button onClick={addReserve} className={`w-full py-4 rounded-2xl border border-dashed flex items-center justify-center gap-2 text-sm font-bold transition-all ${isDark ? 'border-white/20 text-emerald-400 hover:bg-white/5' : 'border-slate-300 text-emerald-600 hover:bg-slate-50'}`}>
                  <Plus className="w-4 h-4" /> Adicionar outra reserva
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Investments Values */}
          {step === 4 && (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">04 — INVESTIMENTOS</p>
                <h2 className={`text-2xl font-black ${text}`}>Seus Investimentos</h2>
                <p className={`text-sm mt-1 ${sub}`}>Ações, FIIs, Cripto ou CDBs.</p>
              </div>
              
              <div className="space-y-4">
                {investments.map((inv, idx) => (
                  <div key={inv.id} className={`p-5 rounded-2xl border relative ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    {investments.length > 1 && (
                      <button onClick={() => removeInvestment(inv.id)} className="absolute top-4 right-4 text-rose-500 hover:text-rose-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <label className={`text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${sub}`}>
                      <TrendingUp className="w-4 h-4 text-emerald-500" /> Ativo {idx + 1}
                    </label>
                    <div className="grid grid-cols-1 gap-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <span className={`text-[10px] font-bold uppercase ${sub} mb-1 block`}>Categoria</span>
                            <select 
                              value={inv.type} 
                              onChange={e => updateInvestment(inv.id, 'type', e.target.value)} 
                              className={`w-full p-4 rounded-2xl border text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-emerald-500/40 appearance-none ${isDark ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                            >
                              <option value="acoes">Ações</option>
                              <option value="crypto">Criptomoedas</option>
                              <option value="fiis">Fundos Imobiliários (FIIs)</option>
                              <option value="etfs">ETFs</option>
                              <option value="renda_fixa">Renda Fixa</option>
                              <option value="imoveis">Imóveis</option>
                            </select>
                          </div>
                          <div>
                            <span className={`text-[10px] font-bold uppercase ${sub} mb-1 block`}>Ticker/Símbolo</span>
                            <input type="text" value={inv.ticker} onChange={e => updateInvestment(inv.id, 'ticker', e.target.value.toUpperCase())} placeholder="Ex: VALE3, AAPL..." className={inputCls} />
                            <p className="text-[9px] text-slate-500 mt-1.5 font-medium leading-tight">Símbolo oficial para atualizar o preço automático.</p>
                          </div>
                          <div>
                            <span className={`text-[10px] font-bold uppercase ${sub} mb-1 block`}>Nome</span>
                            <input type="text" value={inv.name} onChange={e => updateInvestment(inv.id, 'name', e.target.value)} placeholder="Ex: Ações Vale" className={inputCls} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className={`text-[10px] font-bold uppercase ${sub} mb-1 block`}>Quantidade</span>
                            <input type="number" step="any" value={inv.quantity} onChange={e => updateInvestment(inv.id, 'quantity', e.target.value)} placeholder="Ex: 100" className={inputCls} />
                          </div>
                          <div>
                            <span className={`text-[10px] font-bold uppercase ${sub} mb-1 block`}>Preço Médio</span>
                            <div className="relative">
                              <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black opacity-50 ${isDark ? 'text-white' : 'text-slate-800'}`}>{inv.isUSD ? '$' : 'R$'}</span>
                              <input type="number" step="any" value={inv.purchasePrice} onChange={e => updateInvestment(inv.id, 'purchasePrice', e.target.value)} placeholder="0.00" className={`${inputCls} pl-10`} />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <input 
                            type="checkbox" 
                            id={`isUSD-${inv.id}`} 
                            checked={inv.isUSD} 
                            onChange={e => updateInvestment(inv.id, 'isUSD', e.target.checked)} 
                            className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/40 cursor-pointer"
                          />
                          <label htmlFor={`isUSD-${inv.id}`} className={`text-[11px] font-bold cursor-pointer ${sub}`}>Ativo dolarizado (preço em Dólar - USD)</label>
                        </div>
                    </div>
                  </div>
                ))}

                <button onClick={addInvestment} className={`w-full py-4 rounded-2xl border border-dashed flex items-center justify-center gap-2 text-sm font-bold transition-all ${isDark ? 'border-white/20 text-emerald-400 hover:bg-white/5' : 'border-slate-300 text-emerald-600 hover:bg-slate-50'}`}>
                  <Plus className="w-4 h-4" /> Adicionar outro ativo
                </button>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex flex-col gap-3 mt-4">
            <button 
              onClick={next} 
              disabled={isSaving || !canProceed()}
              className={`w-full py-5 rounded-2xl text-white font-black text-sm transition-all flex items-center justify-center gap-3 shadow-lg ${canProceed() ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.02] active:scale-[0.98] shadow-emerald-500/20' : 'bg-slate-600 opacity-50 cursor-not-allowed'}`}
            >
              {isSaving ? <span className="animate-spin">⏳</span> : step === totalSteps - 1 ? <><CheckCircle2 className="w-5 h-5" /> Concluir e Acessar</> : <>Próximo <ArrowRight className="w-5 h-5" /></>}
            </button>
            {step > 0 && (
              <button onClick={prev} disabled={isSaving} className={`mt-2 flex items-center justify-center gap-2 text-sm font-bold ${sub} hover:text-emerald-500 transition-colors`}>
                Voltar
              </button>
            )}
          </div>

        </div>
      </div>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display:none; }
        .scrollbar-hide { -ms-overflow-style:none; scrollbar-width:none; }
      `}</style>
    </div>
  );
}
