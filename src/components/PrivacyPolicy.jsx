import React from 'react';
import { ArrowLeft, Shield, Lock, Eye, FileText } from 'lucide-react';

export default function PrivacyPolicy({ onBack }) {
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
                    <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-6 font-bold">
                        <Shield className="w-6 h-6 text-blue-400" />
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-4">Política de Privacidade</h1>
                    <p className="text-slate-500 text-lg">Última atualização: 21 de fevereiro de 2026</p>
                </header>

                {/* Content */}
                <div className="space-y-12 leading-relaxed">
                    <section>
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Lock className="w-5 h-5 text-blue-400" />
                            1. Coleta e Uso de Dados
                        </h2>
                        <p className="mb-4">
                            O **Mêntore** leva sua privacidade a sério. Para fornecer nossos serviços, utilizamos o **Firebase (Google)** para autenticação e armazenamento seguro dos seus dados financeiros.
                        </p>
                        <p>
                            Os dados coletados incluem seu nome, e-mail e as transações financeiras que você insere manualmente. Estes dados são usados única e exclusivamente para que o aplicativo funcione e forneça o histórico e análises financeiras que você visualiza.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Eye className="w-5 h-5 text-emerald-400" />
                            2. Processamento por Inteligência Artificial
                        </h2>
                        <p className="mb-4">
                            Utilizamos a API do **Google Gemini (IA)** para fornecer conselhos financeiros personalizados de forma inteligente e automatizada.
                        </p>
                        <p>
                            Ao solicitar uma análise da IA, um resumo anonimizado das suas estatísticas financeiras (sem dados de identificação pessoal direta) é enviado para processamento. Estes dados não são utilizados para treinar modelos globais de IA de forma que revelem sua identidade.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-amber-400" />
                            3. Armazenamento e Segurança
                        </h2>
                        <p className="mb-4">
                            Seus dados estão protegidos pela infraestrutura global de segurança do Google Cloud (Firebase). Utilizamos criptografia de ponta a ponta e práticas recomendadas de segurança da informação (LGPD).
                        </p>
                        <p>
                            Você tem total controle sobre seus dados e pode excluir sua conta e todas as informações armazenadas a qualquer momento diretamente nas configurações do aplicativo.
                        </p>
                    </section>

                    <section className="bg-slate-900/50 rounded-2xl border border-slate-800 p-8">
                        <h2 className="text-xl font-bold text-white mb-4">Dúvidas?</h2>
                        <p className="mb-6">
                            Para qualquer questão relacionada à sua privacidade e segurança, entre em contato com nosso suporte técnico via WhatsApp.
                        </p>
                        <a
                            href="https://wa.me/5500000000000"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/20"
                        >
                            Falar com o Suporte
                        </a>
                    </section>
                </div>

                <footer className="mt-20 pt-12 border-t border-slate-900 text-sm text-slate-600 text-center">
                    &copy; 2026 Mêntore. Todos os direitos reservados.
                </footer>
            </div>
        </div>
    );
}
