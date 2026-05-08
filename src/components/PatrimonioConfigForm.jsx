import React, { useState, useEffect } from 'react';
import { Landmark, X, Save, CheckCircle2, Loader2, Target, ShieldCheck, Home, Gem, Pencil } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

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

const GOAL_TYPES = [
  { id: 'patrimonio_total', label: 'Total de Patrimônio', desc: 'Atingir um valor consolidado de patrimônio', emoji: '💎' },
  { id: 'imovel', label: 'Imóvel', desc: 'Juntar para comprar uma casa ou apartamento', emoji: '🏠' },
];

const PatrimonioConfigForm = ({ onClose }) => {
    const { theme } = useTheme();
    const { saveUserPreferences, userPrefs, currentUser } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [objectives, setObjectives] = useState([]);
    const [riskProfile, setRiskProfile] = useState('');
    
    // Goal state
    const [patrimonyGoals, setPatrimonyGoals] = useState([]);
    const [goalType, setGoalType] = useState('');
    const [goalValue, setGoalValue] = useState('');
    const [editingGoalId, setEditingGoalId] = useState(null);

    const isDark = theme !== 'light';
    const text = isDark ? 'text-white' : 'text-slate-900';
    const sub = isDark ? 'text-slate-400' : 'text-slate-500';
    const inputCls = `w-full p-4 rounded-2xl border text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-emerald-500/40 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white'}`;

    // Load existing data
    useEffect(() => {
        const onboarding = userPrefs?.onboarding || {};
        if (onboarding.objectives?.length > 0) setObjectives(onboarding.objectives);
        if (onboarding.riskProfile) setRiskProfile(onboarding.riskProfile);
    }, [userPrefs]);

    // Listen to patrimony goals
    useEffect(() => {
        if (!currentUser) return;
        const q = query(collection(db, 'goals'), where('userId', '==', currentUser.uid));
        return onSnapshot(q, snap => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setPatrimonyGoals(all.filter(g => g.isPatrimonyGoal && g.status === 'active'));
        });
    }, [currentUser]);

    const handleSaveGoal = async () => {
        if (!goalType || !goalValue || parseFloat(goalValue) <= 0) return;
        
        if (editingGoalId) {
            await updateDoc(doc(db, 'goals', editingGoalId), {
                title: goalType === 'imovel' ? 'Imóvel' : 'Meta de Patrimônio',
                target: parseFloat(goalValue),
                patrimonyGoalType: goalType,
            });
            setEditingGoalId(null);
        } else {
            await addDoc(collection(db, 'goals'), {
                userId: currentUser.uid,
                title: goalType === 'imovel' ? 'Imóvel' : 'Meta de Patrimônio',
                target: parseFloat(goalValue),
                current: 0,
                status: 'active',
                isPatrimonyGoal: true,
                patrimonyGoalType: goalType,
                linkedJarIds: [],
                linkedInvIds: [],
                createdAt: new Date().toISOString()
            });
        }
        setGoalType('');
        setGoalValue('');
    };

    const handleDeleteGoal = async (id) => {
        await deleteDoc(doc(db, 'goals', id));
    };

    const startEditGoal = (goal) => {
        setEditingGoalId(goal.id);
        setGoalType(goal.patrimonyGoalType || 'patrimonio_total');
        setGoalValue(goal.target?.toString() || '');
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const currentOnboarding = userPrefs?.onboarding || {};

        // Save goal if there's pending data
        if (goalType && goalValue && parseFloat(goalValue) > 0) {
            await handleSaveGoal();
        }

        await saveUserPreferences({
            hasSeenPatrimonyWelcome: true,
            onboarding: {
                ...currentOnboarding,
                objectives,
                riskProfile,
                patrimonyGoalType: goalType || currentOnboarding.patrimonyGoalType || '',
                patrimonyGoalValue: goalValue ? parseFloat(goalValue) : (currentOnboarding.patrimonyGoalValue || 0),
            }
        });

        setTimeout(() => {
            setIsSaving(false);
            if (onClose) onClose();
        }, 800);
    };

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

                {/* Objectives */}
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
                                    onClick={() => setObjectives(prev => active ? prev.filter(o => o !== obj.id) : [...prev, obj.id])}
                                    className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-300 ${
                                        active ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]' : isDark ? 'border-white/10 bg-white/5 hover:border-white/20' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
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

                {/* Risk Profile */}
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
                                        active ? `border-emerald-500 bg-gradient-to-r ${profile.color} text-white scale-[1.01]` : isDark ? 'border-white/10 bg-white/5 hover:border-white/20' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
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

                {/* Meta de Patrimônio */}
                <div className={`space-y-4 pt-6 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Gem className="w-4 h-4 text-emerald-500" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Meta de Patrimônio</p>
                        </div>
                        <p className={`text-sm ${sub}`}>Defina seu grande objetivo financeiro para acompanhar o progresso.</p>
                    </div>

                    {/* Existing Goals */}
                    {patrimonyGoals.length > 0 && (
                        <div className="space-y-3">
                            {patrimonyGoals.map(goal => (
                                <div key={goal.id} className={`p-4 rounded-2xl border flex items-center justify-between ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{goal.patrimonyGoalType === 'imovel' ? '🏠' : '💎'}</span>
                                        <div>
                                            <p className={`text-sm font-black ${text}`}>{goal.title}</p>
                                            <p className={`text-xs font-bold ${sub}`}>Alvo: R$ {(goal.target || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => startEditGoal(goal)} className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-white/10 text-slate-400 hover:text-blue-400' : 'hover:bg-slate-100 text-slate-400 hover:text-blue-500'}`}>
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button type="button" onClick={() => handleDeleteGoal(goal.id)} className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-rose-500/10 text-slate-400 hover:text-rose-400' : 'hover:bg-rose-50 text-slate-400 hover:text-rose-500'}`}>
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add/Edit Goal Form */}
                    {(patrimonyGoals.length === 0 || editingGoalId) && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {GOAL_TYPES.map(gt => {
                                    const active = goalType === gt.id;
                                    return (
                                        <button
                                            type="button"
                                            key={gt.id}
                                            onClick={() => setGoalType(active ? '' : gt.id)}
                                            className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all duration-300 ${
                                                active ? 'border-emerald-500 bg-emerald-500/10' : isDark ? 'border-white/10 bg-white/5 hover:border-white/20' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                                            }`}
                                        >
                                            <span className="text-xl">{gt.emoji}</span>
                                            <div>
                                                <p className={`font-black text-xs ${active ? 'text-emerald-500' : text}`}>{gt.label}</p>
                                                <p className={`text-[10px] ${sub}`}>{gt.desc}</p>
                                            </div>
                                            {active && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                            {goalType && (
                                <div className="animate-in fade-in duration-300">
                                    <span className={`text-[10px] font-bold uppercase ${sub} mb-1 block`}>Valor da Meta (R$)</span>
                                    <div className="flex gap-3">
                                        <input
                                            type="number"
                                            step="any"
                                            value={goalValue}
                                            onChange={e => setGoalValue(e.target.value)}
                                            placeholder={goalType === 'imovel' ? 'Ex: 350000' : 'Ex: 100000'}
                                            className={inputCls}
                                        />
                                        {editingGoalId && (
                                            <button type="button" onClick={handleSaveGoal} className="px-5 py-3 bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shrink-0 hover:bg-blue-400 transition-all">
                                                Atualizar
                                            </button>
                                        )}
                                    </div>
                                    {editingGoalId && (
                                        <button type="button" onClick={() => { setEditingGoalId(null); setGoalType(''); setGoalValue(''); }} className={`mt-2 text-xs font-bold ${sub} hover:text-emerald-500`}>
                                            Cancelar edição
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Button to add another goal */}
                    {patrimonyGoals.length > 0 && !editingGoalId && (
                        <button
                            type="button"
                            onClick={() => { setGoalType(''); setGoalValue(''); setEditingGoalId('new'); }}
                            className={`w-full py-3 rounded-2xl border border-dashed text-xs font-bold transition-all ${isDark ? 'border-white/20 text-emerald-400 hover:bg-white/5' : 'border-slate-300 text-emerald-600 hover:bg-slate-50'}`}
                        >
                            + Adicionar outra meta
                        </button>
                    )}
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
