import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Info, TrendingUp, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function HealthScoreCard({ scoreData }) {
    const { theme } = useTheme();
    const { score, feedback, color, bg, breakdown } = scoreData;
    const [showLogic, setShowLogic] = useState(false);

    // Formatação de moeda simples
    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className={`relative overflow-hidden glass-card transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-900/10 p-6 ${bg}`}>
            {/* Logic Modal */}
            {showLogic && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className={`border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700/50'
                    }`}>
                        <div className={`p-6 border-b flex justify-between items-center ${
                            theme === 'light' ? 'bg-[#f0fdfa] border-emerald-100/30' : 'bg-slate-900/50 border-white/5'
                        }`}>
                            <h3 className={`text-xl font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                <Activity className="w-5 h-5 text-emerald-500" />
                                Como sua paz é calculada?
                            </h3>
                            <button onClick={() => setShowLogic(false)} className={`p-2 rounded-lg transition-colors ${
                                theme === 'light' ? 'hover:bg-blue-50 text-slate-400 hover:text-blue-500' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                            }`}>
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                            <div className="space-y-4">
                                <div className={`flex items-start gap-4 p-4 rounded-2xl border transition-colors ${
                                    theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'
                                }`}>
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 font-bold text-sm min-w-[45px] text-center">20%</div>
                                        <span className={`text-[10px] font-bold ${breakdown?.performance > 0 ? 'text-emerald-500' : theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>+{breakdown?.performance || 0} pts</span>
                                    </div>
                                    <div>
                                        <h4 className={`font-bold uppercase text-[10px] tracking-widest mb-1 ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>Seu Mês</h4>
                                        <p className={`text-sm font-bold ${theme === 'light' ? 'text-slate-600' : 'text-slate-200'}`}>Como você cuidou do seu dinheiro este mês.</p>
                                        <div className={`mt-2 text-xs flex gap-3 font-bold ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>
                                            <span>Entradas: <b className={theme === 'light' ? 'text-slate-900' : 'text-white'}>{formatCurrency(breakdown?.data?.monthlyIncome || 0)}</b></span>
                                            <span>Gastos: <b className={theme === 'light' ? 'text-slate-900' : 'text-white'}>{formatCurrency(breakdown?.data?.actualExpense || 0)}</b></span>
                                        </div>
                                    </div>
                                </div>

                                <div className={`flex items-start gap-4 p-4 rounded-2xl border transition-colors ${
                                    theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'
                                }`}>
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="p-2 rounded-xl bg-blue-50 text-blue-500 font-bold text-sm min-w-[45px] text-center">30%</div>
                                        <span className={`text-[10px] font-bold ${breakdown?.allocation > 0 ? 'text-emerald-500' : theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>+{breakdown?.allocation || 0} pts</span>
                                    </div>
                                    <div>
                                        <h4 className={`font-bold uppercase text-[10px] tracking-widest mb-1 ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>Suas Sementinhas</h4>
                                        <p className={`text-sm font-bold ${theme === 'light' ? 'text-slate-600' : 'text-slate-200'}`}>Qualidade da distribuição dos seus gastos.</p>
                                        <div className={`mt-2 grid grid-cols-2 gap-2 text-[10px] font-bold ${theme === 'light' ? 'text-slate-700' : 'text-slate-100'}`}>
                                            <div className="flex flex-col">
                                                <span>Necessidades (Meta &lt; 55%)</span>
                                                <b className={`text-sm ${parseFloat(breakdown?.data?.necRatio) <= 55 ? 'text-emerald-600' : 'text-rose-600'}`}>{breakdown?.data?.necRatio}%</b>
                                            </div>
                                            <div className="flex flex-col">
                                                <span>Desejos (Meta &lt; 35%)</span>
                                                <b className={`text-sm ${parseFloat(breakdown?.data?.desRatio) <= 35 ? 'text-emerald-600' : 'text-rose-600'}`}>{breakdown?.data?.desRatio}%</b>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className={`flex items-start gap-4 p-4 rounded-2xl border transition-colors ${
                                    theme === 'light' ? 'bg-[#FFF08C]/10 border-[#FFF08C]/20' : 'bg-white/5 border-white/5'
                                }`}>
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="p-2 rounded-xl bg-[#FFF08C]/40 text-emerald-800 font-bold text-sm min-w-[45px] text-center">50%</div>
                                        <span className={`text-[10px] font-bold ${breakdown?.reserve > 0 ? 'text-emerald-700' : theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>+{breakdown?.reserve || 0} pts</span>
                                    </div>
                                    <div>
                                        <h4 className={`font-bold uppercase text-[10px] tracking-widest mb-1 ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>Sua Proteção</h4>
                                        <p className={`text-sm font-bold ${theme === 'light' ? 'text-slate-600' : 'text-slate-200'}`}>Quanto tempo suas reservas te mantêm em paz.</p>
                                        <div className="mt-2 space-y-2">
                                            <div className={`flex justify-between items-center text-[10px] font-bold bg-white/5 p-2 rounded-xl border border-white/5 ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>
                                                <span>Saldo em Carteira (Mês Atual)</span>
                                                <b className={theme === 'light' ? 'text-slate-900' : 'text-white'}>{formatCurrency(breakdown?.data?.monthlyBalance || 0)}</b>
                                            </div>
                                            <div className={`flex justify-between items-center text-[10px] font-bold bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10 ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>
                                                <span>Patrimônio Investido (Total)</span>
                                                <b className={theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'}>{formatCurrency(breakdown?.data?.totalPatrimonio || 0)}</b>
                                            </div>

                                            <div className="pt-2 border-t border-white/5 flex justify-between items-end">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-blue-600 uppercase font-bold">Liquidez Total</span>
                                                    <b className={`text-xl leading-tight ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{formatCurrency(breakdown?.data?.totalLiquidity || 0)}</b>
                                                </div>
                                                <div className="flex flex-col items-end text-right">
                                                    <span className={`text-[10px] uppercase font-bold ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Meses de Cobertura</span>
                                                    <b className={`text-xl ${parseFloat(breakdown?.data?.monthsCovered) >= 6 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {breakdown?.data?.monthsCovered} <span className={`text-xs font-normal font-bold ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>/ 6 meses</span>
                                                    </b>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                                            <p className="text-[10px] text-emerald-600 leading-relaxed italic">
                                                *A Alívia considera seu <b>Saldo + Sementinhas</b> para medir sua tranquilidade.
                                            </p>
                                        </div>

                                        <div className={`mt-2 text-[10px] font-bold text-center ${theme === 'light' ? 'text-slate-700' : 'text-slate-400'}`}>
                                            Baseado em Gastos Fixos de <b className={theme === 'light' ? 'text-slate-900' : 'text-slate-200'}>{formatCurrency(breakdown?.data?.fixedExpenses || 0)}</b>/mês
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <p className={`text-xs text-center italic font-bold mt-4 ${theme === 'light' ? 'text-slate-700' : 'text-slate-500'}`}>
                                "Sua tranquilidade é o maior patrimônio que você pode construir."
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
                        <span className={`text-3xl font-black leading-none ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{score}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Paz</span>
                    </div>
                </div>

                {/* Info Area */}
                <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                        <Activity className={`w-4 h-4 ${color}`} />
                        <h3 className={`text-sm font-bold uppercase tracking-wider ${theme === 'light' ? 'text-slate-400' : 'text-slate-300'}`}>Nível de Tranquilidade</h3>
                    </div>
                    <p className={`text-lg md:text-xl font-bold mb-3 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
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
