import React, { useState } from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import { db } from '../../services/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { purchaseTotal, itemTotal } from '../../utils/market';
import ConfirmActionModal from '../ConfirmActionModal';
import { toast } from '../ui/Toaster';
import { Vazio } from './ListaTab';
import { Plus, ChevronDown, Trash2, Store, CalendarDays } from 'lucide-react';

// ── Aba Compras ─────────────────────────────────────────────────────
// Lista do mais recente para o mais antigo. Abrir uma compra mostra o que
// foi levado: quantidade e quanto custou CADA produto — que é o ponto de
// lançar a nota.

export default function ComprasTab({ isDark, purchases, onNova }) {
    const { t, fmtMoney: money, fmtDate } = useI18n();
    const [aberta, setAberta] = useState(null);
    const [del, setDel] = useState(null);

    const ink = isDark ? 'text-white' : 'text-slate-800';
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const line = isDark ? 'border-white/[0.07]' : 'border-slate-200';

    return (
        <div className="max-w-3xl mx-auto w-full">
            <header className="mb-5 flex items-end justify-between gap-3 flex-wrap">
                <div>
                    <h1 className={`text-xl font-black tracking-tight ${ink}`}>{t('mkt.purchasesTitle')}</h1>
                    <p className={`text-[13px] mt-0.5 ${muted}`}>{t('mkt.purchasesSubtitle')}</p>
                </div>
                <button onClick={onNova}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-black transition active:scale-95">
                    <Plus className="w-4 h-4" strokeWidth={3} /> {t('mkt.newPurchase')}
                </button>
            </header>

            {purchases.length === 0 ? (
                <Vazio isDark={isDark} titulo={t('mkt.emptyPurchases')} texto={t('mkt.emptyPurchasesDesc')} />
            ) : (
                <div className="space-y-2.5">
                    {purchases.map(p => {
                        const total = purchaseTotal(p);
                        const n = (p.items || []).length;
                        const on = aberta === p.id;
                        return (
                            <article key={p.id} className={`rounded-2xl border overflow-hidden ${line} ${isDark ? 'bg-white/[0.02]' : 'bg-white'}`}>
                                <button onClick={() => setAberta(on ? null : p.id)} aria-expanded={on}
                                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                                    <span className="w-10 h-10 rounded-xl bg-emerald-500/12 text-emerald-500 flex items-center justify-center shrink-0">
                                        <Store className="w-5 h-5" strokeWidth={2.2} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className={`block text-[14px] font-black truncate ${ink}`}>
                                            {p.store || t('mkt.store')}
                                        </span>
                                        <span className={`flex items-center gap-1.5 text-[11.5px] mt-0.5 ${muted}`}>
                                            <CalendarDays className="w-3 h-3" />
                                            {fmtDate(p.date)} · {n} {t('mkt.products', { n })}
                                        </span>
                                    </span>
                                    <span className="text-[15px] font-black tabular-nums text-emerald-500 shrink-0">
                                        R$ {money(total)}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${on ? 'rotate-180' : ''} ${muted}`} />
                                </button>

                                {on && (
                                    <div className={`border-t ${line} animate-in fade-in duration-150`}>
                                        <table className="w-full">
                                            <thead>
                                                <tr className={`text-[10.5px] font-black uppercase tracking-wider ${muted}`}>
                                                    <th className="text-left px-4 py-2 font-black">{t('mkt.itemName')}</th>
                                                    <th className="text-right px-2 py-2 font-black">{t('mkt.qty')}</th>
                                                    <th className="text-right px-2 py-2 font-black hidden sm:table-cell">{t('mkt.unitPrice')}</th>
                                                    <th className="text-right px-4 py-2 font-black">{t('mkt.lineTotal')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(p.items || []).map((it, i) => (
                                                    <tr key={`${p.id}-${i}`} className={`border-t ${line}`}>
                                                        <td className={`px-4 py-2.5 text-[13px] font-semibold ${ink}`}>{it.name}</td>
                                                        <td className={`px-2 py-2.5 text-[12.5px] text-right tabular-nums whitespace-nowrap ${muted}`}>
                                                            {it.qty} {it.unit}
                                                        </td>
                                                        <td className={`px-2 py-2.5 text-[12.5px] text-right tabular-nums hidden sm:table-cell ${muted}`}>
                                                            R$ {money(it.unitPrice)}
                                                        </td>
                                                        <td className={`px-4 py-2.5 text-[13px] text-right font-bold tabular-nums ${ink}`}>
                                                            R$ {money(itemTotal(it))}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className={`px-4 py-2.5 border-t ${line} flex justify-end`}>
                                            <button onClick={() => setDel(p)}
                                                className={`inline-flex items-center gap-1.5 text-[11.5px] font-bold transition ${muted} hover:text-rose-500`}>
                                                <Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}

            {del && (
                <ConfirmActionModal isDark={isDark} type="delete"
                    name={del.store || t('mkt.store')} noun="compra"
                    onClose={() => setDel(null)}
                    onConfirm={async () => {
                        await deleteDoc(doc(db, 'market_purchases', del.id));
                        toast.success(t('mkt.deleted'));
                    }} />
            )}
        </div>
    );
}
