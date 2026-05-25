import React, { useState, useEffect } from 'react';
import { X, Save, CheckCircle2, Loader2, Target, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const OBJECTIVES = [
  { id: 'independence', label: 'Viver de Renda',      emoji: '🏝️', desc: 'Conquistar independência financeira e não depender de salário' },
  { id: 'start',       label: 'Começar a Investir',   emoji: '🌱', desc: 'Dar o primeiro passo e fazer o dinheiro trabalhar por você' },
  { id: 'debt',        label: 'Sair das Dívidas',     emoji: '🔓', desc: 'Organizar, quitar e manter as finanças no azul' },
  { id: 'goal',        label: 'Conquistar um Bem',    emoji: '🏠', desc: 'Casa, carro, viagem ou outro sonho' },
  { id: 'control',     label: 'Controle Total',       emoji: '🧘', desc: 'Visão completa do patrimônio e paz financeira' },
];

const RISK_PROFILES = [
  {
    id: 'conservative',
    label: 'Conservador',
    desc: 'Priorizo segurança. Prefiro Tesouro Direto, CDB e rendimento estável.',
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

const PatrimonioConfigForm = ({ onClose }) => {
  const { theme } = useTheme();
  const { saveUserPreferences, userPrefs } = useAuth();
  const [isSaving, setIsSaving]   = useState(false);
  const [objectives, setObjectives] = useState([]);
  const [riskProfile, setRiskProfile] = useState('');

  const isDark = theme !== 'light';
  const text = isDark ? 'text-white' : 'text-slate-900';
  const sub  = isDark ? 'text-slate-400' : 'text-slate-500';

  useEffect(() => {
    const onboarding = userPrefs?.onboarding || {};
    if (onboarding.objectives?.length > 0) setObjectives(onboarding.objectives);
    if (onboarding.riskProfile) setRiskProfile(onboarding.riskProfile);
  }, [userPrefs]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const currentOnboarding = userPrefs?.onboarding || {};
    await saveUserPreferences({
      hasSeenPatrimonyWelcome: true,
      onboarding: {
        ...currentOnboarding,
        objectives,
        riskProfile,
      },
    });
    setTimeout(() => {
      setIsSaving(false);
      if (onClose) onClose();
    }, 800);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button
          type="button"
          onClick={onClose}
          className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
        </button>
        <h3 className={`text-base font-black ${text}`}>Configurar Patrimônio</h3>
        <button
          type="button"
          onClick={onClose}
          className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-5">

        {/* ── Objetivos ── */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Target className="w-3.5 h-3.5 text-emerald-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Foco da Jornada</p>
            </div>
            <p className={`text-xs ${sub}`}>Qual é o seu objetivo com a construção de patrimônio? Pode escolher mais de um.</p>
          </div>
          <div className="flex flex-col gap-2">
            {OBJECTIVES.map(obj => {
              const active = objectives.includes(obj.id);
              return (
                <button
                  type="button"
                  key={obj.id}
                  onClick={() => setObjectives(prev => active ? prev.filter(o => o !== obj.id) : [...prev, obj.id])}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-200 ${
                    active
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : isDark ? 'border-white/10 bg-white/5 hover:border-white/20' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
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
        </div>

        {/* ── Perfil de risco ── */}
        <div className={`space-y-3 pt-4 border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Perfil de Investidor</p>
            </div>
            <p className={`text-xs ${sub}`}>Como a Alívia deve sugerir alocações do seu patrimônio? Pode alterar a qualquer momento.</p>
          </div>
          <div className="flex flex-col gap-2.5">
            {RISK_PROFILES.map(profile => {
              const active = riskProfile === profile.id;
              return (
                <button
                  type="button"
                  key={profile.id}
                  onClick={() => setRiskProfile(profile.id)}
                  className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200 ${
                    active
                      ? `border-emerald-500 bg-gradient-to-r ${profile.color}`
                      : isDark ? 'border-white/10 bg-white/5 hover:border-white/20' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
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

        {/* ── Ações ── */}
        <div className={`pt-4 border-t flex gap-3 ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm border transition-all ${
              isDark ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 py-3 rounded-xl font-semibold text-sm bg-emerald-700 hover:bg-emerald-600 text-white shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>

      </form>
    </div>
  );
};

export default PatrimonioConfigForm;
