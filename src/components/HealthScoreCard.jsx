import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Info, TrendingUp, AlertTriangle, CheckCircle2, X, Wallet, ShieldCheck, Target, Pencil, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function HealthScoreCard({ scoreData, baseIncome = 0, onUpdateBaseIncome }) {
    const { theme } = useTheme();
    // IMPORTANT: All hooks must be called before any early return (Rules of Hooks).
    const [showLogic, setShowLogic] = useState(false);
    const [editingIncome, setEditingIncome] = useState(false);
    const [incomeInput, setIncomeInput] = useState('');

    if (!scoreData) return null;

    const { score = 0, feedback = "", color = "text-slate-400", bg = "bg-slate-400/10", breakdown = {} } = scoreData;

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
                        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">

                            {/* Score total */}
                            <div className={`p-4 rounded-2xl border text-center ${theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Pontuação Total</p>
                                <p className={`text-4xl font-black ${color}`}>{score} <span className="text-base font-bold text-slate-400">/ 100</span></p>
                                <p className={`text-xs font-bold mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{feedback}</p>
                            </div>

                            {/* Bloco 1: Performance */}
                            <div className={`p-5 rounded-2xl border ${theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                                <div className="flex justify-between items-center mb-3">
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500">1. Performance Mensal</h4>
                                        <p className="text-[9px] text-slate-500 mt-0.5">Vale até 20 pts — Você gastou menos do que ganhou?</p>
                                    </div>
                                    <span className={`text-lg font-black ${breakdown?.performance >= 15 ? 'text-emerald-400' : breakdown?.performance >= 8 ? 'text-yellow-400' : 'text-rose-400'}`}>
                                        +{breakdown?.performance || 0} pts
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    <div className={`p-3 rounded-xl ${theme === 'light' ? 'bg-white border border-slate-100' : 'bg-white/5'}`}>
                                        <p className="text-[9px] font-black text-slate-500 uppercase mb-1">
                                            Renda {breakdown?.data?.incomeSource === 'base' ? '(base manual)' : '(lançamentos)'}
                                        </p>
                                        <p className="text-sm font-black text-emerald-400">{formatCurrency(breakdown?.data?.monthlyIncome || 0)}</p>
                                    </div>
                                    <div className={`p-3 rounded-xl ${theme === 'light' ? 'bg-white border border-slate-100' : 'bg-white/5'}`}>
                                        <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Gastos do Mês</p>
                                        <p className="text-sm font-black text-rose-400">{formatCurrency(breakdown?.data?.actualExpense || 0)}</p>
                                    </div>
                                </div>
                                <div className={`flex items-center justify-between p-3 rounded-xl ${parseFloat(breakdown?.data?.monthlyBalance) >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Sobra / Falta no mês</span>
                                    <span className={`text-sm font-black ${parseFloat(breakdown?.data?.monthlyBalance) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {formatCurrency(breakdown?.data?.monthlyBalance || 0)}
                                    </span>
                                </div>
                                {breakdown?.data?.incomeSource === 'base' && (
                                    <p className="text-[9px] text-amber-500 mt-2">⚠ Usando renda base — lance suas entradas do mês para um cálculo mais preciso.</p>
                                )}
                            </div>

                            {/* Bloco 2: Alocação */}
                            <div className={`p-5 rounded-2xl border ${theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                                <div className="flex justify-between items-center mb-3">
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400">2. Alocação de Gastos</h4>
                                        <p className="text-[9px] text-slate-500 mt-0.5">Vale até 30 pts — Regra 50/30/20</p>
                                    </div>
                                    <span className={`text-lg font-black ${breakdown?.allocation >= 25 ? 'text-emerald-400' : breakdown?.allocation >= 15 ? 'text-yellow-400' : 'text-rose-400'}`}>
                                        +{breakdown?.allocation || 0} pts
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {[
                                        { label: 'Essencial (housing, saúde, transporte…)', amount: breakdown?.data?.necessitiesAmount, ratio: breakdown?.data?.necRatio, meta: '< 55%', ok: parseFloat(breakdown?.data?.necRatio) <= 55, pts: '10 pts' },
                                        { label: 'Desejos (lazer, compras, assinaturas…)', amount: breakdown?.data?.desiresAmount, ratio: breakdown?.data?.desRatio, meta: '< 35%', ok: parseFloat(breakdown?.data?.desRatio) <= 35, pts: '10 pts' },
                                        { label: 'Poupança / Investimento', amount: breakdown?.data?.savingsAmount, ratio: breakdown?.data?.savRatio, meta: '> 20%', ok: parseFloat(breakdown?.data?.savRatio) >= 20, pts: '10 pts' },
                                    ].map((row, i) => (
                                        <div key={i} className={`flex items-center justify-between p-3 rounded-xl ${theme === 'light' ? 'bg-white border border-slate-100' : 'bg-white/5'}`}>
                                            <div className="flex-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase">{row.label}</p>
                                                <p className={`text-xs font-black mt-0.5 ${row.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {formatCurrency(row.amount || 0)} — {row.ratio || 0}% <span className="text-slate-500 font-normal">(meta: {row.meta})</span>
                                                </p>
                                            </div>
                                            <span className={`ml-3 text-[10px] font-black ${row.ok ? 'text-emerald-400' : 'text-slate-600'}`}>{row.ok ? `✓ ${row.pts}` : '0 pts'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Bloco 3: Reserva */}
                            <div className={`p-5 rounded-2xl border ${theme === 'light' ? 'bg-emerald-50 border-emerald-100' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                                <div className="flex justify-between items-center mb-3">
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500">3. Reserva de Emergência</h4>
                                        <p className="text-[9px] text-slate-500 mt-0.5">Vale até 50 pts — O fator mais importante</p>
                                    </div>
                                    <span className={`text-lg font-black ${breakdown?.reserve >= 40 ? 'text-emerald-400' : breakdown?.reserve >= 20 ? 'text-yellow-400' : 'text-rose-400'}`}>
                                        +{breakdown?.reserve || 0} pts
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    <div className={`p-3 rounded-xl ${theme === 'light' ? 'bg-white border border-slate-100' : 'bg-black/20'}`}>
                                        <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Reserva (cofrinhos)</p>
                                        <p className="text-sm font-black text-emerald-400">{formatCurrency(breakdown?.data?.reserveTotal || 0)}</p>
                                    </div>
                                    <div className={`p-3 rounded-xl ${theme === 'light' ? 'bg-white border border-slate-100' : 'bg-black/20'}`}>
                                        <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Gastos Fixos / mês</p>
                                        <p className="text-sm font-black text-slate-300">{formatCurrency(breakdown?.data?.fixedExpenses || 0)}</p>
                                        <p className="text-[8px] text-slate-500 mt-0.5">Gastos Fixos + Assinaturas recorrentes</p>
                                    </div>
                                </div>
                                <div className={`flex items-center justify-between p-3 rounded-xl ${parseFloat(breakdown?.data?.monthsCovered) >= 6 ? 'bg-emerald-500/20' : 'bg-amber-500/10'}`}>
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase">Cobertura atual</span>
                                        <p className="text-[9px] text-slate-500">Reserva ÷ Gastos fixos mensais</p>
                                    </div>
                                    <span className={`text-sm font-black ${parseFloat(breakdown?.data?.monthsCovered) >= 6 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {breakdown?.data?.monthsCovered || '0.0'} meses <span className="text-slate-500 text-[9px] font-normal">(meta: 6+)</span>
                                    </span>
                                </div>
                                {(!breakdown?.data?.fixedExpenses || breakdown?.data?.fixedExpenses === 0) && (
                                    <p className="text-[9px] text-amber-500 mt-2">⚠ Cadastre seus gastos fixos na aba "Gastos Fixos" para calcular a cobertura real.</p>
                                )}
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
                        <div className={`p-4 rounded-2xl border flex flex-col justify-between ${theme === 'light' ? 'bg-white/40 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                                <Wallet className="w-3 h-3" /> Sobra no Mês
                            </p>
                            <div>
                                <p className={`text-sm font-black ${parseFloat(breakdown?.data?.monthlyBalance) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {formatCurrency(breakdown?.data?.monthlyBalance || 0)}
                                </p>
                                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 opacity-60 mt-1">Meta: &gt; R$ 0,00</p>
                            </div>
                        </div>
                        <div className={`p-4 rounded-2xl border flex flex-col justify-between ${theme === 'light' ? 'bg-white/40 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                                <ShieldCheck className="w-3 h-3" /> Cobertura
                            </p>
                            <div>
                                <p className={`text-sm font-black ${parseFloat(breakdown?.data?.monthsCovered) >= 6 ? 'text-emerald-500' : 'text-blue-400'}`}>
                                    {breakdown?.data?.monthsCovered || 0} Meses
                                </p>
                                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 opacity-60 mt-1">Meta: 6+ Meses</p>
                            </div>
                        </div>
                        <div className={`p-4 rounded-2xl border flex flex-col justify-between ${theme === 'light' ? 'bg-white/40 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                                <Target className="w-3 h-3" /> Alocação
                            </p>
                            <div>
                                <p className={`text-sm font-black ${parseFloat(breakdown?.data?.necRatio) <= 55 ? 'text-emerald-500' : 'text-yellow-500'}`}>
                                    {breakdown?.data?.necRatio || 0}% Essencial
                                </p>
                                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 opacity-60 mt-1">Meta: &lt; 55% Essencial</p>
                            </div>
                        </div>
                    </div>

                    {/* Renda Mensal Base */}
                    <div className="flex items-center gap-3">
                        {editingIncome ? (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-500">R$</span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    autoFocus
                                    value={incomeInput}
                                    onChange={e => setIncomeInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            const val = parseFloat(incomeInput.replace(',', '.')) || 0;
                                            onUpdateBaseIncome?.(val);
                                            setEditingIncome(false);
                                        }
                                        if (e.key === 'Escape') setEditingIncome(false);
                                    }}
                                    className={`w-32 px-2 py-1 rounded-lg border text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                                        theme === 'light' ? 'bg-white border-slate-300 text-slate-800' : 'bg-white/10 border-white/20 text-white'
                                    }`}
                                    placeholder="Ex: 3500"
                                />
                                <button
                                    onClick={() => {
                                        const val = parseFloat(incomeInput.replace(',', '.')) || 0;
                                        onUpdateBaseIncome?.(val);
                                        setEditingIncome(false);
                                    }}
                                    className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => { setIncomeInput(baseIncome ? String(baseIncome) : ''); setEditingIncome(true); }}
                                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-emerald-400 transition-colors group"
                            >
                                <Wallet className="w-3.5 h-3.5" />
                                <span className="border-b border-transparent group-hover:border-emerald-400">
                                    {baseIncome > 0
                                        ? `Renda base: R$ ${baseIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                        : 'Definir renda mensal base'}
                                </span>
                                <Pencil className="w-3 h-3 opacity-50" />
                            </button>
                        )}
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
