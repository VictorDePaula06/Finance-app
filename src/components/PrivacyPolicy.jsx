import React from 'react';
import { ArrowLeft, Shield, Lock as LockIcon, Eye, FileText, Globe, Users, Mail, Trash2, Download, Clock, Settings, AlertTriangle } from 'lucide-react';

const POLICY_VERSION = '2.0';
const POLICY_UPDATED_AT = '28 de maio de 2026';

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
                <header className="mb-12 text-center">
                    <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6 font-bold">
                        <Shield className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h1 className="text-4xl font-bold text-slate-900 mb-3 tracking-tight">Política de Privacidade</h1>
                    <p className="text-sm text-slate-400">
                        Versão {POLICY_VERSION} · atualizada em {POLICY_UPDATED_AT}
                    </p>
                    <div className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-xs font-bold text-blue-700">
                        <Shield className="w-3.5 h-3.5" />
                        Em conformidade com a LGPD (Lei nº 13.709/2018)
                    </div>
                </header>

                {/* Content */}
                <div className="space-y-10 leading-relaxed text-[15px]">

                    {/* 1. Controlador */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5 text-emerald-500" />
                            1. Quem é o controlador
                        </h2>
                        <p>
                            A <strong>Alívia Financial Engineering</strong> (referida como "Alívia") é a controladora
                            dos seus dados pessoais, conforme o art. 5º, VI da LGPD. Operamos o aplicativo de
                            inteligência financeira pessoal e somos responsáveis pelas decisões sobre o tratamento
                            das suas informações.
                        </p>
                    </section>

                    {/* 2. Encarregado (DPO) */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-emerald-500" />
                            2. Encarregado pelo Tratamento (DPO)
                        </h2>
                        <p className="mb-3">
                            Em conformidade com o art. 41 da LGPD, indicamos o seguinte canal de contato com o
                            nosso Encarregado de Proteção de Dados:
                        </p>
                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                            <p className="text-sm">
                                📧 <strong>E-mail:</strong>{' '}
                                <a href="mailto:dpo.alivia@gmail.com" className="text-emerald-700 underline">
                                    dpo.alivia@gmail.com
                                </a>
                                <br />
                                ⏱️ <strong>Prazo de resposta:</strong> até 15 dias úteis (art. 19 §1º)
                            </p>
                        </div>
                    </section>

                    {/* 3. Dados coletados */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-emerald-500" />
                            3. Dados pessoais que coletamos
                        </h2>
                        <p className="mb-4">Coletamos as seguintes categorias de dados:</p>
                        <ul className="space-y-2 ml-2">
                            <li>
                                <strong>Identificação:</strong> nome, e-mail, foto de perfil (vindos do Google
                                Sign-In se você optar por essa autenticação).
                            </li>
                            <li>
                                <strong>Dados financeiros declarados:</strong> transações de entrada e saída,
                                cartões, contas fixas, reservas, investimentos, metas e configurações
                                orçamentárias — todos <strong>inseridos manualmente por você</strong>. Não
                                acessamos sua conta bancária real ou Open Finance.
                            </li>
                            <li>
                                <strong>Dados de uso:</strong> data de criação da conta, último login, plano
                                contratado, preferências de interface, aceite de termos com timestamp.
                            </li>
                            <li>
                                <strong>Dados de pagamento (se assinante):</strong> processados por terceiro
                                (Stripe). Não armazenamos cartão de crédito em nossos servidores.
                            </li>
                            <li>
                                <strong>Dados técnicos:</strong> identificador único de dispositivo para
                                notificações push (se você consentir), versão do app instalada.
                            </li>
                        </ul>
                    </section>

                    {/* 4. Base legal */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-emerald-500" />
                            4. Base legal para o tratamento
                        </h2>
                        <p className="mb-3">Tratamos seus dados com base nas seguintes hipóteses do art. 7º da LGPD:</p>
                        <ul className="space-y-2 ml-2">
                            <li>
                                <strong>Execução de contrato</strong> (art. 7º, V) — para operar o aplicativo
                                e seus recursos contratados.
                            </li>
                            <li>
                                <strong>Consentimento</strong> (art. 7º, I) — para tratamentos opcionais como
                                processamento por IA (Google Gemini) e notificações push.
                            </li>
                            <li>
                                <strong>Legítimo interesse</strong> (art. 7º, IX) — para análises agregadas e
                                detecção de fraude/abuso, sempre respeitando seus direitos fundamentais.
                            </li>
                            <li>
                                <strong>Cumprimento de obrigação legal</strong> (art. 7º, II) — para reter
                                logs mínimos exigidos por marco regulatório.
                            </li>
                        </ul>
                    </section>

                    {/* 5. Como usamos */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Settings className="w-5 h-5 text-emerald-500" />
                            5. Para que usamos seus dados
                        </h2>
                        <ul className="space-y-2 ml-2">
                            <li>Operar as funcionalidades do app (dashboards, lançamentos, relatórios).</li>
                            <li>Gerar análises personalizadas (Health Score, projeções, alertas).</li>
                            <li>Processar pagamentos da assinatura via Stripe.</li>
                            <li>Gerar insights via IA Alívia (Google Gemini) — apenas se você ativar.</li>
                            <li>Comunicar atualizações importantes do serviço.</li>
                            <li>Atender solicitações dos titulares e cumprir obrigações legais.</li>
                        </ul>
                    </section>

                    {/* 6. IA */}
                    <section className="bg-amber-50 rounded-2xl border border-amber-100 p-6">
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                            6. Processamento por Inteligência Artificial
                        </h2>
                        <p className="mb-3 text-slate-700">
                            A IA Alívia (modelo Google Gemini) é uma feature <strong>opcional do plano Premium</strong>
                            que requer <strong>consentimento específico</strong>. Quando ativada, enviamos para
                            processamento:
                        </p>
                        <ul className="space-y-1.5 ml-2 text-slate-700 text-sm">
                            <li>• Resumo das suas transações do mês corrente (descrição, valor, categoria).</li>
                            <li>• Suas configurações financeiras (renda, gastos fixos, perfil de risco).</li>
                            <li>• Saldo agregado de reservas e investimentos.</li>
                        </ul>
                        <p className="mt-3 text-slate-700 text-sm">
                            <strong>Importante:</strong> não enviamos seu nome, e-mail ou identificadores
                            diretos. No entanto, os dados financeiros são pseudonimizados (vinculáveis ao seu
                            UID interno), <strong>não anonimizados</strong>. A chave de API do Gemini é fornecida
                            por você e fica armazenada localmente no seu navegador.
                        </p>
                    </section>

                    {/* 7. Transferência internacional */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Globe className="w-5 h-5 text-emerald-500" />
                            7. Transferência internacional de dados
                        </h2>
                        <p className="mb-3">
                            Utilizamos prestadores localizados nos Estados Unidos. Estas transferências são
                            amparadas pelas garantias do art. 33 da LGPD:
                        </p>
                        <ul className="space-y-2 ml-2">
                            <li>
                                <strong>Google Firebase / Firestore</strong> — armazenamento e autenticação
                                (data center em região configurável).
                            </li>
                            <li>
                                <strong>Google Gemini API</strong> — processamento de IA (opcional).
                            </li>
                            <li>
                                <strong>Stripe</strong> — processamento de pagamentos da assinatura.
                            </li>
                            <li>
                                <strong>Vercel</strong> — hospedagem e funções serverless.
                            </li>
                        </ul>
                        <p className="mt-3 text-sm">
                            Todos os parceiros aderem a padrões de proteção equivalentes aos da LGPD
                            (ISO 27001, SOC 2, GDPR).
                        </p>
                    </section>

                    {/* 8. Compartilhamento */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5 text-emerald-500" />
                            8. Com quem compartilhamos
                        </h2>
                        <p className="mb-3">
                            Não vendemos seus dados. Compartilhamos apenas com operadores estritamente
                            necessários para o serviço:
                        </p>
                        <ul className="space-y-1.5 ml-2 text-sm">
                            <li>• Google (Firebase) — operador de infraestrutura.</li>
                            <li>• Stripe — operador de pagamento (apenas se você assinar plano pago).</li>
                            <li>• Google (Gemini) — operador de IA (apenas com seu consentimento).</li>
                            <li>• Autoridades — em caso de obrigação legal ou ordem judicial.</li>
                        </ul>
                    </section>

                    {/* 9. Segurança */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <LockIcon className="w-5 h-5 text-emerald-500" />
                            9. Segurança da informação
                        </h2>
                        <p className="mb-3">Adotamos medidas técnicas e organizacionais (art. 46 da LGPD):</p>
                        <ul className="space-y-1.5 ml-2 text-sm">
                            <li>• Conexões protegidas por TLS 1.3 (HTTPS).</li>
                            <li>• Criptografia em repouso no Firestore (AES-256, gerenciado pelo Google).</li>
                            <li>• Regras de acesso (Firestore Security Rules) — cada usuário só acessa seus próprios dados.</li>
                            <li>• Headers HTTP de segurança (HSTS, CSP, X-Frame-Options, etc.).</li>
                            <li>• Autenticação multi-fator disponível via Google Sign-In.</li>
                            <li>• Auditoria de aceite de termos com timestamp imutável.</li>
                        </ul>
                    </section>

                    {/* 10. Retenção */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-emerald-500" />
                            10. Por quanto tempo armazenamos
                        </h2>
                        <ul className="space-y-2 ml-2 text-sm">
                            <li>
                                <strong>Conta ativa:</strong> mantemos enquanto você usar o serviço.
                            </li>
                            <li>
                                <strong>Após exclusão da conta:</strong> dados financeiros e perfil são
                                eliminados imediatamente. Mantemos por <strong>até 5 anos</strong> apenas
                                registros mínimos exigidos por obrigação legal (logs de pagamento, aceite
                                de termos) — pseudonimizados.
                            </li>
                            <li>
                                <strong>Inatividade prolongada:</strong> após 24 meses sem login, podemos
                                notificá-lo e iniciar processo de eliminação automática.
                            </li>
                        </ul>
                    </section>

                    {/* 11. Direitos do titular */}
                    <section className="bg-blue-50 rounded-2xl border border-blue-100 p-6">
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Eye className="w-5 h-5 text-blue-600" />
                            11. Seus direitos como titular (art. 18 LGPD)
                        </h2>
                        <ul className="space-y-2.5 ml-2 text-sm text-slate-700">
                            <li className="flex items-start gap-2">
                                <span className="font-bold text-blue-700 shrink-0">✓ Confirmação</span>
                                <span>— saber se tratamos seus dados.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-bold text-blue-700 shrink-0">✓ Acesso</span>
                                <span>— ver todos os dados que temos sobre você (disponível em Ajustes → Perfil).</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-bold text-blue-700 shrink-0">✓ Correção</span>
                                <span>— corrigir dados incompletos ou desatualizados.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-bold text-blue-700 shrink-0">✓ Eliminação</span>
                                <span>— apagar todos os dados (Ajustes → Excluir Conta).</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-bold text-blue-700 shrink-0">✓ Portabilidade</span>
                                <span>— baixar seus dados em formato JSON (Ajustes → Baixar Meus Dados).</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-bold text-blue-700 shrink-0">✓ Anonimização</span>
                                <span>— solicitar que dados sejam tratados sem identificação.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-bold text-blue-700 shrink-0">✓ Revogação</span>
                                <span>— retirar seu consentimento a qualquer momento.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-bold text-blue-700 shrink-0">✓ Oposição</span>
                                <span>— se opor a tratamentos baseados em legítimo interesse.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-bold text-blue-700 shrink-0">✓ Reclamação</span>
                                <span>— recorrer à ANPD (
                                    <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                                        gov.br/anpd
                                    </a>).
                                </span>
                            </li>
                        </ul>
                    </section>

                    {/* 12. Cookies */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-emerald-500" />
                            12. Cookies e armazenamento local
                        </h2>
                        <p className="mb-3 text-sm">
                            Utilizamos armazenamento local do navegador (localStorage) para:
                        </p>
                        <ul className="space-y-1.5 ml-2 text-sm">
                            <li>
                                <strong>Essenciais:</strong> manter sua sessão, preferências (tema, esconder
                                saldo), token de autenticação. Não exigem consentimento.
                            </li>
                            <li>
                                <strong>Funcionais:</strong> chave de API do Gemini (apenas se você fornecer),
                                histórico de chat da IA. Permanece somente no seu dispositivo.
                            </li>
                            <li>
                                <strong>Não usamos:</strong> cookies de rastreamento publicitário, FLoC ou
                                análises de comportamento de terceiros.
                            </li>
                        </ul>
                    </section>

                    {/* 13. Crianças */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-emerald-500" />
                            13. Crianças e adolescentes
                        </h2>
                        <p className="text-sm">
                            O serviço não se destina a menores de 18 anos. Não coletamos intencionalmente
                            dados de crianças. Se você é responsável legal e identificou cadastro de menor,
                            entre em contato com o DPO para eliminação imediata.
                        </p>
                    </section>

                    {/* 14. Atualizações */}
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-emerald-500" />
                            14. Atualizações desta política
                        </h2>
                        <p className="text-sm">
                            Podemos atualizar esta política periodicamente. Quando houver mudanças
                            relevantes, exigiremos novo aceite antes de você continuar usando o serviço.
                            O histórico de versões e a data de cada alteração ficam disponíveis aqui.
                        </p>
                    </section>

                    {/* CTA */}
                    <section className="bg-emerald-50 rounded-2xl border border-emerald-100 p-8 shadow-sm">
                        <h2 className="text-xl font-bold text-slate-900 mb-4 text-center flex items-center justify-center gap-2">
                            <Mail className="w-5 h-5 text-emerald-600" />
                            Canal do Encarregado de Dados (DPO)
                        </h2>
                        <p className="mb-6 text-center text-slate-600 text-sm">
                            Para exercer qualquer um dos seus direitos LGPD, fale com nosso DPO:
                        </p>
                        <div className="flex justify-center">
                            <a
                                href="mailto:dpo.alivia@gmail.com?subject=LGPD%20-%20Solicitação%20de%20Titular"
                                className="inline-flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                            >
                                dpo.alivia@gmail.com
                            </a>
                        </div>
                    </section>
                </div>

                <footer className="mt-20 pt-12 border-t border-slate-100 text-sm text-slate-400 text-center space-y-2">
                    <p>&copy; 2026 Alívia Financial Engineering. Todos os direitos reservados.</p>
                    <p className="text-xs">
                        Política versão {POLICY_VERSION} · {POLICY_UPDATED_AT}
                    </p>
                </footer>
            </div>
        </div>
    );
}
