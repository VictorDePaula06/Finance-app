import { Home, Utensils, Car, Heart, Gamepad2, ShoppingBag, Briefcase, Laptop, Circle, Wallet, TrendingUp } from 'lucide-react';

export const CATEGORIES = {
    income: [
        { id: 'salary', label: 'Salário', icon: Briefcase, color: 'text-emerald-400' },
        { id: 'freelance', label: 'Freelance', icon: Laptop, color: 'text-blue-400' },
        { id: 'investment', label: 'Investim.', icon: TrendingUp, color: 'text-purple-400' },
        { id: 'gift', label: 'Presente', icon: Wallet, color: 'text-yellow-400' },
        { id: 'other', label: 'Outro', icon: Circle, color: 'text-slate-400' }
    ],
    expense: [
        { id: 'housing', label: 'Casa', icon: Home, color: 'text-rose-400' },
        { id: 'food', label: 'Alimentação', icon: Utensils, color: 'text-orange-400' },
        { id: 'transport', label: 'Transporte', icon: Car, color: 'text-yellow-400' },
        { id: 'health', label: 'Saúde', icon: Heart, color: 'text-red-400' },
        { id: 'leisure', label: 'Lazer', icon: Gamepad2, color: 'text-indigo-400' },
        { id: 'shopping', label: 'Compras', icon: ShoppingBag, color: 'text-pink-400' },
        { id: 'other', label: 'Outro', icon: Circle, color: 'text-slate-400' }
    ]
};
