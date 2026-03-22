import React, { useState } from 'react';
import { Lock, Zap, CheckCircle2, MessageSquare, LogOut, ArrowRight, Calendar, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createCheckoutSession } from '../services/stripe';
import logo from '../assets/logo.png';

export default function SubscriptionBlock({ onAdminAccess }) {
    const { logout, currentUser } = useAuth();
    const [billing, setBilling] = useState('monthly'); // 'monthly' | 'annual'
    const [isRedirecting, setIsRedirecting] = useState(false);

    // E-mail Master (deve bater com o do App.jsx)
    const MASTER_EMAIL = 'j.17jvictor@gmail.com';

    const handleSubscribe = async () => {
        setIsRedirecting(true);
        try {
            const priceId = billing === 'monthly'
                ? import.meta.env.VITE_STRIPE_PRICE_ID_MONTHLY
                : import.meta.env.VITE_STRIPE_PRICE_ID_YEARLY;

            const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

            if (!priceId || priceId.startsWith('price_...')) {
                console.error("Missing Price ID:", { billing, priceId });
                alert('Configuração de pagamento incompleta (Price ID ausente).');
                setIsRedirecting(false);
                return;
            }

            if (!publishableKey) {
                console.error("Missing Stripe Publishable Key");
                alert('Configuração do Stripe incompleta (Chave Pública ausente).');
                setIsRedirecting(false);
                return;
            }

            await createCheckoutSession(currentUser.uid, priceId);
        } catch (error) {
            console.error("Checkout Error:", error);
            alert("Erro ao iniciar pagamento. Verifique sua conexão.");
            setIsRedirecting(false);
        }
    };

    return (
        <div className="min-h-screen bg-white text-slate-800 relative overflow-hidden flex flex-col items-center justify-center p-6 notranslate selection:bg-emerald-500/30">

            {/* Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-teal-500/10 rounded-full blur-[120px]"></div>

            <div className="max-w-xl w-full relative z-10">
                {/* Logo & Header */}
                <div className="text-center mb-10">
                    <div
                        className="mb-6 cursor-help select-none"
                        onDoubleClick={() => {
                            if (currentUser?.email === MASTER_EMAIL) onAdminAccess();
                        }}
                    >
                        <img src={logo} alt="Logo" className="w-32 h-auto mx-auto drop-shadow-2xl" />
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-100 text-xs font-bold mb-4">
                        <Lock className="w-3 h-3" />
                        ACESSO BLOQUEADO
                    </div>
                    <h1 className="text-4xl font-extrabold mb-4 text-slate-900 tracking-tight">
                        Sua assinatura expirou
                    </h1>
                    <p className="text-slate-600 text-lg">
                        Seu período de acesso terminou. Escolha um plano para continuar utilizando a Alívia e ter acesso ao seu acolhimento financeiro IA.
                    </p>
                </div>

                {/* Billing Selector */}
                <div className="flex gap-4 mb-8 p-1 bg-slate-100 rounded-2xl border border-slate-200 shadow-sm">
                    <button
                        onClick={() => setBilling('monthly')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-bold ${billing === 'monthly' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Calendar className="w-4 h-4" />
                        Mensal
                    </button>
                    <button
                        onClick={() => setBilling('annual')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-bold relative ${billing === 'annual' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Star className="w-4 h-4" />
                        Anual
                        <span className="absolute -top-2 -right-2 bg-teal-500 text-[10px] text-white px-2 py-0.5 rounded-full ring-2 ring-white">
                            -16% OFF
                        </span>
                    </button>
                </div>

                {/* Benefits Card */}
                <div className="bg-white rounded-3xl border border-slate-100 p-8 mb-8 shadow-2xl shadow-emerald-600/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Zap className="w-24 h-24 text-emerald-600" />
                    </div>

                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">
                                {billing === 'monthly' ? 'Plano Mensal' : 'Plano Anual'}
                            </p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-black text-slate-900">
                                    R$ {billing === 'monthly' ? '29,90' : '24,90'}
                                </span>
                                <span className="text-slate-400 text-sm">/mês</span>
                            </div>
                        </div>
                        {billing === 'annual' && (
                            <div className="text-right">
                                <p className="text-emerald-600 text-sm font-bold">R$ 299,00 /ano</p>
                                <p className="text-slate-400 text-[10px]">Equivalente por mês</p>
                            </div>
                        )}
                    </div>


                    <ul className="space-y-4 mb-10">
                        {[
                            'Consultoria Financeira Ilimitada com IA',
                            'Análise de Metas e Reserva de Emergência',
                            'Relatórios PDF Profissionais Ilimitados',
                            'Sincronização em Nuvem (Multi-dispositivos)',
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-slate-600">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                <span className="text-sm font-medium">{item}</span>
                            </li>
                        ))}
                    </ul>

                    {/* CTA Button */}
                    <button
                        onClick={handleSubscribe}
                        disabled={isRedirecting}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-emerald-500/20 group text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isRedirecting ? (
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                Ativar Minha Conta
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                    <p className="text-center text-slate-400 text-[10px] mt-4 uppercase tracking-widest font-medium">
                        Pagamento seguro via Stripe
                    </p>
                </div>

                {/* Secondary Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <button
                        onClick={logout}
                        className="flex items-center gap-2 text-slate-400 hover:text-rose-500 transition-colors text-sm font-medium"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair da conta
                    </button>

                    <a
                        href="https://wa.me/5500000000000"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-slate-400 hover:text-emerald-600 transition-colors text-sm font-medium"
                    >
                        <MessageSquare className="w-4 h-4" />
                        Falar com suporte
                    </a>
                </div>
            </div>

            <p className="mt-12 text-slate-300 text-[10px] text-center uppercase tracking-[0.2em] font-medium opacity-50">
                Alívia Premium &copy; 2026
            </p>
        </div>
    );
}

