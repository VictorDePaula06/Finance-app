import React from 'react';
import { ArrowLeft, FileText, Scale, AlertCircle, ShieldCheck } from 'lucide-react';

export default function TermsOfUse({ onBack }) {
    return (
        <div className="min-h-screen bg-white text-slate-600 font-sans selection:bg-emerald-500/30 p-6 md:p-12">
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
                        <Scale className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">Termos de Uso</h1>
                </header>

                {/* Content */}
                <div className="space-y-12 leading-relaxed">
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-emerald-500" />
                            1. Aceitação dos Termos
                        </h2>
                        <p>
                            Ao acessar e utilizar a Alívia, você concorda em cumprir e estar vinculado a estes Termos de Uso. Este aplicativo é uma ferramenta de auxílio à gestão financeira pessoal e não substitui o aconselhamento de profissionais certificados.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-emerald-500" />
                            2. Isenção de Responsabilidade (IA)
                        </h2>
                        <p className="mb-4">
                            A Alívia utiliza Inteligência Artificial (Gemini) para fornecer sugestões e análises. Você reconhece que:
                        </p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>As respostas da IA podem conter imprecisões ou erros.</li>
                            <li>Toda e qualquer decisão financeira tomada com base nas sugestões do app é de sua inteira responsabilidade.</li>
                            <li>O app não garante rentabilidade ou sucesso financeiro.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-500" />
                            3. Uso do Serviço
                        </h2>
                        <p className="mb-4 text-slate-600">
                            Você é responsável por manter a confidencialidade de sua conta. O uso indevido do sistema, tentativa de invasão ou extração de dados resultará no banimento imediato da plataforma.
                        </p>
                        <p>
                            Reservamo-nos o direito de alterar ou descontinuar qualquer aspecto do serviço a qualquer momento, mediante aviso prévio na plataforma.
                        </p>
                    </section>

                    <section className="bg-emerald-50 rounded-2xl border border-emerald-100 p-8 shadow-sm">
                        <h2 className="text-xl font-bold text-slate-900 mb-4 text-center">SAC - Atendimento ao Cliente</h2>
                        <p className="mb-6 text-center text-slate-600">
                            Dúvidas sobre os termos ou precisa de ajuda? Fale conosco agora.
                        </p>
                        <div className="flex justify-center">
                            <a
                                href="https://wa.me/5500000000000"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                            >
                                WhatsApp Suporte
                            </a>
                        </div>
                    </section>
                </div>

                <footer className="mt-20 pt-12 border-t border-slate-100 text-sm text-slate-400 text-center">
                    &copy; 2026 Alívia. Todos os direitos reservados.
                </footer>
            </div>
        </div>
    );
}
