import React, { useState, useEffect, useMemo, useRef } from 'react';
import AliviaFormHint from '../components/AliviaFormHint';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import {
    collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { CATEGORIES, categoryHex } from '../constants/categories';
import {
    Plus, Pencil, Trash2, X, Loader2, Check, Info,
    CreditCard, Calendar, CalendarCheck, Landmark, Wallet, ShoppingBag, ChevronRight, ChevronDown, Layers, History,
} from 'lucide-react';

const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numBR = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
const todayISO = () => new Date().toISOString().slice(0, 10);
const normalizeName = (s) => { const t = String(s || '').trim().replace(/\s+/g, ' '); return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t; };

const BRANDS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard', 'Outra'];
const COLORS = [
    { id: 'from-purple-600 to-indigo-700', dot: 'bg-gradient-to-br from-purple-600 to-indigo-700' },
    { id: 'from-slate-700 to-slate-900', dot: 'bg-gradient-to-br from-slate-700 to-slate-900' },
    { id: 'from-emerald-600 to-teal-700', dot: 'bg-gradient-to-br from-emerald-600 to-teal-700' },
    { id: 'from-blue-600 to-cyan-700', dot: 'bg-gradient-to-br from-blue-600 to-cyan-700' },
    { id: 'from-rose-600 to-pink-700', dot: 'bg-gradient-to-br from-rose-600 to-pink-700' },
    { id: 'from-amber-500 to-orange-700', dot: 'bg-gradient-to-br from-amber-500 to-orange-700' },
];
const gradOf = (c) => (c && c.includes('from-') ? c : 'from-slate-700 to-slate-900');
const closingOf = (card) => card.closingDay || ((card.dueDay - 7 > 0) ? card.dueDay - 7 : 25);
const bestBuyDay = (card) => { const cl = closingOf(card); return (cl % 31) + 1; };

const PRIORITIES = [
    { id: 'essential', label: 'Essencial', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', text: 'text-emerald-400' },
    { id: 'comfort', label: 'Conforto', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', text: 'text-amber-400' },
    { id: 'superfluous', label: 'Supérfluo', badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30', text: 'text-rose-400' },
];
const priorityMeta = (id) => PRIORITIES.find(p => p.id === id) || PRIORITIES[1];
const catMetaExp = (id) => CATEGORIES.expense.find(c => c.id === id) || { label: 'Outro', color: 'text-slate-400', icon: null };

export default function Cartoes() {
    const { currentUser } = useAuth();
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const uid = currentUser?.uid;

    const [cards, setCards] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [cardForm, setCardForm] = useState(null);   // { editing }
    const [buyForm, setBuyForm] = useState(null);     // { editing } | null
    const [pagarOpen, setPagarOpen] = useState(false);
    const [detalhes, setDetalhes] = useState(null);   // 'assinaturas' | 'parcelas' | null
    const [historicoOpen, setHistoricoOpen] = useState(false); // faturas anteriores
    const [openGroup, setOpenGroup] = useState(null);           // accordion da fatura (começa tudo fechado)

    useEffect(() => {
        if (!uid) return;
        const u1 = onSnapshot(query(collection(db, 'cards'), where('userId', '==', uid)),
            (s) => setCards(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
        const u2 = onSnapshot(query(collection(db, 'transactions'), where('userId', '==', uid)),
            (s) => setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
        const u3 = onSnapshot(query(collection(db, 'subscriptions'), where('userId', '==', uid)),
            (s) => setSubscriptions(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
        return () => { u1(); u2(); u3(); };
    }, [uid]);

    const selected = useMemo(() => cards.find(c => c.id === selectedId) || cards[0] || null, [cards, selectedId]);

    // Despesas avulsas no crédito, deste cartão, ainda não pagas.
    const avulsas = useMemo(() => {
        if (!selected) return [];
        return transactions
            .filter(t => t.selectedCardId === selected.id && t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid')
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }, [transactions, selected]);

    // Assinaturas (recorrentes) e parcelamentos deste cartão.
    const subsOnCard = useMemo(() => subscriptions.filter(s => s.cardId === selected?.id && !(s.type === 'installment' || s.isInstallment)), [subscriptions, selected]);
    const installmentsOnCard = useMemo(() => subscriptions.filter(s => s.cardId === selected?.id && (s.type === 'installment' || s.isInstallment)), [subscriptions, selected]);

    const assinaturasTotal = subsOnCard.reduce((a, s) => a + (parseFloat(s.value) || 0), 0);
    // Valor das parcelas que caem NESTA fatura (soma dos valores de cada parcela),
    // não a dívida total. Ex.: parcela de R$ 222 → mostra 222, não 2220.
    const parcelamentoTotal = installmentsOnCard.reduce((a, s) => a + (parseFloat(s.value) || 0), 0);

    // Itens que compõem a fatura atual (despesa avulsa + assinatura + parcela do mês).
    const invoiceItems = useMemo(() => [
        ...avulsas.map(t => ({ kind: 'despesa', id: t.id, name: t.description, amount: parseFloat(t.amount) || 0, category: t.category, priority: t.priority, date: t.date, ref: t })),
        ...subsOnCard.map(s => ({ kind: 'assinatura', id: s.id, name: s.name, amount: parseFloat(s.value) || 0, category: s.category, priority: s.priority, date: s.createdAt ? new Date(s.createdAt).toISOString() : null, ref: s })),
        ...installmentsOnCard.map(s => ({ kind: 'parcelamento', id: s.id, name: s.name, amount: parseFloat(s.value) || 0, category: s.category, priority: s.priority, date: s.createdAt ? new Date(s.createdAt).toISOString() : null, parcela: `${s.currentInstallment || 1}/${s.totalInstallments || 1}`, ref: s })),
    ], [avulsas, subsOnCard, installmentsOnCard]);

    const faturaTotal = invoiceItems.reduce((a, it) => a + it.amount, 0);

    // Fatura agrupada por TIPO de lançamento: Avulsos, Parcelamentos, Assinaturas.
    // Cores iguais às dos selos/cards (avulso rosa, parcelamento azul, assinatura roxo).
    const invoiceGroups = useMemo(() => [
        { id: 'despesa', label: 'Avulsos', color: '#f43f5e' },
        { id: 'parcelamento', label: 'Parcelamentos', color: '#3b82f6' },
        { id: 'assinatura', label: 'Assinaturas', color: '#a855f7' },
    ]
        .map(g => { const list = invoiceItems.filter(it => it.kind === g.id); return { ...g, list, total: list.reduce((a, it) => a + it.amount, 0) }; })
        .filter(g => g.list.length > 0), [invoiceItems]);

    // Faturas já pagas deste cartão (pra ver a fatura do mês anterior).
    const faturasPagas = useMemo(() => {
        if (!selected) return [];
        return transactions
            .filter(t => t.category === 'credit_card_bill' && t.selectedCardId === selected.id)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }, [transactions, selected]);
    const limite = Number(selected?.limit) || 0;
    const disponivel = limite ? Math.max(0, limite - faturaTotal) : 0;
    const usoPct = limite ? Math.min(100, (faturaTotal / limite) * 100) : 0;

    // Vencimento: próxima data com o dia de vencimento.
    const dueInfo = useMemo(() => {
        if (!selected?.dueDay) return null;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let due = new Date(now.getFullYear(), now.getMonth(), selected.dueDay);
        if (due < today) due = new Date(now.getFullYear(), now.getMonth() + 1, selected.dueDay);
        const days = Math.round((due - today) / 86400000);
        return { due, days };
    }, [selected]);

    const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';

    return (
        <div className="max-w-6xl mx-auto w-full">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                    <span className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-600/15 ring-1 ring-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(16,185,129,0.18)]">
                        <CreditCard className="w-8 h-8" strokeWidth={2.2} />
                    </span>
                    <div>
                        <h1 className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Cartão de crédito</h1>
                        <p className={`text-sm mt-0.5 ${muted}`}>Seus cartões, limites e a fatura atual.</p>
                    </div>
                </div>
            </div>

            <div>
                    {/* Barra: seletor de cartões (só se >1) */}
                    {cards.length > 1 && (
                        <div className="flex items-center gap-2 mt-6 mb-4 flex-wrap">
                            {cards.map(c => {
                                const on = (selected?.id === c.id);
                                return (
                                    <button key={c.id} onClick={() => setSelectedId(c.id)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-bold border transition ${on
                                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                                            : (isDark ? 'border-white/10 text-slate-400 hover:text-slate-200' : 'border-slate-200 text-slate-500 hover:text-slate-700')}`}>
                                        <span className={`w-3.5 h-3.5 rounded bg-gradient-to-br ${gradOf(c.color)}`} />
                                        {c.name || c.bank || 'Cartão'}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Cartão (esquerda) + Fatura & métricas (direita) */}
                    <div className="grid lg:grid-cols-[340px_1fr] gap-5 items-stretch mt-6">
                        <div className="flex flex-col gap-3">
                            <div className="flex justify-start">
                                <GhostAddButton isDark={isDark} onClick={() => setCardForm({ editing: null })}>Novo cartão</GhostAddButton>
                            </div>
                            <CardVisual card={selected} isDark={isDark} onAdd={() => setCardForm({ editing: null })}
                                onEdit={() => setCardForm({ editing: selected })}
                                onDelete={() => { deleteDoc(doc(db, 'cards', selected.id)); setSelectedId(null); }} />
                        </div>

                        <div className="flex flex-col gap-4">
                            {/* Fatura atual — destaque */}
                            <div className={`rounded-2xl border p-5 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                                <p className={`text-[11px] font-black uppercase tracking-widest ${muted}`}>
                                    Fatura atual{dueInfo ? ` · ${MESES[dueInfo.due.getMonth()]}` : ''}
                                </p>
                                <div className="flex items-center justify-between gap-3 mt-1 flex-wrap">
                                    <p className="text-[34px] leading-tight font-black tabular-nums text-amber-500">
                                        <span className="text-lg align-top mr-1 text-amber-500/70">R$</span>{money(faturaTotal)}
                                    </p>
                                    {invoiceItems.length > 0 && (
                                        <button onClick={() => setPagarOpen(true)}
                                            className="group shrink-0 flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-900 transition-all active:scale-95 shadow-md shadow-amber-500/30 ring-1 ring-inset ring-black/10">
                                            <span className="w-5 h-5 rounded-full bg-black/10 flex items-center justify-center">
                                                <Wallet className="w-3 h-3" strokeWidth={2.6} />
                                            </span>
                                            <span className="font-black uppercase tracking-[0.12em] text-[11px]">Pagar fatura</span>
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-end justify-between gap-3 mt-0.5 flex-wrap">
                                    {dueInfo ? (
                                        <p className={`text-[13px] ${muted}`}>
                                            Vence em <span className="font-black text-rose-400">{dueInfo.days} {dueInfo.days === 1 ? 'dia' : 'dias'}</span> · {selected.dueDay} de {MESES[dueInfo.due.getMonth()].toLowerCase()}
                                        </p>
                                    ) : <span />}
                                    {selected && (
                                        <button onClick={() => setHistoricoOpen(true)}
                                            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition active:scale-95 ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                            <History className="w-3.5 h-3.5" /> Faturas anteriores
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Métricas */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <StatCard isDark={isDark} label="Assinaturas" value={`R$ ${money(assinaturasTotal)}`} sub={`${subsOnCard.length} no mês`} tone="purple"
                                    onDetails={subsOnCard.length ? () => setDetalhes('assinaturas') : null} />
                                <StatCard isDark={isDark} label="Parcelamento" value={`R$ ${money(parcelamentoTotal)}`} sub={`${installmentsOnCard.length} ativo${installmentsOnCard.length === 1 ? '' : 's'}`} tone="blue"
                                    onDetails={installmentsOnCard.length ? () => setDetalhes('parcelas') : null} />
                                <StatCard isDark={isDark} label="Melhor dia" value={selected ? `Dia ${bestBuyDay(selected)}` : '—'} sub={selected ? `fecha dia ${closingOf(selected)}` : 'sem cartão'} tone="emerald" />
                                <StatCard isDark={isDark} label="Uso do limite" value={selected && limite ? `${Math.round(usoPct)}%` : '—'} sub={selected ? (limite ? `livre R$ ${money(disponivel)}` : 'sem limite') : 'sem cartão'} tone="amber" />
                            </div>
                        </div>
                    </div>

                    {/* Fatura atual */}
                    <div className="flex items-center justify-between gap-3 mt-8 mb-3 flex-wrap">
                        <h2 className={`text-[15px] font-black tracking-tight flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            <CreditCard className="w-4 h-4 text-emerald-500" /> Fatura atual
                            <span className={`text-[11px] font-bold ${muted}`}>· {invoiceItems.length} lançamento{invoiceItems.length === 1 ? '' : 's'}</span>
                        </h2>
                        {selected && (
                            <PillButton onClick={() => setBuyForm({ editing: null })} size="xs" color="rose">Lançar despesa</PillButton>
                        )}
                    </div>

                    {invoiceItems.length === 0 ? (
                        <div className={`rounded-2xl border py-12 text-center ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                            <ShoppingBag className={`w-7 h-7 mx-auto mb-2.5 ${muted}`} />
                            <p className={`text-sm font-bold ${cell}`}>{selected ? 'Nenhum lançamento nesta fatura' : 'Nenhum cartão cadastrado'}</p>
                            <p className={`text-xs mt-1 ${muted}`}>{selected ? 'Use “Nova compra” para lançar uma despesa, assinatura ou parcelamento.' : 'Cadastre um cartão para ver a fatura aqui.'}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {invoiceGroups.map(g => {
                                const open = openGroup === g.id;
                                return (
                                    <div key={g.id} className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                                        {/* Cabeçalho do tipo (clicável — abre 1 por vez) */}
                                        <button onClick={() => setOpenGroup(open ? null : g.id)}
                                            className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: g.color }} />
                                            <span className="font-black" style={{ color: g.color }}>{g.label}</span>
                                            <span className={`text-[11px] font-bold ${muted}`}>· {g.list.length} {g.list.length === 1 ? 'lançamento' : 'lançamentos'}</span>
                                            <span className="ml-auto flex items-center gap-2.5">
                                                <span className="font-black tabular-nums whitespace-nowrap text-rose-500">− R$ {money(g.total)}</span>
                                                <ChevronDown className={`w-4 h-4 shrink-0 ${muted} transition-transform ${open ? 'rotate-180' : ''}`} />
                                            </span>
                                        </button>

                                        {/* Itens do tipo */}
                                        {open && (
                                            <div className={`border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                                                {g.list.map((it, i) => {
                                                    const c = catMetaExp(it.category);
                                                    const hex = categoryHex(c);
                                                    const Icon = c.icon;
                                                    const kb = KIND_BADGE(isDark)[it.kind];
                                                    const dateStr = it.date ? new Date(it.date).toLocaleDateString('pt-BR') : null;
                                                    const extra = it.kind === 'parcelamento' ? `Parcela ${it.parcela}` : it.kind === 'assinatura' ? 'Mensal' : null;
                                                    const sub = [dateStr, extra, c.label].filter(Boolean).join(' · ');
                                                    return (
                                                        <div key={it.kind + it.id} className={`group flex items-center gap-3 px-4 py-3 ${i ? `border-t ${isDark ? 'border-white/5' : 'border-slate-100'}` : ''}`}>
                                                            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${hex}1f`, color: hex }}>
                                                                {Icon && <Icon className="w-4 h-4" />}
                                                            </span>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <p className={`font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{it.name || c.label}</p>
                                                                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${kb.cls}`}>{kb.label}</span>
                                                                </div>
                                                                <p className={`text-[11px] mt-0.5 ${muted}`}>{sub}</p>
                                                            </div>
                                                            <span className="font-black tabular-nums whitespace-nowrap text-rose-500">− R$ {money(it.amount)}</span>
                                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                                                                <button onClick={() => setBuyForm({ editing: it })} title="Editar" className={`p-1.5 rounded-lg ${muted} ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}><Pencil className="w-3.5 h-3.5" /></button>
                                                                <DeleteBtn isDark={isDark} onDelete={() => deleteDoc(doc(db, it.kind === 'despesa' ? 'transactions' : 'subscriptions', it.id))} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className={`mt-6 rounded-2xl border px-4 py-3.5 flex items-center gap-3 text-[13px] ${isDark ? 'border-white/10 bg-white/[0.02] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                        <Info className="w-4 h-4 shrink-0 text-emerald-500" />
                        Compras no crédito entram na fatura e não saem do saldo até você pagar a fatura.
                    </div>
            </div>

            {cardForm && <CardForm isDark={isDark} uid={uid} editing={cardForm.editing} onClose={() => setCardForm(null)} onSaved={(id) => setSelectedId(id)} />}
            {buyForm && selected && <BuyForm isDark={isDark} uid={uid} card={selected} editing={buyForm.editing} onClose={() => setBuyForm(null)} allowAddAnother />}
            {pagarOpen && selected && <PagarFaturaModal isDark={isDark} uid={uid} card={selected} items={invoiceItems} total={faturaTotal} onClose={() => setPagarOpen(false)} />}
            {detalhes && <DetalhesModal isDark={isDark} tipo={detalhes} subs={subsOnCard} installments={installmentsOnCard} onClose={() => setDetalhes(null)} />}
            {historicoOpen && <FaturasAnterioresModal isDark={isDark} card={selected} faturas={faturasPagas} onClose={() => setHistoricoOpen(false)} />}
        </div>
    );
}

// Selo do tipo de item na fatura.
const KIND_BADGE = (isDark) => ({
    despesa: { label: 'Despesa', cls: isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500' },
    assinatura: { label: 'Assinatura', cls: 'bg-purple-500/15 text-purple-400' },
    parcelamento: { label: 'Parcelamento', cls: 'bg-blue-500/15 text-blue-400' },
});

// ── Cartão visual (dados-chave no próprio cartão) ───────────────────
function CardVisual({ card, onEdit, onDelete, onAdd, isDark }) {
    const grad = gradOf(card?.color);
    const last4 = card?.last4 || '0000';

    // Placeholder — sem cartão cadastrado, mesmo formato do cartão.
    if (!card) {
        return (
            <button onClick={onAdd}
                className={`relative rounded-3xl p-6 min-h-[200px] flex flex-col items-center justify-center text-center border-2 border-dashed transition group ${isDark ? 'border-white/15 bg-white/[0.02] hover:bg-white/[0.04] text-slate-400' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-400'}`}>
                <span className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-3 group-hover:scale-105 transition"><CreditCard className="w-6 h-6" /></span>
                <p className={`text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Nenhum cartão cadastrado</p>
                <p className="text-[12px] mt-1">Toque para adicionar seu cartão</p>
            </button>
        );
    }

    return (
        <div className={`relative rounded-3xl p-6 min-h-[200px] flex flex-col justify-between text-white bg-gradient-to-br ${grad} shadow-2xl overflow-hidden`}>
            <div className="absolute -right-10 -top-12 w-44 h-44 rounded-full bg-white/10" />
            <div className="absolute -right-20 top-8 w-44 h-44 rounded-full bg-white/5" />

            {/* Ações */}
            <div className="absolute top-4 right-4 flex items-center gap-1 z-10">
                <button onClick={onEdit} title="Editar" className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition"><Pencil className="w-3.5 h-3.5" /></button>
                <CardDeleteBtn onDelete={onDelete} />
            </div>

            <div className="relative">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">{card?.brand || 'Visa'}</p>
                <p className="text-2xl font-black tracking-tight mt-1 leading-tight max-w-[75%] truncate">{card?.name || 'Meu cartão'}</p>
                {card?.bank && <p className="text-[12px] font-semibold text-white/70 mt-0.5">{card.bank}</p>}
            </div>

            <div className="flex items-end justify-between relative mt-4">
                <div>
                    <p className="text-lg font-black tracking-[0.15em] tabular-nums text-white/90">•••• •••• •••• {last4}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                    <p className="text-[9px] uppercase tracking-widest text-white/60">Vencimento</p>
                    <p className="text-sm font-bold">Dia {card?.dueDay || '—'}</p>
                </div>
            </div>
        </div>
    );
}

function CardDeleteBtn({ onDelete }) {
    const [confirm, setConfirm] = useState(false);
    if (confirm) return (
        <div className="flex items-center gap-1">
            <button onClick={() => setConfirm(false)} className="px-2 py-1 rounded-md bg-white/15 text-white text-[10px] font-bold">Não</button>
            <button onClick={onDelete} className="px-2 py-1 rounded-md bg-rose-500 text-white text-[10px] font-bold">Excluir</button>
        </div>
    );
    return <button onClick={() => setConfirm(true)} title="Excluir" className="w-7 h-7 rounded-lg bg-white/15 hover:bg-rose-500/70 flex items-center justify-center transition"><Trash2 className="w-3.5 h-3.5" /></button>;
}

// ── Card de métrica (estilo do mockup) ──────────────────────────────
function StatCard({ isDark, label, value, sub, tone, onDetails }) {
    const toneColor = {
        purple: 'text-purple-400', blue: 'text-blue-400', emerald: 'text-emerald-500',
        amber: 'text-amber-500', rose: 'text-rose-500', slate: isDark ? 'text-slate-200' : 'text-slate-700',
    }[tone];
    return (
        <div className={`rounded-2xl border p-4 flex flex-col ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
            <p className={`text-lg font-black tabular-nums mt-1 ${toneColor}`}>{value}</p>
            {sub && <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{sub}</p>}
            {onDetails && (
                <button onClick={onDetails} className={`mt-2 self-start inline-flex items-center gap-1 text-[11px] font-bold transition ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                    Ver detalhes <ChevronRight className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}

// ── Modal: detalhes de assinaturas ou parcelamentos do cartão ───────
function DetalhesModal({ isDark, tipo, subs, installments, onClose, onEdit }) {
    const isAss = tipo === 'assinaturas';
    const list = isAss ? subs : installments;
    const total = list.reduce((a, s) => a + (parseFloat(s.value) || 0), 0);
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const Icon = isAss ? Calendar : Layers;
    return (
        <Modal isDark={isDark} title={isAss ? 'Assinaturas do cartão' : 'Parcelamentos do cartão'} icon={Icon}
            iconCls={isAss ? 'bg-purple-500/12 text-purple-400' : 'bg-blue-500/12 text-blue-400'} onClose={onClose}>
            <div className={`rounded-xl border px-3.5 py-3 mb-3 flex items-center justify-between ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
                <span className={`text-[11px] font-black uppercase tracking-widest ${muted}`}>{isAss ? 'Total mensal' : 'Nesta fatura'}</span>
                <span className={`font-black tabular-nums ${isAss ? 'text-purple-400' : 'text-blue-400'}`}>R$ {money(total)}</span>
            </div>
            {list.length === 0 ? (
                <p className={`text-center text-sm py-6 ${muted}`}>{isAss ? 'Nenhuma assinatura neste cartão.' : 'Nenhum parcelamento ativo.'}</p>
            ) : (
                <div className={`rounded-xl border divide-y overflow-hidden ${isDark ? 'border-white/10 divide-white/5' : 'border-slate-200 divide-slate-100'}`}>
                    {list.map(s => {
                        const c = catMetaExp(s.category);
                        const hex = categoryHex(c);
                        const parc = !isAss ? `${s.currentInstallment || 1}/${s.totalInstallments || 1}` : null;
                        return (
                            <div key={s.id} className="flex items-center gap-3 px-3.5 py-3">
                                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${hex}1f`, color: hex }}>{c.icon && <c.icon className="w-4 h-4" />}</span>
                                <div className="min-w-0 flex-1">
                                    <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.name || c.label}</p>
                                    <p className={`text-[11px] ${muted}`}>{isAss ? 'Mensal' : `Parcela ${parc}`} · {c.label}</p>
                                </div>
                                <span className={`font-black tabular-nums text-rose-500 whitespace-nowrap`}>R$ {money(parseFloat(s.value) || 0)}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </Modal>
    );
}

// ── Modal: faturas anteriores (histórico de pagamentos com itens) ───
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const faturaMesLabel = (t) => {
    const mk = t.invoiceMonthPaid || (t.month) || (t.date ? String(t.date).slice(0, 7) : '');
    const [y, m] = String(mk).split('-').map(Number);
    if (!y || !m) return 'Fatura';
    return `${MESES_ABREV[m - 1]}/${y}`;
};
const KIND_BADGE_S = { despesa: { label: 'Despesa', cls: 'bg-slate-500/15 text-slate-400' }, assinatura: { label: 'Assinatura', cls: 'bg-purple-500/15 text-purple-400' }, parcelamento: { label: 'Parcelamento', cls: 'bg-blue-500/15 text-blue-400' } };

function FaturasAnterioresModal({ isDark, card, faturas, onClose }) {
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const [openId, setOpenId] = useState(faturas[0]?.id || null);
    return (
        <Modal isDark={isDark} title="Faturas anteriores" icon={History} iconCls="bg-emerald-500/12 text-emerald-500" onClose={onClose}>
            <p className={`text-[12px] mb-3 ${muted}`}>Faturas já pagas do cartão <span className="text-emerald-500 font-bold">{card?.name || 'cartão'}</span>.</p>
            {faturas.length === 0 ? (
                <p className={`text-center text-sm py-6 ${muted}`}>Nenhuma fatura paga ainda.</p>
            ) : (
                <div className="space-y-2">
                    {faturas.map(f => {
                        const open = openId === f.id;
                        const snap = Array.isArray(f.invoiceSnapshot) ? f.invoiceSnapshot : [];
                        const paidStr = f.date ? new Date(f.date).toLocaleDateString('pt-BR') : '';
                        return (
                            <div key={f.id} className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                                <button onClick={() => setOpenId(open ? null : f.id)} className="w-full flex items-center gap-3 px-3.5 py-3 text-left">
                                    <span className="w-9 h-9 rounded-xl bg-amber-500/12 text-amber-500 flex items-center justify-center shrink-0"><CreditCard className="w-4 h-4" /></span>
                                    <div className="min-w-0 flex-1">
                                        <p className={`font-black capitalize ${isDark ? 'text-white' : 'text-slate-800'}`}>Fatura {faturaMesLabel(f)}</p>
                                        <p className={`text-[11px] ${muted}`}>Paga em {paidStr} · {snap.length || f.invoiceItemCount || 0} itens</p>
                                    </div>
                                    <span className="font-black tabular-nums text-rose-500 whitespace-nowrap">R$ {money(parseFloat(f.amount) || 0)}</span>
                                    <ChevronDown className={`w-4 h-4 shrink-0 ${muted} transition-transform ${open ? 'rotate-180' : ''}`} />
                                </button>
                                {open && snap.length > 0 && (
                                    <div className={`divide-y border-t ${isDark ? 'divide-white/5 border-white/10' : 'divide-slate-100 border-slate-100'}`}>
                                        {snap.map((it, i) => {
                                            const c = catMetaExp(it.category);
                                            const kb = KIND_BADGE_S[it.kind] || KIND_BADGE_S.despesa;
                                            return (
                                                <div key={i} className="flex items-center gap-2.5 px-3.5 py-2.5">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className={`text-[13px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{it.name || c.label}</p>
                                                            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${kb.cls}`}>{kb.label}</span>
                                                        </div>
                                                        <p className={`text-[11px] ${muted}`}>{[it.parcela ? `Parcela ${it.parcela}` : null, c.label].filter(Boolean).join(' · ')}</p>
                                                    </div>
                                                    <span className="text-[13px] font-black tabular-nums text-rose-500 whitespace-nowrap">R$ {money(it.amount)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {open && snap.length === 0 && (
                                    <p className={`px-3.5 py-3 text-[12px] border-t ${isDark ? 'text-slate-500 border-white/10' : 'text-slate-400 border-slate-100'}`}>Sem detalhamento de itens para esta fatura.</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </Modal>
    );
}

function PillButton({ children, onClick, size = 'md', color = 'emerald' }) {
    const grad = color === 'rose'
        ? 'from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 shadow-rose-500/30'
        : 'from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/30';
    const pad = size === 'xs' ? 'pl-1 pr-2.5 py-1' : size === 'sm' ? 'pl-1.5 pr-3 py-1.5' : 'pl-2 pr-4 py-2';
    const dot = size === 'xs' ? 'w-4 h-4' : size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';
    const ic = size === 'xs' ? 'w-2.5 h-2.5' : size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
    const txt = size === 'xs' ? 'text-[10px]' : size === 'sm' ? 'text-[11px]' : 'text-[12px]';
    return (
        <button onClick={onClick}
            className={`group flex items-center gap-1.5 rounded-full bg-gradient-to-r ${grad} text-white transition-all active:scale-95 shadow-md ring-1 ring-inset ring-white/20 ${pad}`}>
            <span className={`rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform ${dot}`}>
                <Plus className={ic} strokeWidth={3} />
            </span>
            <span className={`font-black uppercase tracking-[0.12em] ${txt}`}>{children}</span>
        </button>
    );
}

// Botão discreto (sem cor chamativa) para adicionar cartão quando já existe um.
function GhostAddButton({ isDark, onClick, children }) {
    return (
        <button onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold border transition active:scale-95 ${isDark ? 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
            <Plus className="w-3.5 h-3.5" strokeWidth={2.6} /> {children}
        </button>
    );
}

function DeleteBtn({ isDark, onDelete }) {
    const [confirm, setConfirm] = useState(false);
    if (confirm) return (
        <div className="flex items-center gap-1">
            <button onClick={() => setConfirm(false)} className={`px-2 py-1 rounded text-[11px] font-bold ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>Não</button>
            <button onClick={onDelete} className="px-2 py-1 rounded text-[11px] font-bold bg-rose-500 text-white">Excluir</button>
        </div>
    );
    return <button onClick={() => setConfirm(true)} title="Excluir" className={`p-1.5 rounded-lg text-slate-400 hover:text-rose-500 ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}><Trash2 className="w-4 h-4" /></button>;
}

// ── Form: novo/editar cartão ────────────────────────────────────────
export function CardForm({ isDark, uid, editing, onClose, onSaved, hint }) {
    const [name, setName] = useState(editing?.name || '');
    const [bank, setBank] = useState(editing?.bank || '');
    const [brand, setBrand] = useState(editing?.brand || 'Visa');
    const [last4, setLast4] = useState(editing?.last4 || '');
    const [limit, setLimit] = useState(editing?.limit != null ? String(editing.limit).replace('.', ',') : '');
    const [closingDay, setClosingDay] = useState(String(editing?.closingDay || 1));
    const [dueDay, setDueDay] = useState(String(editing?.dueDay || 10));
    const [color, setColor] = useState(gradOf(editing?.color));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const inputCls = `w-full px-3.5 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;
    const optStyle = { backgroundColor: isDark ? '#17181b' : '#ffffff', color: isDark ? '#e2e8f0' : '#1e293b' };

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!name.trim()) { setError('Dê um nome ao cartão.'); return; }
        setSaving(true);
        const data = {
            name: normalizeName(name), bank: normalizeName(bank), brand,
            last4: String(last4).replace(/\D/g, '').slice(0, 4),
            limit: numBR(limit) || null,
            closingDay: Math.min(31, Math.max(1, parseInt(closingDay) || 1)),
            dueDay: Math.min(31, Math.max(1, parseInt(dueDay) || 10)),
            color,
        };
        try {
            if (editing) { await updateDoc(doc(db, 'cards', editing.id), data); onSaved?.(editing.id); }
            else { const ref = await addDoc(collection(db, 'cards'), { ...data, userId: uid, createdAt: Date.now() }); onSaved?.(ref.id); }
            onClose();
        } catch (err) { console.error(err); setError('Não foi possível salvar. Tente de novo.'); setSaving(false); }
    };

    return (
        <Modal isDark={isDark} title={editing ? 'Editar cartão' : 'Novo cartão'} icon={CreditCard} iconCls="bg-emerald-500/12 text-emerald-500" onClose={onClose}>
            <form onSubmit={submit} className="space-y-3.5">
                <AliviaFormHint isDark={isDark} text={hint} />
                {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-2.5 rounded-xl text-[12px] text-center font-bold">{error}</div>}
                <Field label="Nome do cartão"><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Nubank Roxinho" className={inputCls} maxLength={30} autoFocus /></Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Banco"><input value={bank} onChange={e => setBank(e.target.value)} placeholder="Ex.: Nubank" className={inputCls} maxLength={20} /></Field>
                    <Field label="Bandeira">
                        <select value={brand} onChange={e => setBrand(e.target.value)} className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
                            {BRANDS.map(b => <option key={b} value={b} style={optStyle}>{b}</option>)}
                        </select>
                    </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Final (4 dígitos)"><input inputMode="numeric" value={last4} onChange={e => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" className={inputCls} /></Field>
                    <Field label="Limite (R$)"><input inputMode="decimal" value={limit} onChange={e => setLimit(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0,00" className={inputCls} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Dia do fechamento"><input inputMode="numeric" value={closingDay} onChange={e => setClosingDay(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="1" className={inputCls} /></Field>
                    <Field label="Dia do vencimento"><input inputMode="numeric" value={dueDay} onChange={e => setDueDay(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="10" className={inputCls} /></Field>
                </div>
                <div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">Cor do cartão</span>
                    <div className="flex gap-2">
                        {COLORS.map(c => (
                            <button key={c.id} type="button" onClick={() => setColor(c.id)}
                                className={`w-9 h-9 rounded-xl ${c.dot} transition ${color === c.id ? 'ring-2 ring-offset-2 ring-emerald-500 ' + (isDark ? 'ring-offset-slate-900' : 'ring-offset-white') : ''}`} />
                        ))}
                    </div>
                </div>
                <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-70">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> {editing ? 'Salvar' : 'Cadastrar'}</>}
                </button>
            </form>
        </Modal>
    );
}

// ── Form: nova/editar compra no cartão (avulsa / assinatura / parcelamento) ─
export function BuyForm({ isDark, uid, card, editing, onClose, initialTipo, lockTipo = false, hint, allowAddAnother = false }) {
    const isEdit = !!editing;
    const againRef = useRef(false);
    const [added, setAdded] = useState(0);
    const kindToTipo = { despesa: 'avulsa', assinatura: 'assinatura', parcelamento: 'parcelamento' };
    const ref = editing?.ref || {};
    const [tipo, setTipo] = useState(editing ? kindToTipo[editing.kind] : (initialTipo || 'avulsa'));
    const [description, setDescription] = useState(editing ? (ref.description || ref.name || '') : '');
    // Editando uma despesa avulsa, o valor vira "parcela somável" (campo de input
    // fica vazio); nos demais tipos o valor fica no input normalmente.
    const [amount, setAmount] = useState(editing ? (editing.kind === 'despesa' ? '' : String(ref.amount ?? ref.value ?? '').replace('.', ',')) : '');
    const [parts, setParts] = useState(
        editing?.kind === 'despesa'
            ? (Array.isArray(ref.amountParts) && ref.amountParts.length > 1 ? ref.amountParts.map(Number) : [Number(ref.amount) || 0].filter(v => v > 0))
            : []
    );
    const [category, setCategory] = useState(editing ? (ref.category || 'shopping') : 'shopping');
    const [priority, setPriority] = useState(editing ? (ref.priority || 'comfort') : 'comfort');
    const [date, setDate] = useState(editing?.ref?.date ? String(editing.ref.date).slice(0, 10) : todayISO());
    // parcelamento — ao editar, o valor guardado já é o de cada parcela.
    const [valueMode, setValueMode] = useState(isEdit && editing.kind === 'parcelamento' ? 'per' : 'total');
    const [installments, setInstallments] = useState(editing?.ref?.totalInstallments ? String(editing.ref.totalInstallments) : '2');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const inputCls = `w-full px-3.5 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;
    const optStyle = { backgroundColor: isDark ? '#17181b' : '#ffffff', color: isDark ? '#e2e8f0' : '#1e293b' };

    const nParc = Math.max(1, parseInt(installments) || 1);
    const rawVal = numBR(amount);
    const totalCompra = valueMode === 'total' ? rawVal : rawVal * nParc;
    const perParcela = valueMode === 'total' ? (nParc ? rawVal / nParc : 0) : rawVal;
    // Avulsa: total = soma das parcelas guardadas + o valor ainda no input.
    const avulsaTotal = parts.reduce((a, v) => a + (Number(v) || 0), 0) + rawVal;
    const primaryVal = tipo === 'avulsa' ? avulsaTotal : rawVal;

    const addPart = () => {
        const v = numBR(amount);
        if (v <= 0) return;
        setParts(p => [...p, v]);
        setAmount('');
    };
    const removePart = (i) => setParts(p => p.filter((_, idx) => idx !== i));

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!description.trim() || primaryVal <= 0) { setError('Preencha descrição e valor.'); return; }
        setSaving(true);
        try {
            if (isEdit) {
                if (editing.kind === 'despesa') {
                    const iso = new Date(date + 'T12:00:00').toISOString();
                    const allParts = [...parts, ...(rawVal > 0 ? [rawVal] : [])];
                    await updateDoc(doc(db, 'transactions', editing.id), {
                        description: normalizeName(description), amount: avulsaTotal, category, priority, date: iso, month: iso.slice(0, 7),
                        amountParts: allParts.length > 1 ? allParts : null,
                    });
                } else if (editing.kind === 'assinatura') {
                    await updateDoc(doc(db, 'subscriptions', editing.id), { name: normalizeName(description), value: rawVal, category, priority });
                } else {
                    await updateDoc(doc(db, 'subscriptions', editing.id), {
                        name: normalizeName(description), value: perParcela, totalInstallments: nParc, installmentMode: valueMode, category, priority,
                    });
                }
            } else if (tipo === 'avulsa') {
                const iso = new Date(date + 'T12:00:00').toISOString();
                const allParts = [...parts, ...(rawVal > 0 ? [rawVal] : [])];
                await addDoc(collection(db, 'transactions'), {
                    description: normalizeName(description), amount: avulsaTotal, type: 'expense',
                    category, priority, date: iso, month: iso.slice(0, 7), userId: uid, createdAt: Date.now(),
                    paymentMethod: 'credito', selectedCardId: card.id, invoiceStatus: 'unpaid',
                    ...(allParts.length > 1 ? { amountParts: allParts } : {}),
                });
            } else if (tipo === 'assinatura') {
                await addDoc(collection(db, 'subscriptions'), {
                    name: normalizeName(description), value: rawVal, day: parseInt(card.dueDay) || 1,
                    cardId: card.id, category, priority, type: 'recurring', userId: uid, createdAt: Date.now(),
                });
            } else { // parcelamento
                await addDoc(collection(db, 'subscriptions'), {
                    name: normalizeName(description), value: perParcela, day: parseInt(card.dueDay) || 1,
                    cardId: card.id, category, priority, isInstallment: true, totalInstallments: nParc,
                    currentInstallment: 1, installmentMode: valueMode, type: 'installment', userId: uid, createdAt: Date.now(),
                });
            }
            if (!isEdit && againRef.current) {
                // "Adicionar outra": mantém o form aberto. No parcelamento, PRESERVA a
                // descrição (vários parcelamentos com o mesmo nome, ex.: mesma loja);
                // nos demais, limpa o nome pra a próxima compra.
                againRef.current = false;
                setAmount(''); setParts([]);
                if (tipo !== 'parcelamento') setDescription('');
                setAdded(n => n + 1); setSaving(false);
            } else onClose();
        } catch (err) { console.error(err); setError('Não foi possível salvar. Tente de novo.'); setSaving(false); }
    };

    const TIPOS = [
        { id: 'avulsa', label: 'Avulsa' },
        { id: 'assinatura', label: 'Assinatura' },
        { id: 'parcelamento', label: 'Parcelamento' },
    ];
    const tipoLabel = { avulsa: 'despesa', assinatura: 'assinatura', parcelamento: 'parcelamento' }[tipo];

    return (
        <Modal isDark={isDark} title={isEdit ? `Editar ${tipoLabel}` : 'Nova compra no cartão'} icon={ShoppingBag} iconCls="bg-rose-500/12 text-rose-500" onClose={onClose}>
            <form onSubmit={submit} className="space-y-3.5">
                <AliviaFormHint isDark={isDark} text={hint} />
                {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-2.5 rounded-xl text-[12px] text-center font-bold">{error}</div>}
                <p className={`text-[12px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No cartão <span className="text-emerald-500 font-bold">{card.name || 'cartão'}</span>.</p>

                <Field label="Descrição"><input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex.: Mercado, Netflix, Geladeira" className={inputCls} maxLength={50} autoFocus /></Field>

                {/* Tipo de compra (travado ao editar ou quando lockTipo) */}
                {!isEdit && !lockTipo && (
                    <div>
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">Tipo de compra</span>
                        <div className="grid grid-cols-3 gap-2">
                            {TIPOS.map(t => {
                                const on = tipo === t.id;
                                return (
                                    <button key={t.id} type="button" onClick={() => setTipo(t.id)}
                                        className={`py-2 rounded-xl text-[12px] font-bold border transition active:scale-95 ${on ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : (isDark ? 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800')}`}>
                                        {t.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Valores por tipo */}
                {tipo === 'avulsa' && (
                    <>
                        <div>
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">Valor{parts.length > 0 ? 'es' : ''} (R$)</span>
                            <div className="flex gap-2">
                                <input inputMode="decimal" value={amount}
                                    onChange={e => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPart(); } }}
                                    placeholder="0,00" className={inputCls} />
                                <button type="button" onClick={addPart}
                                    className="shrink-0 px-3 rounded-xl bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 font-bold text-sm flex items-center gap-1 transition active:scale-95">
                                    <Plus className="w-4 h-4" strokeWidth={2.6} /> Somar
                                </button>
                            </div>
                            <p className={`text-[11px] mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Some vários gastos numa compra só (ex.: 3 idas à padaria) que o total soma sozinho.</p>
                            {parts.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {parts.map((v, i) => (
                                        <span key={i} className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-[12px] font-bold ${isDark ? 'bg-white/5 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                                            R$ {money(v)}
                                            <button type="button" onClick={() => removePart(i)} className="w-4 h-4 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500"><X className="w-3 h-3" /></button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className={`mt-2 flex items-center justify-between rounded-xl px-3.5 py-2.5 border ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                                <span className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Total</span>
                                <span className="font-black tabular-nums text-rose-500">− R$ {money(avulsaTotal)}</span>
                            </div>
                        </div>
                        <Field label="Data"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }} /></Field>
                    </>
                )}
                {tipo === 'assinatura' && (
                    <Field label="Valor mensal (R$)"><input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0,00" className={inputCls} /></Field>
                )}
                {tipo === 'parcelamento' && (
                    <div className={`rounded-2xl border p-3.5 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">O valor que vou digitar é:</span>
                        <div className={`flex items-center gap-1 p-1 rounded-xl mb-3 ${isDark ? 'bg-white/5' : 'bg-white'}`}>
                            {[{ id: 'total', label: 'Valor total' }, { id: 'per', label: 'Por parcela' }].map(m => (
                                <button key={m.id} type="button" onClick={() => setValueMode(m.id)}
                                    className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition ${valueMode === m.id ? 'bg-rose-500/15 text-rose-500' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                                    {m.label}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label={valueMode === 'total' ? 'Valor total (R$)' : 'Valor por parcela (R$)'}>
                                <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0,00" className={inputCls} />
                            </Field>
                            <Field label="Nº de parcelas">
                                <input inputMode="numeric" value={installments} onChange={e => setInstallments(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="2" className={inputCls} />
                            </Field>
                        </div>
                        <div className={`mt-3 rounded-xl border px-3 py-3 text-center ${isDark ? 'border-rose-500/20 bg-rose-500/5' : 'border-rose-200 bg-rose-50'}`}>
                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-400">Valor total da compra</p>
                            <p className="text-xl font-black tabular-nums text-rose-500 mt-0.5">R$ {money(totalCompra)} <span className="text-sm font-bold">({nParc}x de R$ {money(perParcela)})</span></p>
                        </div>
                    </div>
                )}

                <Field label="Categoria">
                    <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
                        {CATEGORIES.expense.map(c => <option key={c.id} value={c.id} style={optStyle}>{c.label}</option>)}
                    </select>
                </Field>
                <div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">Tipo de gasto</span>
                    <div className="grid grid-cols-3 gap-2">
                        {PRIORITIES.map(p => {
                            const on = priority === p.id;
                            return (
                                <button key={p.id} type="button" onClick={() => setPriority(p.id)}
                                    className={`py-2 rounded-xl text-[12px] font-bold border transition active:scale-95 ${on ? p.badge : (isDark ? 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800')}`}>
                                    {p.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                {allowAddAnother && !isEdit ? (
                    <div className="space-y-2">
                        {added > 0 && <p className="text-[12px] text-emerald-500 font-bold text-center">{added} cadastrado(s) ✓ — adicione mais ou conclua.</p>}
                        <div className="grid grid-cols-2 gap-2">
                            <button type="submit" onClick={() => { againRef.current = true; }} disabled={saving}
                                className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition disabled:opacity-70 border ${isDark ? 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                                <Plus className="w-4 h-4" /> Adicionar outra
                            </button>
                            <button type="submit" onClick={() => { againRef.current = false; }} disabled={saving}
                                className="py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm flex items-center justify-center gap-1.5 transition disabled:opacity-70">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Concluir</>}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-70">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> {isEdit ? 'Salvar' : tipo === 'avulsa' ? 'Lançar compra' : tipo === 'assinatura' ? 'Criar assinatura' : 'Criar parcelamento'}</>}
                    </button>
                )}
            </form>
        </Modal>
    );
}

// ── Modal: pagar fatura ─────────────────────────────────────────────
function PagarFaturaModal({ isDark, uid, card, items, total, onClose }) {
    const [loading, setLoading] = useState(false);
    const [ok, setOk] = useState(false);
    const [error, setError] = useState('');

    const despesas = items.filter(i => i.kind === 'despesa');
    const assinaturas = items.filter(i => i.kind === 'assinatura');
    const parcelas = items.filter(i => i.kind === 'parcelamento');
    const sum = (arr) => arr.reduce((a, i) => a + i.amount, 0);

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';

    const pagar = async () => {
        setError('');
        if (total <= 0) { setError('Não há valor a pagar.'); return; }
        setLoading(true);
        try {
            const now = new Date();
            const iso = now.toISOString();
            const mk = iso.slice(0, 7);
            // Snapshot itemizado da fatura paga (pra consultar em "Faturas anteriores").
            const snapshot = items.map(it => ({
                kind: it.kind, name: it.name || '', amount: it.amount || 0,
                category: it.category || null, parcela: it.parcela || null,
            }));
            // Pagamento debita o saldo (pix / não-crédito).
            await addDoc(collection(db, 'transactions'), {
                description: `Pagamento de fatura · ${card.name || 'cartão'}`, amount: total, type: 'expense',
                category: 'credit_card_bill', date: iso, month: mk, userId: uid, createdAt: Date.now(),
                paymentMethod: 'pix', selectedCardId: card.id, invoiceMonthPaid: mk, priority: 'essential',
                invoiceSnapshot: snapshot, invoiceItemCount: snapshot.length,
            });
            for (const it of despesas) await updateDoc(doc(db, 'transactions', it.id), { invoiceStatus: 'paid', invoiceMonthPaid: mk });
            for (const it of parcelas) {
                const cur = (it.ref.currentInstallment || 1);
                const tot = (it.ref.totalInstallments || 1);
                if (cur >= tot) await deleteDoc(doc(db, 'subscriptions', it.id));
                else await updateDoc(doc(db, 'subscriptions', it.id), { currentInstallment: cur + 1 });
            }
            for (const it of assinaturas) await updateDoc(doc(db, 'subscriptions', it.id), { lastPaidMonth: mk });
            setOk(true);
            setTimeout(onClose, 1500);
        } catch (err) { console.error(err); setError('Não foi possível pagar a fatura. Tente de novo.'); setLoading(false); }
    };

    const Section = ({ title, list, tone }) => {
        if (list.length === 0) return null;
        const toneCls = { despesa: 'text-slate-400', assinatura: 'text-purple-400', parcelamento: 'text-blue-400' }[tone];
        return (
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[11px] font-black uppercase tracking-widest ${toneCls}`}>{title}</span>
                    <span className={`text-[12px] font-black tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>R$ {money(sum(list))}</span>
                </div>
                <div className={`rounded-xl border divide-y ${isDark ? 'border-white/10 divide-white/5' : 'border-slate-200 divide-slate-100'}`}>
                    {list.map(it => {
                        const c = catMetaExp(it.category);
                        return (
                            <div key={it.kind + it.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                                <div className="min-w-0">
                                    <p className={`font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{it.name || c.label}</p>
                                    <p className={`text-[11px] ${muted}`}>{it.kind === 'parcelamento' ? `Parcela ${it.parcela} · ` : it.kind === 'assinatura' ? 'Mensal · ' : ''}{c.label}</p>
                                </div>
                                <span className="font-black tabular-nums text-rose-500 whitespace-nowrap ml-3">R$ {money(it.amount)}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl ${isDark ? 'bg-[#141518] border-white/10' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between p-6 pb-4">
                    <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-emerald-500/12 text-emerald-500 flex items-center justify-center"><CreditCard className="w-5 h-5" strokeWidth={2.4} /></span>
                        <div>
                            <h2 className={`text-lg font-black leading-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Fatura · {card.name || 'cartão'}</h2>
                            <p className={`text-[12px] ${muted}`}>Vencimento dia {card.dueDay || '—'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><X className="w-4 h-4" /></button>
                </div>

                {ok ? (
                    <div className="px-6 pb-8 pt-2 flex flex-col items-center text-center">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/12 flex items-center justify-center mb-3"><Check className="w-7 h-7 text-emerald-500" /></div>
                        <p className={`text-[15px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Fatura paga!</p>
                        <p className={`text-xs mt-1 ${muted}`}>O valor foi debitado do saldo em conta.</p>
                    </div>
                ) : (
                    <>
                        <div className="px-6 overflow-y-auto space-y-4">
                            <Section title="Despesas" list={despesas} tone="despesa" />
                            <Section title="Assinaturas" list={assinaturas} tone="assinatura" />
                            <Section title="Parcelamentos" list={parcelas} tone="parcelamento" />
                            {items.length === 0 && <p className={`text-center text-sm py-6 ${muted}`}>Sem lançamentos nesta fatura.</p>}
                            {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-2.5 rounded-xl text-[12px] text-center font-bold">{error}</div>}
                        </div>
                        <div className={`p-6 pt-4 mt-2 border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <span className={`text-[12px] font-black uppercase tracking-widest ${muted}`}>Total da fatura</span>
                                <span className="text-2xl font-black tabular-nums text-rose-500">R$ {money(total)}</span>
                            </div>
                            <button onClick={pagar} disabled={loading || total <= 0}
                                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Efetuar pagamento</>}
                            </button>
                            <p className={`text-[11px] text-center mt-2 ${muted}`}>O pagamento debita R$ {money(total)} do seu saldo em conta.</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return <label className="block"><span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">{label}</span>{children}</label>;
}

function Modal({ isDark, title, icon: Icon, iconCls = '', onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative w-full max-w-md max-h-[88vh] overflow-y-auto rounded-3xl border shadow-2xl p-6 ${isDark ? 'bg-[#141518] border-white/10' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                        {Icon && <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconCls}`}><Icon className="w-5 h-5" strokeWidth={2.4} /></span>}
                        <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{title}</h2>
                    </div>
                    <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><X className="w-4 h-4" /></button>
                </div>
                {children}
            </div>
        </div>
    );
}
