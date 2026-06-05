import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Target, Save, AlertTriangle, CheckCircle2, Clock, Filter, ChevronLeft, ChevronRight, SlidersHorizontal, X, TrendingDown } from 'lucide-react';
import { CATEGORIES, categoryHex } from '../constants/categories';

const EXCLUDED = ['investment', 'vault', 'credit_card_bill', 'conta_fixa'];
const fmt = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SpendingGoals({ transactions = [], cards = [], subscriptions = [], manualConfig = {}, onUpdateConfig, theme }) {
    const isDark = theme !== 'light';
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [showModal, setShowModal] = useState(false);

    const categories = CATEGORIES.expense.filter(c => !EXCLUDED.includes(c.id));
    const budgets = manualConfig.categoryBudgets || {};

    const prevMonth = () => { const [y, m] = selectedMonth.split('-').map(Number); setSelectedMonth(new Date(y, m - 2, 1).toISOString().slice(0, 7)); };
    const nextMonth = () => { const [y, m] = selectedMonth.split('-').map(Number); setSelectedMonth(new Date(y, m, 1).toISOString().slice(0, 7)); };
    const monthLabel = useMemo(() => {
        const [y, m] = selectedMonth.split('-').map(Number);
        return new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }, [selectedMonth]);

    // Gasto por categoria no mês — base de CAIXA (data da compra): conta o gasto no mês em que aconteceu,
    // inclusive compras no crédito (pela data da compra, não pela fatura). credit_card_bill é transferência → fora.
    const spentByCat = useMemo(() => {
        const map = {};
        transactions
            .filter(t => t.type === 'expense' && !['investment', 'vault', 'credit_card_bill'].includes(t.category)
                && (t.date?.slice(0, 7) || t.month) === selectedMonth)
            .forEach(t => { const c = t.category || 'other'; map[c] = (map[c] || 0) + (parseFloat(t.amount) || 0); });
        return map;
    }, [transactions, selectedMonth]);

    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const now = new Date();
    const isCurrentMonth = selectedMonth === now.toISOString().slice(0, 7);
    const daysLeft = isCurrentMonth ? Math.max(0, daysInMonth - now.getDate()) : 0;

    const withBudget = categories.filter(c => parseFloat(budgets[c.id]) > 0);
    const totalBudget = withBudget.reduce((a, c) => a + (parseFloat(budgets[c.id]) || 0), 0);
    const totalSpent = withBudget.reduce((a, c) => a + (spentByCat[c.id] || 0), 0);
    const overallPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;
    const overCount = withBudget.filter(c => (spentByCat[c.id] || 0) > parseFloat(budgets[c.id])).length;
    const onTargetCount = withBudget.length - overCount;

    // Dados do gráfico Teto x Gasto (cor do gasto por status).
    const chartData = useMemo(() => withBudget.map(c => {
        const ceiling = parseFloat(budgets[c.id]) || 0;
        const spent = spentByCat[c.id] || 0;
        const over = spent > ceiling;
        const near = !over && ceiling > 0 && (spent / ceiling) >= 0.8;
        return { label: c.label, Teto: ceiling, Gasto: spent, color: over ? '#f43f5e' : near ? '#f59e0b' : '#10b981' };
    }), [withBudget, budgets, spentByCat]);

    const card = isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';
    const txt = isDark ? 'text-white' : 'text-slate-800';
    const sub = isDark ? 'text-slate-400' : 'text-slate-500';

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            {/* COLUNA DE FILTROS */}
            <div className={`p-5 rounded-2xl border h-fit space-y-4 ${card}`}>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-indigo-500" />
                    <h3 className={`text-sm font-bold uppercase tracking-wider ${txt}`}>Filtros</h3>
                </div>

                <div>
                    <label className={`text-[10px] font-bold uppercase tracking-widest block mb-1.5 ${sub}`}>Mês</label>
                    <div className={`flex items-center justify-between rounded-xl border ${isDark ? 'bg-[#161b27] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                        <button onClick={prevMonth} className="p-2 text-slate-400 hover:text-indigo-400"><ChevronLeft className="w-4 h-4" /></button>
                        <span className={`text-[11px] font-bold uppercase capitalize ${txt}`}>{monthLabel}</span>
                        <button onClick={nextMonth} className="p-2 text-slate-400 hover:text-indigo-400"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                </div>

                <button onClick={() => setShowModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-[11px] uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-indigo-500/25">
                    <SlidersHorizontal className="w-4 h-4" /> Definir tetos
                </button>

                <div className={`pt-3 mt-1 border-t space-y-2.5 ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between"><span className={`text-[11px] ${sub}`}>Categorias com teto</span><span className={`text-sm font-black ${txt}`}>{withBudget.length}</span></div>
                    <div className="flex items-center justify-between"><span className={`text-[11px] ${sub}`}>Orçado</span><span className={`text-sm font-black ${txt}`}>R$ {fmt(totalBudget)}</span></div>
                    <div className="flex items-center justify-between"><span className={`text-[11px] ${sub}`}>Gasto</span><span className={`text-sm font-black ${totalSpent > totalBudget && totalBudget > 0 ? 'text-rose-500' : txt}`}>R$ {fmt(totalSpent)}</span></div>
                    {overCount > 0 && <div className="flex items-center justify-between"><span className={`text-[11px] ${sub}`}>Estouradas</span><span className="text-sm font-black text-rose-500">{overCount}</span></div>}
                    {isCurrentMonth && <div className="flex items-center justify-between"><span className={`text-[11px] ${sub}`}>Dias restantes</span><span className="text-sm font-black text-indigo-400">{daysLeft}</span></div>}
                </div>
                {totalBudget > 0 && (
                    <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                        <div className={`h-full rounded-full transition-all duration-700 ${overallPct >= 100 ? 'bg-rose-500' : overallPct >= 80 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${overallPct}%` }} />
                    </div>
                )}
            </div>

            {/* RELATÓRIO */}
            <div>
                {withBudget.length === 0 ? (
                    <div className={`p-12 rounded-2xl border text-center ${card}`}>
                        <Target className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
                        <p className={`font-bold ${txt}`}>Nenhum teto definido</p>
                        <p className={`text-sm ${sub} mb-4`}>Clique em "Definir tetos" para criar metas por categoria.</p>
                        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 text-white font-bold text-[11px] uppercase tracking-wider hover:bg-indigo-600">
                            <SlidersHorizontal className="w-3.5 h-3.5" /> Definir tetos
                        </button>
                    </div>
                ) : (
                  <div className="space-y-5">
                    {/* KPIs de status */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <Kpi isDark={isDark} icon={Target} color="text-indigo-500" label="Orçado" value={`R$ ${fmt(totalBudget)}`} />
                        <Kpi isDark={isDark} icon={TrendingDown} color={totalSpent > totalBudget ? 'text-rose-500' : 'text-slate-400'} label="Gasto" value={`R$ ${fmt(totalSpent)}`} />
                        <Kpi isDark={isDark} icon={CheckCircle2} color="text-emerald-500" label="Dentro do teto" value={`${onTargetCount}/${withBudget.length}`} />
                        <Kpi isDark={isDark} icon={AlertTriangle} color="text-rose-500" label="Estouradas" value={String(overCount)} />
                    </div>

                    {/* Gráfico Teto x Gasto */}
                    <div className={`p-5 md:p-6 rounded-2xl border ${card}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                            <h4 className={`text-sm font-bold uppercase tracking-wider ${txt}`}>Teto x Gasto por categoria</h4>
                            <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> No alvo</span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Atenção</span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Estourou</span>
                            </div>
                        </div>
                        <div className="w-full" style={{ height: Math.max(180, chartData.length * 46) }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }} barGap={2}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                                    <YAxis type="category" dataKey="label" width={90} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: isDark ? '#cbd5e1' : '#475569' }} />
                                    <Tooltip formatter={(v) => `R$ ${fmt(v)}`} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', borderColor: isDark ? '#1e293b' : '#e2e8f0', borderRadius: '12px' }} labelStyle={{ color: isDark ? '#e2e8f0' : '#0f172a' }} itemStyle={{ color: isDark ? '#e2e8f0' : '#0f172a' }} />
                                    <Legend wrapperStyle={{ fontSize: 11 }} />
                                    <Bar dataKey="Teto" fill={isDark ? '#475569' : '#cbd5e1'} radius={[0, 4, 4, 0]} maxBarSize={16} />
                                    <Bar dataKey="Gasto" radius={[0, 4, 4, 0]} maxBarSize={16}>
                                        {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Cards por categoria */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {withBudget.map(cat => {
                            const Icon = cat.icon;
                            const ceiling = parseFloat(budgets[cat.id]) || 0;
                            const spent = spentByCat[cat.id] || 0;
                            const ratio = ceiling > 0 ? spent / ceiling : 0;
                            const pct = Math.min(100, ratio * 100);
                            const over = spent > ceiling;
                            const near = !over && ratio >= 0.8;
                            const remaining = Math.max(0, ceiling - spent);
                            const barColor = over ? 'bg-rose-500' : near ? 'bg-amber-500' : 'bg-emerald-500';
                            const statusDot = over ? 'bg-rose-500' : near ? 'bg-amber-500' : 'bg-emerald-500';
                            return (
                                <div key={cat.id} className={`p-4 rounded-2xl border ${card}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${categoryHex(cat)}1f`, color: categoryHex(cat) }}><Icon className="w-[18px] h-[18px]" /></span>
                                            <span className={`text-sm font-bold truncate ${txt}`}>{cat.label}</span>
                                        </div>
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} />
                                    </div>
                                    <p className={`text-lg font-black tabular-nums mb-2 ${over ? 'text-rose-500' : txt}`}>R$ {fmt(spent)}<span className="text-xs font-bold text-slate-400"> de R$ {fmt(ceiling)}</span></p>
                                    <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                                        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${Math.max(3, pct)}%` }} />
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        {over ? (
                                            <span className="text-[11px] font-bold text-rose-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Estourou R$ {fmt(spent - ceiling)}</span>
                                        ) : (
                                            <span className={`text-[11px] font-medium ${sub}`}>Faltam R$ {fmt(remaining)}</span>
                                        )}
                                        {isCurrentMonth && <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {daysLeft}d</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                  </div>
                )}
            </div>

            {showModal && createPortal(
                <BudgetModal isDark={isDark} categories={categories} manualConfig={manualConfig} onUpdateConfig={onUpdateConfig} spentByCat={spentByCat} onClose={() => setShowModal(false)} />,
                document.body
            )}
        </div>
    );
}

