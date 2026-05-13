import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import aliviaFinal from '../assets/alivia/alivia-final.png';

export default function AliviaMiniInsight({ transactions = [], theme }) {
    const [insight, setInsight] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefresh, setLastRefresh] = useState(Date.now());

    const generateInsight = () => {
        const now = new Date();
        const currentMonthStr = now.toISOString().slice(0, 7);

        // Mensais
        const monthTxs = transactions.filter(t => {
            return t.month === currentMonthStr || (t.date && t.date.startsWith(currentMonthStr));
        });

        const incomeTxs = monthTxs.filter(t => t.type === 'income' && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category));
        const expenseTxs = monthTxs.filter(t => t.type === 'expense' && t.category !== 'investment' && t.paymentMethod !== 'credito');
        const investmentTxs = monthTxs.filter(t => t.type === 'expense' && t.category === 'investment');

        const totalIncome = incomeTxs.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
        const totalExpense = expenseTxs.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
        const totalInvestment = investmentTxs.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

        // Priorities
        const superfluous = expenseTxs.filter(t => t.priority === 'superfluous').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
        const essential = expenseTxs.filter(t => t.priority === 'essential').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

        let status = 'neutral';
        let message = 'Analisando seu mês...';

        if (totalIncome === 0 && totalExpense === 0) {
            status = 'neutral';
            message = 'Ainda não há movimentações suficientes neste mês para uma análise.';
        } else if (totalExpense > totalIncome && totalIncome > 0) {
            status = 'negative';
            message = `Atenção: Seus gastos (R$ ${totalExpense.toLocaleString('pt-BR')}) já superaram suas entradas (R$ ${totalIncome.toLocaleString('pt-BR')}) deste mês.`;
            if (superfluous > essential) {
                message += ' Notei muitos gastos supérfluos, considere reduzi-los.';
            }
        } else {
            if (totalInvestment === 0 && totalIncome > 0) {
                status = 'warning';
                message = `Seus gastos estão sob controle, mas você ainda não separou nada para suas reservas este mês.`;
            } else if (totalExpense < totalIncome * 0.5) {
                status = 'positive';
                message = `Excelente! Você gastou menos da metade das suas entradas e já aportou R$ ${totalInvestment.toLocaleString('pt-BR')}. Continue assim!`;
            } else {
                status = 'positive';
                message = `Tudo certo! Gastos dentro do limite das entradas.`;
                if (superfluous > essential) {
                    status = 'warning';
                    message += ` Porém, os gastos supérfluos estão altos.`;
                }
            }
        }

        setInsight({ status, message });
    };

    useEffect(() => {
        generateInsight();
        // Check every 12h
        const interval = setInterval(generateInsight, 12 * 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, [transactions, lastRefresh]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => {
            setLastRefresh(Date.now());
            setIsRefreshing(false);
        }, 600);
    };

    if (!insight) return null;

    const bgColors = {
        positive: theme === 'light' ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/20',
        negative: theme === 'light' ? 'bg-rose-50 border-rose-200' : 'bg-rose-500/10 border-rose-500/20',
        warning: theme === 'light' ? 'bg-amber-50 border-amber-200' : 'bg-amber-500/10 border-amber-500/20',
        neutral: theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-500/10 border-slate-500/20',
    };

    const textColors = {
        positive: theme === 'light' ? 'text-emerald-700' : 'text-emerald-400',
        negative: theme === 'light' ? 'text-rose-700' : 'text-rose-400',
        warning: theme === 'light' ? 'text-amber-700' : 'text-amber-400',
        neutral: theme === 'light' ? 'text-slate-700' : 'text-slate-400',
    };

    const icons = {
        positive: <TrendingUp className="w-3.5 h-3.5" />,
        negative: <TrendingDown className="w-3.5 h-3.5" />,
        warning: <Sparkles className="w-3.5 h-3.5" />,
        neutral: <Sparkles className="w-3.5 h-3.5" />,
    };

    return (
        <div className={`flex items-center justify-between flex-1 mx-0 lg:mx-8 p-3 rounded-2xl border ${bgColors[insight.status]} transition-all duration-300 shadow-inner`}>
            <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                    <img 
                        src={aliviaFinal} 
                        alt="Alívia" 
                        className="w-10 h-10 object-cover rounded-full border-2 border-white/20 shadow-md" 
                    />
                    <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full bg-[#131621] border border-white/10 ${textColors[insight.status]}`}>
                        {icons[insight.status]}
                    </div>
                </div>
                <div className="flex flex-col">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${textColors[insight.status]} opacity-90`}>Alívia</span>
                    <span className={`text-[12px] font-medium leading-tight ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'} max-w-[500px] line-clamp-2`} title={insight.message}>
                        {insight.message}
                    </span>
                </div>
            </div>
            <button 
                onClick={handleRefresh}
                title="Atualizar Insight"
                className={`p-2 rounded-lg transition-all ${isRefreshing ? 'animate-spin' : ''} ${
                    theme === 'light' ? 'hover:bg-black/5 text-slate-400' : 'hover:bg-white/10 text-slate-400'
                }`}
            >
                <RefreshCw className="w-4 h-4" />
            </button>
        </div>
    );
}
