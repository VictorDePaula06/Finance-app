import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { TrendingUp, Trash2, ArrowUpCircle, CircleDollarSign, Loader2, Pencil, X, Landmark, ArrowDownCircle } from 'lucide-react';
import { CATEGORIES } from '../constants/categories';

export default function IncomeTab({ transactions, savingsJars }) {
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
    const [showIncomeModal, setShowIncomeModal] = useState(false);
    const [incomeStep, setIncomeStep] = useState('form'); // 'form' | 'confirm'
    const [isSaving, setIsSaving] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState(null);
    
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
            alert('Valor superior ao saldo desta reserva!');
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

    // Logic to filter transactions for the current month
    const currentMonthKey = new Date().toISOString().slice(0, 7); // "YYYY-MM"

    // 1. Regular Incomes (Salary, Freelance, etc)
    const recentIncomes = transactions.filter(t => {
        const isIncome = t.type === 'income';
        const isNotSpecial = !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category);
        const matchesMonth = t.month === currentMonthKey || (t.date && t.date.startsWith(currentMonthKey));
        return isIncome && isNotSpecial && matchesMonth;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    // 2. Redemptions (Moving from Patrimony to Wallet)
    const recentRedemptions = transactions.filter(t => {
        const isIncome = t.type === 'income';
        const isRedemption = t.category === 'vault_redemption' || (t.description && t.description.includes('Resgate:'));
        const matchesMonth = t.month === currentMonthKey || (t.date && t.date.slice(0, 7) === currentMonthKey);
        return isIncome && isRedemption && matchesMonth;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalIncomeMonth = recentIncomes.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    const totalRedemptionMonth = recentRedemptions.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

    return (
        <div className="max-w-4xl mx-auto space-y-10 pb-20">
            {/* Header & Sub-Tabs Switcher */}
            <div className="flex flex-col items-center gap-6 py-8">
                <div className={`p-4 rounded-full ${theme === 'light' ? 'bg-emerald-50' : 'bg-emerald-500/10'}`}>
                    <ArrowUpCircle className={`w-8 h-8 ${theme === 'light' ? 'text-emerald-500' : 'text-emerald-400'}`} />
                </div>
                <div className="text-center">
                    <h2 className={`text-2xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Gestão de Recebimentos</h2>
                    <p className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Acompanhe suas entradas e resgates de investimentos.</p>
                </div>

                <div className={`p-1.5 rounded-2xl flex gap-1 ${theme === 'light' ? 'bg-slate-100' : 'bg-white/5 shadow-inner'}`}>
                    <button 
                        onClick={() => setSubTab('recebimentos')}
                        className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                            subTab === 'recebimentos' 
                            ? (theme === 'light' ? 'bg-white text-emerald-500 shadow-sm' : 'bg-white/10 text-emerald-400 shadow-xl')
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <ArrowUpCircle className="w-3 h-3" />
                        Recebimentos
                    </button>
                    <button 
                        onClick={() => setSubTab('resgates')}
                        className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                            subTab === 'resgates' 
                            ? (theme === 'light' ? 'bg-white text-blue-500 shadow-sm' : 'bg-white/10 text-blue-400 shadow-xl')
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Landmark className="w-3 h-3" />
                        Resgates
                    </button>
                </div>
            </div>

            {subTab === 'recebimentos' ? (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {/* Quick Actions & Stats Card */}
                    <div className={`p-8 rounded-[2.5rem] border shadow-2xl relative overflow-hidden ${
                        theme === 'light' ? 'bg-white border-emerald-100/50' : 'bg-slate-900 border-white/5'
                    }`}>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                        
                        <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
                            <div className="flex items-center gap-6">
                                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg ${
                                    theme === 'light' ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/10 text-emerald-400'
                                }`}>
                                    <CircleDollarSign className="w-8 h-8" />
                                </div>
                                <div>
                                    <p className={`text-xs font-black uppercase tracking-widest mb-1 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                                        Total Recebido (Mês)
                                    </p>
                                    <h3 className={`text-3xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                        R$ {totalIncomeMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </h3>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setEditingId(null);
                                    setAmount('');
                                    setDescription('');
                                    setIncomeStep('form');
                                    setShowIncomeModal(true);
                                }}
                                className={`flex items-center gap-3 px-8 py-5 rounded-[2rem] border font-black text-sm uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl ${
                                    theme === 'light' 
                                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20' 
                                    : 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20'
                                }`}
                            >
                                <ArrowUpCircle className="w-5 h-5" />
                                Novo Recebimento
                            </button>
                        </div>
                    </div>

                    {/* List Section */}
                    <div className={`p-6 md:p-8 rounded-[2.5rem] border shadow-sm ${
                        theme === 'light' ? 'bg-white border-emerald-100/30' : 'bg-slate-900 border-emerald-500/10'
                    }`}>
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-3 bg-emerald-500/10 rounded-2xl">
                                <TrendingUp className="w-6 h-6 text-emerald-500" />
                            </div>
                            <div>
                                <h3 className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                    Histórico de Recebimentos
                                </h3>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Entradas registradas este mês</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {recentIncomes.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-sm font-bold text-slate-400 dark:text-slate-500">Nenhuma entrada registrada este mês.</p>
                                </div>
                            ) : (
                                recentIncomes.map(inc => {
                                    const cat = CATEGORIES.income.find(c => c.id === inc.category) || CATEGORIES.income.find(c => c.id === 'other');
                                    const Icon = cat.icon;
                                    return (
                                        <div key={inc.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all hover:scale-[1.01] ${
                                            theme === 'light' ? 'bg-[#f0fdfa]/50 border-emerald-100/50 hover:bg-emerald-50' : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800'
                                        }`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${
                                                    theme === 'light' ? 'bg-white' : 'bg-slate-900'
                                                }`}>
                                                    <Icon className={`w-5 h-5 ${cat.color}`} />
                                                </div>
                                                <div>
                                                    <h4 className={`font-bold text-sm ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                                        {inc.description}
                                                    </h4>
                                                    <p className={`text-[10px] font-bold ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                                                        {new Date(inc.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-emerald-500 mr-2">
                                                    + R$ {parseFloat(inc.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                                <button 
                                                    onClick={() => handleEditInitiate(inc)}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        theme === 'light' ? 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50' : 'text-slate-600 hover:text-emerald-400 hover:bg-emerald-500/10'
                                                    }`}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(inc.id)}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        theme === 'light' ? 'text-slate-300 hover:text-rose-500 hover:bg-rose-50' : 'text-slate-600 hover:text-rose-400 hover:bg-rose-500/10'
                                                    }`}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* ABA 2: RESGATES */
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex justify-center">
                        <button 
                            onClick={() => setShowRescueModal(true)}
                            className={`flex items-center gap-3 px-8 py-5 rounded-[2rem] border font-black text-sm uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl ${
                                theme === 'light' 
                                ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/20' 
                                : 'bg-blue-600 text-white border-blue-500 shadow-blue-500/20'
                            }`}
                        >
                            <Landmark className="w-5 h-5" />
                            Realizar Resgate de Investimento
                        </button>
                    </div>

                    <div className={`p-6 md:p-8 rounded-[2.5rem] border shadow-sm ${
                        theme === 'light' ? 'bg-white border-blue-100/50 shadow-blue-500/5' : 'bg-slate-900 border-blue-500/10'
                    }`}>
                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-500/10 rounded-2xl">
                                    <Landmark className="w-6 h-6 text-blue-500" />
                                </div>
                                <div>
                                    <h3 className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                        Histórico de Resgates
                                    </h3>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Movimentações de Patrimônio → Carteira</p>
                                </div>
                            </div>
                            <div className="text-right px-4 py-2 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Total Resgatado no Mês</span>
                                <span className={`text-2xl font-black ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}>
                                    R$ {totalRedemptionMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {recentRedemptions.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-slate-100 dark:border-white/5 rounded-[2rem]">
                                    <p className="text-sm font-bold text-slate-400 italic">Nenhum resgate de investimento este mês.</p>
                                </div>
                            ) : (
                                recentRedemptions.map(inc => (
                                    <div key={inc.id} className={`flex items-center justify-between p-5 rounded-2xl border transition-all hover:shadow-lg ${
                                        theme === 'light' ? 'bg-blue-50/30 border-blue-100/50 hover:bg-blue-50 hover:border-blue-200' : 'bg-blue-500/5 border-blue-500/10 hover:bg-blue-500/10'
                                    }`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner ${
                                                theme === 'light' ? 'bg-white' : 'bg-slate-900'
                                            }`}>
                                                <Landmark className={`w-6 h-6 text-blue-500`} />
                                            </div>
                                            <div>
                                                <h4 className={`font-bold text-base ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                                    {inc.description}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className={`text-[11px] font-bold ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                                                        {new Date(inc.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                                                    </p>
                                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-500 text-white">Sucesso</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="font-black text-xl text-blue-500">
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
                    <div className={`w-full max-w-xl rounded-[2.5rem] p-8 md:p-10 border relative animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-emerald-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
                    }`}>
                        <button 
                            onClick={() => setShowIncomeModal(false)}
                            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-rose-500 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="space-y-8">
                            <div className="text-center space-y-2">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${theme === 'light' ? 'bg-emerald-50' : 'bg-emerald-500/10'}`}>
                                    <ArrowUpCircle className={`w-8 h-8 ${theme === 'light' ? 'text-emerald-500' : 'text-emerald-400'}`} />
                                </div>
                                <h3 className={`text-2xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                    {incomeStep === 'form' ? (editingId ? 'Editar Recebimento' : 'Novo Recebimento') : 'Confirmar Dados'}
                                </h3>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    {incomeStep === 'form' ? 'Preencha os detalhes do seu recebimento' : 'Verifique se as informações estão corretas'}
                                </p>
                            </div>

                            {incomeStep === 'form' ? (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Nome do Recebimento</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Ex: Salário, Freelance..."
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/5 text-white focus:border-emerald-500'
                                                }`}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Valor</label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">{isUSD ? 'U$' : 'R$'}</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        required
                                                        value={amount}
                                                        onChange={(e) => setAmount(e.target.value)}
                                                        className={`w-full p-4 pl-12 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                            theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/5 text-white focus:border-emerald-500'
                                                        }`}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Data</label>
                                                <input
                                                    type="date"
                                                    required
                                                    value={date}
                                                    onChange={(e) => setDate(e.target.value)}
                                                    className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                        theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-emerald-500 [color-scheme:light]' : 'bg-white/5 border-white/5 text-white focus:border-emerald-500 [color-scheme:dark]'
                                                    }`}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
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
                                            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center animate-in zoom-in-95">
                                                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Cotação Atual: R$ {usdRate.toFixed(2)}</p>
                                                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">R$ {(parseFloat(amount) * usdRate).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
                                    >
                                        Próximo Passo
                                    </button>
                                </form>
                            ) : (
                                <div className="space-y-6">
                                    <div className={`p-6 rounded-3xl border space-y-4 ${theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/10'}`}>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Descrição</span>
                                            <span className={`text-sm font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{description}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-slate-500/10 pt-4">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Valor Final</span>
                                            <span className="text-xl font-black text-emerald-500">
                                                R$ {isUSD ? (parseFloat(amount) * usdRate).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : parseFloat(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-slate-500/10 pt-4">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Data do Lançamento</span>
                                            <span className={`text-sm font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                                {new Date(date.split('-').join('/')).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setIncomeStep('form')}
                                            className={`py-4 rounded-2xl font-black text-sm transition-all active:scale-95 border ${
                                                theme === 'light' ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-slate-800 border-white/10 text-white hover:bg-slate-700'
                                            }`}
                                        >
                                            Voltar
                                        </button>
                                        <button
                                            onClick={handleFinalSave}
                                            disabled={isSaving}
                                            className="py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
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
                    <div className={`w-full max-w-md rounded-[2.5rem] p-8 md:p-10 border relative animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
                    }`}>
                        <button 
                            onClick={() => setShowRescueModal(false)}
                            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-rose-500 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <ArrowDownCircle className="w-8 h-8 text-blue-500" />
                                </div>
                                <h3 className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Resgatar Valor</h3>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mova dinheiro do investimento para sua carteira</p>
                            </div>

                            <div className={`p-4 rounded-2xl border text-center ${
                                theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'
                            }`}>
                                <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Disponível para Resgate</p>
                                <p className={`text-2xl font-black ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}>
                                    R$ {totalAvailable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>

                            <form onSubmit={handleRescue} className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Selecione a Reserva</label>
                                        <select 
                                            required
                                            value={selectedJarId}
                                            onChange={(e) => setSelectedJarId(e.target.value)}
                                            className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
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
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Quanto deseja resgatar?</label>
                                    <input 
                                        type="number" step="0.01" required
                                        value={rescueAmount}
                                        onChange={(e) => setRescueAmount(e.target.value)}
                                        placeholder="0.00"
                                        className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                            theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-blue-500' : 'bg-white/5 border-white/5 text-white focus:border-blue-500'
                                        }`}
                                    />
                                    {selectedJarId && parseFloat(rescueAmount) > (parseFloat(savingsJars.find(j => j.id === selectedJarId)?.balance) || 0) && (
                                        <p className="text-[10px] text-rose-500 font-bold mt-2 ml-1">Valor superior ao saldo desta reserva!</p>
                                    )}
                                </div>

                                <button 
                                    type="submit"
                                    disabled={!rescueAmount || !selectedJarId || isRescuing}
                                    className="w-full py-4 bg-blue-500 hover:bg-blue-400 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
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
                    <div className={`w-full max-w-sm rounded-[2.5rem] p-8 border text-center relative overflow-hidden animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
                    }`}>
                        <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Trash2 className="w-10 h-10 text-rose-500" />
                        </div>
                        <h3 className={`text-2xl font-black mb-2 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Excluir Lançamento?</h3>
                        <p className={`text-sm font-bold mb-8 leading-relaxed ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                            Tem certeza que deseja remover esta entrada? Esta ação não pode ser desfeita.
                        </p>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setTransactionToDelete(null)}
                                className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                                    theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                                }`}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmDelete}
                                className="flex-1 py-4 bg-rose-500 hover:bg-rose-400 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-rose-500/20 transition-all active:scale-95"
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
