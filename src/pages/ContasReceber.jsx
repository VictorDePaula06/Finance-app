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
import RegistryHint from '../components/ui/RegistryHint';
import {
    TrendingUp, CheckCircle2, Check, CalendarDays, Plus, CircleDollarSign,
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

    // Entradas avulsas do mês (lançadas aqui ou em outro lugar) — já recebidas.
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

    // Uma lista só: as cadastradas (recebidas ou não) mais as avulsas do mês,
    // na ordem do dia. A ordenação é SÓ pelo dia — separar por situação faria
    // a linha pular para o fim no instante em que você confirma o recebimento.
    const lista = useMemo(() => {
        const diaDe = (d) => { const x = new Date(d); return isNaN(x) ? 0 : x.getDate(); };
        const extras = avulsas.map(tx => ({
            id: tx.id, name: tx.description, value: tx.amount, category: tx.category,
            paidTx: tx, status: 'pago', oneOff: true, day: diaDe(tx.date),
        }));
        return [...rows, ...extras].sort((a, b) => (a.day || 0) - (b.day || 0));
    }, [rows, avulsas]);

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
                        <RegistryHint isDark={isDark} label={t('registry.hintReceive')} />
                    </div>
                </div>
                {/* Sem pílula de situação: os dois números aparecem juntos,
                    porque a lista abaixo também mostra as duas situações. */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <Stat isDark={isDark} label={t('recv.toReceive')} value={totalAReceber} tone="white" money={money} />
                    <Stat isDark={isDark} label={t('recv.received')} value={totalRecebido} tone="emerald" money={money} />
                    <Stat isDark={isDark} label={t('recv.totalIncome')} value={totalAReceber + totalRecebido} tone="white" money={money} />
                </div>
            </div>

            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]'}`}>
                {/* Cabeçalho da lista */}
                <div className={`flex items-center justify-between gap-3 flex-wrap px-4 sm:px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-emerald-500/12 text-emerald-500 flex items-center justify-center shrink-0"><CircleDollarSign className="w-4 h-4" /></span>
                        <h2 className={`text-[15px] font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('recv.receipts')}</h2>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>{lista.length}</span>
                    </div>
                    <button onClick={() => setForm(true)}
                        className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold border transition active:scale-95 ${isDark ? 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20' : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                        <Plus className="w-3.5 h-3.5" strokeWidth={2.6} /> {t('recv.manualEntry')}
                    </button>
                </div>

                {lista.length === 0 ? (
                    <Empty isDark={isDark} icon={CalendarDays} bare
                        title={t('recv.noneRegistered')} text={t('recv.noneRegisteredDesc')} />
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
                            {lista.map(r => <IncomeRow key={r.id} r={r} isDark={isDark} onConfirm={() => setBaixa(r)} />)}
                        </div>
                    </>
                )}
            </div>

            {baixa && <BaixaDialog isDark={isDark} uid={uid} kind="income" rec={baixa} saldo={saldoConta} mk={mk} onClose={() => setBaixa(null)} />}
            {form && <LancamentoForm isDark={isDark} uid={uid} kind="income" editing={null} saldoConta={saldoConta} onClose={() => setForm(false)} />}
        </div>
    );
}

// Estilo do cabeçalho de colunas — mesmo padrão das listas de Cadastros.
const th = (isDark) => `text-left text-[11px] font-black uppercase tracking-wider whitespace-nowrap ${isDark ? 'text-slate-500' : 'text-slate-400'}`;

// Uma entrada na lista. Recebida ou não, é a MESMA linha: o que muda é o selo
// e a presença do botão. Assim confirmar o recebimento não embaralha a tela.
function IncomeRow({ r, isDark, onConfirm }) {
    const { t, fmtMoney: money, fmtDate } = useI18n();
    const c = catMetaOf(r.category);
    const hex = categoryHex(c);
    const Icon = c.icon;
    const paid = r.status === 'pago';
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';
    const paidDate = paid && r.paidTx?.date ? fmtDate(r.paidTx.date, { day: '2-digit', month: '2-digit' }) : null;
    const shownValue = paid ? (r.paidTx?.amount ?? r.value) : r.value;
    const quando = paid
        ? (paidDate ? t('tx.receivedOn', { date: paidDate }) : t('recv.received'))
        : t('recv.receivesOn', { day: r.day || 1 });

    return (
        <div className={`flex items-center gap-3 px-3 sm:px-4 py-3 text-[13px] transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/70'}`}>
            <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${hex}1f`, color: hex }}>{Icon && <Icon className="w-4 h-4" />}</span>

            <div className="min-w-0 flex-1">
                <p className={`font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.name}</p>
                <div className={`flex items-center gap-1.5 flex-wrap text-[11px] mt-0.5 ${muted}`}>
                    <span className="truncate">{c.label}</span>
                    {r.oneOff && <Tag cls="bg-emerald-500/15 text-emerald-400">{t('recv.oneOff')}</Tag>}
                    {r.isVariable && <Tag cls={isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}>{t('st.variableValue')}</Tag>}
                    {/* As colunas da direita somem em tela estreita: o que elas diziam desce pra cá. */}
                    <span className="md:hidden">· {quando}</span>
                </div>
            </div>

            <div className={`hidden md:block w-[180px] shrink-0 ${cell}`}>{quando}</div>

            <div className={`w-[104px] shrink-0 text-right font-black tabular-nums ${paid ? 'text-emerald-500' : (isDark ? 'text-white' : 'text-slate-800')}`}>R$ {money(shownValue)}</div>

            <div className="hidden sm:block w-[88px] shrink-0">
                <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${paid
                    ? 'bg-emerald-500/12 text-emerald-500 border-emerald-500/20'
                    : (isDark ? 'bg-white/5 text-slate-400 border-white/10' : 'bg-slate-100 text-slate-500 border-slate-200')}`}>
                    {paid ? t('recv.received') : t('common.pending')}
                </span>
            </div>

            <div className="sm:w-[104px] shrink-0 flex items-center justify-end">
                {paid ? (
                    <>
                        <span className="sm:hidden text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border bg-emerald-500/12 text-emerald-500 border-emerald-500/20">{t('recv.received')}</span>
                        <CheckCircle2 className="hidden sm:block w-4 h-4 text-emerald-500" />
                    </>
                ) : (
                    <button onClick={onConfirm} title={t('tx.confirmReceipt')}
                        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold whitespace-nowrap transition active:scale-95">
                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                        <span className="hidden sm:inline">{t('recv.receiveNow')}</span>
                    </button>
                )}
            </div>
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
