import React, { useState, useEffect, useMemo } from 'react';
import { Target, Plus, Pencil, Check, Trophy, History, Trash2, TrendingUp, Calendar, DollarSign, Activity, PiggyBank } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';

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
                                    R$ {(j.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                                    R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
    const { currentUser } = useAuth();

    const [goals, setGoals] = useState([]);
    const [jars, setJars] = useState([]);
    const [investments, setInvestments] = useState([]);
    const [activeTab, setActiveTab] = useState('active');

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

    // Resolve acumulado: soma cofrinhos + investimentos vinculados, ou valor manual
    const resolveGoalCurrent = (goal) => {
        const jarIds = goal.linkedJarIds || (goal.linkedJarId ? [goal.linkedJarId] : []);
        const invIds = goal.linkedInvIds || [];
        if (jarIds.length === 0 && invIds.length === 0) return goal.current;

        const jarSum = jarIds.reduce((s, id) => {
            const j = jars.find(x => x.id === id);
            return s + (j?.balance || 0);
        }, 0);
        const invSum = invIds.reduce((s, id) => {
            const inv = investments.find(x => x.id === id);
            if (!inv) return s;
            return s + inv.quantity * (inv.manualCurrentPrice || inv.purchasePrice);
        }, 0);
        return jarSum + invSum;
    };

    const handleAddGoal = async (e) => {
        if (e) e.preventDefault();
        if (!newTitle || !newTarget) return;
        await addDoc(collection(db, 'goals'), {
            userId: currentUser.uid, title: newTitle,
            target: parseFloat(newTarget), current: 0, status: 'active',
            deadline: newDeadline || null,
            linkedJarIds: newJarIds, linkedInvIds: newInvIds,
            createdAt: new Date().toISOString()
        });
        setNewTitle(''); setNewTarget(''); setNewDeadline('');
        setNewJarIds([]); setNewInvIds([]);
        setActiveTab('active');
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
        if (!val) return;
        let next = currentAmount + val * mult;
        if (next < 0) next = 0;
        await updateDoc(doc(db, 'goals', goalId), { current: next });
        setContributions(p => ({ ...p, [goalId]: '' }));
    };

    const handleDelete = async (id) => { await deleteDoc(doc(db, 'goals', id)); setDeleteConfirmId(null); };
    const toggleStatus = async (g) => updateDoc(doc(db, 'goals', g.id), { status: g.status === 'active' ? 'completed' : 'active' });

    const filteredGoals = goals.filter(g => g.status === (activeTab === 'active' ? 'active' : 'completed'));

    const stats = useMemo(() => {
        const active = goals.filter(g => g.status === 'active');
        const totalTarget = active.reduce((a, g) => a + g.target, 0);
        const totalCurrent = active.reduce((a, g) => a + resolveGoalCurrent(g), 0);
        return { totalTarget, totalCurrent, progress: totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0 };
    }, [goals, jars, investments]);

    const card = isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100 shadow-sm';
    const inp = `w-full p-4 rounded-2xl border transition-all ${isDark ? 'bg-white/5 border-white/5 text-white focus:bg-white/10' : 'bg-slate-50 border-slate-200 focus:bg-white'} focus:outline-none`;

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Tabs */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className={`flex p-1.5 rounded-2xl border w-full md:w-auto ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100'}`}>
                    {[{ id: 'active', label: 'Em Andamento', icon: Target }, { id: 'history', label: 'Histórico', icon: History }, { id: 'new', label: 'Nova Meta', icon: Plus }].map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                            className={`flex-1 md:flex-none px-3 md:px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-tight md:tracking-widest transition-all flex items-center justify-center gap-1 md:gap-2 ${activeTab === t.id ? (isDark ? 'bg-emerald-500 text-white' : 'bg-emerald-400 text-white') : 'text-slate-500'}`}>
                            <t.icon className="w-3.5 h-3.5 md:w-4 md:h-4" />{t.label}
                        </button>
                    ))}
                </div>
                {activeTab !== 'new' && (
                    <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                        <Trophy className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{goals.filter(g => g.status === 'active').length} Objetivos Ativos</span>
                    </div>
                )}
            </div>

            {/* Stats */}
            {activeTab === 'active' && filteredGoals.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                    <div className={`p-5 md:p-8 rounded-[2rem] border ${card}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2"><Target className="w-3 h-3" /> Total Planejado</p>
                        <p className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>R$ {stats.totalTarget.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className={`p-5 md:p-8 rounded-[2rem] border ${card}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2 flex items-center gap-2"><TrendingUp className="w-3 h-3" /> Total Acumulado</p>
                        <p className="text-2xl font-black text-emerald-500">R$ {stats.totalCurrent.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className={`p-5 md:p-8 rounded-[2rem] border ${card}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2 flex items-center gap-2"><Activity className="w-3 h-3" /> Progresso Geral</p>
                        <div className="flex items-center gap-3">
                            <p className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{stats.progress.toFixed(1)}%</p>
                            <div className="flex-1 h-2 bg-slate-500/10 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${Math.min(stats.progress, 100)}%` }} /></div>
                        </div>
                    </div>
                </div>
            )}

            <div className="min-h-[400px]">
                {/* CREATE FORM */}
                {activeTab === 'new' ? (
                    <form onSubmit={handleAddGoal} className={`max-w-xl mx-auto p-6 md:p-8 rounded-[2.5rem] border shadow-2xl animate-in zoom-in-95 ${card}`}>
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4"><Target className="w-8 h-8 text-emerald-500" /></div>
                            <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Qual seu próximo objetivo?</h3>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1 mb-1 block">Nome da Meta</label>
                                <input type="text" placeholder="Ex: Viagem, Carro, Reserva..." value={newTitle} onChange={e => setNewTitle(e.target.value)} className={inp} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1 mb-1 block">Valor Alvo (R$)</label>
                                    <input type="number" placeholder="0.00" value={newTarget} onChange={e => setNewTarget(e.target.value)} className={inp} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1 mb-1 block">Prazo</label>
                                    <input type="date" value={newDeadline} min="2020-01-01" max="2099-12-31" onChange={e => setNewDeadline(e.target.value)} className={inp} />
                                </div>
                            </div>
                            <AssetPicker
                                jars={jars} investments={investments}
                                selectedJarIds={newJarIds} selectedInvIds={newInvIds}
                                onToggleJar={id => setNewJarIds(p => toggle(p, id))}
                                onToggleInv={id => setNewInvIds(p => toggle(p, id))}
                            />
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setActiveTab('active')} className={`flex-1 py-4 rounded-2xl font-bold text-xs ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>Cancelar</button>
                                <button type="submit" className="flex-1 py-4 rounded-2xl font-bold text-xs bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">Criar Meta</button>
                            </div>
                        </div>
                    </form>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-500">
                        {filteredGoals.length === 0 ? (
                            <div className="col-span-full text-center py-20 opacity-50">
                                <Target className="w-12 h-12 mx-auto mb-4" />
                                <p className="text-sm font-bold">Nenhuma meta {activeTab === 'active' ? 'em andamento' : 'concluída'}.</p>
                            </div>
                        ) : filteredGoals.map(goal => {
                            const current = resolveGoalCurrent(goal);
                            const pct = Math.min((current / goal.target) * 100, 100).toFixed(1);
                            const done = current >= goal.target;
                            const jarIds = goal.linkedJarIds || (goal.linkedJarId ? [goal.linkedJarId] : []);
                            const invIds = goal.linkedInvIds || [];
                            const linked = jars.filter(j => jarIds.includes(j.id));
                            const linkedInv = investments.filter(i => invIds.includes(i.id));
                            const isLinked = linked.length > 0 || linkedInv.length > 0;

                            return (
                                <div key={goal.id} className={`p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border transition-all group relative flex flex-col ${isDark ? 'bg-slate-900 border-white/5 hover:bg-white/10' : 'bg-white border-slate-100 hover:border-emerald-200 shadow-sm'}`}>
                                    <div className="flex justify-between items-start mb-8">
                                        <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center shrink-0">
                                            <Trophy className={`w-8 h-8 ${done ? 'text-emerald-500' : 'text-slate-400'}`} />
                                        </div>
                                        <div className="flex gap-1 md:gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingId(goal.id); setEditTitle(goal.title); setEditTarget(goal.target); setEditDeadline(goal.deadline || ''); setEditJarIds(jarIds); setEditInvIds(invIds); }}
                                                className="p-2 md:p-3 bg-white/5 hover:bg-blue-500/20 text-slate-500 hover:text-blue-400 rounded-xl"><Pencil className="w-4 h-4 md:w-5 md:h-5" /></button>
                                            <button onClick={() => toggleStatus(goal)} className="p-2 md:p-3 bg-white/5 hover:bg-emerald-500/20 text-slate-500 hover:text-emerald-400 rounded-xl"><Check className="w-4 h-4 md:w-5 md:h-5" /></button>
                                            <button onClick={() => setDeleteConfirmId(goal.id)} className="p-2 md:p-3 bg-white/5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded-xl"><Trash2 className="w-4 h-4 md:w-5 md:h-5" /></button>
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <h3 className={`font-black text-2xl ${isDark ? 'text-white' : 'text-slate-800'}`}>{goal.title}</h3>
                                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Alvo: R$ {goal.target.toLocaleString('pt-BR')}</span>
                                            {goal.deadline && <span className="text-xs font-black text-blue-500 flex items-center gap-1">• <Calendar className="w-3 h-3" /> {new Date(goal.deadline + "T12:00:00").toLocaleDateString('pt-BR')}</span>}
                                        </div>
                                        
                                        {/* Sugestão de Economia Mensal */}
                                        {activeTab === 'active' && goal.deadline && current < goal.target && (() => {
                                            const today = new Date();
                                            const [y, m, d] = goal.deadline.split('-').map(Number);
                                            const targetDate = new Date(y, m - 1, d);
                                            let months = (targetDate.getFullYear() - today.getFullYear()) * 12 + (targetDate.getMonth() - today.getMonth());
                                            if (months <= 0) months = targetDate >= today ? 1 : 0;
                                            const monthly = months > 0 ? (goal.target - current) / months : (goal.target - current);
                                            
                                            return monthly > 0 && (
                                                <div className={`mt-3 p-3 rounded-2xl border ${isDark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
                                                    <p className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Sugestão de Reserva</p>
                                                    <p className={`text-lg font-black ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>R$ {monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-[10px] opacity-70">/mês</span></p>
                                                </div>
                                            );
                                        })()}

                                        {isLinked && (
                                            <div className="flex flex-wrap gap-1 mt-3">
                                                {linked.map(j => <span key={j.id} className="text-[10px] font-bold bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full flex items-center gap-1"><PiggyBank className="w-3 h-3" />{j.name}</span>)}
                                                {linkedInv.map(i => <span key={i.id} className="text-[10px] font-bold bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full flex items-center gap-1"><TrendingUp className="w-3 h-3" />{i.name}</span>)}
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-auto space-y-5">
                                        <div>
                                            <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-3">
                                                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>R$ {current.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} acumulados</span>
                                                <span className="text-emerald-500">{pct}%</span>
                                            </div>
                                            <div className={`h-4 rounded-full overflow-hidden ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                                                <div className={`h-full transition-all duration-1000 shadow-[0_0_20px_rgba(16,185,129,0.3)] ${done ? 'bg-emerald-500' : 'bg-emerald-400'}`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>

                                        {activeTab === 'active' && !isLinked && (
                                            <div className="flex gap-3 pt-2">
                                                <div className="flex-1 relative">
                                                    <input type="number" placeholder="Adicionar valor..."
                                                        value={contributions[goal.id] || ''}
                                                        onChange={e => setContributions(p => ({ ...p, [goal.id]: e.target.value }))}
                                                        className={`w-full bg-transparent border-b-2 text-lg font-black focus:outline-none py-2 pl-8 ${isDark ? 'border-white/5 focus:border-emerald-500 text-white' : 'border-slate-100 focus:border-emerald-500'}`}
                                                    />
                                                    <DollarSign className="w-5 h-5 absolute left-0 top-1/2 -translate-y-1/2 text-slate-500" />
                                                </div>
                                                <button onClick={() => handleContribute(goal.id, goal.current)}
                                                    className="px-6 py-2 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] hover:scale-105 transition-transform shadow-lg shadow-emerald-500/20">Salvar</button>
                                            </div>
                                        )}

                                        {isLinked && (
                                            <p className={`text-[10px] font-bold flex items-center gap-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                                ✓ Acumulado sincronizado automaticamente
                                            </p>
                                        )}
                                    </div>

                                    {/* Delete overlay */}
                                    {deleteConfirmId === goal.id && (
                                        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-[2.5rem] flex flex-col items-center justify-center p-8 text-center z-10 animate-in fade-in duration-300">
                                            <div className="max-w-[240px] w-full">
                                                <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <Trash2 className="w-8 h-8 text-rose-500" />
                                                </div>
                                                <p className="text-white font-black text-lg mb-2">Excluir meta?</p>
                                                <p className="text-white/50 text-[10px] mb-8 leading-relaxed">Esta ação removerá permanentemente o objetivo <span className="text-white font-bold">{goal.title}</span>.</p>
                                                <div className="flex gap-4">
                                                    <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-4 rounded-2xl bg-white/10 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-colors">Não</button>
                                                    <button onClick={() => handleDelete(goal.id)} className="flex-1 py-4 rounded-2xl bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-colors">Excluir</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Edit overlay */}
                                    {editingId === goal.id && (
                                        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-[2.5rem] p-6 z-20 animate-in zoom-in-95 overflow-y-auto">
                                            <h4 className="text-white font-black text-xl mb-5 flex items-center gap-2"><Pencil className="w-5 h-5 text-blue-400" /> Editar Meta</h4>
                                            <form onSubmit={handleUpdateGoal} className="space-y-4">
                                                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Título" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-blue-500 outline-none" />
                                                <div className="grid grid-cols-2 gap-3">
                                                    <input type="number" value={editTarget} onChange={e => setEditTarget(e.target.value)} placeholder="Alvo R$" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-blue-500 outline-none" />
                                                    <input type="date" value={editDeadline} min="2020-01-01" max="2099-12-31" onChange={e => setEditDeadline(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-blue-500 outline-none" />
                                                </div>
                                                <AssetPicker
                                                    jars={jars} investments={investments}
                                                    selectedJarIds={editJarIds} selectedInvIds={editInvIds}
                                                    onToggleJar={id => setEditJarIds(p => toggle(p, id))}
                                                    onToggleInv={id => setEditInvIds(p => toggle(p, id))}
                                                />
                                                <div className="flex gap-3 mt-2">
                                                    <button type="button" onClick={() => setEditingId(null)} className="flex-1 py-3 rounded-xl bg-white/10 text-white font-black text-[9px]">Cancelar</button>
                                                    <button type="submit" className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-black text-[9px]">Salvar</button>
                                                </div>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
