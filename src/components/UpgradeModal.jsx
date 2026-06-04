import React, { useState } from 'react';
import { X, Sparkles, Check, ArrowRight, Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { createCheckoutSession, upgradeSubscription } from '../services/stripe';
import { useAuth } from '../contexts/AuthContext';
import { PLAN_RANK, GASTOS_FEATURES, PATRIMONIO_FEATURES, featureState } from '../constants/planFeatures';

const PRICE_IDS = {
    standard: {
        monthly: import.meta.env.VITE_STRIPE_PRICE_ID_STANDARD_MONTHLY || 'price_1TdDzSKAwb86obAGI0gTmdWL',
        annual: import.meta.env.VITE_STRIPE_PRICE_ID_STANDARD_YEARLY || 'price_1TdE0LKAwb86obAGcpMPLgWw',
    },
    premium: {
        monthly: import.meta.env.VITE_STRIPE_PRICE_ID_MONTHLY || 'price_1TdDwDKAwb86obAGnRhLwlIa',
        annual: import.meta.env.VITE_STRIPE_PRICE_ID_YEARLY || 'price_1TdE1VKAwb86obAGh2h7m4o6',
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
    const { currentUser, planLevel, isAdmin, stripeSubId, subType } = useAuth();
    // Já assinante? Abre o seletor no MESMO ciclo da assinatura atual (anual/mensal),
    // pra o upgrade acontecer no mesmo intervalo por padrão.
    const [billing, setBilling] = useState(subType === 'annual' ? 'annual' : 'monthly');
    const [loadingPlan, setLoadingPlan] = useState(null);
    const [result, setResult] = useState(null); // { type: 'success' | 'error', message }

    if (!isOpen) return null;

    // Plano atual do usuário (free=0, standard=1, premium=2). Admin/vitalício = topo.
    const userRank = isAdmin ? 2 : (PLAN_RANK[planLevel] ?? 0);

    // Já é assinante pago no Stripe? Então a mudança de plano é um UPGRADE da
    // assinatura existente (via portal, com proração) — NÃO uma nova assinatura.
    const hasActiveStripeSub = !!stripeSubId;

    const handlePlanAction = async (planKey) => {
        if (loadingPlan) return;
        setLoadingPlan(planKey);
        const priceId = PRICE_IDS[planKey][billing];
        try {
            if (hasActiveStripeSub) {
                // Upgrade/downgrade da assinatura ATUAL (troca o preço com proração),
                // sem criar uma segunda assinatura.
                await upgradeSubscription(priceId);
                setLoadingPlan(null);
                setResult({
                    type: 'success',
                    title: `Você agora é ${PLANS[planKey].name}!`,
                    message: 'A mudança já está ativa. A cobrança é ajustada proporcionalmente ao período — você paga só a diferença.',
                });
            } else {
                // Primeiro pagamento — checkout normal (cria a assinatura).
                await createCheckoutSession(currentUser.uid, priceId, () => setLoadingPlan(null));
            }
        } catch (error) {
            console.error('Plan action error:', error);
            setLoadingPlan(null);
            setResult({
                type: 'error',
                title: 'Não foi possível alterar o plano',
                message: error?.message || 'Ocorreu um erro ao alterar o plano. Tente novamente em instantes.',
            });
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
        const isCurrent = rank === userRank;       // plano que o usuário já tem
        const isLower = rank < userRank;           // plano inferior ao atual
        if (isLower) return null;                  // não mostra planos abaixo do atual
        const isLoadingThis = loadingPlan === planKey;
        const price = billing === 'monthly' ? plan.priceMonthly : plan.priceAnnual;
        return (
            <div className={`relative flex flex-col rounded-3xl border-2 bg-white p-6 ${plan.recommended ? `${a.ring} shadow-xl` : 'border-slate-200 shadow-sm'}`}>
                {!isCurrent && plan.recommended && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest shadow">Recomendado</span>
                )}
                {isCurrent && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-700 text-white text-[9px] font-black uppercase tracking-widest shadow">Plano atual</span>
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

                {isCurrent ? (
                    <button
                        disabled
                        className="w-full py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 bg-slate-100 text-slate-400 cursor-default border border-slate-200"
                    >
                        <Check className="w-4 h-4" /> Seu plano atual
                    </button>
                ) : (
                    <button
                        onClick={() => handlePlanAction(planKey)}
                        disabled={!!loadingPlan}
                        className={`w-full py-3.5 rounded-2xl text-white font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 ${a.btn}`}
                    >
                        {isLoadingThis ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{userRank > 0 ? 'Fazer upgrade' : 'Assinar'} · {plan.name} <ArrowRight className="w-4 h-4" /></>}
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
            <div className="bg-slate-50 rounded-[2rem] w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 duration-300 border border-slate-200" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-5 right-5 p-2 rounded-full bg-white text-slate-400 hover:text-slate-600 border border-slate-200 transition-all z-20">
                    <X className="w-5 h-5" />
                </button>

                {/* Tela de resultado (sucesso/erro) — substitui o conteúdo, sem alert nativo */}
                {result && (
                    <div className="absolute inset-0 z-30 bg-slate-50 rounded-[2rem] flex flex-col items-center justify-center text-center px-8 py-10 animate-in fade-in zoom-in-95 duration-300">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-lg ${result.type === 'success' ? 'bg-emerald-500 shadow-emerald-500/25' : 'bg-rose-500 shadow-rose-500/25'}`}>
                            {result.type === 'success' ? <CheckCircle2 className="w-8 h-8 text-white" /> : <AlertCircle className="w-8 h-8 text-white" />}
                        </div>
                        <h3 className="text-xl md:text-2xl font-black text-slate-900">{result.title}</h3>
                        <p className="text-sm text-slate-500 font-medium mt-2 max-w-sm leading-relaxed">{result.message}</p>
                        <div className="flex items-center gap-3 mt-7">
                            {result.type === 'error' && (
                                <button onClick={() => setResult(null)} className="px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-all">
                                    Tentar de novo
                                </button>
                            )}
                            <button onClick={() => { setResult(null); onClose(); }} className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest text-white transition-all active:scale-95 ${result.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20' : 'bg-slate-800 hover:bg-slate-900'}`}>
                                {result.type === 'success' ? 'Aproveitar' : 'Fechar'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="p-6 md:p-8">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/20">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900">{userRank > 0 ? 'Fazer upgrade' : 'Escolha seu plano'}</h2>
                        <p className="text-sm text-slate-500 font-medium mt-1">{userRank > 0 ? 'Desbloqueie mais recursos — você pode mudar ou cancelar a qualquer momento.' : 'Evolua quando precisar — você pode mudar ou cancelar a qualquer momento.'}</p>
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
