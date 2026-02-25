import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { LayoutDashboard, ArrowUpCircle, ArrowDownCircle, Trash2, Pencil, Calendar, Search, Wallet, TrendingUp, TrendingDown, FileText, X, Download, Home, Utensils, Car, Heart, Gamepad2, ShoppingBag, Briefcase, Laptop, Circle, Eye, EyeOff } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, orderBy, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import ExpensesChart from './ExpensesChart';
import AIChat from './AIChat';
import FinancialAdvisor from './FinancialAdvisor';
import { CATEGORIES } from '../constants/categories';
import { generatePDF } from '../utils/generatePDF';
import { calculateFinancialHealth } from '../utils/financialLogic';
import logo from '../assets/logo.png';

// New Card Component
// New Card Component - Centered Content
function Card({ title, value, icon: Icon, color, highlight, isHidable, isHidden, onToggle, detail }) {
    return (
        <div key={`card-${title}`} className={`p-6 rounded-3xl border transition-all duration-300 hover:scale-[1.02] flex flex-col items-center text-center relative overflow-hidden ${highlight ? 'bg-blue-600/10 border-blue-500/30 shadow-lg shadow-blue-500/5' : 'bg-white/5 border-white/10 backdrop-blur-md'}`}>
            <div className="absolute top-2 right-2 flex items-center gap-1">
                {isHidable && (
                    <button key="btn-toggle" onClick={onToggle} className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-slate-300">
                        {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                )}
            </div>

            <div className="mb-3 p-3 bg-white/5 rounded-2xl">
                <Icon className={`w-8 h-8 ${color}`} />
            </div>

            <span className="text-slate-400 text-sm font-medium mb-1">{title}</span>

            <div className="text-3xl font-bold text-slate-100">
                <span key={isHidden ? 'hidden' : 'visible'}>
                    {isHidable && isHidden ? (
                        <span className="tracking-widest capitalize">••••••</span>
                    ) : (
                        `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    )}
                </span>
            </div>
            {detail && <div className="text-[10px] text-slate-500 mt-2 font-medium">{detail}</div>}
        </div>
    );
}



export default function TransactionSection({ manualConfig, updateManualConfig, transactions, goals = [], isLoadingData }) {
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
    const [installmentValueMode, setInstallmentValueMode] = useState('monthly'); // 'total' | 'monthly'
    const [editingId, setEditingId] = useState(null);
    const { currentUser } = useAuth();
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [searchTerm, setSearchTerm] = useState('');
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




    // Local listener removed - consuming global prop from App.jsx

    const addTransactionToDb = async (data) => {
        try {
            await addDoc(collection(db, 'transactions'), {
                ...data,
                userId: currentUser.uid,
                month: data.date.slice(0, 7),
                createdAt: Date.now(),
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
            createdAt: Date.now(),
            isFixed: category.isFixed || false // Store if it is a fixed expense
        };

        try {
            if (editingId) {
                await updateDoc(doc(db, 'transactions', editingId), transactionData);
                setEditingId(null);
            } else {
                if (isRecurring && installments > 1) {
                    const batchPromises = [];
                    // Calculate individual installment amount
                    const installmentAmount = installmentValueMode === 'total'
                        ? val / installments
                        : val;

                    for (let i = 0; i < installments; i++) {
                        const nextDate = new Date(transactionDate);
                        nextDate.setMonth(nextDate.getMonth() + i);

                        const recurringData = {
                            ...transactionData,
                            amount: installmentAmount,
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

    const getRobustMonth = (t) => {
        if (t.month) return t.month;
        if (!t.date) return "";
        let dStr = "";
        try {
            if (typeof t.date === 'string') dStr = t.date;
            else if (t.date.toDate) dStr = t.date.toDate().toISOString();
            else if (t.date.seconds) dStr = new Date(t.date.seconds * 1000).toISOString();
        } catch (e) { return ""; }
        return dStr.slice(0, 7);
    };

    const chartTransactions = useMemo(() => {
        return transactions.filter(t => getRobustMonth(t) === selectedMonth);
    }, [transactions, selectedMonth]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const matchesMonth = getRobustMonth(t) === selectedMonth;
            const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
            const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesMonth && matchesCategory && matchesSearch;
        }).sort((a, b) => {
            const dateDiff = new Date(b.date) - new Date(a.date);
            if (dateDiff !== 0) return dateDiff;
            // Secondary sort by creation time (newest first)
            return (b.createdAt || 0) - (a.createdAt || 0);
        });
    }, [transactions, selectedMonth, filterCategory, searchTerm]);

    // Body scroll lock effect with width compensation
    useEffect(() => {
        if (deleteId) {
            const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
            if (scrollBarWidth > 0) {
                document.body.style.paddingRight = `${scrollBarWidth}px`;
            }
            return () => {
                document.body.style.overflow = '';
                document.documentElement.style.overflow = '';
                document.body.style.paddingRight = '';
            };
        }
    }, [deleteId]);

    const income = useMemo(() => {
        return filteredTransactions
            .filter(t => t.type === 'income')
            .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    }, [filteredTransactions]);

    const expense = useMemo(() => {
        return filteredTransactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    }, [filteredTransactions]);


    const monthlyBalance = income - expense;

    const totalInvestedFromTransactions = useMemo(() => {
        return transactions
            .filter(t => t.type === 'expense' && t.category === 'investment')
            .reduce((acc, t) => acc + parseFloat(t.amount), 0);
    }, [transactions]);

    const totalPatrimonio = (parseFloat(manualConfig.invested) || 0) + totalInvestedFromTransactions;

    const reservedForGoals = useMemo(() => {
        return goals.reduce((acc, g) => acc + (parseFloat(g.current) || 0), 0);
    }, [goals]);

    const availablePatrimonio = Math.max(0, totalPatrimonio - reservedForGoals);

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

            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {isLoadingData ? (
                    Array(4).fill(0).map((_, i) => (
                        <div key={`skeleton-${i}`} className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md animate-pulse">
                            <div className="h-4 w-24 bg-white/10 rounded mb-4 shadow"></div>
                            <div className="h-8 w-32 bg-white/10 rounded shadow"></div>
                        </div>
                    ))
                ) : (
                    <>
                        <Card
                            title="Saldo em Carteira"
                            value={monthlyBalance}
                            icon={Wallet}
                            color="text-blue-400"
                            highlight={true}
                            isHidable={true}
                            isHidden={hideBalance}
                            onToggle={toggleBalance}
                        />
                        <Card
                            title="Patrimônio Investido"
                            value={totalPatrimonio}
                            icon={TrendingUp}
                            color="text-purple-400"
                            isHidable={true}
                            isHidden={hidePatrimonio}
                            onToggle={togglePatrimonio}
                            detail={
                                <div className="space-y-1.5 mt-2 transition-all duration-300">
                                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                                        <span>Reservado (Metas):</span>
                                        <span className="text-emerald-400">R$ {reservedForGoals.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium pb-1.5 border-b border-white/5">
                                        <span>Livre/Disponível:</span>
                                        <span className="text-blue-400">R$ {availablePatrimonio.toLocaleString()}</span>
                                    </div>
                                    {(() => {
                                        const health = calculateFinancialHealth(transactions, manualConfig);
                                        const monthlyExpenses = health.totalEstimatedExpenses || 0;
                                        if (totalPatrimonio > 0 && monthlyExpenses > 0) {
                                            const months = (totalPatrimonio / monthlyExpenses).toFixed(1);
                                            return <p className="text-[9px] text-slate-500 pt-1 font-semibold italic uppercase tracking-wider">Sustenta seu padrão por {months} {parseFloat(months) === 1 ? 'mês' : 'meses'}</p>;
                                        }
                                        return null;
                                    })()}
                                </div>
                            }
                        />
                        <Card title="Ganhos (Mês)" value={income} icon={ArrowUpCircle} color="text-emerald-400" />
                        <Card title="Gastos (Mês)" value={expense} icon={ArrowDownCircle} color="text-rose-400" />
                    </>
                )}
            </div>

            {/* Input Form */}
            <form key={editingId || 'new-form'} onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-xl p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-12">
                    <h3 className="text-lg font-bold text-slate-100 mb-2 flex items-center gap-2">
                        {editingId ? <Pencil className="w-5 h-5 text-blue-400" /> : <LayoutDashboard className="w-5 h-5 text-emerald-400" />}
                        {editingId ? 'Editar Transação' : 'Nova Transação'}
                    </h3>
                </div>

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
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-1 p-1.5 bg-slate-900/50 rounded-xl border border-slate-700 max-h-[180px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                        {(type === 'income' ? CATEGORIES.income : CATEGORIES.expense).map(cat => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setCategory(cat)}
                                className={`p-1.5 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${category.id === cat.id ? 'bg-slate-700 ring-1 ring-slate-500' : 'hover:bg-slate-800'}`}
                                title={cat.label}
                            >
                                <cat.icon className={`w-4 h-4 ${cat.color}`} />
                                <span className="text-[9px] text-slate-400 truncate w-full text-center">{cat.label}</span>
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
                            <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2 transition-all">
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Parcelas:</label>
                                    <input
                                        type="number"
                                        min="2"
                                        max="60"
                                        value={installments}
                                        onChange={(e) => setInstallments(parseInt(e.target.value))}
                                        className="w-14 bg-slate-900/50 border border-slate-700 rounded-lg px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                                    />
                                </div>
                                <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => setInstallmentValueMode('total')}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${installmentValueMode === 'total'
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-slate-500 hover:text-slate-300'
                                            }`}
                                    >
                                        Valor Total
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInstallmentValueMode('monthly')}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${installmentValueMode === 'monthly'
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-slate-500 hover:text-slate-300'
                                            }`}
                                    >
                                        Mensal
                                    </button>
                                </div>
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
                            className="bg-transparent text-slate-300 text-sm focus:outline-none w-full [color-scheme:dark]"
                        />
                    </div>
                </div>
            </div>

            {/* Analytics Chart & Advisor */}
            <div className={`grid grid-cols-1 ${transactions.length === 0 && !manualConfig.income ? '' : 'lg:grid-cols-2'} gap-8 mb-8 animate-in slide-in-from-bottom-5 fade-in duration-500`}>
                <ExpensesChart transactions={chartTransactions} />
                <FinancialAdvisor
                    transactions={transactions}
                    manualConfig={manualConfig}
                    onConfigChange={updateManualConfig}
                />
            </div>

            {/* Category Filter & Search */}
            <div className="mb-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
                    <h4 className="text-sm font-semibold text-slate-400">Filtrar por Categoria</h4>
                    <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-2 rounded-xl border border-slate-700 w-full md:w-72">
                        <Search className="w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar transação..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-transparent text-slate-300 text-sm focus:outline-none w-full"
                        />
                    </div>
                </div>
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
                                    <div key="item-actions" className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                        <button key="btn-item-edit" onClick={() => handleEdit(t)} className="p-2 bg-slate-700/50 hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 rounded-lg transition-colors">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button key="btn-item-delete" onClick={() => handleDelete(t)} className="p-2 bg-slate-700/50 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition-colors">
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
                onConfigChange={updateManualConfig}
            />
            {/* Confirmation Modal - Rendered via Portal to ensure true centering and visibility */}
            {
                deleteId && typeof document !== 'undefined' && createPortal(
                    <div key="modal-backdrop" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
                        <div
                            key="modal-card"
                            className="bg-slate-900 border border-slate-700/50 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Inner Glow/Aesthetics */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                            <div key="modal-content" className="flex flex-col items-center text-center gap-6">
                                <div key="modal-icon-bg" className="p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                                    <Trash2 className="w-10 h-10 text-rose-500" />
                                </div>

                                <div key="modal-text" className="space-y-2">
                                    <h3 key="modal-title" className="text-xl font-bold text-slate-100 tracking-tight">Excluir Transação?</h3>
                                    <p key="modal-desc" className="text-sm text-slate-400 leading-relaxed px-4">
                                        Esta ação removerá permanentemente este item do seu histórico e não poderá ser desfeita.
                                    </p>
                                </div>

                                {deleteData && (deleteData.isFixed || deleteData.description.match(/\(\d+\/\d+\)/)) ? (
                                    <div key="actions-recurring" className="flex flex-col items-center gap-3 w-full mt-2">
                                        <button
                                            key="btn-delete-only"
                                            onClick={() => confirmDelete(false)}
                                            className="w-64 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all font-semibold text-sm border border-slate-700 shadow-lg"
                                        >
                                            Excluir apenas esta
                                        </button>
                                        <button
                                            key="btn-delete-recurring"
                                            onClick={() => confirmDelete(true)}
                                            disabled={isDeleting}
                                            className="w-64 px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all font-bold text-sm shadow-xl shadow-rose-600/30 flex items-center justify-center gap-3 active:scale-95"
                                        >
                                            {isDeleting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                            <span>Excluir esta e futuras</span>
                                        </button>
                                        <button
                                            key="btn-cancel-rec"
                                            onClick={() => setDeleteId(null)}
                                            className="w-64 px-4 py-3 text-slate-400 hover:text-slate-100 transition-colors text-xs font-medium"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                ) : (
                                    <div key="actions-single-perfect" className="flex flex-col items-center gap-3 w-full mt-2">
                                        <button
                                            key="btn-confirm-single-final"
                                            onClick={() => confirmDelete(false)}
                                            disabled={isDeleting}
                                            className="w-64 px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all font-bold text-sm shadow-xl shadow-rose-600/30 flex items-center justify-center gap-3 active:scale-95"
                                        >
                                            {isDeleting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                            <span>Sim, Excluir</span>
                                        </button>
                                        <button
                                            key="btn-cancel-single-final"
                                            onClick={() => setDeleteId(null)}
                                            className="w-64 px-4 py-3 text-slate-400 hover:text-slate-100 transition-colors text-xs font-medium"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }
        </div >
    );
}
