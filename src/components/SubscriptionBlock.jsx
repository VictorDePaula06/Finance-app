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

            if (!priceId || priceId === 'price_...') {
                alert('Configuração de pagamento incompleta. Preencha o Price ID no .env');
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
        <div className="min-h-screen bg-slate-950 text-slate-50 relative overflow-hidden flex flex-col items-center justify-center p-6 notranslate">

            {/* Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px]"></div>

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
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold mb-4">
                        <Lock className="w-3 h-3" />
                        ACESSO BLOQUEADO
                    </div>
                    <h1 className="text-4xl font-extrabold mb-4 bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
                        Sua assinatura expirou
                    </h1>
                    <p className="text-slate-400 text-lg">
                        Seu período de acesso terminou. Escolha um plano para continuar utilizando o **Mêntore** e ter acesso ao seu mentor financeiro IA.
                    </p>
                </div>

                {/* Billing Selector */}
                <div className="flex gap-4 mb-8 p-1 bg-slate-900/50 backdrop-blur-md rounded-2xl border border-white/5">
                    <button
                        onClick={() => setBilling('monthly')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-bold ${billing === 'monthly' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Calendar className="w-4 h-4" />
                        Mensal
                    </button>
                    <button
                        onClick={() => setBilling('annual')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-bold relative ${billing === 'annual' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Star className="w-4 h-4" />
                        Anual
                        <span className="absolute -top-2 -right-2 bg-emerald-500 text-[10px] text-white px-2 py-0.5 rounded-full ring-2 ring-slate-950">
                            -16% OFF
                        </span>
                    </button>
                </div>

                {/* Benefits Card */}
                <div className="bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-white/10 p-8 mb-8 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Zap className="w-24 h-24 text-blue-400" />
                    </div>

                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
                        <div>
                            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">
                                {billing === 'monthly' ? 'Plano Mensal' : 'Plano Anual'}
                            </p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-white">
                                    R$ {billing === 'monthly' ? '29,90' : '24,90'}
                                </span>
                                <span className="text-slate-500">/mês</span>
                            </div>
                        </div>
                        {billing === 'annual' && (
                            <div className="text-right">
                                <p className="text-emerald-400 text-sm font-bold">R$ 299,00 /ano</p>
                                <p className="text-slate-500 text-xs text-[10px]">Equivalente por mês</p>
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
                            <li key={i} className="flex items-center gap-3 text-slate-300">
                                <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />
                                <span className="text-sm">{item}</span>
                            </li>
                        ))}
                    </ul>

                    {/* CTA Button */}
                    <button
                        onClick={handleSubscribe}
                        disabled={isRedirecting}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-2xl transition-all shadow-xl shadow-blue-900/20 group text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isRedirecting ? (
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                Assinar Agora
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                    <p className="text-center text-slate-500 text-[10px] mt-4">
                        Pagamento seguro via **Stripe**. Cancele quando quiser.
                    </p>
                </div>

                {/* Secondary Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <button
                        onClick={logout}
                        className="flex items-center gap-2 text-slate-500 hover:text-rose-400 transition-colors text-sm"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair da conta
                    </button>

                    <a
                        href="https://wa.me/5500000000000"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-slate-500 hover:text-emerald-400 transition-colors text-sm"
                    >
                        <MessageSquare className="w-4 h-4" />
                        Falar com suporte
                    </a>
                </div>
            </div>

            <p className="mt-12 text-slate-600 text-xs text-center">
                Logado como: {currentUser?.email} <br />
                ID: {currentUser?.uid}
            </p>
        </div>
    );
}

