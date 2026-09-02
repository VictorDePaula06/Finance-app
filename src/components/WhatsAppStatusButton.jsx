import React from 'react';
import { MessageCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useWhatsAppStatus } from '../hooks/useWhatsAppStatus';

/**
 * CTA contextual de WhatsApp para a sidebar, com estados explícitos.
 *
 *  - CARREGANDO    → neutro/discreto, sem alerta (evita "piscar" pendência).
 *  - NÃO CONFIGURADO → destaque elegante em verde (identidade Alívia) + alerta.
 *  - CONECTADO     → discreto/"apagado", com selo de sucesso; ainda clicável (edição).
 *
 * Reutiliza o status compartilhado (useWhatsAppStatus) — mesma fonte da tela
 * de configuração. Ao clicar, chama `onOpen` (abre a configuração de WhatsApp).
 */
export default function WhatsAppStatusButton({ isDark, onOpen, active = false }) {
    const { loading, connected } = useWhatsAppStatus();
    const ring = isDark ? 'ring-[#0a0a0a]' : 'ring-white';

    const base = 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[13px] font-bold transition-all active:scale-[0.98]';

    // Enquanto carrega: estado neutro e silencioso (sem afirmar pendência),
    // mas ainda clicável — não trava o acesso à configuração se a verificação demorar.
    if (loading) {
        return (
            <button
                type="button"
                onClick={onOpen}
                title="WhatsApp"
                className={`${base} ${active ? 'bg-emerald-500/10 text-emerald-500' : (isDark ? 'text-slate-500 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-50')}`}
            >
                <MessageCircle className="w-[18px] h-[18px] shrink-0" />
                <span className="truncate flex-1 text-left">WhatsApp</span>
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 opacity-70" />
            </button>
        );
    }

    // CONECTADO — discreto, concluído, com acesso à edição.
    if (connected) {
        return (
            <button
                type="button"
                onClick={onOpen}
                title="WhatsApp conectado — toque para editar"
                className={`${base} ${active ? 'bg-emerald-500/10 text-emerald-500' : (isDark ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800')}`}
            >
                <MessageCircle className="w-[18px] h-[18px] shrink-0" />
                <span className="truncate flex-1 text-left">WhatsApp conectado</span>
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            </button>
        );
    }

    // NÃO CONFIGURADO — CTA em verde com indicador de pendência (elegante).
    return (
        <button
            type="button"
            onClick={onOpen}
            title="Configurar WhatsApp"
            className={`${base} border bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/[0.16] shadow-sm`}
        >
            <span className="relative shrink-0 inline-flex">
                <MessageCircle className="w-[18px] h-[18px]" />
                <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ${ring} animate-pulse`} />
            </span>
            <span className="truncate flex-1 text-left">Configurar WhatsApp</span>
            <span className="shrink-0 w-4 h-4 rounded-full bg-amber-400/20 text-amber-500 flex items-center justify-center text-[11px] font-black leading-none">!</span>
        </button>
    );
}
