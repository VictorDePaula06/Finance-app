import { useMemo, useState } from 'react';
import {
    ArrowDownLeft, ArrowUpRight, Wallet, Info, Search, ListFilter, Circle, CreditCard, ShieldOff,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { buildWalletLedger } from '../utils/financialLogic';
import { CATEGORIES } from '../constants/categories.js';

const PAY_LABELS = { credito: 'Crédito', debito: 'Débito', pix: 'Pix', dinheiro: 'Dinheiro', boleto: 'Boleto' };

const fmt = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const monthLabel = (key) => {
    // key = 'YYYY-MM'
    const [y, m] = key.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    const s = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
};

const dayLabel = (dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const txMonthOf = (t) => t.month || (t.date ? String(t.date).slice(0, 7) : '');

export default function ExtratoTab({ transactions = [] }) {
    const { theme } = useTheme();
    const isDark = theme !== 'light';

    const [filter, setFilter] = useState('all');     // all | income | expense
    const [period, setPeriod] = useState('current');  // current | 'YYYY-MM' | all
    const [search, setSearch] = useState('');

    const currentMonthKey = new Date().toISOString().slice(0, 7);

    // Extrato com saldo corrente (mesma regra do saldo em carteira da Visão Geral).
    const ledger = useMemo(() => buildWalletLedger(transactions, currentMonthKey), [transactions, currentMonthKey]);
    const { entries, finalBalance } = ledger;

    // Meses disponíveis (para o seletor de período).
    const months = useMemo(() => {
        const set = new Set(entries.map(e => txMonthOf(e.t)).filter(Boolean));
        return Array.from(set).sort((a, b) => (a < b ? 1 : -1)); // desc
    }, [entries]);

    const selectedMonth = period === 'current' ? currentMonthKey : period;

    // Entradas do período (após filtro de período, antes do filtro entrada/saída).
    const periodEntries = useMemo(() => {
        let list = entries;
        if (period !== 'all') list = list.filter(e => txMonthOf(e.t) === selectedMonth);
        return list;
    }, [entries, period, selectedMonth]);

    // Totais do período (apenas o que afeta o caixa).
    const totals = useMemo(() => {
        let entrou = 0, saiu = 0;
        periodEntries.forEach(({ t, affects, delta }) => {
            if (!affects) return;
            if (t.type === 'income') entrou += delta; else saiu += -delta;
        });
        return { entrou, saiu, resultado: entrou - saiu };
    }, [periodEntries]);

    // Lista final (filtro entrada/saída + busca), mais recente primeiro.
    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return periodEntries
            .filter(({ t }) => filter === 'all' || t.type === filter)
            .filter(({ t }) => {
                if (!q) return true;
                const list = t.type === 'income' ? CATEGORIES.income : CATEGORIES.expense;
                const catLabel = (list.find(c => c.id === t.category)?.label || '').toLowerCase();
                return (t.description || '').toLowerCase().includes(q) || catLabel.includes(q);
            })
            .slice()
            .reverse();
    }, [periodEntries, filter, search]);

    // Agrupa por dia.
    const groups = useMemo(() => {
        const map = [];
        let cur = null;
        visible.forEach(e => {
            const key = e.t.date ? String(e.t.date).slice(0, 10) : (txMonthOf(e.t) + '-01');
            if (!cur || cur.key !== key) { cur = { key, items: [] }; map.push(cur); }
            cur.items.push(e);
        });
        return map;
    }, [visible]);

    const hasCreditOrReserve = useMemo(
        () => periodEntries.some(e => !e.affects),
        [periodEntries]
    );

    // ── estilos base ──
    const card = isDark ? 'bg-[#151822] border-white/[0.06]' : 'bg-white border-slate-100 shadow-sm';
    const txt = isDark ? 'text-white' : 'text-slate-900';
    const sub = isDark ? 'text-slate-400' : 'text-slate-500';
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';

    const catMeta = (t) => {
        const list = t.type === 'income' ? CATEGORIES.income : CATEGORIES.expense;
        return list.find(c => c.id === t.category) || { label: t.category || 'Outro', icon: Circle, color: 'text-slate-400' };
    };

    const FilterBtn = ({ id, label }) => {
        const active = filter === id;
        return (
            <button
                onClick={() => setFilter(id)}
                className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold tracking-wide transition-all ${active
                    ? (id === 'income' ? 'bg-emerald-500 text-white' : id === 'expense' ? 'bg-rose-500 text-white' : (isDark ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'))
                    : (isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100')}`}
            >
                {label}
            </button>
        );
    };

    return (
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-4 pb-10">
            {/* Cabeçalho */}
            <div>
                <h1 className={`text-xl font-black tracking-tight ${txt}`}>Extrato</h1>
                <p className={`text-xs mt-0.5 ${sub}`}>
                    Tudo o que entrou e saiu da sua carteira, em ordem. Apenas para consulta — nada aqui pode ser editado.
                </p>
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-3 gap-2.5">
                <div className={`rounded-2xl border p-3.5 ${card}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                        <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${sub}`}>Entrou</span>
                    </div>
                    <p className="text-base md:text-lg font-black text-emerald-500">R$ {fmt(totals.entrou)}</p>
                </div>
                <div className={`rounded-2xl border p-3.5 ${card}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                        <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${sub}`}>Saiu</span>
                    </div>
                    <p className="text-base md:text-lg font-black text-rose-500">R$ {fmt(totals.saiu)}</p>
                </div>
                <div className={`rounded-2xl border p-3.5 ${card}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                        <Wallet className={`w-3.5 h-3.5 ${finalBalance < 0 ? 'text-rose-500' : 'text-blue-500'}`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${sub}`}>Saldo em carteira</span>
                    </div>
                    <p className={`text-base md:text-lg font-black ${finalBalance < 0 ? 'text-rose-500' : txt}`}>R$ {fmt(finalBalance)}</p>
                    <p className={`text-[9px] mt-0.5 leading-tight ${muted}`}>Acumulado desde o último saldo inicial.</p>
                </div>
            </div>

            {/* Explicação do resultado do período */}
            <div className={`rounded-2xl border p-3.5 ${card}`}>
                <p className={`text-[11px] leading-relaxed ${sub}`}>
                    {period === 'all' ? 'Somando todo o histórico' : `Em ${monthLabel(selectedMonth)}`}, entraram{' '}
                    <span className="font-black text-emerald-500">R$ {fmt(totals.entrou)}</span> e saíram{' '}
                    <span className="font-black text-rose-500">R$ {fmt(totals.saiu)}</span>, dando um resultado de{' '}
                    <span className={`font-black ${totals.resultado < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {totals.resultado < 0 ? '−' : '+'}R$ {fmt(Math.abs(totals.resultado))}
                    </span>
                    {totals.resultado < 0 ? ' — você gastou mais do que entrou neste período.' : '.'}
                </p>
            </div>

            {/* Controles */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                {/* Período */}
                <div className="relative">
                    <select
                        value={period}
                        onChange={e => setPeriod(e.target.value)}
                        className={`appearance-none pl-3 pr-8 py-2 rounded-xl border text-xs font-bold outline-none cursor-pointer ${isDark ? 'bg-[#151822] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                    >
                        <option value="current">Este mês</option>
                        {months.filter(m => m !== currentMonthKey).map(m => (
                            <option key={m} value={m}>{monthLabel(m)}</option>
                        ))}
                        <option value="all">Todo o histórico</option>
                    </select>
                    <ListFilter className={`w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${sub}`} />
                </div>

                {/* Filtro entrada/saída */}
                <div className={`inline-flex items-center gap-1 p-1 rounded-xl border ${isDark ? 'bg-[#151822] border-white/10' : 'bg-white border-slate-200'}`}>
                    <FilterBtn id="all" label="Tudo" />
                    <FilterBtn id="income" label="Entradas" />
                    <FilterBtn id="expense" label="Saídas" />
                </div>

                {/* Busca */}
                <div className="relative flex-1 min-w-0">
                    <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${sub}`} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por descrição ou categoria…"
                        className={`w-full pl-8 pr-3 py-2 rounded-xl border text-xs outline-none ${isDark ? 'bg-[#151822] border-white/10 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
                    />
                </div>
            </div>

            {/* Lista */}
            <div className={`rounded-2xl border overflow-hidden ${card}`}>
                {groups.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center text-center gap-2">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                            <ListFilter className={`w-5 h-5 ${muted}`} />
                        </div>
                        <p className={`text-sm font-bold ${txt}`}>Nenhuma movimentação</p>
                        <p className={`text-xs ${sub}`}>Não há registros para o período e filtro selecionados.</p>
                    </div>
                ) : (
                    groups.map(g => (
                        <div key={g.key}>
                            <div className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest sticky top-0 ${isDark ? 'bg-[#11141c] text-slate-500 border-b border-white/[0.04]' : 'bg-slate-50 text-slate-400 border-b border-slate-100'}`}>
                                {dayLabel(g.key)}
                            </div>
                            {g.items.map(({ t, affects, runningBalance }, i) => {
                                const meta = catMeta(t);
                                const Icon = meta.icon || Circle;
                                const isIncome = t.type === 'income';
                                const pay = PAY_LABELS[t.paymentMethod] || '';
                                const reserve = !affects && t.paymentMethod !== 'credito';
                                return (
                                    <div
                                        key={t.id || i}
                                        className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? (isDark ? 'border-t border-white/[0.04]' : 'border-t border-slate-50') : ''} ${!affects ? 'opacity-70' : ''}`}
                                    >
                                        {/* Ícone direção */}
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isIncome ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                                            <Icon className={`w-4 h-4 ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`} />
                                        </div>

                                        {/* Descrição + detalhes */}
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-[13px] font-bold truncate ${txt}`}>
                                                {t.description || meta.label}
                                            </p>
                                            <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 mt-0.5">
                                                <span className={`text-[10px] font-semibold ${sub}`}>{meta.label}</span>
                                                {pay && <span className={`text-[10px] ${muted}`}>· {pay}</span>}
                                                {t.installmentInfo && <span className={`text-[10px] ${muted}`}>· {t.installmentInfo}</span>}
                                                {t.paymentMethod === 'credito' && (
                                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-400">
                                                        <CreditCard className="w-2.5 h-2.5" /> entra na fatura
                                                    </span>
                                                )}
                                                {reserve && (
                                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-500">
                                                        <ShieldOff className="w-2.5 h-2.5" /> não afeta o saldo
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Valor + saldo corrente */}
                                        <div className="text-right shrink-0">
                                            <p className={`text-[13px] font-black ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {isIncome ? '+' : '−'} R$ {fmt(t.amount)}
                                            </p>
                                            {affects && (
                                                <p className={`text-[10px] ${muted}`}>saldo: R$ {fmt(runningBalance)}</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>

            {/* Legenda */}
            {hasCreditOrReserve && (
                <div className={`flex items-start gap-2.5 p-3.5 rounded-2xl border ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-100'}`}>
                    <Info className={`w-4 h-4 shrink-0 mt-0.5 ${sub}`} />
                    <p className={`text-[11px] leading-relaxed ${sub}`}>
                        Itens marcados como <span className="font-bold text-violet-400">entra na fatura</span> são compras no cartão de crédito — elas só saem do seu saldo quando você paga a fatura.
                        Já <span className="font-bold text-amber-500">não afeta o saldo</span> são movimentações de outros módulos (reservas do Patrimônio e pagamentos de dívidas), que não saem da sua carteira. Por isso aparecem no extrato, mas não mudam o saldo.
                    </p>
                </div>
            )}
        </div>
    );
}
