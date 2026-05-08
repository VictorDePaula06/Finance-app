import React, { useState, useEffect } from 'react';
import { Landmark, X, Save, CheckCircle2, Loader2, Target, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

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

const PatrimonioConfigForm = ({ onClose }) => {
    const { theme } = useTheme();
    const { saveUserPreferences, userPrefs } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [objectives, setObjectives] = useState([]);
    const [riskProfile, setRiskProfile] = useState('');

    const isDark = theme !== 'light';
    const text = isDark ? 'text-white' : 'text-slate-900';
    const sub = isDark ? 'text-slate-400' : 'text-slate-500';

    // Load existing data from userPrefs
    useEffect(() => {
        const onboarding = userPrefs?.onboarding || {};
        if (onboarding.objectives?.length > 0) {
            setObjectives(onboarding.objectives);
        }
        if (onboarding.riskProfile) {
            setRiskProfile(onboarding.riskProfile);
        }
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
            }
        });

        setTimeout(() => {
            setIsSaving(false);
            if (onClose) onClose();
        }, 800);
    };

    const isConfigured = objectives.length > 0 && riskProfile !== '';

    return (
        <div className={`p-8 rounded-[2.5rem] border animate-in fade-in slide-in-from-bottom-4 duration-500 ${
            isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100 shadow-sm'
        }`}>
            {/* Header */}
            <div className={`flex justify-between items-center mb-8 border-b pb-6 ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                <h3 className={`text-xl font-black flex items-center gap-3 ${text}`}>
                    <Landmark className="w-6 h-6 text-emerald-500" />
                    Configurar Patrimônio
                </h3>
                {onClose && (
                    <button onClick={onClose} className={`p-2 rounded-xl transition-all ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                        <X className="w-6 h-6" />
                    </button>
                )}
            </div>

            <form onSubmit={handleSave} className="space-y-8">

                {/* STEP 1: Objectives */}
                <div className="space-y-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Target className="w-4 h-4 text-emerald-500" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Foco da Jornada</p>
                        </div>
                        <p className={`text-sm ${sub}`}>Qual é o seu objetivo com a construção de patrimônio? Pode escolher mais de um.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {OBJECTIVES.map(obj => {
                            const active = objectives.includes(obj.id);
                            return (
                                <button
                                    type="button"
                                    key={obj.id}
                                    onClick={() => {
                                        setObjectives(prev => active ? prev.filter(o => o !== obj.id) : [...prev, obj.id]);
                                    }}
                                    className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-300 ${
                                        active 
                                            ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]' 
                                            : isDark 
                                                ? 'border-white/10 bg-white/5 hover:border-white/20' 
                                                : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                                    }`}
                                >
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

                {/* STEP 2: Risk Profile */}
                <div className={`space-y-4 pt-6 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Perfil de Investidor</p>
                        </div>
                        <p className={`text-sm ${sub}`}>Como a Alívia deve sugerir alocações do seu patrimônio?</p>
                    </div>
                    <div className="flex flex-col gap-3">
                        {RISK_PROFILES.map(profile => {
                            const active = riskProfile === profile.id;
                            return (
                                <button
                                    type="button"
                                    key={profile.id}
                                    onClick={() => setRiskProfile(profile.id)}
                                    className={`flex items-center gap-4 p-5 rounded-2xl border text-left transition-all duration-300 ${
                                        active 
                                            ? `border-emerald-500 bg-gradient-to-r ${profile.color} text-white scale-[1.01]` 
                                            : isDark 
                                                ? 'border-white/10 bg-white/5 hover:border-white/20' 
                                                : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                                    }`}
                                >
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

                {/* Save Button */}
                <button
                    type="submit"
                    disabled={isSaving}
                    className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl flex items-center justify-center gap-3 ${
                        isSaving 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    }`}
                >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {isSaving ? 'Salvando...' : 'Salvar Configuração de Patrimônio'}
                </button>
            </form>
        </div>
    );
};

export default PatrimonioConfigForm;
