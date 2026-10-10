import React, { createContext, useContext, useEffect, useState } from 'react';

// ── Preferências do Dashboard ───────────────────────────────────────
// Como o mês é apurado: a fatura entra nos gastos? o patrimônio líquido
// soma reservas e investimentos? qual a meta de reserva?
//
// Vive aqui, e não dentro do Dashboard, porque quem edita agora é a janela
// de Cadastros — e as duas telas precisam ver a MESMA configuração no mesmo
// instante. Com o estado dentro do Dashboard, mudar algo na janela só
// aparecia no próximo recarregamento.
//
// Fica no localStorage, não no Firestore: é preferência de visualização,
// não dado financeiro. Some ao trocar de aparelho, e tudo bem.

const CHAVE = 'aliviaDashCfg';

export const DASH_CFG_PADRAO = {
    incluirFatura: false,
    ocultarSaldo: false,
    somarReservas: true,
    somarInvest: true,
    metaReservaMeses: 6,
    considerarSuperfluo: true,
};

const Ctx = createContext({ cfg: DASH_CFG_PADRAO, salvar: () => {}, jaConfigurou: false });

export function DashCfgProvider({ children }) {
    const [estado, setEstado] = useState(() => {
        try {
            const bruto = localStorage.getItem(CHAVE);
            return { cfg: { ...DASH_CFG_PADRAO, ...JSON.parse(bruto || '{}') }, jaConfigurou: bruto !== null };
        } catch {
            return { cfg: DASH_CFG_PADRAO, jaConfigurou: false };
        }
    });

    // Outra aba do navegador mexeu? Acompanha, para as duas não divergirem.
    useEffect(() => {
        const ouvir = (e) => {
            if (e.key !== CHAVE) return;
            try { setEstado({ cfg: { ...DASH_CFG_PADRAO, ...JSON.parse(e.newValue || '{}') }, jaConfigurou: e.newValue !== null }); } catch { /* json torto */ }
        };
        window.addEventListener('storage', ouvir);
        return () => window.removeEventListener('storage', ouvir);
    }, []);

    const salvar = (proximo) => {
        setEstado({ cfg: proximo, jaConfigurou: true });
        try { localStorage.setItem(CHAVE, JSON.stringify(proximo)); } catch { /* modo privado */ }
    };

    return <Ctx.Provider value={{ ...estado, salvar }}>{children}</Ctx.Provider>;
}

export const useDashCfg = () => useContext(Ctx);
