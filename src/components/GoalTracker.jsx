import React, { useState, useEffect, useMemo } from 'react';
import { Target, Plus, Edit2, Check, Trophy, History, Trash2, TrendingUp, Calendar, DollarSign, Activity, PiggyBank, Home, Gem, LineChart, Loader2, Save, X, ArrowRight } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { useCdiRate, useUsdRate } from '../utils/marketRates';
import TrialLimitModal from './TrialLimitModal';

const fmt = (v) => Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CDI_MEDIO_10A = 11.15;
const MONTHLY_RATE = Math.pow(1 + CDI_MEDIO_10A / 100, 1 / 12) - 1;
const fmtTime = (m) => m < 12 ? `${m} meses` : `${Math.floor(m/12)}a ${m%12}m`;

// Multi-select chip picker for jars and investments
function AssetPicker({ jars, investments, selectedJarIds, selectedInvIds, onToggleJar, onToggleInv }) {
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const hasAny = jars.length > 0 || investments.length > 0;
    if (!hasAny) return null;

    const chipBase = 'px-3 py-2 rounded-2xl border text-xs font-bold cursor-pointer transition-all select-none flex items-center gap-2';
    const active = isDark ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-emerald-100 border-emerald-400 text-emerald-700';
    const inactive = isDark ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100';

    return (
        <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
                Vincular ao Acumulado (Cofrinhos + Investimentos)
            </label>
            {jars.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {jars.map(j => {
                        const sel = selectedJarIds.includes(j.id);
                        return (
                            <button key={j.id} type="button" onClick={() => onToggleJar(j.id)}
                                className={`${chipBase} ${sel ? active : inactive}`}>
                                <PiggyBank className="w-3 h-3 shrink-0" />
                                <span>{j.name}</span>
                                <span className={`font-black ${sel ? '' : 'opacity-60'}`}>
                                    R$ {(j.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
            {investments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {investments.map(inv => {
                        const val = inv.quantity * (inv.manualCurrentPrice || inv.purchasePrice);
                        const sel = selectedInvIds.includes(inv.id);
                        return (
                            <button key={inv.id} type="button" onClick={() => onToggleInv(inv.id)}
                                className={`${chipBase} ${sel ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' : inactive}`}>
                                <TrendingUp className="w-3 h-3 shrink-0" />
                                <span>{inv.name}</span>
                                <span className={`font-black ${sel ? '' : 'opacity-60'}`}>
                                    R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
            {(selectedJarIds.length > 0 || selectedInvIds.length > 0) && (
                <p className={`text-[10px] font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    ✓ O acumulado será a soma dos itens selecionados, em tempo real.
                </p>
            )}
        </div>
    );
}

export default function GoalTracker() {
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const { currentUser, planLevel } = useAuth();
    const isFreePlan = planLevel === 'free';
    const FREE_GOAL_LIMIT = 1;
    const [showLimitModal, setShowLimitModal] = useState(false);

    const [goals, setGoals] = useState([]);
    const [jars, setJars] = useState([]);
    const [investments, setInvestments] = useState([]);
    const [isAdding, setIsAdding] = useState(false);

    // Form state (create)
    const [newTitle, setNewTitle] = useState('');
    const [newTarget, setNewTarget] = useState('');
    const [newDeadline, setNewDeadline] = useState('');
    const [newJarIds, setNewJarIds] = useState([]);
    const [newInvIds, setNewInvIds] = useState([]);

    // Edit state
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editTarget, setEditTarget] = useState('');
    const [editDeadline, setEditDeadline] = useState('');
    const [editJarIds, setEditJarIds] = useState([]);
    const [editInvIds, setEditInvIds] = useState([]);

    const [contributions, setContributions] = useState({});
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    // Simulation modal state
    const [simGoalId, setSimGoalId] = useState(null);
    const [simModalYears, setSimModalYears] = useState('');
    const [simModalAporte, setSimModalAporte] = useState('');
    const [simSaving, setSimSaving] = useState(false);

    // New goal type (patrimony or general)
    const [newIsPatrimony, setNewIsPatrimony] = useState(false);
    const [newPatrimonyType, setNewPatrimonyType] = useState('patrimonio_total');
    const cdiAnual = useCdiRate();
    const usdRate = useUsdRate();

    useEffect(() => {
        if (!currentUser) return;
        const q = query(collection(db, 'goals'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
        return onSnapshot(q, snap => setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, [currentUser]);

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

    const toggle = (arr, id) => arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];

    // CDI e USD vêm dos hooks compartilhados (cache global).

    // Patrimony total — exact same calculation as PatrimonioTab
    const { patrimonioTotal, jarsDynamic } = useMemo(() => {
        const now = new Date();
        let jarsTotal = 0;
        const dynamic = jars.map(j => {
            const cdiP = (j.cdiPercent || 100) / 100;
            const dailyRate = Math.pow(1 + (cdiAnual / 100) * cdiP, 1 / 365) - 1;
            const lastUpdate = j.updatedAt ? new Date(j.updatedAt) : (j.createdAt ? new Date(j.createdAt) : now);
            const diffDays = Math.max(0, (now - lastUpdate) / (1000 * 60 * 60 * 24));
            const dynBal = (j.balance || 0) * Math.pow(1 + dailyRate, diffDays);
            jarsTotal += dynBal;
            return { ...j, dynamicBalance: dynBal };
        });
        const invTotal = investments.reduce((acc, a) => {
            const price = parseFloat(a.manualCurrentPrice || a.purchasePrice) || 0;
            const qty = parseFloat(a.quantity) || 0;
            const usdMultiplier = a.isUSD ? (usdRate || 1) : 1;
            return acc + (qty * price * usdMultiplier);
        }, 0);
        return { patrimonioTotal: jarsTotal + invTotal, jarsDynamic: dynamic };
    }, [jars, investments, cdiAnual, usdRate]);

    // Resolve acumulado: patrimony goals use total patrimony, others use linked assets or manual
    const resolveGoalCurrent = (goal) => {
        if (goal.isPatrimonyGoal) return patrimonioTotal;
        const jarIds = goal.linkedJarIds || (goal.linkedJarId ? [goal.linkedJarId] : []);
        const invIds = goal.linkedInvIds || [];
        if (jarIds.length === 0 && invIds.length === 0) return goal.current;
        const jarSum = jarIds.reduce((s, id) => {
            const j = jarsDynamic.find(x => x.id === id);
            return s + (j?.dynamicBalance || 0);
        }, 0);
        const invSum = invIds.reduce((s, id) => {
            const inv = investments.find(x => x.id === id);
            if (!inv) return s;
            const usdMultiplier = inv.isUSD ? (usdRate || 1) : 1;
            const qty = parseFloat(inv.quantity) || 0;
            const price = parseFloat(inv.manualCurrentPrice || inv.purchasePrice) || 0;
            return s + (qty * price * usdMultiplier);
        }, 0);
        return jarSum + invSum;
    };

    const handleAddGoal = async (e) => {
        if (e) e.preventDefault();
        if (!newTitle || !newTarget) return;
        const goalData = {
            userId: currentUser.uid, title: newTitle,
            target: parseFloat(newTarget), current: 0, status: 'active',
            deadline: newDeadline || null,
            linkedJarIds: newJarIds, linkedInvIds: newInvIds,
            createdAt: new Date().toISOString()
        };
        if (newIsPatrimony) {
            goalData.isPatrimonyGoal = true;
            goalData.patrimonyGoalType = newPatrimonyType;
            goalData.title = newPatrimonyType === 'imovel' ? 'Imóvel' : (newTitle || 'Meta de Patrimônio');
        }
        await addDoc(collection(db, 'goals'), goalData);
        setNewTitle(''); setNewTarget(''); setNewDeadline('');
        setNewJarIds([]); setNewInvIds([]); setNewIsPatrimony(false);
        setIsAdding(false);
    };

    const handleUpdateGoal = async (e) => {
        if (e) e.preventDefault();
        if (!editTitle || !editTarget || !editingId) return;
        await updateDoc(doc(db, 'goals', editingId), {
            title: editTitle, target: parseFloat(editTarget),
            deadline: editDeadline || null,
            linkedJarIds: editJarIds, linkedInvIds: editInvIds
        });
        setEditingId(null);
    };

    const handleContribute = async (goalId, currentAmount, mult = 1) => {
        const val = parseFloat(contributions[goalId]);
        if (!val || !isFinite(val)) return;
        const safeCurrent = parseFloat(currentAmount) || 0;
        let next = safeCurrent + val * mult;
        if (!isFinite(next) || next < 0) next = 0;
        await updateDoc(doc(db, 'goals', goalId), { current: next });
        setContributions(p => ({ ...p, [goalId]: '' }));
    };

    const handleDelete = async (id) => { await deleteDoc(doc(db, 'goals', id)); setDeleteConfirmId(null); };
    const toggleStatus = async (g) => updateDoc(doc(db, 'goals', g.id), { status: g.status === 'active' ? 'completed' : 'active' });

    // Simulation helpers
    const openSimModal = (goal, isEdit = false) => {
        setSimGoalId(goal.id);
        if (isEdit && goal.simYears && goal.simAporte) {
            setSimModalYears(String(goal.simYears));
            const v = parseFloat(String(goal.simAporte).replace(/\D/g, '')) / 100;
            setSimModalAporte(v.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
        } else {
            setSimModalYears('');
            setSimModalAporte('');
        }
    };
    const handleSaveSim = async () => {
        if (!simGoalId || !simModalYears || !simModalAporte) return;
        setSimSaving(true);
        try {
            await updateDoc(doc(db, 'goals', simGoalId), { simYears: simModalYears, simAporte: simModalAporte });
            setSimGoalId(null);
        } catch (e) { console.error(e); }
        setSimSaving(false);
    };
    const handleDeleteSim = async (goalId) => {
        try {
            const { deleteField } = await import('firebase/firestore');
            await updateDoc(doc(db, 'goals', goalId), { simYears: deleteField(), simAporte: deleteField() });
        } catch (e) { console.error(e); }
    };

    const sortedGoals = useMemo(() => {
        return [...goals].sort((a, b) => {
            if (a.status === 'active' && b.status === 'completed') return -1;
            if (a.status === 'completed' && b.status === 'active') return 1;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
    }, [goals]);

    const stats = useMemo(() => {
        const active = goals.filter(g => g.status === 'active');
        const totalTarget = active.reduce((a, g) => a + g.target, 0);
        const totalCurrent = active.reduce((a, g) => a + resolveGoalCurrent(g), 0);
        return { totalTarget, totalCurrent, progress: totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0 };
    }, [goals, jars, investments]);

    const card = theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-[#151822] border-white/5';
    const inp = `w-full px-3 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
        theme === 'light'
            ? 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
            : 'bg-white/5 border-white/10 text-white placeholder-slate-500'
    }`;

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className={`text-2xl md:text-3xl font-black tracking-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Metas & Objetivos</h2>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">Planeje e acompanhe seus alvos de curto, médio e longo prazo</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-500">Atualizado recentemente</span>
                </div>
            </div>

            {/* Top Pill Dashboard */}
            <div className={`flex flex-wrap items-center gap-6 md:gap-12 p-5 rounded-2xl border ${theme === 'light' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-[#151822] border-white/5 text-white'}`}>
                <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">Total Planejado <Target className="w-3.5 h-3.5 text-slate-400" /></span>
                    <span className="text-xl font-black">
                        R$ {stats.totalTarget.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">Total Acumulado <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /></span>
                    <span className="text-xl font-black text-emerald-400">
                        R$ {stats.totalCurrent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
                <div className="flex flex-col flex-1 min-w-[200px]">
                    <span className="text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">Progresso Geral <Activity className="w-3.5 h-3.5 text-blue-400" /></span>
                    <div className="flex items-center gap-3">
                        <span className="text-xl font-black text-blue-400">
                            {stats.progress.toFixed(1)}%
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/10 relative overflow-hidden mt-1">
                            <div className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-1000" style={{ width: `${Math.min(stats.progress, 100)}%` }}></div>
                        </div>
                    </div>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    <button
                        onClick={() => {
                            const activeGoalsCount = goals.filter(g => g.status === 'active').length;
                            if (isFreePlan && activeGoalsCount >= FREE_GOAL_LIMIT) {
                                setShowLimitModal(true);
                                return;
                            }
                            setIsAdding(true);
                        }}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95"
                    >
                        <Plus className="w-3.5 h-3.5" /> Adicionar
                    </button>
                </div>
            </div>

            <div className="min-h-[400px]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-500">
                    {sortedGoals.length === 0 ? (
                        <div className="col-span-full text-center py-20 opacity-50">
                            <Target className="w-12 h-12 mx-auto mb-4" />
                            <p className="text-sm font-bold">Nenhuma meta cadastrada.</p>
                        </div>
                    ) : sortedGoals.map(goal => {
                            const current = resolveGoalCurrent(goal);
                            const remaining = Math.max(0, goal.target - current);
                            const pct = Math.min((current / goal.target) * 100, 100).toFixed(1);
                            const done = current >= goal.target || goal.status === 'completed';
                            const jarIds = goal.linkedJarIds || (goal.linkedJarId ? [goal.linkedJarId] : []);
                            const invIds = goal.linkedInvIds || [];
                            const linked = jars.filter(j => jarIds.includes(j.id));
                            const linkedInv = investments.filter(i => invIds.includes(i.id));
                            const isLinked = linked.length > 0 || linkedInv.length > 0;
                            const GoalIcon = goal.isPatrimonyGoal ? (goal.patrimonyGoalType === 'imovel' ? Home : Gem) : Trophy;
                            const goalLabel = goal.isPatrimonyGoal ? (goal.patrimonyGoalType === 'imovel' ? 'Meta: Imóvel' : 'Meta de Patrimônio') : null;

                            return (
                                <div key={goal.id} className={`p-4 md:p-5 rounded-2xl border transition-all group relative flex flex-col overflow-hidden ${
                                    done ? (isDark ? 'bg-gradient-to-r from-emerald-950/40 to-teal-950/30 border-emerald-500/30' : 'bg-gradient-to-r from-emerald-50 to-teal-50/50 border-emerald-200 shadow-sm')
                                    : goal.isPatrimonyGoal ? (isDark ? 'bg-gradient-to-r from-slate-900 to-blue-950/40 border-white/[0.06]' : 'bg-gradient-to-r from-white to-blue-50/50 border-slate-200 shadow-sm')
                                    : (isDark ? 'bg-slate-900/80 border-white/[0.06]' : 'bg-white border-slate-100 shadow-sm')
                                }`}>
                                    <div className={`absolute top-[-50%] right-[-15%] w-[40%] h-[120%] rounded-full blur-[80px] pointer-events-none opacity-10 ${done ? 'bg-emerald-400' : goal.isPatrimonyGoal ? 'bg-blue-500' : 'bg-emerald-500'}`} />

                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`p-2 rounded-xl ${done ? 'bg-emerald-500/20' : goal.isPatrimonyGoal ? (isDark ? 'bg-blue-500/15' : 'bg-blue-100') : 'bg-emerald-500/10'}`}>
                                                    <GoalIcon className={`w-4 h-4 ${done ? 'text-emerald-400' : goal.isPatrimonyGoal ? (isDark ? 'text-blue-400' : 'text-blue-500') : (isDark ? 'text-emerald-400' : 'text-emerald-500')}`} />
                                                </div>
                                                <div>
                                                    {goalLabel && <p className={`text-[9px] font-black uppercase tracking-[0.15em] ${done ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : isDark ? 'text-blue-400' : 'text-blue-500'}`}>{goalLabel}</p>}
                                                    <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{goal.title}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {done && <span className={`px-3 py-1 rounded-full bg-emerald-500/20 ${isDark ? 'text-emerald-400' : 'text-emerald-700'} text-[9px] font-black uppercase tracking-widest animate-pulse`}>✨ Alcançada!</span>}
                                                <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setEditingId(goal.id); setEditTitle(goal.title); setEditTarget(goal.target); setEditDeadline(goal.deadline || ''); setEditJarIds(jarIds); setEditInvIds(invIds); }}
                                                        className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-white/5 text-slate-500 hover:text-emerald-400' : 'hover:bg-slate-100 text-slate-400 hover:text-emerald-500'}`}><Edit2 className="w-3.5 h-3.5" /></button>
                                                    <button onClick={() => toggleStatus(goal)} className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-white/5 text-slate-500 hover:text-emerald-400' : 'hover:bg-slate-100 text-slate-400 hover:text-emerald-500'}`}><Check className="w-3.5 h-3.5" /></button>
                                                    <button onClick={() => setDeleteConfirmId(goal.id)} className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-white/5 text-slate-500 hover:text-rose-400' : 'hover:bg-slate-100 text-slate-400 hover:text-rose-500'}`}><Trash2 className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-4 gap-3 mb-3">
                                            <div>
                                                <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Alvo</p>
                                                <p className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>R$ {fmt(goal.target)}</p>
                                            </div>
                                            <div>
                                                <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Acumulado</p>
                                                <p className={`text-base font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>R$ {fmt(current)}</p>
                                            </div>
                                            <div>
                                                <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Faltam</p>
                                                <p className={`text-base font-black ${remaining > 0 ? (isDark ? 'text-amber-400' : 'text-amber-500') : (isDark ? 'text-emerald-400' : 'text-emerald-600')}`}>{remaining > 0 ? `R$ ${fmt(remaining)}` : '✔'}</p>
                                            </div>
                                            <div>
                                                <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Progresso</p>
                                                <p className={`text-base font-black ${done ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : goal.isPatrimonyGoal ? (isDark ? 'text-blue-400' : 'text-blue-550') : (isDark ? 'text-emerald-400' : 'text-emerald-600')}`}>{pct}%</p>
                                            </div>
                                        </div>

                                        {goal.deadline && (
                                            <p className={`text-[9px] font-bold flex items-center gap-1 mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                <Calendar className="w-3 h-3" /> Prazo: {new Date(goal.deadline + "T12:00:00").toLocaleDateString('pt-BR')}
                                            </p>
                                        )}

                                        <div className={`h-2 rounded-full overflow-hidden mb-3 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                                            <div className={`h-full rounded-full transition-all duration-1000 ${done ? 'bg-emerald-500' : goal.isPatrimonyGoal ? 'bg-gradient-to-r from-blue-500 to-emerald-500' : 'bg-emerald-400'}`} style={{ width: `${pct}%` }} />
                                        </div>
                                         {goal.status === 'active' && !done && current < goal.target && (() => {
                                             const savedYears = goal.simYears ? parseFloat(goal.simYears) : null;
                                             const savedAporte = goal.simAporte || null;
                                             const hasSavedSim = savedYears && savedAporte;
                                             const simMonths = savedYears ? Math.round(savedYears * 12) : 0;
                                             const simAporteVal = savedAporte ? parseFloat(String(savedAporte).replace(/\D/g, '')) / 100 : 0;
                                             const projectedValue = hasSavedSim ? current * Math.pow(1 + MONTHLY_RATE, simMonths) + simAporteVal * ((Math.pow(1 + MONTHLY_RATE, simMonths) - 1) / MONTHLY_RATE) : 0;
                                             const willReach = projectedValue >= goal.target;
                                             let monthsNeeded = null;
                                             if (simAporteVal > 0) {
                                                 for (let n = 1; n <= 600; n++) {
                                                     const fv = current * Math.pow(1 + MONTHLY_RATE, n) + simAporteVal * ((Math.pow(1 + MONTHLY_RATE, n) - 1) / MONTHLY_RATE);
                                                     if (fv >= goal.target) { monthsNeeded = n; break; }
                                                 }
                                             }
                                             return (
                                                 <>
                                                     {!hasSavedSim ? (
                                                         <button onClick={() => openSimModal(goal, false)}
                                                             className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all border ${isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'}`}>
                                                             <LineChart className="w-3.5 h-3.5" /> Planejar minha meta
                                                         </button>
                                                     ) : (
                                                         <div>
                                                             <div className="flex items-center justify-between mb-2">
                                                                 <div className={`flex items-baseline gap-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                                                     <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Seu Plano:</p>
                                                                     <p className="text-base font-black">
                                                                         R$ {fmt(simAporteVal)}<span className="text-[10px] font-bold opacity-70 ml-0.5">/mês</span>
                                                                     </p>
                                                                     <div className="w-px h-3 bg-current opacity-20"></div>
                                                                     <p className="text-[9px] font-black uppercase tracking-widest opacity-70">
                                                                         Por {savedYears} ano{savedYears !== 1 ? 's' : ''} + CDI {CDI_MEDIO_10A}%
                                                                     </p>
                                                                 </div>
                                                                 <div className="flex items-center gap-1">
                                                                     <button onClick={() => openSimModal(goal, true)} className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-white/5 text-slate-500 hover:text-emerald-400' : 'hover:bg-slate-100 text-slate-400 hover:text-emerald-500'}`}><Edit2 className="w-3 h-3" /></button>
                                                                     <button onClick={() => handleDeleteSim(goal.id)} className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-white/5 text-slate-500 hover:text-rose-400' : 'hover:bg-slate-100 text-slate-400 hover:text-rose-500'}`}><Trash2 className="w-3 h-3" /></button>
                                                                 </div>
                                                             </div>
                                                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                                 <div className={`p-3 rounded-xl border ${willReach ? (isDark ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-emerald-50 border-emerald-100') : (isDark ? 'bg-amber-500/5 border-amber-500/15' : 'bg-amber-50 border-amber-100')}`}>
                                                                     <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${willReach ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-amber-400' : 'text-amber-600')}`}>Em {savedYears} ano{savedYears !== 1 ? 's' : ''}</p>
                                                                     <p className={`text-base font-black ${willReach ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-amber-400' : 'text-amber-600')}`}>R$ {fmt(projectedValue)}</p>
                                                                     <p className={`text-[8px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{willReach ? '✓ Meta atingida' : `Faltarão R$ ${fmt(goal.target - projectedValue)}`}</p>
                                                                 </div>
                                                                 <div className={`p-3 rounded-xl border ${isDark ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-emerald-50 border-emerald-100'}`}>
                                                                     <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Tempo estimado</p>
                                                                     <p className={`text-base font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{monthsNeeded ? fmtTime(monthsNeeded) : '–'}</p>
                                                                     <p className={`text-[8px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>CDI médio {CDI_MEDIO_10A}% a.a.</p>
                                                                 </div>
                                                                 <div className={`p-3 rounded-xl border ${isDark ? 'bg-purple-500/5 border-purple-500/15' : 'bg-purple-50 border-purple-100'}`}>
                                                                     <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>Faltam</p>
                                                                     <p className={`text-base font-black ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>R$ {fmt(remaining)}</p>
                                                                     <p className={`text-[8px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{((current / goal.target) * 100).toFixed(1)}% alcançado</p>
                                                                 </div>
                                                             </div>
                                                         </div>
                                                     )}
                                                 </>
                                             );
                                         })()}
 
                                         {goal.status === 'active' && !isLinked && !goal.isPatrimonyGoal && (
                                            <div className="flex gap-3 pt-2">
                                                <div className="flex-1 relative">
                                                    <input type="number" placeholder="Adicionar valor..."
                                                        value={contributions[goal.id] || ''}
                                                        onChange={e => setContributions(p => ({ ...p, [goal.id]: e.target.value }))}
                                                        className={`w-full bg-transparent border-b-2 text-lg font-black focus:outline-none py-2 pl-8 ${isDark ? 'border-white/5 focus:border-emerald-500 text-white' : 'border-slate-100 focus:border-emerald-500 text-slate-800'}`}
                                                    />
                                                    <DollarSign className="w-5 h-5 absolute left-0 top-1/2 -translate-y-1/2 text-slate-500" />
                                                </div>
                                                <button onClick={() => handleContribute(goal.id, goal.current)}
                                                    className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black uppercase text-[10px] hover:scale-105 transition-transform shadow-lg shadow-emerald-500/20 active:scale-95">Salvar</button>
                                            </div>
                                        )}

                                        {(isLinked || goal.isPatrimonyGoal) && (
                                            <p className={`text-[10px] font-bold flex items-center gap-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                                ✓ {goal.isPatrimonyGoal ? 'Acumulado = patrimônio total em tempo real' : 'Acumulado sincronizado automaticamente'}
                                            </p>
                                        )}


                                    {deleteConfirmId === goal.id && (
                                        <div className={`absolute inset-0 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-8 text-center z-10 animate-in fade-in duration-300 ${
                                            isDark ? 'bg-slate-950/95 text-white' : 'bg-white/95 text-slate-800'
                                        }`}>
                                            <div className="max-w-[240px] w-full">
                                                <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <Trash2 className="w-8 h-8 text-rose-500" />
                                                </div>
                                                <p className={`font-black text-lg mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Excluir meta?</p>
                                                <p className={`text-[10px] mb-8 leading-relaxed ${isDark ? 'text-white/50' : 'text-slate-500'}`}>Esta ação removerá permanentemente o objetivo <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{goal.title}</span>.</p>
                                                <div className="flex gap-4">
                                                    <button onClick={() => setDeleteConfirmId(null)} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-colors ${
                                                        isDark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    }`}>Não</button>
                                                    <button onClick={() => handleDelete(goal.id)} className="flex-1 py-4 rounded-2xl bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-colors">Excluir</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {editingId === goal.id && (
                                        <div className={`absolute inset-0 backdrop-blur-md rounded-2xl p-5 z-20 animate-in zoom-in-95 overflow-y-auto ${
                                            isDark ? 'bg-slate-950/95 text-white' : 'bg-white/95 text-slate-800'
                                        }`}>
                                            <h4 className={`font-black text-lg mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                                <Edit2 className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} /> Editar Meta
                                            </h4>
                                            <form onSubmit={handleUpdateGoal} className="space-y-4">
                                                <div>
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Título</label>
                                                    <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Título"
                                                        className={`w-full p-3 rounded-xl border text-xs font-bold outline-none transition-all ${
                                                            isDark ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500 focus:bg-white'
                                                        }`}
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Alvo R$</label>
                                                        <input type="number" value={editTarget} onChange={e => setEditTarget(e.target.value)} placeholder="Alvo R$"
                                                            className={`w-full p-3 rounded-xl border text-xs font-bold outline-none transition-all ${
                                                                isDark ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500 focus:bg-white'
                                                            }`}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Prazo</label>
                                                        <input type="date" value={editDeadline} min="2020-01-01" max="2099-12-31" onChange={e => setEditDeadline(e.target.value)}
                                                            className={`w-full p-3 rounded-xl border text-xs font-bold outline-none transition-all ${
                                                                isDark ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500 focus:bg-white'
                                                            }`}
                                                        />
                                                    </div>
                                                </div>
                                                {!goal.isPatrimonyGoal && (
                                                    <AssetPicker
                                                        jars={jars} investments={investments}
                                                        selectedJarIds={editJarIds} selectedInvIds={editInvIds}
                                                        onToggleJar={id => setEditJarIds(p => toggle(p, id))}
                                                        onToggleInv={id => setEditInvIds(p => toggle(p, id))}
                                                    />
                                                )}
                                                <div className="flex gap-3 pt-2">
                                                    <button type="button" onClick={() => setEditingId(null)} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors ${
                                                        isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                    }`}>Cancelar</button>
                                                    <button type="submit" className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors ${
                                                        isDark ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-900' : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                                                    }`}>Salvar</button>
                                                </div>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                </div>
            </div>

            {/* ── GOAL SIMULATOR MODAL ── */}
            {simGoalId && (() => {
                const simGoal = goals.find(g => g.id === simGoalId);
                if (!simGoal) return null;
                const simCurrent = resolveGoalCurrent(simGoal);
                return (
                    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setSimGoalId(null)}>
                        <div onClick={(e) => e.stopPropagation()}
                            className={`relative w-full max-w-md rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500 overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                            {/* Header */}
                            <div className={`p-6 pb-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-xl ${isDark ? 'bg-emerald-500/15' : 'bg-emerald-100'}`}>
                                            <LineChart className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                                        </div>
                                        <div>
                                            <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Planejar Meta</h3>
                                            <p className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{simGoal.title} — R$ {fmt(simGoal.target)}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setSimGoalId(null)} className={`p-2 rounded-xl ${isDark ? 'text-slate-500 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-50'}`}><X className="w-5 h-5" /></button>
                                </div>
                            </div>
                            {/* Body */}
                            <div className="p-6 space-y-5">
                                <div className="space-y-4">
                                    <div>
                                        <label className={`text-[9px] font-black uppercase tracking-widest block mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Em quantos anos quer atingir?</label>
                                        <input type="number" min="1" max="50" step="0.5" value={simModalYears} onChange={(e) => setSimModalYears(e.target.value)} placeholder="Ex: 5"
                                            className={`w-full px-4 py-3.5 rounded-2xl text-lg font-black border-2 outline-none transition-all focus:ring-2 ${isDark ? 'bg-slate-800 border-white/10 text-white focus:border-emerald-500 focus:ring-emerald-500/20 placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500 focus:ring-emerald-500/10 placeholder:text-slate-300'}`} />
                                    </div>
                                    <div>
                                        <label className={`text-[9px] font-black uppercase tracking-widest block mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Quanto pode investir por mês? (R$)</label>
                                        <input type="text" inputMode="numeric" value={simModalAporte}
                                            onChange={(e) => { const raw = e.target.value.replace(/\D/g, ''); if (!raw) { setSimModalAporte(''); return; } setSimModalAporte((parseInt(raw) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })); }}
                                            placeholder="Ex: 500,00"
                                            className={`w-full px-4 py-3.5 rounded-2xl text-lg font-black border-2 outline-none transition-all focus:ring-2 ${isDark ? 'bg-slate-800 border-white/10 text-white focus:border-emerald-500 focus:ring-emerald-500/20 placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500 focus:ring-emerald-500/10 placeholder:text-slate-300'}`} />
                                    </div>
                                </div>
                                {/* Live Preview */}
                                {simModalYears && simModalAporte && (() => {
                                    const pm = Math.round(parseFloat(simModalYears) * 12);
                                    const pa = parseFloat(simModalAporte.replace(/\D/g, '')) / 100;
                                    const pfv = simCurrent * Math.pow(1 + MONTHLY_RATE, pm) + pa * ((Math.pow(1 + MONTHLY_RATE, pm) - 1) / MONTHLY_RATE);
                                    const pw = pfv >= simGoal.target;
                                    let pt = null;
                                    for (let n = 1; n <= 600; n++) { const fv = simCurrent * Math.pow(1 + MONTHLY_RATE, n) + pa * ((Math.pow(1 + MONTHLY_RATE, n) - 1) / MONTHLY_RATE); if (fv >= simGoal.target) { pt = n; break; } }
                                    return (
                                        <div className={`p-4 rounded-2xl border ${pw ? (isDark ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-emerald-50 border-emerald-100') : (isDark ? 'bg-amber-500/5 border-amber-500/15' : 'bg-amber-50 border-amber-100')}`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <p className={`text-[9px] font-black uppercase tracking-widest ${pw ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-amber-400' : 'text-amber-600')}`}>Projeção</p>
                                                {pt && <p className={`text-[9px] font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Meta em {fmtTime(pt)}</p>}
                                            </div>
                                            <p className={`text-2xl font-black ${pw ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-amber-400' : 'text-amber-600')}`}>R$ {fmt(pfv)}</p>
                                            <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{pw ? `✓ Você ultrapassa a meta de R$ ${fmt(simGoal.target)}` : `Faltarão R$ ${fmt(simGoal.target - pfv)} — aumente prazo ou aporte`}</p>
                                        </div>
                                    );
                                })()}
                            </div>
                            {/* Footer */}
                            <div className={`p-6 pt-4 border-t flex gap-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                                <button onClick={() => setSimGoalId(null)} className={`flex-1 py-3 rounded-2xl text-sm font-black transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}>Cancelar</button>
                                <button onClick={handleSaveSim} disabled={!simModalYears || !simModalAporte || simSaving}
                                    className={`flex-1 py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all ${simModalYears && simModalAporte && !simSaving ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 active:scale-95' : isDark ? 'bg-white/5 text-slate-600 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                                    {simSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {simSaving ? 'Salvando...' : 'Salvar Plano'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Modal: Adicionar Nova Meta */}
            {isAdding && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-3">
                    <div className={`w-full max-w-xl rounded-2xl p-6 border shadow-2xl animate-in zoom-in-95 duration-300 max-h-[96vh] overflow-y-auto scrollbar-hide ${
                        theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'
                    }`}>
                        {/* Header */}
                        <div className="flex items-center justify-between mb-1">
                            <button type="button" onClick={() => { setIsAdding(false); setNewTitle(''); setNewTarget(''); setNewDeadline(''); setNewJarIds([]); setNewInvIds([]); setNewIsPatrimony(false); }}
                                className={`p-1.5 rounded-lg transition-colors ${theme === 'light' ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100' : 'text-slate-500 hover:text-slate-300 hover:bg-white/10'}`}>
                                <ArrowRight className="w-4 h-4 rotate-180" />
                            </button>
                            <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Nova Meta & Objetivo</h3>
                            <button onClick={() => { setIsAdding(false); setNewTitle(''); setNewTarget(''); setNewDeadline(''); setNewJarIds([]); setNewInvIds([]); setNewIsPatrimony(false); }}
                                className={`p-1.5 rounded-lg transition-colors ${theme === 'light' ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100' : 'text-slate-500 hover:text-slate-300 hover:bg-white/10'}`}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className={`text-xs font-medium mb-5 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                            Planeje e acompanhe seus alvos financeiros.
                        </p>

                        <form onSubmit={handleAddGoal} className="space-y-3">
                            {/* Goal Type Selector */}
                            <div>
                                <label className={`text-[10px] font-semibold mb-1.5 block ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Tipo de Meta</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button type="button" onClick={() => setNewIsPatrimony(false)}
                                        className={`p-3 rounded-xl border text-left transition-all ${!newIsPatrimony ? 'border-emerald-500 bg-emerald-500/10' : isDark ? 'border-white/10 bg-white/5 hover:border-white/20' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                                        <div className="flex items-center gap-2">
                                            <Trophy className={`w-4 h-4 ${!newIsPatrimony ? 'text-emerald-500' : 'text-slate-400'}`} />
                                            <div>
                                                <p className={`text-xs font-bold ${!newIsPatrimony ? 'text-emerald-600' : isDark ? 'text-white' : 'text-slate-700'}`}>Pessoal</p>
                                                <p className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Viagem, carro...</p>
                                            </div>
                                        </div>
                                    </button>
                                    <button type="button" onClick={() => setNewIsPatrimony(true)}
                                        className={`p-3 rounded-xl border text-left transition-all ${newIsPatrimony ? 'border-blue-500 bg-blue-500/10' : isDark ? 'border-white/10 bg-white/5 hover:border-white/20' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                                        <div className="flex items-center gap-2">
                                            <Gem className={`w-4 h-4 ${newIsPatrimony ? 'text-blue-400' : 'text-slate-400'}`} />
                                            <div>
                                                <p className={`text-xs font-bold ${newIsPatrimony ? 'text-blue-500' : isDark ? 'text-white' : 'text-slate-700'}`}>Patrimônio</p>
                                                <p className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Total, imóvel...</p>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Patrimony subtype */}
                            {newIsPatrimony && (
                                <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-300">
                                    {[{ id: 'patrimonio_total', label: 'Total de Patrimônio', emoji: '💎' }, { id: 'imovel', label: 'Imóvel', emoji: '🏠' }].map(gt => (
                                        <button key={gt.id} type="button" onClick={() => setNewPatrimonyType(gt.id)}
                                            className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 ${newPatrimonyType === gt.id ? 'border-blue-500 bg-blue-500/10' : isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
                                            <span className="text-sm">{gt.emoji}</span>
                                            <span className={`text-[10px] font-semibold ${newPatrimonyType === gt.id ? 'text-blue-500' : isDark ? 'text-white' : 'text-slate-700'}`}>{gt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div>
                                <label className={`text-[10px] font-semibold mb-1 block ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Nome da Meta</label>
                                <input type="text" placeholder={newIsPatrimony ? (newPatrimonyType === 'imovel' ? 'Ex: Meu Apartamento' : 'Ex: Meta de Patrimônio') : 'Ex: Viagem, Carro, Reserva...'} value={newTitle} onChange={e => setNewTitle(e.target.value)} className={inp} />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={`text-[10px] font-semibold mb-1 block ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Valor Alvo (R$)</label>
                                    <input type="number" placeholder={newIsPatrimony ? (newPatrimonyType === 'imovel' ? '350000' : '100000') : '0,00'} value={newTarget} onChange={e => setNewTarget(e.target.value)} className={inp} />
                                </div>
                                <div>
                                    <label className={`text-[10px] font-semibold mb-1 block ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Prazo</label>
                                    <input type="date" value={newDeadline} min="2020-01-01" max="2099-12-31" onChange={e => setNewDeadline(e.target.value)} className={inp} />
                                </div>
                            </div>

                            {!newIsPatrimony && (
                                <AssetPicker
                                    jars={jars} investments={investments}
                                    selectedJarIds={newJarIds} selectedInvIds={newInvIds}
                                    onToggleJar={id => setNewJarIds(p => toggle(p, id))}
                                    onToggleInv={id => setNewInvIds(p => toggle(p, id))}
                                />
                            )}

                            {newIsPatrimony && (
                                <p className={`text-[10px] font-medium flex items-center gap-1.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                    <TrendingUp className="w-3.5 h-3.5" /> O acumulado será o seu patrimônio total em tempo real (reservas + investimentos).
                                </p>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => {
                                    setIsAdding(false);
                                    setNewTitle(''); setNewTarget(''); setNewDeadline('');
                                    setNewJarIds([]); setNewInvIds([]); setNewIsPatrimony(false);
                                }} className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all border ${theme === 'light' ? 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
                                    Cancelar
                                </button>
                                <button type="submit" className="flex-1 py-3 rounded-xl font-semibold text-sm bg-emerald-700 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-700/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                                    <Save className="w-4 h-4" />
                                    Criar Meta
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <TrialLimitModal
                isOpen={showLimitModal}
                onClose={() => setShowLimitModal(false)}
                limitMessage={`Você atingiu o limite de ${FREE_GOAL_LIMIT} meta ativa do Plano Gratuito. Faça upgrade para Premium e crie quantas metas quiser.`}
            />
        </div>
    );
}
