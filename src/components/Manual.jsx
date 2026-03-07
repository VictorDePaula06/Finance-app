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

const Section = ({ id, title, icon: Icon, children, activeSection }) => (
    <div id={id} className={`transition-all duration-500 ${activeSection === id ? 'opacity-100 translate-x-0' : 'hidden opacity-0 -translate-x-4'}`}>
        <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                <Icon className="w-6 h-6 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-100">{title}</h2>
        </div>
        <div className="space-y-6 text-slate-300 leading-relaxed printable-content">
            {children}
        </div>
    </div>
);

const FeatureCard = ({ title, description, icon: Icon, color }) => (
    <div className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-xl flex gap-4 items-start">
        <div className={`p-2 rounded-lg ${color} bg-opacity-10 shrink-0`}>
            <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div>
            <h4 className="font-bold text-slate-100 mb-1">{title}</h4>
            <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
        </div>
    </div>
);

export default function Manual({ onBack }) {
    const [activeSection, setActiveSection] = useState('intro');


    const sections = [
        { id: 'intro', title: 'Boas-vindas', icon: BookOpen },
        { id: 'dashboard', title: 'Dashboard & Saldo', icon: Wallet },
        { id: 'health', title: 'Saúde Financeira', icon: ShieldCheck },
        { id: 'goals', title: 'Metas e Objetivos', icon: Target },
        { id: 'advisor', title: 'IA Mêntore', icon: MessageSquare },
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 relative font-sans p-6 md:p-12">
            {/* Background Decorative Orbs */}
            <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

            <div className="max-w-6xl mx-auto space-y-8 relative z-10">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-white/5 pb-8 no-print">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="p-3 hover:bg-slate-800 rounded-2xl text-slate-400 hover:text-white transition-all border border-transparent hover:border-slate-700"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent tracking-tighter">
                                Manual do Sistema
                            </h1>
                            <p className="text-slate-400 text-sm">Aprenda a dominar suas finanças com o Mêntore</p>
                        </div>
                    </div>

                    <button
                        onClick={() => generateManualPDF()}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 border border-blue-500/50 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20"
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
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
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
                    <main className="lg:col-span-9 bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-white/10 p-8 md:p-12 shadow-2xl min-h-[60vh]">

                        {/* 1. INTRO */}
                        <Section id="intro" title="Seja bem-vindo ao Mêntore" icon={BookOpen} activeSection={activeSection}>
                            <p className="text-lg">
                                O Mêntore não é apenas um gerenciador de gastos; é o seu <strong>copiloto financeiro</strong>.
                                Nossa filosofia é baseada na clareza de dados e decisões inteligentes para levar você à autonomia financeira.
                            </p>

                            <div className="grid md:grid-cols-2 gap-4 mt-8">
                                <FeatureCard
                                    title="Visão 360º"
                                    description="Acompanhe desde o cafézinho de hoje até o seu patrimônio total investido em um só lugar."
                                    icon={PieChart}
                                    color="text-blue-400"
                                />
                                <FeatureCard
                                    title="Saúde Financeira"
                                    description="Algoritmo exclusivo que avalia seu comportamento de gastos baseado nas melhores práticas do mercado."
                                    icon={ShieldCheck}
                                    color="text-emerald-400"
                                />
                                <FeatureCard
                                    title="Sugestões via IA"
                                    description="Nossa inteligência artificial analisa seus padrões e sugere onde você pode economizar mais."
                                    icon={Zap}
                                    color="text-purple-400"
                                />
                                <FeatureCard
                                    title="Foco em Metas"
                                    description="Transforme sonhos em números com prazos e contribuições automáticas sugeridas pelo app."
                                    icon={Target}
                                    color="text-rose-400"
                                />
                            </div>

                            <div className="mt-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex gap-4">
                                <Info className="w-6 h-6 text-emerald-400 shrink-0 mt-1" />
                                <p className="text-sm text-emerald-100/80">
                                    <strong>Dica de Ouro:</strong> Comece cadastrando seu patrimônio inicial nas configurações do Dashboard para que o app calcule sua reserva de emergência corretamente.
                                </p>
                            </div>
                        </Section>

                        {/* 2. DASHBOARD */}
                        <Section id="dashboard" title="Dashboard e Controle de Saldos" icon={Wallet} activeSection={activeSection}>
                            <p>O coração do Mêntore está no Dashboard. Aqui explicamos as métricas fundamentais:</p>

                            <div className="space-y-4">
                                <div className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-500/5 rounded-r-xl">
                                    <h4 className="font-bold text-blue-400 mb-1">Saldo em Carteira (Acumulado)</h4>
                                    <p className="text-sm">Representa o dinheiro que você tem disponível <strong>hoje</strong>. Ele soma tudo o que entrou e subtrai o que saiu desde que você começou a usar o app.</p>
                                </div>

                                <div className="border-l-4 border-emerald-500 pl-4 py-2 bg-emerald-500/5 rounded-r-xl">
                                    <h4 className="font-bold text-emerald-400 mb-1">Resultado Mensal</h4>
                                    <p className="text-sm">Foca apenas no desempenho deste mês. É a diferença entre o que você ganhou (Salário) e o que gastou (Contas).</p>
                                </div>

                                <div className="border-l-4 border-purple-500 pl-4 py-2 bg-purple-500/5 rounded-r-xl">
                                    <h4 className="font-bold text-purple-400 mb-1">Patrimônio Investido</h4>
                                    <p className="text-sm">Total de dinheiro aplicado. Ele soma o valor base que você definiu manualmente com todas as transações da categoria <strong>"Investimento"</strong>.</p>
                                </div>
                            </div>

                            <h3 className="text-xl font-bold text-slate-100 mt-10 mb-4 flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-yellow-400" />
                                Categorias Especiais
                            </h3>
                            <p className="text-sm mb-4 italic">Algumas categorias possuem comportamentos específicos no sistema:</p>

                            <ul className="grid md:grid-cols-2 gap-4 list-none p-0">
                                <li className="bg-slate-800/30 p-4 rounded-xl border border-slate-700">
                                    <span className="font-bold text-blue-400 block mb-1">Saldo Inicial</span>
                                    <span className="text-xs text-slate-400">Use apenas UMA VEZ para calibrar o saldo do app com o saldo real do seu banco no dia que você começou o controle.</span>
                                </li>
                                <li className="bg-slate-800/30 p-4 rounded-xl border border-slate-700">
                                    <span className="font-bold text-emerald-400 block mb-1">Sobra de Mês</span>
                                    <span className="text-xs text-slate-400">Ideal para a virada do mês! Traz o lucro do mês anterior para o novo sem contar como um "novo salário".</span>
                                </li>
                                <li className="bg-slate-800/30 p-4 rounded-xl border border-slate-700">
                                    <span className="font-bold text-purple-400 block mb-1">Investimento</span>
                                    <span className="text-xs text-slate-400">Transações nesta categoria NÃO são consideradas "gastos" no cálculo de Saúde Financeira, pois o valor continua sendo seu patrimônio.</span>
                                </li>
                                <li className="bg-slate-800/30 p-4 rounded-xl border border-slate-700">
                                    <span className="font-bold text-amber-400 block mb-1">Cofre / Resgate</span>
                                    <span className="text-xs text-slate-400">Funciona como uma 'gaveta'. Você tira da carteira e coloca no cofre para separar valores que não pretende gastar logo.</span>
                                </li>
                            </ul>
                        </Section>

                        {/* 3. HEALTH SCORE */}
                        <Section id="health" title="Saúde Financeira e Score" icon={ShieldCheck} activeSection={activeSection}>
                            <p>O Score Financeiro do Mêntore vai de 0 a 100 e é composto por três pilares essenciais:</p>

                            <div className="grid md:grid-cols-3 gap-6 mt-6">
                                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 text-center">
                                    <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <TrendingUp className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <h4 className="font-bold text-slate-100 mb-2">Performance</h4>
                                    <span className="text-2xl font-black text-blue-400 block mb-2">20 pts</span>
                                    <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-widest font-bold">Ganhos vs Gastos</p>
                                    <p className="text-[11px] text-slate-300 mt-2">Avalia se você terminou o mês com saldo positivo.</p>
                                </div>

                                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 text-center">
                                    <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <PieChart className="w-6 h-6 text-emerald-400" />
                                    </div>
                                    <h4 className="font-bold text-slate-100 mb-2">Alocação</h4>
                                    <span className="text-2xl font-black text-emerald-400 block mb-2">30 pts</span>
                                    <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-widest font-bold">Regra 50/30/20</p>
                                    <p className="text-[11px] text-slate-300 mt-2">Distribuição entre Necessidades, Desejos e Poupança.</p>
                                </div>

                                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 text-center">
                                    <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <ShieldCheck className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <h4 className="font-bold text-slate-100 mb-2">Reserva</h4>
                                    <span className="text-2xl font-black text-purple-400 block mb-2">50 pts</span>
                                    <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-widest font-bold">Resiliência</p>
                                    <p className="text-[11px] text-slate-300 mt-2">Seu patrimônio vs 6 meses de gastos fixos.</p>
                                </div>
                            </div>

                            <div className="mt-8 space-y-4">
                                <h3 className="text-xl font-bold text-slate-100">Como subir seu Score?</h3>
                                <ul className="space-y-2">
                                    <li className="flex items-center gap-2 text-sm text-slate-400">
                                        <ChevronRight className="w-4 h-4 text-emerald-400" />
                                        Manter os gastos fixos em no máximo 50% da sua renda.
                                    </li>
                                    <li className="flex items-center gap-2 text-sm text-slate-400">
                                        <ChevronRight className="w-4 h-4 text-emerald-400" />
                                        Destinar pelo menos 20% do que ganha para <strong>Investimentos</strong>.
                                    </li>
                                    <li className="flex items-center gap-2 text-sm text-slate-400">
                                        <ChevronRight className="w-4 h-4 text-emerald-400" />
                                        Construir uma reserva líquida que cubra pelo menos 6 meses do seu custo de vida.
                                    </li>
                                </ul>
                            </div>
                        </Section>

                        {/* 4. GOALS */}
                        <Section id="goals" title="Metas Financeiras" icon={Target} activeSection={activeSection}>
                            <p>As metas ajudam você a sair do "gastar por gastar" e começar a construir o futuro.</p>

                            <div className="grid md:grid-cols-2 gap-8 mt-6">
                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-100 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-rose-400" />
                                        Inteligência de Metas
                                    </h4>
                                    <p className="text-sm">Ao definir um <strong>valor alvo</strong> e um <strong>prazo</strong>, o Mêntore calcula automaticamente quanto você precisa economizar por mês para atingir o objetivo com sucesso.</p>

                                    <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700">
                                        <p className="text-[11px] text-slate-400 uppercase tracking-widest font-bold mb-2">Exemplo:</p>
                                        <p className="text-sm italic">"Para comprar um celular de R$ 3.000 em 6 meses, você precisa poupar R$ 500/mês."</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-100 flex items-center gap-2">
                                        <Check className="w-4 h-4 text-emerald-400" />
                                        Gestão de Depósitos
                                    </h4>
                                    <p className="text-sm">Você pode adicionar ou remover dinheiro de uma meta a qualquer momento usando os botões <span className="text-emerald-400 font-bold">+</span> e <span className="text-rose-400 font-bold">-</span>.</p>
                                    <p className="text-xs text-slate-500 leading-relaxed italic border-t border-white/5 pt-2">Nota: O valor nas metas não altera seu saldo da carteira automaticamente, ele funciona como uma reserva 'mental' dentro do app.</p>
                                </div>
                            </div>
                        </Section>

                        {/* 5. IA ADVISOR */}
                        <Section id="advisor" title="IA Mêntore: Seu Consultor 24h" icon={MessageSquare} activeSection={activeSection}>
                            <p>O Mêntore IA utiliza o modelo de linguagem Gemini para analisar seus dados e fornecer insights personalizados.</p>

                            <div className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-blue-500/20 p-8 rounded-3xl mt-6">
                                <h4 className="font-black text-slate-100 mb-6 text-center">O que você pode perguntar?</h4>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5 text-sm hover:border-blue-500/30 transition-all">
                                        "Qual categoria estou gastando mais este mês?"
                                    </div>
                                    <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5 text-sm hover:border-blue-500/30 transition-all">
                                        "Onde posso economizar R$ 200 reais?"
                                    </div>
                                    <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5 text-sm hover:border-blue-500/30 transition-all">
                                        "Analise meu 50/30/20 e me dê dicas."
                                    </div>
                                    <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5 text-sm hover:border-blue-500/30 transition-all">
                                        "Quanto tive de lucro real nos últimos 3 meses?"
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8">
                                <h4 className="font-bold text-slate-100 mb-2">Privacidade e Tecnologia</h4>
                                <p className="text-sm text-slate-400">
                                    Seus dados financeiros são processados de forma anônima pela IA para garantir que suas informações pessoais nunca sejam expostas. O consultor leva em conta apenas valores, categorias e datas para sua análise.
                                </p>
                            </div>
                        </Section>

                    </main>
                </div>

                {/* Footer info */}
                <footer className="pt-12 pb-8 text-center border-t border-white/5 no-print">
                    <p className="text-slate-600 text-[10px] font-medium tracking-widest uppercase opacity-50">
                        Mêntore • Inteligência Financeira • v3.0
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
