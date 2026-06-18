import {
  Briefcase, Laptop, Utensils, Car, Home, Gamepad2, ShoppingBag, Heart, Landmark, Repeat,
} from 'lucide-react';

// Categorias de exemplo (cor + ícone) — milestone 1, só para o layout.
export const CATS = {
  salary:    { label: 'Salário',     color: '#34d399', Icon: Briefcase },
  freelance: { label: 'Freelance',   color: '#60a5fa', Icon: Laptop },
  invest:    { label: 'Rendimentos', color: '#a855f7', Icon: Repeat },
  food:      { label: 'Alimentação', color: '#fb923c', Icon: Utensils },
  transport: { label: 'Transporte',  color: '#facc15', Icon: Car },
  housing:   { label: 'Moradia',     color: '#fb7185', Icon: Home },
  leisure:   { label: 'Lazer',       color: '#818cf8', Icon: Gamepad2 },
  shopping:  { label: 'Compras',     color: '#f472b6', Icon: ShoppingBag },
  health:    { label: 'Saúde',       color: '#f87171', Icon: Heart },
  other:     { label: 'Outro',       color: '#94a3b8', Icon: Landmark },
};

export const INCOME = [
  { id: 'i1', desc: 'Salário', cat: 'salary', amount: 5200, date: '05/jun' },
  { id: 'i2', desc: 'Projeto freelance', cat: 'freelance', amount: 1300, date: '12/jun' },
  { id: 'i3', desc: 'Rendimento da reserva', cat: 'invest', amount: 68.4, date: '15/jun' },
];

export const EXPENSES = [
  { id: 'e1', desc: 'Supermercado', cat: 'food', amount: 320.5, date: '14/jun', pay: 'Pix' },
  { id: 'e2', desc: 'Aluguel', cat: 'housing', amount: 1880, date: '01/jun', pay: 'Boleto', fixed: true },
  { id: 'e3', desc: 'Uber', cat: 'transport', amount: 47.9, date: '13/jun', pay: 'Crédito' },
  { id: 'e4', desc: 'Cinema', cat: 'leisure', amount: 64, date: '10/jun', pay: 'Crédito' },
  { id: 'e5', desc: 'Farmácia', cat: 'health', amount: 89.2, date: '08/jun', pay: 'Débito' },
  { id: 'e6', desc: 'Amazon', cat: 'shopping', amount: 213.9, date: '06/jun', pay: 'Crédito' },
  { id: 'e7', desc: 'iFood', cat: 'food', amount: 58.7, date: '15/jun', pay: 'Pix' },
];

export const CARD = {
  name: 'Nubank',
  brand: 'Mastercard',
  last4: '1111',
  holder: 'FELIPE LOPES',
  due: 15,
  invoice: 476.75,
  limit: 2500,
  parcelas: 349.19,
  assinaturas: 127.56,
  items: [
    { id: 'c1', desc: 'Amazon', cat: 'shopping', amount: 213.9, date: '06/jun' },
    { id: 'c2', desc: 'Uber', cat: 'transport', amount: 47.9, date: '13/jun' },
    { id: 'c3', desc: 'Cinema', cat: 'leisure', amount: 64, date: '10/jun' },
    { id: 'c4', desc: 'Netflix', cat: 'leisure', amount: 39.9, date: '08/jun', badge: 'Assinatura' },
    { id: 'c5', desc: 'iPhone', cat: 'shopping', amount: 110.15, date: '03/jun', badge: '2/12' },
  ],
};

// Evolução por dia (entradas/saídas) — exemplo para o gráfico de barras.
export const WEEK = [
  { d: 'Seg', inc: 0, exp: 120 },
  { d: 'Ter', inc: 1300, exp: 60 },
  { d: 'Qua', inc: 0, exp: 320 },
  { d: 'Qui', inc: 0, exp: 0 },
  { d: 'Sex', inc: 5200, exp: 210 },
  { d: 'Sáb', inc: 0, exp: 180 },
  { d: 'Dom', inc: 68, exp: 90 },
];
