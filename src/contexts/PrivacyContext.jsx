import React, { createContext, useContext, useEffect, useState } from 'react';

// ── Modo privado ────────────────────────────────────────────────────
// Um olho só, na barra superior, que apaga TODOS os valores da tela — não
// apenas o saldo. É o botão de "alguém está olhando por cima do meu ombro".
//
// Quem faz o borrão é o CSS: ligamos a classe `valores-ocultos` no <html> e
// a folha de estilo desfoca todo número monetário dentro do <main>. Assim
// nenhum componente precisa saber que este modo existe — e nenhum vai
// esquecer de obedecer quando alguém criar um card novo.

const Ctx = createContext({ oculto: false, alternar: () => {} });
const CHAVE = 'aliviaValoresOcultos';
const CHAVE_DASH = 'aliviaDashCfg';

export function PrivacyProvider({ children }) {
    const [oculto, setOculto] = useState(() => {
        try {
            // Já escolheu alguma vez? Vale a escolha dela.
            const proprio = localStorage.getItem(CHAVE);
            if (proprio !== null) return proprio === '1';
            // Ainda não: vale "Ocultar saldo por padrão", das configurações do dashboard.
            return !!JSON.parse(localStorage.getItem(CHAVE_DASH) || '{}').ocultarSaldo;
        } catch { return false; }
    });

    useEffect(() => {
        document.documentElement.classList.toggle('valores-ocultos', oculto);
        try { localStorage.setItem(CHAVE, oculto ? '1' : '0'); } catch { /* modo privado */ }
    }, [oculto]);

    return <Ctx.Provider value={{ oculto, alternar: () => setOculto(v => !v) }}>{children}</Ctx.Provider>;
}

export const usePrivacy = () => useContext(Ctx);
