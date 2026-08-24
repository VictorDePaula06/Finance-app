import React, { useState, useEffect, useMemo } from 'react';
import AliviaFormHint from '../components/AliviaFormHint';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { getCdiRate } from '../utils/marketRates';
import {
    Plus, Pencil, Trash2, X, Loader2, Check, Info, ChevronDown,
    PiggyBank, Target, Wallet, ArrowDownToLine, ArrowUpFromLine, TrendingUp,
} from 'lucide-react';

const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numBR = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
const normalizeName = (s) => { const t = String(s || '').trim().replace(/\s+/g, ' '); return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t; };

// Taxa diária efetiva (dia-calendário) equivalente a render um % do CDI ao ano.
// Ex.: 100% do CDI a 14,9%/ano → (1+0,149)^(1/365)-1 por dia.
const dailyCalRate = (cdiAnnualPct, cdiPct) => Math.pow(1 + (cdiAnnualPct / 100) * ((cdiPct || 100) / 100), 1 / 365) - 1;
const investedOfRes = (r) => parseFloat(r.invested ?? r.balance ?? 0) || 0;
// Valor atual = principal consolidado rendendo desde a última consolidação até agora.
const currentValueOf = (r, cdiAnnualPct, nowMs = Date.now()) => {
    const base = parseFloat(r.balance) || 0;
    if (base <= 0) return base;
    const since = r.lastYieldAt || r.createdAt || nowMs;
    const days = Math.max(0, (nowMs - since) / 86400000);
    return base * Math.pow(1 + dailyCalRate(cdiAnnualPct, r.cdiPercent), days);
};

