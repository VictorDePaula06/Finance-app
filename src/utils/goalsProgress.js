// Fonte única de cálculo das metas (coleção `expense_goals`).
// Usada pela aba Cadastros › Objetivos/Metas e pelo bloco "Minhas Metas" da Visão Geral,
// pra as duas nunca divergirem.

export const GOAL_TYPE_META = {
  categoria:   { short: 'Categoria',   auto: true,  color: '#10b981' },
  cartao:      { short: 'Cartão',      auto: true,  color: '#8b5cf6' },
  teto_mensal: { short: 'Teto mensal', auto: true,  color: '#f59e0b' },
  divida:      { short: 'Dívida',      auto: false, color: '#f43f5e' },
  economia:    { short: 'Economia',    auto: false, color: '#3b82f6' },
};
const metaOf = (type) => GOAL_TYPE_META[type] || GOAL_TYPE_META.categoria;

// Meses inteiros entre hoje e o prazo (mínimo 1 pra não dividir por zero).
const monthsUntil = (deadline) => {
  if (!deadline) return null;
  const d = new Date(deadline + 'T00:00:00');
  const now = new Date();
  if (isNaN(d)) return null;
  const months = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
  return Math.max(1, months);
};

/**
 * Calcula o progresso de UMA meta.
 * @param {object} g meta
 * @param {array}  monthExpenses despesas do mês corrente (type expense, sem credit_card_bill)
 */
export function goalProgress(g, monthExpenses = []) {
  const meta = metaOf(g.type);
  const target = Number(g.targetValue) || 0;

  let done = 0;
  if (g.type === 'categoria') {
    done = monthExpenses.filter(t => t.category === g.category).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
  } else if (g.type === 'cartao') {
    done = monthExpenses.filter(t => t.selectedCardId === g.cardId && t.paymentMethod === 'credito').reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
  } else if (g.type === 'teto_mensal') {
    done = monthExpenses.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
  } else {
    done = Number(g.progress) || 0; // dívida / economia (manual)
  }

  const pct = target > 0 ? Math.min(100, (done / target) * 100) : 0;
  const isCeiling = meta.auto;                 // teto: passar é RUIM
  const over = isCeiling && target > 0 && done > target;
  const near = isCeiling && !over && pct >= 80; // atenção antes de estourar
  const reached = !isCeiling && target > 0 && done >= target;
  const remaining = Math.max(0, target - done);

  // Ritmo (só longo prazo com prazo definido): quanto falta ÷ meses restantes.
  let monthlyNeeded = null, months = null;
  if (!isCeiling && g.deadline && remaining > 0) {
    months = monthsUntil(g.deadline);
    if (months) monthlyNeeded = remaining / months;
  }

  return { type: g.type, meta, target, done, pct, isCeiling, over, near, reached, remaining, monthlyNeeded, months, color: over ? '#f43f5e' : (reached ? '#10b981' : meta.color) };
}

// Só as despesas relevantes do mês corrente.
export function currentMonthExpenses(transactions = []) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  return transactions.filter(t => {
    const m = t.month || String(t.date || '').slice(0, 7);
    return t.type === 'expense' && m === currentMonth && t.category !== 'credit_card_bill';
  });
}
