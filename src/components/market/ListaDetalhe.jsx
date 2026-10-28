import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import { db } from '../../services/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { UNITS } from '../../utils/market';
import { toast } from '../ui/Toaster';
import {
    Plus, Check, Trash2, ShoppingCart, X, Eraser, ArrowLeft, Pencil,
    PartyPopper, ListChecks, RotateCcw, CornerUpLeft, Search,
} from 'lucide-react';

// ── Uma lista aberta ────────────────────────────────────────────────
// Dois modos que NÃO são a mesma tela — antes a única diferença era
// aparecer um botão de apagar, e "editar" não editava nada.
//
// CONFERIR (bater): a pessoa está no corredor, em pé, com o carrinho na
// outra mão. Duas colunas lado a lado: o que falta à esquerda, o que já
// está no carrinho à direita. Um toque move de um lado para o outro. Só
// isso — nada aqui apaga ou altera, porque a tela é usada de relance e um
// toque errado não pode destruir a lista.
//
// EDITAR: a pessoa está sentada, montando. Uma coluna só, com TODOS os
// itens, e cada linha é editável de verdade: nome, quantidade, unidade.
// Uma coluna porque aqui o que importa é a lista inteira, não o que já
// foi pego.

// Comparar o que foi digitado com o nome do item sem tropecar em acento
// nem maiuscula: quem procura no corredor digita "feijao", nao "Feijao".
const semAcento = (v) => String(v || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function ListaDetalhe({ isDark, uid, lista, items, modo, onVoltar, onEditar, onBater }) {
    const { t } = useI18n();
    const [renomeando, setRenomeando] = useState(false);
    // A busca mora aqui, e nao dentro de cada modo, para sobreviver a troca
    // de conferir para editar: quem achou o item e quer corrigi-lo nao
    // deveria ter de digitar o nome de novo do outro lado.
    const [busca, setBusca] = useState('');
    const editando = modo === 'editar';

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const ink = isDark ? 'text-white' : 'text-slate-800';
    const line = isDark ? 'border-white/[0.07]' : 'border-slate-200';
    const card = `rounded-2xl border ${line} ${isDark ? 'bg-white/[0.02]' : 'bg-white'}`;

    // As listas CHEIAS: progresso, "lista batida" e as acoes em lote
    // continuam falando da lista toda, nao do que a busca deixou na tela.
    const faltando = useMemo(() => items.filter(i => !i.done), [items]);
    const noCarrinho = useMemo(() => items.filter(i => i.done), [items]);

    // E as listas VISIVEIS. Cada palavra digitada tem de aparecer no nome,
    // em qualquer ordem: "arroz int" acha "Arroz integral".
    const termos = useMemo(
        () => semAcento(busca).split(/\s+/).filter(Boolean), [busca]);
    const filtrando = termos.length > 0;
    const visiveis = useMemo(() => (!termos.length ? items : items.filter(i => {
        const n = semAcento(i.name);
        return termos.every(x => n.includes(x));
    })), [items, termos]);
    const visFaltando = useMemo(() => visiveis.filter(i => !i.done), [visiveis]);
    const visCarrinho = useMemo(() => visiveis.filter(i => i.done), [visiveis]);
    const pct = items.length ? (noCarrinho.length / items.length) * 100 : 0;
    const completa = items.length > 0 && faltando.length === 0;

    const alternar = async (item) => {
        try { await updateDoc(doc(db, 'market_items', item.id), { done: !item.done }); }
        catch (err) { console.error(err); toast.error(t('mkt.mergeFail')); }
    };
    const remover = async (id) => {
        try { await deleteDoc(doc(db, 'market_items', id)); }
        catch (err) { console.error(err); toast.error(t('mkt.mergeFail')); }
    };
    const emLote = async (lista_, fn, erro) => {
        if (!lista_.length) return;
        try { const b = writeBatch(db); lista_.forEach(i => fn(b, i)); await b.commit(); }
        catch (err) { console.error(err); toast.error(erro); }
    };
    const desmarcarTudo = () => emLote(noCarrinho,
        (b, i) => b.update(doc(db, 'market_items', i.id), { done: false }), t('mkt.mergeFail'));
    const limparMarcados = () => emLote(noCarrinho,
        (b, i) => b.delete(doc(db, 'market_items', i.id)), t('mkt.mergeFail'));

    return (
        <div className="max-w-5xl mx-auto w-full">
            {/* ── Cabeçalho ───────────────────────────────────────── */}
            <header className="mb-4">
                <div className="flex items-center gap-2">
                    <button onClick={onVoltar} aria-label={t('common.back')}
                        className={`w-9 h-9 -ml-1 rounded-xl flex items-center justify-center shrink-0 transition ${muted} ${isDark ? 'hover:text-white hover:bg-white/[0.06]' : 'hover:text-slate-800 hover:bg-slate-100'}`}>
                        <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={2.2} />
                    </button>
                    <div className="min-w-0 flex-1">
                        {/* Editando, o nome é clicável — é onde a pessoa vai
                            procurar para trocá-lo. Conferindo, é só texto: no
                            corredor não se renomeia nada. */}
                        {editando ? (
                            <button onClick={() => setRenomeando(true)}
                                className={`flex items-center gap-1.5 text-left max-w-full ${ink}`}>
                                <span className="text-[19px] sm:text-xl font-black tracking-tight truncate">{lista.name}</span>
                                <Pencil className={`w-3.5 h-3.5 shrink-0 ${muted}`} />
                            </button>
                        ) : (
                            <h1 className={`text-[19px] sm:text-xl font-black tracking-tight truncate ${ink}`}>{lista.name}</h1>
                        )}
                        <p className={`text-[12.5px] mt-0.5 ${muted}`}>
                            {!items.length
                                ? t('mkt.emptyList')
                                : editando
                                    ? `${items.length} ${t('mkt.itemsWord', { n: items.length })}`
                                    : `${noCarrinho.length}/${items.length} ${t('mkt.inCart').toLowerCase()}`}
                        </p>
                    </div>

                    {/* Trocar de modo sem voltar: sentado dá vontade de conferir,
                        e no corredor dá vontade de acrescentar o que faltou. */}
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

                {/* A barra de progresso é do modo de conferir: editando, ela só
                    ocuparia espaço sem responder a pergunta de quem edita. */}
                {!editando && items.length > 0 && (
                    <div className={`mt-3 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                        <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                )}

                {/* Procurar vale nos dois modos, e por motivos diferentes: de pe
                    no corredor, achar o item sem rolar 40 linhas; sentado,
                    chegar na linha que se quer corrigir. */}
                {items.length > 0 && (
                    <CampoBusca isDark={isDark} muted={muted} t={t}
                        busca={busca} setBusca={setBusca}
                        achados={visiveis.length} total={items.length} />
                )}
            </header>

            {editando
                ? <ModoEditar isDark={isDark} uid={uid} lista={lista} items={visiveis} t={t}
                    card={card} line={line} muted={muted} ink={ink}
                    temCarrinho={noCarrinho.length > 0} filtrando={filtrando}
                    onRemover={remover} onAlternar={alternar}
                    onDesmarcar={desmarcarTudo} onLimpar={limparMarcados} />
                : <ModoConferir isDark={isDark} uid={uid} lista={lista} t={t}
                    card={card} line={line} muted={muted} ink={ink}
                    faltando={visFaltando} noCarrinho={visCarrinho} completa={completa}
                    totalFaltando={faltando.length} totalCarrinho={noCarrinho.length}
                    filtrando={filtrando}
                    onAlternar={alternar} onDesmarcar={desmarcarTudo} />}

            {renomeando && <RenomearSheet isDark={isDark} lista={lista} onClose={() => setRenomeando(false)} />}
        </div>
    );
}

// ── O campo de busca ─────────────────────────────────────────────
// Com filtro ativo ele mostra "3/27" dentro do proprio campo: sem isso uma
// tela com tres linhas fica indistinguivel de uma lista de tres itens.
function CampoBusca({ isDark, muted, t, busca, setBusca, achados, total }) {
    const ativo = busca.trim().length > 0;
    return (
        <div className="relative mt-3">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${muted}`} strokeWidth={2.4} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setBusca(''); }}
                placeholder={t('mkt.searchPlaceholder')} aria-label={t('mkt.searchPlaceholder')}
                enterKeyHint="search" autoComplete="off"
                className={`w-full pl-9 ${ativo ? 'pr-[88px]' : 'pr-3'} py-2.5 rounded-xl border text-[13.5px] outline-none transition focus:border-emerald-500 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`} />
            {ativo && (
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <span className={`text-[11.5px] font-black tabular-nums ${achados ? muted : 'text-rose-500'}`}>
                        {achados}/{total}
                    </span>
                    <button type="button" onClick={() => setBusca('')} aria-label={t('common.clear')}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${muted} ${isDark ? 'hover:text-white hover:bg-white/[0.07]' : 'hover:text-slate-800 hover:bg-slate-100'}`}>
                        <X className="w-4 h-4" strokeWidth={2.6} />
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Conferir: duas colunas lado a lado ──────────────────────────────
// O que falta e o que já está no carrinho precisam estar VISÍVEIS AO MESMO
// TEMPO. Antes o carrinho ficava empilhado embaixo: para ver o que já
// tinha pego, a pessoa rolava a tela no meio do corredor, com o celular
// numa mão só. Lado a lado, um toque move o item de uma coluna para a
// outra e a conferência acontece sem rolagem.
function ModoConferir({ isDark, uid, lista, t, card, line, muted, ink, faltando, noCarrinho, completa, totalFaltando, totalCarrinho, filtrando, onAlternar, onDesmarcar }) {
    const [addOpen, setAddOpen] = useState(false);

    return (
        <>
            {/* Lista batida: o fim do trabalho merece ser dito. */}
            {completa && (
                <div className={`mb-3 rounded-2xl border px-4 py-3.5 flex items-center gap-3 ${isDark ? 'border-emerald-500/25 bg-emerald-500/[0.07]' : 'border-emerald-200 bg-emerald-50'}`}>
                    <PartyPopper className="w-6 h-6 text-emerald-500 shrink-0" strokeWidth={1.9} />
                    <div className="min-w-0 flex-1">
                        <p className={`text-[14px] font-black ${ink}`}>{t('mkt.allDone')}</p>
                        <p className={`text-[12px] ${muted}`}>{t('mkt.allDoneDesc')}</p>
                    </div>
                    <button onClick={onDesmarcar}
                        className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[12px] font-bold transition active:scale-95 ${line} ${muted} ${isDark ? 'hover:text-white' : 'hover:text-slate-700'}`}>
                        <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t('mkt.uncheckAll')}</span>
                    </button>
                </div>
            )}

            {/* Duas colunas desde o celular. Nomes de mercado são curtos
                ("Arroz", "Leite", "Papel higiênico") e cabem; o ganho de ver
                os dois lados ao mesmo tempo vale mais que a largura extra. */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 items-start">
                <Coluna isDark={isDark} card={card} line={line} muted={muted} ink={ink}
                    titulo={t('mkt.missingTitle')} cor="text-emerald-500" icone={ListChecks}
                    itens={faltando} total={totalFaltando} filtrando={filtrando}
                    vazio={filtrando ? t('mkt.noMatch') : t('mkt.nothingMissing')}
                    onToque={onAlternar} ladoDireito={false} t={t} />
                <Coluna isDark={isDark} card={card} line={line} muted={muted} ink={ink}
                    titulo={t('mkt.inCart')} cor={muted} icone={ShoppingCart}
                    itens={noCarrinho} total={totalCarrinho} filtrando={filtrando}
                    vazio={filtrando ? t('mkt.noMatch') : t('mkt.cartEmpty')}
                    onToque={onAlternar} ladoDireito t={t} />
            </div>

            {/* Acrescentar o que faltou é o único gesto de escrita que se faz
                de pé — por isso ele existe aqui, e nada mais. */}
            <button onClick={() => setAddOpen(true)}
                className={`mt-3 w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-dashed text-[13.5px] font-black transition active:scale-[0.99] ${isDark ? 'border-white/15 text-slate-400 hover:border-emerald-500/40 hover:text-white' : 'border-slate-300 text-slate-500 hover:border-emerald-500/50 hover:text-slate-800'}`}>
                <Plus className="w-4 h-4" strokeWidth={3} /> {t('mkt.addItem')}
            </button>

            {addOpen && <AddSheet isDark={isDark} uid={uid} listId={lista.id} onClose={() => setAddOpen(false)} />}
        </>
    );
}

