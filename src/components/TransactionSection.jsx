import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ArrowUpCircle, ArrowDownCircle, Trash2, Pencil, Calendar, Search, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

// New Card Component
function Card({ title, value, icon: Icon, color, highlight }) {
    return (
        <div className={`p-5 rounded-2xl border ${highlight ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
            <div className="flex justify-between items-start mb-2">
                <span className="text-slate-400 text-sm font-medium">{title}</span>
                <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="text-2xl font-bold text-slate-100">
                R$ {value.toLocaleString()}
            </div>
        </div>
    );
}

export default function TransactionSection() {
    const [transactions, setTransactions] = useState([]);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('expense');
    const [editingId, setEditingId] = useState(null);
    const { currentUser } = useAuth();
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, 'transactions'),
            where('userId', '==', currentUser.uid),
            orderBy('date', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTransactions(docs);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount || !description || !currentUser) return;

        const val = parseFloat(amount);
        const transactionData = {
            description,
            amount: val,
            type,
            date: new Date().toISOString(),
            userId: currentUser.uid,
            month: new Date().toISOString().slice(0, 7) // Store month for easier filtering
        };

        try {
            if (editingId) {
                await updateDoc(doc(db, 'transactions', editingId), transactionData);
                setEditingId(null);
            } else {
                await addDoc(collection(db, 'transactions'), transactionData);
            }
            setAmount('');
            setDescription('');
            setType('expense');
        } catch (error) {
            console.error("Error saving transaction:", error);
        }
    };

    const handleEdit = (t) => {
        setAmount(t.amount);
        setDescription(t.description);
        setType(t.type);
        setEditingId(t.id);
    };

    const handleDelete = async (id) => {
        if (confirm('Tem certeza que deseja excluir?')) {
            await deleteDoc(doc(db, 'transactions', id));
        }
    };

    const filteredTransactions = transactions.filter(t => t.date.startsWith(selectedMonth));

    const income = filteredTransactions
        .filter(t => t.type === 'income')
        .reduce((acc, t) => acc + t.amount, 0);

    const expense = filteredTransactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => acc + t.amount, 0);

    const balance = income - expense;

    return (
        <div className="space-y-6">
            {/* Cards Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card
                    title="Saldo Total"
                    value={balance}
                    icon={Wallet}
                    color="text-blue-400"
                    highlight={true}
                />
                <Card
                    title="Entradas"
                    value={income}
                    icon={TrendingUp}
                    color="text-emerald-400"
                />
                <Card
                    title="Saídas"
                    value={expense}
                    icon={TrendingDown}
                    color="text-rose-400"
                />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl border border-slate-700 shadow-xl">
                <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                    {editingId ? <Pencil className="w-5 h-5 text-blue-400" /> : <LayoutDashboard className="w-5 h-5 text-emerald-400" />}
                    {editingId ? 'Editar Transação' : 'Nova Transação'}
                </h3>

                <div className="grid md:grid-cols-12 gap-4">
                    <div className="md:col-span-4">
                        <input
                            type="text"
                            placeholder="Descrição (ex: Mercado)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </div>
                    <div className="md:col-span-3">
                        <input
                            type="number"
                            placeholder="Valor"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </div>
                    <div className="md:col-span-3">
                        <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-700">
                            <button
                                type="button"
                                onClick={() => setType('income')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${type === 'income'
                                    ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                <ArrowUpCircle className="w-4 h-4" /> Entrada
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('expense')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${type === 'expense'
                                    ? 'bg-rose-500/20 text-rose-400 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                <ArrowDownCircle className="w-4 h-4" /> Saída
                            </button>
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <button type="submit" className="w-full h-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
                            {editingId ? 'Salvar' : 'Adicionar'}
                        </button>
                    </div>
                </div>
            </form>

            {/* List Header & Filter */}
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-100">Transações</h3>
                <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-700">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-transparent text-slate-300 text-sm focus:outline-none"
                    />
                </div>
            </div>

            {/* Transactions List */}
            <div className="space-y-3">
                {filteredTransactions.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 bg-slate-800/30 rounded-2xl border border-slate-800 border-dashed">
                        Nenhuma transação neste mês.
                    </div>
                ) : (
                    filteredTransactions.map((t) => (
                        <div key={t.id} className="group bg-slate-800/50 backdrop-blur-sm p-4 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className={`p-3 rounded-xl ${t.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                    {t.type === 'income' ? <ArrowUpCircle className="w-6 h-6" /> : <ArrowDownCircle className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-200">{t.description}</h4>
                                    <p className="text-xs text-slate-500">{new Date(t.date).toLocaleDateString()}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between w-full md:w-auto gap-6 pl-14 md:pl-0">
                                <span className={`font-bold text-lg ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString()}
                                </span>
                                <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(t)} className="p-2 bg-slate-700/50 hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 rounded-lg transition-colors">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(t.id)} className="p-2 bg-slate-700/50 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
