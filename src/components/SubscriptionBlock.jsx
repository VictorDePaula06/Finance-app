import React, { useState } from 'react';
import { Lock as LockIcon, Zap, CheckCircle2, MessageSquare, LogOut, ArrowRight, Calendar, Star, Wallet, Sparkles, Activity, ShieldCheck, TrendingUp, BarChart3, Landmark, Bot, FileText, Cloud, Globe, CreditCard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createCheckoutSession } from '../services/stripe';
import logo from '../assets/logo.png';

export default function SubscriptionBlock({ onAdminAccess }) {
    const { logout, currentUser } = useAuth();
    const [billing, setBilling] = useState('monthly'); // 'monthly' | 'annual'
    const [plan, setPlan] = useState('premium'); // 'standard' | 'premium'
    const [isRedirecting, setIsRedirecting] = useState(false);

    // E-mail Master
    const MASTER_EMAIL = 'financealivia@gmail.com';

    const handleSubscribe = async () => {
        setIsRedirecting(true);
        try {
            let priceId;
            if (plan === 'standard') {
                priceId = billing === 'monthly'
                    ? import.meta.env.VITE_STRIPE_PRICE_ID_STANDARD_MONTHLY
                    : import.meta.env.VITE_STRIPE_PRICE_ID_STANDARD_YEARLY;
                
                if (!priceId) {
                    priceId = billing === 'monthly' 
                        ? 'price_1TSMc3KAwb86obAG4jW02DAq' 
                        : 'price_1TSMctKAwb86obAGj4BZqYtl';
                }
            } else {
                priceId = billing === 'monthly'
                    ? import.meta.env.VITE_STRIPE_PRICE_ID_MONTHLY
                    : import.meta.env.VITE_STRIPE_PRICE_ID_YEARLY;
                
                if (!priceId) {
                    priceId = billing === 'monthly' 
                        ? 'price_1T89UOKAwb86obAGotiiOngV' 
                        : 'price_1T89UMKAwb86obAGbk0dSm4Z';
                }
            }

            const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

            if (!priceId) {
                alert('Configuração de pagamento incompleta.');
                setIsRedirecting(false);
                return;
            }

            await createCheckoutSession(currentUser.uid, priceId, () => setIsRedirecting(false));
        } catch (error) {
            console.error("Checkout Error:", error);
            alert("Erro ao iniciar pagamento.");
            setIsRedirecting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden flex flex-col items-center py-12 px-6 notranslate selection:bg-emerald-500/30">

            {/* Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]"></div>

            <div className="max-w-2xl w-full relative z-10">
                {/* Logo & Header */}
                <div className="text-center mb-12">
                    <div
                        className="mb-8 cursor-help select-none"
                        onDoubleClick={() => {
                            if (currentUser?.email === MASTER_EMAIL) onAdminAccess();
                        }}
                    >
                        <img src={logo} alt="Logo" className="w-40 h-auto mx-auto drop-shadow-2xl" />
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-200 text-xs font-black tracking-widest mb-6">
                        <LockIcon className="w-3.5 h-3.5" />
                        TRIAL FINALIZADO
                    </div>
                    <h1 className="text-5xl font-black mb-4 text-slate-900 tracking-tight leading-tight">
                        Sua jornada apenas <br/>
                        <span className="text-emerald-500">começou.</span>
                    </h1>
                    <p className="text-slate-500 text-lg font-medium max-w-lg mx-auto leading-relaxed">
                        Seus 7 dias de teste grátis terminaram. Escolha um plano para manter seus dados seguros e continuar evoluindo.
                    </p>
                </div>

                {/* Billing Selector */}
                <div className="flex gap-4 mb-10 p-1.5 bg-white rounded-[2rem] border border-slate-200 shadow-xl max-w-sm mx-auto">
                    <button
                        onClick={() => setBilling('monthly')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[1.5rem] transition-all font-black text-sm ${billing === 'monthly' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Mensal
                    </button>
                    <button
                        onClick={() => setBilling('annual')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[1.5rem] transition-all font-black text-sm relative ${billing === 'annual' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Anual
                        <span className="absolute -top-3 -right-3 bg-emerald-500 text-[9px] text-white px-2.5 py-1 rounded-full ring-4 ring-white shadow-lg font-black tracking-widest">
                            -16%
                        </span>
                    </button>
                </div>

                {/* Plan Selection Cards */}
                <div className="grid md:grid-cols-2 gap-6 mb-10">
                    {/* STANDARD */}
                    <button
                        onClick={() => {
                            if (plan === 'standard') handleSubscribe();
                            else setPlan('standard');
                        }}
                        disabled={isRedirecting}
                        className={`p-8 rounded-[3rem] border-2 text-left transition-all relative overflow-hidden group active:scale-95 ${
                            plan === 'standard' 
                            ? 'border-blue-500 bg-white shadow-2xl scale-105 z-10' 
                            : 'border-white bg-white/50 opacity-60 hover:opacity-100 hover:border-slate-200 grayscale'
                        }`}
                    >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${plan === 'standard' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                            <Wallet className="w-6 h-6" />
                        </div>
                        <h3 className={`text-xl font-black mb-1 ${plan === 'standard' ? 'text-slate-900' : 'text-slate-500'}`}>Standard</h3>
                        <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-3xl font-black">R$ {billing === 'monthly' ? '9,99' : '7,83'}</span>
                            <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">/mês</span>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Controle de Gastos
                            </li>
                            <li className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Gestão de Cartões
                            </li>
                            <li className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Relatórios PDF
                            </li>
                        </ul>
                    </button>

                    {/* PREMIUM */}
                    <button
                        onClick={() => {
                            if (plan === 'premium') handleSubscribe();
                            else setPlan('premium');
                        }}
                        disabled={isRedirecting}
                        className={`p-8 rounded-[3rem] border-2 text-left transition-all relative overflow-hidden group active:scale-95 ${
                            plan === 'premium' 
                            ? 'border-emerald-500 bg-white shadow-2xl scale-105 z-10' 
                            : 'border-white bg-white/50 opacity-60 hover:opacity-100 hover:border-slate-200 grayscale'
                        }`}
                    >
                        <div className="absolute top-4 right-4">
                            <Sparkles className={`w-5 h-5 ${plan === 'premium' ? 'text-emerald-500 animate-pulse' : 'text-slate-300'}`} />
                        </div>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${plan === 'premium' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <h3 className={`text-xl font-black mb-1 ${plan === 'premium' ? 'text-slate-900' : 'text-slate-500'}`}>Premium</h3>
                        <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-3xl font-black">R$ {billing === 'monthly' ? '29,90' : '24,91'}</span>
                            <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">/mês</span>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Tudo do Standard
                            </li>
                            <li className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Inteligência Alívia
                            </li>
                            <li className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Módulo Patrimônio
                            </li>
                        </ul>
                    </button>
                </div>

                {/* Features Detail List */}
                <div className="bg-white rounded-[3rem] border border-slate-100 p-10 mb-12 shadow-2xl shadow-slate-200/50">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-8 text-center">Por que ativar o {plan === 'premium' ? 'Premium' : 'Standard'}?</h4>
                    <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                        {(plan === 'premium' 
                            ? [
                                { icon: Landmark, text: 'Gestão CDI & Patrimônio' },
                                { icon: Bot, text: 'Insights Gemini IA' },
                                { icon: Activity, text: 'Health Score Completo' },
                                { icon: BarChart3, text: 'Evolução Patrimonial' },
                                { icon: ShieldCheck, text: 'Modo Pânico & Alertas' },
                                { icon: MessageSquare, text: 'Suporte Prioritário' }
                            ] 
                            : [
                                { icon: Wallet, text: 'Fluxo de Caixa Mensal' },
                                { icon: CreditCard, text: 'Até 10 Cartões' },
                                { icon: FileText, text: 'PDFs Automáticos' },
                                { icon: Cloud, text: 'Sincronização Nuvem' },
                                { icon: Globe, text: 'Acesso Web & Mobile' },
                                { icon: LockIcon, text: 'Segurança Bancária' }
                            ]
                        ).map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <item.icon className={`w-5 h-5 ${plan === 'premium' ? 'text-emerald-500' : 'text-blue-500'}`} />
                                <span className="text-sm font-bold text-slate-600">{item.text}</span>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleSubscribe}
                        disabled={isRedirecting}
                        className={`w-full mt-12 py-6 rounded-[2rem] font-black text-xl transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 ${
                            plan === 'premium' 
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30' 
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                        }`}
                    >
                        {isRedirecting ? (
                            <div className="w-7 h-7 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                Ativar Agora <ArrowRight className="w-6 h-6" />
                            </>
                        )}
                    </button>
                    <div className="flex items-center justify-center gap-2 mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <LockIcon className="w-3 h-3" /> Pagamento seguro via Stripe • Cancele quando quiser
                    </div>
                </div>

                {/* Footer buttons */}
                <div className="flex flex-col items-center gap-6">
                    <a
                        href="https://wa.me/5521992152708"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-8 py-4 bg-white border border-slate-100 rounded-[1.5rem] text-slate-500 hover:text-emerald-500 transition-all text-sm font-bold shadow-sm"
                    >
                        <MessageSquare className="w-5 h-5 text-emerald-500" />
                        Falar com Consultor Humano
                    </a>

                    <button
                        onClick={logout}
                        className="text-slate-400 hover:text-rose-500 transition-colors text-[10px] font-black uppercase tracking-[0.2em]"
                    >
                        Sair da minha conta
                    </button>
                </div>
            </div>

            <p className="mt-20 text-slate-300 text-[9px] font-black uppercase tracking-[0.4em] opacity-50">
                Alívia Financial Engineering &copy; 2026
            </p>
        </div>
    );
}