// Uma das duas colunas. A da direita mostra a seta de "devolver" em vez do
// quadrado de marcar: o gesto é o inverso, e o ícone tem de dizer isso.
function Coluna({ isDark, card, line, muted, ink, titulo, cor, icone: Icone, itens, total, filtrando, vazio, onToque, ladoDireito, t }) {
    return (
        <section className={`${card} overflow-hidden`}>
            <header className={`flex items-center gap-1.5 px-3 py-2.5 border-b ${line}`}>
                <Icone className={`w-3.5 h-3.5 shrink-0 ${cor}`} strokeWidth={2.4} />
                <h2 className={`text-[11px] font-black uppercase tracking-wider truncate ${ink}`}>{titulo}</h2>
                <span className={`ml-auto text-[11px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${isDark ? 'bg-white/[0.08] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                    {filtrando && itens.length !== total ? `${itens.length}/${total}` : itens.length}
                </span>
            </header>

            {itens.length === 0 ? (
                <p className={`text-[12px] px-3 py-8 text-center leading-snug ${muted}`}>{vazio}</p>
            ) : (
                <ul>
                    {itens.map((i, idx) => (
                        <li key={i.id} className={idx ? `border-t ${line}` : ''}>
                            <button onClick={() => onToque(i)} aria-pressed={!!i.done}
                                className={`w-full flex items-center gap-2 px-2.5 py-3 min-h-[54px] text-left transition ${isDark ? 'active:bg-white/[0.06]' : 'active:bg-slate-100'}`}>
                                <span className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition ${ladoDireito
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : (isDark ? 'border-white/25' : 'border-slate-300')}`}>
                                    {ladoDireito ? <Check className="w-4 h-4" strokeWidth={3.5} /> : null}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className={`block text-[14px] font-bold leading-tight ${ladoDireito ? `line-through ${muted}` : ink}`}>
                                        {i.name}
                                    </span>
                                    <span className={`block text-[11px] tabular-nums mt-0.5 ${muted}`}>{i.qty} {i.unit}</span>
                                </span>
                                {ladoDireito && <CornerUpLeft className={`w-4 h-4 shrink-0 ${muted}`} />}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

// ── Editar: uma coluna, cada linha editável de verdade ──────────────
// Antes "editar" só acrescentava um botão de apagar — não dava para mudar
// nome, quantidade nem unidade de nada. Agora dá, direto na linha: o campo
// grava ao sair dele, que é o mesmo comportamento do resto do app (marcar
// um item também grava na hora, sem botão de salvar).
function ModoEditar({ isDark, uid, lista, items, t, card, line, muted, ink, temCarrinho, filtrando, onRemover, onAlternar, onDesmarcar, onLimpar }) {

    return (
        <>
            <section className={`${card} overflow-hidden`}>
                {items.length === 0 ? (
                    <p className={`text-[13px] px-4 py-10 text-center ${muted}`}>
                        {filtrando ? t('mkt.noMatch') : t('mkt.emptyListDesc')}
                    </p>
                ) : (
                    <ul>
                        {items.map((i, idx) => (
                            <LinhaEditavel key={i.id} item={i} isDark={isDark} line={line} muted={muted} ink={ink}
                                primeira={idx === 0} t={t} onRemover={onRemover} onAlternar={onAlternar} />
                        ))}
                    </ul>
                )}
                {/* A linha de acrescentar vive DENTRO da lista, no fim, e
                    continua aberta depois de salvar: montar lista é uma
                    sequência, não um item só. */}
                {/* Com filtro ativo a linha de acrescentar sai: o item recem
                    salvo sumiria na hora, escondido pela propria busca. */}
                {!filtrando && (
                    <NovaLinha isDark={isDark} uid={uid} listId={lista.id} line={line}
                        muted={muted} ink={ink} temItens={items.length > 0} t={t} />
                )}
            </section>

            {temCarrinho && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <button onClick={onDesmarcar}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-[12.5px] font-bold transition active:scale-95 ${line} ${muted} ${isDark ? 'hover:text-white' : 'hover:text-slate-800'}`}>
                        <RotateCcw className="w-4 h-4" /> {t('mkt.uncheckAll')}
                    </button>
                    <button onClick={onLimpar}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-[12.5px] font-bold transition active:scale-95 ${line} ${muted} hover:text-rose-500`}>
                        <Eraser className="w-4 h-4" /> {t('mkt.clearDone')}
                    </button>
                </div>
            )}
        </>
    );
}

