import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/LanguageContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { toast } from './ui/Toaster';
import ConfirmActionModal from './ConfirmActionModal';
import CardForm, { gradOf } from './CardForm';
import BankLogo, { detectBank } from './ui/BankLogo';
import { CreditCard, Plus, Pencil, Trash2 } from 'lucide-react';

// ── Cadastros: cartões de crédito ───────────────────────────────────
// Único lugar para cadastrar, editar e excluir cartões. "Meu cartão" só usa
// o que está aqui (fatura, compras, limite).

const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CardsRegistry({ isDark }) {
    const { t, fmtMoney: money } = useI18n();
    const { currentUser } = useAuth();
    const uid = currentUser?.uid;
    const [cards, setCards] = useState([]);
    const [form, setForm] = useState(null); // { editing }
    const [del, setDel] = useState(null);

    useEffect(() => {
        if (!uid) return;
        return onSnapshot(query(collection(db, 'cards'), where('userId', '==', uid)),
            (s) => setCards(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))), () => {});
    }, [uid]);

    // Exclui o cartão E, em cascata, assinaturas/parcelamentos e lançamentos da
    // fatura em aberto — mesma regra que "Meu cartão" usava, pra não deixar órfãos.
    const excluir = async (card) => {
        const [subs, txs] = await Promise.all([
            getDocs(query(collection(db, 'subscriptions'), where('userId', '==', uid))),
            getDocs(query(collection(db, 'transactions'), where('userId', '==', uid))),
        ]);
        await Promise.all([
            ...subs.docs.filter(d => d.data().cardId === card.id).map(d => deleteDoc(d.ref)),
            ...txs.docs.filter(d => d.data().selectedCardId === card.id && d.data().invoiceStatus === 'unpaid').map(d => deleteDoc(d.ref)),
        ]);
        await deleteDoc(doc(db, 'cards', card.id));
        toast.success(t('regc.deleted'));
    };

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';
    const th = `px-4 py-2.5 text-left text-[11px] font-black uppercase tracking-wider whitespace-nowrap ${muted}`;

    return (
        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]'}`}>
            <div className={`flex items-center justify-between gap-3 flex-wrap px-4 sm:px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                <div className="min-w-0">
                    <h2 className={`text-[15px] font-black tracking-tight flex items-center gap-2.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        <span className="w-7 h-7 rounded-lg bg-emerald-500/12 text-emerald-500 flex items-center justify-center shrink-0"><CreditCard className="w-4 h-4" /></span>
                        {t('reg.cards')}
                    </h2>
                    <p className={`text-[12px] mt-1 ${muted}`}>{t('reg.cardsDesc')}</p>
                </div>
                <button onClick={() => setForm({ editing: null })}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-bold shadow-md shadow-emerald-500/25 transition active:scale-95">
                    <Plus className="w-4 h-4" strokeWidth={3} /> {t('common.add')}
                </button>
            </div>

            {cards.length === 0 ? (
                <div className="py-12 text-center px-4">
                    <CreditCard className={`w-7 h-7 mx-auto mb-2.5 ${muted}`} />
                    <p className={`text-sm font-bold ${cell}`}>{t('reg.noCards')}</p>
                    <p className={`text-xs mt-1 ${muted}`}>{t('regc.noCardsDesc')}</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className={isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}>
                                <th className={th}>{t('regc.card')}</th>
                                <th className={`${th} hidden sm:table-cell`}>{t('regc.brand')}</th>
                                <th className={`${th} hidden md:table-cell`}>{t('regc.last4')}</th>
                                <th className={`${th} text-right`}>{t('regc.limit')}</th>
                                <th className={`${th} hidden md:table-cell`}>{t('regc.closeDue')}</th>
                                <th className={`${th} text-right`}>{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                            {cards.map(c => {
                                const bank = detectBank(c.bank, c.name);
                                return (
                                    <tr key={c.id} className={`transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/70'}`}>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                {/* Miniatura do cartão com a cor + logo do banco */}
                                                <span className={`relative w-12 h-8 rounded-md bg-gradient-to-br ${gradOf(c.color)} shrink-0 flex items-center justify-center`}>
                                                    <BankLogo bank={bank} className="w-5 h-5" rounded="rounded" />
                                                </span>
                                                <div className="min-w-0">
                                                    <p className={`font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{c.name || t('regc.card')}</p>
                                                    <p className={`text-[11px] truncate ${muted}`}>{bank?.label || c.bank || t('regc.noBank')}<span className="sm:hidden"> · {c.brand}</span></p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={`px-4 py-3 hidden sm:table-cell ${cell}`}>{c.brand || '—'}</td>
                                        <td className={`px-4 py-3 hidden md:table-cell tabular-nums ${cell}`}>{c.last4 ? `•••• ${c.last4}` : '—'}</td>
                                        <td className={`px-4 py-3 text-right font-black tabular-nums whitespace-nowrap ${isDark ? 'text-white' : 'text-slate-800'}`}>{c.limit ? `R$ ${money(c.limit)}` : <span className={`font-semibold ${muted}`}>—</span>}</td>
                                        <td className={`px-4 py-3 hidden md:table-cell whitespace-nowrap ${cell}`}>{t('reg.dueDayShort')} {c.closingDay || '—'} / <span className="font-bold">{c.dueDay || '—'}</span></td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-0.5">
                                                <button onClick={() => setForm({ editing: c })} title={t('common.edit')}
                                                    className={`p-2 rounded-lg transition ${muted} ${isDark ? 'hover:bg-white/5 hover:text-emerald-400' : 'hover:bg-slate-100 hover:text-emerald-600'}`}><Pencil className="w-4 h-4" /></button>
                                                <button onClick={() => setDel(c)} title={t('common.delete')}
                                                    className={`p-2 rounded-lg transition ${muted} ${isDark ? 'hover:bg-white/5 hover:text-rose-500' : 'hover:bg-slate-100 hover:text-rose-500'}`}><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {form && <CardForm isDark={isDark} uid={uid} editing={form.editing} onClose={() => setForm(null)} />}
            {del && (
                <ConfirmActionModal isDark={isDark} type="delete" name={del.name} noun={t('regc.card').toLowerCase()}
                    warning={t('regc.deleteWarn')}
                    onClose={() => setDel(null)} onConfirm={() => excluir(del)} />
            )}
        </div>
    );
}
