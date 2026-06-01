import React, { useState } from 'react';
import { X, Sparkles, Check, ArrowRight, Lock, Loader2 } from 'lucide-react';
import { createCheckoutSession } from '../services/stripe';
import { useAuth } from '../contexts/AuthContext';
import { PLAN_RANK, GASTOS_FEATURES, PATRIMONIO_FEATURES, featureState } from '../constants/planFeatures';

const PRICE_IDS = {
    standard: {
        monthly: import.meta.env.VITE_STRIPE_PRICE_ID_STANDARD_MONTHLY || 'price_1TSMc3KAwb86obAG4jW02DAq',
        annual: import.meta.env.VITE_STRIPE_PRICE_ID_STANDARD_YEARLY || 'price_1TSMctKAwb86obAGj4BZqYtl',
    },
    premium: {
        monthly: import.meta.env.VITE_STRIPE_PRICE_ID_MONTHLY || 'price_1T89UOKAwb86obAGotiiOngV',
        annual: import.meta.env.VITE_STRIPE_PRICE_ID_YEARLY || 'price_1T89UMKAwb86obAGbk0dSm4Z',
    },
};

const PLANS = {
    standard: { name: 'Standard', tagline: 'Controle financeiro completo', priceMonthly: '9,90', priceAnnual: '7,90', accent: 'blue' },
    premium: { name: 'Premium', tagline: 'A experiência completa da Alívia', priceMonthly: '19,90', priceAnnual: '15,90', accent: 'emerald', recommended: true },
};

// Grupos de recursos (mesma fonte da tela de início).
const FEATURE_GROUPS = [
    { label: 'Controle de Gastos', items: GASTOS_FEATURES },
    { label: 'Construção de Patrimônio', items: PATRIMONIO_FEATURES },
];

export default function UpgradeModal({ isOpen, onClose }) {
    const { currentUser } = useAuth();
    const [billing, setBilling] = useState('monthly');
    const [loadingPlan, setLoadingPlan] = useState(null);

    if (!isOpen) return null;

    const handleCheckout = async (planKey) => {
        if (loadingPlan) return;
        setLoadingPlan(planKey);
        try {
            const priceId = PRICE_IDS[planKey][billing];
            await createCheckoutSession(currentUser.uid, priceId, () => setLoadingPlan(null));
        } catch (error) {
            console.error('Checkout Error:', error);
            alert('Erro ao iniciar a assinatura. Tente novamente.');
            setLoadingPlan(null);
        }
    };

    const accentMap = {
        blue: { ring: 'border-blue-200', chip: 'bg-blue-50 text-blue-600', btn: 'bg-blue-600 hover:bg-blue-700', check: 'text-blue-500' },
        emerald: { ring: 'border-emerald-300', chip: 'bg-emerald-50 text-emerald-600', btn: 'bg-emerald-600 hover:bg-emerald-700', check: 'text-emerald-500' },
    };

    const renderCard = (planKey) => {
        const plan = PLANS[planKey];
        const a = accentMap[plan.accent];
        const rank = PLAN_RANK[planKey] ?? 0;
        const isLoadingThis = loadingPlan === planKey;
        const price = billing === 'monthly' ? plan.priceMonthly : plan.priceAnnual;
        return (
            <div className={`relative flex flex-col rounded-3xl border-2 bg-white p-6 ${plan.recommended ? `${a.ring} shadow-xl` : 'border-slate-200 shadow-sm'}`}>
                {plan.recommended && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest shadow">Recomendado</span>
                )}
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${plan.accent === 'emerald' ? 'text-emerald-600' : 'text-blue-600'}`}>{plan.tagline}</p>
                <h3 className="text-2xl font-black text-slate-900">Plano {plan.name}</h3>
                <div className="flex items-baseline gap-1.5 mt-2 mb-5">
                    <span className="text-3xl font-black text-slate-900">R$ {price}</span>
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">/mês{billing === 'annual' ? ' (anual)' : ''}</span>
                </div>

                <div className="space-y-4 flex-1 mb-5">
                    {FEATURE_GROUPS.map(group => {
                        // Mostra apenas o que o plano OFERECE (itens incluídos).
                        const items = group.items.filter(feat => featureState(feat, rank).included);
                        if (items.length === 0) return null;
                        return (
                            <div key={group.label}>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">{group.label}</p>
                                <ul className="space-y-1.5">
                                    {items.map((feat, i) => {
                                        const { limited } = featureState(feat, rank);
                                        return (
                                            <li key={i} className="flex items-start gap-2">
                                                <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${a.check}`} />
                                                <span className="text-[11.5px] font-medium leading-snug text-slate-600">
                                                    {feat.text}
                                                    {limited && <span className="ml-1.5 align-middle text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Limitado</span>}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                </div>

                <button
                    onClick={() => handleCheckout(planKey)}
                    disabled={!!loadingPlan}
                    className={`w-full py-3.5 rounded-2xl text-white font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 ${a.btn}`}
                >
                    {isLoadingThis ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Assinar {plan.name} <ArrowRight className="w-4 h-4" /></>}
                </button>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
            <div className="bg-slate-50 rounded-[2rem] w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 duration-300 border border-slate-200" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-5 right-5 p-2 rounded-full bg-white text-slate-400 hover:text-slate-600 border border-slate-200 transition-all z-20">
                    <X className="w-5 h-5" />
                </button>

                <div className="p-6 md:p-8">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/20">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900">Escolha seu plano</h2>
                        <p className="text-sm text-slate-500 font-medium mt-1">Evolua quando precisar — você pode mudar ou cancelar a qualquer momento.</p>
                    </div>

                    {/* Toggle mensal/anual */}
                    <div className="flex gap-1.5 p-1 bg-slate-200/70 rounded-2xl mb-7 max-w-xs mx-auto">
                        <button onClick={() => setBilling('monthly')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${billing === 'monthly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Mensal</button>
                        <button onClick={() => setBilling('annual')} className={`relative flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${billing === 'annual' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                            Anual
                            <span className="absolute -top-2 -right-2 bg-emerald-500 text-[8px] text-white px-1.5 py-0.5 rounded-full font-black">-20%</span>
                        </button>
                    </div>

                    {/* Cards */}
                    <div className="grid md:grid-cols-2 gap-4">
                        {renderCard('standard')}
                        {renderCard('premium')}
                    </div>

                    <p className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-6 flex items-center justify-center gap-2">
                        <Lock className="w-3 h-3" /> Pagamento seguro via Stripe · Cancele quando quiser
                    </p>
                </div>
            </div>
        </div>
    );
}
