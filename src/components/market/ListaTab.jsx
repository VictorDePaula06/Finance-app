import React, { useState, useMemo } from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import { db } from '../../services/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { UNITS } from '../../utils/market';
import { Plus, Check, Trash2, ShoppingCart, ListChecks, Eraser } from 'lucide-react';

// ── Aba Lista ───────────────────────────────────────────────────────
// A lista existe para ser usada DENTRO do mercado: toque grande, o que
// falta sempre no topo e o que já foi para o carrinho sai da frente.
// Marcar é um toque e grava na hora — nada de "salvar" no corredor.

export default function ListaTab({ isDark, uid, items }) {
    const { t } = useI18n();
    const [name, setName] = useState('');
    const [qty, setQty] = useState('1');
    const [unit, setUnit] = useState('un');
    const [busy, setBusy] = useState(false);

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const ink = isDark ? 'text-white' : 'text-slate-800';
    const line = isDark ? 'border-white/[0.07]' : 'border-slate-200';
    const inputCls = `px-3 py-2.5 rounded-xl border text-[14px] outline-none transition focus:border-emerald-500 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`;

    const faltando = useMemo(() => items.filter(i => !i.done), [items]);
    const noCarrinho = useMemo(() => items.filter(i => i.done), [items]);

    const adicionar = async (e) => {
        e?.preventDefault();
        const nome = name.trim();
        if (!nome || !uid || busy) return;
        setBusy(true);
        try {
            await addDoc(collection(db, 'market_items'), {
                userId: uid, name: nome,
                qty: parseFloat(String(qty).replace(',', '.')) || 1,
                unit, done: false, createdAt: Date.now(),
            });
            setName(''); setQty('1');
        } catch (err) { console.error(err); }
        setBusy(false);
    };

    const alternar = async (item) => {
        try { await updateDoc(doc(db, 'market_items', item.id), { done: !item.done }); }
        catch (err) { console.error(err); }
    };
    const remover = async (id) => {
        try { await deleteDoc(doc(db, 'market_items', id)); } catch (err) { console.error(err); }
    };
    const limpar = async (lista) => {
        if (!lista.length) return;
        try {
            const b = writeBatch(db);
            lista.forEach(i => b.delete(doc(db, 'market_items', i.id)));
            await b.commit();
        } catch (err) { console.error(err); }
    };

    return (
        <div className="max-w-3xl mx-auto w-full">
            <header className="mb-5">
                <h1 className={`text-xl font-black tracking-tight ${ink}`}>{t('mkt.listTitle')}</h1>
                <p className={`text-[13px] mt-0.5 ${muted}`}>{t('mkt.listSubtitle')}</p>
            </header>

            {/* Adicionar — fica no topo, para montar a lista em casa. */}
            <form onSubmit={adicionar} className="flex items-end gap-2 flex-wrap mb-6">
                <div className="flex-1 min-w-[150px]">
                    <label htmlFor="mkt-nome" className={`block text-[11px] font-black uppercase tracking-wider mb-1 ${muted}`}>{t('mkt.itemName')}</label>
                    <input id="mkt-nome" value={name} onChange={(e) => setName(e.target.value)}
                        placeholder={t('mkt.itemNamePlaceholder')} className={`w-full ${inputCls}`} />
                </div>
                <div className="w-20">
                    <label htmlFor="mkt-qtd" className={`block text-[11px] font-black uppercase tracking-wider mb-1 ${muted}`}>{t('mkt.qty')}</label>
                    <input id="mkt-qtd" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.,]/g, ''))}
                        className={`w-full ${inputCls}`} />
                </div>
                <div className="w-24">
                    <label htmlFor="mkt-un" className={`block text-[11px] font-black uppercase tracking-wider mb-1 ${muted}`}>{t('mkt.unit')}</label>
                    <select id="mkt-un" value={unit} onChange={(e) => setUnit(e.target.value)}
                        className={`w-full ${inputCls}`} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                </div>
                <button type="submit" disabled={!name.trim() || busy}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-[13px] font-black transition active:scale-95 inline-flex items-center gap-1.5">
                    <Plus className="w-4 h-4" strokeWidth={3} /> {t('mkt.addItem')}
                </button>
            </form>

            {/* Faltando */}
            <section className="mb-7">
                <div className="flex items-center gap-2 mb-2.5">
                    <ListChecks className="w-4 h-4 text-rose-500" />
                    <h2 className={`text-[13px] font-black uppercase tracking-wider ${ink}`}>{t('mkt.pending')}</h2>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>{faltando.length}</span>
                </div>

                {faltando.length === 0 ? (
                    <Vazio isDark={isDark}
                        titulo={items.length ? t('mkt.allDone') : t('mkt.emptyList')}
                        texto={items.length ? t('mkt.allDoneDesc') : t('mkt.emptyListDesc')} />
                ) : (
                    <ul className={`rounded-2xl border overflow-hidden ${line}`}>
                        {faltando.map((i, idx) => (
                            <Linha key={i.id} item={i} isDark={isDark} primeira={idx === 0}
                                onToggle={() => alternar(i)} onRemove={() => remover(i.id)} />
                        ))}
                    </ul>
                )}
            </section>

            {/* No carrinho */}
            {noCarrinho.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-2.5">
                        <ShoppingCart className="w-4 h-4 text-emerald-500" />
                        <h2 className={`text-[13px] font-black uppercase tracking-wider ${ink}`}>{t('mkt.inCart')}</h2>
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>{noCarrinho.length}</span>
                        <button onClick={() => limpar(noCarrinho)}
                            className={`ml-auto inline-flex items-center gap-1.5 text-[11.5px] font-bold transition ${muted} hover:text-rose-500`}>
                            <Eraser className="w-3.5 h-3.5" /> {t('mkt.clearDone')}
                        </button>
                    </div>
                    <ul className={`rounded-2xl border overflow-hidden ${line}`}>
                        {noCarrinho.map((i, idx) => (
                            <Linha key={i.id} item={i} isDark={isDark} primeira={idx === 0}
                                onToggle={() => alternar(i)} onRemove={() => remover(i.id)} />
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}

// Linha da lista. A área de toque é a linha inteira: no mercado, com o
// carrinho na outra mão, acertar um quadradinho pequeno é sofrimento.
function Linha({ item, isDark, primeira, onToggle, onRemove }) {
    const { t } = useI18n();
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    return (
        <li className={`${primeira ? '' : `border-t ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}`}>
            <div className={`group flex items-center gap-3 px-3 ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                <button onClick={onToggle} aria-pressed={item.done}
                    className="flex-1 flex items-center gap-3 py-3.5 text-left min-w-0">
                    <span className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition ${item.done
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : (isDark ? 'border-white/25' : 'border-slate-300')}`}>
                        {item.done && <Check className="w-4 h-4" strokeWidth={3.5} />}
                    </span>
                    <span className={`text-[14.5px] font-bold truncate ${item.done
                        ? `line-through ${muted}`
                        : (isDark ? 'text-white' : 'text-slate-800')}`}>
                        {item.name}
                    </span>
                    <span className={`text-[12px] font-bold tabular-nums shrink-0 ml-auto ${muted}`}>
                        {item.qty} {item.unit}
                    </span>
                </button>
                <button onClick={onRemove} title={t('common.delete')}
                    className={`p-2 rounded-lg shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition ${muted} hover:text-rose-500`}>
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </li>
    );
}

export function Vazio({ isDark, titulo, texto, children }) {
    return (
        <div className={`rounded-2xl border border-dashed px-6 py-10 text-center ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <p className={`text-[14px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{titulo}</p>
            <p className={`text-[12.5px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{texto}</p>
            {children}
        </div>
    );
}
