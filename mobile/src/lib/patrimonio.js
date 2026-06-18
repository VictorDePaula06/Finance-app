// Valuation do módulo Patrimônio (portado de src/utils/investmentValue.js,
// versão mobile sem cotação ao vivo — usa preço manual / preço de compra).

const num = (v) => {
  const n = parseFloat(typeof v === 'string' ? v.replace(',', '.') : v);
  return Number.isFinite(n) ? n : 0;
};
const safe = (v) => (Number.isFinite(v) ? v : 0);

// Valor investido (custo) e valor atual de UM investimento, em BRL.
export function investmentMetrics(inv, { usdRate = 5 } = {}) {
  if (!inv) return { invested: 0, current: 0 };
  const usdM = inv.isUSD ? num(usdRate) || 5 : 1;

  if (inv.type === 'renda_fixa') {
    const applied = num(inv.totalApplied) || num(inv.quantity) * num(inv.purchasePrice) || 0;
    const current = num(inv.manualCurrentPrice) || applied;
    return { invested: safe(applied), current: safe(current) };
  }

  const qty = num(inv.quantity);
  const invested = qty * num(inv.purchasePrice) * usdM;
  const price = num(inv.manualCurrentPrice) || num(inv.purchasePrice);
  return { invested: safe(invested), current: safe(qty * price * usdM) };
}

// Resumo da carteira: valor atual, custo, lucro, por classe.
export function summarizeInvestments(investments = [], opts = {}) {
  let current = 0, cost = 0;
  const byClass = {};
  investments.forEach((inv) => {
    const { invested, current: cur } = investmentMetrics(inv, opts);
    current += cur;
    cost += invested;
    const cls = inv.type || 'outros';
    byClass[cls] = (byClass[cls] || 0) + cur;
  });
  return { current, cost, byClass, count: investments.length, profit: current - cost };
}

// Rótulos amigáveis das classes de ativo.
export const ASSET_LABEL = {
  renda_fixa: 'Renda Fixa',
  acoes: 'Ações',
  etfs: 'ETFs',
  fiis: 'FIIs',
  crypto: 'Cripto',
  outros: 'Outros',
};
