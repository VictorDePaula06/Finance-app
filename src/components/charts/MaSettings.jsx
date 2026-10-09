import React, { useState } from 'react';
import { useI18n } from '../../contexts/LanguageContext';
import { X, Eye, EyeOff } from 'lucide-react';

// ── Configuração da média móvel ─────────────────────────────────────
// Abre com duplo clique na própria linha, como no TradingView. Dá para
// trocar o tipo, o período e a cor, ou esconder a média.

const PRESETS = [9, 20, 50, 100, 200];
const COLORS = ['#2962ff', '#f59e0b', '#a855f7', '#ef4444', '#10b981', '#64748b'];

export default function MaSettings({ isDark, value, onChange, onClose }) {
    const { t } = useI18n();
    const [draft, setDraft] = useState(value);

    const ink = isDark ? 'text-white' : 'text-slate-800';
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const line = isDark ? 'border-white/[0.07]' : 'border-slate-200';

    // Período só entra entre 1 e 500: abaixo não é média, acima não sobra
    // vela para desenhar em nenhuma janela.
    const setPeriod = (n) => setDraft(d => ({ ...d, period: Math.max(1, Math.min(500, Math.round(n) || 1)) }));

    const apply = () => { onChange(draft); onClose(); };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 animate-in fade-in duration-150"
            role="dialog" aria-modal="true" aria-label={t('charts.maTitle')}>
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />

            <div className={`relative w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#111614] border-white/10' : 'bg-white border-slate-200'}`}>
                <div className={`flex items-center justify-between px-5 py-3.5 border-b ${line}`}>
                    <h2 className={`text-[15px] font-black tracking-tight ${ink}`}>{t('charts.maTitle')}</h2>
                    <button onClick={onClose} aria-label={t('common.close')}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.07]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                        <X className="w-4 h-4" strokeWidth={2.4} />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-4">
                    {/* Tipo */}
                    <div>
                        <p className={`text-[11px] font-black uppercase tracking-wider mb-1.5 ${muted}`}>{t('charts.maType')}</p>
                        <div className={`inline-flex items-center p-1 rounded-xl border ${line}`}>
                            {['SMA', 'EMA'].map(ty => (
                                <button key={ty} onClick={() => setDraft(d => ({ ...d, type: ty }))}
                                    className={`px-4 py-1.5 rounded-lg text-[12px] font-bold transition ${draft.type === ty
                                        ? 'bg-emerald-500 text-white'
                                        : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700')}`}>
                                    {ty}
                                </button>
                            ))}
                        </div>
                        <p className={`text-[11px] mt-1.5 ${muted}`}>
                            {t(draft.type === 'EMA' ? 'charts.maEmaDesc' : 'charts.maSmaDesc')}
                        </p>
                    </div>

                    {/* Período */}
                    <div>
                        <p className={`text-[11px] font-black uppercase tracking-wider mb-1.5 ${muted}`}>{t('charts.maPeriod')}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {PRESETS.map(n => (
                                <button key={n} onClick={() => setPeriod(n)}
                                    className={`px-2.5 py-1.5 rounded-lg text-[12px] font-bold transition ${draft.period === n
                                        ? 'bg-emerald-500 text-white'
                                        : (isDark ? 'bg-white/[0.06] text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}`}>
                                    {n}
                                </button>
                            ))}
                            <input
                                type="number" min="1" max="500" value={draft.period}
                                onChange={(e) => setPeriod(+e.target.value)}
                                aria-label={t('charts.maPeriod')}
                                className={`w-20 px-2.5 py-1.5 rounded-lg border text-[12px] font-bold outline-none focus:border-emerald-500 ${isDark ? 'bg-[#0a0e0c] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`} />
                        </div>
                    </div>

                    {/* Cor */}
                    <div>
                        <p className={`text-[11px] font-black uppercase tracking-wider mb-1.5 ${muted}`}>{t('charts.maColor')}</p>
                        <div className="flex items-center gap-2">
                            {COLORS.map(c => (
                                <button key={c} onClick={() => setDraft(d => ({ ...d, color: c }))}
                                    aria-label={c}
                                    className={`w-7 h-7 rounded-full transition ${draft.color === c ? 'ring-2 ring-offset-2 ring-emerald-500 ' + (isDark ? 'ring-offset-[#111614]' : 'ring-offset-white') : ''}`}
                                    style={{ background: c }} />
                            ))}
                        </div>
                    </div>

                    {/* Mostrar / esconder */}
                    <button onClick={() => setDraft(d => ({ ...d, visible: !d.visible }))}
                        className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold border transition ${line} ${isDark ? 'text-slate-300 hover:bg-white/[0.05]' : 'text-slate-600 hover:bg-slate-50'}`}>
                        {draft.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        {t(draft.visible ? 'charts.maVisible' : 'charts.maHidden')}
                    </button>
                </div>

                <div className={`px-5 py-3 border-t ${line} flex items-center justify-end gap-2`}>
                    <button onClick={onClose}
                        className={`px-3.5 py-2 rounded-xl text-[12px] font-bold transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.06]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
                        {t('common.cancel')}
                    </button>
                    <button onClick={apply}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-black transition active:scale-95">
                        {t('common.save')}
                    </button>
                </div>
            </div>
        </div>
    );
}
