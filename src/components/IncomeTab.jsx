import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { TrendingUp, TrendingDown, Wallet, Trash2, ArrowUpCircle, CircleDollarSign, Loader2, Pencil, X, Landmark, ArrowDownCircle, ChevronLeft, ChevronRight, Settings, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { CATEGORIES } from '../constants/categories';

export default function IncomeTab({ transactions, savingsJars, walletStats, hideBalance, toggleHideBalance }) {
    const { theme } = useTheme();
    const { currentUser } = useAuth();
    
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(() => {
        const now = new Date();
        return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    });
    const [isUSD, setIsUSD] = useState(false);
    const [usdRate, setUsdRate] = useState(null);
    const [isLoadingRate, setIsLoadingRate] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showRescueModal, setShowRescueModal] = useState(false);
    const [rescueAmount, setRescueAmount] = useState('');
    const [selectedJarId, setSelectedJarId] = useState('');
    const [isRescuing, setIsRescuing] = useState(false);
    const [cdiRate, setCdiRate] = useState(10.65);
    const [subTab, setSubTab] = useState('recebimentos'); // 'recebimentos' | 'resgates'
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [showIncomeModal, setShowIncomeModal] = useState(false);
    const [incomeStep, setIncomeStep] = useState('form'); // 'form' | 'confirm'
    const [isSaving, setIsSaving] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState(null);
    const [incomesPeriod, setIncomesPeriod] = useState(() => localStorage.getItem('alivia_incomes_period_tab') || 'month');
    const [showIncomesConfig, setShowIncomesConfig] = useState(false);

    const handleIncomesPeriodChange = (period) => {
        setIncomesPeriod(period);
        localStorage.setItem('alivia_incomes_period_tab', period);
        setShowIncomesConfig(false);
    };

    const incomesPeriodLabel = {
        'month': '(Mês)',
        '15d': '(15d)',
        '30d': '(30d)'
    }[incomesPeriod];
    
    // Fetch USD rate once
    useEffect(() => {
        const fetchRate = async () => {
            setIsLoadingRate(true);
            try {
                const response = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
                const data = await response.json();
                setUsdRate(parseFloat(data.USDBRL.ask));
                
                // Buscar CDI também
                const cdiRes = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json');
                const cdiData = await cdiRes.json();
                if (cdiData && cdiData[0] && cdiData[0].valor) {
                    setCdiRate(parseFloat(cdiData[0].valor) * 365);
                }
            } catch (error) {
                console.error("Erro ao buscar cotações:", error);
                setUsdRate(5.0); // Fallback
            } finally {
                setIsLoadingRate(false);
            }
        };
        fetchRate();
    }, []);

    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        if (!amount || !description || !currentUser) return;
        setIncomeStep('confirm');
    };

    const handleFinalSave = async () => {
        if (isSaving) return;
        
        const val = parseFloat(amount);
        if (!val || !description || !currentUser) {
            alert("Preencha todos os campos!");
            return;
        }

        setIsSaving(true);

        try {
            let finalAmount = val;
            if (isUSD && usdRate) {
                finalAmount = finalAmount * usdRate;
            }

            let transactionDate = new Date();
            if (date.includes('-')) {
                const [y, m, d] = date.split('-').map(Number);
                transactionDate = new Date(y, m - 1, d, 12, 0, 0);
            }

            const transactionData = {
                description: isUSD && !editingId ? `${description} (U$ ${val.toFixed(2)})` : description,
                amount: finalAmount,
                type: 'income',
                category: 'other', // Default simplificada
                date: transactionDate.toISOString(),
                userId: currentUser.uid,
                month: transactionDate.toISOString().slice(0, 7),
                updatedAt: Date.now(),
                isFixed: false
            };

            // Categorização rápida
            const low = description.toLowerCase();
            if (low.includes('salário') || low.includes('salario')) transactionData.category = 'salary';
            else if (low.includes('freela')) transactionData.category = 'freelance';

            if (editingId) {
                const { createdAt, ...upd } = transactionData;
                await updateDoc(doc(db, 'transactions', editingId), upd);
            } else {
                await addDoc(collection(db, 'transactions'), {
                    ...transactionData,
                    createdAt: Date.now()
                });
            }

            // AQUI É O PONTO CRÍTICO: Reset imediato
            setShowIncomeModal(false);
            setAmount('');
            setDescription('');
            setEditingId(null);
            setIncomeStep('form');
            
            console.log("Salvo com sucesso no Localhost");
        } catch (error) {
            console.error("Erro no salvamento:", error);
            alert("Erro ao salvar: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditInitiate = (inc) => {
        handleEdit(inc);
        setIncomeStep('form');
        setShowIncomeModal(true);
    };

    const handleEdit = (inc) => {
        setEditingId(inc.id);
        setDescription(inc.description);
        setAmount(inc.amount.toString());
        const d = new Date(inc.date);
        setDate(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
        setIsUSD(false); // Reset USD on edit for simplicity
    };

    const handleDelete = (id) => {
        setTransactionToDelete(id);
    };

    const confirmDelete = async () => {
        if (!transactionToDelete) return;
        try {
            await deleteDoc(doc(db, 'transactions', transactionToDelete));
        } catch (error) {
            console.error("Erro ao deletar:", error);
        } finally {
            setTransactionToDelete(null);
        }
    };

    // Total available in investments
    const totalAvailable = savingsJars?.reduce((acc, jar) => acc + (parseFloat(jar.balance) || 0), 0) || 0;

    const handleRescue = async (e) => {
        e.preventDefault();
        if (!currentUser) return;

        const val = parseFloat(rescueAmount);
        if (!val || val <= 0 || !selectedJarId || isRescuing) return;

        const targetJar = savingsJars?.find(j => j.id === selectedJarId);
        if (!targetJar || val > (parseFloat(targetJar.balance) || 0)) {
            return;
        }

        setIsRescuing(true);
        // Fechar modal imediatamente para dar feedback visual de que o comando foi aceito
        setShowRescueModal(false);

        try {
            const now = new Date();
            const isoDate = now.toISOString();
            const monthStr = isoDate.slice(0, 7);

            // 1. Update Specific Jar
            const cdiAnual = cdiRate / 100;
            const percent = (targetJar.cdiPercent || 100) / 100;
            const dailyRate = Math.pow(1 + (cdiAnual * percent), 1 / 365) - 1;
            const lastUpdate = targetJar.updatedAt ? new Date(targetJar.updatedAt) : (targetJar.createdAt ? new Date(targetJar.createdAt) : new Date());
            const diffDays = Math.max(0, now - lastUpdate) / (1000 * 60 * 60 * 24);
            const dynamicBalance = targetJar.balance * Math.pow(1 + dailyRate, diffDays);

            const newBalance = dynamicBalance - val;
            const jarUpdate = updateDoc(doc(db, 'savings_jars', targetJar.id), {
                balance: newBalance,
                updatedAt: isoDate
            });

            // 2. Add Income Transaction
            const transAdd = addDoc(collection(db, 'transactions'), {
                description: `Resgate: ${targetJar.name}`,
                amount: val,
                type: 'income',
                category: 'vault_redemption',
                date: isoDate,
                userId: currentUser.uid,
                month: monthStr,
                createdAt: Date.now()
            });

            // Executa ambos em paralelo para ser mais rápido
            await Promise.all([jarUpdate, transAdd]);

            // Limpar estados
            setRescueAmount('');
            setSelectedJarId('');
            
            console.log("Resgate processado com sucesso!");
        } catch (error) {
            console.error("Erro ao resgatar:", error);
            alert('Erro ao processar resgate. Verifique sua conexão.');
        } finally {
            setIsRescuing(false);
        }
    };

    // Navigation Logic
    const handlePrevMonth = () => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const prev = new Date(year, month - 2, 1);
        setSelectedMonth(prev.toISOString().slice(0, 7));
    };

    const handleNextMonth = () => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const next = new Date(year, month, 1);
        setSelectedMonth(next.toISOString().slice(0, 7));
    };

    const monthLabel = useMemo(() => {
        const [year, month] = selectedMonth.split('-').map(Number);
        return new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }, [selectedMonth]);

    const selectedMonthName = useMemo(() => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const name = new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'long' });
        return name.charAt(0).toUpperCase() + name.slice(1);
    }, [selectedMonth]);

    // Logic to filter transactions for the selected month
    const currentMonthKey = selectedMonth;

    // 1. Regular Incomes (Salary, Freelance, etc)
    const filteredIncomes = useMemo(() => {
        const today = new Date();
        
        return transactions.filter(t => {
            const isIncome = t.type === 'income';
            const isNotSpecial = !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category);
            
            if (!isIncome || !isNotSpecial) return false;
            
            if (incomesPeriod === 'month') {
                return t.month === selectedMonth || (t.date && t.date.startsWith(selectedMonth));
            }
            const txDate = new Date(t.date);
            const diffDays = (today - txDate) / (1000 * 60 * 60 * 24);
            if (incomesPeriod === '15d') return diffDays <= 15;
            if (incomesPeriod === '30d') return diffDays <= 30;
            return true;
        });
    }, [transactions, incomesPeriod, selectedMonth]);

    const recentIncomes = useMemo(() => {
        return [...filteredIncomes].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [filteredIncomes]);

    const totalIncomeFiltered = useMemo(() => {
        return filteredIncomes.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    }, [filteredIncomes]);

    // 2. Redemptions (Moving from Patrimony to Wallet)
    const recentRedemptions = useMemo(() => {
        return transactions.filter(t => {
            const isIncome = t.type === 'income';
            const isRedemption = t.category === 'vault_redemption' || (t.description && t.description.includes('Resgate:'));
            const matchesMonth = t.month === currentMonthKey || (t.date && t.date.slice(0, 7) === currentMonthKey);
            return isIncome && isRedemption && matchesMonth;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [transactions, currentMonthKey]);

    const totalRedemptionMonth = useMemo(() => recentRedemptions.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0), [recentRedemptions]);

    const totalExpensesMonth = useMemo(() => {
        return transactions.filter(t => {
            const isExpense = t.type === 'expense';
            const matchesMonth = t.month === currentMonthKey || (t.date && t.date.startsWith(currentMonthKey));
            return isExpense && matchesMonth && t.paymentMethod !== 'credito' && t.category !== 'investment';
        }).reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    }, [transactions, currentMonthKey]);

    const totalIncomeMonth = useMemo(() => {
        return transactions.filter(t => {
            const isIncome = t.type === 'income';
            const isNotSpecial = !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category);
            const matchesMonth = t.month === currentMonthKey || (t.date && t.date.startsWith(currentMonthKey));
            return isIncome && isNotSpecial && matchesMonth;
        }).reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    }, [transactions, currentMonthKey]);

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    const cardBg = theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-[#1e2330]';
    const textColor = theme === 'light' ? 'text-slate-800' : 'text-white';
    const subTextColor = theme === 'light' ? 'text-slate-500' : 'text-slate-400';

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-center pt-8 pb-4">
                <h2 className={`text-xl font-medium tracking-wide uppercase ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Gestão de Recebimentos</h2>
            </div>

            {/* Navigation Row */}
            <div className="flex flex-col items-center gap-4 mb-8">
                {/* Tabs on top */}
                <div className="flex gap-6 border-b border-slate-700/50">
                    <button 
                        onClick={() => setSubTab('recebimentos')}
                        className={`pb-3 px-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                            subTab === 'recebimentos' 
                            ? 'border-emerald-400 text-emerald-400' 
                            : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        Recebimentos
                    </button>
                    <button 
                        onClick={() => setSubTab('resgates')}
                        className={`pb-3 px-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                            subTab === 'resgates' 
                            ? 'border-emerald-400 text-emerald-400' 
                            : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        Resgates
                    </button>
                </div>

                {/* Month Selector below */}
                <div className={`flex items-center rounded-lg border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#1e2330] border-slate-700/50'}`}>
                    <button onClick={handlePrevMonth} className="p-2 text-slate-400 hover:text-white transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className={`px-4 text-[10px] font-bold uppercase min-w-[140px] text-center ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
                        {monthLabel}
                    </span>
                    <button onClick={handleNextMonth} className="p-2 text-slate-400 hover:text-white transition-colors">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {subTab === 'recebimentos' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Cards Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Saldo em Carteira */}
                        <div className={`p-5 rounded-xl flex flex-col justify-center gap-3 ${theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="text-blue-400">
                                        <Wallet className="w-4 h-4" />
                                    </div>
                                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Saldo em Carteira</span>
                                </div>
                                <button onClick={toggleHideBalance} className={`text-slate-500 hover:text-white transition-colors ${theme === 'light' ? 'hover:text-slate-800' : ''}`}>
                                    {hideBalance ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            <div className={`text-2xl font-bold ${hideBalance ? 'blur-md' : ''} ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                {hideBalance ? 'R$ 0,00' : formatCurrency(walletStats?.balance)}
                            </div>
                        </div>

                        {/* Recebimentos no Mês */}
                        <div className={`p-5 rounded-xl flex flex-col justify-center gap-3 ${theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]'}`}>
                            <div className="flex items-center gap-2">
                                <div className="text-emerald-400">
                                    <TrendingUp className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Recebimentos no Mês</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex gap-0.5 items-end text-emerald-500 pb-1">
                                    <div className="w-1 h-2 bg-emerald-500 rounded-sm"></div>
                                    <div className="w-1 h-3 bg-emerald-500 rounded-sm"></div>
                                    <div className="w-1 h-4 bg-emerald-500 rounded-sm"></div>
                                </div>
                                <div className="text-2xl font-bold text-emerald-400">
                                    {formatCurrency(totalIncomeMonth)}
                                </div>
                            </div>
                        </div>

                        {/* Lançamentos no Mês */}
                        <div className={`p-5 rounded-xl flex flex-col justify-center gap-3 ${theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]'}`}>
                            <div className="flex items-center gap-2">
                                <div className="text-rose-400">
                                    <TrendingDown className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Lançamentos no Mês</span>
                            </div>
                            <div className="text-2xl font-bold text-rose-400">
                                {formatCurrency(totalExpensesMonth)}
                            </div>
                        </div>
                    </div>

                    {/* Table Row */}
                    <div className={`p-8 rounded-2xl ${theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]'}`}>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                            <h3 className={`text-base font-medium uppercase tracking-wider ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>Recebimentos de {selectedMonthName}</h3>
                            <button
                                onClick={() => {
                                    setEditingId(null);
                                    setAmount('');
                                    setDescription('');
                                    setIncomeStep('form');
                                    setShowIncomeModal(true);
                                }}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-400/90 hover:bg-emerald-400 text-slate-900 font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(52,211,153,0.15)]"
                            >
                                <span className="text-lg leading-none">+</span> Novo Recebimento
                            </button>
                        </div>

                        <div className="w-full">
                            {/* Table Header - Hidden on Mobile */}
                            <div className={`hidden sm:grid grid-cols-[1fr_1fr_1fr] pb-4 border-b mb-2 px-2 ${theme === 'light' ? 'border-slate-200' : 'border-slate-700'}`}>
                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Origem</span>
                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Data</span>
                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider text-right">Valor</span>
                            </div>

                            {/* Table Body */}
                            <div className="space-y-1">
                                {recentIncomes.length > 0 ? recentIncomes.map(t => (
                                    <div key={t.id} className={`grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_1fr_1fr] items-center py-4 px-2 hover:bg-white/5 rounded-xl transition-colors group gap-2 sm:gap-4 border-b sm:border-b-0 ${theme === 'light' ? 'border-slate-100' : 'border-slate-700/30'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-500/20 text-emerald-400 shrink-0">
                                                <span className="text-xs font-black">
                                                    {t.description ? t.description.charAt(0).toUpperCase() : 'R'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className={`text-[13px] truncate ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>{t.description || 'Recebimento'}</span>
                                                <span className="text-[11px] text-slate-400 sm:hidden">
                                                    {new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={`text-[13px] hidden sm:block ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                                            {new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}.
                                        </div>
                                        <div className="flex items-center justify-end gap-3 relative">
                                            <span className="text-[13px] font-medium text-emerald-400">
                                                + {formatCurrency(parseFloat(t.amount))}
                                            </span>
                                            {/* Actions visible on hover */}
                                            <div className={`absolute right-0 translate-x-16 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all flex gap-1 pl-2 ${theme === 'light' ? 'bg-white' : 'bg-[#1e2330]'}`}>
                                                <button onClick={() => handleEditInitiate(t)} className={`p-2 text-slate-400 hover:text-emerald-400 transition-colors rounded-md ${theme === 'light' ? 'hover:bg-slate-50' : ''}`}><Pencil className="w-3 h-3" /></button>
                                                <button onClick={() => handleDelete(t.id)} className={`p-2 text-slate-400 hover:text-rose-400 transition-colors rounded-md ${theme === 'light' ? 'hover:bg-slate-50' : ''}`}><Trash2 className="w-3 h-3" /></button>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="py-8 text-center text-sm text-slate-500">Nenhum recebimento recente encontrado.</div>
                                )}
                            </div>

                            {/* Total Footer */}
                            <div className={`mt-6 p-4 rounded-lg flex justify-end ${theme === 'light' ? 'bg-slate-100' : 'bg-slate-700/30'}`}>
                                <div className={`text-xs uppercase tracking-wider ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                                    Total Recebido (Mês): <span className={`font-bold text-sm ml-1 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{formatCurrency(totalIncomeMonth)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* ABA 2: RESGATES */
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex justify-center">
                        <button 
                            onClick={() => setShowRescueModal(true)}
                            className={`flex items-center gap-3 px-5 py-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(59,130,246,0.15)] ${
                                theme === 'light' 
                                ? 'bg-blue-600 text-white border-blue-500' 
                                : 'bg-blue-600 text-white border-blue-500'
                            }`}
                        >
                            <Landmark className="w-5 h-5" />
                            Realizar Resgate de Investimento
                        </button>
                    </div>

                    <div className={`p-6 md:p-8 rounded-2xl border shadow-sm ${
                        theme === 'light' ? 'bg-white border-blue-100/50 shadow-blue-500/5' : 'bg-[#1e2330] border-blue-500/10'
                    }`}>
                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-500/10 rounded-2xl">
                                    <Landmark className="w-6 h-6 text-blue-500" />
                                </div>
                                <div>
                                    <h3 className={`text-base font-medium uppercase tracking-wider ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                        Histórico de Resgates
                                    </h3>
                                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Movimentações de Patrimônio → Carteira</p>
                                </div>
                            </div>
                            <div className="text-right px-4 py-2 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Total Resgatado ({monthLabel.split(' ')[0]})</span>
                                <span className={`text-2xl font-bold ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}>
                                    R$ {totalRedemptionMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {recentRedemptions.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-slate-100 dark:border-white/5 rounded-2xl">
                                    <p className="text-sm font-bold text-slate-400 italic">Nenhum resgate de investimento este mês.</p>
                                </div>
                            ) : (
                                recentRedemptions.map(inc => (
                                    <div key={inc.id} className={`flex items-center justify-between p-5 rounded-xl border transition-all hover:shadow-lg ${
                                        theme === 'light' ? 'bg-blue-50/30 border-blue-100/50 hover:bg-blue-50 hover:border-blue-200' : 'bg-blue-500/5 border-blue-500/10 hover:bg-blue-500/10'
                                    }`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner ${
                                                theme === 'light' ? 'bg-white' : 'bg-slate-900'
                                            }`}>
                                                <Landmark className={`w-6 h-6 text-blue-500`} />
                                            </div>
                                            <div>
                                                <h4 className={`text-[13px] ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                                    {inc.description}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className={`text-[11px] font-bold ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                                                        {new Date(inc.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                                                    </p>
                                                    <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-500 text-white">Sucesso</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="font-bold text-lg text-blue-500">
                                                + R$ {parseFloat(inc.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                            <button 
                                                onClick={() => handleDelete(inc.id)}
                                                className={`p-2.5 rounded-xl transition-colors ${
                                                    theme === 'light' ? 'text-slate-300 hover:text-rose-500 hover:bg-rose-50' : 'text-slate-600 hover:text-rose-400 hover:bg-rose-500/10'
                                                }`}
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Income Modal */}
            {showIncomeModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className={`w-full max-w-xl rounded-2xl p-6 border relative animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-emerald-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
                    }`}>
                        <button
                            onClick={() => setShowIncomeModal(false)}
                            className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors ${theme === 'light' ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/10 text-slate-500'}`}
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="space-y-5">
                            <div className="flex items-center gap-3 mb-1">
                                <div className={`p-2 rounded-xl shrink-0 ${theme === 'light' ? 'bg-emerald-50' : 'bg-emerald-500/10'}`}>
                                    <ArrowUpCircle className={`w-5 h-5 ${theme === 'light' ? 'text-emerald-500' : 'text-emerald-400'}`} />
                                </div>
                                <div>
                                    <h3 className={`text-base font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                        {incomeStep === 'form' ? (editingId ? 'Editar Recebimento' : 'Novo Recebimento') : 'Confirmar Dados'}
                                    </h3>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                        {incomeStep === 'form' ? 'Preencha os detalhes' : 'Verifique as informações'}
                                    </p>
                                </div>
                            </div>

                            {incomeStep === 'form' ? (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Nome do Recebimento</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Ex: Salário, Freelance..."
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/5 text-white focus:border-emerald-500'
                                                }`}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Valor</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">{isUSD ? 'U$' : 'R$'}</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        required
                                                        value={amount}
                                                        onChange={(e) => setAmount(e.target.value)}
                                                        className={`w-full px-3 py-2.5 pl-9 rounded-xl border text-sm focus:outline-none transition-all ${
                                                            theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/5 text-white focus:border-emerald-500'
                                                        }`}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Data</label>
                                                <input
                                                    type="date"
                                                    required
                                                    value={date}
                                                    onChange={(e) => setDate(e.target.value)}
                                                    className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                                                        theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-emerald-500 [color-scheme:light]' : 'bg-white/5 border-white/5 text-white focus:border-emerald-500 [color-scheme:dark]'
                                                    }`}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                            <div className="flex items-center gap-3">
                                                <CircleDollarSign className="w-5 h-5 text-emerald-500" />
                                                <span className={`text-xs font-bold ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>Recebido em Dólar</span>
                                            </div>
                                            <label className="inline-flex items-center cursor-pointer">
                                                <input type="checkbox" className="sr-only peer" checked={isUSD} onChange={(e) => setIsUSD(e.target.checked)} />
                                                <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                            </label>
                                        </div>

                                        {isUSD && amount && usdRate && (
                                            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center animate-in zoom-in-95">
                                                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] mb-1">Cotação Atual: R$ {usdRate.toFixed(2)}</p>
                                                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">R$ {(parseFloat(amount) * usdRate).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                                    >
                                        Próximo Passo
                                    </button>
                                </form>
                            ) : (
                                <div className="space-y-6">
                                    <div className={`p-4 rounded-xl border space-y-4 ${theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/10'}`}>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Descrição</span>
                                            <span className={`text-sm font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{description}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-slate-500/10 pt-4">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Valor Final</span>
                                            <span className="text-xl font-bold text-emerald-500">
                                                R$ {isUSD ? (parseFloat(amount) * usdRate).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : parseFloat(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-slate-500/10 pt-4">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Data do Lançamento</span>
                                            <span className={`text-sm font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                                {new Date(date.split('-').join('/')).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setIncomeStep('form')}
                                            className={`py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 border ${
                                                theme === 'light' ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-slate-800 border-white/10 text-white hover:bg-slate-700'
                                            }`}
                                        >
                                            Voltar
                                        </button>
                                        <button
                                            onClick={handleFinalSave}
                                            disabled={isSaving}
                                            className="py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Salvando...
                                                </>
                                            ) : (
                                                'Confirmar Recebimento'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Rescue Modal */}
            {showRescueModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className={`w-full max-w-md rounded-2xl p-6 border relative animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
                    }`}>
                        <button
                            onClick={() => setShowRescueModal(false)}
                            className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors ${theme === 'light' ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/10 text-slate-500'}`}
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="space-y-5">
                            <div className="flex items-center gap-3 mb-1">
                                <div className={`p-2 rounded-xl shrink-0 ${theme === 'light' ? 'bg-blue-50' : 'bg-blue-500/10'}`}>
                                    <ArrowDownCircle className={`w-5 h-5 ${theme === 'light' ? 'text-blue-500' : 'text-blue-400'}`} />
                                </div>
                                <div>
                                    <h3 className={`text-base font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Resgatar Valor</h3>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Mova dinheiro do investimento para sua carteira</p>
                                </div>
                            </div>

                            <div className={`p-3 rounded-xl border text-center ${
                                theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'
                            }`}>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Disponível para Resgate</p>
                                <p className={`text-2xl font-bold ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}>
                                    R$ {totalAvailable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>

                            <form onSubmit={handleRescue} className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Selecione a Reserva</label>
                                        <select
                                            required
                                            value={selectedJarId}
                                            onChange={(e) => setSelectedJarId(e.target.value)}
                                            className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                                                theme === 'light'
                                                ? 'bg-slate-50 border-slate-100 text-slate-800'
                                                : 'bg-slate-800 border-white/5 text-white'
                                            }`}
                                        >
                                            <option value="" className={theme === 'dark' ? 'bg-slate-900 text-slate-400' : ''}>
                                                Selecione a reserva...
                                            </option>
                                            {savingsJars?.map(jar => {
                                                const cdiAnual = cdiRate / 100;
                                                const percent = (jar.cdiPercent || 100) / 100;
                                                const dailyRate = Math.pow(1 + (cdiAnual * percent), 1 / 365) - 1;
                                                const lastUpdate = jar.updatedAt ? new Date(jar.updatedAt) : (jar.createdAt ? new Date(jar.createdAt) : new Date());
                                                const diffDays = Math.max(0, new Date() - lastUpdate) / (1000 * 60 * 60 * 24);
                                                const dynamicBalance = jar.balance * Math.pow(1 + dailyRate, diffDays);
                                                
                                                return (
                                                    <option 
                                                        key={jar.id} 
                                                        value={jar.id}
                                                        className={theme === 'dark' ? 'bg-slate-900 text-white' : ''}
                                                    >
                                                        {jar.name} (R$ {dynamicBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                                    </option>
                                                );
                                            })}
                                        </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Quanto deseja resgatar?</label>
                                    <input
                                        type="number" step="0.01" required
                                        value={rescueAmount}
                                        onChange={(e) => setRescueAmount(e.target.value)}
                                        placeholder="0.00"
                                        className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                                            theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-blue-500' : 'bg-white/5 border-white/5 text-white focus:border-blue-500'
                                        }`}
                                    />
                                    {selectedJarId && parseFloat(rescueAmount) > (parseFloat(savingsJars.find(j => j.id === selectedJarId)?.balance) || 0) && (
                                        <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-500">
                                            <AlertTriangle className="w-4 h-4 shrink-0" />
                                            <p className="text-xs font-bold">Valor superior ao saldo desta reserva!</p>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={!rescueAmount || !selectedJarId || isRescuing}
                                    className="w-full py-3 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-black text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isRescuing ? 'Processando...' : 'Confirmar Resgate'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {transactionToDelete && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[250] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className={`w-full max-w-sm rounded-2xl p-6 border text-center relative overflow-hidden animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
                    }`}>
                        <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
                            <Trash2 className="w-8 h-8 text-rose-500" />
                        </div>
                        <h3 className={`text-xl font-black mb-2 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Excluir Lançamento?</h3>
                        <p className={`text-sm mb-6 leading-relaxed ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                            Tem certeza que deseja remover esta entrada? Esta ação não pode ser desfeita.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setTransactionToDelete(null)}
                                className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${
                                    theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                                }`}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-3 bg-rose-500 hover:bg-rose-400 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-rose-500/20 transition-all active:scale-95"
                            >
                                Sim, Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
