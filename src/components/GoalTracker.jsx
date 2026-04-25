import React, { useState, useEffect, useMemo } from 'react';
import { Target, Plus, Pencil, Check, X, Trophy, History, Trash2, TrendingUp, Calendar, DollarSign, Activity } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';

export default function GoalTracker() {
    const { theme } = useTheme();
    const [goals, setGoals] = useState([]);
    const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history' | 'new'

    // New Goal State
    const [newTitle, setNewTitle] = useState('');
    const [newTarget, setNewTarget] = useState('');
    const [newDeadline, setNewDeadline] = useState('');

    // Edit State
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editTarget, setEditTarget] = useState('');
    const [editDeadline, setEditDeadline] = useState('');

    // Contribution State (keyed by goal ID)
    const [contributions, setContributions] = useState({});

    const { currentUser } = useAuth();

    // Load Goals Collection
    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, 'goals'),
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setGoals(docs);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const handleAddGoal = async (e) => {
        if (e) e.preventDefault();
        if (!newTitle || !newTarget) return;

        try {
            await addDoc(collection(db, 'goals'), {
                userId: currentUser.uid,
                title: newTitle,
                target: parseFloat(newTarget),
                current: 0,
                status: 'active',
                deadline: newDeadline || null,
                createdAt: new Date().toISOString()
            });
            setNewTitle('');
            setNewTarget('');
            setNewDeadline('');
            setActiveTab('active');
        } catch (error) {
            console.error("Error adding goal:", error);
        }
    };

    const handleUpdateGoal = async (e) => {
        if (e) e.preventDefault();
        if (!editTitle || !editTarget || !editingId) return;

        try {
            const goalRef = doc(db, 'goals', editingId);
            await updateDoc(goalRef, {
                title: editTitle,
                target: parseFloat(editTarget),
                deadline: editDeadline || null
            });
            setEditingId(null);
            setEditTitle('');
            setEditTarget('');
            setEditDeadline('');
        } catch (error) {
            console.error("Error updating goal:", error);
        }
    };

    const handleContribute = async (goalId, currentAmount, multiplier = 1) => {
        const val = parseFloat(contributions[goalId]);
        if (!val) return;

        try {
            let newCurrent = currentAmount + (val * multiplier);
            if (newCurrent < 0) newCurrent = 0;

            const goalRef = doc(db, 'goals', goalId);
            await updateDoc(goalRef, { current: newCurrent });
            setContributions(prev => ({ ...prev, [goalId]: '' }));
        } catch (error) {
            console.error("Error adding contribution:", error);
        }
    };

    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    const handleDelete = async (id) => {
        await deleteDoc(doc(db, 'goals', id));
        setDeleteConfirmId(null);
    };

    const toggleStatus = async (goal) => {
        const newStatus = goal.status === 'active' ? 'completed' : 'active';
        await updateDoc(doc(db, 'goals', goal.id), { status: newStatus });
    };

    const filteredGoals = goals.filter(g => g.status === (activeTab === 'active' ? 'active' : 'completed'));

    const stats = useMemo(() => {
        const active = goals.filter(g => g.status === 'active');
        const totalTarget = active.reduce((acc, g) => acc + g.target, 0);
        const totalCurrent = active.reduce((acc, g) => acc + g.current, 0);
        const progress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;
        return { totalTarget, totalCurrent, progress };
    }, [goals]);

    return (
        <div className="space-y-10 animate-in fade-in duration-700">

            {/* Header & Navigation Tabs */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className={`flex p-1.5 rounded-2xl border w-full md:w-auto shadow-sm ${
                    theme === 'light' ? 'bg-white border-slate-100' : 'bg-slate-900 border-white/5'
                }`}>
                    {[
                        { id: 'active', label: 'Em Andamento', icon: Target },
                        { id: 'history', label: 'Histórico', icon: History },
                        { id: 'new', label: 'Nova Meta', icon: Plus },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                activeTab === tab.id 
                                ? (theme === 'light' ? 'bg-emerald-400 text-white shadow-md' : 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20') 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab !== 'new' && (
                    <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                        <Trophy className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                            {goals.filter(g => g.status === 'active').length} Objetivos Ativos
                        </span>
                    </div>
                )}
            </div>

            {/* SUMMARY WIDGETS (Only for active tab) */}
            {activeTab === 'active' && filteredGoals.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 mb-8">
                    <div className={`p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                            <Target className="w-3 h-3" /> Total Planejado
                        </p>
                        <p className={`text-2xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                            R$ {stats.totalTarget.toLocaleString('pt-BR')}
                        </p>
                    </div>
                    <div className={`p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2 flex items-center gap-2">
                            <TrendingUp className="w-3 h-3" /> Total Acumulado
                        </p>
                        <p className={`text-2xl font-black text-emerald-500`}>
                            R$ {stats.totalCurrent.toLocaleString('pt-BR')}
                        </p>
                    </div>
                    <div className={`p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2 flex items-center gap-2">
                            <Activity className="w-3 h-3" /> Progresso Geral
                        </p>
                        <div className="flex items-center gap-3">
                            <p className={`text-2xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                {stats.progress.toFixed(1)}%
                            </p>
                            <div className="flex-1 h-2 bg-slate-500/10 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${stats.progress}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className="min-h-[400px]">
                {activeTab === 'new' ? (
                    <form onSubmit={handleAddGoal} className={`max-w-xl mx-auto p-6 md:p-8 rounded-[2.5rem] border shadow-2xl animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-slate-100' : 'bg-slate-900 border-white/5'
                    }`}>
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                <Target className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h3 className={`text-2xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Qual seu próximo objetivo?</h3>
                            <p className="text-xs text-slate-500 mt-2">Dê um nome e defina um valor para começar a poupar.</p>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Nome da Meta</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Carro Novo, Viagem, Reserva..."
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        className={`w-full p-4 rounded-2xl border transition-all ${
                                            theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-200' : 'bg-white/5 focus:bg-white/10 border-white/5 text-white'
                                        }`}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Valor Alvo (R$)</label>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            value={newTarget}
                                            onChange={(e) => setNewTarget(e.target.value)}
                                            className={`w-full p-4 rounded-2xl border transition-all ${
                                                theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-200' : 'bg-white/5 focus:bg-white/10 border-white/5 text-white'
                                            }`}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Prazo (Opcional)</label>
                                        <input
                                            type="date"
                                            value={newDeadline}
                                            min="2020-01-01"
                                            max="2099-12-31"
                                            onChange={(e) => setNewDeadline(e.target.value)}
                                            className={`w-full p-4 rounded-2xl border transition-all ${
                                                theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-200' : 'bg-white/5 focus:bg-white/10 border-white/5 text-white'
                                            }`}
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('active')}
                                    className={`flex-1 py-4 rounded-2xl font-bold text-xs ${theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-400'}`}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-4 rounded-2xl font-bold text-xs bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                                >
                                    Criar Meta
                                </button>
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
                        ) : (
                            filteredGoals.map(goal => {
                                const percentage = Math.min((goal.current / goal.target) * 100, 100).toFixed(1);
                                const isGoalCompleted = goal.current >= goal.target;

                                return (
                                    <div key={goal.id} className={`p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border transition-all group relative flex flex-col ${
                                        theme === 'light' 
                                        ? 'bg-white border-slate-100 hover:border-emerald-200 shadow-sm' 
                                        : 'bg-slate-900 border-white/5 hover:bg-white/10'
                                    }`}>
                                        <div className="flex justify-between items-start mb-8">
                                            <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center shrink-0">
                                                <Trophy className={`w-8 h-8 ${isGoalCompleted ? 'text-emerald-500' : 'text-slate-400'}`} />
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => {
                                                    setEditingId(goal.id);
                                                    setEditTitle(goal.title);
                                                    setEditTarget(goal.target);
                                                    setEditDeadline(goal.deadline || '');
                                                }} className="p-3 bg-white/5 hover:bg-blue-500/20 text-slate-500 hover:text-blue-400 rounded-xl transition-all"><Pencil className="w-5 h-5" /></button>
                                                <button onClick={() => toggleStatus(goal)} className="p-3 bg-white/5 hover:bg-emerald-500/20 text-slate-500 hover:text-emerald-400 rounded-xl transition-all"><Check className="w-5 h-5" /></button>
                                                <button onClick={() => setDeleteConfirmId(goal.id)} className="p-3 bg-white/5 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
                                            </div>
                                        </div>

                                        <div className="mb-8">
                                            <h3 className={`font-black text-2xl ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{goal.title}</h3>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Alvo: R$ {goal.target.toLocaleString('pt-BR')}</span>
                                                {goal.deadline && (
                                                    <span className="text-xs font-black text-blue-500 uppercase tracking-widest flex items-center gap-1">
                                                        • <Calendar className="w-3 h-3" /> {new Date(goal.deadline + "T12:00:00").toLocaleDateString('pt-BR')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-auto space-y-6">
                                            <div>
                                                <div className="flex justify-between text-xs font-black uppercase tracking-widest mb-3">
                                                    <span className={theme === 'light' ? 'text-slate-400' : 'text-slate-500'}>R$ {goal.current.toLocaleString('pt-BR')} acumulados</span>
                                                    <span className="text-emerald-500">{percentage}%</span>
                                                </div>
                                                <div className={`h-4 rounded-full overflow-hidden ${theme === 'light' ? 'bg-slate-100' : 'bg-white/5'}`}>
                                                    <div
                                                        className={`h-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(16,185,129,0.3)] ${isGoalCompleted ? 'bg-emerald-500' : 'bg-emerald-400'}`}
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {activeTab === 'active' && (
                                                <div className="flex gap-3 pt-2">
                                                    <div className="flex-1 relative">
                                                        <input
                                                            type="number"
                                                            placeholder="Adicionar valor..."
                                                            value={contributions[goal.id] || ''}
                                                            onChange={(e) => setContributions(prev => ({ ...prev, [goal.id]: e.target.value }))}
                                                            className={`w-full bg-transparent border-b-2 text-lg font-black focus:outline-none transition-all py-2 pl-8 ${
                                                                theme === 'light' ? 'border-slate-100 focus:border-emerald-500' : 'border-white/5 focus:border-emerald-500 text-white'
                                                            }`}
                                                        />
                                                        <DollarSign className="w-5 h-5 absolute left-0 top-1/2 -translate-y-1/2 text-slate-500" />
                                                    </div>
                                                    <button
                                                        onClick={() => handleContribute(goal.id, goal.current, 1)}
                                                        className="px-6 py-2 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-transform shadow-lg shadow-emerald-500/20"
                                                    >
                                                        Salvar
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Delete Confirmation Overlay */}
                                        {deleteConfirmId === goal.id && (
                                            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-[2.5rem] flex flex-col items-center justify-center p-8 text-center z-10 animate-in fade-in">
                                                <Trash2 className="w-12 h-12 text-rose-500 mb-4" />
                                                <p className="text-white font-black text-lg mb-6">Excluir esta meta permanentemente?</p>
                                                <div className="flex gap-4 w-full">
                                                    <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-4 rounded-2xl bg-white/10 text-white font-black uppercase tracking-widest text-[10px]">Não, voltar</button>
                                                    <button onClick={() => handleDelete(goal.id)} className="flex-1 py-4 rounded-2xl bg-rose-500 text-white font-black uppercase tracking-widest text-[10px]">Sim, Excluir</button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Edit Overlay */}
                                        {editingId === goal.id && (
                                            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-[2.5rem] p-8 z-20 animate-in zoom-in-95">
                                                <h4 className="text-white font-black text-xl mb-6 flex items-center gap-2">
                                                    <Pencil className="w-5 h-5 text-blue-400" /> Editar Meta
                                                </h4>
                                                <form onSubmit={handleUpdateGoal} className="space-y-4">
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Título</label>
                                                        <input 
                                                            type="text" 
                                                            value={editTitle}
                                                            onChange={(e) => setEditTitle(e.target.value)}
                                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-blue-500 outline-none"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Alvo (R$)</label>
                                                            <input 
                                                                type="number" 
                                                                value={editTarget}
                                                                onChange={(e) => setEditTarget(e.target.value)}
                                                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-blue-500 outline-none"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Prazo</label>
                                                            <input 
                                                                type="date" 
                                                                value={editDeadline}
                                                                min="2020-01-01"
                                                                max="2099-12-31"
                                                                onChange={(e) => setEditDeadline(e.target.value)}
                                                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-blue-500 outline-none"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-3 mt-6">
                                                        <button type="button" onClick={() => setEditingId(null)} className="flex-1 py-3 rounded-xl bg-white/10 text-white font-black uppercase tracking-widest text-[9px]">Cancelar</button>
                                                        <button type="submit" className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-black uppercase tracking-widest text-[9px]">Salvar</button>
                                                    </div>
                                                </form>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
