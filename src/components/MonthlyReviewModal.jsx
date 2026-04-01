import React from 'react';
import { Sparkles, Calendar, TrendingUp, TrendingDown, Wallet, ArrowRight, X } from 'lucide-react';
import aliviaFinal from '../assets/alivia/alivia-final.png';
import ReactMarkdown from 'react-markdown';

export default function MonthlyReviewModal({ isOpen, onClose, reviewText, monthName, stats, theme }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-500">
            <div className={`relative w-full max-w-2xl rounded-[2.5rem] border overflow-hidden shadow-2xl transition-all duration-700 animate-in zoom-in-95 slide-in-from-bottom-8 ${
                theme === 'light' 
                ? 'bg-white border-emerald-100 shadow-emerald-500/10' 
                : 'bg-slate-900 border-white/10 shadow-black/50'
            }`}>
                {/* Background Decoration */}
                <div className={`absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full blur-[80px] pointer-events-none opacity-30 ${
                    theme === 'light' ? 'bg-emerald-400' : 'bg-blue-600'
                }`}></div>

                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 transition-colors z-10"
                >
                    <X className="w-5 h-5 text-slate-400" />
                </button>

                <div className="relative p-6 md:p-10 flex flex-col items-center">
                    {/* Alívia Header */}
                    <div className="flex items-center gap-4 mb-8 self-start md:self-center">
                        <div className="relative">
                            <div className={`p-0.5 rounded-full bg-gradient-to-br ${
                                theme === 'light' ? 'from-emerald-100 to-white' : 'from-blue-600/40 to-emerald-500/40'
                            }`}>
                                <img 
                                    src={aliviaFinal} 
                                    alt="Alívia" 
                                    className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-full border-2 border-white dark:border-slate-800"
                                />
                            </div>
                            <div className="absolute -bottom-1 -right-1 p-1.5 bg-white rounded-full shadow-lg border border-emerald-50">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                            </div>
                        </div>
                        <div>
                            <h2 className={`text-xl md:text-2xl font-black tracking-tight ${
                                theme === 'light' ? 'text-slate-900' : 'text-white'
                            }`}>
                                O Mês que Passou
                            </h2>
                            <p className="text-emerald-500 font-bold uppercase tracking-widest text-[10px]">Feedback da Alívia</p>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3 w-full mb-8">
                        <div className={`p-4 rounded-3xl border flex flex-col items-center text-center ${
                            theme === 'light' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white/5 border-white/5'
                        }`}>
                            <TrendingUp className="w-5 h-5 text-emerald-400 mb-2" />
                            <span className="text-[9px] uppercase tracking-tighter text-slate-500 mb-1">Ganhos</span>
                            <span className={`text-sm font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                R$ {stats.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className={`p-4 rounded-3xl border flex flex-col items-center text-center ${
                            theme === 'light' ? 'bg-rose-50/50 border-rose-100' : 'bg-white/5 border-white/5'
                        }`}>
                            <TrendingDown className="w-5 h-5 text-rose-400 mb-2" />
                            <span className="text-[9px] uppercase tracking-tighter text-slate-500 mb-1">Gastos</span>
                            <span className={`text-sm font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                R$ {stats.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className={`p-4 rounded-3xl border flex flex-col items-center text-center ${
                            theme === 'light' ? 'bg-blue-50/50 border-blue-100' : 'bg-blue-500/10 border-blue-500/20'
                        }`}>
                            <Wallet className="w-5 h-5 text-blue-400 mb-2" />
                            <span className="text-[9px] uppercase tracking-tighter text-slate-500 mb-1">Saldo</span>
                            <span className={`text-sm font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                R$ {stats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* AI Message */}
                    <div className={`w-full p-6 md:p-8 rounded-[2rem] border mb-10 leading-relaxed text-sm md:text-base ${
                        theme === 'light' 
                        ? 'bg-[#f0fdfa]/80 border-emerald-100/50 text-slate-700' 
                        : 'bg-slate-800/40 border-white/5 text-slate-300'
                    }`}>
                        <ReactMarkdown
                            components={{
                                p: ({ ...props }) => <p className="mb-4 last:mb-0" {...props} />,
                                strong: ({ ...props }) => <strong className="font-bold text-emerald-500" {...props} />
                            }}
                        >
                            {reviewText}
                        </ReactMarkdown>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={onClose}
                        className="group w-full max-w-sm py-5 px-8 bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white rounded-[2rem] shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                    >
                        <span className="font-bold text-lg leading-none">Começar {monthName}</span>
                        <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                    </button>
                    
                    <p className="mt-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-50 flex items-center gap-2">
                        <Calendar className="w-3 h-3" /> Relatório de Fechamento Automático
                    </p>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-8px); }
                }
                .animate-bounce-subtle {
                    animation: bounce-subtle 3s ease-in-out infinite;
                }
            `}} />
        </div>
    );
}
