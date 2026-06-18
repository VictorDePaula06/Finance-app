// Valuation do módulo Patrimônio (portado de src/utils/investmentValue.js,
// versão mobile sem cotação ao vivo — usa preço manual / preço de compra).

const num = (v) => {
  const n = parseFloat(typeof v === 'string' ? v.replace(',', '.') : v);
  return Number.isFinite(n) ? n : 0;
};
const safe = (v) => (Number.isFinite(v) ? v : 0);

// Valor investido (custo) e valor atual de UM investimento, em BRL.
// Usa cotação ao vivo (livePrices) quando disponível, senão preço manual/compra.
export function investmentMetrics(inv, { usdRate = 5, livePrices = {} } = {}) {
  if (!inv) return { invested: 0, current: 0, unitPrice: 0 };
  const usdM = inv.isUSD ? num(livePrices.USD) || num(usdRate) || 5 : 1;

  if (inv.type === 'renda_fixa') {
    const applied = num(inv.totalApplied) || num(inv.quantity) * num(inv.purchasePrice) || 0;
    const current = num(inv.manualCurrentPrice) || applied;
    return { invested: safe(applied), current: safe(current), unitPrice: 0 };
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
  return { invested: safe(invested), current: safe(qty * price * usdM), unitPrice: price };
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

// Classes de ativo para o rebalanceamento (mesmo agrupamento do site).
export const REBAL_CLASSES = [
  { id: 'renda_fixa', label: 'Renda Fixa', types: ['renda_fixa'], hex: '#3b82f6' },
  { id: 'acoes', label: 'Ações e ETFs', types: ['acoes', 'etfs', 'stocks'], hex: '#a855f7' },
  { id: 'fiis', label: 'Fundos Imobiliários', types: ['fiis'], hex: '#10b981' },
  { id: 'crypto', label: 'Criptoativos', types: ['crypto', 'cripto'], hex: '#f59e0b' },
  { id: 'imoveis', label: 'Imóveis', types: ['imoveis', 'imovel'], hex: '#f43f5e' },
];

// Plano de rebalanceamento a partir do resumo (byClass) e dos alvos (% por classe).
export function buildRebalancePlan(byClass = {}, targets = {}) {
  const rows = REBAL_CLASSES.map((c) => ({
    ...c,
    current: c.types.reduce((a, t) => a + (byClass[t] || 0), 0),
    target: parseFloat(targets[c.id]) || 0,
  }));
  const total = rows.reduce((a, r) => a + r.current, 0);
  const sumTargets = rows.reduce((a, r) => a + r.target, 0);
  const detailed = rows.map((r) => {
    const currentPct = total > 0 ? (r.current / total) * 100 : 0;
    const targetPct = sumTargets > 0 ? (r.target / sumTargets) * 100 : 0;
    const targetValue = total * (targetPct / 100);
    return { ...r, currentPct, targetPct, targetValue, diff: targetValue - r.current };
  });
  const hasTargets = sumTargets > 0;
  return { rows: detailed, total, hasTargets };
}
