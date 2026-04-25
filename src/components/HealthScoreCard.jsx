import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Info, TrendingUp, AlertTriangle, CheckCircle2, X, Wallet, ShieldCheck, Target } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function HealthScoreCard({ scoreData }) {
    const { theme } = useTheme();
    
    if (!scoreData) return null;
    
    const { score = 0, feedback = "", color = "text-slate-400", bg = "bg-slate-400/10", breakdown = {} } = scoreData;
    const [showLogic, setShowLogic] = useState(false);

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className={`relative overflow-hidden glass-card transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-900/10 p-5 md:p-8 ${bg}`}>
            {/* Logic Modal - Preserving existing logic */}
            {showLogic && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className={`border rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/5'
                    }`}>
                        <div className={`p-8 border-b flex justify-between items-center ${
                            theme === 'light' ? 'bg-[#f0fdfa] border-emerald-100/30' : 'bg-slate-900/50 border-white/5'
                        }`}>
                            <h3 className={`text-xl font-black flex items-center gap-3 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                <Activity className="w-6 h-6 text-emerald-500" />
                                Como calculamos sua Paz?
                            </h3>
                            <button onClick={() => setShowLogic(false)} className="p-2 text-slate-400 hover:text-white">
                                <X className="w-8 h-8" />
                            </button>
                        </div>
                        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                           {/* ... keeping the same breakdown structure internally but styled cleaner ... */}
                           <div className="space-y-4">
                                <div className={`p-6 rounded-3xl border ${theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Performance Mensal (20%)</h4>
                                        <span className="text-xs font-black">+{breakdown?.performance || 0} pts</span>
                                    </div>
                                    <p className="text-xs opacity-70 leading-relaxed">Considera se você gastou menos do que ganhou este mês.</p>
                                </div>
                                <div className={`p-6 rounded-3xl border ${theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500">Alocação de Gastos (30%)</h4>
                                        <span className="text-xs font-black">+{breakdown?.allocation || 0} pts</span>
                                    </div>
                                    <p className="text-xs opacity-70 leading-relaxed">Mede a proporção entre Necessidades (&lt;55%) e Desejos (&lt;35%).</p>
                                </div>
                                <div className={`p-6 rounded-3xl border ${theme === 'light' ? 'bg-emerald-50 border-emerald-100' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Reserva de Emergência (50%)</h4>
                                        <span className="text-xs font-black">+{breakdown?.reserve || 0} pts</span>
                                    </div>
                                    <p className="text-xs opacity-70 leading-relaxed">O fator mais importante: quantos meses seus investimentos cobrem seu custo de vida (Ideal: 6+ meses).</p>
                                </div>
                           </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Background Decoration */}
            <div className={`absolute top-0 right-0 w-64 h-64 blur-[100px] opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 ${(color || 'text-slate-400').replace('text', 'bg')}`}></div>

            <div className="flex flex-col lg:flex-row items-center gap-10 relative z-10">
                {/* Gauge Area - Larger */}
                <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full -rotate-90">
                        <circle cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/5" />
                        <circle
                            cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="12" fill="transparent"
                            strokeDasharray={452.4} strokeDashoffset={452.4 - (452.4 * score) / 100}
                            strokeLinecap="round" className={`${color} transition-all duration-1000 ease-out shadow-lg`}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-5xl font-black leading-none tracking-tighter ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{score}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Paz</span>
                    </div>
                </div>

                {/* Info Area - Enriched with mini widgets */}
                <div className="flex-1 text-center lg:text-left space-y-6 w-full">
                    <div>
                        <div className="flex items-center justify-center lg:justify-start gap-2 mb-2">
                            <Activity className={`w-4 h-4 ${color}`} />
                            <h3 className={`text-xs font-black uppercase tracking-widest ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>Índice de Saúde Financeira</h3>
                        </div>
                        <p className={`text-2xl md:text-3xl font-black leading-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                            {feedback}
                        </p>
                    </div>

                    {/* Mini Widgets Grid to fill space */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className={`p-4 rounded-2xl border ${theme === 'light' ? 'bg-white/40 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                                <Wallet className="w-3 h-3" /> Sobra no Mês
                            </p>
                            <p className={`text-sm font-black ${parseFloat(breakdown?.data?.monthlyBalance) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {formatCurrency(breakdown?.data?.monthlyBalance || 0)}
                            </p>
                        </div>
                        <div className={`p-4 rounded-2xl border ${theme === 'light' ? 'bg-white/40 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                                <ShieldCheck className="w-3 h-3" /> Cobertura
                            </p>
                            <p className={`text-sm font-black ${parseFloat(breakdown?.data?.monthsCovered) >= 6 ? 'text-emerald-500' : 'text-blue-400'}`}>
                                {breakdown?.data?.monthsCovered || 0} Meses
                            </p>
                        </div>
                        <div className={`p-4 rounded-2xl border ${theme === 'light' ? 'bg-white/40 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                                <Target className="w-3 h-3" /> Alocação
                            </p>
                            <p className={`text-sm font-black ${parseFloat(breakdown?.data?.necRatio) <= 55 ? 'text-emerald-500' : 'text-yellow-500'}`}>
                                {breakdown?.data?.necRatio || 0}% Essencial
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowLogic(true)}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-500 transition-colors group"
                    >
                        <Info className="w-3.5 h-3.5" />
                        <span className="border-b border-transparent group-hover:border-blue-500">Ver análise detalhada</span>
                    </button>
                </div>

                {/* Status Indicator Badge */}
                <div className={`hidden xl:flex flex-col items-center justify-center p-8 border-l border-white/5 min-w-[180px]`}>
                    {score >= 70 ? (
                        <div className="text-center animate-in zoom-in duration-500">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            </div>
                            <p className="text-emerald-500 font-black text-sm uppercase tracking-widest">Seguro</p>
                            <p className="text-[9px] text-slate-500 font-bold">Status Global OK</p>
                        </div>
                    ) : score >= 40 ? (
                        <div className="text-center animate-in zoom-in duration-500">
                            <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                <TrendingUp className="w-8 h-8 text-yellow-400" />
                            </div>
                            <p className="text-yellow-400 font-black text-sm uppercase tracking-widest">Evoluindo</p>
                            <p className="text-[9px] text-slate-500 font-bold">Status em Alerta</p>
                        </div>
                    ) : (
                        <div className="text-center animate-in zoom-in duration-500">
                            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                <AlertTriangle className="w-8 h-8 text-rose-500" />
                            </div>
                            <p className="text-rose-500 font-black text-sm uppercase tracking-widest">Crítico</p>
                            <p className="text-[9px] text-slate-500 font-bold">Ação Necessária</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
