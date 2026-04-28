import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { TrendingUp, Trash2, ArrowUpCircle, CircleDollarSign, Loader2 } from 'lucide-react';
import { CATEGORIES } from '../constants/categories';

export default function IncomeTab({ transactions }) {
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
            description: isUSD ? `${description} (U$ ${parseFloat(amount).toFixed(2)})` : description,
            amount: finalAmount,
            type: 'income',
            category: catId,
            date: transactionDate.toISOString(),
            userId: currentUser.uid,
            month: transactionDate.toISOString().slice(0, 7),
            createdAt: Date.now(),
            isFixed: false
        };

        try {
            await addDoc(collection(db, 'transactions'), transactionData);
            setAmount('');
            setDescription('');
            setIsUSD(false);
        } catch (error) {
            console.error("Error saving income:", error);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Deseja remover esta entrada?")) {
            await deleteDoc(doc(db, 'transactions', id));
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
                    <div>
                        <h3 className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Nova Entrada</h3>
                        <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Registre seus salários, serviços extras e rendimentos.</p>
                    </div>
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
                        Registrar Entrada
                    </button>
                </div>
                
                {isUSD && amount && usdRate && (
                    <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                        <span>Valor final a ser salvo no fluxo:</span>
                        <span className="text-sm">R$ {(parseFloat(amount) * usdRate).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                )}
            </form>

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
                                    <div className="flex items-center gap-4">
                                        <span className="font-black text-emerald-500">
                                            + R$ {parseFloat(inc.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
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
    );
}
