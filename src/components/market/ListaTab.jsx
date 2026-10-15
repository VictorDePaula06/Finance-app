import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import { db } from '../../services/firebase';
import { collection, addDoc, doc, writeBatch } from 'firebase/firestore';
import ListaDetalhe from './ListaDetalhe';
import NovaListaSheet from './NovaListaSheet';
import { toast } from '../ui/Toaster';
import { ListPlus, ShoppingCart, Pencil, Trash2, ClipboardList } from 'lucide-react';

// ── Aba Lista ───────────────────────────────────────────────────────
// Abrindo a aba, o que aparece são as listas que existem — pelo nome. De
// cada uma saem dois caminhos, e eles são diferentes de propósito:
//
//   BATER LISTA — a pessoa está no mercado, de pé, marcando o que pegou.
//   EDITAR      — a pessoa está sentada, montando ou ajustando.
//
// O que NÃO está mais aqui: o consumo do mês. Ele é consulta de análise, e
// no meio da lista do corredor só atrapalhava quem está comprando. Foi
// para a aba Análise, que é onde se pergunta quanto se gastou.

export default function ListaTab({ isDark, uid, items, listas, purchases, apelidos }) {
    const { t } = useI18n();
    const [aberta, setAberta] = useState(null);     // { id, modo }
    const [novaOpen, setNovaOpen] = useState(false);
    const migrou = useRef(false);

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const ink = isDark ? 'text-white' : 'text-slate-800';

    // ── Itens de antes de as listas terem nome ──────────────────────
    // Quem já usava o mercado tem itens sem `listId`. Eles NÃO podem sumir
    // da tela só porque o modelo mudou — isso é a lista de compras de
    // alguém. Então, uma vez, ganham uma lista com nome e continuam
    // exatamente onde estavam. Nada é apagado.
    const orfaos = useMemo(() => (items || []).filter(i => !i.listId), [items]);

    useEffect(() => {
        if (migrou.current || !uid || !orfaos.length) return;
        migrou.current = true;
        (async () => {
            try {
                const ref = await addDoc(collection(db, 'market_lists'), {
                    userId: uid, name: t('mkt.defaultListName'), createdAt: Date.now(),
                });
                const b = writeBatch(db);
                orfaos.forEach(i => b.update(doc(db, 'market_items', i.id), { listId: ref.id }));
                await b.commit();
            } catch (e) {
                console.error('[mercado] migrar itens sem lista:', e);
                migrou.current = false;     // deixa tentar de novo
            }
        })();
    }, [uid, orfaos, t]);

    const porLista = useMemo(() => {
        const m = new Map();
        for (const i of items || []) {
            if (!i.listId) continue;
            if (!m.has(i.listId)) m.set(i.listId, []);
            m.get(i.listId).push(i);
        }
        for (const arr of m.values()) arr.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        return m;
    }, [items]);

    const apagarLista = async (lista) => {
        try {
            const b = writeBatch(db);
            (porLista.get(lista.id) || []).forEach(i => b.delete(doc(db, 'market_items', i.id)));
            b.delete(doc(db, 'market_lists', lista.id));
            await b.commit();
            toast.success(t('mkt.listDeleted'));
        } catch (e) {
            console.error(e);
            toast.error(t('mkt.mergeFail'));
        }
    };

    // ── Uma lista aberta ────────────────────────────────────────────
    const listaAberta = aberta && (listas || []).find(l => l.id === aberta.id);
    if (listaAberta) {
        return (
            <ListaDetalhe isDark={isDark} uid={uid} lista={listaAberta}
                items={porLista.get(listaAberta.id) || []}
                modo={aberta.modo}
                onBater={() => setAberta({ id: listaAberta.id, modo: 'bater' })}
                onEditar={() => setAberta({ id: listaAberta.id, modo: 'editar' })}
                onVoltar={() => setAberta(null)} />
        );
    }

    // ── O índice ────────────────────────────────────────────────────
    return (
        <div className="max-w-3xl mx-auto w-full">
            <header className="flex items-end justify-between gap-3 mb-4">
                <div className="min-w-0">
                    <h1 className={`text-[19px] sm:text-xl font-black tracking-tight ${ink}`}>{t('mkt.listTitle')}</h1>
                    <p className={`text-[12.5px] mt-0.5 ${muted}`}>
                        {listas?.length
                            ? `${listas.length} ${t('mkt.listsWord', { n: listas.length })}`
                            : t('mkt.listSubtitle')}
                    </p>
                </div>
                {listas?.length > 0 && (
                    <button onClick={() => setNovaOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-black transition active:scale-95 shrink-0">
                        <ListPlus className="w-4 h-4" strokeWidth={2.6} /> {t('mkt.newList')}
                    </button>
                )}
            </header>

            {!listas?.length ? (
                <div className={`rounded-2xl border border-dashed px-5 py-12 text-center ${isDark ? 'border-white/12' : 'border-slate-300'}`}>
                    <ClipboardList className={`w-9 h-9 mx-auto ${muted}`} strokeWidth={1.6} />
                    <p className={`text-[15px] font-black mt-3 ${ink}`}>{t('mkt.noLists')}</p>
                    <p className={`text-[12.5px] mt-1 ${muted}`}>{t('mkt.noListsDesc')}</p>
                    <button onClick={() => setNovaOpen(true)}
                        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-black transition active:scale-95">
                        <ListPlus className="w-4 h-4" strokeWidth={2.6} /> {t('mkt.newList')}
                    </button>
                </div>
            ) : (
                <ul className="space-y-2.5">
                    {listas.map(l => (
                        <CartaoLista key={l.id} lista={l} itens={porLista.get(l.id) || []}
                            isDark={isDark} t={t}
                            onBater={() => setAberta({ id: l.id, modo: 'bater' })}
                            onEditar={() => setAberta({ id: l.id, modo: 'editar' })}
                            onApagar={() => apagarLista(l)} />
                    ))}
                </ul>
            )}

            {novaOpen && (
                <NovaListaSheet isDark={isDark} uid={uid} purchases={purchases} apelidos={apelidos}
                    onAberta={(id) => setAberta({ id, modo: 'editar' })}
                    onClose={() => setNovaOpen(false)} />
            )}
        </div>
    );
}

// ── Cartão de uma lista ─────────────────────────────────────────────
// O nome em cima, o progresso logo abaixo, e os dois caminhos no rodapé.
// "Bater lista" é o botão em destaque porque é o que se faz mais vezes:
// uma lista é montada uma vez e batida a cada ida ao mercado.
function CartaoLista({ lista, itens, isDark, t, onBater, onEditar, onApagar }) {
    const [confirmando, setConfirmando] = useState(false);

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const ink = isDark ? 'text-white' : 'text-slate-800';
    const line = isDark ? 'border-white/[0.07]' : 'border-slate-200';

    const feitos = itens.filter(i => i.done).length;
    const pct = itens.length ? (feitos / itens.length) * 100 : 0;
    const completa = itens.length > 0 && feitos === itens.length;

    return (
        <li className={`rounded-2xl border overflow-hidden ${line} ${isDark ? 'bg-white/[0.02]' : 'bg-white'}`}>
            <div className="px-4 pt-3.5 pb-3">
                <div className="flex items-baseline gap-2">
                    <h2 className={`text-[15.5px] font-black truncate flex-1 ${ink}`}>{lista.name}</h2>
                    <span className={`text-[12px] font-bold tabular-nums shrink-0 ${completa ? 'text-emerald-500' : muted}`}>
                        {feitos}/{itens.length}
                    </span>
                </div>

                <div className={`mt-2.5 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                </div>

                <p className={`text-[11.5px] mt-2 ${muted}`}>
                    {itens.length === 0
                        ? t('mkt.emptyList')
                        : completa
                            ? t('mkt.allDone')
                            : `${itens.length - feitos} ${t('mkt.missingWord', { n: itens.length - feitos })}`}
                </p>
            </div>

            <div className={`flex items-stretch border-t ${line}`}>
                <button onClick={onBater}
                    className={`flex-1 inline-flex items-center justify-center gap-2 py-3 text-[13px] font-black text-emerald-500 transition ${isDark ? 'hover:bg-emerald-500/[0.08] active:bg-emerald-500/[0.12]' : 'hover:bg-emerald-50 active:bg-emerald-100'}`}>
                    <ShoppingCart className="w-4 h-4" strokeWidth={2.6} /> {t('mkt.checkOff')}
                </button>
                <button onClick={onEditar}
                    className={`flex-1 inline-flex items-center justify-center gap-2 py-3 border-l text-[13px] font-bold transition ${line} ${muted} ${isDark ? 'hover:text-white hover:bg-white/[0.04]' : 'hover:text-slate-800 hover:bg-slate-50'}`}>
                    <Pencil className="w-4 h-4" /> {t('common.edit')}
                </button>
                {/* Apagar pede confirmação no próprio botão: um toque a mais
                    para uma ação rara, mas uma lista inteira some aqui. */}
                <button onClick={() => (confirmando ? onApagar() : setConfirmando(true))}
                    onBlur={() => setConfirmando(false)}
                    aria-label={t('common.delete')}
                    className={`px-4 border-l text-[12px] font-bold transition ${line} ${confirmando ? 'text-rose-500' : muted} hover:text-rose-500`}>
                    {confirmando ? t('common.confirm') : <Trash2 className="w-4 h-4" />}
                </button>
            </div>
        </li>
    );
}
