import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, ArrowUpCircle, ArrowDownCircle, Trash2, Pencil, Calendar, Search, Wallet, TrendingUp, TrendingDown, FileText, X, Download, Home, Utensils, Car, Heart, Gamepad2, ShoppingBag, Briefcase, Laptop, Circle, Eye, EyeOff } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, orderBy, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import ExpensesChart from './ExpensesChart';
import AIChat from './AIChat';
import FinancialAdvisor from './FinancialAdvisor';
import { CATEGORIES } from '../constants/categories';
import { generatePDF } from '../utils/generatePDF';
import logo from '../assets/logo.png';

// New Card Component
function Card({ title, value, icon: Icon, color, highlight, isHidable, isHidden, onToggle }) {
    return (
        <div className={`p-6 rounded-3xl border transition-all duration-300 hover:scale-[1.02] ${highlight ? 'bg-blue-600/10 border-blue-500/30 shadow-lg shadow-blue-500/5' : 'bg-white/5 border-white/10 backdrop-blur-md'}`}>
            <div className="flex justify-between items-start mb-2">
                <span className="text-slate-400 text-sm font-medium">{title}</span>
                <div className="flex items-center gap-2">
                    {isHidable && (
                        <button onClick={onToggle} className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-slate-300">
                            {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    )}
                    <Icon className={`w-5 h-5 ${color}`} />
                </div>
            </div>
            <div className="text-2xl font-bold text-slate-100">
                {isHidable && isHidden ? (
                    <span className="tracking-widest capitalize">••••••</span>
                ) : (
                    <>R$ {value.toLocaleString()}</>
                )}
            </div>
        </div>
    );
}



export default function TransactionSection({ manualConfig, updateManualConfig }) {
    const [transactions, setTransactions] = useState([]);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(() => {
        const now = new Date();
        return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    });
    const [type, setType] = useState('expense');
    const [category, setCategory] = useState({ id: 'other', label: 'Outro', icon: Circle, color: 'text-slate-400' });
    const [isRecurring, setIsRecurring] = useState(false);
    const [installments, setInstallments] = useState(2);
    const [editingId, setEditingId] = useState(null);
    const { currentUser } = useAuth();
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [showReport, setShowReport] = useState(false);
    const [filterCategory, setFilterCategory] = useState('all');
    const [hidePatrimonio, setHidePatrimonio] = useState(() => {
        return localStorage.getItem('hidePatrimonio') === 'true';
    });
    const [hideBalance, setHideBalance] = useState(() => {
        return localStorage.getItem('hideBalance') === 'true';
    });

    const togglePatrimonio = (e) => {
        e.stopPropagation();
        const newValue = !hidePatrimonio;
        setHidePatrimonio(newValue);
        localStorage.setItem('hidePatrimonio', String(newValue));
    };

    const toggleBalance = (e) => {
        e.stopPropagation();
        const newValue = !hideBalance;
        setHideBalance(newValue);
        localStorage.setItem('hideBalance', String(newValue));
    };




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

    const addTransactionToDb = async (data) => {
        try {
            await addDoc(collection(db, 'transactions'), {
                ...data,
                userId: currentUser.uid,
                month: data.date.slice(0, 7),
                isFixed: false
            });
            console.log("Transação adicionada via IA:", data);
            return true;
        } catch (error) {
            console.error("Erro ao adicionar via IA:", error);
            return false;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount || !description || !currentUser) return;

        const val = parseFloat(amount);
        // Create date object (noon local time) to avoid timezone shifts
        const [year, month, day] = date.split('-').map(Number);
        const transactionDate = new Date(year, month - 1, day, 12, 0, 0);

        const transactionData = {
            description,
            amount: val,
            type,
            category: category.id, // Store category ID for simplicity
            date: transactionDate.toISOString(),
            userId: currentUser.uid,
            month: transactionDate.toISOString().slice(0, 7), // Store month for easier filtering
            isFixed: category.isFixed || false // Store if it is a fixed expense
        };

        try {
            if (editingId) {
                await updateDoc(doc(db, 'transactions', editingId), transactionData);
                setEditingId(null);
            } else {
                if (isRecurring && installments > 1) {
                    const batchPromises = [];
                    for (let i = 0; i < installments; i++) {
                        const nextDate = new Date(transactionDate);
                        nextDate.setMonth(nextDate.getMonth() + i);

                        const recurringData = {
                            ...transactionData,
                            description: `${description} (${i + 1}/${installments})`,
                            date: nextDate.toISOString(),
                            month: nextDate.toISOString().slice(0, 7)
                        };
                        batchPromises.push(addDoc(collection(db, 'transactions'), recurringData));
                    }
                    await Promise.all(batchPromises);
                } else if (transactionData.isFixed) {
                    // Generate for 12 months for fixed expenses
                    const batchPromises = [];
                    for (let i = 0; i < 12; i++) {
                        const nextDate = new Date(transactionDate);
                        nextDate.setMonth(nextDate.getMonth() + i);

                        const fixedData = {
                            ...transactionData,
                            date: nextDate.toISOString(),
                            month: nextDate.toISOString().slice(0, 7)
                        };
                        batchPromises.push(addDoc(collection(db, 'transactions'), fixedData));
                    }
                    await Promise.all(batchPromises);
                } else {
                    await addDoc(collection(db, 'transactions'), transactionData);
                }
            }
            setAmount('');
            setDescription('');
            // Reset to defaults
            const now = new Date();
            setDate(now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'));
            setType('expense');
            setCategory({ id: 'other', label: 'Outro', icon: Circle, color: 'text-slate-400' });
            setIsRecurring(false);
            setInstallments(2);
        } catch (error) {
            console.error("Error saving transaction:", error);
        }
    };

    const handleEdit = (t) => {
        setAmount(t.amount);
        setDescription(t.description);
        setType(t.type);
        // Find category explicitly
        const catList = t.type === 'income' ? CATEGORIES.income : CATEGORIES.expense;
        const foundCat = catList.find(c => c.id === t.category) || catList.find(c => c.id === 'other');
        setCategory(foundCat);

        // Convert ISO date back to YYYY-MM-DD local
        const d = new Date(t.date);
        const formattedDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        setDate(formattedDate);
        setEditingId(t.id);
    };

    const [deleteId, setDeleteId] = useState(null);
    const [deleteData, setDeleteData] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = (transaction) => {
        setDeleteId(transaction.id);
        setDeleteData(transaction);
    };

    const confirmDelete = async (deleteFuture = false) => {
        if (!deleteId) return;
        setIsDeleting(true);

        try {
            // Always delete the current one
            await deleteDoc(doc(db, 'transactions', deleteId));

            if (deleteFuture && deleteData) {
                // Use existing transactions state to avoid "Query requires index" error
                // We already have all user transactions in memory from the main listener
                let toDelete = [];

                if (deleteData.isFixed) {
                    toDelete = transactions.filter(t =>
                        t.isFixed === true &&
                        t.description === deleteData.description &&
                        t.date > deleteData.date
                    );
                } else if (deleteData.description.match(/\(\d+\/\d+\)/)) {
                    const baseDesc = deleteData.description.replace(/\s\(\d+\/\d+\)/, '');
                    toDelete = transactions.filter(t =>
                        t.description.startsWith(baseDesc) &&
                        t.description.match(/\(\d+\/\d+\)/) &&
                        t.date > deleteData.date
                    );
                }

                const deletePromises = toDelete.map(t => deleteDoc(doc(db, 'transactions', t.id)));
                await Promise.all(deletePromises);
            }

            setDeleteId(null);
            setDeleteData(null);
        } catch (error) {
            console.error("Erro ao excluir:", error);
        } finally {
            setIsDeleting(false);
            // Ensure modal closes even if error occurs
            setDeleteId(null);
            setDeleteData(null);
        }
    };

    const chartTransactions = useMemo(() => {
        return transactions.filter(t => {
            const transactionDate = t.month ? t.month : t.date.slice(0, 7);
            return transactionDate === selectedMonth;
        });
    }, [transactions, selectedMonth]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const transactionDate = t.month ? t.month : t.date.slice(0, 7);
            const matchesMonth = transactionDate === selectedMonth;
            // Check if matches category
            const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
            return matchesMonth && matchesCategory;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [transactions, selectedMonth, filterCategory]);

    const income = useMemo(() => {
        return filteredTransactions
            .filter(t => t.type === 'income')
            .reduce((acc, t) => acc + parseFloat(t.amount), 0);
    }, [filteredTransactions]);

    const expense = useMemo(() => {
        return filteredTransactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => acc + parseFloat(t.amount), 0);
    }, [filteredTransactions]);

    const balance = income - expense;

    const monthlyReport = useMemo(() => {
        const report = {};
        transactions.forEach(t => {
            const monthKey = t.date.slice(0, 7);
            if (!report[monthKey]) {
                report[monthKey] = { income: 0, expense: 0, balance: 0, date: monthKey };
            }
            if (t.type === 'income') {
                report[monthKey].income += t.amount;
                report[monthKey].balance += t.amount;
            } else {
                report[monthKey].expense += t.amount;
                report[monthKey].balance -= t.amount;
            }
        });
        return Object.values(report).sort((a, b) => b.date.localeCompare(a.date));
    }, [transactions]);

    const exportToPDF = () => {
        generatePDF(transactions, selectedMonth, logo);
    };

    return (
        <div className="space-y-6 relative">
            {/* Report Modal */}
            {showReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-400" />
                                Relatório Mensal
                            </h3>
                            <button onClick={() => setShowReport(false)} className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="overflow-y-auto p-6 space-y-4">
                            {monthlyReport.length === 0 ? (
                                <p className="text-center text-slate-500 py-8">Nenhum histórico encontrado.</p>
                            ) : (
                                monthlyReport.map((month) => (
                                    <div
                                        key={month.date}
                                        onClick={() => {
                                            setSelectedMonth(month.date);
                                            setShowReport(false);
                                        }}
                                        className="bg-slate-800/30 border border-slate-700 p-4 rounded-xl hover:bg-slate-700/30 hover:border-blue-500/30 transition-all cursor-pointer group"
                                    >
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-bold text-lg text-slate-200 capitalize">
                                                {new Date(month.date + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                            </h4>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${month.balance >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                {month.balance >= 0 ? 'Positivo' : 'Negativo'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <p className="text-xs text-slate-500 mb-1">Entradas</p>
                                                <p className="text-emerald-400 font-medium">+ R$ {month.income.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 mb-1">Saídas</p>
                                                <p className="text-rose-400 font-medium">- R$ {month.expense.toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-slate-500 mb-1">Saldo</p>
                                                <p className={`font-bold ${month.balance >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                                                    R$ {month.balance.toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Cards Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card
                    title="Saldo em Carteira"
                    value={balance}
                    icon={Wallet}
                    color="text-blue-400"
                    highlight={true}
                    isHidable={true}
                    isHidden={hideBalance}
                    onToggle={toggleBalance}
                />
                <Card
                    title="Patrimônio Investido"
                    value={parseFloat(manualConfig.invested) || 0}
                    icon={TrendingUp}
                    color="text-purple-400"
                    isHidable={true}
                    isHidden={hidePatrimonio}
                    onToggle={togglePatrimonio}
                />
                <Card title="Ganhos (Mês)" value={income} icon={ArrowUpCircle} color="text-emerald-400" />
                <Card title="Gastos (Mês)" value={expense} icon={ArrowDownCircle} color="text-rose-400" />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-xl p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl grid grid-cols-1 md:grid-cols-12 gap-4">
                <h3 className="md:col-span-12 text-lg font-bold text-slate-100 mb-2 flex items-center gap-2">
                    {editingId ? <Pencil className="w-5 h-5 text-blue-400" /> : <LayoutDashboard className="w-5 h-5 text-emerald-400" />}
                    {editingId ? 'Editar Transação' : 'Nova Transação'}
                </h3>

                {/* Row 1: Description, Value, Date */}
                <div className="md:col-span-6">
                    <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">Descrição</label>
                    <input
                        type="text"
                        placeholder="Ex: Mercado, Aluguel..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                </div>
                <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">Valor</label>
                    <input
                        type="number"
                        placeholder="R$ 0,00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                </div>
                <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">Data</label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 [color-scheme:dark]"
                    />
                </div>

                {/* Row 2: Category Selector (Full Width) */}
                <div className="md:col-span-12">
                    <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">Categoria</label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2 p-2 bg-slate-900/50 rounded-xl border border-slate-700">
                        {(type === 'income' ? CATEGORIES.income : CATEGORIES.expense).map(cat => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setCategory(cat)}
                                className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${category.id === cat.id ? 'bg-slate-700 ring-1 ring-slate-500' : 'hover:bg-slate-800'}`}
                                title={cat.label}
                            >
                                <cat.icon className={`w-5 h-5 ${cat.color}`} />
                                <span className="text-[10px] text-slate-400 truncate w-full text-center">{cat.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Row 3: Toggles and Actions */}
                <div className="md:col-span-12 flex flex-col md:flex-row items-center justify-between gap-4 mt-2">
                    <div className="flex gap-6">
                        <label className="inline-flex items-center cursor-pointer select-none group">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={isRecurring}
                                onChange={(e) => setIsRecurring(e.target.checked)}
                            />
                            <div className="relative w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-slate-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 peer-checked:after:bg-white group-hover:after:bg-white transition-colors"></div>
                            <span className="ms-2 text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">Parcelado</span>
                        </label>

                        <label className="inline-flex items-center cursor-pointer select-none group">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={category.isFixed || false}
                                onChange={(e) => setCategory({ ...category, isFixed: e.target.checked })}
                            />
                            <div className="relative w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-slate-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-rose-600 peer-checked:after:bg-white group-hover:after:bg-white transition-colors"></div>
                            <span className="ms-2 text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">Fixa</span>
                        </label>
                        {isRecurring && (
                            <div className="flex items-center gap-2 animate-in fade-in">
                                <label className="text-xs font-medium text-slate-400">Qtd:</label>
                                <input
                                    type="number"
                                    min="2"
                                    max="60"
                                    value={installments}
                                    onChange={(e) => setInstallments(parseInt(e.target.value))}
                                    className="w-16 bg-slate-900/50 border border-slate-700 rounded-lg px-2 py-1 text-sm text-slate-200"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-700">
                            <button
                                type="button"
                                onClick={() => { setType('income'); setCategory(CATEGORIES.income[CATEGORIES.income.length - 1]); }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${type === 'income'
                                    ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                <ArrowUpCircle className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => { setType('expense'); setCategory(CATEGORIES.expense[CATEGORIES.expense.length - 1]); }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${type === 'expense'
                                    ? 'bg-rose-500/20 text-rose-400 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                <ArrowDownCircle className="w-4 h-4" />
                            </button>
                        </div>

                        <button type="submit" className="flex-1 px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl shadow-lg shadow-blue-500/20 transition-all">
                            {editingId ? 'Salvar' : 'Adicionar'}
                        </button>
                    </div>
                </div>
            </form >

            {/* List Header & Filter */}
            < div className="flex flex-col md:flex-row md:items-center justify-between gap-4" >
                <h3 className="text-xl font-bold text-slate-100">Transações</h3>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={exportToPDF}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors text-sm font-medium"
                            title="Baixar Relatório em PDF"
                        >
                            <Download className="w-4 h-4" />
                            PDF
                        </button>
                        <button
                            onClick={() => setShowReport(true)}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors text-sm font-medium"
                        >
                            <FileText className="w-4 h-4" />
                            Relatórios
                        </button>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-2 rounded-xl border border-slate-700 w-full md:w-auto">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent text-slate-300 text-sm focus:outline-none w-full"
                        />
                    </div>
                </div>
            </div >

            {/* Analytics Chart & Advisor */}
            <div className={`grid grid-cols-1 ${transactions.length === 0 && !manualConfig.income ? '' : 'lg:grid-cols-2'} gap-8 mb-8 animate-in slide-in-from-bottom-5 fade-in duration-500`}>
                <ExpensesChart transactions={chartTransactions} />
                <FinancialAdvisor
                    transactions={transactions}
                    manualConfig={manualConfig}
                    onConfigChange={updateManualConfig}
                />
            </div>

            {/* Category Filter */}
            <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-400 mb-3 px-1">Filtrar por Categoria</h4>
                <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <button
                        onClick={() => setFilterCategory('all')}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${filterCategory === 'all'
                            ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/25'
                            : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                            }`}
                    >
                        Todos
                    </button>
                    {CATEGORIES.expense.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setFilterCategory(cat.id)}
                            className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap border flex items-center gap-2 ${filterCategory === cat.id
                                ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/25'
                                : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                                }`}
                        >
                            <cat.icon className="w-3 h-3" />
                            {cat.label}
                        </button>
                    ))}
                    {CATEGORIES.income.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setFilterCategory(cat.id)}
                            className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap border flex items-center gap-2 ${filterCategory === cat.id
                                ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/25'
                                : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                                }`}
                        >
                            <cat.icon className="w-3 h-3" />
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Transactions List */}
            {/* Transactions List */}
            <div className="max-h-[500px] overflow-y-auto pr-2 -mr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent space-y-3">
                {
                    filteredTransactions.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 bg-slate-800/30 rounded-2xl border border-slate-800 border-dashed">
                            Nenhuma transação neste mês.
                        </div>
                    ) : (
                        filteredTransactions.map((t) => (
                            <div key={t.id} className="group bg-slate-800/50 backdrop-blur-sm p-4 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <div className={`p-3 rounded-xl bg-slate-900/50 border border-slate-700`}>
                                        {(() => {
                                            // Resolve Icon
                                            const catList = t.type === 'income' ? CATEGORIES.income : CATEGORIES.expense;
                                            const foundCat = catList.find(c => c.id === t.category) || catList.find(c => c.id === 'other') || { icon: Circle, color: 'text-slate-400' };
                                            const IconComponent = foundCat.icon;
                                            return <IconComponent className={`w-6 h-6 ${foundCat.color}`} />;
                                        })()}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-200">{t.description}</h4>
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            {new Date(t.date).toLocaleDateString()}
                                            <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                                            {(() => {
                                                const catList = t.type === 'income' ? CATEGORIES.income : CATEGORIES.expense;
                                                const foundCat = catList.find(c => c.id === t.category);
                                                return foundCat ? foundCat.label : 'Geral';
                                            })()}
                                            {t.isFixed && (
                                                <span className="ml-2 text-[10px] font-bold bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/20">
                                                    Fixa
                                                </span>
                                            )}
                                            {t.description.match(/\(\d+\/\d+\)/) && (
                                                <span className="ml-2 text-[10px] font-bold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/20">
                                                    Recorrente
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between w-full md:w-auto gap-6 mt-2 md:mt-0 md:pl-0">
                                    <span className={`font-bold text-lg ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString()}
                                    </span>
                                    <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEdit(t)} className="p-2 bg-slate-700/50 hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 rounded-lg transition-colors">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(t)} className="p-2 bg-slate-700/50 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )
                }
            </div>

            <AIChat
                transactions={transactions}
                manualConfig={manualConfig}
                onAddTransaction={addTransactionToDb}
                onDeleteTransaction={handleDelete}
            />
            {/* Confirmation Modal */}
            {
                deleteId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="p-3 bg-rose-500/10 rounded-full">
                                    <Trash2 className="w-8 h-8 text-rose-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-100 mb-1">Excluir Transação?</h3>
                                    <p className="text-sm text-slate-400">
                                        Essa ação não pode ser desfeita. Tem certeza que deseja remover este item?
                                    </p>
                                </div>
                                {deleteData && (deleteData.isFixed || deleteData.description.match(/\(\d+\/\d+\)/)) ? (
                                    <div className="flex flex-col gap-2 w-full mt-2">
                                        <button
                                            onClick={() => confirmDelete(false)}
                                            className="w-full px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors font-medium text-sm"
                                        >
                                            Excluir apenas esta
                                        </button>
                                        <button
                                            onClick={() => confirmDelete(true)}
                                            disabled={isDeleting}
                                            className="w-full px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-colors font-bold text-sm shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2"
                                        >
                                            {isDeleting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                                            Excluir esta e futuras
                                        </button>
                                        <button
                                            onClick={() => setDeleteId(null)}
                                            className="w-full px-4 py-2 text-slate-400 hover:text-slate-300 transition-colors text-xs font-medium"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-3 w-full mt-2">
                                        <button
                                            onClick={() => setDeleteId(null)}
                                            className="flex-1 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors font-medium"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={() => confirmDelete(false)}
                                            disabled={isDeleting}
                                            className="flex-1 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-colors font-medium shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2"
                                        >
                                            {isDeleting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                                            Sim, Excluir
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
