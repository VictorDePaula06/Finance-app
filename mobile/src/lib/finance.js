// Lógica financeira PORTADA do site (src/utils/financialLogic.js + OverviewTab),
// para o app mobile mostrar exatamente os mesmos números do web.

export const getExpenseBasis = (config) => (config?.expenseBasis === 'caixa' ? 'caixa' : 'competencia');

export const isDebtPaymentTx = (t) => {
  if (!t) return false;
  if (t.source === 'debt') return true;
  const d = typeof t.description === 'string' ? t.description : '';
  return /^Pagamento de dívida:/.test(d);
};

const isPatrimonioReserveTx = (t) => {
  const d = typeof t?.description === 'string' ? t.description : '';
  return /^(Criação de Reserva|Aporte Reserva|Resgate\/Ajuste Reserva):/.test(d);
};

const isResetTx = (t) => t?.category === 'initial_balance' || t?.category === 'carryover';

export const txMonthKey = (t) => t.month || (t.date ? String(t.date).slice(0, 7) : '');

export const isMonthlyExpenseTx = (t, basis = 'competencia') => {
  if (!t || t.type !== 'expense') return false;
  if (t.category === 'investment' || t.category === 'vault') return false;
  if (isDebtPaymentTx(t)) return false;
  if (basis === 'caixa') return t.paymentMethod !== 'credito';
  return t.category !== 'credit_card_bill';
};

export const walletAffecting = (t) => {
  if (!t) return false;
  if (t.paymentMethod === 'credito') return false;
  if (isPatrimonioReserveTx(t)) return false;
  if (isDebtPaymentTx(t)) return false;
  return t.type === 'income' || t.type === 'expense';
};

// Saldo em carteira (acumulado desde o último reset) — idêntico ao site.
export const buildWalletLedger = (transactions, targetMonth) => {
  if (!transactions || transactions.length === 0) return { entries: [], finalBalance: 0 };
  const getRobustMonth = (t) => t.month || (t.date && typeof t.date === 'string' ? t.date.slice(0, 7) : '');
  const all = [...transactions]
    .filter(t => { const m = getRobustMonth(t); return m !== '' && (!targetMonth || m <= targetMonth); })
    .sort((a, b) => {
      const dayA = (a.date || '').slice(0, 10), dayB = (b.date || '').slice(0, 10);
      if (dayA !== dayB) return dayA < dayB ? -1 : 1;
      const cA = a.createdAt || new Date(a.date).getTime() || 0;
      const cB = b.createdAt || new Date(b.date).getTime() || 0;
      if (cA !== cB) return cA - cB;
      const aR = isResetTx(a), bR = isResetTx(b);
      if (aR && !bR) return -1; if (!aR && bR) return 1; return 0;
    });
  let running = 0;
  all.forEach(t => {
    const val = parseFloat(t.amount) || 0;
    if (isResetTx(t)) { running = t.type === 'expense' ? -val : val; return; }
    if (walletAffecting(t)) running += t.type === 'income' ? val : -val;
  });
  return { entries: all, finalBalance: running };
};

export const monthKeyNow = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
};

// Recebimentos do mês (ignora saldo inicial/sobra/resgate de cofre).
export const monthIncome = (transactions, monthKey) =>
  transactions.filter(t => t.type === 'income'
    && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category)
    && (t.month === monthKey || (t.date && String(t.date).startsWith(monthKey))))
    .reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);

// Gastos do mês conforme o regime.
export const monthExpense = (transactions, monthKey, basis = 'competencia') =>
  transactions.filter(t => isMonthlyExpenseTx(t, basis) && txMonthKey(t) === monthKey)
    .reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);

// Reserva total (cofrinhos com rendimento CDI) — aproxima o site.
export const reserveTotal = (savingsJars = [], cdiRate = 10.65) =>
  savingsJars.reduce((acc, jar) => {
    const cdiAnual = cdiRate / 100;
    const percent = (parseFloat(jar.cdiPercent) || 100) / 100;
    const dailyRate = Math.pow(1 + (cdiAnual * percent), 1 / 365) - 1;
    const last = jar.updatedAt ? new Date(jar.updatedAt) : (jar.createdAt ? new Date(jar.createdAt) : new Date());
    const diffDays = Math.max(0, (new Date() - last) / 86400000);
    return acc + (parseFloat(jar.balance) || 0) * Math.pow(1 + dailyRate, diffDays);
  }, 0);

