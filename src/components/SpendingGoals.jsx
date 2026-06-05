import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Target, Save, Clock, X, Search, Download, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { CATEGORIES, categoryHex } from '../constants/categories';
import aliviaFinal from '../assets/alivia/alivia-final.png';

const EXCLUDED = ['investment', 'vault', 'credit_card_bill', 'conta_fixa'];
const fmt = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_META = {
    no_limite:  { label: 'No limite',  hex: '#10b981', text: 'text-emerald-400', dot: 'bg-emerald-500' },
    atencao:    { label: 'Atenção',    hex: '#f59e0b', text: 'text-amber-500',   dot: 'bg-amber-500' },
    estourada:  { label: 'Estourada',  hex: '#f43f5e', text: 'text-rose-400',    dot: 'bg-rose-500' },
    sem_gastos: { label: 'Sem gastos', hex: '#64748b', text: 'text-slate-400',   dot: 'bg-slate-500' },
};
const PRIORITY_META = {
    essential:   { label: 'Essencial', text: 'text-blue-400',  hex: '#60a5fa' },
    comfort:     { label: 'Conforto',  text: 'text-amber-500', hex: '#f59e0b' },
    superfluous: { label: 'Supérfluo', text: 'text-rose-400',  hex: '#f43f5e' },
};

const statusOf = (spent, ceiling) => {
    if (spent <= 0.005) return 'sem_gastos';
    const ratio = ceiling > 0 ? spent / ceiling : 0;
    if (ratio >= 1) return 'estourada';
    if (ratio >= 0.7) return 'atencao';
    return 'no_limite';
};

