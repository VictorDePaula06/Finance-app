import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/LanguageContext';
import { marketPrefs } from '../utils/market';
import { toast } from './ui/Toaster';
import logoMercado from '../assets/logo-mercado.png';
import { ShoppingBasket, ExternalLink, Check } from 'lucide-react';

// ── Mercado (Configurações › Cadastros) ─────────────────────────────
// Começa desmarcado. Só depois de marcar é que aparecem o teto e o atalho
// para a tela — quem não usa mercado não vê opção nenhuma.

export default function MarketSection({ isDark }) {
    const { t } = useI18n();
    const { userPrefs, saveUserPreferences } = useAuth();
    const salvo = marketPrefs(userPrefs);

    const [saving, setSaving] = useState(false);
    // `rascunho` só existe depois que a pessoa mexe. Enquanto é null, a tela
    // mostra o que está salvo — que chega depois do login — sem precisar de
    // efeito para sincronizar.
    const [rascunho, setRascunho] = useState(null);

    const salvoCeiling = salvo.ceiling != null ? String(salvo.ceiling).replace('.', ',') : '';
    const enabled = rascunho ? rascunho.enabled : salvo.enabled;
    const ceiling = rascunho ? rascunho.ceiling : salvoCeiling;

    const pendente = !!rascunho && (
        enabled !== salvo.enabled
        || (parseFloat(ceiling.replace(/\./g, '').replace(',', '.')) || null) !== salvo.ceiling
    );

    const mexer = (campo, valor) => setRascunho(r => ({
        enabled, ceiling, ...(r || {}), [campo]: valor,
    }));

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const ink = isDark ? 'text-white' : 'text-slate-800';
    const box = isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white';

    const salvar = async () => {
        setSaving(true);
        try {
            const n = parseFloat(ceiling.replace(/\./g, '').replace(',', '.'));
            await saveUserPreferences({
                manualConfig: {
                    ...(userPrefs?.manualConfig || {}),
                    market: { enabled, ceiling: enabled && n > 0 ? n : null },
                },
            });
            setRascunho(null);
            toast.success(t('common.saved'));
        } catch (e) {
            console.error(e);
            toast.error('Não foi possível salvar. Tente de novo.');
        }
        setSaving(false);
    };



    return (
        <div className={`rounded-2xl border p-5 sm:p-6 ${box}`}>
            <div className="flex items-start gap-3">
                <img src={logoMercado} alt="" aria-hidden="true" className="w-11 h-11 object-contain shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                    <h2 className={`text-[15px] font-black tracking-tight ${ink}`}>{t('mkt.title')}</h2>
                    <p className={`text-[12.5px] mt-0.5 ${muted}`}>{t('mkt.useMarketDesc')}</p>
                </div>
            </div>

            {/* A chave. Desmarcada por padrão. */}
            <label className={`mt-4 flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${enabled
                ? 'border-emerald-500/40 bg-emerald-500/[0.07]'
                : (isDark ? 'border-white/10 hover:bg-white/[0.03]' : 'border-slate-200 hover:bg-slate-50')}`}>
                <input type="checkbox" checked={enabled} onChange={(e) => mexer('enabled', e.target.checked)} className="sr-only" />
                <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${enabled
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : (isDark ? 'border-white/20' : 'border-slate-300')}`}>
                    {enabled && <Check className="w-3.5 h-3.5" strokeWidth={3.5} />}
                </span>
                <span className={`text-[13.5px] font-bold ${ink}`}>{t('mkt.useMarket')}</span>
            </label>

            {/* Só aparece depois de marcar. */}
            {enabled && (
                <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div>
                        <label htmlFor="mkt-ceiling" className={`block text-[11px] font-black uppercase tracking-wider mb-1.5 ${muted}`}>
                            {t('mkt.ceiling')}
                        </label>
                        <div className="relative max-w-xs">
                            <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-bold ${muted}`}>R$</span>
                            <input
                                id="mkt-ceiling" inputMode="decimal" value={ceiling}
                                onChange={(e) => mexer('ceiling', e.target.value.replace(/[^\d.,]/g, ''))}
                                placeholder="0,00"
                                className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-[14px] font-bold outline-none transition focus:border-emerald-500 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`} />
                        </div>
                        <p className={`text-[11.5px] mt-1.5 ${muted}`}>{t('mkt.ceilingHint')}</p>
                    </div>

                    {/* A tela de mercado é própria e em tela cheia, então abre noutra aba. */}
                    <a href="/mercado" target="_blank" rel="noopener noreferrer"
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold border transition active:scale-95 ${isDark ? 'border-white/10 text-slate-200 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                        <ShoppingBasket className="w-4 h-4 text-emerald-500" />
                        {t('mkt.openScreen')}
                        <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                    </a>
                </div>
            )}

            {/* Botão de salvar só quando há alteração pendente. */}
            {pendente && (
                <div className="mt-4 flex justify-end animate-in fade-in duration-150">
                    <button onClick={salvar} disabled={saving}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-[13px] font-black transition active:scale-95">
                        {t('common.saveChanges')}
                    </button>
                </div>
            )}
        </div>
    );
}
