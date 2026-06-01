import React, { useState } from 'react';
import {
    Lock as LockIcon, CheckCircle2, MessageSquare, LogOut, ArrowRight,
    Wallet, Sparkles, Activity, ShieldCheck, BarChart3, Landmark, Bot,
    FileText, Cloud, Globe, CreditCard, Gift, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createCheckoutSession } from '../services/stripe';
import { db } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import logo from '../assets/logo.png';

const MASTER_EMAIL = 'financealivia@gmail.com';

// Descrições centralizadas — fonte única de verdade para benefícios de cada plano.
const PLAN_FEATURES = {
    free: {
        title: 'Plano Gratuito',
        tagline: 'Comece sem pagar nada',
        priceMonthly: 'R$ 0,00',
        priceAnnual: 'R$ 0,00',
        color: 'slate',
        items: [
            { icon: Wallet,      text: 'Controle de Gastos completo' },
            { icon: CreditCard,  text: 'Até 1 cartão cadastrado' },
            { icon: FileText,    text: 'Até 10 lançamentos de despesa/mês' },
            { icon: Activity,    text: '5 recebimentos/mês · 2 contas fixas' },
            { icon: Cloud,       text: 'Sincronização na nuvem' },
            { icon: LockIcon,    text: 'Patrimônio limitado (1 reserva · 3 invest. · 2 bens)' },
            { icon: LockIcon,    text: 'Sem IA Alívia / Health Score completo' },
        ],
    },
    standard: {
        title: 'Plano Standard',
        tagline: 'Controle financeiro completo',
        priceMonthly: 'R$ 9,90',
        priceAnnual: 'R$ 7,90',
        color: 'blue',
        items: [
            { icon: Wallet,      text: 'Controle de Gastos sem limites' },
            { icon: CreditCard,  text: 'Cartões e parcelamentos ilimitados' },
            { icon: FileText,    text: 'Relatórios em PDF' },
            { icon: Cloud,       text: 'Sincronização nuvem + Mobile' },
            { icon: Globe,       text: 'Acesso Web & Mobile' },
            { icon: Landmark,    text: 'Módulo de Patrimônio (com limites)' },
            { icon: LockIcon,    text: 'Sem IA Alívia / Health Score completo' },
        ],
    },
    premium: {
        title: 'Plano Premium',
        tagline: 'A experiência completa da Alívia',
        priceMonthly: 'R$ 19,90',
        priceAnnual: 'R$ 15,90',
        color: 'emerald',
        items: [
            { icon: CheckCircle2, text: 'Tudo do Standard incluso' },
            { icon: Landmark,    text: 'Módulo Construção de Patrimônio' },
            { icon: Bot,         text: 'IA Alívia (Google Gemini)' },
            { icon: Activity,    text: 'Health Score completo' },
            { icon: BarChart3,   text: 'Evolução patrimonial + benchmarks' },
            { icon: ShieldCheck, text: 'Modo Pânico + alertas avançados' },
            { icon: MessageSquare, text: 'Suporte prioritário' },
        ],
    },
};

