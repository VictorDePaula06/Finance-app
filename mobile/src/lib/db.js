// Builders dos documentos do Firestore — geram EXATAMENTE o mesmo formato que o
// site (src/components/TransactionSection.jsx, App.jsx e CardsTab.jsx), para que
// um lançamento feito no celular apareça correto na web e vice-versa.

// Converte 'YYYY-MM-DD' no horário de meio-dia local (igual ao site, evita pular
// de dia por fuso). Sem data válida, usa o instante atual.
function toIso(date) {
  if (typeof date === 'string' && date.includes('-')) {
    const [y, m, d] = date.split('-').map(Number);
    if (y && m && d) return new Date(y, m - 1, d, 12, 0, 0).toISOString();
  }
  return new Date().toISOString();
}

// Soma `n` meses a uma data ISO, mantendo meio-dia local. Retorna ISO.
function addMonthsIso(iso, n) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + n);
  return d.toISOString();
}

// Documento de transação (receita ou despesa). Para crédito no cartão, passe
// paymentMethod:'credito' + selectedCardId (entra na fatura como "em aberto").
export function buildTransactionDoc(input, uid) {
  const iso = toIso(input.date);
  const type = input.type === 'income' ? 'income' : 'expense';
  const isCard = type === 'expense' && input.paymentMethod === 'credito' && input.selectedCardId;

  // Compra no crédito → espelha o caminho do site (CardsTab.handleAddCardTransaction).
  if (isCard) {
    return {
      description: String(input.description || '').trim(),
      amount: parseFloat(input.amount) || 0,
      type: 'expense',
      category: input.category || 'shopping',
      priority: input.priority || 'comfort',
      date: iso,
      month: iso.slice(0, 7),
      userId: uid,
      createdAt: Date.now(),
      paymentMethod: 'credito',
      selectedCardId: input.selectedCardId,
      invoiceStatus: 'unpaid',
    };
  }

  // Receita ou despesa comum → espelha o formulário principal do site.
  const doc = {
    description: String(input.description || '').trim(),
    amount: parseFloat(input.amount) || 0,
    type,
    category: input.category,
    date: iso,
    month: iso.slice(0, 7),
    userId: uid,
    createdAt: Date.now(),
    isFixed: !!input.isFixed,
    linkedJarId: null,
    linkedInvestmentId: null,
  };
  // Prioridade (essencial/conforto/supérfluo) — só faz sentido em despesa.
  if (type === 'expense' && input.priority) doc.priority = input.priority;
  // Forma de pagamento (pix/debito/dinheiro) só quando informada — o site usa
  // paymentMethod !== 'credito' para saber que afeta a carteira.
  if (input.paymentMethod) doc.paymentMethod = input.paymentMethod;
  return doc;
}

// Gera UM OU MAIS documentos a partir de um lançamento, espelhando o site:
//  - parcelar (installments > 1): N docs, um por mês, descrição "(i/N)";
//    valor = total/N (modo 'total') ou valor cheio por mês (modo 'monthly').
//    No crédito, cada parcela leva installmentInfo "i/N".
//  - despesa fixa (isFixed): 12 docs mensais (igual ao site).
//  - caso simples: 1 doc.
export function buildTransactionDocs(input, uid) {
  const base = buildTransactionDoc(input, uid);
  const n = parseInt(input.installments) || 1;

  if (input.type !== 'income' && n > 1) {
    const total = parseFloat(input.amount) || 0;
    const perAmount = input.installmentMode === 'total' ? total / n : total;
    const onCard = !!base.selectedCardId;
    return Array.from({ length: n }, (_, i) => {
      const date = addMonthsIso(base.date, i);
      const doc = {
        ...base,
        amount: perAmount,
        description: `${base.description} (${i + 1}/${n})`,
        date,
        month: date.slice(0, 7),
      };
      if (onCard) doc.installmentInfo = `${i + 1}/${n}`;
      return doc;
    });
  }

  if (input.type !== 'income' && input.isFixed && !base.selectedCardId) {
    return Array.from({ length: 12 }, (_, i) => {
      const date = addMonthsIso(base.date, i);
      return { ...base, date, month: date.slice(0, 7) };
    });
  }

  return [base];
}

const numBR = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
const todayStr = () => new Date().toISOString().split('T')[0];
let aporteSeq = 0;
const genAporteId = () => `${Date.now()}_${aporteSeq++}`;

// Documento de investimento (coleção 'investments') — igual ao site (InvestmentsTab).
export function buildInvestmentDoc(input, uid) {
  const type = input.type || 'renda_fixa';
  const isRf = type === 'renda_fixa';
  const quantity = numBR(input.quantity) || 1;
  const purchasePrice = numBR(input.purchasePrice);
  const manualCurrentPrice = input.manualCurrentPrice !== '' && input.manualCurrentPrice != null ? numBR(input.manualCurrentPrice) : null;
  const cdiPercent = isRf ? (input.cdiPercent !== '' && input.cdiPercent != null ? numBR(input.cdiPercent) : null) : null;
  const totalApplied = isRf ? numBR(input.totalApplied || input.purchasePrice) : null;
  const purchaseDate = input.purchaseDate || todayStr();

  const aportes = isRf
    ? [{ id: genAporteId(), total: totalApplied || 0, rate: input.purchaseRate || null, date: purchaseDate, isUSD: !!input.isUSD }]
    : [{ id: genAporteId(), quantity, unitPrice: purchasePrice, total: quantity * purchasePrice, date: purchaseDate, isUSD: !!input.isUSD }];

  return {
    type,
    name: String(input.name || '').trim(),
    symbol: String(input.symbol || '').trim().toUpperCase(),
    quantity,
    purchasePrice,
    manualCurrentPrice,
    isUSD: !!input.isUSD,
    cdiPercent,
    totalApplied,
    purchaseDate,
    aportes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: uid,
  };
}

// Documento de reserva/cofre (coleção 'savings_jars') — igual ao site (EmergencyReserveTab).
export function buildJarDoc(input, uid) {
  return {
    type: input.type || 'tesouro',
    name: String(input.name || '').trim() || 'Reserva',
    balance: numBR(input.balance),
    cdiPercent: input.cdiPercent !== '' && input.cdiPercent != null ? numBR(input.cdiPercent) : 100,
    appliedValue: null,
    appliedDate: null,
    color: 'emerald',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: uid,
  };
}

// Documento de cartão (coleção 'cards') — igual ao site (CardsTab.handleAddCard).
export function buildCardDoc(input, uid) {
  const dueDay = parseInt(input.dueDay) || 10;
  return {
    name: String(input.name || '').trim(),
    color: input.color || 'bg-blue-600',
    last4: String(input.last4 || '').slice(0, 4),
    brand: input.brand || 'Visa',
    dueDay,
    closingDay: parseInt(input.closingDay) || (dueDay - 7 > 0 ? dueDay - 7 : 25),
    limit: parseFloat(input.limit) || null,
    userId: uid,
  };
}
