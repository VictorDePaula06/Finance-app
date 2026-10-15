import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import { db } from '../../services/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { UNITS } from '../../utils/market';
import { toast } from '../ui/Toaster';
import {
    Plus, Check, Trash2, ShoppingCart, X, Eraser, ArrowLeft, Pencil, PartyPopper,
} from 'lucide-react';

// ── Uma lista aberta ────────────────────────────────────────────────
// Dois modos, e a diferença entre eles é o que a mão está fazendo.
//
// BATER: a pessoa está no corredor, em pé, com o carrinho na outra mão. Só
// marca. Nada de apagar, nada de editar quantidade — um toque errado aqui
// não pode destruir nada, porque a tela está sendo usada de relance.
//
// EDITAR: a pessoa está sentada, montando. Aí sim aparece apagar, mudar
// quantidade e acrescentar item.
//
// É o mesmo conteúdo com permissões diferentes, e isso é de propósito:
// misturar os dois é como a lista de alguém some sem explicação.

export default function ListaDetalhe({ isDark, uid, lista, items, modo, onVoltar, onEditar, onBater }) {
    const { t } = useI18n();
    const [addOpen, setAddOpen] = useState(false);
    const [renomeando, setRenomeando] = useState(false);

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const ink = isDark ? 'text-white' : 'text-slate-800';
    const line = isDark ? 'border-white/[0.07]' : 'border-slate-200';
    const editando = modo === 'editar';

    const faltando = useMemo(() => items.filter(i => !i.done), [items]);
    const noCarrinho = useMemo(() => items.filter(i => i.done), [items]);
    const pct = items.length ? (noCarrinho.length / items.length) * 100 : 0;
    const completa = items.length > 0 && faltando.length === 0;

    const alternar = async (item) => {
        try { await updateDoc(doc(db, 'market_items', item.id), { done: !item.done }); }
        catch (err) { console.error(err); }
    };
    const remover = async (id) => {
        try { await deleteDoc(doc(db, 'market_items', id)); } catch (err) { console.error(err); }
    };
    const desmarcarTudo = async () => {
        if (!noCarrinho.length) return;
        try {
            const b = writeBatch(db);
            noCarrinho.forEach(i => b.update(doc(db, 'market_items', i.id), { done: false }));
            await b.commit();
        } catch (err) { console.error(err); }
    };
    const limparMarcados = async () => {
        if (!noCarrinho.length) return;
        try {
            const b = writeBatch(db);
            noCarrinho.forEach(i => b.delete(doc(db, 'market_items', i.id)));
            await b.commit();
        } catch (err) { console.error(err); }
    };

    return (
        <div className="max-w-3xl mx-auto w-full">
            <header className="mb-4">
                <div className="flex items-center gap-2">
                    <button onClick={onVoltar} aria-label={t('common.back')}
                        className={`w-9 h-9 -ml-1 rounded-xl flex items-center justify-center shrink-0 transition ${muted} ${isDark ? 'hover:text-white hover:bg-white/[0.06]' : 'hover:text-slate-800 hover:bg-slate-100'}`}>
                        <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={2.2} />
                    </button>
                    <div className="min-w-0 flex-1">
                        {/* Editando, o nome é clicável — é onde a pessoa vai
                            procurar para trocá-lo. Batendo, é só texto: no
                            corredor não se renomeia nada. */}
                        {editando ? (
                            <button onClick={() => setRenomeando(true)}
                                className={`group flex items-center gap-1.5 text-left max-w-full ${ink}`}>
                                <span className="text-[19px] sm:text-xl font-black tracking-tight truncate">{lista.name}</span>
                                <Pencil className={`w-3.5 h-3.5 shrink-0 ${muted}`} />
                            </button>
                        ) : (
                            <h1 className={`text-[19px] sm:text-xl font-black tracking-tight truncate ${ink}`}>{lista.name}</h1>
                        )}
                        <p className={`text-[12.5px] mt-0.5 ${muted}`}>
                            {items.length
                                ? `${noCarrinho.length}/${items.length} ${t('mkt.inCart').toLowerCase()}`
                                : t('mkt.emptyList')}
                        </p>
                    </div>

                    {/* Trocar de modo sem voltar: no corredor dá vontade de
                        acrescentar uma coisa que faltou, e seria ruim ter que
                        sair da lista para isso. */}
                    {editando ? (
                        <button onClick={onBater}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[12.5px] font-black transition active:scale-95 shrink-0">
                            <ShoppingCart className="w-4 h-4" strokeWidth={2.6} />
                            <span className="hidden sm:inline">{t('mkt.checkOff')}</span>
                        </button>
                    ) : (
                        <button onClick={onEditar}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-[12.5px] font-bold transition active:scale-95 shrink-0 ${line} ${muted} ${isDark ? 'hover:text-white' : 'hover:text-slate-800'}`}>
                            <Pencil className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('common.edit')}</span>
                        </button>
                    )}
                </div>

                {items.length > 0 && (
                    <div className={`mt-3 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                        <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                )}
            </header>

            {/* Lista batida: o fim do trabalho merece ser dito. */}
            {completa && !editando && (
                <div className={`mb-4 rounded-2xl border px-4 py-4 text-center ${isDark ? 'border-emerald-500/25 bg-emerald-500/[0.07]' : 'border-emerald-200 bg-emerald-50'}`}>
                    <PartyPopper className="w-7 h-7 mx-auto text-emerald-500" strokeWidth={1.8} />
                    <p className={`text-[14px] font-black mt-2 ${ink}`}>{t('mkt.allDone')}</p>
                    <p className={`text-[12px] mt-0.5 ${muted}`}>{t('mkt.allDoneDesc')}</p>
                    <button onClick={desmarcarTudo}
                        className={`mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-[12px] font-bold transition active:scale-95 ${line} ${muted} ${isDark ? 'hover:text-white' : 'hover:text-slate-700'}`}>
                        <Eraser className="w-3.5 h-3.5" /> {t('mkt.uncheckAll')}
                    </button>
                </div>
            )}

            {faltando.length > 0 && (
                <ul className={`rounded-2xl border overflow-hidden ${line} ${isDark ? 'bg-white/[0.02]' : 'bg-white'}`}>
                    {faltando.map((i, idx) => (
                        <Linha key={i.id} item={i} isDark={isDark} primeira={idx === 0} editando={editando}
                            onToggle={() => alternar(i)} onRemove={() => remover(i.id)} />
                    ))}
                </ul>
            )}

            {items.length === 0 && (
                <div className={`rounded-2xl border border-dashed px-5 py-10 text-center ${isDark ? 'border-white/12' : 'border-slate-300'}`}>
                    <ShoppingCart className={`w-8 h-8 mx-auto ${muted}`} strokeWidth={1.6} />
                    <p className={`text-[14px] font-black mt-2.5 ${ink}`}>{t('mkt.emptyList')}</p>
                    <p className={`text-[12px] mt-1 ${muted}`}>{t('mkt.emptyListDesc')}</p>
                </div>
            )}

            {noCarrinho.length > 0 && (
                <section className="mt-6">
                    <div className="flex items-center gap-2 mb-2.5 px-1">
                        <ShoppingCart className="w-4 h-4 text-emerald-500 shrink-0" />
                        <h2 className={`text-[12.5px] font-black uppercase tracking-wider ${ink}`}>{t('mkt.inCart')}</h2>
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>{noCarrinho.length}</span>
                        {/* Apagar o que já foi só no modo de editar: no corredor
                            isso é um toque de distância do desastre. */}
                        {editando && (
                            <button onClick={limparMarcados}
                                className={`ml-auto inline-flex items-center gap-1.5 px-2.5 py-2 -mr-1 rounded-lg text-[12px] font-bold transition ${muted} hover:text-rose-500 active:scale-95`}>
                                <Eraser className="w-4 h-4" /> {t('mkt.clearDone')}
                            </button>
                        )}
                    </div>
                    <ul className={`rounded-2xl border overflow-hidden ${line} ${isDark ? 'bg-white/[0.02]' : 'bg-white'}`}>
                        {noCarrinho.map((i, idx) => (
                            <Linha key={i.id} item={i} isDark={isDark} primeira={idx === 0} editando={editando}
                                onToggle={() => alternar(i)} onRemove={() => remover(i.id)} />
                        ))}
                    </ul>
                </section>
            )}

            {editando && (
                <button onClick={() => setAddOpen(true)}
                    className={`mt-4 w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-dashed text-[13.5px] font-black transition active:scale-[0.99] ${isDark ? 'border-white/15 text-slate-400 hover:border-emerald-500/40 hover:text-white' : 'border-slate-300 text-slate-500 hover:border-emerald-500/50 hover:text-slate-800'}`}>
                    <Plus className="w-4 h-4" strokeWidth={3} /> {t('mkt.addItem')}
                </button>
            )}

            {/* No corredor o botão flutuante continua: acrescentar o que faltou
                é o único gesto de escrita que a gente faz de pé. */}
            {!editando && (
                <button onClick={() => setAddOpen(true)} aria-label={t('mkt.addItem')}
                    className="sm:hidden fixed right-4 z-30 w-14 h-14 rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center active:scale-95 transition"
                    style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 74px)' }}>
                    <Plus className="w-6 h-6" strokeWidth={3} />
                </button>
            )}

            {addOpen && <AddSheet isDark={isDark} uid={uid} listId={lista.id} onClose={() => setAddOpen(false)} />}
            {renomeando && (
                <RenomearSheet isDark={isDark} lista={lista} onClose={() => setRenomeando(false)} />
            )}
        </div>
    );
}

