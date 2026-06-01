import React from 'react';
import { Sparkles, Calendar, TrendingUp, TrendingDown, Wallet, ArrowRight, X, CreditCard, ShieldCheck, AlertTriangle, PiggyBank, Lightbulb } from 'lucide-react';
import aliviaFinal from '../assets/alivia/alivia-final.png';
import ReactMarkdown from 'react-markdown';

export default function MonthlyReviewModal({ isOpen, onClose, reviewText, monthName, stats, theme }) {
    if (!isOpen) return null;

    const currentMonthLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const isCurrentMonth = monthName.toLowerCase() === currentMonthLabel.toLowerCase();

    const isLocalhost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (isLocalhost && stats?.rich) {
        return <MonthlyReviewModalV2 r={stats.rich} monthName={monthName} onClose={onClose} theme={theme} />;
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-500">
            <div className={`relative w-full max-w-2xl max-h-[90vh] md:max-h-[85vh] rounded-[2rem] md:rounded-[2.5rem] border overflow-y-auto shadow-2xl transition-all duration-700 animate-in zoom-in-95 slide-in-from-bottom-8 scrollbar-hide ${
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
                    <div className="flex items-center gap-4 mb-6 md:mb-8 self-start md:self-center">
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
                                {isCurrentMonth ? 'Como está seu mês' : 'O Mês que Passou'}
                            </h2>
                            <p className="text-emerald-500 font-bold uppercase tracking-widest text-[10px]">Feedback da Alívia em {monthName}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 md:gap-3 w-full mb-6 md:mb-8">
                        <div className={`p-3 md:p-4 rounded-2xl md:rounded-3xl border flex flex-col items-center text-center ${
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
                    <div className={`w-full p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border mb-6 md:mb-10 leading-relaxed text-sm md:text-base ${
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
                        className="group w-full max-w-sm py-4 md:py-5 px-6 md:px-8 bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white rounded-[1.5rem] md:rounded-[2rem] shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                    >
                        <span className="font-bold text-base md:text-lg leading-none">Entendido</span>
                        <ArrowRight className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-1 transition-transform" />
                    </button>
                    
                    {!isCurrentMonth && (
                        <p className="mt-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-50 flex items-center gap-2">
                            <Calendar className="w-3 h-3" /> Relatório de Fechamento Automático
                        </p>
                    )}
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
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}} />
        </div>
    );
}

// ── Tela de virada de mês reformulada (dados corretos: saldo, cartões, reserva) ──
function MonthlyReviewModalV2({ r, monthName, onClose, theme }) {
    const isDark = theme !== 'light';
    const fmt = (v) => `R$ ${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const positive = r.balance >= 0;
    const cap = monthName ? monthName.charAt(0).toUpperCase() + monthName.slice(1) : 'mês';

    const card = isDark ? 'bg-white/[0.04] border-white/10' : 'bg-slate-50 border-slate-100';
    const txt = isDark ? 'text-white' : 'text-slate-900';
    const sub = isDark ? 'text-slate-400' : 'text-slate-500';

    // Análise determinística (sempre coerente com os números exibidos)
    const analysis = [];
    analysis.push({
        icon: positive ? TrendingUp : AlertTriangle, color: positive ? '#10b981' : '#f43f5e',
        title: positive ? 'Resultado do mês' : 'Atenção ao resultado',
        text: positive
            ? <>Você fechou <b>{cap}</b> no positivo: sobraram <b className="text-emerald-500">{fmt(r.balance)}</b> entre o que entrou ({fmt(r.income)}) e o que saiu da sua conta ({fmt(r.expense)}).</>
            : <>Em <b>{cap}</b> os gastos ({fmt(r.expense)}) superaram as entradas ({fmt(r.income)}) em <b className="text-rose-500">{fmt(Math.abs(r.balance))}</b>.</>,
    });
    if (r.topValue > 0) analysis.push({ icon: TrendingDown, color: '#f59e0b', title: 'Maior categoria', text: <>Seu maior gasto foi em <b>{r.topCategory}</b> ({fmt(r.topValue)}){r.superfluous > 0 ? <> e os supérfluos somaram <b>{fmt(r.superfluous)}</b></> : null}.</> });
    analysis.push({
        icon: CreditCard, color: '#8b5cf6', title: 'Cartões de crédito',
        text: r.creditSpend > 0
            ? <>Você lançou <b className="text-violet-400">{fmt(r.creditSpend)}</b> no crédito. Esse valor não saiu da conta no mês — ele chega na <b>fatura</b>, então mantenha-o no radar para não pesar no mês seguinte.</>
            : <>Você não usou o crédito neste mês — ótimo para manter as faturas sob controle.</>,
    });
    analysis.push({
        icon: ShieldCheck, color: '#10b981', title: 'Reserva de emergência',
        text: r.reserve > 0
            ? <>Sua reserva de emergência está em <b className="text-emerald-500">{fmt(r.reserve)}</b>{r.invested > 0 ? <>, e você direcionou <b>{fmt(r.invested)}</b> para investimentos/reserva no mês</> : null}.</>
            : <>Você ainda não tem reserva de emergência registrada — comece a construir uma para mais tranquilidade.</>,
    });

    const recs = [];
    if (!positive) recs.push('Priorize cobrir os gastos fixos e reduzir supérfluos para fechar o próximo mês no azul.');
    if (r.income > 0 && r.creditSpend > r.income * 0.5) recs.push('O uso do crédito foi alto frente à sua renda — planeje as próximas compras para a fatura não apertar.');
    if (r.reserve <= 0) recs.push('Comece sua reserva de emergência: o ideal é cobrir de 3 a 6 meses de despesas.');
    if (recs.length === 0) recs.push('Continue assim! Considere aumentar seus aportes para acelerar seus objetivos.');

    const kpis = [
        { label: 'Ganhos', value: r.income, icon: TrendingUp, color: 'text-emerald-500', soft: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50' },
        { label: 'Gastos', value: r.expense, icon: TrendingDown, color: 'text-rose-500', soft: isDark ? 'bg-rose-500/10' : 'bg-rose-50' },
        { label: 'Saldo do mês', value: r.balance, icon: Wallet, color: positive ? 'text-emerald-500' : 'text-rose-500', soft: isDark ? 'bg-blue-500/10' : 'bg-blue-50' },
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-300">
            <div className={`relative w-full max-w-xl max-h-[92vh] overflow-y-auto scrollbar-hide rounded-3xl border shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-6 duration-500 ${isDark ? 'bg-[#161b27] border-white/10' : 'bg-white border-slate-200'}`}>
                {/* faixa de topo */}
                <div className="relative h-20 bg-gradient-to-r from-blue-600/30 via-violet-600/20 to-emerald-500/30 overflow-hidden">
                    <div className="absolute inset-0 opacity-40 bg-gradient-to-br from-transparent to-black/30" />
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/40 transition-colors z-10"><X className="w-4 h-4 text-white" /></button>
                </div>

                <div className="px-6 md:px-8 pb-7 -mt-10">
                    {/* Header Alívia */}
                    <div className="flex items-center gap-3 mb-6">
                        <img src={aliviaFinal} alt="Alívia" className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20 shadow-lg" />
                        <div className="pt-8">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Fechamento de {cap}</p>
                            <h2 className={`text-xl font-black tracking-tight ${txt}`}>O mês que passou</h2>
                        </div>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-3 gap-2.5 mb-5">
                        {kpis.map(k => (
                            <div key={k.label} className={`p-3 rounded-2xl border ${card}`}>
                                <span className={`inline-flex p-1.5 rounded-lg mb-2 ${k.soft}`}><k.icon className={`w-4 h-4 ${k.color}`} /></span>
                                <p className={`text-[9px] font-bold uppercase tracking-widest ${sub}`}>{k.label}</p>
                                <p className={`text-sm md:text-base font-black tabular-nums ${k.label === 'Saldo do mês' ? k.color : txt}`}>{fmt(k.value)}</p>
                            </div>
                        ))}
                    </div>

                    {/* Cartões + Reserva (secundários) */}
                    <div className="grid grid-cols-2 gap-2.5 mb-6">
                        <div className={`p-3 rounded-2xl border flex items-center gap-3 ${card}`}>
                            <span className={`p-2 rounded-xl ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}><CreditCard className="w-4 h-4 text-violet-400" /></span>
                            <div className="min-w-0"><p className={`text-[9px] font-bold uppercase tracking-widest ${sub}`}>No crédito (fatura)</p><p className={`text-sm font-black tabular-nums ${txt}`}>{fmt(r.creditSpend)}</p></div>
                        </div>
                        <div className={`p-3 rounded-2xl border flex items-center gap-3 ${card}`}>
                            <span className={`p-2 rounded-xl ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}><PiggyBank className="w-4 h-4 text-emerald-500" /></span>
                            <div className="min-w-0"><p className={`text-[9px] font-bold uppercase tracking-widest ${sub}`}>Reserva</p><p className={`text-sm font-black tabular-nums ${txt}`}>{fmt(r.reserve)}</p></div>
                        </div>
                    </div>

                    {/* Análise */}
                    <div className="space-y-3 mb-5">
                        {analysis.map((a, i) => (
                            <div key={i} className={`flex items-start gap-3 p-3.5 rounded-2xl border ${card}`}>
                                <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${a.color}1f` }}><a.icon className="w-4 h-4" style={{ color: a.color }} /></span>
                                <div className="min-w-0">
                                    <p className={`text-[11px] font-black uppercase tracking-wider mb-0.5`} style={{ color: a.color }}>{a.title}</p>
                                    <p className={`text-[12.5px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{a.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Recomendações */}
                    <div className={`p-4 rounded-2xl border mb-6 ${isDark ? 'bg-blue-500/[0.06] border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
                        <p className="text-[11px] font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5 mb-2"><Lightbulb className="w-3.5 h-3.5" /> Recomendações</p>
                        <ul className="space-y-1.5">
                            {recs.map((rec, i) => (
                                <li key={i} className={`flex items-start gap-2 text-[12.5px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />{rec}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <button onClick={onClose} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2">
                        Entendido <ArrowRight className="w-4 h-4" />
                    </button>
                    <p className={`mt-3 text-center text-[9px] font-bold uppercase tracking-widest opacity-50 flex items-center justify-center gap-1.5 ${sub}`}><Calendar className="w-3 h-3" /> Relatório de fechamento automático</p>
                </div>
            </div>
        </div>
    );
}