function BudgetModal({ isDark, categories, manualConfig, onUpdateConfig, spentByCat, onClose }) {
    // O modal monta a cada abertura, então o estado inicial já reflete a config atual.
    const [budgets, setBudgets] = useState({ ...(manualConfig.categoryBudgets || {}) });
    const txt = isDark ? 'text-white' : 'text-slate-800';

    const handleSave = () => {
        onUpdateConfig?.({ ...manualConfig, categoryBudgets: budgets });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
            <div className={`w-full max-w-lg rounded-[2rem] border shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar ${isDark ? 'bg-[#161b27] border-white/10' : 'bg-white border-slate-200'}`} onClick={e => e.stopPropagation()}>
                <div className={`flex items-center justify-between px-6 py-5 border-b sticky top-0 z-10 ${isDark ? 'bg-[#161b27] border-white/5' : 'bg-white border-slate-100'}`}>
                    <h3 className={`text-lg font-black flex items-center gap-2 ${txt}`}><Target className="w-5 h-5 text-indigo-500" /> Definir tetos de gasto</h3>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-rose-400"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {categories.map(cat => {
                        const Icon = cat.icon;
                        const spent = spentByCat[cat.id] || 0;
                        return (
                            <div key={cat.id} className={`p-3 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${categoryHex(cat)}1f`, color: categoryHex(cat) }}><Icon className="w-4 h-4" /></span>
                                    <span className={`text-xs font-bold ${txt}`}>{cat.label}</span>
                                </div>
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isDark ? 'bg-[#0f131c] border-white/10' : 'bg-white border-slate-200'}`}>
                                    <span className="text-[11px] font-bold text-slate-500">R$</span>
                                    <input type="number" inputMode="decimal" min="0" placeholder="0,00"
                                        value={budgets[cat.id] ?? ''}
                                        onChange={(e) => setBudgets(prev => ({ ...prev, [cat.id]: e.target.value }))}
                                        className={`flex-1 bg-transparent text-sm font-bold focus:outline-none ${txt}`} />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Gasto no mês: R$ {fmt(spent)}</p>
                            </div>
                        );
                    })}
                </div>
                <div className={`flex gap-3 px-6 py-5 border-t sticky bottom-0 ${isDark ? 'bg-[#161b27] border-white/5' : 'bg-white border-slate-100'}`}>
                    <button onClick={onClose} className={`flex-1 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest ${isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Cancelar</button>
                    <button onClick={handleSave} className="flex-1 py-3 bg-indigo-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-indigo-500/25 hover:bg-indigo-600 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Salvar tetos</button>
                </div>
            </div>
        </div>
    );
}

function Kpi({ isDark, icon: Icon, color, label, value }) {
    const card = isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';
    return (
        <div className={`p-4 rounded-2xl border ${card}`}>
            <div className="flex items-center gap-2 mb-1.5"><Icon className={`w-4 h-4 ${color}`} /><span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">{label}</span></div>
            <p className={`text-lg font-black tabular-nums truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{value}</p>
        </div>
    );
}
