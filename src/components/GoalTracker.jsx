import React, { useState, useEffect } from 'react';
import { Target, Plus, Pencil, Check, X, Trophy, History, Trash2, TrendingUp, Calendar } from 'lucide-react';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';

export default function GoalTracker() {
    const [goals, setGoals] = useState([]);
    const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'
    const [isAdding, setIsAdding] = useState(false);

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

    const handleAddGoal = async () => {
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
            setIsAdding(false);
        } catch (error) {
            console.error("Error adding goal:", error);
        }
    };

    const handleContribute = async (goalId, currentAmount) => {
        const val = parseFloat(contributions[goalId]);
        if (!val) return;

        try {
            const newCurrent = currentAmount + val;
            const goalRef = doc(db, 'goals', goalId);

            // Auto-complete check
            // We fetch the latest goal data or trust the passed logic. 
            // Better to update status if 100% reached, or let user do it? 
            // Let's keep it 'active' unless manually moved or strictly > target.
            // For now, simple update.

            await updateDoc(goalRef, { current: newCurrent });
            setContributions(prev => ({ ...prev, [goalId]: '' }));
        } catch (error) {
            console.error("Error adding contribution:", error);
        }
    };

    const handleEditStart = (goal) => {
        setEditingId(goal.id);
        setEditTitle(goal.title);
        setEditTarget(goal.target);
        setEditDeadline(goal.deadline || '');
    };

    const handleEditSave = async () => {
        if (!editTitle || !editTarget) return;
        try {
            await updateDoc(doc(db, 'goals', editingId), {
                title: editTitle,
                target: parseFloat(editTarget),
                deadline: editDeadline || null
            });
            setEditingId(null);
        } catch (error) {
            console.error("Error updating goal:", error);
        }
    };

    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    const handleDelete = async (id) => {
        // If we are already confirming this id, proceed to delete
        // But logic in UI handles the "Confirmar?" button calling this.
        // Actually, let's keep it simple: The UI calls handleDelete when "Confirmar?" is clicked.
        // But wait, the previous code used window.confirm. 
        // We need to change handleDelete to JUST delete, and let UI handle the 2-step.
        await deleteDoc(doc(db, 'goals', id));
        setDeleteConfirmId(null);
    };

    const toggleStatus = async (goal) => {
        const newStatus = goal.status === 'active' ? 'completed' : 'active';
        await updateDoc(doc(db, 'goals', goal.id), { status: newStatus });
    };

    const filteredGoals = goals.filter(g => g.status === (activeTab === 'active' ? 'active' : 'completed'));

    return (
        <div className="bg-slate-800/50 backdrop-blur-md p-4 md:p-6 rounded-2xl border border-slate-700 shadow-xl space-y-6">

            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-yellow-400" />
                    Metas Financeiras
                </h2>

                <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-700 w-full md:w-auto">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'active' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Em Andamento
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Histórico
                    </button>
                </div>
            </div>

            {/* Add Goal Button */}
            {activeTab === 'active' && !isAdding && (
                <button
                    onClick={() => setIsAdding(true)}
                    className="w-full py-3 border-2 border-dashed border-slate-700 rounded-xl text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/5 transition-all font-medium flex items-center justify-center gap-2"
                >
                    <Plus className="w-5 h-5" /> Nova Meta
                </button>
            )}

            {/* Add Goal Form */}
            {isAdding && (
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 animate-in fade-in slide-in-from-top-4">
                    <h3 className="text-slate-200 font-bold mb-3 flex items-center gap-2">
                        <Target className="w-4 h-4 text-emerald-400" /> Nova Meta
                    </h3>
                    <div className="grid md:grid-cols-2 gap-3 mb-3">
                        <input
                            type="text"
                            placeholder="Nome (ex: Carro Novo)"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                        />
                        <input
                            type="number"
                            placeholder="Valor Alvo (R$)"
                            value={newTarget}
                            onChange={(e) => setNewTarget(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                        />
                        <div className="md:col-span-2">
                            <input
                                type="date"
                                placeholder="Prazo (Opcional)"
                                value={newDeadline}
                                onChange={(e) => setNewDeadline(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 [color-scheme:dark]"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setIsAdding(false)} className="px-3 py-1.5 text-sm text-slate-400 hover:text-white">Cancelar</button>
                        <button onClick={handleAddGoal} className="px-3 py-1.5 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors">Criar Meta</button>
                    </div>
                </div>
            )}

            {/* Goals List */}
            <div className="space-y-4">
                {filteredGoals.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        Nenhuma meta {activeTab === 'active' ? 'em andamento' : 'concluída'}.
                    </div>
                ) : (
                    filteredGoals.map(goal => {
                        const percentage = Math.min((goal.current / goal.target) * 100, 100).toFixed(1);
                        const isGoalCompleted = goal.current >= goal.target;

                        return (
                            <div key={goal.id} className="bg-slate-900/30 p-4 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all group">

                                {/* Header: Title & Actions */}
                                <div className="flex justify-between items-start mb-4">
                                    {editingId === goal.id ? (
                                        <div className="flex-1 grid md:grid-cols-2 gap-2 mr-4">
                                            <input
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                className="bg-slate-800 rounded px-2 py-1 text-sm border border-slate-600 text-white"
                                            />
                                            <input
                                                type="number"
                                                value={editTarget}
                                                onChange={(e) => setEditTarget(e.target.value)}
                                                className="bg-slate-800 rounded px-2 py-1 text-sm border border-slate-600 text-white"
                                            />
                                            <input
                                                type="date"
                                                value={editDeadline}
                                                onChange={(e) => setEditDeadline(e.target.value)}
                                                className="bg-slate-800 rounded px-2 py-1 text-sm border border-slate-600 text-white md:col-span-2 [color-scheme:dark]"
                                            />
                                        </div>
                                    ) : (
                                        <div>
                                            <h3 className="font-bold text-lg text-slate-200">{goal.title}</h3>
                                            <p className="text-xs text-slate-400">
                                                Meta: <span className="text-slate-300">R$ {goal.target.toLocaleString()}</span>
                                                {goal.deadline && (
                                                    <span className="ml-2 flex items-center gap-1 inline-flex text-blue-400">
                                                        <Calendar className="w-3 h-3" />
                                                        {new Date(goal.deadline).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-1">
                                        {editingId === goal.id ? (
                                            <>
                                                <button onClick={handleEditSave} className="p-3 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"><Check className="w-5 h-5" /></button>
                                                <button onClick={() => setEditingId(null)} className="p-3 text-rose-400 hover:bg-rose-500/10 rounded-lg"><X className="w-5 h-5" /></button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => toggleStatus(goal)}
                                                    className={`p-3 rounded-lg transition-colors ${goal.status === 'completed' ? 'text-yellow-400 hover:bg-yellow-400/10' : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10'}`}
                                                    title={goal.status === 'completed' ? "Reativar" : "Concluir"}
                                                >
                                                    {goal.status === 'completed' ? <History className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                                                </button>

                                                <button onClick={() => handleEditStart(goal)} className="p-3 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"><Pencil className="w-5 h-5" /></button>

                                                {deleteConfirmId === goal.id ? (
                                                    <button
                                                        onClick={() => handleDelete(goal.id)}
                                                        className="p-3 bg-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg transition-all animate-in zoom-in font-bold text-xs"
                                                    >
                                                        Confirmar?
                                                    </button>
                                                ) : (
                                                    <button onClick={() => setDeleteConfirmId(goal.id)} className="p-3 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"><Trash2 className="w-5 h-5" /></button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="mb-4">
                                    <div className="flex justify-between text-xs mb-1 text-slate-400">
                                        <span>R$ {goal.current.toLocaleString()}</span>
                                        <span className={isGoalCompleted ? 'text-emerald-400 font-bold' : ''}>{percentage}%</span>
                                    </div>
                                    <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-700 ease-out ${isGoalCompleted ? 'bg-emerald-400' : 'bg-gradient-to-r from-blue-500 to-emerald-400'}`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Savings Suggestion */}
                                {goal.status === 'active' && goal.deadline && !isGoalCompleted && (
                                    (() => {
                                        const today = new Date();
                                        const d = new Date(goal.deadline);
                                        const months = (d.getFullYear() - today.getFullYear()) * 12 + (d.getMonth() - today.getMonth());
                                        const remaining = goal.target - goal.current;
                                        if (months > 0 && remaining > 0) {
                                            const monthly = remaining / months;
                                            return (
                                                <div className="mb-4 text-xs text-blue-400/80 bg-blue-500/10 p-2 rounded-lg flex items-center gap-2">
                                                    <TrendingUp className="w-3 h-3" />
                                                    <span>Economize <strong>R$ {monthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mês</strong> para atingir o prazo.</span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()
                                )}

                                {/* Contribution Input (Only for active goals) */}
                                {goal.status === 'active' && (
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            placeholder="Aportar..."
                                            value={contributions[goal.id] || ''}
                                            onChange={(e) => setContributions(prev => ({ ...prev, [goal.id]: e.target.value }))}
                                            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                                        />
                                        <button
                                            onClick={() => handleContribute(goal.id, goal.current)}
                                            className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-colors"
                                            disabled={!contributions[goal.id]}
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

        </div>
    );
}
