import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, BarChart3, FileText, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { CATEGORIES } from '../constants/categories';
import { getExpenseBasis, isMonthlyExpenseTx } from '../utils/financialLogic';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MonthlyComparative({ transactions = [], manualConfig = {}, theme }) {
    const isDark = theme !== 'light';
    const [range, setRange] = useState(6); // 3 | 6 | 12
    const [reportMode, setReportMode] = useState('sintetico'); // 'sintetico' | 'analitico'

    // Constrói os últimos N meses terminando no mês atual.
    const months = useMemo(() => {
        const arr = [];
        const now = new Date();
        for (let i = range - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = d.toISOString().slice(0, 7);
            const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
            arr.push({ key, label, full: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) });
        }
        return arr;
    }, [range]);

    // Gastos conforme o REGIME configurado (competência/caixa) — mesmo critério do
    // saldo e do índice, para o comparativo bater com a Visão Geral.
    const expenseBasis = getExpenseBasis(manualConfig);
    const data = useMemo(() => {
        return months.map(mo => {
            const monthTx = transactions.filter(t => (t.date?.slice(0, 7) || t.month) === mo.key);
            const income = monthTx
                .filter(t => t.type === 'income' && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category))
                .reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
            const expenseTxs = monthTx.filter(t => isMonthlyExpenseTx(t, expenseBasis));
            const expense = expenseTxs.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
            const byCat = {};
            expenseTxs.forEach(t => { const c = t.category || 'other'; byCat[c] = (byCat[c] || 0) + (parseFloat(t.amount) || 0); });
            return { ...mo, Ganhos: income, Gastos: expense, Saldo: income - expense, byCat };
        });
    }, [months, transactions, expenseBasis]);

    // Síntese do período
    const synth = useMemo(() => {
        const totalIncome = data.reduce((a, d) => a + d.Ganhos, 0);
        const totalExpense = data.reduce((a, d) => a + d.Gastos, 0);
        const avgExpense = data.length ? totalExpense / data.length : 0;
        const avgIncome = data.length ? totalIncome / data.length : 0;
        const withExpense = data.filter(d => d.Gastos > 0);
        const worst = withExpense.length ? withExpense.reduce((a, b) => (b.Gastos > a.Gastos ? b : a)) : null;
        const best = withExpense.length ? withExpense.reduce((a, b) => (b.Gastos < a.Gastos ? b : a)) : null;
        const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
        // tendência: compara média da 1ª metade com a 2ª metade
        const half = Math.floor(data.length / 2);
        const firstHalf = data.slice(0, half);
        const secondHalf = data.slice(half);
        const avg = (arr) => arr.length ? arr.reduce((a, d) => a + d.Gastos, 0) / arr.length : 0;
        const trendPct = avg(firstHalf) > 0 ? ((avg(secondHalf) - avg(firstHalf)) / avg(firstHalf)) * 100 : 0;
        return { totalIncome, totalExpense, avgExpense, avgIncome, worst, best, savingsRate, trendPct, balance: totalIncome - totalExpense };
    }, [data]);

    // Tendência por categoria (para o analítico)
    const categoryTrends = useMemo(() => {
        const totals = {};
        data.forEach(d => Object.entries(d.byCat).forEach(([c, v]) => { totals[c] = (totals[c] || 0) + v; }));
        return Object.entries(totals).sort(([, a], [, b]) => b - a).slice(0, 6).map(([id, total]) => ({
            id, total,
            label: CATEGORIES.expense.find(c => c.id === id)?.label || 'Outro',
            color: CATEGORIES.expense.find(c => c.id === id)?.color || 'text-slate-400',
            avg: total / (data.length || 1),
        }));
    }, [data]);

    const card = isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';
    const txt = isDark ? 'text-white' : 'text-slate-800';
    const sub = isDark ? 'text-slate-400' : 'text-slate-500';

    return (
        <div className="space-y-6">
            {/* Controles */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className={`flex gap-0.5 rounded-xl p-1 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                    {[3, 6, 12].map(n => (
                        <button key={n} onClick={() => setRange(n)}
                            className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
                                range === n ? 'bg-emerald-500 text-white shadow' : `${sub} hover:${txt}`
                            }`}>
                            {n} meses
                        </button>
                    ))}
                </div>
                <div className={`flex gap-0.5 rounded-xl p-1 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                    {[['sintetico', 'Sintético'], ['analitico', 'Analítico']].map(([id, lbl]) => (
                        <button key={id} onClick={() => setReportMode(id)}
                            className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
                                reportMode === id ? 'bg-blue-500 text-white shadow' : `${sub}`
                            }`}>
                            {lbl}
                        </button>
                    ))}
                </div>
            </div>

            {/* Gráfico de barras */}
            <div className={`p-5 md:p-6 rounded-2xl border ${card}`}>
                <h3 className={`text-base font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${txt}`}>
                    <BarChart3 className="w-5 h-5 text-emerald-500" /> Ganhos x Gastos — últimos {range} meses
                </h3>
                <div className="w-full h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barGap={4}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} className="capitalize" />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                            <Tooltip
                                contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', borderColor: isDark ? '#1e293b' : '#e2e8f0', borderRadius: '12px' }}
                                formatter={(v) => `R$ ${fmt(v)}`}
                                labelStyle={{ color: isDark ? '#94a3b8' : '#64748b', marginBottom: 4, textTransform: 'capitalize' }}
                                itemStyle={{ color: isDark ? '#e2e8f0' : '#0f172a' }}
                                cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                            />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="Ganhos" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={28} />
                            <Bar dataKey="Gastos" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={28} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {reportMode === 'sintetico' ? (
                /* RELATÓRIO SINTÉTICO */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard isDark={isDark} icon={TrendingUp} color="emerald" label="Total recebido" value={`R$ ${fmt(synth.totalIncome)}`} hint={`Média R$ ${fmt(synth.avgIncome)}/mês`} />
                    <StatCard isDark={isDark} icon={TrendingDown} color="rose" label="Total gasto" value={`R$ ${fmt(synth.totalExpense)}`} hint={`Média R$ ${fmt(synth.avgExpense)}/mês`} />
                    <StatCard isDark={isDark} icon={BarChart3} color={synth.balance >= 0 ? 'emerald' : 'rose'} label="Resultado" value={`R$ ${fmt(synth.balance)}`} hint={`Taxa de poupança ${synth.savingsRate.toFixed(0)}%`} />
                    <StatCard isDark={isDark} icon={synth.trendPct <= 0 ? ArrowDownRight : ArrowUpRight} color={synth.trendPct <= 0 ? 'emerald' : 'amber'}
                        label="Tendência de gastos" value={`${synth.trendPct >= 0 ? '+' : ''}${synth.trendPct.toFixed(0)}%`}
                        hint={synth.trendPct <= 0 ? 'Gastando menos no período' : 'Gastando mais no período'} />
                    {synth.worst && (
                        <div className={`md:col-span-2 p-5 rounded-2xl border ${card}`}>
                            <p className={`text-[10px] font-bold uppercase tracking-widest ${sub} mb-1`}>Mês mais caro</p>
                            <p className={`text-lg font-black capitalize ${txt}`}>{synth.worst.full}</p>
                            <p className="text-sm font-bold text-rose-500">R$ {fmt(synth.worst.Gastos)}</p>
                        </div>
                    )}
                    {synth.best && (
                        <div className={`md:col-span-2 p-5 rounded-2xl border ${card}`}>
                            <p className={`text-[10px] font-bold uppercase tracking-widest ${sub} mb-1`}>Mês mais econômico</p>
                            <p className={`text-lg font-black capitalize ${txt}`}>{synth.best.full}</p>
                            <p className="text-sm font-bold text-emerald-500">R$ {fmt(synth.best.Gastos)}</p>
                        </div>
                    )}
                </div>
            ) : (
                /* RELATÓRIO ANALÍTICO */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Tabela mês a mês */}
                    <div className={`p-5 md:p-6 rounded-2xl border ${card}`}>
                        <h4 className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${txt}`}>
                            <FileText className="w-4 h-4 text-blue-500" /> Mês a mês
                        </h4>
                        <div className="space-y-2">
                            <div className={`grid grid-cols-4 gap-2 pb-2 border-b text-[9px] font-bold uppercase tracking-wider ${sub} ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                                <span>Mês</span><span className="text-right">Ganhos</span><span className="text-right">Gastos</span><span className="text-right">Saldo</span>
                            </div>
                            {data.map(d => (
                                <div key={d.key} className="grid grid-cols-4 gap-2 py-1.5 text-[12px]">
                                    <span className={`capitalize font-medium ${txt}`}>{d.label}</span>
                                    <span className="text-right text-emerald-500 tabular-nums">{fmt(d.Ganhos)}</span>
                                    <span className="text-right text-rose-500 tabular-nums">{fmt(d.Gastos)}</span>
                                    <span className={`text-right tabular-nums font-bold ${d.Saldo >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{fmt(d.Saldo)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tendência por categoria */}
                    <div className={`p-5 md:p-6 rounded-2xl border ${card}`}>
                        <h4 className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${txt}`}>
                            <BarChart3 className="w-4 h-4 text-rose-500" /> Maiores categorias no período
                        </h4>
                        <div className="space-y-3">
                            {categoryTrends.length === 0 && <p className={`text-sm ${sub}`}>Sem gastos no período.</p>}
                            {categoryTrends.map(ct => {
                                const pct = synth.totalExpense > 0 ? (ct.total / synth.totalExpense) * 100 : 0;
                                return (
                                    <div key={ct.id}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`text-xs font-bold ${txt}`}>{ct.label}</span>
                                            <span className={`text-xs font-bold tabular-nums ${txt}`}>R$ {fmt(ct.total)} <span className="text-slate-400 font-medium">({pct.toFixed(0)}%)</span></span>
                                        </div>
                                        <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                                            <div className="h-full rounded-full bg-rose-500" style={{ width: `${pct}%` }} />
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Média R$ {fmt(ct.avg)}/mês</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ isDark, icon: Icon, color, label, value, hint }) {
    const colors = {
        emerald: 'text-emerald-500', rose: 'text-rose-500', amber: 'text-amber-500', blue: 'text-blue-500',
    };
    const card = isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';
    return (
        <div className={`p-5 rounded-2xl border ${card}`}>
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${colors[color]}`} />
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{label}</span>
            </div>
            <p className={`text-xl font-black tabular-nums ${isDark ? 'text-white' : 'text-slate-800'}`}>{value}</p>
            {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
        </div>
    );
}
