import React, { useState } from 'react';
import { X, Lock, Check, Zap, Star } from 'lucide-react';
import { createCheckoutSession } from '../services/stripe';
import { useAuth } from '../contexts/AuthContext';

/**
 * Modal amigável exibido quando um usuário em período de teste
 * tenta ultrapassar um dos limites de uso do plano gratuito.
 *
 * Props:
 *  - isOpen       {boolean}
 *  - onClose      {function}
 *  - limitMessage {string}  ex: "Você atingiu o limite de 2 recebimentos."
 */
export default function TrialLimitModal({ isOpen, onClose, limitMessage }) {
    const { currentUser, planLevel } = useAuth();
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [redirectingPlan, setRedirectingPlan] = useState(null);
    const isFreePlan = planLevel === 'free';

    if (!isOpen) return null;

    const PRICE_IDS = {
        standard: import.meta.env.VITE_STRIPE_PRICE_ID_STANDARD_MONTHLY || 'price_1TdDzSKAwb86obAGI0gTmdWL',
        premium:  import.meta.env.VITE_STRIPE_PRICE_ID_MONTHLY         || 'price_1TdDwDKAwb86obAGnRhLwlIa',
    };

    const handleSubscribe = async (planKey) => {
        if (!currentUser || isRedirecting) return;
        setIsRedirecting(true);
        setRedirectingPlan(planKey);
        try {
            await createCheckoutSession(currentUser.uid, PRICE_IDS[planKey], () => {
                setIsRedirecting(false);
                setRedirectingPlan(null);
            });
        } catch {
            setIsRedirecting(false);
            setRedirectingPlan(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-300 overflow-hidden">

                {/* Close */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-all z-10"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Top banner */}
                <div className="bg-gradient-to-r from-amber-500/20 to-amber-600/10 border-b border-amber-500/20 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/20 shrink-0">
                            <Lock className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white">{isFreePlan ? 'Limite do Plano Gratuito' : 'Limite do Período de Teste'}</h3>
                            <p className="text-xs text-amber-300/80 mt-0.5 leading-snug">{limitMessage}</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Assine um plano e tenha acesso ilimitado a todos os lançamentos, cartões, contas fixas e muito mais.
                    </p>

                    {/* Plano Standard */}
                    <button
                        onClick={() => handleSubscribe('standard')}
                        disabled={isRedirecting}
                        className="w-full p-4 rounded-xl border-2 border-blue-500/30 bg-blue-500/5 hover:border-blue-500 hover:bg-blue-500/10 transition-all text-left active:scale-95 disabled:opacity-60"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <Zap className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                    <span className="text-sm font-black text-white">Plano Standard</span>
                                </div>
                                <div className="space-y-1">
                                    {['Lançamentos ilimitados', 'Cartões ilimitados', 'Contas fixas ilimitadas'].map(f => (
                                        <div key={f} className="flex items-center gap-1.5">
                                            <Check className="w-3 h-3 text-blue-400 shrink-0" />
                                            <span className="text-[10px] text-slate-400">{f}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-lg font-black text-blue-400">R$ 9,90</p>
                                <p className="text-[10px] text-slate-500">/mês</p>
                                {redirectingPlan === 'standard' && (
                                    <div className="mt-1 w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto" />
                                )}
                            </div>
                        </div>
                    </button>

                    {/* Plano Premium */}
                    <button
                        onClick={() => handleSubscribe('premium')}
                        disabled={isRedirecting}
                        className="w-full p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500 hover:bg-emerald-500/10 transition-all text-left active:scale-95 disabled:opacity-60"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <Star className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span className="text-sm font-black text-white">Plano Premium</span>
                                    <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-black shrink-0">COMPLETO</span>
                                </div>
                                <div className="space-y-1">
                                    {['Tudo do Standard', 'Módulo Patrimônio', 'Consultoria com IA'].map(f => (
                                        <div key={f} className="flex items-center gap-1.5">
                                            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                            <span className="text-[10px] text-slate-400">{f}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-lg font-black text-emerald-400">R$ 19,90</p>
                                <p className="text-[10px] text-slate-500">/mês</p>
                                {redirectingPlan === 'premium' && (
                                    <div className="mt-1 w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin mx-auto" />
                                )}
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full py-2.5 rounded-xl bg-white/5 text-slate-500 text-xs font-bold hover:bg-white/10 hover:text-slate-300 transition-all"
                    >
                        {isFreePlan ? 'Continuar no Plano Gratuito' : 'Continuar no período de teste'}
                    </button>
                </div>
            </div>
        </div>
    );
}
