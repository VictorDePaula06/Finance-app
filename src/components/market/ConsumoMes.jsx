import React, { useState, useMemo, useEffect } from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import { db } from '../../services/firebase';
import { doc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { consumoDoMes, formataQtd, resolveChave } from '../../utils/produtoCanonico';
import { toast } from '../ui/Toaster';
import { TrendingUp, Merge, X, Search, Check, Undo2, Tag } from 'lucide-react';

// ── Consumo do mês ──────────────────────────────────────────────────
// A pergunta que isto responde é prática: "quanto eu comprei disso no mês, e
// quanto paguei da última vez?" — para na próxima ida ao mercado saber se o
// preço da prateleira está bom e se ainda falta comprar.
//
// Tudo sai das compras lançadas. Nada é estimado, nada é digitado duas vezes.
//
// O trabalho difícil é juntar o mesmo produto escrito de jeitos diferentes
// (src/utils/produtoCanonico.js). O automático acerta os casos claros e erra
// para MENOS de propósito; aqui mora a saída para os outros: juntar com o
// dedo, uma vez, e a junção passa a valer para sempre — inclusive para as
// compras que já estavam lançadas.

export default function ConsumoMes({ isDark, uid, purchases, apelidos, mk }) {
    const { t, fmtMoney: money } = useI18n();
    const [editando, setEditando] = useState(null);     // produto aberto na folha

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const ink = isDark ? 'text-white' : 'text-slate-800';
    const line = isDark ? 'border-white/[0.07]' : 'border-slate-200';

    const grupos = useMemo(
        () => consumoDoMes(purchases, mk, apelidos?.mapa, apelidos?.rotulos),
        [purchases, mk, apelidos]);

    const totalMes = useMemo(
        () => Math.round(grupos.reduce((a, g) => a + g.gasto, 0) * 100) / 100,
        [grupos]);

    const comprasDoMes = useMemo(
        () => (purchases || []).filter(p => String(p?.date || '').slice(0, 7) === mk).length,
        [purchases, mk]);

    if (!grupos.length) return null;

    return (
        <section className="mt-8">
            <div className="flex items-end justify-between gap-3 mb-2.5 px-1">
                <div className="min-w-0">
                    <h2 className={`flex items-center gap-2 text-[12.5px] font-black uppercase tracking-wider ${ink}`}>
                        <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
                        {t('mkt.monthUsage')}
                    </h2>
                    <p className={`text-[11.5px] mt-0.5 ${muted}`}>
                        {grupos.length} {t('mkt.products', { n: grupos.length })} · {comprasDoMes} {t('mkt.purchasesWord', { n: comprasDoMes })}
                    </p>
                </div>
                <div className="text-right shrink-0">
                    <span className={`block text-[10.5px] font-black uppercase tracking-wider ${muted}`}>{t('mkt.monthTotal')}</span>
                    <span className="text-[19px] font-black tabular-nums text-emerald-500">R$ {money(totalMes)}</span>
                </div>
            </div>

            <ul className={`rounded-2xl border overflow-hidden ${line} ${isDark ? 'bg-white/[0.02]' : 'bg-white'}`}>
                {grupos.map((g, idx) => (
                    <LinhaConsumo key={g.chave} g={g} isDark={isDark} money={money} t={t}
                        primeira={idx === 0} onAbrir={() => setEditando(g)} />
                ))}
            </ul>

            <p className={`text-[11px] mt-2 px-1 leading-relaxed ${muted}`}>{t('mkt.monthUsageHint')}</p>

            {editando && (
                <FolhaJuntar isDark={isDark} uid={uid} alvo={editando} grupos={grupos}
                    apelidos={apelidos} onClose={() => setEditando(null)} />
            )}
        </section>
    );
}

// ── Uma linha ───────────────────────────────────────────────────────
// Duas informações por linha, nesta ordem: quanto entrou e quanto custou.
// O último preço vem abaixo porque é o que se consulta NA prateleira.
function LinhaConsumo({ g, isDark, money, t, primeira, onAbrir }) {
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const ink = isDark ? 'text-white' : 'text-slate-800';

    const qtds = g.quantidades.map(q => formataQtd(q.qtd, q.base)).join(' + ');

    return (
        <li className={primeira ? '' : `border-t ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}>
            <button onClick={onAbrir}
                className={`w-full text-left px-3.5 py-3 min-h-[58px] transition ${isDark ? 'active:bg-white/[0.05]' : 'active:bg-slate-100'}`}>
                <div className="flex items-baseline gap-3">
                    <span className={`text-[14.5px] font-bold truncate flex-1 ${ink}`}>{g.rotulo}</span>
                    <span className={`text-[14px] font-black tabular-nums shrink-0 ${ink}`}>R$ {money(g.gasto)}</span>
                </div>
                <div className={`flex items-baseline gap-2 mt-1 text-[11.5px] ${muted}`}>
                    <span className="font-bold text-emerald-500 shrink-0">{qtds}</span>
                    {/* Quantos nomes diferentes caíram aqui: é o sinal de que
                        a junção está funcionando, e de onde ela veio. */}
                    {g.nomes.length > 1 && (
                        <span className="inline-flex items-center gap-1 shrink-0">
                            <Merge className="w-3 h-3" /> {g.nomes.length}
                        </span>
                    )}
                    {g.ultimo && (
                        <span className="truncate ml-auto text-right">
                            {t('mkt.lastPaid')} R$ {money(g.ultimo.preco)}
                            {g.ultimo.store ? ` · ${g.ultimo.store}` : ''}
                        </span>
                    )}
                </div>
            </button>
        </li>
    );
}

// ── Folha de juntar e renomear ──────────────────────────────────────
// Onde o automático errou, a pessoa conserta. A correção é gravada como
// uma seta (esta chave → aquela chave) e vale daí em diante, para trás e
// para frente — não é um remendo numa compra só.
function FolhaJuntar({ isDark, uid, alvo, grupos, apelidos, onClose }) {
    const { t } = useI18n();
    const [busca, setBusca] = useState('');
    const [rotulo, setRotulo] = useState(alvo.rotulo);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const ink = isDark ? 'text-white' : 'text-slate-800';
    const line = isDark ? 'border-white/[0.07]' : 'border-slate-200';

    const outros = useMemo(() => grupos
        .filter(g => g.chave !== alvo.chave)
        .filter(g => !busca.trim() || g.rotulo.toLowerCase().includes(busca.trim().toLowerCase())),
        [grupos, alvo, busca]);

    // Quais chaves foram juntadas DENTRO desta: é o que o "separar" desfaz.
    const juntadas = useMemo(() => Object.entries(apelidos?.mapa || {})
        .filter(([de, _]) => de !== alvo.chave && resolveChave(de, apelidos?.mapa) === alvo.chave)
        .map(([de]) => de), [apelidos, alvo]);

    const ref = () => doc(db, 'market_aliases', uid);

    const juntarCom = async (destino) => {
        if (busy) return;
        setBusy(true);
        try {
            await setDoc(ref(), {
                userId: uid,
                mapa: { ...(apelidos?.mapa || {}), [alvo.chave]: destino.chave },
            }, { merge: true });
            toast.success(t('mkt.merged', { a: alvo.rotulo, b: destino.rotulo }));
            onClose();
        } catch (e) {
            console.error(e);
            toast.error(t('mkt.mergeFail'));
            setBusy(false);
        }
    };

    const salvarRotulo = async () => {
        const novo = rotulo.trim();
        if (busy || !novo || novo === alvo.rotulo) return;
        setBusy(true);
        try {
            await setDoc(ref(), {
                userId: uid,
                rotulos: { ...(apelidos?.rotulos || {}), [alvo.chave]: novo },
            }, { merge: true });
            toast.success(t('mkt.renamed'));
            onClose();
        } catch (e) {
            console.error(e);
            toast.error(t('mkt.mergeFail'));
            setBusy(false);
        }
    };

    const separar = async () => {
        if (busy || !juntadas.length) return;
        setBusy(true);
        try {
            const apagar = {};
            juntadas.forEach(k => { apagar[`mapa.${k}`] = deleteField(); });
            await updateDoc(ref(), apagar);
            toast.success(t('mkt.unmerged'));
            onClose();
        } catch (e) {
            console.error(e);
            toast.error(t('mkt.mergeFail'));
            setBusy(false);
        }
    };

    const inputCls = `w-full px-3.5 py-3 rounded-xl border text-[15px] outline-none transition focus:border-emerald-500 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`;

    return (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border ${line} ${isDark ? 'bg-[#0b110e]' : 'bg-white'} max-h-[88vh] flex flex-col`}>
                <header className={`flex items-center gap-3 px-4 py-3 border-b ${line} shrink-0`}>
                    <h3 className={`text-[15px] font-black truncate ${ink}`}>{alvo.rotulo}</h3>
                    <button onClick={onClose} aria-label={t('common.close')}
                        className={`ml-auto p-2 -mr-1 rounded-xl transition ${muted} hover:text-rose-500 active:scale-90`}>
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <div className="overflow-y-auto px-4 py-4">
                    {/* Os nomes que o cupom usou. Mostrar isto é o que faz a
                        junção parecer confiável: dá para conferir. */}
                    {alvo.nomes.length > 1 && (
                        <div className={`mb-4 rounded-xl border px-3 py-2.5 ${line}`}>
                            <p className={`text-[10.5px] font-black uppercase tracking-wider mb-1.5 ${muted}`}>{t('mkt.mergedNames')}</p>
                            <ul className={`text-[12px] space-y-0.5 ${muted}`}>
                                {alvo.nomes.map(n => <li key={n} className="truncate">· {n}</li>)}
                            </ul>
                        </div>
                    )}

                    <label className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider mb-1.5 ${muted}`}>
                        <Tag className="w-3.5 h-3.5" /> {t('mkt.displayName')}
                    </label>
                    <div className="flex gap-2">
                        <input value={rotulo} onChange={(e) => setRotulo(e.target.value)} className={inputCls} />
                        <button onClick={salvarRotulo} disabled={busy || !rotulo.trim() || rotulo.trim() === alvo.rotulo}
                            className="px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 text-white text-[13px] font-black transition active:scale-95 shrink-0">
                            <Check className="w-4 h-4" strokeWidth={3} />
                        </button>
                    </div>

                    {juntadas.length > 0 && (
                        <button onClick={separar} disabled={busy}
                            className={`mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-[12.5px] font-bold transition active:scale-[0.99] ${line} ${muted} hover:text-rose-500`}>
                            <Undo2 className="w-4 h-4" /> {t('mkt.unmerge', { n: juntadas.length })}
                        </button>
                    )}

                    <p className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider mt-5 mb-1.5 ${muted}`}>
                        <Merge className="w-3.5 h-3.5" /> {t('mkt.mergeInto')}
                    </p>
                    <p className={`text-[11.5px] mb-2.5 leading-relaxed ${muted}`}>{t('mkt.mergeHint')}</p>

                    {grupos.length > 8 && (
                        <div className="relative mb-2">
                            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${muted}`} />
                            <input value={busca} onChange={(e) => setBusca(e.target.value)}
                                placeholder={t('common.search')} className={`${inputCls} pl-9`} />
                        </div>
                    )}

                    {outros.length === 0 ? (
                        <p className={`text-[12.5px] py-3 text-center ${muted}`}>{t('mkt.mergeNothing')}</p>
                    ) : (
                        <ul className={`rounded-xl border overflow-hidden ${line}`}>
                            {outros.map((g, idx) => (
                                <li key={g.chave} className={idx ? `border-t ${line}` : ''}>
                                    <button onClick={() => juntarCom(g)} disabled={busy}
                                        className={`w-full text-left px-3 py-3 min-h-[52px] flex items-center gap-2 transition disabled:opacity-40 ${isDark ? 'active:bg-white/[0.05]' : 'active:bg-slate-100'}`}>
                                        <span className={`text-[13.5px] font-bold truncate flex-1 ${ink}`}>{g.rotulo}</span>
                                        <Merge className="w-4 h-4 text-emerald-500 shrink-0" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
