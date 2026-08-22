import React, { useState, useEffect, useMemo, useRef } from 'react';
import AliviaFormHint from '../components/AliviaFormHint';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import {
    collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc,
    doc, runTransaction, serverTimestamp,
} from 'firebase/firestore';
import { CATEGORIES, categoryHex } from '../constants/categories';
import { buildWalletLedger } from '../utils/financialLogic';
import {
    Plus, Pencil, Trash2, CheckCircle2, AlertTriangle, X, Loader2,
    Wallet, Repeat, History, Check, TrendingUp, TrendingDown, ChevronDown, Info,
} from 'lucide-react';

const monthKeyNow = () => new Date().toISOString().slice(0, 7);
const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numBR = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
// Padroniza a descrição: 1ª letra maiúscula, resto minúsculo (ex.: "ALUGUEL" → "Aluguel").
const normalizeName = (s) => {
    const t = String(s || '').trim().replace(/\s+/g, ' ');
    return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t;
};

// ── Config por tipo (entrada x despesa) ─────────────────────────────
const KIND = {
    income: {
        collection: 'fixed_incomes',
        cats: CATEGORIES.income,
        defaultCat: 'salary',
        occPrefix: 'inc_',
        txType: 'income',
        title: 'Entradas recorrentes',
        newLabel: 'Nova entrada recorrente',
        emptyHint: 'Cadastre seu salário e outras entradas fixas.',
        doneLabel: 'Recebido',
        actionLabel: 'Confirmar',
        icon: TrendingUp,
        btn: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-900/30',
        submitBtn: 'bg-emerald-500 hover:bg-emerald-600',
    },
    expense: {
        collection: 'fixed_expenses',
        cats: CATEGORIES.expense,
        defaultCat: 'conta_fixa',
        occPrefix: '',
        txType: 'expense',
        title: 'Despesas recorrentes',
        newLabel: 'Nova despesa recorrente',
        emptyHint: 'Cadastre contas fixas, assinaturas e mensalidades.',
        doneLabel: 'Pago',
        actionLabel: 'Dar baixa',
        icon: TrendingDown,
        btn: 'bg-rose-500 hover:bg-rose-600 shadow-rose-900/30',
        submitBtn: 'bg-rose-500 hover:bg-rose-600',
    },
};
const catMetaOf = (kind, id) => KIND[kind].cats.find(c => c.id === id) || { label: 'Outro', color: 'text-slate-400', icon: null };

