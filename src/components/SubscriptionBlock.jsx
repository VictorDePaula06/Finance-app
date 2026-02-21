import React from 'react';
import { Lock, Zap, CheckCircle2, MessageSquare, LogOut, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.png';

export default function SubscriptionBlock() {
    const { logout, currentUser } = useAuth();

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 relative overflow-hidden flex flex-col items-center justify-center p-6">
            {/* Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px]"></div>

            <div className="max-w-xl w-full relative z-10">
                {/* Logo & Header */}
                <div className="text-center mb-10">
                    <img src={logo} alt="Logo" className="w-32 h-auto mx-auto mb-6 drop-shadow-2xl" />
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold mb-4">
                        <Lock className="w-3 h-3" />
                        ACESSO BLOQUEADO
                    </div>
                    <h1 className="text-4xl font-extrabold mb-4 bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
                        Seu período de teste terminou
                    </h1>
                    <p className="text-slate-400 text-lg">
                        Para continuar utilizando o **Finance Control** e ter acesso ao seu mentor financeiro IA, você precisa renovar sua assinatura.
                    </p>
                </div>

                {/* Benefits Card */}
                <div className="bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-white/10 p-8 mb-8 shadow-2xl">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-blue-400" />
                        O que você libera no plano PRO:
                    </h3>
                    <ul className="space-y-4 mb-8">
                        {[
                            'Consultoria Financeira Ilimitada com IA',
                            'Análise de Metas e Reserva de Emergência',
                            'Relatórios PDF Profissionais Ilimitados',
                            'Sincronização em Nuvem (Multi-dispositivos)',
                            'Metodologia Gustavo Cerbasi integrada'
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-slate-300">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>

                    {/* CTA Button */}
                    <a
                        href="https://wa.me/5500000000000?text=Olá! Meu período de teste do Finance Control terminou e quero renovar minha assinatura."
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-blue-900/20 group text-lg"
                    >
                        Renovar Assinatura Agora
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </a>
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

            <p className="mt-12 text-slate-600 text-xs">
                Logado como: {currentUser?.email}
            </p>
        </div>
    );
}
