import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import { db } from '../../services/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { UNITS } from '../../utils/market';
import { Plus, Check, Trash2, ShoppingCart, X, Eraser } from 'lucide-react';

// ── Aba Lista ───────────────────────────────────────────────────────
// O uso real é EM PÉ, no corredor, com uma mão e o carrinho na outra. Então:
//
//  · a linha inteira é o alvo de toque, com altura de dedo (não de mouse);
//  · o que falta fica em cima, o que já foi para o carrinho desce;
//  · nada depende de hover — em tela de toque não existe hover, e o botão de
//    apagar escondido atrás dele simplesmente não existiria no celular;
//  · o formulário de adicionar sai da frente: vira uma folha que sobe pelo
//    botão flutuante, porque no mercado se MARCA, não se cadastra.

export default function ListaTab({ isDark, uid, items }) {
    const { t } = useI18n();
    const [addOpen, setAddOpen] = useState(false);

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const ink = isDark ? 'text-white' : 'text-slate-800';
    const line = isDark ? 'border-white/[0.07]' : 'border-slate-200';

    const faltando = useMemo(() => items.filter(i => !i.done), [items]);
    const noCarrinho = useMemo(() => items.filter(i => i.done), [items]);
    const pct = items.length ? (noCarrinho.length / items.length) * 100 : 0;

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
            {/* Barra de progresso — a pergunta do corredor é "quanto falta?". */}
            <header className="mb-4">
                <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className={`text-[19px] sm:text-xl font-black tracking-tight ${ink}`}>{t('mkt.listTitle')}</h1>
                        <p className={`text-[12.5px] mt-0.5 ${muted}`}>
                            {items.length
                                ? `${noCarrinho.length}/${items.length} ${t('mkt.inCart').toLowerCase()}`
                                : t('mkt.listSubtitle')}
                        </p>
                    </div>
                    {/* No desktop o botão fica aqui; no celular vira o flutuante. */}
                    <button onClick={() => setAddOpen(true)}
                        className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-black transition active:scale-95 shrink-0">
                        <Plus className="w-4 h-4" strokeWidth={3} /> {t('mkt.addItem')}
                    </button>
                </div>

                {items.length > 0 && (
                    <div className={`mt-3 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                        <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                )}
            </header>

            {/* Faltando */}
            {faltando.length === 0 ? (
                <Vazio isDark={isDark}
                    titulo={items.length ? t('mkt.allDone') : t('mkt.emptyList')}
                    texto={items.length ? t('mkt.allDoneDesc') : t('mkt.emptyListDesc')} />
            ) : (
                <ul className={`rounded-2xl border overflow-hidden ${line} ${isDark ? 'bg-white/[0.02]' : 'bg-white'}`}>
                    {faltando.map((i, idx) => (
                        <Linha key={i.id} item={i} isDark={isDark} primeira={idx === 0}
                            onToggle={() => alternar(i)} onRemove={() => remover(i.id)} />
                    ))}
                </ul>
            )}

            {/* No carrinho */}
            {noCarrinho.length > 0 && (
                <section className="mt-6">
                    <div className="flex items-center gap-2 mb-2.5 px-1">
                        <ShoppingCart className="w-4 h-4 text-emerald-500 shrink-0" />
                        <h2 className={`text-[12.5px] font-black uppercase tracking-wider ${ink}`}>{t('mkt.inCart')}</h2>
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>{noCarrinho.length}</span>
                        <button onClick={() => limpar(noCarrinho)}
                            className={`ml-auto inline-flex items-center gap-1.5 px-2.5 py-2 -mr-1 rounded-lg text-[12px] font-bold transition ${muted} hover:text-rose-500 active:scale-95`}>
                            <Eraser className="w-4 h-4" /> {t('mkt.clearDone')}
                        </button>
                    </div>
                    <ul className={`rounded-2xl border overflow-hidden ${line} ${isDark ? 'bg-white/[0.02]' : 'bg-white'}`}>
                        {noCarrinho.map((i, idx) => (
                            <Linha key={i.id} item={i} isDark={isDark} primeira={idx === 0}
                                onToggle={() => alternar(i)} onRemove={() => remover(i.id)} />
                        ))}
                    </ul>
                </section>
            )}

            {/* Botão flutuante (celular) — fica acima da barra de abas de baixo. */}
            <button onClick={() => setAddOpen(true)} aria-label={t('mkt.addItem')}
                className="sm:hidden fixed right-4 z-30 w-14 h-14 rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center active:scale-95 transition"
                style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 74px)' }}>
                <Plus className="w-6 h-6" strokeWidth={3} />
            </button>

            {addOpen && <AddSheet isDark={isDark} uid={uid} onClose={() => setAddOpen(false)} />}
        </div>
    );
}

// ── Linha ───────────────────────────────────────────────────────────
// Altura de dedo e nada escondido atrás de hover.
function Linha({ item, isDark, primeira, onToggle, onRemove }) {
    const { t } = useI18n();
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    return (
        <li className={primeira ? '' : `border-t ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}>
            <div className={`flex items-center ${isDark ? 'active:bg-white/[0.05]' : 'active:bg-slate-100'}`}>
                <button onClick={onToggle} aria-pressed={item.done}
                    className="flex-1 flex items-center gap-3 pl-3 pr-2 py-3.5 min-h-[58px] text-left min-w-0">
                    <span className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition ${item.done
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : (isDark ? 'border-white/25' : 'border-slate-300')}`}>
                        {item.done && <Check className="w-4.5 h-4.5" strokeWidth={3.5} />}
                    </span>
                    <span className={`text-[15.5px] font-bold truncate ${item.done
                        ? `line-through ${muted}`
                        : (isDark ? 'text-white' : 'text-slate-800')}`}>
                        {item.name}
                    </span>
                    <span className={`ml-auto text-[13px] font-bold tabular-nums shrink-0 px-2 py-0.5 rounded-md ${isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                        {item.qty} {item.unit}
                    </span>
                </button>
                {/* Sempre visível: em tela de toque não há hover. */}
                <button onClick={onRemove} aria-label={`${t('common.delete')} ${item.name}`}
                    className={`p-3 mr-1 rounded-xl shrink-0 transition active:scale-90 ${muted} hover:text-rose-500 active:text-rose-500`}>
                    <Trash2 className="w-[18px] h-[18px]" />
                </button>
            </div>
        </li>
    );
}

// ── Folha de adicionar ──────────────────────────────────────────────
// Sobe de baixo no celular (perto do polegar) e fica centralizada no
// desktop. Continua aberta depois de adicionar: montar a lista é uma
// sequência de itens, não um item só.
function AddSheet({ isDark, uid, onClose }) {
    const { t } = useI18n();
    const [name, setName] = useState('');
    const [qty, setQty] = useState('1');
    const [unit, setUnit] = useState('un');
    const [busy, setBusy] = useState(false);
    const [ultimos, setUltimos] = useState([]);
    const nomeRef = useRef(null);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const inputCls = `w-full px-3.5 py-3 rounded-xl border text-[15px] outline-none transition focus:border-emerald-500 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`;
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const ink = isDark ? 'text-white' : 'text-slate-800';

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
            setUltimos(l => [nome, ...l].slice(0, 4));
            setName(''); setQty('1');
            nomeRef.current?.focus();          // próximo item, sem tirar a mão
        } catch (err) { console.error(err); }
        setBusy(false);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center animate-in fade-in duration-150"
            role="dialog" aria-modal="true" aria-label={t('mkt.addItem')}>
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />

            <div className={`relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 ${isDark ? 'bg-[#131722] border-white/10' : 'bg-white border-slate-200'}`}
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                {/* Alça da folha (celular) */}
                <div className="sm:hidden flex justify-center pt-2.5 pb-1">
                    <span className={`w-10 h-1 rounded-full ${isDark ? 'bg-white/20' : 'bg-slate-300'}`} />
                </div>

                <div className="flex items-center justify-between px-5 pt-2 sm:pt-4 pb-1">
                    <h2 className={`text-[16px] font-black tracking-tight ${ink}`}>{t('mkt.addItem')}</h2>
                    <button onClick={onClose} aria-label={t('common.close')}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.07]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                        <X className="w-5 h-5" strokeWidth={2.4} />
                    </button>
                </div>

                <form onSubmit={adicionar} className="px-5 pt-2 pb-5">
                    <label htmlFor="mkt-nome" className={`block text-[11px] font-black uppercase tracking-wider mb-1.5 ${muted}`}>{t('mkt.itemName')}</label>
                    <input id="mkt-nome" ref={nomeRef} autoFocus value={name} onChange={(e) => setName(e.target.value)}
                        placeholder={t('mkt.itemNamePlaceholder')} enterKeyHint="done" className={inputCls} />

                    <div className="flex gap-2.5 mt-3">
                        <div className="w-24">
                            <label htmlFor="mkt-qtd" className={`block text-[11px] font-black uppercase tracking-wider mb-1.5 ${muted}`}>{t('mkt.qty')}</label>
                            <input id="mkt-qtd" inputMode="decimal" value={qty}
                                onChange={(e) => setQty(e.target.value.replace(/[^\d.,]/g, ''))} className={`${inputCls} text-center tabular-nums`} />
                        </div>
                        <div className="flex-1">
                            <label htmlFor="mkt-un" className={`block text-[11px] font-black uppercase tracking-wider mb-1.5 ${muted}`}>{t('mkt.unit')}</label>
                            <select id="mkt-un" value={unit} onChange={(e) => setUnit(e.target.value)}
                                className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                    </div>

                    <button type="submit" disabled={!name.trim() || busy}
                        className="mt-4 w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-[15px] font-black transition active:scale-[0.98] inline-flex items-center justify-center gap-2">
                        <Plus className="w-5 h-5" strokeWidth={3} /> {t('mkt.addItem')}
                    </button>

                    {/* Confirmação do que acabou de entrar, sem fechar a folha. */}
                    {ultimos.length > 0 && (
                        <p className={`text-[12px] mt-3 truncate ${muted}`}>
                            <Check className="w-3.5 h-3.5 inline -mt-0.5 mr-1 text-emerald-500" strokeWidth={3} />
                            {ultimos.join(' · ')}
                        </p>
                    )}
                </form>
            </div>
        </div>
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