// Uma linha editável. Grava ao SAIR do campo (e no Enter), não a cada
// tecla: salvar por tecla seria uma escrita no banco por letra digitada.
function LinhaEditavel({ item, isDark, line, muted, ink, primeira, t, onRemover, onAlternar }) {
    const [nome, setNome] = useState(item.name);
    const [qtd, setQtd] = useState(String(item.qty ?? 1).replace('.', ','));
    const [confirmando, setConfirmando] = useState(false);

    // Se o item mudar no banco (outro aparelho, ou o toque no carrinho),
    // o campo acompanha — desde que não esteja sendo editado agora.
    const focado = useRef(false);
    useEffect(() => {
        if (focado.current) return;
        setNome(item.name);
        setQtd(String(item.qty ?? 1).replace('.', ','));
    }, [item.name, item.qty]);

    const gravar = async (campos) => {
        try { await updateDoc(doc(db, 'market_items', item.id), campos); }
        catch (err) { console.error(err); toast.error(t('mkt.mergeFail')); }
    };
    const salvarNome = () => {
        focado.current = false;
        const v = nome.trim();
        if (!v) { setNome(item.name); return; }      // nome vazio não existe
        if (v !== item.name) gravar({ name: v });
    };
    const salvarQtd = () => {
        focado.current = false;
        const v = parseFloat(String(qtd).replace(',', '.'));
        if (!Number.isFinite(v) || v <= 0) { setQtd(String(item.qty ?? 1).replace('.', ',')); return; }
        if (v !== Number(item.qty)) gravar({ qty: v });
    };

    const campo = `px-2.5 py-2 rounded-lg border text-[13.5px] outline-none transition focus:border-emerald-500 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`;

    return (
        // No celular a linha quebra em duas: o nome ganha a largura toda em
        // cima, e quantidade/unidade/apagar descem. Em uma linha só, o campo
        // de nome ficava com 121px — "Papel higiênico" já não cabia, e o que
        // a pessoa mais edita é justamente o nome.
        <li className={`${primeira ? '' : `border-t ${line}`} px-2.5 py-2.5 flex flex-wrap items-center gap-2`}>
            {/* O estado de "já está no carrinho" continua visível e clicável
                aqui: quem edita precisa saber o que já foi pego. */}
            <button onClick={() => onAlternar(item)} aria-pressed={!!item.done}
                title={item.done ? t('mkt.inCart') : t('mkt.missingTitle')}
                className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition ${item.done
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : (isDark ? 'border-white/25' : 'border-slate-300')}`}>
                {item.done && <Check className="w-4 h-4" strokeWidth={3.5} />}
            </button>

            <input value={nome} onChange={(e) => setNome(e.target.value)}
                onFocus={() => { focado.current = true; }}
                onBlur={salvarNome}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                aria-label={t('mkt.itemName')}
                className={`${campo} flex-1 min-w-0 font-bold ${item.done ? `line-through ${muted}` : ''}`} />

            {/* `w-full sm:w-auto` é o que faz a quebra: no celular este bloco
                desce para a segunda linha, alinhado sob o nome. */}
            <div className="flex items-center gap-2 w-full sm:w-auto pl-9 sm:pl-0">
                <input value={qtd} inputMode="decimal"
                    onChange={(e) => setQtd(e.target.value.replace(/[^\d.,]/g, ''))}
                    onFocus={() => { focado.current = true; }}
                    onBlur={salvarQtd}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    aria-label={t('mkt.qty')}
                    className={`${campo} w-16 text-center tabular-nums shrink-0`} />

                <select value={UNITS.includes(item.unit) ? item.unit : 'un'}
                    onChange={(e) => gravar({ unit: e.target.value })}
                    aria-label={t('mkt.unit')}
                    style={{ colorScheme: isDark ? 'dark' : 'light' }}
                    className={`${campo} w-[76px] shrink-0`}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>

                {/* Apagar confirma no próprio botão: é raro, e some um item. */}
                <button onClick={() => (confirmando ? onRemover(item.id) : setConfirmando(true))}
                    onBlur={() => setConfirmando(false)}
                    aria-label={`${t('common.delete')} ${item.name}`}
                    className={`shrink-0 ml-auto sm:ml-0 rounded-lg transition active:scale-90 ${confirmando
                        ? 'px-2 py-2 text-[11px] font-black text-rose-500'
                        : `p-2 ${muted} hover:text-rose-500`}`}>
                    {confirmando ? t('common.confirm') : <Trash2 className="w-[17px] h-[17px]" />}
                </button>
            </div>
        </li>
    );
}

// Linha de acrescentar, no fim da lista. Fica aberta depois de salvar e o
// foco volta ao nome — montar lista é uma sequência de itens.
function NovaLinha({ isDark, uid, listId, line, muted, ink, temItens, t }) {
    const [nome, setNome] = useState('');
    const [qtd, setQtd] = useState('1');
    const [unidade, setUnidade] = useState('un');
    const [salvando, setSalvando] = useState(false);
    const nomeRef = useRef(null);

    const adicionar = async (e) => {
        e?.preventDefault();
        const v = nome.trim();
        if (!v || salvando) return;
        setSalvando(true);
        try {
            await addDoc(collection(db, 'market_items'), {
                userId: uid, listId, name: v,
                qty: parseFloat(String(qtd).replace(',', '.')) || 1,
                unit: unidade, done: false, createdAt: Date.now(),
            });
            setNome(''); setQtd('1');
            nomeRef.current?.focus();
        } catch (err) { console.error(err); toast.error(t('mkt.mergeFail')); }
        setSalvando(false);
    };

    const campo = `px-2.5 py-2 rounded-lg border text-[13.5px] outline-none transition focus:border-emerald-500 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`;

    return (
        <form onSubmit={adicionar}
            className={`${temItens ? `border-t ${line}` : ''} px-2.5 py-2.5 flex flex-wrap items-center gap-2`}>
            <span className={`w-7 h-7 rounded-lg border-2 border-dashed flex items-center justify-center shrink-0 ${isDark ? 'border-white/15' : 'border-slate-300'}`}>
                <Plus className={`w-3.5 h-3.5 ${muted}`} strokeWidth={3} />
            </span>
            <input ref={nomeRef} value={nome} onChange={(e) => setNome(e.target.value)}
                placeholder={t('mkt.itemNamePlaceholder')} aria-label={t('mkt.itemName')}
                className={`${campo} flex-1 min-w-0`} />
            {/* Mesma quebra da linha de edição, para as duas ficarem alinhadas. */}
            <div className="flex items-center gap-2 w-full sm:w-auto pl-9 sm:pl-0">
                <input value={qtd} inputMode="decimal"
                    onChange={(e) => setQtd(e.target.value.replace(/[^\d.,]/g, ''))}
                    aria-label={t('mkt.qty')}
                    className={`${campo} w-16 text-center tabular-nums shrink-0`} />
                <select value={unidade} onChange={(e) => setUnidade(e.target.value)}
                    aria-label={t('mkt.unit')} style={{ colorScheme: isDark ? 'dark' : 'light' }}
                    className={`${campo} w-[76px] shrink-0`}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <button type="submit" disabled={!nome.trim() || salvando}
                    aria-label={t('mkt.addItem')}
                    className="shrink-0 ml-auto sm:ml-0 p-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 text-white transition active:scale-90">
                    <Plus className="w-[17px] h-[17px]" strokeWidth={3} />
                </button>
            </div>
        </form>
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

// ── Folha de acrescentar (modo de conferir) ─────────────────────────
// No corredor a folha sobe de baixo, perto do polegar, e continua aberta
// depois de adicionar.
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
        } catch (err) { console.error(err); toast.error(t('mkt.mergeFail')); }
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
