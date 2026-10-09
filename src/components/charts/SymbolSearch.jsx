import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import { searchSymbols } from '../../utils/marketSearch';
import { GROUPS } from '../../utils/marketSeries';
import SymbolLogo from './SymbolLogo';
import { Search, X, Loader2 } from 'lucide-react';

// ── Pesquisa de símbolo ─────────────────────────────────────────────
// Uma barra só: a pessoa digita e escolhe. O grupo (cripto, ação, índice…)
// sai do próprio resultado — não é ela quem classifica.
//
// Setas ↑ ↓ andam na lista, Enter escolhe, Esc fecha.

// Referência estável: evita recalcular os derivados a cada tecla.
const NONE = [];

export default function SymbolSearch({ isDark, onPick, onClose, current }) {
    const { t } = useI18n();
    const [q, setQ] = useState('');
    // A resposta carrega o termo que a originou. O que a tela mostra é sempre
    // derivado disso, então nunca aparece resultado de uma busca anterior.
    const [res, setRes] = useState({ term: '', list: [] });
    const [cur, setCur] = useState({ term: '', i: 0 });
    const boxRef = useRef(null);

    const term = q.trim();
    const EMPTY = NONE;   // referência estável para "sem resultado"
    const results = res.term === term ? res.list : EMPTY;
    const busy = term.length > 0 && res.term !== term;
    const cursor = cur.term === term ? Math.min(cur.i, Math.max(0, results.length - 1)) : 0;
    const setCursor = (fn) => setCur(c => ({
        term,
        i: typeof fn === 'function' ? fn(c.term === term ? c.i : 0) : fn,
    }));

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const ink = isDark ? 'text-white' : 'text-slate-800';

    // Busca com respiro de 250ms: não dispara uma chamada por tecla.
    useEffect(() => {
        if (term.length < 1) return;
        const ctrl = new AbortController();
        const id = setTimeout(() => {
            searchSymbols(term, ctrl.signal)
                .then(list => setRes({ term, list }))
                .catch(e => { if (e?.name !== 'AbortError') setRes({ term, list: [] }); });
        }, 250);
        return () => { clearTimeout(id); ctrl.abort(); };
    }, [term]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Mantém o item sob o cursor visível ao navegar pelo teclado.
    useEffect(() => {
        const el = boxRef.current?.querySelector(`[data-i="${cursor}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [cursor]);

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(results.length - 1, c + 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
        if (e.key === 'Enter' && results[cursor]) { e.preventDefault(); onPick(results[cursor]); }
    };

    const hint = useMemo(() => {
        if (busy) return null;
        if (!term) return t('charts.searchHint');
        if (!results.length) return t('charts.searchEmpty');
        return null;
    }, [busy, term, results, t]);

    return (
        <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[10vh] animate-in fade-in duration-150"
            role="dialog" aria-modal="true" aria-label={t('charts.searchTitle')}>
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />

            <div className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#111614] border-white/10' : 'bg-white border-slate-200'}`}>
                <div className={`flex items-center justify-between px-5 py-3.5 border-b ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}>
                    <h2 className={`text-[15px] font-black tracking-tight ${ink}`}>{t('charts.searchTitle')}</h2>
                    <button onClick={onClose} aria-label={t('common.close') || 'Fechar'}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.07]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                        <X className="w-4 h-4" strokeWidth={2.4} />
                    </button>
                </div>

                <div className="px-5 pt-4 pb-3">
                    <div className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 transition focus-within:border-emerald-500 ${isDark ? 'bg-[#0a0e0c] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                        <Search className={`w-4 h-4 shrink-0 ${muted}`} strokeWidth={2.4} />
                        <input
                            autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
                            placeholder={t('charts.searchPlaceholder')}
                            className={`flex-1 min-w-0 bg-transparent outline-none text-[14px] font-semibold ${isDark ? 'text-white placeholder:text-slate-600' : 'text-slate-800 placeholder:text-slate-400'}`}
                        />
                        {busy && <Loader2 className={`w-4 h-4 animate-spin shrink-0 ${muted}`} />}
                        {!busy && q && (
                            <button onClick={() => setQ('')} aria-label={t('common.clear') || 'Limpar'}
                                className={`shrink-0 ${muted} hover:text-rose-500 transition`}>
                                <X className="w-3.5 h-3.5" strokeWidth={3} />
                            </button>
                        )}
                    </div>
                </div>

                <div ref={boxRef} className="max-h-[52vh] overflow-y-auto pb-2">
                    {hint && <p className={`px-5 py-8 text-center text-[13px] ${muted}`}>{hint}</p>}

                    {results.map((r, i) => {
                        const on = i === cursor;
                        const isCurrent = current && current.ticker === r.ticker && current.group === r.group;
                        return (
                            <button
                                key={`${r.group}:${r.ticker}`} data-i={i} type="button"
                                onMouseEnter={() => setCursor(i)} onClick={() => onPick(r)}
                                className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition border-l-2 ${on
                                    ? (isDark ? 'bg-white/[0.06] border-l-emerald-500' : 'bg-emerald-50 border-l-emerald-500')
                                    : 'border-l-transparent'}`}>
                                <SymbolLogo ticker={r.ticker} group={r.group} size={24} />
                                <span className={`text-[13px] font-black w-24 shrink-0 truncate ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                                    {r.ticker}
                                </span>
                                <span className={`text-[13px] flex-1 min-w-0 truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                    {r.name}
                                </span>
                                <span className={`text-[11px] font-semibold shrink-0 hidden sm:block ${muted}`}>
                                    {GROUPS[r.group]?.kind}
                                </span>
                                <span className={`text-[11px] font-black shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {r.exchange}
                                </span>
                                {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
