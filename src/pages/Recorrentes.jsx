import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from '../components/ui/Toaster';
import AliviaFormHint from '../components/AliviaFormHint';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import {
    collection, query, where, onSnapshot, addDoc, updateDoc,
    doc, runTransaction, serverTimestamp,
} from 'firebase/firestore';
import { CATEGORIES, categoryHex } from '../constants/categories';
import { buildWalletLedger } from '../utils/financialLogic';
import {
    Plus, CheckCircle2, AlertTriangle, X, Loader2,
    Repeat, Check, TrendingUp, TrendingDown,
    CreditCard, Layers, RefreshCw, Lock, CalendarDays, Sparkles,
} from 'lucide-react';

const monthKeyNow = () => new Date().toISOString().slice(0, 7);
const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numBR = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
// Padroniza a descrição: 1ª letra maiúscula, resto minúsculo (ex.: "ALUGUEL" → "Aluguel").
const normalizeName = (s) => {
    const t = String(s || '').trim().replace(/\s+/g, ' ');
    return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t;
};
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// ── Config por tipo (entrada x despesa) — o formulário (onboarding) e a baixa usam ──
const KIND = {
    income: {
        collection: 'fixed_incomes',
        cats: CATEGORIES.income,
        defaultCat: 'salary',
        occPrefix: 'inc_',
        txType: 'income',
        doneLabel: 'Recebido',
        actionLabel: 'Confirmar recebimento',
        icon: TrendingUp,
        submitBtn: 'bg-emerald-500 hover:bg-emerald-600',
    },
    expense: {
        collection: 'fixed_expenses',
        cats: CATEGORIES.expense,
        defaultCat: 'conta_fixa',
        occPrefix: '',
        txType: 'expense',
        doneLabel: 'Pago',
        actionLabel: 'Dar baixa',
        icon: TrendingDown,
        submitBtn: 'bg-rose-500 hover:bg-rose-600',
    },
};
const catMetaOf = (kind, id) => KIND[kind].cats.find(c => c.id === id) || { label: 'Outro', color: 'text-slate-400', icon: null };

// Situação de um recorrente no mês corrente.
export function statusOf(rec, transactions, mk) {
    const name = String(rec.name || '').trim().toLowerCase();
    const paid = rec.lastPaidMonth === mk
        || transactions.some(t => t.isFixed && (t.month || String(t.date || '').slice(0, 7)) === mk
            && String(t.description || '').trim().toLowerCase() === name);
    if (paid) return 'pago';
    const now = new Date();
    const [y, m] = String(mk).split('-').map(Number);
    const day = Math.min(31, Math.max(1, rec.day || 1));
    // Vencimento deste mês (fim do dia).
    const due = new Date(y, (m || 1) - 1, day, 23, 59, 59);
    // Só é "atrasado" se o vencimento já passou E o recorrente já existia
    // até a data de vencimento. Um recorrente cadastrado DEPOIS do vencimento
    // não nasce vencido — fica pendente para o próximo ciclo.
    const existedByDue = rec.createdAt ? new Date(rec.createdAt) <= due : true;
    if (now > due && existedByDue) return 'atrasado';
    return 'pendente';
}

// Lançamento (baixa) deste mês que corresponde ao recorrente — pra mostrar valor/data pagos.
export function paidTxOf(rec, transactions, mk) {
    const name = String(rec.name || '').trim().toLowerCase();
    return transactions.find(t => t.isFixed && (t.month || String(t.date || '').slice(0, 7)) === mk
        && (t.recorrenteId === rec.id || String(t.description || '').trim().toLowerCase() === name)) || null;
}

// Dias até o vencimento neste mês (negativo = já passou).
function daysToDue(day, mk) {
    const [y, m] = String(mk).split('-').map(Number);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(y, (m || 1) - 1, Math.min(31, Math.max(1, day || 1)));
    return Math.round((due - today) / 86400000);
}

