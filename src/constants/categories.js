import { Home, Utensils, Car, Heart, Gamepad2, ShoppingBag, Briefcase, Laptop, Circle, Wallet, TrendingUp, BookOpen, Cat, Smile, CreditCard, Landmark, Lock } from 'lucide-react';

// Mapa das classes Tailwind de cor usadas nas categorias para o hex correspondente,
// para podermos pintar fundos/anéis coloridos (ícones em quadradinhos).
export const TW_HEX = {
    'text-rose-400': '#fb7185', 'text-orange-400': '#fb923c', 'text-amber-500': '#f59e0b',
    'text-amber-700': '#b45309', 'text-yellow-400': '#facc15', 'text-yellow-600': '#ca8a04',
    'text-red-400': '#f87171', 'text-blue-400': '#60a5fa', 'text-blue-300': '#93c5fd',
    'text-blue-500': '#3b82f6', 'text-pink-300': '#f9a8d4', 'text-pink-400': '#f472b6',
    'text-purple-400': '#c084fc', 'text-violet-500': '#8b5cf6', 'text-emerald-400': '#34d399',
    'text-emerald-500': '#10b981', 'text-indigo-400': '#818cf8', 'text-indigo-500': '#6366f1',
    'text-slate-400': '#94a3b8', 'text-slate-500': '#64748b',
};

// Retorna o hex da cor de uma categoria (fallback cinza).
export const categoryHex = (cat) => TW_HEX[cat?.color] || '#94a3b8';

export const CATEGORIES = {
    income: [
        { id: 'salary', label: 'Salário', icon: Briefcase, color: 'text-emerald-400' },
        { id: 'freelance', label: 'Freelance', icon: Laptop, color: 'text-blue-400' },
        { id: 'investment', label: 'Investim.', icon: TrendingUp, color: 'text-purple-400' },
        { id: 'gift', label: 'Presente', icon: Wallet, color: 'text-yellow-400' },
        { id: 'initial_balance', label: 'Saldo Inicial', icon: Landmark, color: 'text-emerald-500' },
        { id: 'carryover', label: 'Sobra de Mês', icon: Wallet, color: 'text-blue-500' },
        { id: 'vault_redemption', label: 'Resgate Cofre', icon: Lock, color: 'text-yellow-600' },
        { id: 'other', label: 'Outro', icon: Circle, color: 'text-slate-400' }
    ],
    expense: [
        { id: 'housing', label: 'Casa', icon: Home, color: 'text-rose-400', defaultPriority: 'essential' },
        { id: 'food', label: 'Alimentação', icon: Utensils, color: 'text-orange-400', defaultPriority: 'essential' },
        { id: 'fast_food', label: 'Fast Food', icon: Utensils, color: 'text-amber-500', defaultPriority: 'superfluous' },
        { id: 'transport', label: 'Transporte', icon: Car, color: 'text-yellow-400', defaultPriority: 'essential' },
        { id: 'health', label: 'Saúde', icon: Heart, color: 'text-red-400', defaultPriority: 'essential' },
        { id: 'education', label: 'Educação', icon: BookOpen, color: 'text-blue-400', defaultPriority: 'essential' },
        { id: 'pets', label: 'Pets', icon: Cat, color: 'text-amber-700', defaultPriority: 'comfort' },
        { id: 'personal_care', label: 'Cuidados', icon: Smile, color: 'text-pink-300', defaultPriority: 'comfort' },
        { id: 'subscriptions', label: 'Assinaturas', icon: CreditCard, color: 'text-purple-400', defaultPriority: 'comfort' },
        { id: 'credit_card', label: 'Cartão', icon: CreditCard, color: 'text-violet-500', defaultPriority: 'comfort' },
        { id: 'church', label: 'Igreja', icon: Heart, color: 'text-blue-300', defaultPriority: 'essential' },
        { id: 'investment', label: 'Investimento (Futuro)', icon: TrendingUp, color: 'text-emerald-400', defaultPriority: 'essential' },
        { id: 'vault', label: 'Cofre', icon: Lock, color: 'text-yellow-600', defaultPriority: 'essential' },
        { id: 'loan', label: 'Empréstimo', icon: Landmark, color: 'text-rose-400', defaultPriority: 'essential' },
        { id: 'taxes', label: 'Taxas', icon: Landmark, color: 'text-slate-500', defaultPriority: 'essential' },
        { id: 'leisure', label: 'Lazer', icon: Gamepad2, color: 'text-indigo-400', defaultPriority: 'superfluous' },
        { id: 'shopping', label: 'Compras', icon: ShoppingBag, color: 'text-pink-400', defaultPriority: 'superfluous' },
        { id: 'credit_card_bill', label: 'Fatura Cartão', icon: CreditCard, color: 'text-violet-500', defaultPriority: 'essential' },
        { id: 'conta_fixa', label: 'Conta Fixa', icon: Home, color: 'text-indigo-500', defaultPriority: 'essential' },
        { id: 'other', label: 'Outro', icon: Circle, color: 'text-slate-400', defaultPriority: 'comfort' }
    ]
};
