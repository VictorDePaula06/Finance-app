import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
    Landmark, Plus, Pencil, Trash2, X, AlertTriangle, CheckCircle2,
    TrendingDown, Wallet, Flame, Target, DollarSign, Sparkles
} from 'lucide-react';

const fmt = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseBR = (val) => {
    if (val === '' || val == null) return 0;
    let s = String(val).trim();
    if (s.includes(',') && s.includes('.')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
    if (s.includes(',')) return parseFloat(s.replace(',', '.')) || 0;
    return parseFloat(s) || 0;
};

export default function DebtManagementTab() {
    const { currentUser } = useAuth();
    const { theme } = useTheme();
    const isDark = theme !== 'light';

    const [debts, setDebts] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [payingDebt, setPayingDebt] = useState(null);
    const [payAmount, setPayAmount] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState({ name: '', originalAmount: '', remainingAmount: '', monthlyPayment: '', interestRate: '', dueDay: '' });

    useEffect(() => {
        if (!currentUser) return;
        const q = query(collection(db, 'debts'), where('userId', '==', currentUser.uid));
        const unsub = onSnapshot(q, (snap) => {
            setDebts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [currentUser]);

    const active = useMemo(() => debts.filter(d => !d.paidOff && (parseFloat(d.remainingAmount) || 0) > 0.005), [debts]);
    const paid = useMemo(() => debts.filter(d => d.paidOff || (parseFloat(d.remainingAmount) || 0) <= 0.005), [debts]);

    const totals = useMemo(() => {
        const remaining = active.reduce((s, d) => s + (parseFloat(d.remainingAmount) || 0), 0);
        const original = debts.reduce((s, d) => s + (parseFloat(d.originalAmount) || 0), 0);
        const monthly = active.reduce((s, d) => s + (parseFloat(d.monthlyPayment) || 0), 0);
        const totalPaid = Math.max(0, original - debts.reduce((s, d) => s + (parseFloat(d.remainingAmount) || 0), 0));
        const pct = original > 0 ? Math.min(100, (totalPaid / original) * 100) : 0;
        return { remaining, original, monthly, totalPaid, pct };
    }, [active, debts]);

    // Estratégia sugerida: dívida prioritária = maior juros (avalanche); na falta, a menor (bola de neve).
    const priority = useMemo(() => {
        if (active.length === 0) return null;
        const withRate = active.filter(d => (parseFloat(d.interestRate) || 0) > 0);
        if (withRate.length > 0) {
            return { ...[...withRate].sort((a, b) => (parseFloat(b.interestRate) || 0) - (parseFloat(a.interestRate) || 0))[0], _why: 'maior juro' };
        }
        return { ...[...active].sort((a, b) => (parseFloat(a.remainingAmount) || 0) - (parseFloat(b.remainingAmount) || 0))[0], _why: 'menor saldo' };
    }, [active]);

    const resetForm = () => { setForm({ name: '', originalAmount: '', remainingAmount: '', monthlyPayment: '', interestRate: '', dueDay: '' }); setEditingId(null); setShowForm(false); };

    const openNew = () => { resetForm(); setShowForm(true); };
    const openEdit = (d) => {
        setForm({
            name: d.name || '', originalAmount: String(d.originalAmount ?? ''), remainingAmount: String(d.remainingAmount ?? ''),
            monthlyPayment: String(d.monthlyPayment ?? ''), interestRate: String(d.interestRate ?? ''), dueDay: String(d.dueDay ?? ''),
        });
        setEditingId(d.id); setShowForm(true);
    };

    const handleSave = async (e) => {
        e?.preventDefault();
        if (!form.name || isSaving) return;
        const original = parseBR(form.originalAmount);
        const remaining = form.remainingAmount !== '' ? parseBR(form.remainingAmount) : original;
        setIsSaving(true);
        try {
            const data = {
                name: form.name.trim(),
                originalAmount: original,
                remainingAmount: Math.max(0, remaining),
                monthlyPayment: parseBR(form.monthlyPayment),
                interestRate: parseBR(form.interestRate),
                dueDay: parseInt(form.dueDay) || null,
                paidOff: remaining <= 0.005,
                updatedAt: new Date().toISOString(),
            };
            if (editingId) {
                await updateDoc(doc(db, 'debts', editingId), data);
            } else {
                await addDoc(collection(db, 'debts'), { ...data, userId: currentUser.uid, createdAt: new Date().toISOString() });
            }
            resetForm();
        } catch (err) { console.error('Erro ao salvar dívida:', err); }
        finally { setIsSaving(false); }
    };

    const handlePay = async () => {
        if (!payingDebt || isSaving) return;
        const val = parseBR(payAmount);
        if (val <= 0) return;
        setIsSaving(true);
        try {
            const current = parseFloat(payingDebt.remainingAmount) || 0;
            const newRemaining = Math.max(0, current - val);
            // Atualiza a dívida (quita se zerar). O pagamento fica registrado APENAS
            // no módulo de dívidas — não cria despesa nem debita o saldo do Controle
            // de Gastos (são módulos separados).
            await updateDoc(doc(db, 'debts', payingDebt.id), {
                remainingAmount: newRemaining,
                paidOff: newRemaining <= 0.005,
                updatedAt: new Date().toISOString(),
            });
            setPayingDebt(null); setPayAmount('');
        } catch (err) { console.error('Erro ao registrar pagamento:', err); }
        finally { setIsSaving(false); }
    };

    const handleDelete = async (id) => {
        try { await deleteDoc(doc(db, 'debts', id)); setDeleteConfirm(null); }
        catch (err) { console.error('Erro ao excluir dívida:', err); }
    };

    const card = 'pat-card';
    const inp = `w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-rose-500'}`;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Título */}
            <div className="text-center">
                <h2 className={`text-xl font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-800'}`}>Gerenciamento de Dívidas</h2>
                <p className="text-xs text-slate-500 mt-1">Organize, acompanhe e quite suas dívidas — o passo mais importante para sua saúde financeira.</p>
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`p-5 rounded-2xl border ${card}`}>
                    <div className="flex items-center gap-2 mb-2"><TrendingDown className="w-4 h-4 text-rose-400" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dívida em aberto</span></div>
                    <p className="text-2xl font-black text-rose-400">R$ {fmt(totals.remaining)}</p>
                    {totals.monthly > 0 && <p className="text-[10px] text-slate-500 mt-1">≈ R$ {fmt(totals.monthly)}/mês em parcelas</p>}
                </div>
                <div className={`p-5 rounded-2xl border ${card}`}>
                    <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Já quitado</span></div>
                    <p className="text-2xl font-black text-emerald-400">R$ {fmt(totals.totalPaid)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{totals.pct.toFixed(0)}% do total</p>
                </div>
                <div className={`p-5 rounded-2xl border ${card}`}>
                    <div className="flex items-center gap-2 mb-2"><Wallet className="w-4 h-4 text-blue-400" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dívidas ativas</span></div>
                    <p className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{active.length}</p>
                    {paid.length > 0 && <p className="text-[10px] text-slate-500 mt-1">{paid.length} já quitada{paid.length > 1 ? 's' : ''}</p>}
                </div>
            </div>

            {/* Estratégia sugerida */}
            {priority && (
                <div className={`p-4 rounded-2xl border flex items-start gap-3 ${isDark ? 'bg-rose-500/[0.06] border-rose-500/20' : 'bg-rose-50 border-rose-100'}`}>
                    <span className={`p-2 rounded-xl shrink-0 ${isDark ? 'bg-rose-500/10' : 'bg-rose-100'}`}><Flame className="w-5 h-5 text-rose-500" /></span>
                    <div className="min-w-0">
                        <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Comece por: {priority.name}</p>
                        <p className="text-[11px] text-slate-500 leading-snug">
                            Foque seus pagamentos extras nesta dívida primeiro ({priority._why}). Restam <b className="text-rose-400">R$ {fmt(priority.remainingAmount)}</b>. Quitar a prioritária acelera sua liberdade financeira.
                        </p>
                    </div>
                </div>
            )}

            {/* Card principal: lista + botão */}
            <div className={`p-6 md:p-8 rounded-2xl border ${card}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <h3 className={`text-base font-medium uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Minhas Dívidas</h3>
                    <button onClick={openNew} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(244,63,94,0.15)]">
                        <Plus className="w-4 h-4" /> Nova Dívida
                    </button>
                </div>

                {debts.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl">
                        <Landmark className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-400">Nenhuma dívida cadastrada.</p>
                        <p className="text-xs text-slate-500 mt-1">Cadastre suas dívidas para acompanhar e planejar a quitação.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {[...active, ...paid].map(d => {
                            const original = parseFloat(d.originalAmount) || 0;
                            const remaining = parseFloat(d.remainingAmount) || 0;
                            const paidVal = Math.max(0, original - remaining);
                            const pct = original > 0 ? Math.min(100, (paidVal / original) * 100) : (d.paidOff ? 100 : 0);
                            const isDone = d.paidOff || remaining <= 0.005;
                            return (
                                <div key={d.id} className={`p-4 rounded-xl border transition-all ${isDone ? (isDark ? 'bg-emerald-500/[0.05] border-emerald-500/20' : 'bg-emerald-50/50 border-emerald-100') : (isDark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200')}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDone ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'}`}>
                                                {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Landmark className="w-5 h-5" />}
                                            </span>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{d.name}</p>
                                                <p className="text-[11px] text-slate-500">
                                                    {isDone ? 'Quitada 🎉' : <>Restam <b className="text-rose-400">R$ {fmt(remaining)}</b> de R$ {fmt(original)}</>}
                                                    {!isDone && d.interestRate > 0 && <span className="text-slate-400"> · {fmt(d.interestRate)}% juros</span>}
                                                    {!isDone && d.dueDay && <span className="text-slate-400"> · vence dia {d.dueDay}</span>}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {!isDone && (
                                                <button onClick={() => { setPayingDebt(d); setPayAmount(String(d.monthlyPayment || '')); }} className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1">
                                                    <DollarSign className="w-3 h-3" /> Pagar
                                                </button>
                                            )}
                                            <button onClick={() => openEdit(d)} className={`p-2 rounded-lg transition-all ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><Pencil className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => setDeleteConfirm(d)} className={`p-2 rounded-lg transition-all ${isDark ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10' : 'text-slate-500 hover:text-rose-500 hover:bg-rose-50'}`}><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                    {/* Progresso */}
                                    <div className={`mt-3 w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                                        <div className={`h-full rounded-full transition-all duration-700 ${isDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-rose-500 to-orange-400'}`} style={{ width: `${Math.max(2, pct)}%` }} />
                                    </div>
                                    <p className="text-[9px] text-slate-500 mt-1 text-right">{pct.toFixed(0)}% pago</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal: Nova/Editar dívida */}
            {showForm && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) resetForm(); }}>
                    <div className={`w-full max-w-md rounded-2xl p-6 border relative animate-in zoom-in-95 duration-300 ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'} shadow-2xl`}>
                        <button onClick={resetForm} className={`absolute top-4 right-4 p-1.5 rounded-lg ${isDark ? 'hover:bg-white/10 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}><X className="w-4 h-4" /></button>
                        <div className="flex items-center gap-3 mb-5">
                            <div className={`p-2 rounded-xl ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}><Landmark className="w-5 h-5 text-rose-500" /></div>
                            <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{editingId ? 'Editar Dívida' : 'Nova Dívida'}</h3>
                        </div>
                        <form onSubmit={handleSave} className="space-y-3">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 block">Nome da dívida</label>
                                <input className={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Cartão Nubank, Empréstimo, Financiamento..." required />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 block">Valor total (R$)</label>
                                    <input className={inp} inputMode="decimal" value={form.originalAmount} onChange={e => setForm({ ...form, originalAmount: e.target.value })} placeholder="0,00" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 block">Saldo devedor (R$)</label>
                                    <input className={inp} inputMode="decimal" value={form.remainingAmount} onChange={e => setForm({ ...form, remainingAmount: e.target.value })} placeholder="quanto falta" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 block">Parcela/mês</label>
                                    <input className={inp} inputMode="decimal" value={form.monthlyPayment} onChange={e => setForm({ ...form, monthlyPayment: e.target.value })} placeholder="0,00" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 block">Juros %</label>
                                    <input className={inp} inputMode="decimal" value={form.interestRate} onChange={e => setForm({ ...form, interestRate: e.target.value })} placeholder="0" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 block">Vence dia</label>
                                    <input className={inp} inputMode="numeric" value={form.dueDay} onChange={e => setForm({ ...form, dueDay: e.target.value })} placeholder="10" />
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500">O saldo devedor é o quanto ainda falta pagar. Se deixar em branco, usamos o valor total.</p>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={resetForm} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider ${isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Cancelar</button>
                                <button type="submit" disabled={isSaving} className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50">{isSaving ? 'Salvando...' : 'Salvar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Registrar pagamento */}
            {payingDebt && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setPayingDebt(null); }}>
                    <div className={`w-full max-w-sm rounded-2xl p-6 border relative animate-in zoom-in-95 duration-300 ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'} shadow-2xl`}>
                        <button onClick={() => setPayingDebt(null)} className={`absolute top-4 right-4 p-1.5 rounded-lg ${isDark ? 'hover:bg-white/10 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}><X className="w-4 h-4" /></button>
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-xl ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}><DollarSign className="w-5 h-5 text-emerald-500" /></div>
                            <div>
                                <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Pagar dívida</h3>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{payingDebt.name}</p>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">Saldo devedor atual: <b className="text-rose-400">R$ {fmt(payingDebt.remainingAmount)}</b></p>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 block">Valor do pagamento (R$)</label>
                        <input className={inp} inputMode="decimal" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0,00" autoFocus />
                        <p className="text-[10px] text-slate-500 mt-2">Esse valor sai do seu saldo em carteira (registrado no Controle de Gastos).</p>
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setPayingDebt(null)} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider ${isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Cancelar</button>
                            <button onClick={handlePay} disabled={isSaving} className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50">{isSaving ? 'Registrando...' : 'Registrar pagamento'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Excluir */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}>
                    <div className={`w-full max-w-sm rounded-2xl p-6 border text-center animate-in zoom-in-95 duration-300 ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'} shadow-2xl`}>
                        <Trash2 className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                        <p className={`font-bold text-sm mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>Excluir "{deleteConfirm.name}"?</p>
                        <p className="text-xs text-slate-500 mb-5">A dívida será removida do seu acompanhamento.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className={`flex-1 py-2.5 rounded-xl font-bold text-xs ${isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Cancelar</button>
                            <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs">Excluir</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
