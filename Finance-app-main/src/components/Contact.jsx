import React, { useState } from 'react';
import { ArrowLeft, MessageSquare, Mail, Copy, Check, Clock, Info } from 'lucide-react';

export default function Contact({ onBack }) {
    const [copied, setCopied] = useState(false);
    const email = "suporte.soualivia@gmail.com";
    const subjectTemplate = "Suporte Alívia - [Seu Nome]";

    const handleCopy = () => {
        navigator.clipboard.writeText(email);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-white text-slate-600 font-sans selection:bg-emerald-500/30 p-6 md:p-12">
            {/* Background Decorative Orbs */}
            <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

            <div className="max-w-3xl mx-auto">
                {/* Back Button */}
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-400 hover:text-emerald-600 transition-colors mb-12 group text-sm font-medium"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Voltar para a página principal
                </button>

                {/* Header */}
                <header className="mb-16 text-center">
                    <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6 font-bold">
                        <MessageSquare className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">Canal de Contato</h1>
                    <p className="text-slate-400">Estamos aqui para ouvir você e garantir sua tranquilidade.</p>
                </header>

                {/* Content */}
                <div className="space-y-10 leading-relaxed">
                    
                    {/* Main Contact Card */}
                    <section className="bg-slate-50 rounded-3xl border border-slate-100 p-8 shadow-sm">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center justify-center md:justify-start gap-2">
                                    <Mail className="w-5 h-5 text-emerald-500" />
                                    E-mail de Suporte
                                </h3>
                                <p className="text-lg md:text-xl font-black text-emerald-600 mb-6 break-words">
                                    {email}
                                </p>
                                
                                <div className="flex flex-wrap justify-center md:justify-start gap-3">
                                    <button
                                        onClick={handleCopy}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                                    >
                                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                        {copied ? "Copiado!" : "Copiar E-mail"}
                                    </button>
                                    <a
                                        href={`mailto:${email}?subject=${encodeURIComponent(subjectTemplate)}`}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                    >
                                        <Mail className="w-4 h-4" />
                                        Enviar agora
                                    </a>
                                </div>
                            </div>
                            
                            <div className="w-px h-24 bg-slate-200 hidden md:block"></div>
                            
                            <div className="flex-1 space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                                        <Clock className="w-4 h-4 text-blue-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm mb-0.5">Prazo de Retorno</h4>
                                        <p className="text-xs text-slate-500">Respondemos em até 24h úteis.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-purple-50 rounded-lg shrink-0">
                                        <Info className="w-4 h-4 text-purple-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm mb-0.5">Assunto Sugerido</h4>
                                        <p className="text-xs text-slate-500 italic">"{subjectTemplate}"</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Guidelines */}
                    <section className="space-y-6">
                        <h2 className="text-xl font-bold text-slate-900 border-b pb-4">Orientações para Contato</h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="p-5 rounded-2xl bg-white border border-slate-100 italic">
                                <p className="text-sm">"Para agilizar seu atendimento, informe o e-mail cadastrado no app e descreva sua dúvida com o máximo de detalhes possível."</p>
                            </div>
                            <div className="p-5 rounded-2xl bg-white border border-slate-100 italic">
                                <p className="text-sm">"Se o problema for técnico, mencionar o dispositivo que você está usando (Celular ou Computador) ajuda muito nossa equipe."</p>
                            </div>
                        </div>
                    </section>

                </div>

                <footer className="mt-20 pt-12 border-t border-slate-100 text-sm text-slate-400 text-center">
                    &copy; {new Date().getFullYear()} Alívia. Todos os direitos reservados.
                </footer>
            </div>
        </div>
    );
}
