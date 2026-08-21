import React from 'react';
import aliviaAvatar from '../assets/alivia/alivia-final.png';

// Faixa com o avatar da Alívia + uma frase, exibida no topo dos formulários
// quando eles são abertos pela consultora (onboarding). Deixa claro que foi
// ela quem "preparou" o cadastro.
export default function AliviaFormHint({ isDark, text }) {
    if (!text) return null;
    return (
        <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${isDark ? 'bg-emerald-500/[0.08] border border-emerald-500/25' : 'bg-emerald-50 border border-emerald-200'}`}>
            <img src={aliviaAvatar} alt="Alívia" className="w-8 h-8 rounded-full object-cover border-2 border-emerald-400 shrink-0" />
            <p className={`text-[12px] leading-snug font-semibold ${isDark ? 'text-emerald-200' : 'text-emerald-800'}`}>{text}</p>
        </div>
    );
}
