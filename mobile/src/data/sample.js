// Dados de DEMONSTRAÇÃO no MESMO formato do Firestore — usados no "modo
// demonstração" (sem Firebase) para testar o app no emulador/navegador.
const now = new Date();
const Y = now.getFullYear();
const M = now.getMonth();
const pad = (n) => String(n).padStart(2, '0');
const dISO = (day) => new Date(Y, M, day, 12, 0, 0).toISOString();
const prevISO = (day) => new Date(Y, M - 1, day, 12, 0, 0).toISOString();
const mk = `${Y}-${pad(M + 1)}`;
const pmk = M === 0 ? `${Y - 1}-12` : `${Y}-${pad(M)}`;

export const DEMO = {
  user: { uid: 'demo', displayName: 'Felipe (Demo)', email: 'demo@alivia.app', photoURL: null },
  prefs: { manualConfig: { income: 6500, fixedExpenses: 2600 }, expenseBasis: 'competencia' },
  transactions: [
    { id: 't0', type: 'income', category: 'initial_balance', description: 'Saldo inicial', amount: 4000, date: prevISO(20), month: pmk },
    { id: 't1', type: 'income', category: 'salary', description: 'Salário', amount: 5200, date: dISO(5), month: mk },
    { id: 't2', type: 'income', category: 'freelance', description: 'Projeto freelance', amount: 1300, date: dISO(12), month: mk },
    { id: 't3', type: 'expense', category: 'housing', description: 'Aluguel', amount: 1880, date: dISO(1), month: mk, paymentMethod: 'boleto', isFixed: true },
    { id: 't4', type: 'expense', category: 'food', description: 'Supermercado', amount: 320.5, date: dISO(14), month: mk, paymentMethod: 'pix' },
    { id: 't5', type: 'expense', category: 'transport', description: 'Uber', amount: 47.9, date: dISO(13), month: mk, paymentMethod: 'credito', selectedCardId: 'card1', invoiceStatus: 'unpaid' },
    { id: 't6', type: 'expense', category: 'leisure', description: 'Cinema', amount: 64, date: dISO(10), month: mk, paymentMethod: 'credito', selectedCardId: 'card1', invoiceStatus: 'unpaid' },
    { id: 't7', type: 'expense', category: 'shopping', description: 'Amazon', amount: 213.9, date: dISO(6), month: mk, paymentMethod: 'credito', selectedCardId: 'card1', invoiceStatus: 'unpaid', installmentInfo: '2/12' },
    { id: 't8', type: 'expense', category: 'health', description: 'Farmácia', amount: 89.2, date: dISO(8), month: mk, paymentMethod: 'debito' },
  ],
  savings_jars: [
    { id: 'j1', name: 'Reserva de emergência', balance: 8500, cdiPercent: 100, createdAt: prevISO(1), updatedAt: dISO(1) },
  ],
  cards: [
    { id: 'card1', name: 'Nubank', brand: 'Mastercard', last4: '1111', holder: 'FELIPE LOPES', dueDay: 15, closingDay: 8, limit: 2500 },
  ],
  subscriptions: [
    { id: 's1', name: 'Netflix', value: 39.9, cardId: 'card1', type: 'recurring', category: 'subscriptions', day: 15 },
    { id: 's2', name: 'iPhone', value: 110.15, cardId: 'card1', type: 'installment', currentInstallment: 2, totalInstallments: 12, category: 'shopping', day: 15 },
  ],
  investments: [
    { id: 'i1', name: 'Tesouro Selic 2029', type: 'renda_fixa', totalApplied: 5000, manualCurrentPrice: 5240, createdAt: prevISO(10) },
    { id: 'i2', name: 'BOVA11', symbol: 'BOVA11', type: 'etfs', quantity: 20, purchasePrice: 100, manualCurrentPrice: 118, createdAt: prevISO(8) },
    { id: 'i3', name: 'Bitcoin', symbol: 'BTC', type: 'crypto', quantity: 0.01, purchasePrice: 280000, manualCurrentPrice: 350000, createdAt: prevISO(5) },
  ],
  goals: [
    { id: 'g1', title: 'Viagem de fim de ano', current: 1800, target: 6000, deadline: `${Y}-12-20`, status: 'active' },
    { id: 'g2', title: 'Troca de notebook', current: 2400, target: 6000, status: 'active' },
  ],
};
