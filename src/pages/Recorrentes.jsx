import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from '../components/ui/Toaster';
import AliviaFormHint from '../components/AliviaFormHint';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/LanguageContext';
import { db } from '../services/firebase';
import {
    collection, query, where, onSnapshot, addDoc, updateDoc,
    doc, runTransaction, serverTimestamp,
} from 'firebase/firestore';
import { CATEGORIES, categoryHex } from '../constants/categories';
import { LancamentoForm } from './Lancamentos';
import RegistryHint from '../components/ui/RegistryHint';
import { buildWalletLedger } from '../utils/financialLogic';
import {
    Plus, CheckCircle2, AlertTriangle, X, Loader2,
    Repeat, Check, TrendingUp, TrendingDown, CreditCard, CalendarDays,
} from 'lucide-react';

const monthKeyNow = () => new Date().toISOString().slice(0, 7);
const numBR = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
// Padroniza a descrição: 1ª letra maiúscula, resto minúsculo (ex.: "ALUGUEL" → "Aluguel").
const normalizeName = (s) => {
    const t = String(s || '').trim().replace(/\s+/g, ' ');
    return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t;
};

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
    const { t, fmtMonth } = useI18n();
    const isDark = theme !== 'light';
    const uid = currentUser?.uid;
    const mk = monthKeyNow();

    const [expenses, setExpenses] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [cards, setCards] = useState([]);
    const [baixa, setBaixa] = useState(null);     // { kind, rec }
    const [form, setForm] = useState(false);      // despesa avulsa (lançamento manual)

    useEffect(() => {
        if (!uid) return;
        const q = (c) => query(collection(db, c), where('userId', '==', uid));
        const list = [
            onSnapshot(q('fixed_expenses'), (s) => setExpenses(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}),
            onSnapshot(q('transactions'), (s) => setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}),
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

    // Despesas avulsas do mês (lançadas à mão) — entram na aba "Pago".
    const avulsasPagas = useMemo(() => transactions
        .filter(t => t.type === 'expense' && (t.month || String(t.date || '').slice(0, 7)) === mk
            && !t.isFixed && !t.isTransfer && t.paymentMethod !== 'credito'
            && !['vault', 'credit_card_bill', 'investment'].includes(t.category))
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)),
        [transactions, mk]);

    const aPagar = rows.filter(r => r.status !== 'pago');
    const pagas = rows.filter(r => r.status === 'pago');
    const atrasadas = aPagar.filter(r => r.status === 'atrasado').length;

    const totalAPagar = aPagar.reduce((a, r) => a + (parseFloat(r.value) || 0), 0);
    const totalPago = pagas.reduce((a, r) => a + (parseFloat(r.paidTx?.amount ?? r.value) || 0), 0)
        + avulsasPagas.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    // Compromisso recorrente do mês inteiro: contas cadastradas (pagas ou não) + o que está no cartão.
    const totalRecorrentes = totalAPagar + totalPago;

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const mesLabel = fmtMonth(mk);

    // Uma lista só: as cadastradas (pagas ou não) mais as avulsas do mês,
    // na ordem do dia. A ordenação é SÓ pelo dia — separar por situação faria
    // a linha pular para o fim da lista no instante em que você dá a baixa.
    const lista = useMemo(() => {
        const diaDe = (d) => { const x = new Date(d); return isNaN(x) ? 0 : x.getDate(); };
        const avulsas = avulsasPagas.map(tx => ({
            id: tx.id, name: tx.description, value: tx.amount, category: tx.category,
            paidTx: tx, status: 'pago', kind: 'expense', oneOff: true, day: diaDe(tx.date),
        }));
        return [...rows, ...avulsas].sort((a, b) => (a.day || 0) - (b.day || 0));
    }, [rows, avulsasPagas]);

    return (
        <div className="max-w-6xl mx-auto w-full">
            {/* Cabeçalho: título à esquerda · seletor em pílula (A pagar / Pago) à direita */}
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
                <div className="flex items-center gap-4 min-w-0">
                    <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-600/15 ring-1 ring-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(16,185,129,0.18)]">
                        <Repeat className="w-7 h-7" strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0">
                        <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('nav.toPay')}</h1>
                        <p className={`text-sm mt-0.5 ${muted}`}>{t('rec.subtitle', { month: '' })}<span className={`font-bold capitalize ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{mesLabel}</span></p>
                        <RegistryHint isDark={isDark} label={t('registry.hintPay')} />
                    </div>
                </div>
                {/* Sem pílula de situação: os dois números aparecem juntos,
                    porque a lista abaixo também mostra as duas situações. */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <Stat isDark={isDark} label={t('rec.billsToPay')} value={totalAPagar} tone="rose" />
                    <Stat isDark={isDark} label={t('common.paid')} value={totalPago} tone="emerald" />
                    <Stat isDark={isDark} label={t('rec.totalRecurring')} value={totalRecorrentes} tone="slate" />
                </div>
            </div>

            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]'}`}>
                {/* Cabeçalho da lista */}
                <div className={`flex items-center justify-between gap-3 flex-wrap px-4 sm:px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-rose-500/12 text-rose-500 flex items-center justify-center shrink-0"><TrendingDown className="w-4 h-4" /></span>
                        <h2 className={`text-[15px] font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('rec.billsToPay')}</h2>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>{lista.length}</span>
                        {atrasadas > 0 && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/12 text-amber-500">
                                {t('rec.lateCount', { n: atrasadas })}
                            </span>
                        )}
                    </div>
                    <button onClick={() => setForm(true)}
                        className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold border transition active:scale-95 ${isDark ? 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                        <Plus className="w-3.5 h-3.5" strokeWidth={2.6} /> {t('pay.manualExpense')}
                    </button>
                </div>

                {lista.length === 0 ? (
                    <Empty isDark={isDark} icon={CalendarDays} bare
                        title={t('rec.noneRegistered')} text={t('rec.noneRegisteredDesc')} />
                ) : (
                    <>
                        {/* Cabeçalho das colunas — some no celular, onde só sobram
                            nome e valor e os rótulos virariam ruído. */}
                        <div className={`hidden sm:flex items-center gap-3 px-3 sm:px-4 py-2.5 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'} ${th(isDark)}`}>
                            <span className="w-8 shrink-0" />
                            <span className="flex-1 min-w-0">{t('common.description')}</span>
                            <span className="hidden md:block w-[180px]">{t('reg.dueDayShort')}</span>
                            <span className="w-[104px] text-right">{t('common.value')}</span>
                            <span className="w-[88px]">{t('common.status')}</span>
                            <span className="w-[104px] text-right">{t('common.actions')}</span>
                        </div>
                        <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                            {lista.map(r => (
                                <BillRow key={r.id} r={r} isDark={isDark} cardName={cardName}
                                    onBaixa={() => setBaixa({ kind: 'expense', rec: { ...r, cardName: cardName(r.cardId) } })} />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {baixa && <BaixaDialog isDark={isDark} uid={uid} kind={baixa.kind} rec={baixa.rec} saldo={saldoConta} mk={mk} onClose={() => setBaixa(null)} />}
            {form && <LancamentoForm isDark={isDark} uid={uid} kind="expense" editing={null} saldoConta={saldoConta} onClose={() => setForm(false)} />}
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
    const { fmtMoney: money } = useI18n();
    const color = TONE[tone].text || (isDark ? 'text-white' : 'text-slate-800');
    return (
        <div className={`rounded-xl border px-3.5 py-2 min-w-[110px] ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
            <p className={`text-[9.5px] font-black uppercase tracking-widest whitespace-nowrap ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
            <p className={`text-[14px] font-black tabular-nums leading-tight ${color}`}>R$ {money(value)}</p>
        </div>
    );
}


function Empty({ isDark, icon: Icon, title, text, bare = false }) {
    // `bare` = já estou DENTRO de uma caixa; não desenho outra moldura.
    return (
        <div className={bare ? 'py-12 text-center px-4' : `rounded-2xl border border-dashed py-12 text-center px-4 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50/60'}`}>
            <span className={`w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center ${isDark ? 'bg-white/5 text-slate-500' : 'bg-white text-slate-400 shadow-sm'}`}><Icon className="w-6 h-6" /></span>
            <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{title}</p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{text}</p>
        </div>
    );
}

// Card de uma conta cadastrada (a pagar / paga).
// Estilo do cabeçalho de colunas — mesmo padrão das listas de Cadastros.
const th = (isDark) => `text-left text-[11px] font-black uppercase tracking-wider whitespace-nowrap ${isDark ? 'text-slate-500' : 'text-slate-400'}`;

// Uma conta na lista. Paga ou não, é a MESMA linha: o que muda é o selo e a
// presença do botão. Assim dar baixa não embaralha a tela.
function BillRow({ r, isDark, cardName, onBaixa }) {
    const { t, fmtMoney: money, fmtDate } = useI18n();
    const c = catMetaOf('expense', r.category);
    const hex = categoryHex(c);
    const Icon = c.icon;
    const paid = r.status === 'pago';
    const late = r.status === 'atrasado';
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';
    const paidDate = paid && r.paidTx?.date ? fmtDate(r.paidTx.date, { day: '2-digit', month: '2-digit' }) : null;
    const shownValue = paid ? (r.paidTx?.amount ?? r.value) : r.value;
    const dayWord = (n) => (Math.abs(n) === 1 ? t('common.day') : t('common.days'));
    const dueText = paid
        ? (paidDate ? t('rec.paidOn', { date: paidDate }) : t('rec.paidThisMonth'))
        : late ? t('rec.overdue', { day: r.day, days: Math.abs(r.days), daysWord: dayWord(r.days) })
        : r.days === 0 ? t('rec.dueToday', { day: r.day })
        : t('rec.dueOn', { day: r.day, days: r.days, daysWord: dayWord(r.days) });

    return (
        <div className={`flex items-center gap-3 px-3 sm:px-4 py-3 text-[13px] transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/70'}`}>
            <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${hex}1f`, color: hex }}>{Icon && <Icon className="w-4 h-4" />}</span>

            <div className="min-w-0 flex-1">
                <p className={`font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.name}</p>
                <div className={`flex items-center gap-1.5 flex-wrap text-[11px] mt-0.5 ${muted}`}>
                    <span className="truncate">{c.label}</span>
                    {r.oneOff && <Tag cls={isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-500'}>{t('txp.oneOff')}</Tag>}
                    {r.cardPaid && <Tag cls="bg-blue-500/15 text-blue-400"><CreditCard className="w-2.5 h-2.5" /> {cardName?.(r.cardId)}</Tag>}
                    {r.isVariable && <Tag cls={isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}>{t('st.variableValue')}</Tag>}
                    {/* As colunas da direita somem em tela estreita: o que elas diziam desce pra cá. */}
                    <span className={`md:hidden ${late ? 'text-amber-500 font-semibold' : ''}`}>· {dueText}</span>
                </div>
            </div>

            <div className={`hidden md:block w-[180px] shrink-0 ${late ? 'text-amber-500 font-semibold' : cell}`}>{dueText}</div>

            <div className={`w-[104px] shrink-0 text-right font-black tabular-nums ${paid ? 'text-emerald-500' : (isDark ? 'text-white' : 'text-slate-800')}`}>R$ {money(shownValue)}</div>

            <div className="hidden sm:block w-[88px] shrink-0"><StatusBadge status={r.status} isDark={isDark} doneLabel={t('common.paid')} /></div>

            <div className="sm:w-[104px] shrink-0 flex items-center justify-end">
                {paid ? (
                    <>
                        <span className="sm:hidden"><StatusBadge status={r.status} isDark={isDark} doneLabel={t('common.paid')} /></span>
                        <CheckCircle2 className="hidden sm:block w-4 h-4 text-emerald-500" />
                    </>
                ) : (
                    <button onClick={onBaixa} title={r.cardPaid ? t('rec.postToInvoice') : t('rec.payDown')}
                        className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-white text-[12px] font-bold whitespace-nowrap transition active:scale-95 ${r.cardPaid ? 'bg-blue-500 hover:bg-blue-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                        {r.cardPaid ? <CreditCard className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                        <span className="hidden sm:inline">{r.cardPaid ? t('rec.toInvoice') : t('rec.payDown')}</span>
                    </button>
                )}
            </div>
        </div>
    );
}


function Tag({ cls, children }) {
    return <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1 shrink-0 ${cls}`}>{children}</span>;
}

function StatusBadge({ status, isDark, doneLabel }) {
    const { t } = useI18n();
    const map = {
        pago: { label: doneLabel || t('common.paid'), cls: 'bg-emerald-500/12 text-emerald-500 border-emerald-500/20' },
        pendente: { label: t('common.pending'), cls: isDark ? 'bg-white/5 text-slate-400 border-white/10' : 'bg-slate-100 text-slate-500 border-slate-200' },
        atrasado: { label: t('common.late'), cls: 'bg-amber-500/12 text-amber-500 border-amber-500/20' },
        cartao: { label: t('st.onInvoice'), cls: 'bg-blue-500/12 text-blue-400 border-blue-500/20' },
        assinatura: { label: t('st.onInvoice'), cls: 'bg-purple-500/12 text-purple-400 border-purple-500/20' },
    }[status];
    return <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${map.cls}`}>{map.label}</span>;
}

// Modal de criar/editar recorrente (entrada ou despesa).
export function RecorrenteForm({ isDark, uid, kind, editing, onClose, hint, initialCategory, allowAddAnother = false }) {
    const { t } = useI18n();
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
    const optStyle = { backgroundColor: isDark ? '#101412' : '#ffffff', color: isDark ? '#e2e8f0' : '#1e293b' };

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!name.trim() || !numBR(value)) { setError(t('recf.errFill')); return; }
        if (!income && payMethod === 'credito' && !cardId) { setError(t('recf.errCard')); return; }
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
            if (editing) { await updateDoc(doc(db, cfg.collection, editing.id), data); toast.success(t('recf.okUpdated')); onClose(); return; }
            await addDoc(collection(db, cfg.collection), { ...data, userId: uid, createdAt: Date.now() });
            toast.success(income ? t('recf.okIncome') : t('recf.okExpense'));
            if (againRef.current) {
                // "Salvar e adicionar outra": limpa e mantém o formulário aberto.
                againRef.current = false;
                setName(''); setValue(''); setAdded(n => n + 1); setSaving(false);
            } else onClose();
        } catch (err) { console.error(err); toast.error(t('recf.errSave')); setError(t('recf.errSave')); setSaving(false); }
    };

    const title = editing
        ? (income ? t('recf.editIncome') : t('recf.editExpense'))
        : (income ? t('recf.newIncome') : t('recf.newExpense'));

    return (
        <Modal isDark={isDark} title={title} icon={cfg.icon}
            iconCls={income ? 'bg-emerald-500/12 text-emerald-500' : 'bg-rose-500/12 text-rose-500'}
            onClose={onClose}>
            <form onSubmit={submit} className="space-y-3.5">
                <AliviaFormHint isDark={isDark} text={hint} />
                {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-2.5 rounded-xl text-[12px] text-center font-bold">{error}</div>}
                <Field label={t('common.description')}><input value={name} onChange={e => setName(e.target.value)} placeholder={income ? t('recf.descPlaceholderIncome') : t('recf.descPlaceholderExpense')} className={inputCls} maxLength={50} autoFocus /></Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label={t('recf.valueBRL')}><input inputMode="decimal" value={value} onChange={e => setValue(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0,00" className={inputCls} /></Field>
                    <Field label={income ? t('recf.receivesDay') : t('recf.dueDay')}><input inputMode="numeric" value={day} onChange={e => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="5" className={inputCls} /></Field>
                </div>
                <Field label={t('common.category')}>
                    <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
                        {cfg.cats.map(c => (
                            <option key={c.id} value={c.id} style={optStyle}>{c.label}</option>
                        ))}
                    </select>
                </Field>
                {!income && (
                    <Field label={t('recf.payMethod')}>
                        <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
                            {[
                                { id: 'pix', label: 'PIX' },
                                { id: 'boleto', label: 'Boleto' },
                                { id: 'credito', label: t('recf.creditCard') },
                            ].map(o => (
                                <option key={o.id} value={o.id} style={optStyle}>{o.label}</option>
                            ))}
                        </select>
                    </Field>
                )}
                {!income && payMethod === 'credito' && (
                    <Field label={t('recf.creditCard')}>
                        {cards.length === 0 ? (
                            <p className={`text-[12px] font-semibold px-3.5 py-3 rounded-xl border ${isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                                {t('recf.noCardYet')}
                            </p>
                        ) : (
                            <select value={cardId} onChange={e => setCardId(e.target.value)} className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
                                <option value="" style={optStyle}>{t('recf.pickCard')}</option>
                                {cards.map(c => (
                                    <option key={c.id} value={c.id} style={optStyle}>{c.name || c.bank || 'Cartão'}</option>
                                ))}
                            </select>
                        )}
                    </Field>
                )}
                <label className={`flex items-center gap-2 text-[13px] font-semibold cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    <input type="checkbox" checked={isVariable} onChange={e => setIsVariable(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
                    {income ? t('recf.isVariableIncome') : t('recf.isVariableExpense')}
                </label>
                {allowAddAnother && !editing ? (
                    <div className="space-y-2">
                        {added > 0 && <p className="text-[12px] text-emerald-500 font-bold text-center">{t('recf.addedCount', { n: added })}</p>}
                        <div className="grid grid-cols-2 gap-2">
                            <button type="submit" onClick={() => { againRef.current = true; }} disabled={saving}
                                className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition disabled:opacity-70 border ${isDark ? 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                                <Plus className="w-4 h-4" /> {t('recf.addAnother')}
                            </button>
                            <button type="submit" onClick={() => { againRef.current = false; }} disabled={saving}
                                className={`py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-1.5 transition disabled:opacity-70 ${cfg.submitBtn}`}>
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> {t('recf.finish')}</>}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button type="submit" disabled={saving} className={`w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-70 ${cfg.submitBtn}`}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> {editing ? t('common.save') : t('recf.register')}</>}
                    </button>
                )}
            </form>
        </Modal>
    );
}

// Diálogo de baixa / confirmação de recebimento (com transação atômica).
export function BaixaDialog({ isDark, uid, kind, rec, saldo, mk, onClose }) {
    const { t, fmtMoney: money } = useI18n();
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
        if (val <= 0) { setError(t('baixa.errAmount')); return; }
        if (insufficient) { setError(t('baixa.errInsufficient', { have: money(saldo), need: money(val) })); return; }
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
            toast.success(income ? t('baixa.okReceipt') : isCard ? t('baixa.okInvoice') : t('baixa.okPaid'));
            setTimeout(onClose, 1200);
        } catch (err) {
            console.error('[baixa]', err);
            const msg = err?.message === 'ALREADY_PAID'
                ? (income ? t('baixa.errAlreadyIncome') : t('baixa.errAlreadyExpense'))
                : t('baixa.errGeneric');
            toast.error(msg);
            setError(msg);
            setLoading(false);
        }
    };

    const inputCls = `w-full pl-9 pr-3 py-3 rounded-xl border text-lg font-black outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 focus:border-emerald-500'}`;

    return (
        <Modal isDark={isDark} title={income ? t('baixa.confirmReceipt') : isCard ? t('baixa.postToInvoice') : t('baixa.payDown')} onClose={onClose}>
            {ok ? (
                <div className="py-6 flex flex-col items-center text-center">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${isCard ? 'bg-blue-500/12' : 'bg-emerald-500/12'}`}><CheckCircle2 className={`w-7 h-7 ${isCard ? 'text-blue-500' : 'text-emerald-500'}`} /></div>
                    <p className={`text-[15px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{income ? t('baixa.okReceipt') : isCard ? t('baixa.okInvoice') : t('baixa.okPaid')}</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{isCard ? t('baixa.wentToInvoice', { card: rec.cardName || t('common.card') }) : t('baixa.balanceUpdated')}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {income
                            ? t('baixa.askIncome', { name: rec.name })
                            : isCard
                                ? t('baixa.askCard', { name: rec.name, card: rec.cardName || t('common.card') })
                                : t('baixa.askExpense', { name: rec.name })}
                    </p>

                    {rec.isVariable && (
                        <div>
                            <span className={`text-[11px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{isCard ? t('baixa.amountThisMonth') : income ? t('baixa.amountReceived') : t('baixa.amountPaid')}</span>
                            <div className="relative mt-1">
                                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>R$</span>
                                <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0,00" className={inputCls} autoFocus />
                            </div>
                            <p className={`text-[11px] mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('baixa.variableNote')}</p>
                        </div>
                    )}

                    {isCard ? (
                        <div className={`rounded-xl p-3.5 border flex items-center justify-between ${isDark ? 'bg-blue-500/[0.06] border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
                            <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-500 shrink-0" /><div><p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('baixa.invoice')}</p><p className={`font-bold text-[13px] ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{rec.cardName || t('common.card')}</p></div></div>
                            <div className="text-right"><p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('baixa.goesToInvoice')}</p><p className="font-black tabular-nums text-blue-500">+ R$ {money(val)}</p></div>
                        </div>
                    ) : (
                        <div className={`rounded-xl p-3.5 border flex items-center justify-between ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                            <div><p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('baixa.accountBalance')}</p><p className={`font-black tabular-nums ${saldo >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>R$ {money(saldo)}</p></div>
                            <div className="text-right"><p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{income ? t('baixa.entry') : t('baixa.writeOff')}</p><p className={`font-black tabular-nums ${income ? 'text-emerald-500' : 'text-rose-500'}`}>{income ? '+' : '−'} R$ {money(val)}</p></div>
                        </div>
                    )}

                    {(error || insufficient) && (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-2.5 rounded-xl text-[12px] font-bold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" /> {error || t('baixa.errInsufficientShort')}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2.5">
                        <button onClick={onClose} className={`py-3 rounded-xl font-bold text-sm ${isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{t('common.cancel')}</button>
                        <button onClick={confirmar} disabled={loading || insufficient || val <= 0}
                            className={`py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 ${isCard ? 'bg-blue-500 hover:bg-blue-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> {income ? t('common.confirm') : isCard ? t('baixa.postToInvoice') : t('baixa.confirmWriteOff')}</>}
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
            <div className={`relative w-full max-w-md rounded-3xl border shadow-2xl p-6 ${isDark ? 'bg-[#0e1210] border-white/10' : 'bg-white border-slate-100'}`}>
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