// ── Página ──────────────────────────────────────────────────────────
// Recorrentes = as DESPESAS cadastradas em Configurações e Cadastros. Aqui só
// se confirma o mês (baixa). Nada é criado ou editado por aqui.
export default function Recorrentes() {
    const { currentUser } = useAuth();
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const uid = currentUser?.uid;
    const mk = monthKeyNow();

    const [expenses, setExpenses] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [cardSubs, setCardSubs] = useState([]); // assinaturas/parcelamentos no cartão
    const [cards, setCards] = useState([]);
    const [tab, setTab] = useState('apagar');     // 'apagar' | 'pago'
    const [baixa, setBaixa] = useState(null);     // { kind, rec }

    useEffect(() => {
        if (!uid) return;
        const q = (c) => query(collection(db, c), where('userId', '==', uid));
        const list = [
            onSnapshot(q('fixed_expenses'), (s) => setExpenses(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}),
            onSnapshot(q('transactions'), (s) => setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}),
            onSnapshot(q('subscriptions'), (s) => setCardSubs(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}),
            onSnapshot(q('cards'), (s) => setCards(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}),
        ];
        return () => list.forEach(u => u());
    }, [uid]);

    // Saldo em conta (derivado — soma das transações).
    const saldoConta = useMemo(() => buildWalletLedger(transactions, mk).finalBalance, [transactions, mk]);

    const cardIds = useMemo(() => new Set(cards.map(c => c.id)), [cards]);
    const cardName = (id) => cards.find(c => c.id === id)?.name || 'Cartão';

    // Despesas recorrentes com status do mês, ordenadas por dia.
    const rows = useMemo(() => [...expenses]
        .map(r => ({
            ...r, kind: 'expense', status: statusOf(r, transactions, mk), paidTx: paidTxOf(r, transactions, mk),
            days: daysToDue(r.day, mk),
            cardPaid: r.paymentMethod === 'credito' && r.cardId && cardIds.has(r.cardId),
        }))
        .sort((a, b) => (a.day || 0) - (b.day || 0)),
        [expenses, transactions, mk, cardIds]);

    const aPagar = rows.filter(r => r.status !== 'pago');
    const pagas = rows.filter(r => r.status === 'pago');
    const atrasadas = aPagar.filter(r => r.status === 'atrasado').length;

    // Recorrências do CARTÃO (vêm de subscriptions) — só leitura aqui.
    const cardRows = useMemo(() => cardSubs
        .filter(s => s.cardId && cardIds.has(s.cardId))
        .map(s => {
            const isInst = s.type === 'installment' || s.isInstallment;
            return {
                id: `card_${s.id}`, name: s.name || (isInst ? 'Parcelamento' : 'Assinatura'),
                value: parseFloat(s.value) || 0, category: s.category || 'conta_fixa',
                day: s.day || 1, cardName: cards.find(c => c.id === s.cardId)?.name || 'Cartão',
                isInstallment: isInst,
                parcela: isInst ? `${s.currentInstallment || 1}/${s.totalInstallments || 1}` : null,
                current: s.currentInstallment || 1, total: s.totalInstallments || 1,
            };
        })
        .sort((a, b) => (a.day || 0) - (b.day || 0)),
        [cardSubs, cardIds, cards]);
    const parcelamentos = cardRows.filter(r => r.isInstallment);
    const assinaturas = cardRows.filter(r => !r.isInstallment);

    const totalAPagar = aPagar.reduce((a, r) => a + (parseFloat(r.value) || 0), 0);
    const totalPago = pagas.reduce((a, r) => a + (parseFloat(r.paidTx?.amount ?? r.value) || 0), 0);
    const totalCartao = cardRows.reduce((a, r) => a + r.value, 0);
    // Compromisso recorrente do mês inteiro: contas cadastradas (pagas ou não) + o que está no cartão.
    const totalRecorrentes = totalAPagar + totalPago + totalCartao;

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const [my, mm] = mk.split('-').map(Number);
    const mesLabel = `${MESES[(mm || 1) - 1]} de ${my}`;

    const TABS = [
        { id: 'apagar', label: 'A pagar', count: aPagar.length },
        { id: 'pago', label: 'Pago', count: pagas.length },
    ];

    return (
        <div className="max-w-6xl mx-auto w-full">
            {/* Cabeçalho: título à esquerda · seletor em pílula (A pagar / Pago) à direita */}
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
                <div className="flex items-center gap-4 min-w-0">
                    <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-600/15 ring-1 ring-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(16,185,129,0.18)]">
                        <Repeat className="w-7 h-7" strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0">
                        <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Recorrentes</h1>
                        <p className={`text-sm mt-0.5 ${muted}`}>Suas contas fixas de <span className={`font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{mesLabel}</span></p>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {/* Resumo do mês — muda com a aba: A pagar ↔ Pago */}
                    {tab === 'apagar'
                        ? <Stat isDark={isDark} label="Contas a pagar" value={totalAPagar} tone="rose" />
                        : <Stat isDark={isDark} label="Pago" value={totalPago} tone="emerald" />}
                    <Stat isDark={isDark} label="Na fatura" value={totalCartao} tone="blue" />
                    <Stat isDark={isDark} label="Total recorrentes" value={totalRecorrentes} tone="slate" />

                <div role="tablist" aria-label="Situação"
                    className={`inline-flex items-center p-1 rounded-full border ${isDark ? 'border-white/10' : 'border-slate-200 bg-white'}`}>
                    {TABS.map(t => {
                        const on = tab === t.id;
                        return (
                            <button key={t.id} role="tab" aria-selected={on} onClick={() => setTab(t.id)}
                                className={`px-5 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all duration-200 active:scale-[0.97] ${on
                                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                                    : (isDark ? 'bg-transparent text-white hover:bg-white/[0.06]' : 'bg-transparent text-slate-700 hover:bg-slate-100')}`}>
                                {t.label} ({t.count})
                            </button>
                        );
                    })}
                </div>
                </div>
            </div>

            {tab === 'apagar' ? (
                <div className="space-y-8 animate-in fade-in duration-200">
                    {/* Contas a pagar — cards */}
                    <section>
                        <SectionTitle isDark={isDark} icon={TrendingDown} tone="rose" title="Contas a pagar" count={aPagar.length}
                            hint={atrasadas > 0 ? `${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}` : null} hintTone="rose" />
                        {aPagar.length === 0 ? (
                            <Empty isDark={isDark} icon={rows.length === 0 ? CalendarDays : Sparkles}
                                title={rows.length === 0 ? 'Nenhuma conta cadastrada' : 'Tudo pago por aqui 🎉'}
                                text={rows.length === 0 ? 'Cadastre suas despesas fixas em Configurações e Cadastros.' : 'Nenhuma conta pendente neste mês.'} />
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                {aPagar.map(r => <BillCard key={r.id} r={r} isDark={isDark} cardName={cardName}
                                    onBaixa={() => setBaixa({ kind: 'expense', rec: { ...r, cardName: cardName(r.cardId) } })} />)}
                            </div>
                        )}
                    </section>

                    {/* No cartão — parcelamentos e assinaturas (só leitura) */}
                    <section>
                        <SectionTitle isDark={isDark} icon={CreditCard} tone="blue" title="No cartão" count={cardRows.length} />
                        <div className={`mb-4 rounded-2xl border px-4 py-3 flex items-center gap-3 text-[12.5px] ${isDark ? 'border-blue-500/20 bg-blue-500/[0.06] text-slate-300' : 'border-blue-200 bg-blue-50 text-slate-600'}`}>
                            <Lock className="w-4 h-4 shrink-0 text-blue-500" />
                            <span>Recorrências do cartão são só consulta aqui. <b>Edições e baixas são feitas em Meu cartão</b>, junto com a fatura.</span>
                        </div>

                        <GroupTitle isDark={isDark} icon={Layers} title="Parcelamentos" count={parcelamentos.length} />
                        {parcelamentos.length === 0
                            ? <p className={`text-[12.5px] mb-5 ${muted}`}>Nenhum parcelamento ativo no cartão.</p>
                            : <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">{parcelamentos.map(r => <CardBill key={r.id} r={r} isDark={isDark} />)}</div>}

                        <GroupTitle isDark={isDark} icon={RefreshCw} title="Assinaturas" count={assinaturas.length} tone="purple" />
                        {assinaturas.length === 0
                            ? <p className={`text-[12.5px] ${muted}`}>Nenhuma assinatura no cartão.</p>
                            : <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{assinaturas.map(r => <CardBill key={r.id} r={r} isDark={isDark} />)}</div>}
                    </section>
                </div>
            ) : (
                <div className="animate-in fade-in duration-200">
                    <SectionTitle isDark={isDark} icon={CheckCircle2} tone="emerald" title="Pagas este mês" count={pagas.length} />
                    {pagas.length === 0 ? (
                        <Empty isDark={isDark} icon={CheckCircle2} title="Nada pago ainda" text="As contas que você der baixa neste mês aparecem aqui." />
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {pagas.map(r => <BillCard key={r.id} r={r} isDark={isDark} cardName={cardName} paid />)}
                        </div>
                    )}
                </div>
            )}

            {baixa && <BaixaDialog isDark={isDark} uid={uid} kind={baixa.kind} rec={baixa.rec} saldo={saldoConta} mk={mk} onClose={() => setBaixa(null)} />}
        </div>
    );
}

// ── Peças de layout ─────────────────────────────────────────────────
const TONE = {
    rose: { tile: 'bg-rose-500/15 text-rose-500', text: 'text-rose-500' },
    emerald: { tile: 'bg-emerald-500/15 text-emerald-500', text: 'text-emerald-500' },
    blue: { tile: 'bg-blue-500/15 text-blue-500', text: 'text-blue-500' },
    slate: { tile: 'bg-slate-500/15 text-slate-400', text: '' },
};

function Stat({ isDark, label, value, tone }) {
    const color = TONE[tone].text || (isDark ? 'text-white' : 'text-slate-800');
    return (
        <div className={`rounded-xl border px-3.5 py-2 min-w-[110px] ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
            <p className={`text-[9.5px] font-black uppercase tracking-widest whitespace-nowrap ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
            <p className={`text-[14px] font-black tabular-nums leading-tight ${color}`}>R$ {money(value)}</p>
        </div>
    );
}

function SectionTitle({ isDark, icon: Icon, tone, title, count, hint, hintTone = 'rose' }) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${TONE[tone].tile}`}><Icon className="w-5 h-5" strokeWidth={2.4} /></span>
            <h2 className={`text-[16px] font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{title}</h2>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>{count}</span>
            {hint && <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${hintTone === 'rose' ? 'bg-rose-500/12 text-rose-500' : 'bg-emerald-500/12 text-emerald-500'}`}>{hint}</span>}
        </div>
    );
}