// Situação de um recorrente no mês corrente.
function statusOf(rec, transactions, mk) {
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

export default function Recorrentes() {
    const { currentUser } = useAuth();
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const uid = currentUser?.uid;
    const mk = monthKeyNow();

    const [incomes, setIncomes] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [form, setForm] = useState(null);   // { kind, editing }
    const [baixa, setBaixa] = useState(null);  // { kind, rec }
    const [chooser, setChooser] = useState(false); // janela de escolha entrada/despesa

    useEffect(() => {
        if (!uid) return;
        const unsubI = onSnapshot(query(collection(db, 'fixed_incomes'), where('userId', '==', uid)),
            (s) => setIncomes(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
        const unsubE = onSnapshot(query(collection(db, 'fixed_expenses'), where('userId', '==', uid)),
            (s) => setExpenses(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
        const unsubT = onSnapshot(query(collection(db, 'transactions'), where('userId', '==', uid)),
            (s) => setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
        return () => { unsubI(); unsubE(); unsubT(); };
    }, [uid]);

    // Saldo em conta (derivado — soma das transações).
    const saldoConta = useMemo(() => buildWalletLedger(transactions, mk).finalBalance, [transactions, mk]);

    const withStatus = (list) => [...list]
        .map(r => ({ ...r, status: statusOf(r, transactions, mk) }))
        .sort((a, b) => (a.day || 0) - (b.day || 0));

    const incomeRows = useMemo(() => withStatus(incomes), [incomes, transactions, mk]);
    const expenseRows = useMemo(() => withStatus(expenses), [expenses, transactions, mk]);

    const totalEntradas = incomeRows.reduce((a, r) => a + (parseFloat(r.value) || 0), 0);
    const totalDespesas = expenseRows.reduce((a, r) => a + (parseFloat(r.value) || 0), 0);
    const pendenteDespesas = expenseRows.filter(r => r.status !== 'pago').reduce((a, r) => a + (parseFloat(r.value) || 0), 0);

    const history = useMemo(() =>
        transactions
            .filter(t => t.isFixed && t.source === 'recorrente_baixa')
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, 12),
        [transactions]);

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';

    const collOf = (kind) => KIND[kind].collection;

    return (
        <div className="max-w-6xl mx-auto w-full">
            {/* Topo: painel do ícone (esquerda) + cards + Entradas (direita) */}
            <div className="grid lg:grid-cols-[300px_1fr] gap-5 items-stretch">
                {/* Painel do ícone grande */}
                <div className={`rounded-2xl border p-6 flex flex-col items-center justify-center text-center ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                    <span className="w-28 h-28 rounded-[2rem] bg-gradient-to-br from-emerald-500/25 to-teal-600/15 ring-1 ring-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(16,185,129,0.2)]">
                        <Repeat className="w-14 h-14" strokeWidth={2.2} />
                    </span>
                    <h1 className={`text-2xl font-black tracking-tight mt-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>Recorrentes</h1>
                    <p className={`text-xs mt-1 ${muted}`}>Entradas e despesas fixas do mês</p>
                </div>

                {/* Cards + Entradas recorrentes */}
                <div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <SummaryCard isDark={isDark} icon={Wallet} label="Saldo em conta" value={`R$ ${money(saldoConta)}`} tone={saldoConta >= 0 ? 'emerald' : 'rose'} />
                        <SummaryCard isDark={isDark} icon={TrendingUp} label="Entradas recorrentes" value={`R$ ${money(totalEntradas)}`} tone="emerald" />
                        <SummaryCard isDark={isDark} icon={TrendingDown} label="Despesas recorrentes" value={`R$ ${money(totalDespesas)}`} tone="rose" />
                    </div>

                    <RecorrentesSection
                        kind="income" rows={incomeRows} isDark={isDark} wrapClass="mt-6"
                        headerRight={<NovoRecorrenteButton onClick={() => setChooser(true)} />}
                        onEdit={(r) => setForm({ kind: 'income', editing: r })}
                        onDelete={(r) => deleteDoc(doc(db, collOf('income'), r.id))}
                        onBaixa={(r) => setBaixa({ kind: 'income', rec: r })}
                    />
                </div>
            </div>

            {/* Despesas recorrentes (largura toda, sem botão) */}
            <RecorrentesSection
                kind="expense" rows={expenseRows} isDark={isDark} wrapClass="mt-6"
                onEdit={(r) => setForm({ kind: 'expense', editing: r })}
                onDelete={(r) => deleteDoc(doc(db, collOf('expense'), r.id))}
                onBaixa={(r) => setBaixa({ kind: 'expense', rec: r })}
            />

            {/* Nota */}
            <div className={`mt-6 rounded-2xl border px-4 py-3.5 flex items-center gap-3 text-[13px] ${isDark ? 'border-white/10 bg-white/[0.02] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <Info className="w-4 h-4 shrink-0 text-emerald-500" />
                Ao confirmar ou dar baixa, o valor será lançado na conta e o saldo será atualizado automaticamente.
            </div>

            {/* Histórico de baixas */}
            {history.length > 0 && (
                <div className="mt-8">
                    <h2 className={`text-[11px] font-black uppercase tracking-widest ${muted} mb-2 flex items-center gap-1.5`}><History className="w-3.5 h-3.5" /> Histórico</h2>
                    <div className={`rounded-2xl border divide-y ${isDark ? 'border-white/10 divide-white/5 bg-white/[0.02]' : 'border-slate-200 divide-slate-100 bg-white'}`}>
                        {history.map(h => {
                            const inc = h.type === 'income';
                            return (
                                <div key={h.id} className="flex items-center justify-between px-4 py-3 text-sm">
                                    <div>
                                        <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{h.description}</span>
                                        <span className={`ml-2 text-xs ${muted}`}>{new Date(h.date).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                    <span className={`font-black tabular-nums ${inc ? 'text-emerald-500' : 'text-rose-500'}`}>{inc ? '+' : '−'} R$ {money(h.amount)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {chooser && <KindChooserModal isDark={isDark} onClose={() => setChooser(false)}
                onPick={(kind) => { setChooser(false); setForm({ kind, editing: null }); }} />}
            {form && <RecorrenteForm isDark={isDark} uid={uid} kind={form.kind} editing={form.editing} onClose={() => setForm(null)} />}
            {baixa && <BaixaDialog isDark={isDark} uid={uid} kind={baixa.kind} rec={baixa.rec} saldo={saldoConta} mk={mk} onClose={() => setBaixa(null)} />}
        </div>
    );
}

// ── Seção (entradas ou despesas) ────────────────────────────────────
function RecorrentesSection({ kind, rows, isDark, onEdit, onDelete, onBaixa, wrapClass = 'mt-8', headerRight = null }) {
    const cfg = KIND[kind];
    const SectionIcon = cfg.icon;
    const income = kind === 'income';
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const accent = income ? 'text-emerald-500' : 'text-rose-500';

    return (
        <div className={wrapClass}>
            <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className={`text-[15px] font-black tracking-tight flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    <SectionIcon className={`w-4 h-4 ${accent}`} /> {cfg.title}
                </h2>
                {headerRight}
            </div>

            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                {rows.length === 0 ? (
                    <div className="py-12 text-center">
                        <SectionIcon className={`w-7 h-7 mx-auto mb-2.5 ${muted}`} />
                        <p className={`text-sm font-bold ${cell}`}>Nada cadastrado ainda</p>
                        <p className={`text-xs mt-1 ${muted}`}>{cfg.emptyHint}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[600px]">
                            <thead>
                                <tr className={`text-[11px] font-black uppercase tracking-widest whitespace-nowrap ${muted} border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                                    <th className="px-4 py-3">{income ? 'Entrada' : 'Despesa'}</th>
                                    <th className="px-4 py-3 hidden sm:table-cell">Categoria</th>
                                    <th className="px-4 py-3 hidden md:table-cell">{income ? 'Recebe dia' : 'Venc.'}</th>
                                    <th className="px-4 py-3 text-right">Valor</th>
                                    <th className="px-4 py-3 text-center">Situação</th>
                                    <th className="px-4 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, i) => {
                                    const c = catMetaOf(kind, r.category);
                                    const hex = categoryHex(c);
                                    const Icon = c.icon;
                                    const last = i === rows.length - 1;
                                    return (
                                        <tr key={r.id} className={`text-sm ${last ? '' : `border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}`}>
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${hex}1f`, color: hex }}>
                                                        {Icon && <Icon className="w-4 h-4" />}
                                                    </span>
                                                    <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.name}</span>
                                                    {!income && r.category === 'divida' && (
                                                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 flex items-center gap-1">
                                                            <AlertTriangle className="w-2.5 h-2.5" /> Dívida
                                                        </span>
                                                    )}
                                                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                                        {r.isVariable ? 'Variável' : 'Fixo'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className={`px-4 py-3.5 hidden sm:table-cell ${cell}`}>{c.label}</td>
                                            <td className={`px-4 py-3.5 hidden md:table-cell ${cell}`}>Dia {r.day || 1}</td>
                                            <td className={`px-4 py-3.5 text-right font-black tabular-nums whitespace-nowrap ${income ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {income ? '+' : '−'} R$ {money(r.value)}
                                            </td>
                                            <td className="px-4 py-3.5 text-center"><StatusBadge status={r.status} isDark={isDark} doneLabel={cfg.doneLabel} /></td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {r.status !== 'pago' ? (
                                                        <button onClick={() => onBaixa(r)}
                                                            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border transition active:scale-95 ${income
                                                                ? (isDark ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' : 'border-emerald-500/40 text-emerald-600 hover:bg-emerald-50')
                                                                : (isDark ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10' : 'border-rose-500/40 text-rose-600 hover:bg-rose-50')}`}>
                                                            {cfg.actionLabel}
                                                        </button>
                                                    ) : (
                                                        <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1 mr-1"><CheckCircle2 className="w-3.5 h-3.5" /> {cfg.doneLabel}</span>
                                                    )}
                                                    <button onClick={() => onEdit(r)} title="Editar" className={`p-2 rounded-lg ${muted} hover:${cell} ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}><Pencil className="w-4 h-4" /></button>
                                                    <DeleteBtn isDark={isDark} disabled={r.status === 'pago'} onDelete={() => onDelete(r)} />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function SummaryCard({ isDark, icon: Icon, label, value, tone }) {
    const toneColor = { emerald: 'text-emerald-500', rose: 'text-rose-500', amber: 'text-amber-500', slate: isDark ? 'text-slate-200' : 'text-slate-700' }[tone];
    return (
        <div className={`rounded-2xl border p-4 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
            <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <Icon className="w-3.5 h-3.5" /> {label}
            </div>
            <p className={`text-lg font-black tabular-nums mt-1.5 ${toneColor}`}>{value}</p>
        </div>
    );
}

// Botão único "Novo recorrente" — abre a janela de escolha (entrada / despesa).
function NovoRecorrenteButton({ onClick }) {
    return (
        <button onClick={onClick}
            className="group flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white transition-all active:scale-95 shadow-md shadow-violet-500/30 ring-1 ring-inset ring-white/20">
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform">
                <Plus className="w-3 h-3" strokeWidth={3} />
            </span>
            <span className="font-black uppercase tracking-[0.12em] text-[11px]">Novo recorrente</span>
        </button>
    );
}

// Janela para escolher entre Entrada e Despesa recorrente antes do formulário.
function KindChooserModal({ isDark, onClose, onPick }) {
    const opts = [
        {
            kind: 'income', label: 'Entrada recorrente', sub: 'Salário, aluguel recebido…', icon: TrendingUp,
            iconWrap: 'bg-emerald-500/15 text-emerald-500',
            ring: isDark ? 'hover:border-emerald-500/40 hover:bg-emerald-500/[0.06]' : 'hover:border-emerald-300 hover:bg-emerald-50',
        },
        {
            kind: 'expense', label: 'Despesa recorrente', sub: 'Aluguel, internet, assinatura…', icon: TrendingDown,
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
                        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white flex items-center justify-center shrink-0"><Repeat className="w-5 h-5" strokeWidth={2.4} /></span>
                        <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Novo recorrente</h2>
                    </div>
                    <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><X className="w-4 h-4" /></button>
                </div>
                <p className={`text-[13px] mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>O que se repete todo mês?</p>

                <div className="grid grid-cols-2 gap-3">
                    {opts.map(o => {
                        const Icon = o.icon;
                        return (
                            <button key={o.kind} onClick={() => onPick(o.kind)}
                                className={`group rounded-2xl border p-4 text-center transition active:scale-[0.98] ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'} ${o.ring}`}>
                                <span className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 transition group-hover:scale-105 ${o.iconWrap}`}>
                                    <Icon className="w-6 h-6" strokeWidth={2.2} />
                                </span>
                                <p className={`font-black text-[14px] ${isDark ? 'text-white' : 'text-slate-800'}`}>{o.label}</p>
                                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{o.sub}</p>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status, isDark, doneLabel = 'Pago' }) {
    const map = {
        pago: { label: doneLabel, cls: 'bg-emerald-500/12 text-emerald-500 border-emerald-500/20' },
        pendente: { label: 'Pendente', cls: isDark ? 'bg-white/5 text-slate-400 border-white/10' : 'bg-slate-100 text-slate-500 border-slate-200' },
        atrasado: { label: 'Atrasado', cls: 'bg-rose-500/12 text-rose-500 border-rose-500/20' },
    }[status];
    return <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${map.cls}`}>{map.label}</span>;
}

function DeleteBtn({ isDark, disabled, onDelete }) {
    const [confirm, setConfirm] = useState(false);
    if (disabled) return null;
    if (confirm) return (
        <div className="flex items-center gap-1">
            <button onClick={() => setConfirm(false)} className={`px-2 py-1 rounded text-[11px] font-bold ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>Não</button>
            <button onClick={onDelete} className="px-2 py-1 rounded text-[11px] font-bold bg-rose-500 text-white">Excluir</button>
        </div>
    );
    return <button onClick={() => setConfirm(true)} title="Excluir" className={`p-2 rounded-lg text-slate-400 hover:text-rose-500 ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}><Trash2 className="w-4 h-4" /></button>;
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
            if (editing) { await updateDoc(doc(db, cfg.collection, editing.id), data); onClose(); return; }
            await addDoc(collection(db, cfg.collection), { ...data, userId: uid, createdAt: Date.now() });
            if (againRef.current) {
                // "Salvar e adicionar outra": limpa e mantém o formulário aberto.
                againRef.current = false;
                setName(''); setValue(''); setAdded(n => n + 1); setSaving(false);
            } else onClose();
        } catch (err) { console.error(err); setError('Não foi possível salvar. Tente de novo.'); setSaving(false); }
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
function BaixaDialog({ isDark, uid, kind, rec, saldo, mk, onClose }) {
    const cfg = KIND[kind];
    const income = kind === 'income';
    const [amount, setAmount] = useState(String(rec.value ?? '').replace('.', ','));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [ok, setOk] = useState(false);
    const val = numBR(amount);
    // Só despesa valida saldo; receber dinheiro é sempre permitido.
    const insufficient = !income && val > saldo + 0.005;

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
                }
                tx.set(txRef, txData);
                tx.set(occRef, { kind, recorrenteId: rec.id, monthKey: mk, amount: val, txId: txRef.id, description: rec.name, at: serverTimestamp() });
                tx.update(doc(db, cfg.collection, rec.id), { lastPaidMonth: mk, ...(rec.isVariable ? { lastPaidValue: val } : {}) });
            });
            setOk(true);
            setTimeout(onClose, 1200);
        } catch (err) {
            console.error('[baixa]', err);
            setError(err?.message === 'ALREADY_PAID'
                ? (income ? 'Esta entrada já foi confirmada neste mês.' : 'Este recorrente já foi baixado neste mês.')
                : 'Não foi possível concluir. Tente de novo.');
            setLoading(false);
        }
    };

    const inputCls = `w-full pl-9 pr-3 py-3 rounded-xl border text-lg font-black outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 focus:border-emerald-500'}`;

    return (
        <Modal isDark={isDark} title={income ? 'Confirmar recebimento' : 'Dar baixa'} onClose={onClose}>
            {ok ? (
                <div className="py-6 flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/12 flex items-center justify-center mb-3"><CheckCircle2 className="w-7 h-7 text-emerald-500" /></div>
                    <p className={`text-[15px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{income ? 'Recebimento confirmado!' : 'Baixa registrada!'}</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>O saldo em conta foi atualizado.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {income ? (
                            <>Confirmar o recebimento de <span className="font-black">{rec.name}</span>? Será registrado como entrada e somado ao <span className="font-bold">Saldo em conta</span>.</>
                        ) : (
                            <>Confirmar o pagamento de <span className="font-black">{rec.name}</span>? Será registrado como despesa e debitado do <span className="font-bold">Saldo em conta</span>.</>
                        )}
                    </p>

                    {rec.isVariable && (
                        <div>
                            <span className={`text-[11px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{income ? 'Valor recebido' : 'Valor pago'}</span>
                            <div className="relative mt-1">
                                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>R$</span>
                                <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))} className={inputCls} />
                            </div>
                        </div>
                    )}

                    <div className={`rounded-xl p-3.5 border flex items-center justify-between ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                        <div><p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Saldo em conta</p><p className={`font-black tabular-nums ${saldo >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>R$ {money(saldo)}</p></div>
                        <div className="text-right"><p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{income ? 'Entrada' : 'Baixa'}</p><p className={`font-black tabular-nums ${income ? 'text-emerald-500' : 'text-rose-500'}`}>{income ? '+' : '−'} R$ {money(val)}</p></div>
                    </div>

                    {(error || insufficient) && (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-2.5 rounded-xl text-[12px] font-bold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" /> {error || `Saldo insuficiente para esta baixa.`}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2.5">
                        <button onClick={onClose} className={`py-3 rounded-xl font-bold text-sm ${isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Cancelar</button>
                        <button onClick={confirmar} disabled={loading || insufficient} className="py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> {income ? 'Confirmar' : 'Confirmar baixa'}</>}
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
