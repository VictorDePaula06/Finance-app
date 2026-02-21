import { Home, Utensils, Car, Heart, Gamepad2, ShoppingBag, Briefcase, Laptop, Circle, Wallet, TrendingUp, BookOpen, Cat, Smile, CreditCard, Landmark } from 'lucide-react';

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
        { id: 'education', label: 'Educação', icon: BookOpen, color: 'text-blue-400' },
        { id: 'pets', label: 'Pets', icon: Cat, color: 'text-amber-700' },
        { id: 'personal_care', label: 'Cuidados', icon: Smile, color: 'text-pink-300' },
        { id: 'subscriptions', label: 'Assinaturas', icon: CreditCard, color: 'text-purple-400' },
        { id: 'credit_card', label: 'Cartão', icon: CreditCard, color: 'text-violet-500' },
        { id: 'church', label: 'Igreja', icon: Heart, color: 'text-blue-300' },
        { id: 'investment', label: 'Investimento', icon: TrendingUp, color: 'text-emerald-400' },
        { id: 'loan', label: 'Empréstimo', icon: Landmark, color: 'text-rose-400' },
        { id: 'taxes', label: 'Taxas', icon: Landmark, color: 'text-slate-500' },
        { id: 'leisure', label: 'Lazer', icon: Gamepad2, color: 'text-indigo-400' },
        { id: 'shopping', label: 'Compras', icon: ShoppingBag, color: 'text-pink-400' },
        { id: 'other', label: 'Outro', icon: Circle, color: 'text-slate-400' }
    ]
};
