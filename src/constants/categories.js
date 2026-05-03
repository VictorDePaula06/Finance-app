import { Home, Utensils, Car, Heart, Gamepad2, ShoppingBag, Briefcase, Laptop, Circle, Wallet, TrendingUp, BookOpen, Cat, Smile, CreditCard, Landmark, Lock } from 'lucide-react';

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
        { id: 'other', label: 'Outro', icon: Circle, color: 'text-slate-400', defaultPriority: 'comfort' }
    ]
};
