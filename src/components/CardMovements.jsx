import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CreditCard, Filter, AlertTriangle, Receipt, Repeat, TrendingDown } from 'lucide-react';
import { CATEGORIES } from '../constants/categories';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PALETTE = ['#8b5cf6', '#f43f5e', '#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#14b8a6', '#64748b'];

export default function CardMovements({ transactions = [], cards = [], subscriptions = [], theme }) {
    const isDark = theme !== 'light';
    const [cardId, setCardId] = useState('all');
    const [invoice, setInvoice] = useState('all');

    const closingOf = (id) => {
        const c = cards.find(x => x.id === id);
        if (!c) return 25;
        return c.closingDay || ((c.dueDay - 7 > 0) ? c.dueDay - 7 : 25);
    };
    const getInvoiceMonth = (dateStr, closingDay) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        let month = d.getMonth(), year = d.getFullYear();
        if (d.getDate() >= closingDay) { month += 1; if (month > 11) { month = 0; year += 1; } }
        return `${year}-${String(month + 1).padStart(2, '0')}`;
    };
    const invoiceLabel = (key) => {
        if (!key) return '';
        const [y, m] = key.split('-').map(Number);
        const s = new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        return s.charAt(0).toUpperCase() + s.slice(1);
    };

    // Todas as compras no crédito (com mês de fatura calculado).
    const creditTx = useMemo(() => {
        return transactions
            .filter(t => t.type === 'expense' && t.paymentMethod === 'credito')
            .map(t => ({ ...t, invoiceMonth: getInvoiceMonth(t.date || new Date().toISOString(), closingOf(t.selectedCardId)) }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transactions, cards]);

    const byCardFiltered = useMemo(
        () => cardId === 'all' ? creditTx : creditTx.filter(t => t.selectedCardId === cardId),
        [creditTx, cardId]
    );

    const availableInvoices = useMemo(() => {
        const set = [...new Set(byCardFiltered.map(t => t.invoiceMonth).filter(Boolean))];
        return set.sort((a, b) => b.localeCompare(a));
    }, [byCardFiltered]);

    const items = useMemo(() => {
        const list = invoice === 'all' ? byCardFiltered : byCardFiltered.filter(t => t.invoiceMonth === invoice);
        return [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [byCardFiltered, invoice]);

    // Assinaturas/parcelamentos vinculados ao cartão (informativo).
    const linkedSubs = useMemo(() => {
        let subs = subscriptions.filter(s => s.cardId);
        if (cardId !== 'all') subs = subs.filter(s => s.cardId === cardId);
        return subs;
    }, [subscriptions, cardId]);
    const subsTotal = linkedSubs.reduce((a, s) => a + (parseFloat(s.value) || 0), 0);

    const total = items.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const count = items.length;
    const avg = count > 0 ? total / count : 0;

    const byCategory = useMemo(() => {
        const map = {};
        items.forEach(t => { const c = t.category || 'other'; map[c] = (map[c] || 0) + (parseFloat(t.amount) || 0); });
        return Object.entries(map).sort(([, a], [, b]) => b - a).map(([id, value], i) => ({
            id, value,
            label: CATEGORIES.expense.find(c => c.id === id)?.label || 'Outro',
            color: PALETTE[i % PALETTE.length],
        }));
    }, [items]);

    const card = isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';
    const txt = isDark ? 'text-white' : 'text-slate-800';
    const sub = isDark ? 'text-slate-400' : 'text-slate-500';
    const selCls = `w-full px-3 py-2.5 rounded-xl text-xs font-bold border outline-none cursor-pointer appearance-none ${isDark ? 'bg-[#161b27] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            {/* COLUNA DE FILTROS */}
            <div className={`p-5 rounded-2xl border h-fit space-y-4 ${card}`}>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-violet-500" />
                    <h3 className={`text-sm font-bold uppercase tracking-wider ${txt}`}>Filtros do relatório</h3>
                </div>

                <div>
                    <label className={`text-[10px] font-bold uppercase tracking-widest block mb-1.5 ${sub}`}>Cartão</label>
                    <select value={cardId} onChange={e => { setCardId(e.target.value); setInvoice('all'); }} className={selCls}>
                        <option value="all">Todos os cartões</option>
                        {cards.map(c => <option key={c.id} value={c.id}>{c.name || c.brand} {c.last4 ? `•${c.last4}` : ''}</option>)}
                    </select>
                </div>

                <div>
                    <label className={`text-[10px] font-bold uppercase tracking-widest block mb-1.5 ${sub}`}>Fatura</label>
                    <select value={invoice} onChange={e => setInvoice(e.target.value)} className={selCls}>
                        <option value="all">Todas as faturas</option>
                        {availableInvoices.map(k => <option key={k} value={k}>{invoiceLabel(k)}</option>)}
                    </select>
                </div>

                <div className={`pt-3 mt-1 border-t space-y-2.5 ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between">
                        <span className={`text-[11px] ${sub}`}>Total da seleção</span>
                        <span className={`text-sm font-black ${txt}`}>R$ {fmt(total)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className={`text-[11px] ${sub}`}>Movimentações</span>
                        <span className={`text-sm font-black ${txt}`}>{count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className={`text-[11px] ${sub}`}>Assinaturas vinculadas</span>
                        <span className="text-sm font-black text-purple-400">R$ {fmt(subsTotal)}</span>
                    </div>
                </div>
            </div>

            {/* RELATÓRIO */}
            <div className="space-y-5">
                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Kpi isDark={isDark} icon={CreditCard} color="text-violet-500" label="Total" value={`R$ ${fmt(total)}`} />
                    <Kpi isDark={isDark} icon={Receipt} color="text-blue-500" label="Movimentações" value={String(count)} />
                    <Kpi isDark={isDark} icon={TrendingDown} color="text-amber-500" label="Ticket médio" value={`R$ ${fmt(avg)}`} />
                    <Kpi isDark={isDark} icon={AlertTriangle} color="text-rose-500" label="Maior categoria" value={byCategory[0]?.label || '—'} />
                </div>

                {count === 0 ? (
                    <div className={`p-12 rounded-2xl border text-center ${card}`}>
                        <CreditCard className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                        <p className={`font-bold ${txt}`}>Nenhuma movimentação no crédito</p>
                        <p className={`text-sm ${sub}`}>Ajuste os filtros de cartão e fatura acima.</p>
                    </div>
                ) : (
                    <>
                        {/* Gráfico + detalhamento */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className={`p-5 rounded-2xl border ${card}`}>
                                <h4 className={`text-sm font-bold uppercase tracking-wider mb-3 ${txt}`}>Distribuição por categoria</h4>
                                <div className="w-full h-52">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={byCategory} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} stroke="none">
                                                {byCategory.map((e, i) => <Cell key={i} fill={e.color} />)}
                                            </Pie>
                                            <Tooltip formatter={(v) => `R$ ${fmt(v)}`} contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', borderColor: isDark ? '#1e293b' : '#e2e8f0', borderRadius: '12px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className={`p-5 rounded-2xl border ${card}`}>
                                <h4 className={`text-sm font-bold uppercase tracking-wider mb-3 ${txt}`}>Detalhamento</h4>
                                <div className="space-y-2.5">
                                    {byCategory.map(c => {
                                        const pct = total > 0 ? (c.value / total) * 100 : 0;
                                        return (
                                            <div key={c.id}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="flex items-center gap-2 text-xs font-bold">
                                                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                                                        <span className={txt}>{c.label}</span>
                                                    </span>
                                                    <span className={`text-xs font-bold ${txt}`}>R$ {fmt(c.value)} <span className="text-slate-400 font-medium">({pct.toFixed(0)}%)</span></span>
                                                </div>
                                                <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Lista de movimentações */}
                        <div className={`p-5 md:p-6 rounded-2xl border ${card}`}>
                            <h4 className={`text-sm font-bold uppercase tracking-wider mb-4 ${txt}`}>Movimentações {invoice !== 'all' ? `· ${invoiceLabel(invoice)}` : ''}</h4>
                            <div className="space-y-1">
                                <div className={`hidden sm:grid grid-cols-[1.5fr_1fr_1fr_1fr] pb-2 border-b text-[9px] font-bold uppercase tracking-wider ${sub} ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                                    <span>Descrição</span><span>Categoria</span><span className="text-center">Fatura</span><span className="text-right">Valor</span>
                                </div>
                                {items.map(t => {
                                    const cat = CATEGORIES.expense.find(c => c.id === t.category);
                                    return (
                                        <div key={t.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.5fr_1fr_1fr_1fr] items-center gap-2 py-2.5 text-[12px]">
                                            <div className="min-w-0">
                                                <p className={`font-medium truncate ${txt}`}>{t.description || 'Sem descrição'}</p>
                                                <p className="text-[10px] text-slate-400">{new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p>
                                            </div>
                                            <span className={`hidden sm:inline text-[11px] ${sub}`}>{cat?.label || 'Outro'}</span>
                                            <span className={`hidden sm:inline text-center text-[10px] font-bold ${sub}`}>{invoiceLabel(t.invoiceMonth).split(' ')[0]}</span>
                                            <span className="text-right font-bold text-violet-400 tabular-nums">R$ {fmt(parseFloat(t.amount))}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className={`mt-4 pt-3 border-t flex justify-end ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                                <span className={`text-xs uppercase tracking-wider ${sub}`}>Total: <span className={`font-black text-sm ml-1 ${txt}`}>R$ {fmt(total)}</span></span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function Kpi({ isDark, icon: Icon, color, label, value }) {
    const card = isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';
    return (
        <div className={`p-4 rounded-2xl border ${card}`}>
            <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">{label}</span>
            </div>
            <p className={`text-lg font-black tabular-nums truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{value}</p>
        </div>
    );
}
