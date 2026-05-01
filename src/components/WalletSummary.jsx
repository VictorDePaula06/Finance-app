import React from 'react';
import { TrendingUp, TrendingDown, Wallet, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function WalletSummary({ income, expense, balance, isHidden, onToggle }) {
    const { theme } = useTheme();

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
            {/* Saldo em Carteira (Destaque) */}
            <div className={`p-6 rounded-[2rem] border transition-all relative overflow-hidden group ${
                theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'
            }`}>
                <div className="absolute top-4 right-4">
                    <button onClick={onToggle} className="text-slate-400 hover:text-blue-500 transition-colors">
                        {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-500/10 rounded-xl">
                        <Wallet className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Saldo em Carteira</span>
                </div>
                <div className={`text-2xl font-black ${
                    isHidden ? 'blur-md select-none' : (balance >= 0 ? (theme === 'light' ? 'text-slate-800' : 'text-white') : 'text-rose-500')
                }`}>
                    {isHidden ? 'R$ 0.000,00' : formatCurrency(balance)}
                </div>
                <div className="absolute -bottom-2 -right-2 opacity-5">
                    <Wallet className="w-20 h-20 text-blue-500" />
                </div>
            </div>

            {/* Entradas */}
            <div className={`p-6 rounded-[2rem] border transition-all ${
                theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'
            }`}>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-500/10 rounded-xl">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recebimentos no Mês</span>
                </div>
                <div className={`text-2xl font-black ${isHidden ? 'blur-md select-none' : 'text-emerald-500'}`}>
                    {isHidden ? 'R$ 0.000,00' : formatCurrency(income)}
                </div>
            </div>

            {/* Saídas */}
            <div className={`p-6 rounded-[2rem] border transition-all ${
                theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'
            }`}>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-rose-500/10 rounded-xl">
                        <TrendingDown className="w-4 h-4 text-rose-500" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Lançamentos no Mês</span>
                </div>
                <div className={`text-2xl font-black ${isHidden ? 'blur-md select-none' : 'text-rose-500'}`}>
                    {isHidden ? 'R$ 0.000,00' : formatCurrency(expense)}
                </div>
            </div>
        </div>
    );
}
