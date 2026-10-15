import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import { db } from '../../services/firebase';
import { collection, addDoc, doc, writeBatch } from 'firebase/firestore';
import { purchaseTotal } from '../../utils/market';
import { planejaLista } from '../../utils/listaDaCompra';
import { toast } from '../ui/Toaster';
import { X, Receipt, PencilLine, ChevronRight, Loader2, Store, Tag } from 'lucide-react';

// ── Nova lista ──────────────────────────────────────────────────────
// Uma lista tem nome, porque é assim que ela vai ser encontrada depois —
// "Compra do mês", "Feira", "Churrasco de sábado".
//
// Depois do nome, dois caminhos: puxar de uma compra já lançada, ou
// começar vazia e escrever. O primeiro é o que a maioria quer na maioria
// das vezes: a compra do mês passado JÁ é a lista, é literalmente o que
// entrou em casa. Por isso ele vem primeiro e mostra as compras de cara,
// sem mais um clique.

export default function NovaListaSheet({ isDark, uid, purchases, apelidos, onAberta, onClose }) {
    const { t, fmtMoney: money, fmtDate, fmtMonth } = useI18n();
    const [busy, setBusy] = useState(false);

    // Nome sugerido: o mês corrente. É o que a lista é, quase sempre — e
    // um campo já preenchido é um campo a menos para encarar.
    const [nome, setNome] = useState(() => {
        const mk = new Date().toISOString().slice(0, 7);
        try { return fmtMonth(mk); } catch { return mk; }
    });

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

    const criarLista = async () => {
        const ref = await addDoc(collection(db, 'market_lists'), {
            userId: uid, name: nome.trim() || t('mkt.defaultListName'), createdAt: Date.now(),
        });
        return ref.id;
    };

    const importar = async (compra) => {
        if (busy || !nome.trim()) return;
        setBusy(true);
        try {
            // Lista nova nasce vazia, então só há o que criar. A junção
            // continua valendo DENTRO da compra: o mesmo produto em duas
            // linhas do cupom vira uma linha só na lista.
            const { criar } = planejaLista(compra.items, [], apelidos?.mapa);
            const listId = await criarLista();

            const b = writeBatch(db);
            const agora = Date.now();
            criar.forEach((item, i) => b.set(doc(collection(db, 'market_items')), {
                userId: uid, listId, name: item.name, qty: item.qty, unit: item.unit,
                // Desmarcado: a lista serve para a PRÓXIMA ida ao mercado.
                done: false, createdAt: agora + i, fromPurchase: true,
            }));
            await b.commit();

            toast.success(t('mkt.listSeeded', { n: criar.length }));
            onClose();
            onAberta?.(listId);
        } catch (e) {
            console.error('[mercado] importar compra:', e);
            toast.error(t('mkt.listSeedFail'));
            setBusy(false);
        }
    };

    const vazia = async () => {
        if (busy || !nome.trim()) return;
        setBusy(true);
        try {
            const listId = await criarLista();
            onClose();
            onAberta?.(listId);          // já abre em edição, para escrever
        } catch (e) {
            console.error('[mercado] criar lista:', e);
            toast.error(t('mkt.listSeedFail'));
            setBusy(false);
        }
    };

    const inputCls = `w-full px-3.5 py-3 rounded-xl border text-[15px] outline-none transition focus:border-emerald-500 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`;

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
                    <label htmlFor="mkt-lista-nome" className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider mb-1.5 ${muted}`}>
                        <Tag className="w-3.5 h-3.5" /> {t('mkt.listName')}
                    </label>
                    <input id="mkt-lista-nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)}
                        placeholder={t('mkt.listNamePlaceholder')} className={inputCls} />

                    <div className={`my-4 border-t ${line}`} />

                    <p className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider mb-1.5 ${muted}`}>
                        <Receipt className="w-3.5 h-3.5" /> {t('mkt.fromPurchase')}
                    </p>
                    <p className={`text-[12px] mb-2.5 leading-relaxed ${muted}`}>{t('mkt.fromPurchaseHint')}</p>

                    {disponiveis.length === 0 ? (
                        <p className={`text-[12.5px] py-3 text-center ${muted}`}>{t('mkt.noPurchasesYet')}</p>
                    ) : (
                        <ul className={`rounded-xl border overflow-hidden ${line}`}>
                            {disponiveis.map((p, idx) => (
                                <li key={p.id} className={idx ? `border-t ${line}` : ''}>
                                    <button onClick={() => importar(p)} disabled={busy || !nome.trim()}
                                        className={`w-full text-left px-3.5 py-3 min-h-[60px] flex items-center gap-3 transition disabled:opacity-40 ${isDark ? 'active:bg-white/[0.05]' : 'active:bg-slate-100'}`}>
                                        <span className="min-w-0 flex-1">
                                            <span className={`flex items-center gap-1.5 text-[13.5px] font-bold truncate ${ink}`}>
                                                <Store className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                                                {p.store || t('mkt.noStore')}
                                                {/* A marcada como "a compra do mês" é quase sempre
                                                    a que se quer importar. */}
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
                    )}

                    <div className={`my-4 border-t ${line}`} />

                    <button onClick={vazia} disabled={busy || !nome.trim()}
                        className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition disabled:opacity-40 ${line} ${isDark ? 'hover:border-emerald-500/40 hover:bg-white/[0.03]' : 'hover:border-emerald-500/50 hover:bg-emerald-50/40'}`}>
                        <span className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                            <PencilLine className="w-[18px] h-[18px]" strokeWidth={2.2} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className={`block text-[13.5px] font-black ${ink}`}>{t('mkt.startEmpty')}</span>
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
