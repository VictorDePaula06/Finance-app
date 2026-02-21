import React from 'react';
import { ArrowLeft, FileText, Scale, AlertCircle, ShieldCheck } from 'lucide-react';

export default function TermsOfUse({ onBack }) {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-blue-500/30 p-6 md:p-12">
            <div className="max-w-3xl mx-auto">
                {/* Back Button */}
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors mb-12 group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Voltar para a página principal
                </button>

                {/* Header */}
                <header className="mb-16">
                    <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-6 font-bold">
                        <Scale className="w-6 h-6 text-amber-400" />
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-4">Termos de Uso</h1>
                    <p className="text-slate-500 text-lg">Última atualização: 21 de fevereiro de 2026</p>
                </header>

                {/* Content */}
                <div className="space-y-12 leading-relaxed">
                    <section>
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-400" />
                            1. Aceitação dos Termos
                        </h2>
                        <p>
                            Ao acessar e utilizar o **Finance Control**, você concorda em cumprir e estar vinculado a estes Termos de Uso. Este aplicativo é uma ferramenta de auxílio à gestão financeira pessoal e não substitui o aconselhamento de profissionais certificados.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-rose-400" />
                            2. Isenção de Responsabilidade (IA)
                        </h2>
                        <p className="mb-4">
                            O Finance Control utiliza Inteligência Artificial (Gemini) para fornecer sugestões e análises. **Você reconhece que:**
                        </p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>As respostas da IA podem conter imprecisões ou erros.</li>
                            <li>Toda e qualquer decisão financeira tomada com base nas sugestões do app é de sua inteira responsabilidade.</li>
                            <li>O app não garante rentabilidade ou sucesso financeiro.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-400" />
                            3. Uso do Serviço
                        </h2>
                        <p className="mb-4">
                            Você é responsável por manter a confidencialidade de sua conta. O uso indevido do sistema, tentativa de invasão ou extração de dados resultará no banimento imediato da plataforma.
                        </p>
                        <p>
                            Reservamo-nos o direito de alterar ou descontinuar qualquer aspecto do serviço a qualquer momento, mediante aviso prévio na plataforma.
                        </p>
                    </section>

                    <section className="bg-slate-900/50 rounded-2xl border border-slate-800 p-8">
                        <h2 className="text-xl font-bold text-white mb-4 text-center">Contato</h2>
                        <p className="mb-6 text-center">
                            Dúvidas sobre os termos? Entre em contato.
                        </p>
                        <div className="flex justify-center">
                            <a
                                href="https://wa.me/5500000000000"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg"
                            >
                                WhatsApp Suporte
                            </a>
                        </div>
                    </section>
                </div>

                <footer className="mt-20 pt-12 border-t border-slate-900 text-sm text-slate-600 text-center">
                    &copy; 2026 Finance Control. Todos os direitos reservados.
                </footer>
            </div>
        </div>
    );
}