export default function Reservas() {
    const { currentUser } = useAuth();
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const uid = currentUser?.uid;

    const [reserves, setReserves] = useState([]);
    const [txs, setTxs] = useState([]);
    const [form, setForm] = useState(null);
    const [move, setMove] = useState(null);
    const [cdi, setCdi] = useState(14.9); // CDI anual real (%)
    const [, setTick] = useState(0);

    useEffect(() => {
        if (!uid) return;
        const u1 = onSnapshot(query(collection(db, 'savings_jars'), where('userId', '==', uid)),
            (s) => setReserves(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { });
        const u2 = onSnapshot(query(collection(db, 'transactions'), where('userId', '==', uid)),
            (s) => setTxs(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { });
        return () => { u1(); u2(); };
    }, [uid]);

    useEffect(() => {
        getCdiRate().then(raw => {
            if (!raw) return;
            const daily = raw / 365;                                    // % por dia útil (série 12 do BCB)
            const annual = (Math.pow(1 + daily / 100, 252) - 1) * 100;  // anualiza compondo em dias úteis
            if (isFinite(annual) && annual > 0) setCdi(annual);
        }).catch(() => { });
    }, []);
    // Re-render periódico para o rendimento "andar" na tela.
    useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 30000); return () => clearInterval(t); }, []);

    const totalGuardado = useMemo(() => reserves.reduce((a, r) => a + currentValueOf(r, cdi), 0), [reserves, cdi]);
    const totalInvestido = useMemo(() => reserves.reduce((a, r) => a + investedOfRes(r), 0), [reserves]);
    const rendimentoTotal = totalGuardado - totalInvestido;
    const rentab = totalInvestido > 0 ? rendimentoTotal / totalInvestido * 100 : 0;
    const metaTotal = useMemo(() => reserves.reduce((a, r) => a + (parseFloat(r.target) || 0), 0), [reserves]);
    const progresso = metaTotal > 0 ? Math.min(100, totalGuardado / metaTotal * 100) : 0;

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';

    return (
        <div className="max-w-6xl mx-auto w-full">
            <div className="grid lg:grid-cols-[320px_1fr] gap-5 items-stretch">
                {/* Porquinho + total */}
                <div className={`rounded-2xl border p-6 flex flex-col items-center justify-center text-center ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                    <span className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-pink-500/25 to-rose-500/15 ring-1 ring-pink-500/20 text-pink-400 flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(244,114,182,0.2)]">
                        <PiggyBank className="w-12 h-12" strokeWidth={2.1} />
                    </span>
                    <h1 className={`text-2xl font-black tracking-tight mt-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>Reservas</h1>
                    <p className={`text-[11px] uppercase tracking-widest font-black mt-3 ${muted}`}>Total guardado</p>
                    <p className="text-3xl font-black tabular-nums text-emerald-500 mt-0.5">R$ {money(totalGuardado)}</p>
                    <p className={`text-[12px] mt-1 ${muted}`}>rendendo a <span className="font-bold text-emerald-500">{money(cdi)}%</span> CDI/ano</p>
                </div>

                {/* Emergência: meta + progresso + rendimento (preenche o painel) */}
                <div className={`rounded-2xl border p-5 flex flex-col ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <h2 className={`text-[13px] font-black uppercase tracking-widest ${muted}`}>Reserva de emergência</h2>
                        <button onClick={() => setForm({ editing: null })}
                            className="group flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white transition-all active:scale-95 shadow-md shadow-pink-500/30 ring-1 ring-inset ring-white/20">
                            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform"><Plus className="w-3 h-3" strokeWidth={3} /></span>
                            <span className="font-black uppercase tracking-[0.12em] text-[11px]">Nova reserva</span>
                        </button>
                    </div>

                    <div className="flex-1 flex flex-col justify-between gap-4 mt-4">
                        {metaTotal > 0 ? (
                            <div>
                                <div className="flex items-end justify-between gap-2 mb-2">
                                    <span className="text-4xl font-black tabular-nums text-emerald-500">{progresso.toFixed(0)}%</span>
                                    <span className={`text-[13px] font-bold ${muted}`}>Meta R$ {money(metaTotal)}</span>
                                </div>
                                <div className={`h-3 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${progresso}%` }} />
                                </div>
                                <p className={`text-[13px] mt-2 ${muted}`}>
                                    Guardado <span className="font-bold text-emerald-500">R$ {money(totalGuardado)}</span>
                                    {' · '}Falta <span className={`font-bold ${cell}`}>R$ {money(Math.max(0, metaTotal - totalGuardado))}</span>
                                </p>
                            </div>
                        ) : (
                            <div className={`flex items-center gap-2 text-sm ${muted}`}>
                                <Target className="w-4 h-4" /> Defina uma meta ao criar sua reserva para acompanhar o progresso.
                            </div>
                        )}

                        {/* Métricas (rendimento) */}
                        <div className="grid grid-cols-3 gap-3">
                            <Mini isDark={isDark} label="Investido" value={`R$ ${money(totalInvestido)}`} cls={cell} />
                            <Mini isDark={isDark} label="Rendimento" value={`+ R$ ${money(rendimentoTotal)}`} cls="text-emerald-500" />
                            <Mini isDark={isDark} label="Rentab." value={`+${rentab.toFixed(2)}%`} cls="text-emerald-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista */}
            <h2 className={`text-[15px] font-black tracking-tight flex items-center gap-2 mt-8 mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                <Wallet className="w-4 h-4 text-emerald-500" /> Minhas reservas
            </h2>

            {reserves.length === 0 ? (
                <div className={`rounded-2xl border py-16 text-center ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                    <PiggyBank className={`w-9 h-9 mx-auto mb-3 ${muted}`} />
                    <p className={`text-sm font-bold ${cell}`}>Nenhuma reserva criada</p>
                    <p className={`text-xs mt-1 ${muted}`}>Crie sua reserva de emergência e comece a guardar.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {reserves.map(r => {
                        const cur = currentValueOf(r, cdi);
                        const inv = investedOfRes(r);
                        const rend = cur - inv;
                        const rpct = inv > 0 ? rend / inv * 100 : 0;
                        const tgt = parseFloat(r.target) || 0;
                        const pct = tgt > 0 ? Math.min(100, cur / tgt * 100) : 0;
                        return (
                            <div key={r.id} className={`relative rounded-2xl border p-5 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                                <div className="absolute top-4 right-4 flex items-center gap-0.5">
                                    <button onClick={() => setForm({ editing: r })} title="Editar" className={`p-1.5 rounded-lg ${muted} ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}><Pencil className="w-3.5 h-3.5" /></button>
                                    <DeleteBtn isDark={isDark} onDelete={() => deleteDoc(doc(db, 'savings_jars', r.id))} />
                                </div>

                                <div className="flex flex-col lg:flex-row lg:items-center gap-5">
                                    {/* Identificação */}
                                    <div className="flex items-center gap-3 lg:w-64 shrink-0 pr-8">
                                        <span className="w-11 h-11 rounded-xl bg-pink-500/12 text-pink-400 flex items-center justify-center shrink-0"><PiggyBank className="w-5 h-5" /></span>
                                        <div className="min-w-0">
                                            <p className={`font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.name || 'Reserva'}</p>
                                            <p className={`text-[11px] ${muted}`}>{r.cdiPercent || 100}% do CDI{tgt > 0 ? ` · Meta R$ ${money(tgt)}` : ''}</p>
                                        </div>
                                    </div>

                                    {/* Valor + rendimento + progresso */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-3 flex-wrap">
                                            <p className="text-2xl font-black tabular-nums text-emerald-500">R$ {money(cur)}</p>
                                            <p className={`text-[12px] font-bold ${muted}`}>
                                                Rendimento <span className="text-emerald-500">+ R$ {money(rend)} ({rpct >= 0 ? '+' : ''}{rpct.toFixed(2)}%)</span>
                                            </p>
                                        </div>
                                        {tgt > 0 && (
                                            <>
                                                <div className={`mt-2 h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                                                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${pct}%` }} />
                                                </div>
                                                <p className={`text-[11px] mt-1 ${muted}`}>{pct.toFixed(0)}% da meta</p>
                                            </>
                                        )}
                                    </div>

                                    {/* Ações */}
                                    <div className="grid grid-cols-2 gap-2 lg:w-64 shrink-0">
                                        <button onClick={() => setMove({ reserve: r, kind: 'deposit' })}
                                            className={`py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 transition active:scale-95 ${isDark ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                                            <ArrowDownToLine className="w-4 h-4" /> Depositar
                                        </button>
                                        <button onClick={() => setMove({ reserve: r, kind: 'withdraw' })} disabled={cur <= 0}
                                            className={`py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40 ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                            <ArrowUpFromLine className="w-4 h-4" /> Resgatar
                                        </button>
                                    </div>
                                </div>

                                {/* Aportes / movimentos desta reserva */}
                                <Movimentos isDark={isDark} reserve={r} cdi={cdi}
                                    movimentos={txs.filter(t => t.jarId === r.id).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))} />
                            </div>
                        );
                    })}
                </div>
            )}

            <div className={`mt-6 rounded-2xl border px-4 py-3.5 flex items-center gap-3 text-[13px] ${isDark ? 'border-white/10 bg-white/[0.02] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <Info className="w-4 h-4 shrink-0 text-emerald-500" />
                Rende todo dia pelo CDI. Depositar move do saldo em conta para a reserva; resgatar traz de volta — e aparece no extrato.
            </div>

            {form && <ReservaForm isDark={isDark} uid={uid} cdi={cdi} editing={form.editing} onClose={() => setForm(null)} />}
            {move && <MoveForm isDark={isDark} uid={uid} cdi={cdi} reserve={move.reserve} kind={move.kind} onClose={() => setMove(null)} />}
        </div>
    );
}

function Mini({ isDark, label, value, cls }) {
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    return (
        <div>
            <p className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>{label}</p>
            <p className={`text-[15px] font-black tabular-nums whitespace-nowrap ${cls}`}>{value}</p>
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

// ── Form: nova/editar reserva (com CDI) ─────────────────────────────
export function ReservaForm({ isDark, uid, cdi, editing, onClose, skipLedger = false, hint }) {
    const [name, setName] = useState(editing?.name || 'Reserva de emergência');
    const [target, setTarget] = useState(editing?.target != null ? String(editing.target).replace('.', ',') : '');
    const [cdiPercent, setCdiPercent] = useState(String(editing?.cdiPercent || 100));
    const [balance, setBalance] = useState('');
    // Por padrão NÃO desconta do saldo (a pessoa já tem esse valor guardado).
    const [naoDescontar, setNaoDescontar] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const inputCls = `w-full px-3.5 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;
    const pct = Math.max(0, parseFloat(cdiPercent) || 0);
    const rendMes = (Math.pow(1 + dailyCalRate(cdi, pct), 30) - 1) * 100; // % ao mês aprox.

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!name.trim()) { setError('Dê um nome à reserva.'); return; }
        setSaving(true);
        try {
            if (editing) {
                await updateDoc(doc(db, 'savings_jars', editing.id), { name: normalizeName(name), target: numBR(target) || null, cdiPercent: pct || 100 });
            } else {
                const init = numBR(balance);
                const now = Date.now();
                const ref = await addDoc(collection(db, 'savings_jars'), {
                    name: normalizeName(name), target: numBR(target) || null, cdiPercent: pct || 100,
                    balance: init, invested: init, lastYieldAt: now, type: 'reserva', userId: uid, createdAt: now,
                });
                // Só debita a conta se o usuário DESMARCAR "não descontar"
                // (onboarding força skipLedger). Padrão: reserva já existente.
                if (init > 0 && !skipLedger && !naoDescontar) {
                    const iso = new Date(now).toISOString();
                    await addDoc(collection(db, 'transactions'), {
                        description: `Reserva: ${normalizeName(name)}`, amount: init, type: 'expense', category: 'vault',
                        date: iso, month: iso.slice(0, 7), userId: uid, createdAt: now, paymentMethod: 'pix', source: 'reserva', jarId: ref.id,
                    });
                }
            }
            onClose();
        } catch (err) { console.error(err); setError('Não foi possível salvar. Tente de novo.'); setSaving(false); }
    };

    return (
        <Modal isDark={isDark} title={editing ? 'Editar reserva' : 'Nova reserva'} icon={PiggyBank} iconCls="bg-pink-500/12 text-pink-400" onClose={onClose}>
            <form onSubmit={submit} className="space-y-3.5">
                <AliviaFormHint isDark={isDark} text={hint} />
                {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-2.5 rounded-xl text-[12px] text-center font-bold">{error}</div>}
                <Field label="Nome"><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Reserva de emergência" className={inputCls} maxLength={40} autoFocus /></Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Meta (R$) — opcional"><input inputMode="decimal" value={target} onChange={e => setTarget(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0,00" className={inputCls} /></Field>
                    <Field label="Rende (% do CDI)"><input inputMode="numeric" value={cdiPercent} onChange={e => setCdiPercent(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} placeholder="100" className={inputCls} /></Field>
                </div>
                <div className={`rounded-xl border px-3 py-2.5 text-[12px] flex items-center gap-2 ${isDark ? 'bg-white/[0.03] border-white/10 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                    <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
                    Rende ~<span className="font-bold text-emerald-500">{rendMes.toFixed(2)}% ao mês</span> ({pct || 0}% do CDI de {money(cdi)}%/ano).
                </div>
                {!editing && (
                    <Field label="Valor inicial (R$) — opcional"><input inputMode="decimal" value={balance} onChange={e => setBalance(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0,00" className={inputCls} /></Field>
                )}
                {!editing && !skipLedger && (
                    <label className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border cursor-pointer transition ${naoDescontar ? 'border-emerald-500/40 bg-emerald-500/10' : (isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50')}`}>
                        <input type="checkbox" checked={naoDescontar} onChange={e => setNaoDescontar(e.target.checked)} className="w-4 h-4 accent-emerald-500 mt-0.5" />
                        <div>
                            <p className={`text-[13px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Não descontar do meu saldo em conta</p>
                            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Marque se você <b>já tem</b> esse valor guardado. Desmarque só se estiver tirando agora da conta.</p>
                        </div>
                    </label>
                )}
                <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-70">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> {editing ? 'Salvar' : 'Criar reserva'}</>}
                </button>
            </form>
        </Modal>
    );
}

// ── Form: depositar / resgatar (consolida o rendimento antes) ───────
function MoveForm({ isDark, uid, cdi, reserve, kind, onClose }) {
    const isDep = kind === 'deposit';
    const curVal = currentValueOf(reserve, cdi);
    const [amount, setAmount] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    // No aporte, por padrão NÃO desconta do saldo (dinheiro que já estava guardado).
    const [naoDescontar, setNaoDescontar] = useState(true);
    const val = numBR(amount);
    const insufficient = !isDep && val > curVal + 0.005;

    const inputCls = `w-full pl-9 pr-3 py-3 rounded-xl border text-lg font-black outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 focus:border-emerald-500'}`;

    const confirmar = async () => {
        setError('');
        if (val <= 0) { setError('Informe um valor.'); return; }
        if (insufficient) { setError('Valor maior que o saldo da reserva.'); return; }
        setSaving(true);
        try {
            const now = Date.now();
            const iso = new Date(now).toISOString();
            const inv = investedOfRes(reserve);
            // Consolida o rendimento acumulado no saldo antes de mexer.
            const newBalance = isDep ? curVal + val : curVal - val;
            const newInvested = isDep ? inv + val : Math.max(0, inv - val);
            await updateDoc(doc(db, 'savings_jars', reserve.id), { balance: newBalance, invested: newInvested, lastYieldAt: now, cdiPercent: reserve.cdiPercent || 100 });
            // Aporte "não descontar" = dinheiro já guardado → só cresce a reserva,
            // sem lançar nada na conta. Caso contrário, registra a TRANSFERÊNCIA
            // (não é despesa; sai do saldo, aparece azul no extrato). Resgate sempre
            // volta pro saldo.
            const registrar = !isDep || !naoDescontar;
            if (registrar) {
                await addDoc(collection(db, 'transactions'), {
                    description: `${isDep ? 'Aporte' : 'Resgate'} reserva: ${reserve.name || 'Reserva'}`,
                    amount: val, type: isDep ? 'expense' : 'income',
                    category: isDep ? 'vault' : 'vault_redemption',
                    date: iso, month: iso.slice(0, 7), userId: uid, createdAt: now, paymentMethod: 'pix', source: 'reserva', jarId: reserve.id, isTransfer: true,
                });
            }
            onClose();
        } catch (err) { console.error(err); setError('Não foi possível concluir. Tente de novo.'); setSaving(false); }
    };

    return (
        <Modal isDark={isDark} title={isDep ? 'Depositar na reserva' : 'Resgatar da reserva'} icon={isDep ? ArrowDownToLine : ArrowUpFromLine} iconCls={isDep ? 'bg-emerald-500/12 text-emerald-500' : 'bg-amber-500/12 text-amber-500'} onClose={onClose}>
            <div className="space-y-4">
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {isDep
                        ? <>Guardar em <span className="font-black">{reserve.name}</span>{naoDescontar ? ' — não mexe no seu saldo em conta.' : ' — sai do seu saldo em conta (como transferência).'}</>
                        : <>Resgatar de <span className="font-black">{reserve.name}</span> — volta pro seu saldo em conta.</>}
                </p>
                <div>
                    <span className={`text-[11px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Valor</span>
                    <div className="relative mt-1">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>R$</span>
                        <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))} className={inputCls} autoFocus />
                    </div>
                </div>
                <div className={`rounded-xl p-3.5 border flex items-center justify-between ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                    <div><p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Reserva agora</p><p className="font-black tabular-nums text-emerald-500">R$ {money(curVal)}</p></div>
                    <div className="text-right"><p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Depois</p><p className={`font-black tabular-nums ${isDark ? 'text-white' : 'text-slate-800'}`}>R$ {money(isDep ? curVal + val : curVal - val)}</p></div>
                </div>
                {isDep && (
                    <label className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border cursor-pointer transition ${naoDescontar ? 'border-emerald-500/40 bg-emerald-500/10' : (isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50')}`}>
                        <input type="checkbox" checked={naoDescontar} onChange={e => setNaoDescontar(e.target.checked)} className="w-4 h-4 accent-emerald-500 mt-0.5" />
                        <div>
                            <p className={`text-[13px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Não descontar do meu saldo em conta</p>
                            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Marque se esse dinheiro <b>já estava guardado</b>. Desmarque só se estiver transferindo agora da conta (não é despesa; aparece azul no extrato).</p>
                        </div>
                    </label>
                )}
                {(error || insufficient) && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-2.5 rounded-xl text-[12px] font-bold text-center">{error || 'Valor maior que o saldo da reserva.'}</div>}
                <div className="grid grid-cols-2 gap-2.5">
                    <button onClick={onClose} className={`py-3 rounded-xl font-bold text-sm ${isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Cancelar</button>
                    <button onClick={confirmar} disabled={saving || insufficient} className={`py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 ${isDep ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> {isDep ? 'Depositar' : 'Resgatar'}</>}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

// ── Aportes / movimentos de uma reserva (ver, editar valor, excluir) ─
function Movimentos({ isDark, reserve, cdi, movimentos }) {
    const [open, setOpen] = useState(false);
    const [editId, setEditId] = useState(null);
    const [editVal, setEditVal] = useState('');
    const [busy, setBusy] = useState(false);
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';

    if (!movimentos.length) return null;

    // Consolida o rendimento atual e aplica um delta no principal da reserva.
    const adjustJar = async (delta) => {
        const now = Date.now();
        const cur = currentValueOf(reserve, cdi, now);
        const inv = investedOfRes(reserve);
        await updateDoc(doc(db, 'savings_jars', reserve.id), {
            balance: Math.max(0, cur + delta), invested: Math.max(0, inv + delta),
            lastYieldAt: now, cdiPercent: reserve.cdiPercent || 100,
        });
    };
    const del = async (t) => {
        setBusy(true);
        try {
            const amt = parseFloat(t.amount) || 0;
            await adjustJar(t.type === 'expense' ? -amt : amt); // aporte sai, resgate volta
            await deleteDoc(doc(db, 'transactions', t.id));
        } catch (e) { console.error(e); }
        setBusy(false);
    };
    const saveEdit = async (t) => {
        const newVal = numBR(editVal);
        if (newVal <= 0) { setEditId(null); return; }
        setBusy(true);
        try {
            const delta = newVal - (parseFloat(t.amount) || 0);
            await adjustJar(t.type === 'expense' ? delta : -delta);
            const iso = t.date || new Date().toISOString();
            await updateDoc(doc(db, 'transactions', t.id), { amount: newVal, month: iso.slice(0, 7) });
        } catch (e) { console.error(e); }
        setBusy(false); setEditId(null);
    };

    return (
        <div className={`mt-4 pt-3 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
            <button onClick={() => setOpen(o => !o)}
                className={`flex items-center gap-1.5 text-[12px] font-bold transition ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                {open ? 'Ocultar' : 'Ver'} aportes ({movimentos.length})
            </button>

            {open && (
                <div className={`mt-2 rounded-xl border divide-y overflow-hidden ${isDark ? 'border-white/10 divide-white/5' : 'border-slate-200 divide-slate-100'}`}>
                    {movimentos.map(t => {
                        const isAporte = t.type === 'expense';
                        const amt = parseFloat(t.amount) || 0;
                        const editing = editId === t.id;
                        const dateStr = t.date ? new Date(t.date).toLocaleDateString('pt-BR') : '';
                        return (
                            <div key={t.id} className={`flex items-center gap-3 px-3.5 py-2.5 text-[13px] ${isDark ? 'bg-white/[0.01]' : 'bg-white'}`}>
                                <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isAporte ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>
                                    {isAporte ? <ArrowDownToLine className="w-3.5 h-3.5" /> : <ArrowUpFromLine className="w-3.5 h-3.5" />}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className={`font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{isAporte ? 'Aporte' : 'Resgate'}</p>
                                    <p className={`text-[11px] ${muted}`}>{dateStr}</p>
                                </div>
                                {editing ? (
                                    <div className="flex items-center gap-1.5">
                                        <div className="relative">
                                            <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold ${muted}`}>R$</span>
                                            <input inputMode="decimal" value={editVal} onChange={e => setEditVal(e.target.value.replace(/[^0-9.,]/g, ''))}
                                                onKeyDown={e => e.key === 'Enter' && saveEdit(t)} autoFocus
                                                className={`w-28 pl-7 pr-2 py-1.5 rounded-lg border text-[13px] font-bold outline-none ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`} />
                                        </div>
                                        <button onClick={() => saveEdit(t)} disabled={busy} className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center disabled:opacity-50"><Check className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => setEditId(null)} className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                ) : (
                                    <>
                                        <span className={`font-black tabular-nums whitespace-nowrap ${isAporte ? 'text-emerald-500' : 'text-amber-500'}`}>{isAporte ? '+' : '−'} R$ {money(amt)}</span>
                                        <div className="flex items-center gap-0.5">
                                            <button onClick={() => { setEditId(t.id); setEditVal(String(amt).replace('.', ',')); }} title="Editar" className={`p-1.5 rounded-lg ${muted} ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}><Pencil className="w-3.5 h-3.5" /></button>
                                            <MovDeleteBtn isDark={isDark} onDelete={() => del(t)} />
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function MovDeleteBtn({ isDark, onDelete }) {
    const [confirm, setConfirm] = useState(false);
    if (confirm) return (
        <span className="flex items-center gap-1">
            <button onClick={() => setConfirm(false)} className={`px-1.5 py-1 rounded text-[10px] font-bold ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>Não</button>
            <button onClick={onDelete} className="px-1.5 py-1 rounded text-[10px] font-bold bg-rose-500 text-white">Excluir</button>
        </span>
    );
    return <button onClick={() => setConfirm(true)} title="Excluir" className={`p-1.5 rounded-lg text-slate-400 hover:text-rose-500 ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}><Trash2 className="w-3.5 h-3.5" /></button>;
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
