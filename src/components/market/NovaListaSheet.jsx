import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import { db } from '../../services/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { purchaseTotal } from '../../utils/market';
import { planejaLista } from '../../utils/listaDaCompra';
import { toast } from '../ui/Toaster';
import { X, Receipt, PencilLine, ChevronRight, Loader2, Check, Store, Eraser } from 'lucide-react';

// ── Nova lista ──────────────────────────────────────────────────────
// Montar a lista do mês digitando item por item é o trabalho mais chato
// desta tela — e desnecessário, porque a compra do mês passado JÁ é a
// lista: é literalmente o que entrou em casa.
//
// Então aqui são dois caminhos: puxar de uma compra lançada, ou escrever à
// mão. O primeiro é o que a maioria quer na maioria das vezes, e por isso
// vem primeiro e mostra as compras de cara, sem mais um clique.
//
// A junção de produtos repetidos é a mesma do resto do mercado
// (src/utils/listaDaCompra.js): o que já está na lista soma em vez de
// virar linha duplicada.

export default function NovaListaSheet({ isDark, uid, items, purchases, apelidos, onManual, onClose }) {
    const { t, fmtMoney: money, fmtDate } = useI18n();
    const [busy, setBusy] = useState(false);
    const [limpar, setLimpar] = useState(false);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const ink = isDark ? 'text-white' : 'text-slate-800';
    const line = isDark ? 'border-white/[0.07]' : 'border-slate-200';

    // As mais recentes primeiro, e só as que têm produtos — importar uma
    // compra sem itens não produziria lista nenhuma.
    const disponiveis = useMemo(() => (purchases || [])
        .filter(p => p.items?.length)
        .slice(0, 12), [purchases]);

    const importar = async (compra) => {
        if (busy) return;
        setBusy(true);
        try {
            const base = limpar ? [] : (items || []);
            const { criar, somar } = planejaLista(compra.items, base, apelidos?.mapa);

            const b = writeBatch(db);
            // Limpar é escolha explícita de quem clicou, nunca o padrão:
            // apagar a lista de alguém sem pedir é o tipo de atalho que
            // custa caro uma vez e nunca mais é perdoado.
            if (limpar) (items || []).forEach(i => b.delete(doc(db, 'market_items', i.id)));

            const agora = Date.now();
            criar.forEach((item, i) => b.set(doc(collection(db, 'market_items')), {
                userId: uid, name: item.name, qty: item.qty, unit: item.unit,
                done: false, createdAt: agora + i, fromPurchase: true,
            }));
            somar.forEach(({ id, qty }) => b.update(doc(db, 'market_items', id), { qty }));
            await b.commit();

            toast.success(t('mkt.listSeeded', { n: criar.length + somar.length }));
            onClose();
        } catch (e) {
            console.error('[mercado] importar compra:', e);
            toast.error(t('mkt.listSeedFail'));
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl border ${line} ${isDark ? 'bg-[#0b110e]' : 'bg-white'} max-h-[88vh] flex flex-col`}>
                <header className={`flex items-center gap-3 px-4 py-3 border-b ${line} shrink-0`}>
                    <h3 className={`text-[15px] font-black ${ink}`}>{t('mkt.newList')}</h3>
                    <button onClick={onClose} aria-label={t('common.close')}
                        className={`ml-auto p-2 -mr-1 rounded-xl transition ${muted} hover:text-rose-500 active:scale-90`}>
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <div className="overflow-y-auto px-4 py-4">
                    <p className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider mb-1.5 ${muted}`}>
                        <Receipt className="w-3.5 h-3.5" /> {t('mkt.fromPurchase')}
                    </p>
                    <p className={`text-[12px] mb-2.5 leading-relaxed ${muted}`}>{t('mkt.fromPurchaseHint')}</p>

                    {disponiveis.length === 0 ? (
                        <p className={`text-[12.5px] py-4 text-center ${muted}`}>{t('mkt.noPurchasesYet')}</p>
                    ) : (
                        <>
                            <ul className={`rounded-xl border overflow-hidden ${line}`}>
                                {disponiveis.map((p, idx) => (
                                    <li key={p.id} className={idx ? `border-t ${line}` : ''}>
                                        <button onClick={() => importar(p)} disabled={busy}
                                            className={`w-full text-left px-3.5 py-3 min-h-[60px] flex items-center gap-3 transition disabled:opacity-40 ${isDark ? 'active:bg-white/[0.05]' : 'active:bg-slate-100'}`}>
                                            <span className="min-w-0 flex-1">
                                                <span className={`flex items-center gap-1.5 text-[13.5px] font-bold truncate ${ink}`}>
                                                    <Store className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                                                    {p.store || t('mkt.noStore')}
                                                    {/* A que foi marcada como "a compra do mês" é quase
                                                        sempre a que se quer importar. */}
                                                    {p.monthly && (
                                                        <span className="shrink-0 text-[9.5px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500 text-white uppercase tracking-wide">
                                                            {t('mkt.monthlyTag')}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className={`block text-[11.5px] mt-0.5 ${muted}`}>
                                                    {fmtDate(p.date)} · {p.items.length} {t('mkt.products', { n: p.items.length })} · R$ {money(purchaseTotal(p))}
                                                </span>
                                            </span>
                                            <ChevronRight className={`w-4 h-4 shrink-0 ${muted}`} />
                                        </button>
                                    </li>
                                ))}
                            </ul>

                            {items?.length > 0 && (
                                <label className={`mt-2.5 flex items-start gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition ${limpar
                                    ? (isDark ? 'border-rose-500/40 bg-rose-500/[0.07]' : 'border-rose-200 bg-rose-50')
                                    : line}`}>
                                    <input type="checkbox" checked={limpar} onChange={(e) => setLimpar(e.target.checked)} className="sr-only" />
                                    <span className={`mt-px w-[17px] h-[17px] rounded-md border-2 flex items-center justify-center shrink-0 transition ${limpar
                                        ? 'bg-rose-500 border-rose-500'
                                        : (isDark ? 'border-white/25' : 'border-slate-300')}`}>
                                        {limpar && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}
                                    </span>
                                    <span className="min-w-0">
                                        <span className={`flex items-center gap-1.5 text-[12.5px] font-bold ${limpar ? 'text-rose-500' : ink}`}>
                                            <Eraser className="w-3.5 h-3.5 shrink-0" />
                                            {t('mkt.clearBefore', { n: items.length })}
                                        </span>
                                        <span className={`block text-[11px] mt-0.5 leading-snug ${muted}`}>{t('mkt.clearBeforeHint')}</span>
                                    </span>
                                </label>
                            )}
                        </>
                    )}

                    <div className={`my-4 border-t ${line}`} />

                    <button onClick={() => { onClose(); onManual(); }} disabled={busy}
                        className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition disabled:opacity-40 ${line} ${isDark ? 'hover:border-emerald-500/40 hover:bg-white/[0.03]' : 'hover:border-emerald-500/50 hover:bg-emerald-50/40'}`}>
                        <span className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                            <PencilLine className="w-[18px] h-[18px]" strokeWidth={2.2} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className={`block text-[13.5px] font-black ${ink}`}>{t('mkt.byManual')}</span>
                            <span className={`block text-[11.5px] ${muted}`}>{t('mkt.newListManualHint')}</span>
                        </span>
                        <ChevronRight className={`w-4 h-4 shrink-0 ${muted}`} />
                    </button>
                </div>

                {busy && (
                    <div className={`absolute inset-0 flex items-center justify-center ${isDark ? 'bg-[#0b110e]/70' : 'bg-white/70'}`}>
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                    </div>
                )}
            </div>
        </div>
    );
}
