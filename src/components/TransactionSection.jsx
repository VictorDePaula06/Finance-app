import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LayoutDashboard, ArrowUpCircle, ArrowDownCircle, Trash2, Pencil, Calendar, Search, Wallet, TrendingUp, TrendingDown, FileText, X, Download, Home, Utensils, Car, Heart, Gamepad2, ShoppingBag, Briefcase, Laptop, Circle, Eye, EyeOff, Info } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, orderBy, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
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
    const { theme } = useTheme();
    return (
        <div key={`card-${title}`} className={`p-6 rounded-3xl border transition-all duration-300 hover:scale-[1.02] flex flex-col items-center text-center relative overflow-hidden ${
            highlight 
            ? (theme === 'light' ? 'bg-blue-500/10 border-blue-200 shadow-sm' : 'bg-blue-600/10 border-blue-500/30 shadow-lg shadow-blue-500/5') 
            : 'glass-card'
        }`}>
            <div className="absolute top-2 right-2 flex items-center gap-1">
                {isHidable && (
                    <button key="btn-toggle" onClick={onToggle} className={`p-1 rounded-lg transition-colors ${
                        theme === 'light' ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-600' : 'hover:bg-white/10 text-slate-500 hover:text-slate-300'
                    }`}>
                        {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                )}
            </div>
            <div className={`mb-3 p-3 rounded-2xl ${theme === 'light' ? 'bg-[#f0fdfa]' : 'bg-white/5'}`}>
                <Icon className={`w-8 h-8 ${color}`} />
            </div>
            <span className={`text-sm font-medium mb-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{title}</span>
            <div className={`text-3xl font-bold ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                <span key={isHidden ? 'hidden' : 'visible'}>
                    {isHidable && isHidden ? (
                        <span className="tracking-widest capitalize">••••••</span>
                    ) : (
                        `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    )}
                </span>
            </div>
            {detail && <div className={`text-[10px] mt-2 font-medium ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>{detail}</div>}
        </div>
    );
}



export default function TransactionSection({ manualConfig, updateManualConfig, transactions, goals = [], isLoadingData }) {
    const { theme } = useTheme();
    const formRef = useRef(null);
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
    const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleDateString('en-CA').slice(0, 7)); // YYYY-MM (Local)
    const [searchTerm, setSearchTerm] = useState('');
    const [showReport, setShowReport] = useState(false);
    const [showRealFlow, setShowRealFlow] = useState(true);
    const [filterCategory, setFilterCategory] = useState('all');
    const [hidePatrimonio, setHidePatrimonio] = useState(() => {
        return localStorage.getItem('hidePatrimonio') === 'true';
    });
    const [hideBalance, setHideBalance] = useState(() => {
        return localStorage.getItem('hideBalance') === 'true';
    });
    const [isCumulativeView, setIsCumulativeView] = useState(() => {
        return localStorage.getItem('isCumulativeView') === 'true';
    });
    const [isAliviaConfiguring, setIsAliviaConfiguring] = useState(false);

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

    const toggleCumulativeView = (e) => {
        e.stopPropagation();
        const newValue = !isCumulativeView;
        setIsCumulativeView(newValue);
        localStorage.setItem('isCumulativeView', String(newValue));
    };




    // Local listener removed - consuming global prop from App.jsx

    const addTransactionToDb = async (data) => {
        try {
            // Use provided date or today if missing
            let transactionDate = new Date();
            if (data.date) {
                transactionDate = new Date(data.date);
            }

            const docData = {
                ...data,
                date: transactionDate.toISOString(),
                userId: currentUser.uid,
                month: transactionDate.toISOString().slice(0, 7),
                createdAt: Date.now(),
                isFixed: false
            };

            await addDoc(collection(db, 'transactions'), docData);
            console.log("Transação adicionada via IA:", docData);
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
        
        // Scroll to form
        if (formRef.current) {
            formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const [deleteId, setDeleteId] = useState(null);
    const [deleteData, setDeleteData] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = (transaction) => {
        setDeleteId(transaction.id);
        setDeleteData(transaction);
    };

    const handleClearHistory = async () => {
        if (!currentUser || !window.confirm('Tem certeza? Isso apagará TODAS as transações anteriores a este mês. Esta ação não pode ser desfeita.')) return;

        try {
            setIsDeleting(true);
            const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
            const currentMonth = todayStr.slice(0, 7);

            // Filter all transactions that are NOT in the current month
            const toDelete = transactions.filter(t => getRobustMonth(t) < currentMonth);

            if (toDelete.length === 0) {
                alert('Nenhum dado antigo encontrado para apagar.');
                return;
            }

            const deletePromises = toDelete.map(t => deleteDoc(doc(db, 'transactions', t.id)));
            await Promise.all(deletePromises);

            alert(`${toDelete.length} transações antigas foram apagadas com sucesso!`);
            setShowReport(false);
        } catch (error) {
            console.error("Erro ao limpar histórico:", error);
            alert('Erro ao apagar dados. Tente novamente.');
        } finally {
            setIsDeleting(false);
        }
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
        if (!t.date) return t.month || "";
        try {
            const d = new Date(t.date);
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        } catch (e) {
            return t.month || "";
        }
    };

    const calculateCumulativeBalance = (targetMonth) => {
        // 1. Filter all transactions up to target month
        const allPrev = transactions
            .filter(t => getRobustMonth(t) <= targetMonth)
            .sort((a, b) => {
                const dateDiff = new Date(a.date) - new Date(b.date);
                if (dateDiff !== 0) return dateDiff;
                // Tie-breaker: Resets ('initial_balance' or 'carryover') MUST come first on the same day
                const aIsReset = a.category === 'initial_balance' || a.category === 'carryover';
                const bIsReset = b.category === 'initial_balance' || b.category === 'carryover';
                if (aIsReset && !bIsReset) return -1;
                if (!aIsReset && bIsReset) return 1;
                return 0;
            });

        if (allPrev.length === 0) return 0;

        // 2. Find the most recent "initial_balance" or "carryover" up to that point
        let startIndex = 0;
        for (let i = allPrev.length - 1; i >= 0; i--) {
            const cat = allPrev[i].category;
            if (cat === 'initial_balance' || cat === 'carryover') {
                startIndex = i;
                break;
            }
        }

        // 3. Sum from that point
        return allPrev.slice(startIndex).reduce((acc, t) => {
            const val = parseFloat(t.amount) || 0;
            return t.type === 'income' ? acc + val : acc - val;
        }, 0);
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
        if (deleteId || showReport) {
            const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
            document.body.style.overflow = 'hidden';
            // document.documentElement.style.overflow = 'hidden'; // Removed to avoid layout jumps
            if (scrollBarWidth > 0) {
                document.body.style.paddingRight = `${scrollBarWidth}px`;
            }
            return () => {
                document.body.style.overflow = '';
                // document.documentElement.style.overflow = '';
                document.body.style.paddingRight = '';
            };
        }
    }, [deleteId, showReport]);

    const incomeTotal = useMemo(() => {
        return filteredTransactions
            .filter(t => t.type === 'income')
            .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    }, [filteredTransactions]);

    const displayIncome = useMemo(() => {
        return filteredTransactions
            .filter(t => t.type === 'income' && t.category !== 'initial_balance' && t.category !== 'carryover' && t.category !== 'vault_redemption')
            .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    }, [filteredTransactions]);

    const expense = useMemo(() => {
        return filteredTransactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    }, [filteredTransactions]);

    const displayExpense = useMemo(() => {
        return filteredTransactions
            .filter(t => t.type === 'expense' && t.category !== 'investment' && t.category !== 'vault')
            .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    }, [filteredTransactions]);

    const prevBalanceForBreakdown = useMemo(() => {
        const prevMonthDate = new Date(selectedMonth + '-02');
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
        const prevMonthStr = prevMonthDate.toLocaleDateString('en-CA').slice(0, 7); // YYYY-MM (Local)
        return calculateCumulativeBalance(prevMonthStr);
    }, [transactions, selectedMonth]);

    const monthlyBalance = incomeTotal - expense;
    const displayMonthlyBalance = displayIncome - displayExpense;
    const cumulativeBalance = calculateCumulativeBalance(selectedMonth);

    const totalInvestedFromTransactions = useMemo(() => {
        return transactions.reduce((acc, t) => {
            const val = parseFloat(t.amount) || 0;
            
            // 'Sementinha' and 'Cofre' are additions to invested assets
            if (t.type === 'expense' && (t.category === 'investment' || t.category === 'vault')) {
                return acc + val;
            }
            // 'Resgate Cofre' is removal from invested assets (it returns to wallet/balance)
            if (t.type === 'income' && t.category === 'vault_redemption') {
                return acc - val;
            }
            return acc;
        }, 0);
    }, [transactions]);

    // If manual value exists, it is the BASE. The transactions-sum adds to it.
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
                report[monthKey] = { 
                    income: 0, expense: 0, balance: 0, 
                    realIncome: 0, realExpense: 0, realBalance: 0,
                    date: monthKey 
                };
            }
            
            const val = parseFloat(t.amount) || 0;
            
            // Total Flow
            if (t.type === 'income') {
                report[monthKey].income += val;
                report[monthKey].balance += val;
            } else {
                report[monthKey].expense += val;
                report[monthKey].balance -= val;
            }

            // Real Flow (excluding transfers/initial balance)
            if (t.type === 'income') {
                if (t.category !== 'initial_balance' && t.category !== 'carryover' && t.category !== 'vault_redemption') {
                    report[monthKey].realIncome += val;
                    report[monthKey].realBalance += val;
                }
            } else {
                if (t.category !== 'investment' && t.category !== 'vault') {
                    report[monthKey].realExpense += val;
                    report[monthKey].realBalance -= val;
                }
            }
        });
        return Object.values(report).sort((a, b) => b.date.localeCompare(a.date));
    }, [transactions]);

    const exportToPDF = () => {
        generatePDF(transactions, selectedMonth, logo, showRealFlow);
    };

    return (
        <div className="space-y-6 relative">
            {/* Report Modal */}
            {showReport && createPortal(
                <div key="report-portal-wrapper" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
                    <div className={`border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl ring-1 ring-white/10 ${
                        theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700/50'
                    }`}>
                        <div className={`p-6 border-b flex flex-col md:flex-row md:justify-between md:items-center gap-4 ${
                            theme === 'light' ? 'bg-[#f0fdfa] border-emerald-100/50' : 'bg-slate-800/50 border-slate-800'
                        }`}>
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-blue-500" />
                                    <h3 className={`text-xl font-bold italic ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>Relatório Mensal</h3>
                                </div>
                                <div className="flex items-center gap-4 mt-2">
                                    <div className={`flex p-1 rounded-xl border ${theme === 'light' ? 'bg-white/50 border-emerald-100' : 'bg-slate-900/50 border-slate-700'}`}>
                                        <button
                                            onClick={() => setShowRealFlow(true)}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                                showRealFlow 
                                                ? (theme === 'light' ? 'bg-emerald-500 text-white shadow-md' : 'bg-emerald-600 text-white shadow-md') 
                                                : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            Fluxo Real
                                        </button>
                                        <button
                                            onClick={() => setShowRealFlow(false)}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                                !showRealFlow 
                                                ? (theme === 'light' ? 'bg-blue-500 text-white shadow-md' : 'bg-blue-600 text-white shadow-md') 
                                                : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            Fluxo Total
                                        </button>
                                    </div>
                                    <span className="text-xs text-slate-500 italic hidden md:block">
                                        {showRealFlow ? "*Ignora aportes no Cofre e Investimentos" : "*Mostra todas as movimentações brutas"}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleClearHistory}
                                    disabled={isDeleting}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50 ${
                                        theme === 'light' 
                                        ? 'border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100' 
                                        : 'border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                                    }`}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    {isDeleting ? 'Limpando...' : 'Zerar Histórico Antigo'}
                                </button>
                                <button onClick={() => setShowReport(false)} className={`p-2 rounded-lg transition-colors ${
                                    theme === 'light' ? 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-500' : 'hover:bg-slate-700 text-slate-400 hover:text-white'
                                }`}>
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                        <div className="overflow-y-auto p-6 space-y-4 custom-scrollbar">
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
                                        className={`p-4 rounded-xl border transition-all cursor-pointer group active:scale-[0.99] ${
                                            theme === 'light' 
                                            ? 'bg-white border-emerald-100/50 hover:border-emerald-200 hover:bg-emerald-50/30' 
                                            : 'bg-slate-800/30 border-slate-700 hover:bg-slate-700/30 hover:border-blue-500/30'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className={`font-bold text-lg capitalize ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
                                                {new Date(month.date + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                            </h4>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                (showRealFlow ? month.realBalance : month.balance) >= 0 
                                                ? 'bg-emerald-500/10 text-emerald-500' 
                                                : 'bg-rose-500/10 text-rose-500'
                                            }`}>
                                                {(showRealFlow ? month.realBalance : month.balance) >= 0 ? 'Positivo' : 'Negativo'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <p className="text-xs text-slate-500 mb-1">Entradas</p>
                                                <p className="text-emerald-500 font-medium">
                                                    + R$ {(showRealFlow ? month.realIncome : month.income).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 mb-1">Saídas</p>
                                                <p className="text-rose-500 font-medium">
                                                    - R$ {(showRealFlow ? month.realExpense : month.expense).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-slate-500 mb-1">
                                                    {showRealFlow ? 'Saldo Real (Mês)' : (isCumulativeView ? 'Saldo Acumulado' : 'Saldo do Mês')}
                                                </p>
                                                <p className={`font-bold ${(showRealFlow ? month.realBalance : month.balance) >= 0 ? (theme === 'light' ? 'text-blue-600' : 'text-blue-400') : 'text-rose-500'}`}>
                                                    R$ {(showRealFlow ? month.realBalance : (isCumulativeView ? calculateCumulativeBalance(month.date) : month.balance)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>,
                document.body
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
                        <div className="relative group/card overflow-visible">
                            <Card
                                title={isCumulativeView ? "Saldo em Carteira" : "Saldo do Mês (Real)"}
                                value={isCumulativeView ? cumulativeBalance : displayMonthlyBalance}
                                icon={Wallet}
                                color={isCumulativeView
                                    ? (cumulativeBalance >= 0 ? "text-emerald-400" : "text-rose-400")
                                    : (displayMonthlyBalance >= 0 ? "text-blue-400" : "text-rose-400")
                                }
                                highlight={true}
                                isHidable={true}
                                isHidden={hideBalance}
                                onToggle={toggleBalance}
                                detail={isCumulativeView
                                    ? (() => {
                                        // Check if there is an "opening" reset in the current month
                                        const hasResetInMonth = filteredTransactions.some(t => t.category === 'initial_balance' || t.category === 'carryover');
                                        if (hasResetInMonth) {
                                            return `Valor atualizado em conta (com ajuste de saldo)`;
                                        }
                                        const prevText = prevBalanceForBreakdown.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                                        const monthlyText = monthlyBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                                        return `R$ ${prevText} (Anterior) + R$ ${monthlyText} (Mês)`;
                                    })()
                                    : "Resultado operacional apenas deste mês"}
                            />
                            <button
                                onClick={toggleCumulativeView}
                                className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold border transition-all z-20 shadow-xl ${isCumulativeView
                                    ? 'bg-blue-600 border-blue-400 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                {isCumulativeView ? 'Ver Mensal' : 'Ver Acumulado'}
                            </button>
                        </div>
                        <Card
                            title="Patrimônio Investido"
                            value={totalPatrimonio}
                            icon={TrendingUp}
                            color="text-purple-400"
                            isHidable={true}
                            isHidden={hidePatrimonio}
                            onToggle={togglePatrimonio}
                        />
                        <Card title="Ganhos (Mês)" value={displayIncome} icon={ArrowUpCircle} color="text-emerald-400" />
                        <Card title="Gastos (Mês)" value={displayExpense} icon={ArrowDownCircle} color="text-rose-400" />
                    </>
                )}
            </div>

            {/* Input Form */}
            <form ref={formRef} key={editingId || 'new-form'} onSubmit={handleSubmit} className={`p-6 md:p-8 rounded-3xl border shadow-2xl grid grid-cols-1 md:grid-cols-12 gap-4 ${
                theme === 'light' ? 'glass-card border-emerald-100/50' : 'bg-[#111827]/80 backdrop-blur-xl border-white/5'
            }`}>
                <div className="md:col-span-12">
                    <h3 className={`text-lg font-bold mb-2 flex items-center gap-2 ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
                        {editingId ? <Pencil className="w-5 h-5 text-blue-500" /> : <LayoutDashboard className="w-5 h-5 text-verde-respira" />}
                        {editingId ? 'Editar Transação' : 'Nova Transação'}
                    </h3>
                </div>

                {/* Row 1: Description, Value, Date */}
                <div className="md:col-span-6">
                    <label className={`block text-xs font-medium mb-1 ml-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Descrição</label>
                    <input
                        type="text"
                        placeholder="Ex: Mercado, Aluguel..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-all ${
                            theme === 'light' 
                            ? 'bg-[#f0fdfa]/50 border-emerald-100/50 text-slate-800 focus:ring-emerald-500/20 placeholder:text-slate-400' 
                            : 'bg-slate-900 border-slate-700 text-slate-200 focus:ring-blue-500/50 placeholder:text-slate-500'
                        }`}
                    />
                </div>
                <div className="md:col-span-3">
                    <label className={`block text-xs font-medium mb-1 ml-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Valor</label>
                    <input
                        type="number"
                        placeholder="R$ 0,00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-all ${
                            theme === 'light' 
                            ? 'bg-[#f0fdfa]/50 border-emerald-100/50 text-slate-800 focus:ring-emerald-500/20 placeholder:text-slate-400' 
                            : 'bg-slate-900 border-slate-700 text-slate-200 focus:ring-blue-500/50 placeholder:text-slate-500'
                        }`}
                    />
                </div>
                <div className="md:col-span-3">
                    <label className={`block text-xs font-medium mb-1 ml-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Data</label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-all ${
                            theme === 'light' 
                            ? 'bg-[#f0fdfa]/50 border-emerald-100/50 text-slate-800 focus:ring-emerald-500/20 [color-scheme:light]' 
                            : 'bg-slate-900 border-slate-700 text-slate-200 focus:ring-blue-500/50 [color-scheme:dark]'
                        }`}
                    />
                </div>

                {/* Row 2: Category Selector (Full Width) */}
                <div className="md:col-span-12">
                    <label className={`block text-xs font-medium mb-1 ml-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Categoria</label>
                    <div className={`grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-1 p-1.5 border rounded-xl max-h-[180px] overflow-y-auto scrollbar-thin ${
                        theme === 'light' ? 'bg-[#f0fdfa]/50 border-emerald-100/50 scrollbar-thumb-slate-200' : 'bg-slate-900 border-slate-700 scrollbar-thumb-slate-800'
                    }`}>
                        {(type === 'income' ? CATEGORIES.income : CATEGORIES.expense).map(cat => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setCategory(cat)}
                                className={`p-1.5 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${
                                    category.id === cat.id 
                                    ? (theme === 'light' ? 'bg-verde-respira/20 ring-1 ring-verde-respira/50' : 'bg-slate-700 ring-1 ring-slate-500') 
                                    : (theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-slate-800')
                                }`}
                                title={cat.label}
                            >
                                <cat.icon className={`w-4 h-4 ${cat.color}`} />
                                <span className={`text-[9px] truncate w-full text-center ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>{cat.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Informative Tip */}
                    {(category.id === 'initial_balance' || category.id === 'carryover' || (type === 'expense' && category.id === 'investment') || category.id === 'vault' || category.id === 'vault_redemption') && (
                        <div className={`mt-3 p-3 border rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${
                            theme === 'light' ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-500/10 border-blue-500/30'
                        }`}>
                            <Info className={`w-4 h-4 shrink-0 mt-0.5 ${theme === 'light' ? 'text-blue-500' : 'text-blue-400'}`} />
                            <p className={`text-[11px] leading-relaxed ${theme === 'light' ? 'text-blue-700' : 'text-blue-300'}`}>
                                {category.id === 'initial_balance' && "O 'Saldo Inicial' é para calibrar o app: use para igualar o saldo oficial hoje com o que você tem no banco e começar do zero."}
                                {category.id === 'carryover' && "A 'Sobra de Mês' é para continuidade: use na virada do mês para trazer o lucro acumulado que sobrou do mês anterior sem contar como salário."}
                                {category.id === 'investment' && "Lançar como 'Investimento' não conta como um gasto comum, pois esse valor continua protegendo o seu futuro."}
                                {category.id === 'vault' && "Lançamentos no 'Cofre' são reservas de patrimônio e ajudam a separar o que você não pretende gastar logo."}
                                {category.id === 'vault_redemption' && "O 'Resgate Cofre' é uma transferência de volta para sua carteira e não será contabilizado como um ganho real (salário) no mês."}
                            </p>
                        </div>
                    )}
                </div>

                {/* Row 3: Toggles and Actions */}
                <div className="md:col-span-12 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mt-2">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                        <label className="inline-flex items-center cursor-pointer select-none group">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={isRecurring}
                                onChange={(e) => setIsRecurring(e.target.checked)}
                            />
                            <div className={`relative w-9 h-5 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:rounded-full after:h-4 after:w-4 after:transition-all transition-colors ${
                                theme === 'light' 
                                ? 'bg-slate-200 peer-checked:bg-blue-500 after:bg-white after:shadow-sm' 
                                : 'bg-slate-700 peer-checked:bg-blue-600 after:bg-slate-400'
                            }`}></div>
                            <span className={`ms-2 text-xs font-medium transition-colors ${theme === 'light' ? 'text-slate-500 group-hover:text-slate-700' : 'text-slate-400 group-hover:text-slate-200'}`}>Parcelado</span>
                        </label>

                        <label className="inline-flex items-center cursor-pointer select-none group">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={category.isFixed || false}
                                onChange={(e) => setCategory({ ...category, isFixed: e.target.checked })}
                            />
                            <div className={`relative w-9 h-5 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:rounded-full after:h-4 after:w-4 after:transition-all transition-colors ${
                                theme === 'light' 
                                ? 'bg-slate-200 peer-checked:bg-rose-500 after:bg-white after:shadow-sm' 
                                : 'bg-slate-700 peer-checked:bg-rose-600 after:bg-slate-400'
                            }`}></div>
                            <span className={`ms-2 text-xs font-medium transition-colors ${theme === 'light' ? 'text-slate-500 group-hover:text-slate-700' : 'text-slate-400 group-hover:text-slate-200'}`}>Fixa</span>
                        </label>
                        {isRecurring && (
                            <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-left-2 transition-all">
                                <div className="flex items-center gap-4 transition-all">
                                    <div className={`flex items-center gap-2 ${theme === 'light' ? 'text-slate-600' : 'text-slate-200'}`}>
                                        <label className={`text-[10px] font-bold uppercase ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>Parcelas:</label>
                                        <input
                                            type="number"
                                            min="2"
                                            max="60"
                                            value={installments}
                                            onChange={(e) => setInstallments(parseInt(e.target.value))}
                                            className={`w-14 border rounded-lg px-2 py-1 text-sm focus:outline-none transition-all ${
                                                theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-400' : 'bg-slate-900/50 border-slate-700 text-slate-200 focus:border-blue-500/50'
                                            }`}
                                        />
                                    </div>
                                    <div className={`flex p-1 rounded-lg border ${
                                        theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/50 border-slate-700'
                                    }`}>
                                        <button
                                            type="button"
                                            onClick={() => setInstallmentValueMode('total')}
                                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${installmentValueMode === 'total'
                                                ? (theme === 'light' ? 'bg-blue-500 text-white shadow-sm' : 'bg-blue-600 text-white shadow-sm')
                                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                                }`}
                                        >
                                            Valor Total
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setInstallmentValueMode('monthly')}
                                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${installmentValueMode === 'monthly'
                                                ? (theme === 'light' ? 'bg-blue-500 text-white shadow-sm' : 'bg-blue-600 text-white shadow-sm')
                                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                                }`}
                                        >
                                            Mensal
                                        </button>
                                    </div>
                                </div>
                                <div className={`text-[10px] font-medium animate-in fade-in slide-in-from-left-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {installmentValueMode === 'total' ? (
                                        <span>
                                            O valor de <strong className={theme === 'light' ? 'text-slate-700' : 'text-slate-200'}>R$ {(parseFloat(amount) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> será dividido em {installments}x de <strong className={theme === 'light' ? 'text-blue-600' : 'text-blue-400'}>R$ {((parseFloat(amount) || 0) / installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.
                                        </span>
                                    ) : (
                                        <span>
                                            O valor de <strong className={theme === 'light' ? 'text-slate-700' : 'text-slate-200'}>R$ {(parseFloat(amount) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> será lançado integralmente em cada um dos próximos {installments} meses.
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        <div className={`flex p-1 rounded-xl border ${
                            theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/50 border-slate-700'
                        }`}>
                            <button
                                type="button"
                                onClick={() => { setType('income'); setCategory(CATEGORIES.income[CATEGORIES.income.length - 1]); }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${type === 'income'
                                    ? 'bg-emerald-500/20 text-emerald-500 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                                    }`}
                            >
                                <ArrowUpCircle className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => { setType('expense'); setCategory(CATEGORIES.expense[CATEGORIES.expense.length - 1]); }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${type === 'expense'
                                    ? 'bg-rose-500/20 text-rose-500 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                                    }`}
                            >
                                <ArrowDownCircle className="w-4 h-4" />
                            </button>
                        </div>

                        <button type="submit" className={`flex-1 px-6 font-bold py-2 rounded-xl shadow-lg transition-all ${
                            theme === 'light' 
                            ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/10' 
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
                        }`}>
                            {editingId ? 'Salvar' : 'Adicionar'}
                        </button>
                    </div>
                </div>
            </form >

            {/* List Header & Filter */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className={`text-xl font-bold ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>Transações</h3>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={exportToPDF}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm font-medium shadow-sm ${
                                theme === 'light' 
                                ? 'bg-white/30 border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50/50' 
                                : 'bg-white/5 border-white/5 text-slate-400 hover:text-blue-400 hover:bg-white/10'
                            }`}
                            title="Baixar Relatório em PDF"
                        >
                            <Download className="w-4 h-4" />
                            PDF
                        </button>
                        <button
                            onClick={() => setShowReport(true)}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm font-medium shadow-sm ${
                                theme === 'light' 
                                ? 'bg-white/30 border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50/50' 
                                : 'bg-white/5 border-white/5 text-slate-400 hover:text-blue-400 hover:bg-white/10'
                            }`}
                        >
                            <FileText className="w-4 h-4" />
                            Relatórios
                        </button>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border w-full md:w-auto shadow-sm ${
                        theme === 'light' ? 'bg-white/20 border-slate-200' : 'bg-white/5 border-white/5'
                    }`}>
                        <Calendar className={`w-4 h-4 ${theme === 'light' ? 'text-verde-respira' : 'text-verde-respira/70'}`} />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className={`bg-transparent text-sm focus:outline-none w-full ${
                                theme === 'light' ? 'text-slate-700 [color-scheme:light]' : 'text-slate-200 [color-scheme:dark]'
                            }`}
                        />
                    </div>
                </div>
            </div>

            {/* Analytics Chart & Advisor */}
            <div className={`grid grid-cols-1 ${transactions.length === 0 && !manualConfig.income ? '' : (isAliviaConfiguring ? 'lg:grid-cols-1' : 'lg:grid-cols-2')} gap-8 mb-8 animate-in slide-in-from-bottom-5 fade-in duration-500`}>
                {!isAliviaConfiguring && <ExpensesChart transactions={chartTransactions} />}
                <FinancialAdvisor
                    transactions={transactions}
                    manualConfig={manualConfig}
                    onConfigChange={updateManualConfig}
                    onToggleConfig={setIsAliviaConfiguring}
                />
            </div>

            {/* Category Filter & Search */}
            <div className="mb-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Filtrar por Categoria</h4>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border w-full md:w-72 shadow-sm focus-within:ring-2 transition-all ${
                        theme === 'light' 
                        ? 'bg-white/20 border-slate-200 focus-within:ring-blue-500/10 focus-within:border-blue-400' 
                        : 'bg-white/5 border-white/5 focus-within:border-azul-ceu'
                    }`}>
                        <Search className="w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar transação..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`bg-transparent text-sm focus:outline-none w-full ${
                                theme === 'light' ? 'text-slate-700 placeholder:text-slate-400' : 'text-slate-200 placeholder:text-slate-500'
                            }`}
                        />
                    </div>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <button
                        onClick={() => setFilterCategory('all')}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${filterCategory === 'all'
                            ? (theme === 'light' ? 'bg-blue-500 text-white border-blue-400 shadow-md' : 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/25')
                            : (theme === 'light' ? 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50' : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200')
                            }`}
                    >
                        Todos
                    </button>
                    {CATEGORIES.expense.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setFilterCategory(cat.id)}
                            className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap border flex items-center gap-2 ${filterCategory === cat.id
                                ? (theme === 'light' ? 'bg-[#69C8B9] text-white border-[#69C8B9] shadow-md' : 'bg-[#69C8B9] text-white border-[#69C8B9] shadow-lg shadow-[#69C8B9]/25')
                                : (theme === 'light' ? 'bg-white/30 text-slate-500 border-slate-200 hover:bg-slate-50 shadow-sm' : 'bg-white/5 text-slate-500 border-white/5 hover:bg-white/10 hover:text-slate-300 shadow-sm')
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
                                ? (theme === 'light' ? 'bg-blue-500 text-white border-blue-400 shadow-md' : 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/25')
                                : (theme === 'light' ? 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 shadow-sm' : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200')
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
                        <div className={`text-center py-10 rounded-2xl border border-dashed ${
                            theme === 'light' ? 'bg-verde-respira/5 border-verde-respira/30 text-slate-500' : 'bg-verde-respira/5 border-verde-respira/20 text-slate-400'
                        }`}>
                            Nenhuma transação neste mês.
                        </div>
                    ) : (
                        filteredTransactions.map((t) => (
                            <div key={t.id} className={`group backdrop-blur-md p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm ${
                                theme === 'light' 
                                ? 'bg-white/20 border-white/50 hover:border-verde-respira/30 hover:bg-white/30' 
                                : 'bg-white/5 border-white/5 hover:border-white/10'
                            }`}>
                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <div className={`p-3 rounded-xl border ${
                                        theme === 'light' ? 'bg-white/20 border-white/20' : 'bg-white/5 border-white/5'
                                    }`}>
                                        {(() => {
                                            // Resolve Icon
                                            const catList = t.type === 'income' ? CATEGORIES.income : CATEGORIES.expense;
                                            const foundCat = catList.find(c => c.id === t.category) || catList.find(c => c.id === 'other') || { icon: Circle, color: 'text-slate-400' };
                                            const IconComponent = foundCat.icon;
                                            return <IconComponent className={`w-6 h-6 ${foundCat.color}`} />;
                                        })()}
                                    </div>
                                    <div>
                                        <h4 className={`font-bold ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>{t.description}</h4>
                                        <p className={`text-xs flex items-center gap-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {new Date(t.date).toLocaleDateString()}
                                            <span className={`w-1 h-1 rounded-full ${theme === 'light' ? 'bg-slate-300' : 'bg-slate-600'}`}></span>
                                            {(() => {
                                                const catList = t.type === 'income' ? CATEGORIES.income : CATEGORIES.expense;
                                                const foundCat = catList.find(c => c.id === t.category);
                                                return foundCat ? foundCat.label : 'Geral';
                                            })()}
                                            {t.isFixed && (
                                                <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                                    theme === 'light' ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-rose-500/20 text-rose-300 border-rose-500/20'
                                                }`}>
                                                    Fixa
                                                </span>
                                            )}
                                            {t.description.match(/\(\d+\/\d+\)/) && (
                                                <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                                    theme === 'light' ? 'bg-blue-50 text-blue-500 border-blue-100' : 'bg-blue-500/20 text-blue-300 border-blue-500/20'
                                                }`}>
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
                                        <button key="btn-item-edit" onClick={() => handleEdit(t)} className={`p-2 rounded-lg transition-colors ${
                                            theme === 'light' ? 'bg-white/30 hover:bg-blue-50/50 text-slate-400 hover:text-blue-500' : 'bg-slate-700/50 hover:bg-blue-500/10 text-slate-400 hover:text-blue-400'
                                        }`}>
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button key="btn-item-delete" onClick={() => handleDelete(t)} className={`p-2 rounded-lg transition-colors ${
                                            theme === 'light' ? 'bg-white/30 hover:bg-rose-50/50 text-slate-400 hover:text-rose-500' : 'bg-slate-700/50 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400'
                                        }`}>
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
                    <div key="modal-backdrop" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                        <div
                            key="modal-card"
                            className={`border rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden ${
                                theme === 'light' ? 'bg-white border-verde-respira/20' : 'bg-slate-900 border-slate-700/50'
                            }`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Inner Glow/Aesthetics */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                            <div key="modal-content" className="flex flex-col items-center text-center gap-6">
                                <div key="modal-icon-bg" className="p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                                    <Trash2 className="w-10 h-10 text-rose-500" />
                                </div>

                                <div key="modal-text" className="space-y-2">
                                    <h3 key="modal-title" className={`text-xl font-bold tracking-tight ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>Excluir Transação?</h3>
                                    <p key="modal-desc" className={`text-sm leading-relaxed px-4 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                                        Esta ação removerá permanentemente este item do seu histórico e não poderá ser desfeita.
                                    </p>
                                </div>

                                {deleteData && (deleteData.isFixed || deleteData.description.match(/\(\d+\/\d+\)/)) ? (
                                    <div key="actions-recurring" className="flex flex-col items-center gap-3 w-full mt-2">
                                        <button
                                            key="btn-delete-only"
                                            onClick={() => confirmDelete(false)}
                                            className={`w-64 px-4 py-3 rounded-xl transition-all font-semibold text-sm border shadow-lg ${
                                                theme === 'light' ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                                            }`}
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
                                            className={`w-64 px-4 py-3 transition-colors text-xs font-medium ${
                                                theme === 'light' ? 'text-slate-400 hover:text-slate-700' : 'text-slate-600 hover:text-slate-300'
                                            }`}
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
                                            className={`w-64 px-4 py-3 transition-colors text-xs font-medium ${
                                                theme === 'light' ? 'text-slate-400 hover:text-slate-700' : 'text-slate-600 hover:text-slate-300'
                                            }`}
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
