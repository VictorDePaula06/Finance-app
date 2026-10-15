import React from 'react';

// ── Estado vazio ────────────────────────────────────────────────────
// Usado por Compras e Análise. Morava dentro de ListaTab, o que fazia as
// duas abas importarem a lista inteira para pegar uma caixa tracejada —
// e amarrava três telas num arquivo só.

export function Vazio({ isDark, titulo, texto, children }) {
    return (
        <div className={`rounded-2xl border border-dashed px-6 py-10 text-center ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <p className={`text-[14px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{titulo}</p>
            <p className={`text-[12.5px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{texto}</p>
            {children}
        </div>
    );
}

export default Vazio;
