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
