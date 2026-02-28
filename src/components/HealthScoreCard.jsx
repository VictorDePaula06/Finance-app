import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Info, TrendingUp, AlertTriangle, CheckCircle2, X } from 'lucide-react';

export default function HealthScoreCard({ scoreData }) {
    const { score, feedback, color, bg, breakdown } = scoreData;
    const [showLogic, setShowLogic] = useState(false);

    // Formatação de moeda simples
    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className={`relative overflow-hidden rounded-3xl border border-white/10 backdrop-blur-xl transition-all duration-500 hover:shadow-2xl hover:shadow-blue-900/10 p-6 ${bg}`}>
            {/* Logic Modal */}
            {showLogic && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-slate-700/50 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-800/50">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Activity className="w-5 h-5 text-blue-400" />
                                Como o Score é calculado?
                            </h3>
                            <button onClick={() => setShowLogic(false)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                            <div className="space-y-4">
                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 font-bold text-sm min-w-[45px] text-center">20%</div>
                                        <span className={`text-[10px] font-bold ${breakdown?.performance > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>+{breakdown?.performance || 0} pts</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-100 uppercase text-[10px] tracking-widest mb-1 text-slate-500">Performance Mensal</h4>
                                        <p className="text-sm text-slate-400">Ganhos vs Gastos no mês atual.</p>
                                        <div className="mt-2 text-xs flex gap-3 text-slate-500">
                                            <span>Entradas: <b className="text-slate-300">{formatCurrency(breakdown?.data?.monthlyIncome || 0)}</b></span>
                                            <span>Gastos: <b className="text-slate-300">{formatCurrency(breakdown?.data?.actualExpense || 0)}</b></span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-sm min-w-[45px] text-center">30%</div>
                                        <span className={`text-[10px] font-bold ${breakdown?.allocation > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>+{breakdown?.allocation || 0} pts</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-100 uppercase text-[10px] tracking-widest mb-1 text-slate-500">Regra 50/30/20</h4>
                                        <p className="text-sm text-slate-400">Qualidade da distribuição dos seus gastos.</p>
                                        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                                            <div className="flex flex-col">
                                                <span>Necessidades (Meta &lt; 55%)</span>
                                                <b className={`text-sm ${parseFloat(breakdown?.data?.necRatio) <= 55 ? 'text-emerald-400' : 'text-rose-400'}`}>{breakdown?.data?.necRatio}%</b>
                                            </div>
                                            <div className="flex flex-col">
                                                <span>Desejos (Meta &lt; 35%)</span>
                                                <b className={`text-sm ${parseFloat(breakdown?.data?.desRatio) <= 35 ? 'text-emerald-400' : 'text-rose-400'}`}>{breakdown?.data?.desRatio}%</b>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 font-bold text-sm min-w-[45px] text-center">50%</div>
                                        <span className={`text-[10px] font-bold ${breakdown?.reserve > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>+{breakdown?.reserve || 0} pts</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-100 uppercase text-[10px] tracking-widest mb-1 text-slate-500">Reserva de Emergência</h4>
                                        <p className="text-sm text-slate-400">Quanto tempo seu saldo atual te sustenta.</p>
                                        <div className="mt-2 space-y-2">
                                            <div className="flex justify-between items-center text-[10px] text-slate-500 bg-white/5 p-2 rounded-xl border border-white/5">
                                                <span>Saldo em Carteira (Mês Atual)</span>
                                                <b className="text-slate-300">{formatCurrency(breakdown?.data?.monthlyBalance || 0)}</b>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] text-slate-500 bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10">
                                                <span>Patrimônio Investido (Total)</span>
                                                <b className="text-emerald-400">{formatCurrency(breakdown?.data?.totalPatrimonio || 0)}</b>
                                            </div>

                                            <div className="pt-2 border-t border-white/5 flex justify-between items-end">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-blue-400 uppercase font-black">Liquidez Total</span>
                                                    <b className="text-lg text-white leading-tight">{formatCurrency(breakdown?.data?.totalLiquidity || 0)}</b>
                                                </div>
                                                <div className="flex flex-col items-end text-right">
                                                    <span className="text-[10px] text-slate-500 uppercase">Meses de Cobertura</span>
                                                    <b className={`text-xl ${parseFloat(breakdown?.data?.monthsCovered) >= 6 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {breakdown?.data?.monthsCovered} <span className="text-xs font-normal text-slate-500">/ 6 meses</span>
                                                    </b>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                                            <p className="text-[10px] text-blue-300 leading-relaxed italic">
                                                *O Score agora considera apenas seu <b>Saldo do Mês + Patrimônio</b> para o cálculo da reserva.
                                            </p>
                                        </div>

                                        <div className="mt-2 text-[10px] text-slate-500 text-center">
                                            Baseado em Gastos Fixos de <b className="text-slate-400">{formatCurrency(breakdown?.data?.fixedExpenses || 0)}</b>/mês
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-center text-slate-500 italic mt-4">
                                "O score é um termômetro da sua liberdade. Números altos significam tranquilidade."
                            </p>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Background Decoration */}
            <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-20 rounded-full -translate-y-1/2 translate-x-1/2 ${color.replace('text', 'bg')}`}></div>

            <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                {/* Gauge Area */}
                <div className="relative w-32 h-32 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90">
                        <circle
                            cx="64"
                            cy="64"
                            r="58"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="transparent"
                            className="text-white/5"
                        />
                        <circle
                            cx="64"
                            cy="64"
                            r="58"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={364.4}
                            strokeDashoffset={364.4 - (364.4 * score) / 100}
                            strokeLinecap="round"
                            className={`${color} transition-all duration-1000 ease-out`}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-white leading-none">{score}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Score</span>
                    </div>
                </div>

                {/* Info Area */}
                <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                        <Activity className={`w-4 h-4 ${color}`} />
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Saúde Financeira Mêntore</h3>
                    </div>
                    <p className="text-lg md:text-xl font-bold text-white mb-3">
                        {feedback}
                    </p>

                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                        <button
                            onClick={() => setShowLogic(true)}
                            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-400 transition-colors group cursor-pointer"
                        >
                            <Info className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                            <span className="border-b border-dotted border-slate-700">Entenda como seu score é calculado</span>
                        </button>
                    </div>
                </div>

                {/* Status Indicator */}
                <div className="hidden lg:flex items-center gap-4 px-6 border-l border-white/5">
                    {score >= 70 ? (
                        <div className="text-right">
                            <div className="text-emerald-400 font-bold flex items-center gap-1 justify-end">
                                <CheckCircle2 className="w-4 h-4" /> Seguro
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase">Status Global</div>
                        </div>
                    ) : score >= 40 ? (
                        <div className="text-right">
                            <div className="text-yellow-400 font-bold flex items-center gap-1 justify-end">
                                <TrendingUp className="w-4 h-4" /> Evoluindo
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase">Status Global</div>
                        </div>
                    ) : (
                        <div className="text-right">
                            <div className="text-rose-400 font-bold flex items-center gap-1 justify-end">
                                <AlertTriangle className="w-4 h-4" /> Atenção
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase">Status Global</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