// ── Fatura(s) de cartão em aberto (portado do OverviewTab) ──
const getInvoiceMonth = (dateStr, closingDay) => {
  const d = new Date(dateStr); if (isNaN(d.getTime())) return '';
  let month = d.getMonth(), year = d.getFullYear();
  if (d.getDate() > closingDay) { month += 1; if (month > 11) { month = 0; year += 1; } }
  return `${year}-${String(month + 1).padStart(2, '0')}`;
};
const isSubInInvoice = (subDay, invoiceMonth, closingDay) => {
  const [iy, im] = invoiceMonth.split('-').map(Number);
  const prevM = im === 1 ? 12 : im - 1, prevY = im === 1 ? iy - 1 : iy;
  const cur = new Date(iy, im - 1, subDay, 12), prev = new Date(prevY, prevM - 1, subDay, 12);
  return getInvoiceMonth(cur.toISOString(), closingDay) === invoiceMonth
    || getInvoiceMonth(prev.toISOString(), closingDay) === invoiceMonth;
};

export const computeInvoice = (cards = [], subscriptions = [], transactions = []) => {
  const now = new Date();
  let openTotal = 0; const allDues = [];
  (cards || []).forEach(card => {
    const closingDay = card.closingDay || ((card.dueDay - 7 > 0) ? card.dueDay - 7 : 25);
    const dueDay = card.dueDay || 10;
    const currInv = getInvoiceMonth(now.toISOString(), closingDay);
    const unpaid = transactions.filter(t => t.selectedCardId === card.id && t.invoiceStatus === 'unpaid');
    const subs = (subscriptions || []).filter(s => s.cardId === card.id).filter(s => {
      if (s.lastPaidMonth === currInv) return false;
      return isSubInInvoice(parseInt(s.day) || 1, currInv, closingDay);
    });
    const sum = unpaid.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0)
      + subs.reduce((a, s) => a + (parseFloat(s.value) || 0), 0);
    if (sum > 0.005) {
      const invMonths = unpaid.map(t => getInvoiceMonth(t.date || now.toISOString(), closingDay)).filter(Boolean);
      if (subs.length > 0) invMonths.push(currInv);
      invMonths.sort();
      const [iy, im] = (invMonths[0] || currInv).split('-').map(Number);
      openTotal += sum; allDues.push(new Date(iy, im - 1, dueDay));
    }
  });
  allDues.sort((a, b) => a - b);
  return { openTotal, openDue: allDues[0] || null, hasCards: (cards || []).length > 0 };
};

// ── Saúde Financeira (versão alinhada à régua do site: 3 pilares, 100 pts) ──
export const computeHealth = ({ income, expense, reserve, fixedExpenses }) => {
  const monthlyRef = fixedExpenses > 0 ? fixedExpenses : (expense > 0 ? expense : income * 0.7);
  const surplus = income - expense;
  // Pilar 1: sobra (30) — meta 20% da renda
  const surplusTarget = income * 0.20;
  let surplusScore = surplus <= 0 ? 0 : (surplusTarget <= 0 ? 30 : Math.min(1, surplus / surplusTarget) * 30);
  // Pilar 2: reserva (40) — meta 6 meses
  const reserveMonths = monthlyRef > 0 ? reserve / monthlyRef : 0;
  const reserveScore = Math.min(1, reserveMonths / 6) * 40;
  // Pilar 3: supérfluos (30) — sem detalhe de prioridade aqui, usa proporção gasto/renda
  const spentRatio = income > 0 ? expense / income : 1;
  const superfluousScore = Math.max(0, Math.min(1, (1 - spentRatio) / 0.5)) * 30;
  const score = Math.min(100, Math.round(surplusScore + reserveScore + superfluousScore));
  const statusLabel = score >= 80 ? 'Excelente' : score >= 60 ? 'Bom' : score >= 40 ? 'Atenção' : 'Crítico';
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#f43f5e';
  return {
    score, statusLabel, color, reserveMonths,
    pillars: [
      { label: 'Sobra', pct: Math.round((surplusScore / 30) * 100), color: '#10b981' },
      { label: 'Reserva', pct: Math.round((reserveScore / 40) * 100), color: '#eab308' },
      { label: 'Equilíbrio', pct: Math.round((superfluousScore / 30) * 100), color: '#3b82f6' },
    ],
  };
};

export const fmt = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDay = (iso) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const mm = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${String(d.getDate()).padStart(2, '0')}/${mm}`;
};
