import React, { useState } from 'react';
import {
    BookOpen,
    ArrowLeft,
    Target,
    TrendingUp,
    Wallet,
    ShieldCheck,
    MessageSquare,
    ChevronRight,
    Info,
    DollarSign,
    PieChart,
    Calendar,
    Zap,
    Check,
    Download
} from 'lucide-react';
import { generateManualPDF } from '../utils/manualPDF';
import { useTheme } from '../contexts/ThemeContext';

const Section = ({ id, title, icon: Icon, children, activeSection, theme }) => (
    <div id={id} className={`transition-all duration-500 ${activeSection === id ? 'opacity-100 translate-x-0' : 'hidden opacity-0 -translate-x-4'}`}>
        <div className="flex items-center gap-3 mb-6">
            <div className={`p-3 rounded-2xl border ${theme === 'light' ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-500/10 border-blue-500/20'}`}>
                <Icon className={`w-6 h-6 ${theme === 'light' ? 'text-emerald-500' : 'text-blue-400'}`} />
            </div>
            <h2 className={`text-2xl font-bold ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>{title}</h2>
        </div>
        <div className={`space-y-6 leading-relaxed printable-content ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
            {children}
        </div>
    </div>
);

const FeatureCard = ({ title, description, icon: Icon, color, theme }) => (
    <div className={`p-4 rounded-xl flex gap-4 items-start border transition-all ${
        theme === 'light' ? 'bg-[#f0fdfa]/50 border-emerald-100/50' : 'bg-slate-800/40 border-slate-700/50'
    }`}>
        <div className={`p-2 rounded-lg ${color} bg-opacity-10 shrink-0`}>
            <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div>
            <h4 className={`font-bold mb-1 ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>{title}</h4>
            <p className={`text-xs leading-relaxed ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{description}</p>
        </div>
    </div>
);

export default function Manual({ onBack }) {
    const { theme } = useTheme();
    const [activeSection, setActiveSection] = useState('intro');


    const sections = [
        { id: 'intro', title: 'Boas-vindas', icon: BookOpen },
        { id: 'dashboard', title: 'Dashboard & Saldo', icon: Wallet },
        { id: 'health', title: 'Saúde Financeira', icon: ShieldCheck },
        { id: 'goals', title: 'Metas e Objetivos', icon: Target },
        { id: 'advisor', title: 'Sua Alívia', icon: MessageSquare },
        { id: 'experience', title: 'Experiência Alívia', icon: Zap },
    ];

    return (
        <div className={`min-h-screen relative font-sans p-6 md:p-12 transition-colors duration-500 ${
            theme === 'light' ? 'bg-white text-slate-900' : 'bg-slate-950 text-slate-50'
        }`}>
            {/* Background Decorative Orbs */}
            <div className={`fixed top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] -z-10 pointer-events-none transition-opacity ${
                theme === 'light' ? 'bg-emerald-400/10 opacity-60' : 'bg-blue-600/10'
            }`}></div>

            <div className="max-w-6xl mx-auto space-y-8 relative z-10">

                {/* Header */}
                <div className={`flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b pb-8 no-print ${
                    theme === 'light' ? 'border-emerald-100/50' : 'border-white/5'
                }`}>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className={`p-3 rounded-2xl transition-all border ${
                                theme === 'light' 
                                ? 'bg-white border-emerald-100 text-emerald-500 hover:bg-emerald-50' 
                                : 'bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white border-transparent hover:border-slate-700'
                            }`}
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className={`text-3xl font-black bg-gradient-to-r bg-clip-text text-transparent tracking-tighter ${
                                theme === 'light' ? 'from-emerald-600 to-emerald-400' : 'from-blue-400 to-emerald-400'
                            }`}>
                                Manual do Sistema
                            </h1>
                            <p className={theme === 'light' ? 'text-slate-500 text-sm' : 'text-slate-400 text-sm'}>Enfrente seus números com leveza e paz com a Alívia</p>
                        </div>
                    </div>

                    <button
                        onClick={() => generateManualPDF()}
                        className={`flex items-center gap-2 px-6 py-3 border rounded-2xl text-sm font-bold transition-all shadow-lg ${
                            theme === 'light'
                            ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500/50 shadow-emerald-500/20 text-white'
                            : 'bg-blue-600 hover:bg-blue-500 border-blue-500/50 shadow-blue-500/20 text-white'
                        }`}
                    >
                        <Download className="w-4 h-4" />
                        Baixar PDF
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

                    {/* Navigation Sidebar */}
                    <nav className="lg:col-span-3 space-y-2 no-print">
                        {sections.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${activeSection === section.id
                                    ? (theme === 'light' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20')
                                    : (theme === 'light' ? 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-600' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200')
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <section.icon className="w-5 h-5" />
                                    <span className="font-bold text-sm">{section.title}</span>
                                </div>
                                <ChevronRight className={`w-4 h-4 transition-transform ${activeSection === section.id ? 'rotate-90' : 'group-hover:translate-x-1'}`} />
                            </button>
                        ))}
                    </nav>

                    {/* Content Area */}
                    <main className={`lg:col-span-9 backdrop-blur-xl rounded-3xl border p-8 md:p-12 shadow-2xl min-h-[60vh] transition-colors duration-500 ${
                        theme === 'light' ? 'bg-white/80 border-emerald-100/50' : 'bg-slate-900/40 border-white/10'
                    }`}>

                        {/* 1. INTRO */}
                        <Section id="intro" title="Seja bem-vindo à Alívia" icon={BookOpen} activeSection={activeSection} theme={theme}>
                            <p className="text-lg">
                                A Alívia não é apenas um gerenciador de gastos; é o seu <strong>acolhimento financeiro</strong>.
                                Nossa filosofia é baseada na clareza de dados e decisões inteligentes para levar você à autonomia financeira.
                            </p>

                            <div className="grid md:grid-cols-2 gap-4 mt-8">
                                <FeatureCard
                                    title="Visão 360º"
                                    description="Acompanhe desde o cafézinho de hoje até o seu patrimônio total investido em um só lugar."
                                    icon={PieChart}
                                    color="text-blue-500"
                                    theme={theme}
                                />
                                <FeatureCard
                                    title="Saúde Financeira"
                                    description="Algoritmo exclusivo que avalia seu comportamento de gastos baseado nas melhores práticas do mercado."
                                    icon={ShieldCheck}
                                    color="text-emerald-500"
                                    theme={theme}
                                />
                                <FeatureCard
                                    title="Sugestões via IA"
                                    description="Nossa inteligência artificial analisa seus padrões e sugere onde você pode economizar mais."
                                    icon={Zap}
                                    color="text-purple-500"
                                    theme={theme}
                                />
                                <FeatureCard
                                    title="Foco em Metas"
                                    description="Transforme sonhos em números com prazos e contribuições automáticas sugeridas pelo app."
                                    icon={Target}
                                    color="text-rose-500"
                                    theme={theme}
                                />
                            </div>

                            <div className={`mt-8 p-4 rounded-2xl border flex gap-4 ${
                                theme === 'light' ? 'bg-emerald-50 border-emerald-100' : 'bg-emerald-500/10 border-emerald-500/20'
                            }`}>
                                <Info className="w-6 h-6 text-emerald-500 shrink-0 mt-1" />
                                <p className={`text-sm ${theme === 'light' ? 'text-emerald-800' : 'text-emerald-100/80'}`}>
                                    <strong>Dica de Ouro:</strong> Comece cadastrando seu patrimônio inicial nas configurações do Dashboard para que o app calcule sua reserva de emergência corretamente.
                                </p>
                            </div>
                        </Section>

                        {/* 2. DASHBOARD */}
                        <Section id="dashboard" title="Dashboard e Controle de Saldos" icon={Wallet} activeSection={activeSection} theme={theme}>
                            <p>O coração da Alívia está no seu Dashboard. Aqui explicamos as métricas de paz:</p>

                            <div className="space-y-4">
                                <div className={`border-l-4 pl-4 py-2 rounded-r-xl ${
                                    theme === 'light' ? 'border-blue-400 bg-blue-50' : 'border-blue-500 bg-blue-500/5'
                                }`}>
                                    <h4 className={`font-bold mb-1 ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}>Saldo em Carteira (Acumulado)</h4>
                                    <p className={`text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>Representa o dinheiro que você tem disponível <strong>hoje</strong>. Ele soma tudo o que entrou e subtrai o que saiu desde que você começou a usar o app.</p>
                                </div>

                                <div className={`border-l-4 pl-4 py-2 rounded-r-xl ${
                                    theme === 'light' ? 'border-emerald-400 bg-emerald-50' : 'border-emerald-500 bg-emerald-500/5'
                                }`}>
                                    <h4 className={`font-bold mb-1 ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`}>Resultado Mensal</h4>
                                    <p className={`text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>Foca apenas no desempenho deste mês. É a diferença entre o que você ganhou (Salário) e o que gastou (Contas).</p>
                                </div>

                                <div className={`border-l-4 pl-4 py-2 rounded-r-xl ${
                                    theme === 'light' ? 'border-purple-400 bg-purple-50' : 'border-purple-500 bg-purple-500/5'
                                }`}>
                                    <h4 className={`font-bold mb-1 ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`}>Patrimônio Investido</h4>
                                    <p className={`text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>Total de valor guardado para o seu futuro. Ele soma o valor base definido por você com todos os aportes na categoria <strong>"Sementinha"</strong>.</p>
                                </div>
                            </div>

                            <h3 className={`text-xl font-bold mt-10 mb-4 flex items-center gap-2 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                                <DollarSign className="w-5 h-5 text-yellow-500" />
                                Categorias Especiais
                            </h3>
                            <p className={`text-sm mb-4 italic ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Algumas categorias possuem comportamentos específicos no sistema:</p>

                            <ul className="grid md:grid-cols-2 gap-4 list-none p-0">
                                <li className={`p-4 rounded-xl border ${
                                    theme === 'light' ? 'bg-[#f0fdfa]/50 border-emerald-100/50' : 'bg-slate-800/30 border-slate-700'
                                }`}>
                                    <span className={`font-bold block mb-1 ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}>Saldo Inicial</span>
                                    <span className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Use apenas UMA VEZ para calibrar o saldo do app com o saldo real do seu banco no dia que você começou o controle.</span>
                                </li>
                                <li className={`p-4 rounded-xl border ${
                                    theme === 'light' ? 'bg-[#f0fdfa]/50 border-emerald-100/50' : 'bg-slate-800/30 border-slate-700'
                                }`}>
                                    <span className={`font-bold block mb-1 ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`}>Sobra de Mês</span>
                                    <span className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Ideal para a virada do mês! Traz o lucro do mês anterior para o novo sem contar como um "novo salário".</span>
                                </li>
                                <li className={`p-4 rounded-xl border ${
                                    theme === 'light' ? 'bg-[#f0fdfa]/50 border-emerald-100/50' : 'bg-slate-800/30 border-slate-700'
                                }`}>
                                    <span className={`font-bold block mb-1 ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`}>Sementinha (Futuro)</span>
                                    <span className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Transações nesta categoria NÃO são consideradas "gastos" no cálculo de Saúde Financeira, pois o valor continua sendo seu patrimônio.</span>
                                </li>
                                <li className={`p-4 rounded-xl border ${
                                    theme === 'light' ? 'bg-[#f0fdfa]/50 border-emerald-100/50' : 'bg-slate-800/30 border-slate-700'
                                }`}>
                                    <span className={`font-bold block mb-1 ${theme === 'light' ? 'text-amber-600' : 'text-amber-400'}`}>Cofre / Resgate</span>
                                    <span className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Funciona como uma 'gaveta'. Você tira da carteira e coloca no cofre para separar valores que não pretende gastar logo.</span>
                                </li>
                            </ul>
                        </Section>

                        {/* 3. HEALTH SCORE */}
                        <Section id="health" title="Saúde Financeira e Score" icon={ShieldCheck} activeSection={activeSection} theme={theme}>
                            <p>O Nível de Tranquilidade da Alívia vai de 0 a 100 e é composto por três pilares essenciais:</p>

                            <div className="grid md:grid-cols-3 gap-6 mt-6">
                                <div className={`p-6 rounded-2xl border text-center transition-all ${
                                    theme === 'light' ? 'bg-[#f0fdfa]/50 border-emerald-100/50' : 'bg-slate-800/50 border-slate-700'
                                }`}>
                                    <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <TrendingUp className="w-6 h-6 text-blue-500" />
                                    </div>
                                    <h4 className={`font-bold mb-2 ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>Performance</h4>
                                    <span className={`text-2xl font-black block mb-2 ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`}>20 pts</span>
                                    <p className={`text-[10px] uppercase tracking-widest font-bold ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>Ganhos vs Gastos</p>
                                    <p className={`text-[11px] mt-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-300'}`}>Avalia se você terminou o mês com saldo positivo.</p>
                                </div>

                                <div className={`p-6 rounded-2xl border text-center transition-all ${
                                    theme === 'light' ? 'bg-[#f0fdfa]/50 border-emerald-100/50' : 'bg-slate-800/50 border-slate-700'
                                }`}>
                                    <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <PieChart className="w-6 h-6 text-emerald-500" />
                                    </div>
                                    <h4 className={`font-bold mb-2 ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>Alocação</h4>
                                    <span className={`text-2xl font-black block mb-2 ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`}>30 pts</span>
                                    <p className={`text-[10px] uppercase tracking-widest font-bold ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>Regra 50/30/20</p>
                                    <p className={`text-[11px] mt-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-300'}`}>Distribuição entre Necessidades, Desejos e Poupança.</p>
                                </div>

                                <div className={`p-6 rounded-2xl border text-center transition-all ${
                                    theme === 'light' ? 'bg-[#f0fdfa]/50 border-emerald-100/50' : 'bg-slate-800/50 border-slate-700'
                                }`}>
                                    <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <ShieldCheck className="w-6 h-6 text-purple-500" />
                                    </div>
                                    <h4 className={`font-bold mb-2 ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>Reserva</h4>
                                    <span className={`text-2xl font-black block mb-2 ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`}>50 pts</span>
                                    <p className={`text-[10px] uppercase tracking-widest font-bold ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>Resiliência</p>
                                    <p className={`text-[11px] mt-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-300'}`}>Seu patrimônio vs 6 meses de gastos fixos.</p>
                                </div>
                            </div>

                            <div className="mt-8 space-y-4">
                                <h3 className={`text-xl font-bold ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>Como subir seu Score?</h3>
                                <ul className="space-y-2">
                                    <li className={`flex items-center gap-2 text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                                        <ChevronRight className="w-4 h-4 text-emerald-500" />
                                        Manter os gastos fixos em no máximo 50% da sua renda.
                                    </li>
                                    <li className={`flex items-center gap-2 text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                                        <ChevronRight className="w-4 h-4 text-emerald-500" />
                                        Destinar pelo menos 20% do que ganha para <strong>Sementinhas (Futuro)</strong>.
                                    </li>
                                    <li className={`flex items-center gap-2 text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                                        <ChevronRight className="w-4 h-4 text-emerald-500" />
                                        Construir uma reserva líquida que cubra pelo menos 6 meses do seu custo de vida.
                                    </li>
                                </ul>
                            </div>
                        </Section>

                        {/* 4. GOALS */}
                        <Section id="goals" title="Metas Financeiras" icon={Target} activeSection={activeSection} theme={theme}>
                            <p>As metas ajudam você a sair do "gastar por gastar" e começar a construir o futuro.</p>

                            <div className="grid md:grid-cols-2 gap-8 mt-6">
                                <div className="space-y-4">
                                    <h4 className={`font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                                        <Calendar className="w-4 h-4 text-rose-500" />
                                        Inteligência de Metas
                                    </h4>
                                    <p className={`text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>Ao definir um <strong>valor alvo</strong> e um <strong>prazo</strong>, a Alívia calcula automaticamente quanto você precisa economizar por mês para atingir o objetivo com sucesso.</p>

                                    <div className={`p-4 rounded-xl border ${
                                        theme === 'light' ? 'bg-[#f0fdfa]/50 border-emerald-100/50' : 'bg-slate-800/40 border-slate-700'
                                    }`}>
                                        <p className={`text-[11px] uppercase tracking-widest font-bold mb-2 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>Exemplo:</p>
                                        <p className={`text-sm italic ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>"Para comprar um celular de R$ 3.000 em 6 meses, você precisa poupar R$ 500/mês."</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className={`font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                                        <Check className="w-4 h-4 text-emerald-500" />
                                        Gestão de Depósitos
                                    </h4>
                                    <p className={`text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>Você pode adicionar ou remover dinheiro de uma meta a qualquer momento usando os botões <span className="text-emerald-500 font-bold">+</span> e <span className="text-rose-500 font-bold">-</span>.</p>
                                    <p className={`text-xs leading-relaxed italic border-t pt-2 ${
                                        theme === 'light' ? 'text-slate-400 border-emerald-100/30' : 'text-slate-500 border-white/5'
                                    }`}>Nota: O valor nas metas não altera seu saldo da carteira automaticamente, ele funciona como uma reserva 'mental' dentro do app.</p>
                                </div>
                            </div>
                        </Section>

                        {/* 5. IA ADVISOR */}
                        <Section id="advisor" title="Sua Alívia: Seu Apoio 24h" icon={MessageSquare} activeSection={activeSection} theme={theme}>
                            <p>A Alívia utiliza o modelo de linguagem Gemini para analisar seus dados e fornecer acolhimento personalizado.</p>

                            <div className={`border p-8 rounded-3xl mt-6 ${
                                theme === 'light' ? 'bg-[#f0fdfa]/50 border-emerald-100' : 'bg-gradient-to-br from-blue-600/10 to-purple-600/10 border-blue-500/20'
                            }`}>
                                <h4 className={`font-black mb-6 text-center ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>O que você pode perguntar?</h4>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className={`p-4 rounded-xl border text-sm transition-all ${
                                        theme === 'light' ? 'bg-white border-emerald-100 hover:border-emerald-400' : 'bg-slate-900/60 border-white/5 hover:border-blue-500/30'
                                    }`}>
                                        "Qual categoria estou gastando mais este mês?"
                                    </div>
                                    <div className={`p-4 rounded-xl border text-sm transition-all ${
                                        theme === 'light' ? 'bg-white border-emerald-100 hover:border-emerald-400' : 'bg-slate-900/60 border-white/5 hover:border-blue-500/30'
                                    }`}>
                                        "Onde posso economizar R$ 200 reais?"
                                    </div>
                                    <div className={`p-4 rounded-xl border text-sm transition-all ${
                                        theme === 'light' ? 'bg-white border-emerald-100 hover:border-emerald-400' : 'bg-slate-900/60 border-white/5 hover:border-blue-500/30'
                                    }`}>
                                        "Analise meu 50/30/20 e me dê dicas."
                                    </div>
                                    <div className={`p-4 rounded-xl border text-sm transition-all ${
                                        theme === 'light' ? 'bg-white border-emerald-100 hover:border-emerald-400' : 'bg-slate-900/60 border-white/5 hover:border-blue-500/30'
                                    }`}>
                                        "Quanto tive de lucro real nos últimos 3 meses?"
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8">
                                <h4 className={`font-bold mb-2 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>Privacidade e Tecnologia</h4>
                                <p className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Seus dados financeiros são processados de forma anônima pela IA para garantir que suas informações pessoais nunca sejam expostas. O consultor leva em conta apenas valores, categorias e datas para sua análise.
                                </p>
                            </div>
                        </Section>

                        {/* 6. EXPERIENCE */}
                        <Section id="experience" title="Experiência e Alívio" icon={Zap} activeSection={activeSection} theme={theme}>
                            <p>A Alívia foi desenhada para transformar sua ansiedade em tranquilidade através de metáforas e suporte imediato.</p>

                            <div className="space-y-6 mt-6">
                                <div className={`p-6 rounded-2xl border ${
                                    theme === 'light' ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-600/5 border-blue-500/20'
                                }`}>
                                    <h4 className="font-black text-lg mb-3 flex items-center gap-2">
                                        <Zap className="w-5 h-5 text-yellow-500" />
                                        O Respiro da Semana
                                    </h4>
                                    <p className="text-sm">Um resumo positivo que aparece no dashboard para celebrar suas conquistas financeiras nos últimos 7 dias. Ele foca no que você fez de **certo**!</p>
                                </div>

                                <div className={`p-6 rounded-2xl border ${
                                    theme === 'light' ? 'bg-[#f0fdfa]/50 border-emerald-100' : 'bg-slate-800/40 border-slate-700'
                                }`}>
                                    <h4 className="font-black text-lg mb-3 flex items-center gap-2">
                                        <Zap className="w-5 h-5 text-emerald-500" />
                                        Plantar uma "Sementinha" 🌱
                                    </h4>
                                    <p className="text-sm mb-4">É o nosso convite para você começar a investir no seu futuro, mesmo com pouco.</p>
                                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-xs italic">
                                        <strong>Como fazer?</strong> Basta realizar um lançamento de **SAÍDA** na categoria **Investimento** ou **Cofre**. Isso alimenta seu patrimônio e faz a sementinha crescer no seu score de tranquilidade!
                                    </div>
                                </div>

                                <div className="p-6 rounded-2xl border border-rose-500/20 bg-rose-500/5">
                                    <h4 className="font-black text-lg mb-3 flex items-center gap-2 text-rose-500">
                                        <Zap className="w-5 h-5" />
                                        Botão de Pânico 🆘
                                    </h4>
                                    <p className="text-sm">Recebeu uma conta inesperada ou uma notícia difícil? Clique no botão Rose. A Alívia entrará em modo de apoio imediato para te ajudar a respirar e ajustar sua rota sem desespero.</p>
                                </div>
                            </div>
                        </Section>

                    </main>
                </div>

                {/* Footer info */}
                <footer className={`pt-12 pb-8 text-center border-t no-print ${
                    theme === 'light' ? 'border-emerald-100/30' : 'border-white/5'
                }`}>
                    <p className={`text-[10px] font-medium tracking-widest uppercase opacity-50 ${
                        theme === 'light' ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                        Alívia • Tranquilidade Financeira • v5.0
                    </p>
                </footer>

            </div>

            {/* Styles for Printing */}
            <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .printable-content { color: black !important; }
          main { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
          .bg-slate-950, .bg-slate-900, .bg-slate-800 { background: white !important; }
          .text-slate-100, .text-slate-300, .text-slate-400 { color: black !important; }
          .border { border-color: #ddd !important; }
          .rounded-3xl, .rounded-2xl { border-radius: 8px !important; }
        }
      `}</style>
        </div>
    );
}
