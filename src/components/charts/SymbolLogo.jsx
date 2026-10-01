import React, { useState } from 'react';

// ── Logo do ativo ───────────────────────────────────────────────────
// Cada classe tem uma fonte de imagem diferente e nenhuma cobre tudo, então
// o componente tenta em ordem e, se nada carregar, cai na inicial colorida —
// que é sempre legível e nunca deixa buraco na lista.

const ACCENT = {
    indices: '#6366f1', acoes_int: '#3b82f6', acoes_br: '#10b981',
    cripto: '#f59e0b', commodities: '#eab308', fiis: '#a855f7',
};

// Fontes por grupo, da mais específica para a mais genérica.
function sourcesFor(ticker, group) {
    const t = String(ticker || '').toUpperCase();
    if (!t) return [];
    if (group === 'cripto') {
        return [
            `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/128/color/${t.toLowerCase()}.png`,
            `https://assets.coincap.io/assets/icons/${t.toLowerCase()}@2x.png`,
        ];
    }
    if (group === 'acoes_br' || group === 'fiis') {
        // A primeira cobre a maior parte da B3; a segunda pega FIIs e papéis
        // menores que faltam nela.
        return [
            `https://financialmodelingprep.com/image-stock/${t}.SA.png`,
            `https://assets.parqet.com/logos/symbol/${t}.SA`,
            `https://assets.parqet.com/logos/symbol/${t}`,
        ];
    }
    if (group === 'acoes_int') {
        return [
            `https://financialmodelingprep.com/image-stock/${t}.png`,
            `https://assets.parqet.com/logos/symbol/${t}`,
        ];
    }
    return [];   // índices e commodities não têm logo que signifique algo
}

export default function SymbolLogo({ ticker, group, size = 16, className = '' }) {
    const sources = sourcesFor(ticker, group);
    // Guarda de QUAL ativo é a falha: trocar de ativo volta sozinho para a
    // primeira fonte, sem precisar de efeito para "resetar".
    const key = `${group}:${ticker}`;
    const [failed, setFailed] = useState({ key: null, step: 0 });
    const step = failed.key === key ? failed.step : 0;

    const src = sources[step];
    const px = `${size}px`;
    const accent = ACCENT[group] || '#64748b';

    if (!src) {
        return (
            <span
                className={`rounded-full flex items-center justify-center font-black text-white shrink-0 ${className}`}
                style={{ width: px, height: px, background: accent, fontSize: `${Math.round(size * 0.52)}px` }}
                aria-hidden="true"
            >
                {String(ticker || '?').slice(0, 1)}
            </span>
        );
    }

    return (
        <img
            src={src}
            alt=""
            aria-hidden="true"
            onError={() => setFailed({ key, step: step + 1 })}
            className={`rounded-full object-contain shrink-0 bg-white/5 ${className}`}
            style={{ width: px, height: px }}
        />
    );
}
