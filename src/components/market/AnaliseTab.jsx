import React, { useMemo } from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import { analyze } from '../../utils/market';
import { Vazio } from './ListaTab';
import { TrendingUp, TrendingDown, Minus, Receipt, Target } from 'lucide-react';

// ── Aba Análise ─────────────────────────────────────────────────────
// Duas perguntas que a lista e o cupom não respondem sozinhos: para onde
// vai o dinheiro do mercado, e o que está ficando mais caro.

export default function AnaliseTab({ isDark, purchases, mk, ceiling }) {
    const { t, fmtMoney: money, fmtDate } = useI18n();
    const a = useMemo(() => analyze(purchases, mk, ceiling), [purchases, mk, ceiling]);

    const ink = isDark ? 'text-white' : 'text-slate-800';
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const line = isDark ? 'border-white/[0.07]' : 'border-slate-200';
    const card = `rounded-2xl border p-4 ${line} ${isDark ? 'bg-white/[0.02]' : 'bg-white'}`;

    if (!purchases.length) {
        return (
            <div className="max-w-3xl mx-auto w-full">
                <Cabecalho isDark={isDark} t={t} />
                <Vazio isDark={isDark} titulo={t('mkt.emptyAnalysis')} texto={t('mkt.emptyAnalysisDesc')} />
            </div>
        );
    }

    const estourou = a.ceilingPct != null && a.ceilingPct > 100;
    const maiorGasto = a.topProducts.length ? a.topProducts[0].total : 0;

    return (
        <div className="max-w-3xl mx-auto w-full">
            <Cabecalho isDark={isDark} t={t} />

            {/* Resumo do mês */}
            <div className="grid sm:grid-cols-2 gap-3 mb-6">
                <div className={card}>
                    <p className={`text-[11px] font-black uppercase tracking-wider ${muted}`}>{t('mkt.spentMonth')}</p>
                    <p className={`text-[26px] font-black tabular-nums mt-0.5 ${estourou ? 'text-rose-500' : 'text-emerald-500'}`}>
                        R$ {money(a.spentMonth)}
                    </p>
                    {a.ceilingPct != null ? (
                        <>
                            <div className={`mt-2.5 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                                <div className={`h-full rounded-full transition-all ${estourou ? 'bg-rose-500' : a.ceilingPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(100, a.ceilingPct)}%` }} />
                            </div>
                            <p className={`text-[11.5px] mt-1.5 ${muted}`}>
                                <span className={`font-bold ${estourou ? 'text-rose-500' : ''}`}>
                                    {a.ceilingPct.toLocaleString(undefined, { maximumFractionDigits: 0 })}%
                                </span> {t('mkt.ofCeiling')} · R$ {money(ceiling)}
                            </p>
                        </>
                    ) : (
                        <p className={`text-[11.5px] mt-2 flex items-center gap-1.5 ${muted}`}>
                            <Target className="w-3.5 h-3.5" /> {t('mkt.noCeiling')}
                        </p>
                    )}
                </div>

                <div className={card}>
                    <p className={`text-[11px] font-black uppercase tracking-wider ${muted}`}>{t('mkt.avgTicket')}</p>
                    <p className={`text-[26px] font-black tabular-nums mt-0.5 ${ink}`}>R$ {money(a.avgTicket)}</p>
                    <p className={`text-[11.5px] mt-2 flex items-center gap-1.5 ${muted}`}>
                        <Receipt className="w-3.5 h-3.5" />
                        {a.count} {t('mkt.purchaseCount', { n: a.count })}
                    </p>
                </div>
            </div>

            {/* Onde você mais gasta (mês corrente) */}
            {a.topProducts.length > 0 && (
                <section className="mb-6">
                    <h2 className={`text-[13px] font-black uppercase tracking-wider mb-2.5 ${ink}`}>{t('mkt.topProducts')}</h2>
                    <div className={`rounded-2xl border overflow-hidden ${line}`}>
                        {a.topProducts.slice(0, 8).map((p, i) => (
                            <div key={p.key} className={`px-4 py-2.5 ${i ? `border-t ${line}` : ''}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`text-[13px] font-bold truncate flex-1 ${ink}`}>{p.name}</span>
                                    <span className={`text-[11.5px] tabular-nums shrink-0 ${muted}`}>{p.qty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                    <span className={`text-[13px] font-black tabular-nums shrink-0 ${ink}`}>R$ {money(p.total)}</span>
                                </div>
                                <div className={`mt-1.5 h-1 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                                    <div className="h-full rounded-full bg-emerald-500"
                                        style={{ width: `${maiorGasto ? (p.total / maiorGasto) * 100 : 0}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Preço por produto — o que está subindo */}
            {a.priceWatch.length > 0 && (
                <section>
                    <h2 className={`text-[13px] font-black uppercase tracking-wider ${ink}`}>{t('mkt.priceWatch')}</h2>
                    <p className={`text-[11.5px] mt-0.5 mb-2.5 ${muted}`}>{t('mkt.priceWatchDesc')}</p>
                    <div className={`rounded-2xl border overflow-hidden ${line}`}>
                        {a.priceWatch.slice(0, 12).map((p, i) => {
                            const temVar = p.changePct != null && isFinite(p.changePct);
                            const subiu = temVar && p.changePct > 0.5;
                            const caiu = temVar && p.changePct < -0.5;
                            const Icon = subiu ? TrendingUp : caiu ? TrendingDown : Minus;
                            const tone = subiu ? 'text-rose-500' : caiu ? 'text-emerald-500' : muted;
                            return (
                                <div key={p.key} className={`flex items-center gap-3 px-4 py-2.5 ${i ? `border-t ${line}` : ''}`}>
                                    <span className="min-w-0 flex-1">
                                        <span className={`block text-[13px] font-bold truncate ${ink}`}>{p.name}</span>
                                        <span className={`block text-[11px] mt-0.5 ${muted}`}>
                                            {fmtDate(p.lastDate)} · {p.times} {t('mkt.timesBought', { n: p.times })}
                                        </span>
                                    </span>
                                    <span className="text-right shrink-0">
                                        <span className={`block text-[13px] font-black tabular-nums ${ink}`}>R$ {money(p.lastPrice)}</span>
                                        <span className={`flex items-center justify-end gap-1 text-[11px] font-bold tabular-nums mt-0.5 ${tone}`}>
                                            <Icon className="w-3 h-3" strokeWidth={2.6} />
                                            {temVar ? `${p.changePct > 0 ? '+' : ''}${p.changePct.toFixed(1)}%` : '—'}
                                        </span>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
}

function Cabecalho({ isDark, t }) {
    return (
        <header className="mb-5">
            <h1 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('mkt.analysisTitle')}</h1>
            <p className={`text-[13px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('mkt.analysisSubtitle')}</p>
        </header>
    );
}