function GroupTitle({ isDark, icon: Icon, title, count, tone = 'blue' }) {
    return (
        <div className={`flex items-center gap-2 mb-3 text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <Icon className={`w-3.5 h-3.5 ${tone === 'purple' ? 'text-purple-400' : 'text-blue-500'}`} /> {title}
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>{count}</span>
        </div>
    );
}

function Empty({ isDark, icon: Icon, title, text }) {
    return (
        <div className={`rounded-2xl border border-dashed py-12 text-center px-4 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50/60'}`}>
            <span className={`w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center ${isDark ? 'bg-white/5 text-slate-500' : 'bg-white text-slate-400 shadow-sm'}`}><Icon className="w-6 h-6" /></span>
            <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{title}</p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{text}</p>
        </div>
    );
}

// Card de uma conta cadastrada (a pagar / paga).
function BillCard({ r, isDark, cardName, onBaixa, paid = false }) {
    const c = catMetaOf('expense', r.category);
    const hex = categoryHex(c);
    const Icon = c.icon;
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const late = r.status === 'atrasado';
    const paidDate = paid && r.paidTx?.date ? new Date(r.paidTx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null;
    const shownValue = paid ? (r.paidTx?.amount ?? r.value) : r.value;
    const dueText = paid
        ? (paidDate ? `Pago em ${paidDate}` : 'Pago este mês')
        : late ? `Venceu dia ${r.day} · há ${Math.abs(r.days)} ${Math.abs(r.days) === 1 ? 'dia' : 'dias'}`
        : r.days === 0 ? `Vence hoje · dia ${r.day}`
        : `Vence dia ${r.day} · em ${r.days} ${r.days === 1 ? 'dia' : 'dias'}`;
    const ring = '';
    const btn = r.cardPaid
        ? 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/25'
        : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25';

    return (
        <div className={`rounded-2xl border p-4 flex flex-col gap-3 transition ${isDark ? 'border-white/10 bg-white/[0.02] hover:border-white/[0.16]' : 'border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]'} ${ring}`}>
            {/* Topo: ícone da categoria · nome · status */}
            <div className="flex items-start gap-3">
                <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${hex}1f`, color: hex }}>{Icon && <Icon className="w-5 h-5" />}</span>
                <div className="min-w-0 flex-1">
                    <p className={`font-black text-[15px] leading-tight truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.name}</p>
                    <p className={`text-[11.5px] mt-0.5 truncate ${muted}`}>{c.label}</p>
                </div>
                <StatusBadge status={r.status} isDark={isDark} doneLabel="Pago" />
            </div>

            {/* Selos */}
            {(r.cardPaid || r.isVariable || r.category === 'divida') && (
                <div className="flex items-center gap-1.5 flex-wrap">
                    {r.category === 'divida' && <Tag cls="bg-rose-500/15 text-rose-400"><AlertTriangle className="w-2.5 h-2.5" /> Dívida</Tag>}
                    {r.cardPaid && <Tag cls="bg-blue-500/15 text-blue-400"><CreditCard className="w-2.5 h-2.5" /> {cardName?.(r.cardId)}</Tag>}
                    {r.isVariable && <Tag cls={isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}>Valor variável</Tag>}
                </div>
            )}

            {/* Valor + vencimento */}
            <div className="flex items-end justify-between gap-3 mt-auto">
                <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>{paid ? 'Valor pago' : r.isVariable ? 'Valor estimado' : 'Valor'}</p>
                    <p className={`text-[22px] font-black tabular-nums leading-tight ${paid ? 'text-emerald-500' : (isDark ? 'text-white' : 'text-slate-800')}`}>R$ {money(shownValue)}</p>
                </div>
                <p className={`text-[11.5px] font-semibold text-right ${late ? 'text-amber-500' : muted}`}>
                    <CalendarDays className="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" />{dueText}
                </p>
            </div>

            {/* Ação */}
            {!paid && (
                <button onClick={onBaixa}
                    className={`w-full py-2.5 rounded-xl text-white text-[13px] font-bold flex items-center justify-center gap-2 shadow-md transition active:scale-[0.98] ${btn}`}>
                    {r.cardPaid ? <><CreditCard className="w-4 h-4" /> Lançar na fatura</> : <><Check className="w-4 h-4" strokeWidth={3} /> Dar baixa</>}
                </button>
            )}
        </div>
    );
}

// Card de item do cartão (parcelamento/assinatura) — só leitura.
function CardBill({ r, isDark }) {
    const c = catMetaOf('expense', r.category);
    const hex = categoryHex(c);
    const Icon = c.icon;
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const pct = r.isInstallment ? Math.round((r.current / Math.max(1, r.total)) * 100) : 0;
    return (
        <div className={`rounded-2xl border p-4 flex flex-col gap-3 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]'}`}>
            <div className="flex items-start gap-3">
                <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${hex}1f`, color: hex }}>{Icon && <Icon className="w-5 h-5" />}</span>
                <div className="min-w-0 flex-1">
                    <p className={`font-black text-[15px] leading-tight truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.name}</p>
                    <p className={`text-[11.5px] mt-0.5 truncate ${muted}`}>{c.label} · {r.cardName}</p>
                </div>
                <StatusBadge status={r.isInstallment ? 'cartao' : 'assinatura'} isDark={isDark} />
            </div>
            {r.isInstallment && (
                <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className={`font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Parcela {r.parcela}</span>
                        <span className={muted}>{pct}%</span>
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                </div>
            )}
            <div className="flex items-end justify-between gap-3 mt-auto">
                <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>{r.isInstallment ? 'Parcela' : 'Mensal'}</p>
                    <p className={`text-[22px] font-black tabular-nums leading-tight ${r.isInstallment ? 'text-blue-500' : 'text-purple-400'}`}>R$ {money(r.value)}</p>
                </div>
                <p className={`text-[11.5px] font-semibold flex items-center gap-1 ${muted}`}><Lock className="w-3.5 h-3.5" /> Meu cartão</p>
            </div>
        </div>
    );
}

function Tag({ cls, children }) {
    return <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1 shrink-0 ${cls}`}>{children}</span>;
}

function StatusBadge({ status, isDark, doneLabel = 'Pago' }) {
    const map = {
        pago: { label: doneLabel, cls: 'bg-emerald-500/12 text-emerald-500 border-emerald-500/20' },
        pendente: { label: 'Pendente', cls: isDark ? 'bg-white/5 text-slate-400 border-white/10' : 'bg-slate-100 text-slate-500 border-slate-200' },
        atrasado: { label: 'Atrasado', cls: 'bg-amber-500/12 text-amber-500 border-amber-500/20' },
        cartao: { label: 'Na fatura', cls: 'bg-blue-500/12 text-blue-400 border-blue-500/20' },
        assinatura: { label: 'Na fatura', cls: 'bg-purple-500/12 text-purple-400 border-purple-500/20' },
    }[status];
    return <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${map.cls}`}>{map.label}</span>;
}

// Modal de criar/editar recorrente (entrada ou despesa).
export function RecorrenteForm({ isDark, uid, kind, editing, onClose, hint, initialCategory, allowAddAnother = false }) {
    const cfg = KIND[kind];
    const income = kind === 'income';
    const againRef = useRef(false);
    const [added, setAdded] = useState(0);
    const [name, setName] = useState(editing?.name || '');
    const [value, setValue] = useState(editing?.value != null ? String(editing.value).replace('.', ',') : '');
    const [category, setCategory] = useState(editing?.category || initialCategory || cfg.defaultCat);
    const [day, setDay] = useState(String(editing?.day || 5));
    const [isVariable, setIsVariable] = useState(!!editing?.isVariable);
    const [payMethod, setPayMethod] = useState(editing?.paymentMethod || 'pix');
    const [cardId, setCardId] = useState(editing?.cardId || '');
    const [cards, setCards] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Cartões do usuário (só relevante para despesa no crédito).
    useEffect(() => {
        if (!uid || income) return;
        const qC = query(collection(db, 'cards'), where('userId', '==', uid));
        return onSnapshot(qC, (snap) => setCards(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, [uid, income]);

    const inputCls = `w-full px-3.5 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;
    const optStyle = { backgroundColor: isDark ? '#17181b' : '#ffffff', color: isDark ? '#e2e8f0' : '#1e293b' };

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!name.trim() || !numBR(value)) { setError('Preencha descrição e valor.'); return; }
        if (!income && payMethod === 'credito' && !cardId) { setError('Selecione o cartão de crédito.'); return; }
        setSaving(true);
        const data = {
            name: normalizeName(name), value: numBR(value), category,
            day: Math.min(31, Math.max(1, parseInt(day) || 1)), isVariable,
        };
        if (!income) {
            data.priority = catMetaOf('expense', category).defaultPriority || 'essential';
            data.paymentMethod = payMethod;
            data.cardId = payMethod === 'credito' ? cardId : '';
        }
        try {
            if (editing) { await updateDoc(doc(db, cfg.collection, editing.id), data); toast.success('Recorrente atualizado!'); onClose(); return; }
            await addDoc(collection(db, cfg.collection), { ...data, userId: uid, createdAt: Date.now() });
            toast.success(income ? 'Entrada recorrente cadastrada!' : 'Despesa recorrente cadastrada!');
            if (againRef.current) {
                // "Salvar e adicionar outra": limpa e mantém o formulário aberto.
                againRef.current = false;
                setName(''); setValue(''); setAdded(n => n + 1); setSaving(false);
            } else onClose();
        } catch (err) { console.error(err); toast.error('Não foi possível salvar. Tente de novo.'); setError('Não foi possível salvar. Tente de novo.'); setSaving(false); }
    };

    const title = editing
        ? (income ? 'Editar entrada recorrente' : 'Editar despesa recorrente')
        : (income ? 'Nova entrada recorrente' : 'Nova despesa recorrente');

    return (
        <Modal isDark={isDark} title={title} icon={cfg.icon}
            iconCls={income ? 'bg-emerald-500/12 text-emerald-500' : 'bg-rose-500/12 text-rose-500'}
            onClose={onClose}>
            <form onSubmit={submit} className="space-y-3.5">
                <AliviaFormHint isDark={isDark} text={hint} />
                {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-2.5 rounded-xl text-[12px] text-center font-bold">{error}</div>}
                <Field label="Descrição"><input value={name} onChange={e => setName(e.target.value)} placeholder={income ? 'Ex.: Salário, Aluguel recebido' : 'Ex.: Aluguel, Netflix, Internet'} className={inputCls} maxLength={50} autoFocus /></Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Valor (R$)"><input inputMode="decimal" value={value} onChange={e => setValue(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0,00" className={inputCls} /></Field>
                    <Field label={income ? 'Recebe no dia' : 'Vencimento (dia)'}><input inputMode="numeric" value={day} onChange={e => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="5" className={inputCls} /></Field>
                </div>
                <Field label="Categoria">
                    <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
                        {cfg.cats.map(c => (
                            <option key={c.id} value={c.id} style={optStyle}>{c.label}</option>
                        ))}
                    </select>
                </Field>
                {!income && (
                    <Field label="Forma de pagamento">
                        <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
                            {[
                                { id: 'pix', label: 'PIX' },
                                { id: 'boleto', label: 'Boleto' },
                                { id: 'credito', label: 'Cartão de Crédito' },
                            ].map(o => (
                                <option key={o.id} value={o.id} style={optStyle}>{o.label}</option>
                            ))}
                        </select>
                    </Field>
                )}
                {!income && payMethod === 'credito' && (
                    <Field label="Cartão de crédito">
                        {cards.length === 0 ? (
                            <p className={`text-[12px] font-semibold px-3.5 py-3 rounded-xl border ${isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                                Nenhum cartão cadastrado ainda. Cadastre em <span className="text-emerald-500 font-bold">Cartões</span> e volte aqui pra selecionar.
                            </p>
                        ) : (
                            <select value={cardId} onChange={e => setCardId(e.target.value)} className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
                                <option value="" style={optStyle}>Selecione o cartão…</option>
                                {cards.map(c => (
                                    <option key={c.id} value={c.id} style={optStyle}>{c.name || c.bank || 'Cartão'}</option>
                                ))}
                            </select>
                        )}
                    </Field>
                )}
                <label className={`flex items-center gap-2 text-[13px] font-semibold cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    <input type="checkbox" checked={isVariable} onChange={e => setIsVariable(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
                    Valor variável (muda todo mês{income ? ', ex.: comissão' : ', ex.: luz'})
                </label>
                {allowAddAnother && !editing ? (
                    <div className="space-y-2">
                        {added > 0 && <p className="text-[12px] text-emerald-500 font-bold text-center">{added} cadastrado(s) ✓ — adicione mais ou conclua.</p>}
                        <div className="grid grid-cols-2 gap-2">
                            <button type="submit" onClick={() => { againRef.current = true; }} disabled={saving}
                                className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition disabled:opacity-70 border ${isDark ? 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                                <Plus className="w-4 h-4" /> Adicionar outra
                            </button>
                            <button type="submit" onClick={() => { againRef.current = false; }} disabled={saving}
                                className={`py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-1.5 transition disabled:opacity-70 ${cfg.submitBtn}`}>
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Concluir</>}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button type="submit" disabled={saving} className={`w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-70 ${cfg.submitBtn}`}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> {editing ? 'Salvar' : 'Cadastrar'}</>}
                    </button>
                )}
            </form>
        </Modal>
    );
}

// Diálogo de baixa / confirmação de recebimento (com transação atômica).
export function BaixaDialog({ isDark, uid, kind, rec, saldo, mk, onClose }) {
    const cfg = KIND[kind];
    const income = kind === 'income';
    // Recorrente paga no cartão: a "baixa" LANÇA na fatura (não debita o saldo agora).
    const isCard = !income && rec.paymentMethod === 'credito' && !!rec.cardId;
    // Variável: começa VAZIO — a pessoa é obrigada a confirmar o valor do mês.
    const [amount, setAmount] = useState(rec.isVariable ? '' : String(rec.value ?? '').replace('.', ','));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [ok, setOk] = useState(false);
    const val = numBR(amount);
    // Só despesa PAGA DA CONTA valida saldo; cartão vai pra fatura; receber é sempre permitido.
    const insufficient = !income && !isCard && val > saldo + 0.005;

    const confirmar = async () => {
        setError('');
        if (val <= 0) { setError('Informe um valor válido.'); return; }
        if (insufficient) { setError(`Saldo em conta insuficiente. Você tem R$ ${money(saldo)} e a baixa é de R$ ${money(val)}.`); return; }
        setLoading(true);
        try {
            const occRef = doc(db, 'users', uid, 'recorrentes_baixas', `${cfg.occPrefix}${rec.id}_${mk}`);
            const txRef = doc(collection(db, 'transactions'));
            await runTransaction(db, async (tx) => {
                const occ = await tx.get(occRef);
                if (occ.exists()) throw new Error('ALREADY_PAID');
                const now = new Date();
                const txData = {
                    description: rec.name, amount: val, type: cfg.txType, category: rec.category || cfg.defaultCat,
                    date: now.toISOString(), month: mk, userId: uid, createdAt: Date.now(),
                    isFixed: true, source: 'recorrente_baixa', recorrenteId: rec.id,
                };
                if (!income) {
                    txData.paymentMethod = rec.paymentMethod || 'pix';
                    txData.priority = rec.priority || 'essential';
                    txData.selectedCardId = rec.paymentMethod === 'credito' ? (rec.cardId || null) : null;
                    if (isCard) txData.invoiceStatus = 'unpaid'; // entra na fatura em aberto
                }
                tx.set(txRef, txData);
                tx.set(occRef, { kind, recorrenteId: rec.id, monthKey: mk, amount: val, txId: txRef.id, description: rec.name, at: serverTimestamp() });
                tx.update(doc(db, cfg.collection, rec.id), { lastPaidMonth: mk, ...(rec.isVariable ? { lastPaidValue: val } : {}) });
            });
            setOk(true);
            toast.success(income ? 'Recebimento confirmado!' : isCard ? 'Lançado na fatura!' : 'Baixa registrada!');
            setTimeout(onClose, 1200);
        } catch (err) {
            console.error('[baixa]', err);
            const msg = err?.message === 'ALREADY_PAID'
                ? (income ? 'Esta entrada já foi confirmada neste mês.' : 'Este recorrente já foi baixado neste mês.')
                : 'Não foi possível concluir. Tente de novo.';
            toast.error(msg);
            setError(msg);
            setLoading(false);
        }
    };

    const inputCls = `w-full pl-9 pr-3 py-3 rounded-xl border text-lg font-black outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 focus:border-emerald-500'}`;

    return (
        <Modal isDark={isDark} title={income ? 'Confirmar recebimento' : isCard ? 'Lançar na fatura' : 'Dar baixa'} onClose={onClose}>
            {ok ? (
                <div className="py-6 flex flex-col items-center text-center">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${isCard ? 'bg-blue-500/12' : 'bg-emerald-500/12'}`}><CheckCircle2 className={`w-7 h-7 ${isCard ? 'text-blue-500' : 'text-emerald-500'}`} /></div>
                    <p className={`text-[15px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{income ? 'Recebimento confirmado!' : isCard ? 'Lançado na fatura!' : 'Baixa registrada!'}</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{isCard ? `Entrou na fatura de ${rec.cardName || 'seu cartão'}. Não saiu do saldo.` : 'O saldo em conta foi atualizado.'}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {income ? (
                            <>Confirmar o recebimento de <span className="font-black">{rec.name}</span>? Será registrado como entrada e somado ao <span className="font-bold">Saldo em conta</span>.</>
                        ) : isCard ? (
                            <>Lançar <span className="font-black">{rec.name}</span> na <span className="font-bold">fatura de {rec.cardName || 'seu cartão'}</span>? Entra na fatura do mês — <span className="font-bold">não sai do seu saldo em conta</span> agora (você paga a fatura em <span className="font-bold">Meu cartão</span>).</>
                        ) : (
                            <>Confirmar o pagamento de <span className="font-black">{rec.name}</span>? Será registrado como despesa e debitado do <span className="font-bold">Saldo em conta</span>.</>
                        )}
                    </p>

                    {rec.isVariable && (
                        <div>
                            <span className={`text-[11px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{isCard ? 'Valor deste mês (obrigatório)' : income ? 'Valor recebido' : 'Valor pago'}</span>
                            <div className="relative mt-1">
                                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>R$</span>
                                <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0,00" className={inputCls} autoFocus />
                            </div>
                            <p className={`text-[11px] mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>É variável — confirme quanto foi <b>este mês</b> antes de lançar.</p>
                        </div>
                    )}

                    {isCard ? (
                        <div className={`rounded-xl p-3.5 border flex items-center justify-between ${isDark ? 'bg-blue-500/[0.06] border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
                            <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-500 shrink-0" /><div><p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Fatura</p><p className={`font-bold text-[13px] ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{rec.cardName || 'Cartão'}</p></div></div>
                            <div className="text-right"><p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Entra na fatura</p><p className="font-black tabular-nums text-blue-500">+ R$ {money(val)}</p></div>
                        </div>
                    ) : (
                        <div className={`rounded-xl p-3.5 border flex items-center justify-between ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                            <div><p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Saldo em conta</p><p className={`font-black tabular-nums ${saldo >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>R$ {money(saldo)}</p></div>
                            <div className="text-right"><p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{income ? 'Entrada' : 'Baixa'}</p><p className={`font-black tabular-nums ${income ? 'text-emerald-500' : 'text-rose-500'}`}>{income ? '+' : '−'} R$ {money(val)}</p></div>
                        </div>
                    )}

                    {(error || insufficient) && (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-2.5 rounded-xl text-[12px] font-bold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" /> {error || `Saldo insuficiente para esta baixa.`}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2.5">
                        <button onClick={onClose} className={`py-3 rounded-xl font-bold text-sm ${isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Cancelar</button>
                        <button onClick={confirmar} disabled={loading || insufficient || val <= 0}
                            className={`py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 ${isCard ? 'bg-blue-500 hover:bg-blue-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> {income ? 'Confirmar' : isCard ? 'Lançar na fatura' : 'Confirmar baixa'}</>}
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
}

function Field({ label, children }) {
    return <label className="block"><span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">{label}</span>{children}</label>;
}

function Modal({ isDark, title, icon: Icon, iconCls = '', onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative w-full max-w-md rounded-3xl border shadow-2xl p-6 ${isDark ? 'bg-[#141518] border-white/10' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                        {Icon && <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconCls}`}><Icon className="w-5 h-5" strokeWidth={2.4} /></span>}
                        <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{title}</h2>
                    </div>
                    <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><X className="w-4 h-4" /></button>
                </div>
                {children}
            </div>
        </div>
    );
}
