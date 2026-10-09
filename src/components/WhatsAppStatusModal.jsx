import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../contexts/LanguageContext';
import WhatsAppIcon from './ui/WhatsAppIcon';
import { X, Check, CheckCircle2, ExternalLink } from 'lucide-react';

// ── Janela de status do WhatsApp ────────────────────────────────────
// Só informa: que está conectado e qual é o número vinculado. Quem quer
// MUDAR alguma coisa vai pelo "Gerenciar", que leva para a aba de WhatsApp
// em Configurações e Cadastros.
//
// Morava dentro do Dashboard. Saiu de lá porque a barra superior passou a
// precisar dela também — e duas cópias da mesma janela divergem na primeira
// vez que alguém mexe numa delas.

// +55 (21) 99999-9999 — e, se o número não tiver esse formato, mostra os
// dígitos como vieram em vez de sumir com eles.
const fmtPhone = (p) => {
    const d = String(p || '').replace(/\D/g, '');
    const m = d.match(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/);
    return m ? `+${m[1]} (${m[2]}) ${m[3]}-${m[4]}` : (d ? `+${d}` : '');
};

export default function WhatsAppStatusModal({ isDark, phones = [], onClose, onManage }) {
    const { t } = useI18n();
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';

    // Esc fecha: aqui não há nada preenchido para se perder, é só leitura.
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Portal no <body>: a barra superior tem backdrop-blur, e um ancestral
    // com filter prenderia o `fixed` dentro dela.
    return createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            role="dialog" aria-modal="true" aria-label="WhatsApp">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative w-full max-w-sm rounded-3xl border shadow-2xl p-7 text-center animate-in zoom-in-95 fade-in duration-200 ${isDark ? 'bg-[#0e1210] border-white/10' : 'bg-white border-slate-100'}`}>
                <button onClick={onClose} aria-label={t('common.close')} className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><X className="w-4 h-4" /></button>

                {/* Ícone do WhatsApp em destaque */}
                <span className="relative w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center bg-[#25D366] text-white shadow-[0_0_40px_rgba(37,211,102,0.35)]">
                    <WhatsAppIcon className="w-10 h-10" />
                    <span className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-4 ${isDark ? 'ring-[#0e1210]' : 'ring-white'}`}><Check className="w-4 h-4" strokeWidth={3} /></span>
                </span>

                <p className={`text-[11px] font-black uppercase tracking-[0.22em] ${muted}`}>WhatsApp</p>
                <p className="text-3xl font-black tracking-tight text-emerald-500 mt-1 flex items-center justify-center gap-2"><CheckCircle2 className="w-7 h-7" /> {t('dash.waConnected')}</p>

                <div className={`mt-5 rounded-2xl border px-4 py-3.5 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>{t('dash.waLinkedNumber')}</p>
                    {phones.length === 0
                        ? <p className={`text-[15px] font-bold mt-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>—</p>
                        : phones.map(ph => <p key={ph} className={`text-[17px] font-black tabular-nums mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{fmtPhone(ph)}</p>)}
                </div>

                <p className={`text-[12.5px] mt-4 ${muted}`}>{t('dash.waReady')}</p>
                <button onClick={onManage} className={`mt-4 inline-flex items-center gap-1.5 text-[12px] font-bold transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                    {t('dash.waManage')} <ExternalLink className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>,
        document.body,
    );
}
