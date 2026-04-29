import React, { useState, useEffect } from 'react';
import { PiggyBank, TrendingUp, ArrowRightCircle, Info } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function QuickSavingsForm({ onTransactionAdded }) {
    const { theme } = useTheme();
    const { currentUser } = useAuth();
    
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [cdiPercent, setCdiPercent] = useState('100');
    const [cdiRate, setCdiRate] = useState(10.65); // Default Selic/CDI
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        // Fetch approximate CDI rate
        fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json')
            .then(res => res.json())
            .then(data => {
                if (data && data[0] && data[0].valor) {
                    setCdiRate(parseFloat(data[0].valor) * 365);
                }
            })
            .catch(err => console.warn("Erro ao buscar CDI:", err));
    }, []);

    const calculateDailyYield = () => {
        const val = parseFloat(amount) || 0;
        const perc = parseFloat(cdiPercent) || 100;
        if (val <= 0) return 0;
        
        const cdiAnual = cdiRate / 100;
        const percent = perc / 100;
        // Approximation of daily rate from annual rate
        const dailyRate = Math.pow(1 + (cdiAnual * percent), 1 / 365) - 1;
        return val * dailyRate;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name || !amount || !currentUser || isSaving) return;

        setIsSaving(true);
        try {
            const val = parseFloat(amount);
            const perc = parseFloat(cdiPercent);
            const now = new Date();
            const monthStr = now.toISOString().slice(0, 7);

            // 1. Create the transaction (Saída)
            const transactionData = {
                description: `Investimento: ${name}`,
                amount: val,
                type: 'expense',
                category: 'investment',
                date: now.toISOString(),
                userId: currentUser.uid,
                month: monthStr,
                createdAt: Date.now(),
                isFixed: false
            };
            await addDoc(collection(db, 'transactions'), transactionData);

            // 2. Create/Add to savings_jars (Patrimônio)
            const jarData = {
                name: name,
                balance: val,
                cdiPercent: perc,
                type: 'cofrinho',
                color: 'emerald',
                userId: currentUser.uid,
                createdAt: now.toISOString(),
                updatedAt: now.toISOString()
            };
            await addDoc(collection(db, 'savings_jars'), jarData);

            // Reset
            setName('');
            setAmount('');
            setCdiPercent('100');
            
            if (onTransactionAdded) onTransactionAdded();
            alert('Investimento registrado com sucesso!');
        } catch (error) {
            console.error("Erro ao salvar investimento rápido:", error);
            alert('Erro ao salvar. Tente novamente.');
        } finally {
            setIsSaving(false);
        }
    };

    const dailyYield = calculateDailyYield();

    return (
        <div className={`p-6 md:p-8 rounded-[2.5rem] border shadow-sm transition-all ${
            theme === 'light' ? 'bg-white border-slate-100' : 'bg-slate-900 border-white/5'
        }`}>
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-emerald-500/10 rounded-2xl">
                    <PiggyBank className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                    <h3 className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Guardar em Investimentos</h3>
                    <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Mova o que sobrou para render com segurança</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Onde guardar?</label>
                        <input 
                            type="text"
                            required
                            placeholder="Ex: Reserva, Viagem..."
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-white/5 border-white/5 text-white focus:border-emerald-500/50'
                            }`}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Valor (R$)</label>
                        <input 
                            type="number"
                            step="0.01"
                            required
                            placeholder="0.00"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-white/5 border-white/5 text-white focus:border-emerald-500/50'
                            }`}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">% do CDI</label>
                        <input 
                            type="number"
                            required
                            placeholder="100"
                            value={cdiPercent}
                            onChange={e => setCdiPercent(e.target.value)}
                            className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-white/5 border-white/5 text-white focus:border-emerald-500/50'
                            }`}
                        />
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className={`flex items-center gap-4 p-4 rounded-2xl border flex-1 w-full ${
                        theme === 'light' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-emerald-500/5 border-emerald-500/10'
                    }`}>
                        <div className="p-2 bg-emerald-500/10 rounded-xl">
                            <TrendingUp className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Rendimento Estimado</p>
                            <p className="text-lg font-black text-emerald-500">
                                + R$ {dailyYield.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] opacity-70">/dia</span>
                            </p>
                        </div>
                        <div className="ml-auto group relative">
                            <Info className="w-4 h-4 text-emerald-400 cursor-help" />
                            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-[9px] text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                                Baseado no CDI atual de {cdiRate.toFixed(2)}% ao ano.
                            </div>
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={isSaving || !amount || !name}
                        className={`w-full md:w-auto px-10 py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50`}
                    >
                        {isSaving ? 'Processando...' : 'Confirmar e Guardar'}
                        <ArrowRightCircle className="w-5 h-5" />
                    </button>
                </div>
            </form>
        </div>
    );
}
