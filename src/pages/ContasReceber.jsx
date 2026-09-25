import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/LanguageContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { CATEGORIES, categoryHex } from '../constants/categories';
import { buildWalletLedger } from '../utils/financialLogic';
import { BaixaDialog, statusOf, paidTxOf } from './Recorrentes';
import { LancamentoForm } from './Lancamentos';
import {
    TrendingUp, CheckCircle2, Check, CalendarDays, Plus, Sparkles, CircleDollarSign,
} from 'lucide-react';

// ── Contas a receber ────────────────────────────────────────────────
// As ENTRADAS cadastradas em Configurações e Cadastros. Aqui a pessoa confirma
// o recebimento do mês (vira lançamento e soma no saldo) e pode lançar uma
// entrada avulsa. O cadastro de entradas fixas continua só em Cadastros.

const monthKeyNow = () => new Date().toISOString().slice(0, 7);
const catMetaOf = (id) => CATEGORIES.income.find(c => c.id === id) || { label: 'Outro', color: 'text-slate-400', icon: null };
const txMonthKey = (t) => t.month || (t.date ? String(t.date).slice(0, 7) : '');

export default function ContasReceber() {
    const { currentUser } = useAuth();
    const { theme } = useTheme();
    const { t, fmtMoney: money, fmtMonth } = useI18n();
    const isDark = theme !== 'light';
    const uid = currentUser?.uid;
    const mk = monthKeyNow();

    const [incomes, setIncomes] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [tab, setTab] = useState('areceber');   // 'areceber' | 'recebido'
    const [baixa, setBaixa] = useState(null);     // entrada a confirmar
    const [form, setForm] = useState(false);      // lançamento avulso

    useEffect(() => {
        if (!uid) return;
        const q = (c) => query(collection(db, c), where('userId', '==', uid));
        const list = [
            onSnapshot(q('fixed_incomes'), (s) => setIncomes(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}),
            onSnapshot(q('transactions'), (s) => setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}),
        ];
        return () => list.forEach(u => u());
    }, [uid]);

    const saldoConta = useMemo(() => buildWalletLedger(transactions, mk).finalBalance, [transactions, mk]);

    // Entradas cadastradas, com a situação do mês.
    const rows = useMemo(() => [...incomes]
        .map(r => ({ ...r, kind: 'income', status: statusOf(r, transactions, mk), paidTx: paidTxOf(r, transactions, mk) }))
        .sort((a, b) => (a.day || 0) - (b.day || 0)),
        [incomes, transactions, mk]);

    const aReceber = rows.filter(r => r.status !== 'pago');
    const recebidas = rows.filter(r => r.status === 'pago');

    // Entradas avulsas do mês (lançadas aqui ou em outro lugar) — só na aba "Recebido".
    const avulsas = useMemo(() => transactions
        .filter(t => t.type === 'income' && txMonthKey(t) === mk && !t.isFixed && !t.isTransfer
            && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category))
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)),
        [transactions, mk]);

    const totalAReceber = aReceber.reduce((a, r) => a + (parseFloat(r.value) || 0), 0);
    const totalRecebido = recebidas.reduce((a, r) => a + (parseFloat(r.paidTx?.amount ?? r.value) || 0), 0)
        + avulsas.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const mesLabel = fmtMonth(mk);

    const TABS = [
        { id: 'areceber', label: t('recv.toReceive'), count: aReceber.length },
        { id: 'recebido', label: t('recv.received'), count: recebidas.length + avulsas.length },
    ];

    return (
        <div className="max-w-6xl mx-auto w-full">
            {/* Cabeçalho: título · resumo · pílula A receber/Recebido */}
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
                <div className="flex items-center gap-4 min-w-0">
                    <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-600/15 ring-1 ring-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(16,185,129,0.18)]">
                        <TrendingUp className="w-7 h-7" strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0">
                        <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('recv.title')}</h1>
                        <p className={`text-sm mt-0.5 ${muted}`}>{t('recv.subtitle', { month: '' })}<span className={`font-bold capitalize ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{mesLabel}</span></p>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {tab === 'areceber'
                        ? <Stat isDark={isDark} label={t('recv.toReceive')} value={totalAReceber} tone="white" money={money} />
                        : <Stat isDark={isDark} label={t('recv.received')} value={totalRecebido} tone="emerald" money={money} />}
                    <Stat isDark={isDark} label={t('recv.totalIncome')} value={totalAReceber + totalRecebido} tone="white" money={money} />

                    <div role="tablist" aria-label={t('recv.title')}
                        className={`inline-flex items-center p-1 rounded-full border ${isDark ? 'border-white/10' : 'border-slate-200 bg-white'}`}>
                        {TABS.map(x => {
                            const on = tab === x.id;
                            return (
                                <button key={x.id} role="tab" aria-selected={on} onClick={() => setTab(x.id)}
                                    className={`px-5 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all duration-200 active:scale-[0.97] ${on
                                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                                        : (isDark ? 'bg-transparent text-white hover:bg-white/[0.06]' : 'bg-transparent text-slate-700 hover:bg-slate-100')}`}>
                                    {x.label} ({x.count})
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {tab === 'areceber' ? (
                <div className="animate-in fade-in duration-200">
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/15 text-emerald-500"><CircleDollarSign className="w-5 h-5" strokeWidth={2.4} /></span>
                        <h2 className={`text-[16px] font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('recv.receipts')}</h2>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>{aReceber.length}</span>
                        {/* Lançamento manual — discreto, sem competir com os cards */}
                        <button onClick={() => setForm(true)}
                            className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold border transition active:scale-95 ${isDark ? 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                            <Plus className="w-3.5 h-3.5" strokeWidth={2.6} /> {t('recv.manualEntry')}
                        </button>
                    </div>

                    {aReceber.length === 0 ? (
                        <Empty isDark={isDark} icon={rows.length === 0 ? CalendarDays : Sparkles}
                            title={rows.length === 0 ? t('recv.noneRegistered') : t('recv.allReceived')}
                            text={rows.length === 0 ? t('recv.noneRegisteredDesc') : t('recv.allReceivedDesc')} />
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {aReceber.map(r => <IncomeCard key={r.id} r={r} isDark={isDark} onConfirm={() => setBaixa(r)} />)}
                        </div>
                    )}
                </div>
            ) : (
                <div className="animate-in fade-in duration-200">
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/15 text-emerald-500"><CheckCircle2 className="w-5 h-5" strokeWidth={2.4} /></span>
                        <h2 className={`text-[16px] font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('recv.receivedThisMonth')}</h2>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>{recebidas.length + avulsas.length}</span>
                        <button onClick={() => setForm(true)}
                            className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold border transition active:scale-95 ${isDark ? 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                            <Plus className="w-3.5 h-3.5" strokeWidth={2.6} /> {t('recv.manualEntry')}
                        </button>
                    </div>

                    {recebidas.length + avulsas.length === 0 ? (
                        <Empty isDark={isDark} icon={CheckCircle2} title={t('recv.nothingReceived')} text={t('recv.nothingReceivedDesc')} />
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {recebidas.map(r => <IncomeCard key={r.id} r={r} isDark={isDark} paid />)}
                            {avulsas.map(tx => <IncomeCard key={tx.id} isDark={isDark} paid oneOff
                                r={{ name: tx.description, value: tx.amount, category: tx.category, paidTx: tx, status: 'pago' }} />)}
                        </div>
                    )}
                </div>
            )}

            {baixa && <BaixaDialog isDark={isDark} uid={uid} kind="income" rec={baixa} saldo={saldoConta} mk={mk} onClose={() => setBaixa(null)} />}
            {form && <LancamentoForm isDark={isDark} uid={uid} kind="income" editing={null} saldoConta={saldoConta} onClose={() => setForm(false)} />}
        </div>
    );
}

// Card de uma entrada (cadastrada ou avulsa) — mesmo padrão de Contas a pagar.
function IncomeCard({ r, isDark, onConfirm, paid = false, oneOff = false }) {
    const { t, fmtMoney: money, fmtDate } = useI18n();
    const c = catMetaOf(r.category);
    const hex = categoryHex(c);
    const Icon = c.icon;
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const paidDate = paid && r.paidTx?.date ? fmtDate(r.paidTx.date, { day: '2-digit', month: '2-digit' }) : null;
    const shownValue = paid ? (r.paidTx?.amount ?? r.value) : r.value;

    return (
        <div className={`rounded-2xl border p-4 flex flex-col gap-3 transition ${isDark ? 'border-white/10 bg-white/[0.02] hover:border-white/[0.16]' : 'border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]'}`}>
            <div className="flex items-start gap-3">
                <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${hex}1f`, color: hex }}>{Icon && <Icon className="w-5 h-5" />}</span>
                <div className="min-w-0 flex-1">
                    <p className={`font-black text-[15px] leading-tight truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.name}</p>
                    <p className={`text-[11.5px] mt-0.5 truncate ${muted}`}>{c.label}</p>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${paid
                    ? 'bg-emerald-500/12 text-emerald-500 border-emerald-500/20'
                    : (isDark ? 'bg-white/5 text-slate-400 border-white/10' : 'bg-slate-100 text-slate-500 border-slate-200')}`}>
                    {paid ? t('recv.received') : t('common.pending')}
                </span>
            </div>

            {(r.isVariable || oneOff) && (
                <div className="flex items-center gap-1.5 flex-wrap">
                    {oneOff && <Tag cls="bg-emerald-500/15 text-emerald-400">{t('recv.oneOff')}</Tag>}
                    {r.isVariable && <Tag cls={isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}>{t('st.variableValue')}</Tag>}
                </div>
            )}

            <div className="flex items-end justify-between gap-3 mt-auto">
                <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>{paid ? t('recv.received') : r.isVariable ? t('rec.estimated') : t('common.value')}</p>
                    <p className={`text-[22px] font-black tabular-nums leading-tight ${paid ? 'text-emerald-500' : (isDark ? 'text-white' : 'text-slate-800')}`}>R$ {money(shownValue)}</p>
                </div>
                <p className={`text-[11.5px] font-semibold text-right ${muted}`}>
                    <CalendarDays className="w-3.5 h-3.5 inline-block -mt-0.5 mr-1" />
                    {paid ? (paidDate ? t('tx.receivedOn', { date: paidDate }) : t('recv.received')) : t('recv.receivesOn', { day: r.day || 1 })}
                </p>
            </div>

            {!paid && onConfirm && (
                <button onClick={onConfirm}
                    className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/25 transition active:scale-[0.98]">
                    <Check className="w-4 h-4" strokeWidth={3} /> {t('tx.confirmReceipt')}
                </button>
            )}
        </div>
    );
}

function Tag({ cls, children }) {
    return <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1 shrink-0 ${cls}`}>{children}</span>;
}

function Stat({ isDark, label, value, tone, money }) {
    const color = tone === 'emerald' ? 'text-emerald-500' : (isDark ? 'text-white' : 'text-slate-800');
    return (
        <div className={`rounded-xl border px-3.5 py-2 min-w-[110px] ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
            <p className={`text-[9.5px] font-black uppercase tracking-widest whitespace-nowrap ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
            <p className={`text-[14px] font-black tabular-nums leading-tight ${color}`}>R$ {money(value)}</p>
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
