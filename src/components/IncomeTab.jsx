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
    
    // Fetch USD rate once
    useEffect(() => {
        const fetchRate = async () => {
            setIsLoadingRate(true);
            try {
                const response = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
                const data = await response.json();
                setUsdRate(parseFloat(data.USDBRL.ask));
            } catch (error) {
                console.error("Erro ao buscar cotação:", error);
                setUsdRate(5.0); // Fallback
            } finally {
                setIsLoadingRate(false);
            }
        };
        fetchRate();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount || !description || !currentUser) return;

        let finalAmount = parseFloat(amount);
        if (isUSD && usdRate) {
            finalAmount = finalAmount * usdRate;
        }

        const [year, month, day] = date.split('-').map(Number);
        const transactionDate = new Date(year, month - 1, day, 12, 0, 0);

        // Try to match category based on description, otherwise 'other'
        const lowerDesc = description.toLowerCase();
        let catId = 'other';
        if (lowerDesc.includes('salário') || lowerDesc.includes('salario') || lowerDesc.includes('pagamento')) catId = 'salary';
        else if (lowerDesc.includes('freela') || lowerDesc.includes('serviço') || lowerDesc.includes('servico')) catId = 'freelance';
        else if (lowerDesc.includes('rendimento') || lowerDesc.includes('dividendo')) catId = 'investment';
        else if (lowerDesc.includes('presente') || lowerDesc.includes('doação')) catId = 'gift';

        const transactionData = {
            description: isUSD && !editingId ? `${description} (U$ ${parseFloat(amount).toFixed(2)})` : description,
            amount: finalAmount,
            type: 'income',
            category: catId,
            date: transactionDate.toISOString(),
            userId: currentUser.uid,
            month: transactionDate.toISOString().slice(0, 7),
            updatedAt: Date.now(),
            isFixed: false
        };

        try {
            if (editingId) {
                const { createdAt, ...updateData } = transactionData;
                await updateDoc(doc(db, 'transactions', editingId), updateData);
            } else {
                await addDoc(collection(db, 'transactions'), {
                    ...transactionData,
                    createdAt: Date.now()
                });
            }
            setAmount('');
            setDescription('');
            setIsUSD(false);
            setEditingId(null);
        } catch (error) {
            console.error("Error saving income:", error);
        }
    };

    const handleEdit = (inc) => {
        setEditingId(inc.id);
        setDescription(inc.description);
        setAmount(inc.amount.toString());
        const d = new Date(inc.date);
        setDate(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
        setIsUSD(false); // Reset USD on edit for simplicity
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
        if (window.confirm("Deseja remover esta entrada?")) {
            await deleteDoc(doc(db, 'transactions', id));
        }
    };

    // Total available in investments
    const totalAvailable = savingsJars?.reduce((acc, jar) => acc + (parseFloat(jar.balance) || 0), 0) || 0;

    const handleRescue = async (e) => {
        e.preventDefault();
        const val = parseFloat(rescueAmount);
        if (!val || val <= 0 || !selectedJarId || isRescuing) return;

        const targetJar = savingsJars.find(j => j.id === selectedJarId);
        if (!targetJar || val > (parseFloat(targetJar.balance) || 0)) {
            alert('Valor superior ao saldo desta reserva!');
            return;
        }

        setIsRescuing(true);
        try {
            // 1. Update Specific Jar
            const newBalance = (parseFloat(targetJar.balance) || 0) - val;
            await updateDoc(doc(db, 'savings_jars', targetJar.id), {
                balance: newBalance,
                updatedAt: new Date().toISOString()
            });

            // 2. Add Income Transaction
            await addDoc(collection(db, 'transactions'), {
                description: `Resgate: ${targetJar.name}`,
                amount: val,
                type: 'income',
                category: 'vault_redemption',
                date: new Date().toISOString(),
                userId: currentUser.uid,
                month: new Date().toISOString().slice(0, 7),
                createdAt: Date.now()
            });

            setRescueAmount('');
            setSelectedJarId('');
            setShowRescueModal(false);
            alert('Resgate efetuado com sucesso!');
        } catch (error) {
            console.error("Erro ao resgatar:", error);
            alert('Erro ao processar resgate.');
        } finally {
            setIsRescuing(false);
        }
    };

    // Current month incomes
    const currentMonthStr = new Date().toLocaleDateString('en-CA').slice(0, 7);
    const recentIncomes = transactions
        .filter(t => t.type === 'income' && t.date.startsWith(currentMonthStr) && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalIncomeMonth = recentIncomes.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Input Form */}
            <form onSubmit={handleSubmit} className={`p-6 md:p-8 rounded-3xl border shadow-2xl ${
                theme === 'light' ? 'bg-white border-emerald-100/50' : 'bg-[#111827]/80 backdrop-blur-xl border-white/5'
            }`}>
                <div className="mb-6 flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${theme === 'light' ? 'bg-emerald-100' : 'bg-emerald-500/20'}`}>
                        <ArrowUpCircle className={`w-6 h-6 ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`} />
                    </div>
                    <div className="flex-1">
                        <h3 className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                            {editingId ? 'Editar Entrada' : 'Nova Entrada'}
                        </h3>
                        <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Registre seus salários, serviços extras e rendimentos.</p>
                    </div>
                    {editingId && (
                        <button 
                            type="button" 
                            onClick={() => {
                                setEditingId(null);
                                setDescription('');
                                setAmount('');
                            }}
                            className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-5">
                        <label className={`block text-xs font-bold mb-1 ml-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Nome do Recebimento</label>
                        <input
                            type="text"
                            placeholder="Ex: Salário, Serviço extra..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-all ${
                                theme === 'light' 
                                ? 'bg-[#f0fdfa]/50 border-emerald-100/50 text-slate-800 focus:ring-emerald-500/20 placeholder:text-slate-400' 
                                : 'bg-slate-900 border-slate-700 text-slate-200 focus:ring-emerald-500/50 placeholder:text-slate-500'
                            }`}
                        />
                    </div>
                    
                    <div className="md:col-span-4">
                        <label className={`block text-xs font-bold mb-1 ml-1 flex justify-between ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                            <span>Valor {isUSD ? '(USD)' : '(R$)'}</span>
                            {isUSD && usdRate && <span className="text-emerald-500 text-[10px]">Cotação: R$ {usdRate.toFixed(2)}</span>}
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className={`font-bold ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {isUSD ? 'U$' : 'R$'}
                                </span>
                            </div>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className={`w-full border rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 transition-all ${
                                    theme === 'light' 
                                    ? 'bg-[#f0fdfa]/50 border-emerald-100/50 text-slate-800 focus:ring-emerald-500/20 placeholder:text-slate-400' 
                                    : 'bg-slate-900 border-slate-700 text-slate-200 focus:ring-emerald-500/50 placeholder:text-slate-500'
                                }`}
                            />
                        </div>
                    </div>

                    <div className="md:col-span-3">
                        <label className={`block text-xs font-bold mb-1 ml-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Data</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-all ${
                                theme === 'light' 
                                ? 'bg-[#f0fdfa]/50 border-emerald-100/50 text-slate-800 focus:ring-emerald-500/20 [color-scheme:light]' 
                                : 'bg-slate-900 border-slate-700 text-slate-200 focus:ring-emerald-500/50 [color-scheme:dark]'
                            }`}
                        />
                    </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <label className="inline-flex items-center cursor-pointer select-none group">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={isUSD}
                            onChange={(e) => setIsUSD(e.target.checked)}
                        />
                        <div className={`relative w-11 h-6 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all transition-colors ${
                            theme === 'light' 
                            ? 'bg-slate-200 peer-checked:bg-emerald-500 shadow-inner' 
                            : 'bg-slate-700 peer-checked:bg-emerald-500'
                        }`}></div>
                        <span className={`ms-3 text-sm font-bold flex items-center gap-1 transition-colors ${theme === 'light' ? 'text-slate-600 group-hover:text-slate-800' : 'text-slate-400 group-hover:text-slate-200'}`}>
                            <CircleDollarSign className="w-4 h-4 text-emerald-500" />
                            Recebido em Dólar
                        </span>
                        {isLoadingRate && <Loader2 className="w-3 h-3 ml-2 animate-spin text-emerald-500" />}
                    </label>

                    <button
                        type="submit"
                        disabled={!amount || !description}
                        className={`w-full sm:w-auto px-8 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 ${
                            theme === 'light' 
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/20' 
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                    >
                        <TrendingUp className="w-4 h-4" />
                        {editingId ? 'Salvar Alterações' : 'Registrar Entrada'}
                    </button>
                </div>
                
                {isUSD && amount && usdRate && (
                    <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                        <span>Valor final a ser salvo no fluxo:</span>
                        <span className="text-sm">R$ {(parseFloat(amount) * usdRate).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                )}
            </form>

            {/* Rescue Button */}
            <div className="flex justify-center sm:justify-end">
                <button 
                    onClick={() => setShowRescueModal(true)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl border font-black text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${
                        theme === 'light' 
                        ? 'bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100' 
                        : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                    }`}
                >
                    <Landmark className="w-4 h-4" />
                    Resgatar de Investimento
                </button>
            </div>

            {/* List of Incomes */}
            <div className={`p-6 rounded-[2rem] border shadow-sm ${
                theme === 'light' ? 'bg-white border-slate-100' : 'bg-slate-900 border-white/5'
            }`}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className={`text-sm font-black uppercase tracking-widest ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                        Entradas deste Mês
                    </h3>
                    <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Total Recebido</span>
                        <span className={`text-xl font-black ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`}>
                            R$ {totalIncomeMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>

                <div className="space-y-3">
                    {recentIncomes.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                                <TrendingUp className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            </div>
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
                                            <h4 className={`font-bold text-sm ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
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
                                            onClick={() => handleEdit(inc)}
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
                                            {savingsJars?.map(jar => (
                                                <option 
                                                    key={jar.id} 
                                                    value={jar.id}
                                                    className={theme === 'dark' ? 'bg-slate-900 text-white' : ''}
                                                >
                                                    {jar.name} (R$ {parseFloat(jar.balance).toLocaleString('pt-BR')})
                                                </option>
                                            ))}
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
        </div>
    );
}
