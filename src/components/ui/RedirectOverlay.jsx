import React, { useState, useRef, useEffect } from 'react';
import { Settings } from 'lucide-react';

// Janela rápida "Você será direcionado para…" com engrenagem girando.
// Padrão usado no Dashboard e em Meu cartão antes de trocar de tela.

// Nome amigável de cada destino.
export const DESTINO = {
    cartoes: 'Meu cartão', reservas: 'Reservas', patrimonio: 'Patrimônio', analises: 'Análises',
    whatsapp: 'WhatsApp', configuracoes: 'Configurações e Cadastros', cadastros: 'Cadastros',
    recorrentes: 'Recorrentes', lancamentos: 'Lançamentos', dashboard: 'Dashboard',
};

export default function RedirectOverlay({ isDark, label }) {
    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 animate-in fade-in duration-150" role="status" aria-live="polite">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div className={`relative w-full max-w-xs rounded-3xl border shadow-2xl px-6 py-7 text-center animate-in zoom-in-95 duration-200 ${isDark ? 'bg-[#141518] border-white/10' : 'bg-white border-slate-100'}`}>
                <span className="relative w-16 h-16 rounded-2xl bg-emerald-500/12 text-emerald-500 flex items-center justify-center mx-auto mb-4 ring-1 ring-emerald-500/20">
                    <Settings className="w-8 h-8 animate-[spin_1.6s_linear_infinite]" strokeWidth={2.2} />
                </span>
                <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Você será direcionado para</p>
                <p className={`text-lg font-black tracking-tight mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{label}</p>
                <div className={`mt-4 h-1 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                    <div className="h-full rounded-full bg-emerald-500 animate-[grow_0.8s_ease-out_forwards]" style={{ width: '100%', transformOrigin: 'left' }} />
                </div>
            </div>
            <style>{'@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}'}</style>
        </div>
    );
}

// Hook: mostra a janela por ~0,8s e então executa a navegação.
//   const { redirect, goTo } = useRedirect();  goTo('Meu cartão', () => navigate('/app/cartoes'));
//   {redirect && <RedirectOverlay isDark={isDark} label={redirect} />}
export function useRedirect(delay = 800) {
    const [redirect, setRedirect] = useState(null);
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);
    const goTo = (label, fn) => {
        if (redirect) return;
        setRedirect(label);
        timer.current = setTimeout(() => { setRedirect(null); fn?.(); }, delay);
    };
    return { redirect, goTo };
}