export default function SpendingGoals({ transactions = [], manualConfig = {}, onUpdateConfig, theme }) {
    const isDark = theme !== 'light';
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [showModal, setShowModal] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState([]);     // multi: chaves de STATUS_META
    const [priorityFilter, setPriorityFilter] = useState([]); // multi: chaves de PRIORITY_META

    const categories = CATEGORIES.expense.filter(c => !EXCLUDED.includes(c.id));
    const budgets = manualConfig.categoryBudgets || {};

    const prevMonth = () => { const [y, m] = selectedMonth.split('-').map(Number); setSelectedMonth(new Date(y, m - 2, 1).toISOString().slice(0, 7)); };
    const nextMonth = () => { const [y, m] = selectedMonth.split('-').map(Number); setSelectedMonth(new Date(y, m, 1).toISOString().slice(0, 7)); };
    const monthLabel = useMemo(() => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const s = new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        return s.charAt(0).toUpperCase() + s.slice(1);
    }, [selectedMonth]);

    // Gasto por categoria no mês (base de caixa: pela data da compra; exclui transferências).
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

    const goals = useMemo(() => categories
        .filter(c => parseFloat(budgets[c.id]) > 0)
        .map(c => {
            const ceiling = parseFloat(budgets[c.id]) || 0;
            const spent = spentByCat[c.id] || 0;
            const ratio = ceiling > 0 ? spent / ceiling : 0;
            return { id: c.id, label: c.label, icon: c.icon, hex: categoryHex(c), priority: c.defaultPriority || 'comfort', ceiling, spent, ratio, status: statusOf(spent, ceiling) };
        })
        .sort((a, b) => b.ratio - a.ratio),
        [categories, budgets, spentByCat]);

    const totalBudget = goals.reduce((a, g) => a + g.ceiling, 0);
    const totalSpent = goals.reduce((a, g) => a + g.spent, 0);
    const usedPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
    const remaining = Math.max(0, totalBudget - totalSpent);
    const withSpend = goals.filter(g => g.spent > 0.005).length;
    const nearCount = goals.filter(g => g.status === 'atencao').length;
    const overGoals = goals.filter(g => g.status === 'estourada');
    const overAmount = overGoals.reduce((a, g) => a + Math.max(0, g.spent - g.ceiling), 0);

    const toggle = (arr, setArr, v) => setArr(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
    const hasFilters = search || statusFilter.length || priorityFilter.length;
    const clearFilters = () => { setSearch(''); setStatusFilter([]); setPriorityFilter([]); };
    const visibleGoals = goals.filter(g => {
        if (search && !g.label.toLowerCase().includes(search.toLowerCase())) return false;
        if (statusFilter.length && !statusFilter.includes(g.status)) return false;
        if (priorityFilter.length && !priorityFilter.includes(g.priority)) return false;
        return true;
    });

    const topGoals = goals.filter(g => g.spent > 0.005).slice(0, 5);

    const ringHex = usedPct >= 100 ? '#f43f5e' : usedPct >= 70 ? '#f59e0b' : '#10b981';

    let aliviaText;
    if (goals.length === 0) aliviaText = 'Defina tetos por categoria para a Alívia acompanhar suas metas em tempo real.';
    else if (overGoals.length > 0) aliviaText = `${overGoals.map(g => g.label).join(', ')} estouraram o limite este mês. Revise esses gastos para não comprometer o próximo mês.`;
    else if (nearCount > 0) aliviaText = `${nearCount} categoria${nearCount > 1 ? 's estão' : ' está'} chegando perto do limite. Fique de olho para não estourar.`;
    else if (totalSpent <= 0.005) aliviaText = 'Nenhum gasto registrado neste mês ainda. Suas metas estão zeradas — comece a lançar para acompanhar.';
    else aliviaText = 'Tudo sob controle! Seus gastos estão dentro dos limites definidos. Continue assim. 👏';

    const handleExport = () => {
        const head = ['Categoria', 'Prioridade', 'Orçado', 'Gasto', 'Restante', '% do limite', 'Status'];
        const rows = goals.map(g => [g.label, PRIORITY_META[g.priority].label, fmt(g.ceiling), fmt(g.spent), fmt(Math.max(0, g.ceiling - g.spent)), `${Math.round(g.ratio * 100)}%`, STATUS_META[g.status].label]);
        const csv = [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `metas-de-gasto-${selectedMonth}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    // ── estilos base ──
    const card = isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';
    const txt = isDark ? 'text-white' : 'text-slate-900';
    const sub = isDark ? 'text-slate-400' : 'text-slate-500';
    const fieldBg = isDark ? 'bg-[#161b27] border-white/10' : 'bg-white border-slate-200';

    const KpiCard = ({ accent, label, value, hint }) => (
        <div className={`relative rounded-2xl border overflow-hidden ${card}`}>
            <div className="h-1 w-full" style={{ background: accent }} />
            <div className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                <p className="text-2xl font-black tabular-nums mt-1" style={{ color: accent }}>{value}</p>
                <p className={`text-[11px] mt-0.5 ${sub}`}>{hint}</p>
            </div>
        </div>
    );

    const Chip = ({ active, onClick, hex, children }) => (
        <button onClick={onClick}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${active ? 'text-white' : (isDark ? 'text-slate-400 border-white/10 hover:bg-white/5' : 'text-slate-500 border-slate-200 hover:bg-slate-50')}`}
            style={active ? { background: hex, borderColor: hex } : undefined}>
            {hex && !active && <span className="w-2 h-2 rounded-full" style={{ background: hex }} />}
            {children}
        </button>
    );

    return (
        <div className="space-y-5">
            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className={`text-2xl font-black tracking-tight ${txt}`}>Metas de Gasto</h1>
                    <p className={`text-sm mt-0.5 ${sub}`}>Defina limites por categoria e acompanhe em tempo real</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleExport} className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        <Download className="w-4 h-4" /> Exportar
                    </button>
                    <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black transition-all active:scale-95 shadow-lg shadow-emerald-500/25">
                        <Plus className="w-4 h-4" /> Nova meta
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard accent="#22d3ee" label="Total de metas" value={goals.length} hint={`${withSpend} com gastos`} />
                <KpiCard accent="#34d399" label="Budget total" value={`R$ ${fmt(totalBudget)}`} hint={`R$ ${fmt(totalSpent)} usado (${usedPct}%)`} />
                <KpiCard accent="#f59e0b" label="Em atenção" value={nearCount} hint="70-99% do limite" />
                <KpiCard accent="#f43f5e" label="Estouradas" value={overGoals.length} hint={`R$ ${fmt(overAmount)} acima`} />
            </div>

            {/* Barra de filtros */}
            <div className={`rounded-2xl border p-3 flex flex-wrap items-center gap-x-5 gap-y-2.5 ${card}`}>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Período</span>
                    <div className={`flex items-center rounded-lg border ${fieldBg}`}>
                        <button onClick={prevMonth} className="p-1.5 text-slate-400 hover:text-emerald-400"><ChevronLeft className="w-4 h-4" /></button>
                        <span className={`text-[11px] font-bold px-1 min-w-[88px] text-center ${txt}`}>{monthLabel}</span>
                        <button onClick={nextMonth} className="p-1.5 text-slate-400 hover:text-emerald-400"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Busca</span>
                    <div className={`relative flex-1`}>
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar categoria..." className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs outline-none ${fieldBg} ${txt} placeholder:text-slate-500`} />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {Object.entries(STATUS_META).map(([k, v]) => (
                            <Chip key={k} active={statusFilter.includes(k)} onClick={() => toggle(statusFilter, setStatusFilter, k)} hex={v.hex}>{v.label}</Chip>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Prioridade</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {Object.entries(PRIORITY_META).map(([k, v]) => (
                            <Chip key={k} active={priorityFilter.includes(k)} onClick={() => toggle(priorityFilter, setPriorityFilter, k)} hex={v.hex}>{v.label}</Chip>
                        ))}
                    </div>
                </div>

                <button onClick={clearFilters} disabled={!hasFilters} className={`ml-auto text-[11px] font-bold transition-colors ${hasFilters ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-600 cursor-default'}`}>Limpar</button>
            </div>

            {goals.length === 0 ? (
                <div className={`p-12 rounded-2xl border text-center ${card}`}>
                    <Target className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                    <p className={`font-bold ${txt}`}>Nenhuma meta definida</p>
                    <p className={`text-sm ${sub} mb-4`}>Crie metas por categoria para acompanhar seus gastos em tempo real.</p>
                    <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white font-black text-xs hover:bg-emerald-600"><Plus className="w-4 h-4" /> Nova meta</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">
                    {/* Cards das metas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {visibleGoals.length === 0 ? (
                            <p className={`col-span-full text-center text-sm py-10 ${sub}`}>Nenhuma categoria para os filtros selecionados.</p>
                        ) : visibleGoals.map(g => {
                            const sm = STATUS_META[g.status];
                            const pm = PRIORITY_META[g.priority];
                            const pct = Math.round(g.ratio * 100);
                            const over = g.status === 'estourada';
                            const noSpend = g.status === 'sem_gastos';
                            const Icon = g.icon;
                            return (
                                <div key={g.id} className={`rounded-2xl border p-4 ${isDark ? 'bg-[#1e2330]' : 'bg-white shadow-sm'}`}
                                    style={{ borderColor: over ? `${sm.hex}66` : (isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9') }}>
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${g.hex}1f`, color: g.hex }}><Icon className="w-[18px] h-[18px]" /></span>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-bold truncate ${txt}`}>{g.label}</p>
                                                <p className={`text-[10px] font-semibold ${pm.text}`}>{pm.label}</p>
                                            </div>
                                        </div>
                                        <span className="text-[9px] font-black uppercase tracking-wide px-2 py-1 rounded-lg shrink-0" style={{ background: `${sm.hex}1a`, color: sm.hex }}>{sm.label}</span>
                                    </div>
                                    <p className="text-xl font-black tabular-nums" style={over ? { color: sm.hex } : undefined}>
                                        <span className={over ? '' : txt}>R$ {fmt(g.spent)}</span>
                                        <span className="text-xs font-bold text-slate-400"> de R$ {fmt(g.ceiling)}</span>
                                    </p>
                                    <div className={`w-full h-2 rounded-full overflow-hidden mt-2.5 ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(noSpend ? 0 : 3, Math.min(100, pct))}%`, background: sm.hex }} />
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className={`text-[11px] font-medium ${over ? 'text-rose-400' : sub}`}>
                                            {over ? `Estourou R$ ${fmt(g.spent - g.ceiling)}` : noSpend ? 'Nenhum gasto ainda' : `Restam R$ ${fmt(g.ceiling - g.spent)}`}
                                        </span>
                                        <span className="text-[11px] font-black tabular-nums" style={{ color: noSpend ? '#64748b' : sm.hex }}>
                                            {noSpend ? '—' : over ? `+${Math.round(g.ratio * 100 - 100)}% estourado` : `${pct}%`}
                                        </span>
                                    </div>
                                    {!noSpend && isCurrentMonth && (
                                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1.5"><Clock className="w-3 h-3" /> {daysLeft} dias restantes no mês</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Sidebar: Resumo do Mês + Alívia */}
                    <div className="space-y-4">
                        <div className={`rounded-2xl border p-5 ${card}`}>
                            <h3 className={`text-sm font-bold mb-4 ${txt}`}>Resumo do Mês</h3>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="relative w-[88px] h-[88px] shrink-0">
                                    <svg viewBox="0 0 36 36" className="w-[88px] h-[88px] -rotate-90">
                                        <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" stroke={isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'} />
                                        <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" strokeLinecap="round" stroke={ringHex} strokeDasharray={2 * Math.PI * 15.5} strokeDashoffset={2 * Math.PI * 15.5 * (1 - Math.min(1, usedPct / 100))} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
                                    </svg>
                                    <span className="absolute inset-0 flex items-center justify-center text-sm font-black" style={{ color: ringHex }}>{usedPct}%</span>
                                </div>
                                <div className="flex-1 min-w-0 space-y-1.5 text-[12px]">
                                    <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-slate-400"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Gasto</span><span className={`font-black tabular-nums ${txt}`}>R$ {fmt(totalSpent)}</span></div>
                                    <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-slate-400"><span className="w-2 h-2 rounded-full bg-slate-500" /> Budget</span><span className={`font-black tabular-nums ${txt}`}>R$ {fmt(totalBudget)}</span></div>
                                    <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-slate-400"><span className="w-2 h-2 rounded-full bg-blue-500" /> Restam</span><span className="font-black tabular-nums text-blue-400">R$ {fmt(remaining)}</span></div>
                                </div>
                            </div>
                            {topGoals.length > 0 && (
                                <div className={`pt-3 border-t space-y-2.5 ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                                    {topGoals.map(g => {
                                        const Icon = g.icon; const sm = STATUS_META[g.status];
                                        return (
                                            <div key={g.id} className="flex items-center gap-2.5">
                                                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${g.hex}1f`, color: g.hex }}><Icon className="w-4 h-4" /></span>
                                                <div className="min-w-0 flex-1">
                                                    <p className={`text-[12px] font-bold truncate ${txt}`}>{g.label}</p>
                                                    <p className="text-[10px] font-semibold" style={{ color: sm.hex }}>{Math.round(g.ratio * 100)}% do limite</p>
                                                </div>
                                                <span className={`text-[12px] font-black tabular-nums shrink-0 ${txt}`}>R$ {fmt(g.spent)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className={`rounded-2xl border p-4 flex items-start gap-3 ${isDark ? 'bg-emerald-500/[0.05] border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                            <img src={aliviaFinal} alt="Alívia" className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500/30 shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Alívia · Metas</p>
                                <p className={`text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{aliviaText}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showModal && createPortal(
                <BudgetModal isDark={isDark} categories={categories} manualConfig={manualConfig} onUpdateConfig={onUpdateConfig} spentByCat={spentByCat} onClose={() => setShowModal(false)} />,
                document.body
            )}
        </div>
    );
}

function BudgetModal({ isDark, categories, manualConfig, onUpdateConfig, spentByCat, onClose }) {
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
                    <h3 className={`text-lg font-black flex items-center gap-2 ${txt}`}><Target className="w-5 h-5 text-emerald-500" /> Definir metas por categoria</h3>
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
                    <button onClick={handleSave} className="flex-1 py-3 bg-emerald-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Salvar metas</button>
                </div>
            </div>
        </div>
    );
}
