import React, { useMemo } from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import { GROUPS, exchangeOf, pairLabel, compact, fmtPrice, fmtPct } from '../../utils/marketSeries';
import { isMarketOpen } from '../../utils/marketStream';
import SymbolLogo from './SymbolLogo';
import { ExternalLink, Sparkles } from 'lucide-react';

// ── Painel do ativo selecionado ─────────────────────────────────────
// Espelha o painel direito do TradingView: identificação, preço, situação do
// mercado, uma leitura do momento, estatísticas, desempenho por janela e
// sazonalidade. Tudo sai dos candles — nada aqui é estimado ou inventado.

const MONTHS_SHORT = (locale) => Array.from({ length: 12 }, (_, i) =>
    new Date(2020, i, 1).toLocaleDateString(locale, { month: 'short' }).replace('.', ''));

export default function SymbolPanel({ isDark, item, quote, candles, perf, season, signal, currency }) {
    const { t, locale } = useI18n();
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const soft = isDark ? 'text-slate-400' : 'text-slate-500';
    const line = isDark ? 'border-white/[0.07]' : 'border-slate-200';

    const meta = GROUPS[item?.group] || {};
    const open = item ? isMarketOpen(item.group) : false;

    const last = candles?.length ? candles[candles.length - 1] : null;
    const price = quote?.price ?? last?.c ?? null;
    const chg = quote?.change ?? null;
    const chgPct = quote?.changePercent ?? null;
    const up = (chgPct ?? 0) >= 0;

    const vol = last?.v ?? null;
    const vol30 = useMemo(() => {
        if (!candles?.length) return null;
        const s = candles.slice(-30).filter(k => isFinite(k.v));
        return s.length ? s.reduce((a, k) => a + k.v, 0) / s.length : null;
    }, [candles]);

    const months = useMemo(() => MONTHS_SHORT(locale), [locale]);
    // Percentual com o separador decimal do idioma escolhido.
    const pct1 = (x) => `${Math.abs(x ?? 0).toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
    const seasonMax = useMemo(
        () => Math.max(1, ...(season || []).map(s => Math.abs(s.avg ?? 0))),
        [season]);

    if (!item) return null;

    return (
        <div className="flex-1 min-h-0 overflow-y-auto">
            {/* Identificação */}
            <div className={`px-4 pt-4 pb-3 border-b ${line}`}>
                <div className="flex items-center gap-2.5">
                    <SymbolLogo ticker={item.ticker} group={item.group} size={24} />
                    <h2 className={`text-[15px] font-black tracking-tight truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {item.ticker}
                    </h2>
                </div>
                <p className={`text-[12px] mt-2 flex items-center gap-1.5 ${soft}`}>
                    <span className="truncate">{pairLabel(item.ticker, item.group, quote?.name)}</span>
                    <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                    <span className={`font-bold ${muted}`}>{exchangeOf(item.group)}</span>
                </p>
                <p className={`text-[11.5px] mt-1 ${muted}`}>{meta.label} · {meta.kind}</p>

                <div className="mt-3 flex items-baseline gap-2 flex-wrap">
                    <span className={`text-[26px] font-black tracking-tight tabular-nums ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {fmtPrice(price, locale)}
                    </span>
                    <span className={`text-[12px] font-bold ${muted}`}>{currency || meta.native}</span>
                    {chgPct != null && (
                        <span className={`text-[13px] font-black ${up ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {`${up ? '+' : ''}${fmtPrice(chg, locale)} ${fmtPct(chgPct, locale)}`}
                        </span>
                    )}
                </div>

                <p className={`text-[11.5px] mt-2 flex items-center gap-1.5 ${open ? 'text-emerald-500' : muted}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${open ? 'bg-emerald-500' : (isDark ? 'bg-slate-600' : 'bg-slate-300')}`} />
                    {t(open ? 'charts.marketOpen' : 'charts.marketClosed')}
                </p>
            </div>

            {/* Leitura da Alívia — onde o TradingView põe as notícias. */}
            {signal && (
                <div className="px-4 py-3">
                    <div className={`rounded-xl px-3 py-2.5 border ${isDark ? 'bg-emerald-500/[0.07] border-emerald-500/15' : 'bg-emerald-50 border-emerald-100'}`}>
                        <p className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                            <Sparkles className="w-3 h-3" /> {t('charts.analysis')}
                        </p>
                        <p className={`text-[12px] leading-relaxed mt-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            {`${pct1(signal.fromMax)} ${t('charts.fromHigh')} · ${pct1(signal.fromMin)} ${t('charts.fromLow')}.`}
                        </p>
                        <div className={`mt-2.5 h-1 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-white'}`}>
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(signal.position)}%` }} />
                        </div>
                    </div>
                </div>
            )}

            {/* Principais estatísticas */}
            <div className={`px-4 py-3 border-t ${line}`}>
                <h3 className={`text-[12.5px] font-black tracking-tight mb-2.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {t('charts.keyStats')}
                </h3>
                {[
                    [t('charts.volume'), compact(vol, locale)],
                    [t('charts.avgVolume'), compact(vol30, locale)],
                    [t('charts.rangePeriod'), signal ? `${fmtPrice(signal.min, locale)} — ${fmtPrice(signal.max, locale)}` : '—'],
                ].map(([k, val]) => (
                    <div key={k} className="flex items-center justify-between gap-3 py-[5px]">
                        <span className={`text-[12px] ${soft}`}>{k}</span>
                        <span className={`text-[12px] font-bold tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{val}</span>
                    </div>
                ))}
            </div>

            {/* Desempenho */}
            <div className={`px-4 py-3 border-t ${line}`}>
                <h3 className={`text-[12.5px] font-black tracking-tight mb-2.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {t('charts.performance')}
                </h3>
                <div className="grid grid-cols-3 gap-1.5">
                    {['1S', '1M', '3M', '6M', 'YTD', '1A'].map(k => {
                        const val = perf?.[k];
                        const has = val != null && isFinite(val);
                        const good = has && val >= 0;
                        return (
                            <div key={k} className={`rounded-lg py-2 text-center ${!has ? (isDark ? 'bg-white/[0.04]' : 'bg-slate-100')
                                : good ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                                <p className={`text-[13px] font-black tabular-nums ${!has ? muted : good ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {has ? fmtPct(val, locale) : '—'}
                                </p>
                                <p className={`text-[10px] font-bold mt-0.5 ${muted}`}>{k}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Sazonais */}
            <div className={`px-4 py-3 border-t ${line}`}>
                <h3 className={`text-[12.5px] font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {t('charts.seasonal')}
                </h3>
                <p className={`text-[11px] mt-0.5 mb-3 ${muted}`}>{t('charts.seasonalDesc')}</p>
                <div className="flex items-end justify-between gap-[3px] h-16">
                    {(season?.length ? season : Array.from({ length: 12 }, (_, i) => ({ month: i, avg: null }))).map(s => {
                        const has = s.avg != null && isFinite(s.avg);
                        const h = has ? Math.max(3, (Math.abs(s.avg) / seasonMax) * 26) : 3;
                        const good = has && s.avg >= 0;
                        return (
                            <div key={s.month} className="flex-1 flex flex-col items-center gap-1" title={has ? fmtPct(s.avg, locale) : '—'}>
                                <div className="h-[26px] w-full flex items-end">
                                    <div className="w-full rounded-t-sm" style={{ height: good ? h : 0, background: '#26a69a' }} />
                                </div>
                                <div className="h-[26px] w-full flex items-start">
                                    <div className="w-full rounded-b-sm" style={{ height: !good && has ? h : 0, background: '#ef5350' }} />
                                </div>
                                <span className={`text-[8.5px] font-bold ${muted}`}>{months[s.month].slice(0, 1).toUpperCase()}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
