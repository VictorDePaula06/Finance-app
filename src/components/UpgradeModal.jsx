import React, { useState } from 'react';
import { X, Sparkles, CheckCircle2, ArrowRight, Landmark, Bot, Activity, ShieldCheck, MessageSquare, BarChart3, Lock } from 'lucide-react';
import { createCheckoutSession } from '../services/stripe';
import { useAuth } from '../contexts/AuthContext';

export default function UpgradeModal({ isOpen, onClose }) {
    const { currentUser } = useAuth();
    const [billing, setBilling] = useState('monthly');
    const [isRedirecting, setIsRedirecting] = useState(false);

    if (!isOpen) return null;

    const handleUpgrade = async () => {
        setIsRedirecting(true);
        try {
            const priceId = billing === 'monthly'
                ? import.meta.env.VITE_STRIPE_PRICE_ID_MONTHLY || 'price_1T89UOKAwb86obAGotiiOngV'
                : import.meta.env.VITE_STRIPE_PRICE_ID_YEARLY || 'price_1T89UMKAwb86obAGbk0dSm4Z';

            await createCheckoutSession(currentUser.uid, priceId, () => setIsRedirecting(false));
        } catch (error) {
            console.error("Upgrade Error:", error);
            alert("Erro ao iniciar upgrade.");
            setIsRedirecting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300 border border-slate-100">
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 transition-all z-20"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="grid md:grid-cols-5 h-full">
                    {/* Left Side: Visual/Context */}
                    <div className="md:col-span-2 bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-white flex flex-col justify-between relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
                                <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <h2 className="text-3xl font-black mb-4 leading-tight">Torne-se <br/>Premium.</h2>
                            <p className="text-emerald-50 text-sm font-medium leading-relaxed">
                                Desbloqueie o poder máximo da Alívia e assuma o controle total do seu patrimônio.
                            </p>
                        </div>

                        <div className="relative z-10 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-white/20 rounded-lg">
                                    <BarChart3 className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest">Evolução Real</span>
                            </div>
                        </div>

                        {/* Decor */}
                        <div className="absolute bottom-[-10%] left-[-10%] w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                    </div>

                    {/* Right Side: Options */}
                    <div className="md:col-span-3 p-8 md:p-10 flex flex-col">
                        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl mb-8">
                            <button 
                                onClick={() => setBilling('monthly')}
                                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${billing === 'monthly' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                            >
                                Mensal
                            </button>
                            <button 
                                onClick={() => setBilling('annual')}
                                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${billing === 'annual' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                            >
                                Anual
                                <span className="absolute -top-2 -right-2 bg-emerald-500 text-[8px] text-white px-2 py-0.5 rounded-full font-black">-16%</span>
                            </button>
                        </div>

                        <div className="space-y-4 mb-8">
                            {[
                                { icon: Landmark, text: 'Gestão de Patrimônio' },
                                { icon: Bot, text: 'Consultoria Gemini IA' },
                                { icon: Activity, text: 'Health Score Completo' },
                                { icon: ShieldCheck, text: 'Modo Pânico Ativo' }
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center">
                                        <item.icon className="w-3.5 h-3.5 text-emerald-500" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-600">{item.text}</span>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto opacity-40" />
                                </div>
                            ))}
                        </div>

                        <div className="mt-auto">
                            <div className="flex items-baseline gap-2 mb-6 justify-center">
                                <span className="text-4xl font-black text-slate-900">R$ {billing === 'monthly' ? '29,90' : '24,91'}</span>
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">/mês</span>
                            </div>

                            <button
                                onClick={handleUpgrade}
                                disabled={isRedirecting}
                                className="w-full py-5 rounded-[1.5rem] bg-slate-900 hover:bg-slate-800 text-white font-black text-sm uppercase tracking-[0.2em] transition-all shadow-xl shadow-slate-900/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                            >
                                {isRedirecting ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>Quero ser Premium <ArrowRight className="w-4 h-4" /></>
                                )}
                            </button>
                            
                            <p className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-6 flex items-center justify-center gap-2">
                                <Lock className="w-3 h-3" /> Checkout Seguro via Stripe
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