// ── Linha ───────────────────────────────────────────────────────────
// Altura de dedo e nada escondido atrás de hover.
function Linha({ item, isDark, primeira, editando, onToggle, onRemove }) {
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
                {/* Apagar só existe no modo de editar. Batendo a lista a mão
                    está ocupada e o toque é impreciso: o alvo de apagar a 8px
                    do alvo de marcar é um item somindo sem ninguém entender. */}
                {editando && (
                    <button onClick={onRemove} aria-label={`${t('common.delete')} ${item.name}`}
                        className={`p-3 mr-1 rounded-xl shrink-0 transition active:scale-90 ${muted} hover:text-rose-500 active:text-rose-500`}>
                        <Trash2 className="w-[18px] h-[18px]" />
                    </button>
                )}
            </div>
        </li>
    );
}

// ── Renomear a lista ────────────────────────────────────────────────
function RenomearSheet({ isDark, lista, onClose }) {
    const { t } = useI18n();
    const [nome, setNome] = useState(lista.name);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const salvar = async (e) => {
        e?.preventDefault();
        const novo = nome.trim();
        if (!novo || busy) return;
        setBusy(true);
        try {
            await updateDoc(doc(db, 'market_lists', lista.id), { name: novo });
            onClose();
        } catch (err) {
            console.error(err);
            toast.error(t('mkt.mergeFail'));
            setBusy(false);
        }
    };

    const ink = isDark ? 'text-white' : 'text-slate-800';
    const inputCls = `w-full px-3.5 py-3 rounded-xl border text-[15px] outline-none transition focus:border-emerald-500 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`;

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
            <form onSubmit={salvar}
                className={`relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl border shadow-2xl p-5 ${isDark ? 'bg-[#111614] border-white/10' : 'bg-white border-slate-200'}`}
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>
                <h2 className={`text-[16px] font-black tracking-tight mb-3 ${ink}`}>{t('mkt.renameList')}</h2>
                <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
                <div className="flex gap-2 mt-4">
                    <button type="button" onClick={onClose}
                        className={`flex-1 py-3 rounded-xl border text-[13px] font-bold transition ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                        {t('common.cancel')}
                    </button>
                    <button type="submit" disabled={busy || !nome.trim()}
                        className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-[13px] font-black transition active:scale-95">
                        {t('common.save')}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ── Folha de adicionar ──────────────────────────────────────────────
// Continua aberta depois de adicionar: montar a lista é uma sequência de
// itens, não um item só.
function AddSheet({ isDark, uid, listId, onClose }) {
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
                userId: uid, listId, name: nome,
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

            <div className={`relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 ${isDark ? 'bg-[#111614] border-white/10' : 'bg-white border-slate-200'}`}
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
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

                    {ultimos.length > 0 && (
                        <p className={`text-[11.5px] mt-3 truncate ${muted}`}>
                            {t('mkt.justAdded')}: {ultimos.join(' · ')}
                        </p>
                    )}

                    <button type="submit" disabled={!name.trim() || busy}
                        className="mt-4 w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-[14px] font-black transition active:scale-[0.99]">
                        {t('mkt.addItem')}
                    </button>
                </form>
            </div>
        </div>
    );
}
