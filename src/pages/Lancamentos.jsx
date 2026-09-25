import React, { useState, useEffect, useMemo } from 'react';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import { toast } from '../components/ui/Toaster';
import ConfirmActionModal from '../components/ConfirmActionModal';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/LanguageContext';
import { db } from '../services/firebase';
import {
    collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { CATEGORIES, categoryHex } from '../constants/categories';
import { buildWalletLedger } from '../utils/financialLogic';
import { BaixaDialog, statusOf, paidTxOf } from './Recorrentes';
import {
    Plus, Pencil, Trash2, X, Loader2, Check, ChevronDown, Info,
    Wallet, TrendingUp, TrendingDown, ArrowLeftRight, Calendar, SlidersHorizontal, CalendarDays, Repeat,
} from 'lucide-react';

const monthKeyNow = () => new Date().toISOString().slice(0, 7);
const todayISO = () => new Date().toISOString().slice(0, 10);
const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numBR = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
const normalizeName = (s) => {
    const t = String(s || '').trim().replace(/\s+/g, ' ');
    return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t;
};
const txMonthKey = (t) => t.month || (t.date ? String(t.date).slice(0, 7) : '');

const PRIORITIES = [
    { id: 'essential', label: 'Essencial', badge: 'bg-emerald-500/15 text-emerald-400' },
    { id: 'comfort', label: 'Conforto', badge: 'bg-amber-500/15 text-amber-400' },
    { id: 'superfluous', label: 'Supérfluo', badge: 'bg-rose-500/15 text-rose-400' },
];
const priorityMeta = (id) => PRIORITIES.find(p => p.id === id) || PRIORITIES[1];

const PAYMENTS = [
    { id: 'pix', label: 'PIX' },
    { id: 'debito', label: 'Débito' },
    { id: 'credito', label: 'Crédito' },
    { id: 'dinheiro', label: 'Dinheiro' },
    { id: 'boleto', label: 'Boleto' },
];
const paymentLabel = (id) => PAYMENTS.find(p => p.id === id)?.label || 'PIX';

const KIND = {
    income: { cats: CATEGORIES.income, defaultCat: 'salary', type: 'income', title: 'Nova entrada avulsa', accent: 'text-emerald-500', submit: 'bg-emerald-500 hover:bg-emerald-600', icon: TrendingUp },
    expense: { cats: CATEGORIES.expense, defaultCat: 'food', type: 'expense', title: 'Nova despesa avulsa', accent: 'text-rose-500', submit: 'bg-rose-500 hover:bg-rose-600', icon: TrendingDown },
};
const catMetaOf = (kind, id) => KIND[kind].cats.find(c => c.id === id) || { label: 'Outro', color: 'text-slate-400', icon: null };

export default function Lancamentos() {
    const { currentUser } = useAuth();
    const { theme } = useTheme();
    const { t, fmtMoney: money, fmtDate, fmtMonth } = useI18n();
    const isDark = theme !== 'light';
    const uid = currentUser?.uid;
    const mk = monthKeyNow();

    const [transactions, setTransactions] = useState([]);
    const [incomes, setIncomes] = useState([]);   // entradas recorrentes (Cadastros)
    const [entradas, setEntradas] = useState(false); // janela "Entradas do mês"
    const [form, setForm] = useState(null);  // { kind, editing }
    const [confirmAction, setConfirmAction] = useState(null); // { type:'edit'|'delete', item }
    const [chooser, setChooser] = useState(false); // janela de escolha entrada/despesa
    const [filter, setFilter] = useState('all'); // all | income | expense
    const [origem, setOrigem] = useState('all'); // all | avulso | recorrente
    const [prio, setPrio] = useState('all');     // all | essential | comfort | superfluous
    const [showFilters, setShowFilters] = useState(false); // painel de filtros
    const [incluirCredito, setIncluirCredito] = useState(false); // mostrar fatura em aberto do cartão

    useEffect(() => {
        if (!uid) return;
        const unsubT = onSnapshot(query(collection(db, 'transactions'), where('userId', '==', uid)),
            (s) => setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
        const unsubI = onSnapshot(query(collection(db, 'fixed_incomes'), where('userId', '==', uid)),
            (s) => setIncomes(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
        return () => { unsubT(); unsubI(); };
    }, [uid]);

    const saldoConta = useMemo(() => buildWalletLedger(transactions, mk).finalBalance, [transactions, mk]);

    // Extrato = movimentos da CONTA. Compras no crédito não entram aqui
    // (ficam na fatura do cartão); só o pagamento da fatura movimenta a conta.
    const monthTx = useMemo(() =>
        transactions.filter(t => txMonthKey(t) === mk && t.paymentMethod !== 'credito' && !t.reserveInternal)
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0) || (b.createdAt || 0) - (a.createdAt || 0)),
        [transactions, mk]);

    // Transferências de reserva (cofre) não são entrada/despesa de verdade.
    const isTransferTx = (t) => t.isTransfer || t.category === 'vault' || t.category === 'vault_redemption';
    const entradasMes = monthTx.filter(t => t.type === 'income' && !isTransferTx(t)).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const despesasMes = monthTx.filter(t => t.type === 'expense' && !isTransferTx(t)).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);

    // Compras no crédito ainda na fatura em aberto (opcional na listagem).
    const creditoAberto = useMemo(() =>
        transactions.filter(t => txMonthKey(t) === mk && t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid'),
        [transactions, mk]);
    // Base da listagem: conta + (opcional) fatura em aberto.
    const listBase = useMemo(() => {
        const base = incluirCredito ? [...monthTx, ...creditoAberto] : monthTx;
        return [...base].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0) || (b.createdAt || 0) - (a.createdAt || 0));
    }, [monthTx, creditoAberto, incluirCredito]);

    const filteredTx = useMemo(() => listBase.filter(t => {
        if (filter !== 'all' && t.type !== filter) return false;
        if (origem !== 'all') {
            const isRec = t.source === 'recorrente_baixa';
            if (origem === 'recorrente' && !isRec) return false;
            if (origem === 'avulso' && isRec) return false;
        }
        if (prio !== 'all') {
            if (t.type !== 'expense') return false;
            if ((t.priority || 'comfort') !== prio) return false;
        }
        return true;
    }), [listBase, filter, origem, prio]);

    // Agrupa o extrato por dia.
    const groups = useMemo(() => {
        const map = {};
        filteredTx.forEach(t => {
            const day = (t.date ? String(t.date).slice(0, 10) : mk + '-01');
            (map[day] = map[day] || []).push(t);
        });
        return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    }, [filteredTx, mk]);

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';

    const fmtDay = (iso) => fmtDate(new Date(iso + 'T00:00:00'), { day: '2-digit', month: 'long', weekday: 'short' });

    return (
        <div className="max-w-6xl mx-auto w-full">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <span className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-600/15 ring-1 ring-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(16,185,129,0.18)]">
                        <ArrowLeftRight className="w-6 h-6 sm:w-8 sm:h-8" strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0">
                        <h1 className={`text-2xl sm:text-3xl font-black tracking-tight truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('tx.title')}</h1>
                        <p className={`text-[13px] sm:text-sm mt-0.5 ${muted}`}>{t('txp.subtitle')}</p>
                    </div>
                </div>
                <div className="hidden sm:block shrink-0"><NovoLancamentoButton onClick={() => setChooser(true)} /></div>
            </div>

            {/* Cards de resumo (compactos, uma linha) */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-5 sm:mt-6">
                <SummaryCard isDark={isDark} icon={Wallet} label={t('txp.balance')} value={<AnimatedNumber value={saldoConta} format={(v) => `R$ ${money(v)}`} />} tone={saldoConta >= 0 ? 'emerald' : 'rose'} />
                <SummaryCard isDark={isDark} icon={TrendingUp} label={t('common.incomes')} value={<AnimatedNumber value={entradasMes} format={(v) => `R$ ${money(v)}`} />} tone="emerald" />
                <SummaryCard isDark={isDark} icon={TrendingDown} label={t('common.expenses')} value={<AnimatedNumber value={despesasMes} format={(v) => `R$ ${money(v)}`} />} tone="rose" />
            </div>

            {/* Extrato */}
            <div className="flex items-center justify-between gap-3 flex-wrap mt-8 mb-3">
                <h2 className={`text-[15px] font-black tracking-tight flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    <ArrowLeftRight className="w-4 h-4 text-emerald-500" /> {t('tx.statement')}
                </h2>
                <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-1 p-1 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                        {[
                            { id: 'all', label: t('tx.everything'), on: isDark ? 'bg-white/10 text-white' : 'bg-white text-slate-800 shadow-sm' },
                            { id: 'income', label: t('common.incomes'), on: 'bg-emerald-500/15 text-emerald-500' },
                            { id: 'expense', label: t('common.expenses'), on: 'bg-rose-500/15 text-rose-500' },
                        ].map(f => (
                            <button key={f.id} onClick={() => setFilter(f.id)}
                                className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition ${filter === f.id ? f.on : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')}`}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                    {/* Botão discreto de filtros */}
                    <button onClick={() => setShowFilters(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold border transition ${(showFilters || origem !== 'all' || prio !== 'all' || incluirCredito) ? 'border-emerald-500/40 text-emerald-500' : (isDark ? 'border-white/10 text-slate-400 hover:text-slate-200' : 'border-slate-200 text-slate-500 hover:text-slate-700')}`}>
                        <SlidersHorizontal className="w-3.5 h-3.5" /> {t('tx.filters')}
                        {(origem !== 'all' || prio !== 'all' || incluirCredito) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    </button>
                </div>
            </div>

            {/* Painel de filtros (colapsável) */}
            {showFilters && (
                <div className={`rounded-2xl border p-4 mb-3 space-y-3 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        <FilterGroup isDark={isDark} label={t('txp.origin')} value={origem} onChange={setOrigem}
                            options={[{ id: 'all', label: t('common.all') }, { id: 'avulso', label: t('txp.oneOff') }, { id: 'recorrente', label: t('txp.recurring') }]} />
                        <FilterGroup isDark={isDark} label="Tipo de gasto" value={prio} onChange={setPrio}
                            options={[
                                { id: 'all', label: 'Todos' },
                                { id: 'essential', label: 'Essencial', on: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
                                { id: 'comfort', label: 'Conforto', on: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
                                { id: 'superfluous', label: 'Supérfluo', on: 'bg-rose-500/15 text-rose-500 border-rose-500/30' },
                            ]} />
                    </div>
                    <label className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border cursor-pointer transition ${incluirCredito ? 'border-purple-500/40 bg-purple-500/10' : (isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50')}`}>
                        <input type="checkbox" checked={incluirCredito} onChange={e => setIncluirCredito(e.target.checked)} className="w-4 h-4 accent-purple-500" />
                        <div>
                            <p className={`text-[13px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('txp.includeCredit')}</p>
                            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Mostra também as compras no crédito que ainda não foram pagas.</p>
                        </div>
                    </label>
                </div>
            )}

            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                {groups.length === 0 ? (
                    <div className="py-16 text-center">
                        <ArrowLeftRight className={`w-8 h-8 mx-auto mb-3 ${muted}`} />
                        <p className={`text-sm font-bold ${cell}`}>{t('txp.nothingHere')}</p>
                        <p className={`text-xs mt-1 ${muted}`}>{t('txp.nothingHereDesc')}</p>
                    </div>
                ) : (
                    groups.map(([day, items]) => (
                        <div key={day}>
                            <div className={`px-4 py-2 text-[11px] font-black uppercase tracking-widest ${muted} ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50'}`}>
                                {fmtDay(day)}
                            </div>
                            {items.map(txi => {
                                const income = txi.type === 'income';
                                // Transferência de reserva (cofre) — não é gasto/renda; mostra azul.
                                const isTransfer = txi.isTransfer || txi.category === 'vault' || txi.category === 'vault_redemption';
                                const c = catMetaOf(income ? 'income' : 'expense', txi.category);
                                const hex = categoryHex(c);
                                const Icon = c.icon;
                                const pr = priorityMeta(txi.priority);
                                return (
                                    <div key={txi.id} className={`group flex items-center gap-3 px-4 py-3 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                                        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${hex}1f`, color: hex }}>
                                            {Icon && <Icon className="w-4 h-4" />}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className={`font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{txi.description || c.label}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                <span className={`text-[11px] ${muted}`}>{c.label}</span>
                                                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${txi.source === 'recorrente_baixa' ? 'bg-indigo-500/15 text-indigo-400' : (isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500')}`}>
                                                    {txi.source === 'recorrente_baixa' ? t('txp.recurring') : t('txp.oneOff')}
                                                </span>
                                                {isTransfer ? (
                                                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">Reserva · transferência</span>
                                                ) : !income && (
                                                    <>
                                                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${pr.badge}`}>{pr.label}</span>
                                                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{paymentLabel(txi.paymentMethod)}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <span className={`font-black tabular-nums whitespace-nowrap ${isTransfer ? 'text-blue-400' : income ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {/* Estorno da fatura chega com valor negativo: mostra como crédito. */}
                                            {(income || txi.amount < 0) ? '+' : '−'} R$ {money(Math.abs(txi.amount))}
                                        </span>
                                        <div className="flex items-center gap-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition">
                                            <button onClick={() => setConfirmAction({ type: 'edit', item: t })} title="Editar" className={`p-1.5 rounded-lg text-slate-400 transition ${isDark ? 'hover:text-emerald-400 hover:bg-white/5' : 'hover:text-emerald-600 hover:bg-slate-100'}`}><Pencil className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => setConfirmAction({ type: 'delete', item: t })} title="Excluir" className={`p-1.5 rounded-lg text-slate-400 transition ${isDark ? 'hover:text-rose-500 hover:bg-white/5' : 'hover:text-rose-500 hover:bg-slate-100'}`}><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>

            <div className={`mt-6 rounded-2xl border px-4 py-3.5 flex items-center gap-3 text-[13px] ${isDark ? 'border-white/10 bg-white/[0.02] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <Info className="w-4 h-4 shrink-0 text-emerald-500" />
                Compras no crédito não aparecem aqui — ficam na fatura do cartão. Ao pagar a fatura, o total é debitado do saldo e entra no extrato.
            </div>

            {/* FAB — novo lançamento (mobile). No desktop o botão fica no cabeçalho. */}
            <button onClick={() => setChooser(true)} aria-label={t('tx.new')}
                className="sm:hidden fixed right-4 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-sky-500 text-white shadow-xl shadow-cyan-500/40 ring-1 ring-inset ring-white/20 flex items-center justify-center active:scale-95 transition"
                style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}>
                <Plus className="w-6 h-6" strokeWidth={2.8} />
            </button>

            {chooser && <KindChooserModal isDark={isDark} onClose={() => setChooser(false)}
                onPick={(kind) => { setChooser(false); if (kind === 'income') setEntradas(true); else setForm({ kind, editing: null }); }} />}
            {entradas && <EntradasModal isDark={isDark} uid={uid} incomes={incomes} transactions={transactions} mk={mk} saldoConta={saldoConta}
                onClose={() => setEntradas(false)} />}
            {form && <LancamentoForm isDark={isDark} uid={uid} kind={form.kind} editing={form.editing} saldoConta={saldoConta} onClose={() => setForm(null)} />}
            {confirmAction && (
                <ConfirmActionModal isDark={isDark} type={confirmAction.type}
                    name={confirmAction.item.description || catMetaOf(confirmAction.item.type === 'income' ? 'income' : 'expense', confirmAction.item.category).label}
                    onClose={() => setConfirmAction(null)}
                    onConfirm={async () => {
                        const t = confirmAction.item;
                        if (confirmAction.type === 'delete') {
                            await deleteDoc(doc(db, 'transactions', t.id));
                            await new Promise(res => setTimeout(res, 300));
                            toast.success(t('txp.deleted'));
                        } else {
                            await new Promise(res => setTimeout(res, 400));
                            setForm({ kind: t.type === 'income' ? 'income' : 'expense', editing: t });
                        }
                    }} />
            )}
        </div>
    );
}

function FilterGroup({ isDark, label, options, value, onChange }) {
    const defaultOn = isDark ? 'bg-white/10 text-white border-white/10' : 'bg-white text-slate-800 border-slate-200 shadow-sm';
    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</span>
            {options.map(o => {
                const active = value === o.id;
                return (
                    <button key={o.id} onClick={() => onChange(o.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${active ? (o.on || defaultOn) : (isDark ? 'border-white/10 text-slate-400 hover:text-slate-200' : 'border-slate-200 text-slate-500 hover:text-slate-700')}`}>
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}

function SummaryCard({ isDark, icon: Icon, label, value, tone }) {
    const toneColor = { emerald: 'text-emerald-500', rose: 'text-rose-500', slate: isDark ? 'text-slate-200' : 'text-slate-700' }[tone];
    return (
        <div className={`rounded-2xl border p-3 sm:p-4 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
            <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <Icon className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{label}</span>
            </div>
            <p className={`text-[15px] sm:text-lg font-black tabular-nums mt-1.5 truncate ${toneColor}`}>{value}</p>
        </div>
    );
}

function NovoLancamentoButton({ onClick }) {
    const { t } = useI18n();
    return (
        <button onClick={onClick}
            className="group flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-white transition-all active:scale-95 shadow-md shadow-cyan-500/30 ring-1 ring-inset ring-white/20">
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform">
                <Plus className="w-3 h-3" strokeWidth={3} />
            </span>
            <span className="font-black uppercase tracking-[0.12em] text-[11px]">{t('tx.new')}</span>
        </button>
    );
}

// Janela para escolher entre Entrada e Despesa antes de abrir o formulário.
function KindChooserModal({ isDark, onClose, onPick }) {
    const { t } = useI18n();
    const opts = [
        {
            kind: 'income', label: t('common.income'), sub: t('tx.incomeDesc'), icon: TrendingUp,
            iconWrap: 'bg-emerald-500/15 text-emerald-500',
            ring: isDark ? 'hover:border-emerald-500/40 hover:bg-emerald-500/[0.06]' : 'hover:border-emerald-300 hover:bg-emerald-50',
        },
        {
            kind: 'expense', label: t('common.expense'), sub: t('tx.expenseDesc'), icon: TrendingDown,
            iconWrap: 'bg-rose-500/15 text-rose-500',
            ring: isDark ? 'hover:border-rose-500/40 hover:bg-rose-500/[0.06]' : 'hover:border-rose-300 hover:bg-rose-50',
        },
    ];
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative w-full max-w-md rounded-3xl border shadow-2xl p-6 ${isDark ? 'bg-[#141518] border-white/10' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-500 text-white flex items-center justify-center shrink-0"><ArrowLeftRight className="w-5 h-5" strokeWidth={2.4} /></span>
                        <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('tx.new')}</h2>
                    </div>
                    <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><X className="w-4 h-4" /></button>
                </div>
                <p className={`text-[13px] mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('tx.whatRegister')}</p>

                <div className="grid grid-cols-2 gap-3">
                    {opts.map(o => {
                        const Icon = o.icon;
                        return (
                            <button key={o.kind} onClick={() => onPick(o.kind)}
                                className={`group rounded-2xl border p-4 text-center transition active:scale-[0.98] ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'} ${o.ring}`}>
                                <span className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 transition group-hover:scale-105 ${o.iconWrap}`}>
                                    <Icon className="w-6 h-6" strokeWidth={2.2} />
                                </span>
                                <p className={`font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{o.label}</p>
                                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{o.sub}</p>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ── Janela "Entradas do mês": entradas recorrentes cadastradas em cards + confirmar recebimento ──
// O avulso fica num botão discreto embaixo (seta pra baixo).
function EntradasModal({ isDark, uid, incomes, transactions, mk, saldoConta, onClose }) {
    const { t, fmtMoney: money, fmtMonth } = useI18n();
    const [baixa, setBaixa] = useState(null); // rec a confirmar
    const [avulso, setAvulso] = useState(false); // formulário avulso aberto embaixo
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';

    const rows = useMemo(() => [...incomes]
        .map(r => ({ ...r, status: statusOf(r, transactions, mk), paidTx: paidTxOf(r, transactions, mk) }))
        .sort((a, b) => (a.status === b.status ? 0 : a.status === 'pago' ? 1 : -1) || (a.day || 0) - (b.day || 0)),
        [incomes, transactions, mk]);
    const pendentes = rows.filter(r => r.status !== 'pago');
    const totalPend = pendentes.reduce((a, r) => a + (parseFloat(r.value) || 0), 0);
    const totalRec = rows.filter(r => r.status === 'pago').reduce((a, r) => a + (parseFloat(r.paidTx?.amount ?? r.value) || 0), 0);
    const mes = fmtMonth(mk, { month: 'long' });

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
                <div className={`relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl border shadow-2xl ${isDark ? 'bg-[#141518] border-white/10' : 'bg-white border-slate-100'}`}>
                    {/* Cabeçalho */}
                    <div className={`flex items-center gap-3.5 px-6 py-5 border-b ${isDark ? 'border-white/[0.06] bg-emerald-500/[0.06]' : 'border-slate-100 bg-emerald-50/70'}`}>
                        <span className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/20 flex items-center justify-center shrink-0"><TrendingUp className="w-6 h-6" strokeWidth={2.4} /></span>
                        <div className="min-w-0 flex-1">
                            <h2 className={`text-xl font-black tracking-tight capitalize ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('tx.entriesOf', { month: mes })}</h2>
                            <p className={`text-[13px] mt-0.5 normal-case ${muted}`}>{t('tx.confirmReceipts')}</p>
                        </div>
                        <div className="hidden sm:flex items-center gap-2">
                            <MiniStat isDark={isDark} label={t('tx.toReceive')} value={totalPend} cls={isDark ? 'text-white' : 'text-slate-800'} />
                            <MiniStat isDark={isDark} label={t('tx.received')} value={totalRec} cls="text-emerald-500" />
                        </div>
                        <button onClick={onClose} className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><X className="w-4 h-4" /></button>
                    </div>

                    {/* Cards das entradas recorrentes */}
                    <div className="p-5 sm:p-6">
                        {rows.length === 0 ? (
                            <div className={`rounded-2xl border border-dashed py-10 text-center px-4 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50/60'}`}>
                                <span className={`w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center ${isDark ? 'bg-white/5 text-slate-500' : 'bg-white text-slate-400 shadow-sm'}`}><Repeat className="w-6 h-6" /></span>
                                <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('tx.noRecurringIncome')}</p>
                                <p className={`text-xs mt-1 ${muted}`}>{t('tx.noRecurringIncomeDesc')}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {rows.map(r => <EntradaCard key={r.id} r={r} isDark={isDark} onConfirm={() => setBaixa(r)} />)}
                            </div>
                        )}
                    </div>

                    {/* Avulso — pequeno, embaixo, com seta; abre o formulário logo abaixo (acordeão) */}
                    <div className={`border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                        <div className="px-6 py-4 flex justify-center">
                            <button onClick={() => setAvulso(v => !v)} aria-expanded={avulso}
                                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold border transition active:scale-95 ${avulso
                                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                                    : (isDark ? 'border-white/10 text-slate-300 hover:bg-white/5 hover:text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800')}`}>
                                {t('tx.oneOffIncome')} <ChevronDown className={`w-4 h-4 transition-transform ${avulso ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                        {avulso && (
                            <div className={`px-6 pb-6 animate-in fade-in slide-in-from-top-1 duration-200 ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50/60'}`}>
                                <div className="flex items-center gap-2.5 pt-4 pb-3">
                                    <span className="w-8 h-8 rounded-lg bg-emerald-500/12 text-emerald-500 flex items-center justify-center shrink-0"><TrendingUp className="w-4 h-4" strokeWidth={2.4} /></span>
                                    <h3 className={`text-[15px] font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('tx.newOneOffIncome')}</h3>
                                </div>
                                <LancamentoForm isDark={isDark} uid={uid} kind="income" editing={null} saldoConta={saldoConta} inline onClose={() => setAvulso(false)} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {baixa && <BaixaDialog isDark={isDark} uid={uid} kind="income" rec={baixa} saldo={saldoConta} mk={mk} onClose={() => setBaixa(null)} />}
        </>
    );
}

function MiniStat({ isDark, label, value, cls }) {
    const { fmtMoney: money } = useI18n();
    return (
        <div className={`rounded-xl border px-3 py-1.5 min-w-[100px] ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
            <p className={`text-[13px] font-black tabular-nums leading-tight ${cls}`}>R$ {money(value)}</p>
        </div>
    );
}

// Card de uma entrada recorrente dentro da janela.
function EntradaCard({ r, isDark, onConfirm }) {
    const { t, fmtMoney: money, fmtDate } = useI18n();
    const c = catMetaOf('income', r.category);
    const hex = categoryHex(c);
    const Icon = c.icon;
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const paid = r.status === 'pago';
    const paidDate = paid && r.paidTx?.date ? fmtDate(r.paidTx.date, { day: '2-digit', month: '2-digit' }) : null;
    const value = paid ? (r.paidTx?.amount ?? r.value) : r.value;
    return (
        <div className={`rounded-2xl border p-4 flex flex-col gap-3 transition ${paid
            ? (isDark ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-emerald-200 bg-emerald-50/50')
            : (isDark ? 'border-white/10 bg-white/[0.02] hover:border-white/[0.16]' : 'border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]')}`}>
            <div className="flex items-start gap-3">
                <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${hex}1f`, color: hex }}>{Icon && <Icon className="w-5 h-5" />}</span>
                <div className="min-w-0 flex-1">
                    <p className={`font-black text-[15px] leading-tight truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.name}</p>
                    <p className={`text-[11.5px] mt-0.5 truncate ${muted}`}>{c.label}{r.isVariable ? ` · ${t('st.variableValue')}` : ''}</p>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${paid
                    ? 'bg-emerald-500/12 text-emerald-500 border-emerald-500/20'
                    : (isDark ? 'bg-white/5 text-slate-400 border-white/10' : 'bg-slate-100 text-slate-500 border-slate-200')}`}>{paid ? t('tx.received') : t('common.pending')}</span>
            </div>
            <div className="flex items-end justify-between gap-3">
                <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>{paid ? t('tx.received') : r.isVariable ? t('rec.estimated') : t('common.value')}</p>
                    <p className={`text-[22px] font-black tabular-nums leading-tight ${paid ? 'text-emerald-500' : (isDark ? 'text-white' : 'text-slate-800')}`}>R$ {money(value)}</p>
                </div>
                <p className={`text-[11.5px] font-semibold text-right ${muted}`}>
                    <CalendarDays className="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" />{paid ? (paidDate ? t('tx.receivedOn', { date: paidDate }) : t('tx.received')) : t('tx.receivesOn', { day: r.day || 1 })}
                </p>
            </div>
            {paid ? (
                <div className="w-full py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 bg-emerald-500/12 text-emerald-500"><Check className="w-4 h-4" strokeWidth={3} /> {t('tx.confirmed')}</div>
            ) : (
                <button onClick={onConfirm}
                    className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/25 transition active:scale-[0.98]">
                    <Check className="w-4 h-4" strokeWidth={3} /> {t('tx.confirmReceipt')}
                </button>
            )}
        </div>
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
    return <button onClick={() => setConfirm(true)} title="Excluir" className={`p-1.5 rounded-lg text-slate-400 hover:text-rose-500 ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}><Trash2 className="w-3.5 h-3.5" /></button>;
}

// Modal de novo/editar lançamento — com adicionador de múltiplos valores.
function LancamentoForm({ isDark, uid, kind, editing, saldoConta = 0, onClose, inline = false }) {
    const { t, fmtMoney: money } = useI18n();
    const cfg = KIND[kind];
    const income = kind === 'income';
    const [description, setDescription] = useState(editing?.description || '');
    const [amount, setAmount] = useState('');
    const [parts, setParts] = useState(editing?.amount != null ? [Number(editing.amount)] : []);
    const [category, setCategory] = useState(editing?.category || cfg.defaultCat);
    const [priority, setPriority] = useState(editing?.priority || 'comfort');
    const [payMethod, setPayMethod] = useState(editing?.paymentMethod || 'pix');
    const [cardId, setCardId] = useState(editing?.selectedCardId || editing?.cardId || '');
    const [cards, setCards] = useState([]);
    const [date, setDate] = useState(editing?.date ? String(editing.date).slice(0, 10) : todayISO());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [confirmNeg, setConfirmNeg] = useState(false); // aviso de saldo negativo pendente

    useEffect(() => {
        if (!uid || income) return;
        const qC = query(collection(db, 'cards'), where('userId', '==', uid));
        return onSnapshot(qC, (snap) => setCards(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, [uid, income]);

    const inputCls = `w-full px-3.5 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;
    const optStyle = { backgroundColor: isDark ? '#17181b' : '#ffffff', color: isDark ? '#e2e8f0' : '#1e293b' };

    const total = parts.reduce((a, v) => a + (Number(v) || 0), 0) + numBR(amount);

    // Saldo projetado da conta após esta despesa. Crédito não debita a conta
    // agora (vai pra fatura do cartão), então não afeta o saldo.
    const debitaConta = !income && payMethod !== 'credito';
    const novoDebito = debitaConta ? total : 0;
    const debitoAntigo = (editing && !income && editing.paymentMethod !== 'credito') ? Number(editing.amount || 0) : 0;
    const saldoProjetado = saldoConta + debitoAntigo - novoDebito;
    const ficaraNegativo = debitaConta && total > 0 && saldoProjetado < 0;

    const addPart = () => {
        const v = numBR(amount);
        if (v <= 0) return;
        setParts(p => [...p, v]);
        setAmount('');
        setConfirmNeg(false);
    };
    const removePart = (i) => { setParts(p => p.filter((_, idx) => idx !== i)); setConfirmNeg(false); };

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!description.trim()) { setError('Informe uma descrição.'); return; }
        if (total <= 0) { setError('Informe ao menos um valor.'); return; }
        if (!income && payMethod === 'credito' && !cardId) { setError('Selecione o cartão de crédito.'); return; }
        // Aviso amigável: esta despesa deixaria a conta negativa — pede pra conferir.
        if (ficaraNegativo && !confirmNeg) { setConfirmNeg(true); return; }
        setSaving(true);
        const iso = new Date(date + 'T12:00:00').toISOString();
        const allParts = [...parts, ...(numBR(amount) > 0 ? [numBR(amount)] : [])];
        const data = {
            description: normalizeName(description), amount: total, type: cfg.type,
            category, date: iso, month: iso.slice(0, 7), userId: uid,
            ...(allParts.length > 1 ? { amountParts: allParts } : {}),
        };
        if (!income) {
            data.priority = priority;
            data.paymentMethod = payMethod;
            data.selectedCardId = payMethod === 'credito' ? cardId : null;
            data.invoiceStatus = payMethod === 'credito' ? 'unpaid' : null;
        }
        try {
            if (editing) await updateDoc(doc(db, 'transactions', editing.id), data);
            else await addDoc(collection(db, 'transactions'), { ...data, createdAt: Date.now() });
            toast.success(editing ? 'Lançamento atualizado!' : 'Lançamento salvo!');
            onClose();
        } catch (err) { console.error(err); toast.error('Não foi possível salvar. Tente de novo.'); setError('Não foi possível salvar. Tente de novo.'); setSaving(false); }
    };

    const body = (
            <form onSubmit={submit} className="space-y-3.5">
                {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-2.5 rounded-xl text-[12px] text-center font-bold">{error}</div>}

                <Field label="Descrição"><input value={description} onChange={e => setDescription(e.target.value)} placeholder={income ? 'Ex.: Venda, Reembolso' : 'Ex.: Uber, Mercado, Almoço'} className={inputCls} maxLength={50} autoFocus /></Field>

                {/* Adicionador de valores */}
                <div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">Valor{parts.length > 0 ? 'es' : ''}</span>
                    <div className="flex gap-2">
                        <input inputMode="decimal" value={amount}
                            onChange={e => { setAmount(e.target.value.replace(/[^0-9.,]/g, '')); setConfirmNeg(false); }}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPart(); } }}
                            placeholder="0,00" className={inputCls} />
                        <button type="button" onClick={addPart}
                            className="shrink-0 px-3 rounded-xl bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 font-bold text-sm flex items-center gap-1 transition active:scale-95">
                            <Plus className="w-4 h-4" strokeWidth={2.6} /> Somar
                        </button>
                    </div>
                    <p className={`text-[11px] mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Adicione vários valores (ex.: 3 corridas de Uber) que o total soma sozinho.</p>

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
                        <span className={`font-black tabular-nums ${income ? 'text-emerald-500' : 'text-rose-500'}`}>{income ? '+' : '−'} R$ {money(total)}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Categoria">
                        <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
                            {cfg.cats.map(c => <option key={c.id} value={c.id} style={optStyle}>{c.label}</option>)}
                        </select>
                    </Field>
                    <Field label="Data">
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }} />
                    </Field>
                </div>

                {!income && (
                    <>
                        <div>
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">Tipo de gasto</span>
                            <div className="grid grid-cols-3 gap-2">
                                {PRIORITIES.map(p => {
                                    const on = priority === p.id;
                                    return (
                                        <button key={p.id} type="button" onClick={() => setPriority(p.id)}
                                            className={`py-2 rounded-xl text-[12px] font-bold border transition active:scale-95 ${on ? p.badge + ' border-transparent' : (isDark ? 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800')}`}>
                                            {p.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <Field label="Forma de pagamento">
                            <select value={payMethod} onChange={e => { setPayMethod(e.target.value); setConfirmNeg(false); }} className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
                                {PAYMENTS.map(o => <option key={o.id} value={o.id} style={optStyle}>{o.label}</option>)}
                            </select>
                        </Field>

                        {payMethod === 'credito' && (
                            <Field label="Cartão de crédito">
                                {cards.length === 0 ? (
                                    <p className={`text-[12px] font-semibold px-3.5 py-3 rounded-xl border ${isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                                        Nenhum cartão cadastrado ainda. Cadastre em <span className="text-emerald-500 font-bold">Cartões</span>.
                                    </p>
                                ) : (
                                    <select value={cardId} onChange={e => setCardId(e.target.value)} className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
                                        <option value="" style={optStyle}>Selecione o cartão…</option>
                                        {cards.map(c => <option key={c.id} value={c.id} style={optStyle}>{c.name || c.bank || 'Cartão'}</option>)}
                                    </select>
                                )}
                            </Field>
                        )}
                    </>
                )}

                {/* Aviso gentil: saldo ficará negativo */}
                {confirmNeg && (
                    <div className={`rounded-2xl border px-4 py-3.5 ${isDark ? 'border-amber-500/30 bg-amber-500/[0.07]' : 'border-amber-300 bg-amber-50'}`}>
                        <div className="flex items-start gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0 mt-0.5"><Wallet className="w-4 h-4" /></span>
                            <div className="min-w-0">
                                <p className={`text-[13px] font-black ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>Seu saldo vai ficar negativo</p>
                                <p className={`text-[12px] mt-1 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                    Com esta despesa, a conta fica em <span className="font-black text-rose-500 tabular-nums">− R$ {money(Math.abs(saldoProjetado))}</span>.
                                    Gastar mais do que tem pode levar a juros e endividamento aos poucos. Vale conferir se cabe agora ou se dá pra adiar.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                            <button type="button" onClick={() => setConfirmNeg(false)}
                                className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition active:scale-95 ${isDark ? 'bg-white/5 text-slate-200 hover:bg-white/10' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}>
                                Revisar
                            </button>
                            <button type="submit" disabled={saving}
                                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white bg-amber-500 hover:bg-amber-600 transition active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-70">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lançar mesmo assim'}
                            </button>
                        </div>
                    </div>
                )}

                {!confirmNeg && (
                    <button type="submit" disabled={saving} className={`w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-70 ${cfg.submit}`}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> {editing ? 'Salvar' : 'Lançar'}</>}
                    </button>
                )}
            </form>
    );
    if (inline) return body;
    return (
        <Modal isDark={isDark} title={editing ? (income ? 'Editar entrada' : 'Editar despesa') : cfg.title}
            icon={cfg.icon} iconCls={income ? 'bg-emerald-500/12 text-emerald-500' : 'bg-rose-500/12 text-rose-500'}
            onClose={onClose}>
            {body}
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