export default function SubscriptionBlock({ onAdminAccess }) {
    const { logout, currentUser } = useAuth();
    const [billing, setBilling] = useState('monthly'); // 'monthly' | 'annual'
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingPlan, setProcessingPlan] = useState(null);

    const handleChooseFree = async () => {
        if (!currentUser || isProcessing) return;
        setIsProcessing(true);
        setProcessingPlan('free');
        try {
            // Persiste a escolha no Firestore — AuthContext detecta status='free' e libera o app.
            const userRef = doc(db, 'users', currentUser.uid);
            await setDoc(userRef, {
                subscription: {
                    status: 'free',
                    type: 'free',
                    date: new Date(),
                    updatedAt: new Date(),
                    chosenByUser: true,
                }
            }, { merge: true });
            // O snapshot listener do AuthContext vai detectar e o app vai mudar de tela automaticamente.
        } catch (error) {
            console.error("Erro ao ativar plano gratuito:", error);
            alert("Erro ao ativar o plano gratuito. Tente novamente.");
            setIsProcessing(false);
            setProcessingPlan(null);
        }
    };

    const handleSubscribePaid = async (planKey) => {
        if (!currentUser || isProcessing) return;
        setIsProcessing(true);
        setProcessingPlan(planKey);
        try {
            let priceId;
            if (planKey === 'standard') {
                priceId = billing === 'monthly'
                    ? (import.meta.env.VITE_STRIPE_PRICE_ID_STANDARD_MONTHLY || 'price_1TdDzSKAwb86obAGI0gTmdWL')
                    : (import.meta.env.VITE_STRIPE_PRICE_ID_STANDARD_YEARLY || 'price_1TdE0LKAwb86obAGcpMPLgWw');
            } else {
                priceId = billing === 'monthly'
                    ? (import.meta.env.VITE_STRIPE_PRICE_ID_MONTHLY || 'price_1TdDwDKAwb86obAGnRhLwlIa')
                    : (import.meta.env.VITE_STRIPE_PRICE_ID_YEARLY || 'price_1TdE1VKAwb86obAGh2h7m4o6');
            }

            if (!priceId) {
                alert('Configuração de pagamento incompleta.');
                setIsProcessing(false);
                setProcessingPlan(null);
                return;
            }

            await createCheckoutSession(currentUser.uid, priceId, () => {
                setIsProcessing(false);
                setProcessingPlan(null);
            });
        } catch (error) {
            console.error("Checkout Error:", error);
            alert("Erro ao iniciar pagamento.");
            setIsProcessing(false);
            setProcessingPlan(null);
        }
    };

    // Cores por plano (Tailwind safelist necessária)
    const colorClasses = {
        slate:   { border: 'border-slate-300', bg: 'bg-slate-50', text: 'text-slate-700', btn: 'bg-slate-700 hover:bg-slate-800', ring: 'shadow-slate-900/10' },
        blue:    { border: 'border-blue-400',  bg: 'bg-blue-50',  text: 'text-blue-600',  btn: 'bg-blue-600 hover:bg-blue-700',  ring: 'shadow-blue-600/20' },
        emerald: { border: 'border-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-600', btn: 'bg-emerald-600 hover:bg-emerald-700', ring: 'shadow-emerald-600/20' },
    };

    const renderPlanCard = (planKey) => {
        const plan = PLAN_FEATURES[planKey];
        const c = colorClasses[plan.color];
        const isPremiumCard = planKey === 'premium';
        const isProcessingThis = isProcessing && processingPlan === planKey;

        return (
            <div
                key={planKey}
                className={`relative p-6 rounded-[2rem] border-2 bg-white transition-all flex flex-col ${
                    isPremiumCard ? `${c.border} shadow-2xl ${c.ring} scale-[1.02] z-10` : 'border-slate-200 shadow-lg'
                }`}
            >
                {isPremiumCard && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest shadow-lg">
                        Recomendado
                    </div>
                )}

                {/* Header */}
                <div className="mb-5">
                    <p className={`text-[10px] font-black uppercase tracking-[0.25em] mb-1 ${c.text}`}>{plan.tagline}</p>
                    <h3 className="text-2xl font-black text-slate-900">{plan.title}</h3>
                </div>

                {/* Price */}
                <div className="mb-6">
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-slate-900">
                            {billing === 'monthly' ? plan.priceMonthly : plan.priceAnnual}
                        </span>
                        {planKey !== 'free' && (
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">/mês</span>
                        )}
                    </div>
                    {planKey !== 'free' && billing === 'annual' && (
                        <p className="text-[10px] font-bold text-emerald-600 mt-1">Cobrado anualmente · economia de 20%</p>
                    )}
                    {planKey === 'free' && (
                        <p className="text-[10px] font-bold text-slate-500 mt-1">Para sempre · sem cartão de crédito</p>
                    )}
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.items.map((item, i) => {
                        const Icon = item.icon;
                        const isLock = item.icon === LockIcon;
                        return (
                            <li key={i} className="flex items-start gap-2.5">
                                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isLock ? 'text-slate-300' : c.text}`} />
                                <span className={`text-xs font-medium leading-snug ${isLock ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                    {item.text}
                                </span>
                            </li>
                        );
                    })}
                </ul>

                {/* CTA */}
                <button
                    onClick={() => planKey === 'free' ? handleChooseFree() : handleSubscribePaid(planKey)}
                    disabled={isProcessing}
                    className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white transition-all shadow-xl ${c.btn} ${c.ring} active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                >
                    {isProcessingThis ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            {planKey === 'free' ? 'Começar Gratuitamente' : 'Ativar Agora'}
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden flex flex-col items-center py-12 px-4 sm:px-6 notranslate selection:bg-emerald-500/30">
            {/* Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]"></div>

            <div className="max-w-6xl w-full relative z-10">
                {/* Header */}
                <div className="text-center mb-12">
                    <div
                        className="mb-8 cursor-help select-none"
                        onDoubleClick={() => {
                            if (currentUser?.email === MASTER_EMAIL && onAdminAccess) onAdminAccess();
                        }}
                    >
                        <img src={logo} alt="Logo" className="w-32 h-auto mx-auto drop-shadow-2xl" />
                    </div>

                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-200 text-xs font-black tracking-widest mb-6">
                        <Sparkles className="w-3.5 h-3.5" />
                        ESCOLHA SEU PLANO
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black mb-4 text-slate-900 tracking-tight leading-tight">
                        Sua jornada começa <br/>
                        <span className="text-emerald-500">no seu ritmo.</span>
                    </h1>
                    <p className="text-slate-500 text-base md:text-lg font-medium max-w-2xl mx-auto leading-relaxed">
                        Comece grátis e evolua quando precisar. Você pode mudar de plano a qualquer momento.
                    </p>
                </div>

                {/* Billing toggle */}
                <div className="flex gap-3 mb-10 p-1.5 bg-white rounded-[2rem] border border-slate-200 shadow-xl max-w-xs mx-auto">
                    <button
                        onClick={() => setBilling('monthly')}
                        className={`flex-1 py-3 rounded-[1.5rem] transition-all font-black text-xs uppercase tracking-widest ${billing === 'monthly' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Mensal
                    </button>
                    <button
                        onClick={() => setBilling('annual')}
                        className={`flex-1 py-3 rounded-[1.5rem] transition-all font-black text-xs uppercase tracking-widest relative ${billing === 'annual' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Anual
                        <span className="absolute -top-2.5 -right-2.5 bg-emerald-500 text-[8px] text-white px-2 py-0.5 rounded-full ring-4 ring-white font-black tracking-widest shadow-lg">
                            -20%
                        </span>
                    </button>
                </div>

                {/* Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 mb-10">
                    {renderPlanCard('free')}
                    {renderPlanCard('standard')}
                    {renderPlanCard('premium')}
                </div>

                {/* Disclaimer + extras */}
                <div className="flex flex-col items-center gap-6 mt-4">
                    <div className="flex items-center justify-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <LockIcon className="w-3 h-3" /> Pagamento seguro via Stripe · Cancele quando quiser
                    </div>

                    <a
                        href="https://wa.me/5521992152708"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-100 rounded-[1.5rem] text-slate-500 hover:text-emerald-500 transition-all text-xs font-bold shadow-sm"
                    >
                        <MessageSquare className="w-4 h-4 text-emerald-500" />
                        Falar com Consultor Humano
                    </a>

                    <button
                        onClick={logout}
                        className="text-slate-400 hover:text-rose-500 transition-colors text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2"
                    >
                        <LogOut className="w-3 h-3" />
                        Sair da minha conta
                    </button>
                </div>
            </div>

            <p className="mt-16 text-slate-300 text-[9px] font-black uppercase tracking-[0.4em] opacity-50">
                Alívia Financial Engineering &copy; 2026
            </p>
        </div>
    );
}
