import React from 'react';
import { ArrowLeft, Shield, Lock, Eye, FileText } from 'lucide-react';

export default function PrivacyPolicy({ onBack }) {
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
                        <Shield className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">Política de Privacidade</h1>
                </header>

                {/* Content */}
                <div className="space-y-12 leading-relaxed">
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Lock className="w-5 h-5 text-emerald-500" />
                            1. Coleta e Uso de Dados
                        </h2>
                        <p className="mb-4">
                            A Alívia leva sua privacidade a sério. Para fornecer nossos serviços, utilizamos o Firebase (Google) para autenticação e armazenamento seguro dos seus dados financeiros.
                        </p>
                        <p>
                            Os dados coletados incluem seu nome, e-mail e as transações financeiras que você insere manualmente. Estes dados são usados única e exclusivamente para que o aplicativo funcione e forneça o histórico e análises financeiras que você visualiza.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Eye className="w-5 h-5 text-emerald-500" />
                            2. Processamento por Inteligência Artificial
                        </h2>
                        <p className="mb-4">
                            Utilizamos a API do Google Gemini (IA) para fornecer conselhos financeiros personalizados de forma inteligente e automatizada.
                        </p>
                        <p>
                            Ao solicitar uma análise da IA, um resumo anonimizado das suas estatísticas financeiras (sem dados de identificação pessoal direta) é enviado para processamento. Estes dados não são utilizados para treinar modelos globais de IA de forma que revelem sua identidade.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-emerald-500" />
                            3. Armazenamento e Segurança
                        </h2>
                        <p className="mb-4">
                            Seus dados estão protegidos pela infraestrutura global de segurança do Google Cloud (Firebase). Utilizamos criptografia de ponta a ponta e práticas recomendadas de segurança da informação (LGPD).
                        </p>
                        <p>
                            Você tem total controle sobre seus dados e pode excluir sua conta e todas as informações armazenadas a qualquer momento diretamente nas configurações do aplicativo.
                        </p>
                    </section>

                    <section className="bg-emerald-50 rounded-2xl border border-emerald-100 p-8 shadow-sm">
                        <h2 className="text-xl font-bold text-slate-900 mb-4 text-center">SAC - Atendimento ao Cliente</h2>
                        <p className="mb-6 text-center text-slate-600">
                            Para qualquer questão relacionada à sua privacidade e segurança, entre em contato com nosso suporte técnico via WhatsApp.
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
