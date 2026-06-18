import {
  Briefcase, Laptop, TrendingUp, Wallet, Home, Utensils, Car, Heart, BookOpen,
  Cat, Smile, CreditCard, Lock, Landmark, Gamepad2, ShoppingBag, Circle,
} from 'lucide-react';

// Mesmos ids de categoria do site (src/constants/categories.js) → rótulo, cor, ícone.
const M = {
  // Receitas
  salary: { label: 'Salário', color: '#34d399', Icon: Briefcase },
  freelance: { label: 'Freelance', color: '#60a5fa', Icon: Laptop },
  investment: { label: 'Investimento', color: '#34d399', Icon: TrendingUp },
  gift: { label: 'Presente', color: '#facc15', Icon: Wallet },
  vault_redemption: { label: 'Resgate Cofre', color: '#ca8a04', Icon: Lock },
  carryover: { label: 'Sobra de Mês', color: '#3b82f6', Icon: Wallet },
  initial_balance: { label: 'Saldo Inicial', color: '#10b981', Icon: Landmark },
  // Despesas
  housing: { label: 'Casa', color: '#fb7185', Icon: Home },
  food: { label: 'Alimentação', color: '#fb923c', Icon: Utensils },
  fast_food: { label: 'Fast Food', color: '#f59e0b', Icon: Utensils },
  transport: { label: 'Transporte', color: '#facc15', Icon: Car },
  health: { label: 'Saúde', color: '#f87171', Icon: Heart },
  education: { label: 'Educação', color: '#60a5fa', Icon: BookOpen },
  pets: { label: 'Pets', color: '#b45309', Icon: Cat },
  personal_care: { label: 'Cuidados', color: '#f9a8d4', Icon: Smile },
  subscriptions: { label: 'Assinaturas', color: '#c084fc', Icon: CreditCard },
  credit_card: { label: 'Cartão', color: '#8b5cf6', Icon: CreditCard },
  church: { label: 'Igreja', color: '#93c5fd', Icon: Heart },
  vault: { label: 'Cofre', color: '#ca8a04', Icon: Lock },
  loan: { label: 'Empréstimo', color: '#fb7185', Icon: Landmark },
  taxes: { label: 'Taxas', color: '#64748b', Icon: Landmark },
  leisure: { label: 'Lazer', color: '#818cf8', Icon: Gamepad2 },
  shopping: { label: 'Compras', color: '#f472b6', Icon: ShoppingBag },
  credit_card_bill: { label: 'Fatura Cartão', color: '#8b5cf6', Icon: CreditCard },
  conta_fixa: { label: 'Conta Fixa', color: '#6366f1', Icon: Home },
};

export const catMeta = (id) => M[id] || { label: 'Outro', color: '#94a3b8', Icon: Circle };

// Prioridade padrão por categoria (igual ao site: defaultPriority).
// essential = Essencial · comfort = Conforto · superfluous = Supérfluo.
const DEFAULT_PRIORITY = {
  housing: 'essential', food: 'essential', fast_food: 'superfluous', transport: 'essential',
  health: 'essential', education: 'essential', pets: 'comfort', personal_care: 'comfort',
  subscriptions: 'comfort', credit_card: 'comfort', church: 'essential', investment: 'essential',
  vault: 'essential', loan: 'essential', taxes: 'essential', leisure: 'superfluous',
  shopping: 'superfluous', credit_card_bill: 'essential', conta_fixa: 'essential', other: 'comfort',
};
export const defaultPriorityOf = (id) => DEFAULT_PRIORITY[id] || 'comfort';

// Categorias oferecidas no cadastro manual (mobile). Excluímos as gerenciadas
// pelo sistema (saldo inicial, sobra de mês, cofre, fatura) — essas seguem
// sendo criadas pela lógica própria, como no site.
const withMeta = (ids) => ids.map(id => ({ id, ...catMeta(id), defaultPriority: defaultPriorityOf(id) }));

export const INCOME_CATS = withMeta(['salary', 'freelance', 'investment', 'gift', 'other']);

export const EXPENSE_CATS = withMeta([
  'housing', 'food', 'fast_food', 'transport', 'health', 'education',
  'subscriptions', 'leisure', 'shopping', 'pets', 'personal_care',
  'church', 'conta_fixa', 'taxes', 'loan', 'other',
]);

// Rótulos/cores de prioridade (para chips no app).
export const PRIORITY_META = {
  essential: { label: 'Essencial', color: '#34d399' },
  comfort: { label: 'Conforto', color: '#f59e0b' },
  superfluous: { label: 'Supérfluo', color: '#fb7185' },
};
