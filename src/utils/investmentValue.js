// Fonte ÚNICA de valuation do módulo Patrimônio.
// Todas as telas (Saúde Patrimonial, Visão Geral, Independência, etc.) devem usar
// estas funções para calcular valor atual/custo dos investimentos, total dos cofres
// e valor dos bens — evitando que o mesmo patrimônio apareça com números diferentes.

const num = (v) => {
    const n = parseFloat(typeof v === 'string' ? v.replace(',', '.') : v);
    return Number.isFinite(n) ? n : 0;
};
const safe = (v) => (Number.isFinite(v) ? v : 0);

/**
 * Valor investido (custo) e valor atual de UM investimento, em BRL.
 * - Variáveis (ações/ETFs/FIIs/cripto/imóveis): usa cotação ao vivo quando disponível
 *   (livePrices), senão preço manual, senão preço de compra. Converte USD→BRL.
 * - Renda fixa: usa valor atual manual; se houver taxa de compra e taxa atual
 *   (getTesouroRate), faz marcação a mercado aproximada; senão fica no valor aplicado.
 */
export function investmentMetrics(inv, { usdRate = 5, livePrices = {}, getTesouroRate = null } = {}) {
    if (!inv) return { invested: 0, current: 0 };
    const usdM = inv.isUSD ? (num(livePrices.USD) || num(usdRate) || 5) : 1;

    if (inv.type === 'renda_fixa') {
        const applied = num(inv.totalApplied) || (num(inv.quantity) * num(inv.purchasePrice)) || 0;
        let current = num(inv.manualCurrentPrice) || applied;
        const live = getTesouroRate ? getTesouroRate(inv.name) : null;
        const pRate = num(inv.purchaseRate) || num(inv.fixedRate);
        const cRate = live ? num(live.rate) : (num(inv.currentMarketRate) || num(inv.fixedRate));
        if (pRate > 0 && cRate > 0 && pRate !== cRate && !num(inv.manualCurrentPrice)) {
            current = applied * (pRate / cRate);
        }
        return { invested: safe(applied), current: safe(current) };
    }

    const qty = num(inv.quantity);
    const invested = qty * num(inv.purchasePrice) * usdM;
    let price = num(inv.manualCurrentPrice) || num(inv.purchasePrice);
    const sym = (inv.symbol || '').toUpperCase();
    if (inv.type === 'crypto' && sym) {
        if (inv.isUSD && livePrices[`${sym}_USD`]) price = num(livePrices[`${sym}_USD`]);
        else if (!inv.isUSD && livePrices[`${sym}_BRL`]) price = num(livePrices[`${sym}_BRL`]);
        else if (!inv.isUSD && livePrices[`${sym}_USD`] && (livePrices.USD || usdRate)) price = num(livePrices[`${sym}_USD`]) * (num(livePrices.USD) || num(usdRate));
    } else if (['acoes', 'etfs', 'fiis'].includes(inv.type) && sym && livePrices[sym]) {
        price = num(livePrices[sym]);
    }
    return { invested: safe(invested), current: safe(qty * price * usdM) };
}

/** Resumo da carteira de investimentos: valor atual, custo, por classe e lucro. */
export function summarizeInvestments(investments = [], opts = {}) {
    let current = 0, cost = 0;
    const byClass = {};
    investments.forEach(inv => {
        const { invested, current: cur } = investmentMetrics(inv, opts);
        current += cur;
        cost += invested;
        const cls = inv.type || 'outros';
        byClass[cls] = (byClass[cls] || 0) + cur;
    });
    return { current, cost, byClass, count: investments.length, profit: current - cost };
}

/**
 * Total dos cofres (reservas) com rendimento CDI desde a última atualização.
 * @param {number} cdiAnualPct taxa CDI anual em PERCENTUAL (ex.: 10.65).
 */
export function jarsDynamicTotal(jars = [], cdiAnualPct = 10.65) {
    const now = Date.now();
    return jars.reduce((acc, j) => {
        const cdiP = (num(j.cdiPercent) || 100) / 100;
        const dailyRate = Math.pow(1 + (num(cdiAnualPct) / 100) * cdiP, 1 / 365) - 1;
        const last = j.updatedAt ? new Date(j.updatedAt).getTime()
            : (j.createdAt ? new Date(j.createdAt).getTime() : now);
        const diffDays = Math.max(0, (now - last) / 86400000);
        const bal = num(j.balance) * Math.pow(1 + dailyRate, diffDays);
        return acc + safe(bal);
    }, 0);
}

/**
 * Valor de um bem tangível (imóvel/veículo) com prioridade de campos única.
 * `currentValue` é o valor atual JÁ calculado e persistido pela aba Bens & Imóveis
 * (manual, valorização do imóvel ou FIPE) — por isso tem prioridade.
 */
export function bemValue(a) {
    if (!a) return 0;
    const raw = (a.currentValue != null && a.currentValue !== '')
        ? a.currentValue
        : (a.manualCurrentValue != null && a.manualCurrentValue !== '')
            ? a.manualCurrentValue
            : (a.fipeValue ?? a.acquisitionValue ?? a.purchaseValue ?? 0);
    return safe(num(raw));
}

export const bensTotal = (assets = []) => assets.reduce((acc, a) => acc + bemValue(a), 0);
