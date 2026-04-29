import React from 'react';
import {
    TrendingUp,
    ShieldCheck,
    Zap,
    CheckCircle2,
    ArrowRight,
    LayoutDashboard,
    PieChart,
    BrainCircuit,
    Sparkles,
    MessageSquare,
    AlertCircle,
    Sun,
    Moon,
    Wallet,
    Target,
    ArrowDownCircle,
    Activity,
    Bot
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import logo from '../assets/logo.png';
import aliviaFinal from '../assets/alivia/alivia-final.png';
import Dashboard1 from '../assets/Dashboard1.jpeg';
import Dashboard2 from '../assets/Dashboard2.jpeg';
import Dashboard3 from '../assets/Dashboard3.jpeg';
import Dashboard4 from '../assets/Dashboard4.jpeg';
import Mobile1 from '../assets/Mobile1.jpeg';
import Mobile2 from '../assets/Mobile2.jpeg';
import Mobile3 from '../assets/Mobile3.jpeg';
import Mobile4 from '../assets/Mobile4.jpeg';

export default function LandingPage({ onLogin, onViewPrivacy, onViewTerms, onViewManual, onViewContact }) {
    const { theme, toggleTheme } = useTheme();
    const [billing, setBilling] = React.useState('monthly');
    const [currentSlide, setCurrentSlide] = React.useState(0);
    const [currentMobileSlide, setCurrentMobileSlide] = React.useState(0);
    const [activeScenario, setActiveScenario] = React.useState('panic');

    const desktopSlides = [Dashboard1, Dashboard2, Dashboard3, Dashboard4];
    const mobileSlides = [Mobile1, Mobile2, Mobile3, Mobile4];

    const scenarios = {
        panic: {
            title: "Modo Pânico",
            icon: AlertCircle,
            color: "text-rose-500",
            bg: "bg-rose-500/10",
            user: "Alívia, surgiu um gasto inesperado e estou desesperada... 😰",
            reply: ["Calma, Ana. Eu analisei suas reservas.", "Sua Margem de Segurança cobre isso. Vamos ajustar o plano?"],
            tag: "Guardião Ativado",
            tagColor: "bg-rose-500"
        },
        invest: {
            title: "Crescimento",
            icon: TrendingUp,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
            user: "Alívia! Consegui investir R$ 500 hoje! 🚀",
            reply: ["Incrível! Esse aporte acelerou sua meta de Independência em 2 meses.", "Seu patrimônio cresceu 2.5% hoje. Parabéns!"],
            tag: "Patrimônio ↑",
            tagColor: "bg-emerald-500"
        },
        expense: {
            title: "Decisão Inteligente",
            icon: MessageSquare,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
            user: "Posso comprar esse tênis de R$ 350? 👟",
            reply: ["Olhando seu saldo disponível para lazer: Sim!", "A compra está liberada sem comprometer suas metas."],
            tag: "Compra Segura",
            tagColor: "bg-emerald-600"
        }
    };

    React.useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % desktopSlides.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [desktopSlides.length]);

    React.useEffect(() => {
        const timer = setInterval(() => {
            setCurrentMobileSlide((prev) => (prev + 1) % mobileSlides.length);
        }, 4000);
        return () => clearInterval(timer);
    }, [mobileSlides.length]);

    return (
        <div className={`min-h-screen font-sans selection:bg-emerald-500/30 overflow-x-hidden transition-colors duration-500 ${theme === 'light' ? 'bg-white text-slate-900' : 'bg-slate-950 text-white'}`}>
            
            {/* Navbar Premium */}
            <nav className={`fixed top-0 left-0 right-0 z-[100] backdrop-blur-xl border-b transition-all duration-500 ${
                theme === 'light' ? 'bg-white/80 border-slate-100' : 'bg-slate-950/80 border-white/5'
            }`}>
                <div className="max-w-7xl mx-auto px-6 h-20 md:h-28 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img 
                            src={logo} 
                            alt="Alívia Logo" 
                            className={`w-28 md:w-36 h-auto ${theme === 'dark' ? 'brightness-0 invert' : ''}`} 
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleTheme}
                            className={`p-2.5 rounded-2xl transition-all border ${
                                theme === 'light' 
                                    ? 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100' 
                                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                            }`}
                        >
                            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={onLogin}
                            className="hidden md:block text-sm font-bold px-6 py-2.5 rounded-2xl hover:text-emerald-500 transition-colors"
                        >
                            Entrar
                        </button>
                        <button
                            onClick={onLogin}
                            className="px-6 py-2.5 md:px-8 md:py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
                        >
                            Assinar Agora
                        </button>
                    </div>
                </div>
            </nav>

            {/* HERO SECTION */}
            <section className="relative pt-40 pb-20 lg:pt-56 lg:pb-40 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-emerald-600/10 rounded-full blur-[140px] -z-10 opacity-60"></div>
                
                <div className="max-w-5xl mx-auto px-6 text-center space-y-8">
                    <div className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-xs font-black uppercase tracking-[0.2em] animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <Sparkles className="w-4 h-4 fill-emerald-400" />
                        <span>A Nova Era da Gestão Patrimonial</span>
                    </div>

                    <h1 className="text-5xl md:text-8xl font-black tracking-tight leading-[1] animate-in fade-in slide-in-from-bottom-6 duration-1000">
                        Domine suas Finanças com <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 drop-shadow-sm">Poder Real.</span>
                    </h1>

                    <p className={`text-lg md:text-2xl max-w-3xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100 ${
                        theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                        Muito mais que um controle de gastos. Alívia é sua <span className="text-emerald-400 font-bold">consultora financeira particular</span> que protege seu patrimônio e acalma sua mente.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-6 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200">
                        <button
                            onClick={onLogin}
                            className="w-full sm:w-auto px-10 py-5 rounded-[2rem] bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg shadow-2xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
                        >
                            Começar sua Jornada <ArrowRight className="w-6 h-6" />
                        </button>
                        <button 
                            onClick={onViewManual}
                            className={`w-full sm:w-auto px-10 py-5 rounded-[2rem] border font-black text-lg transition-all hover:bg-white/5 ${
                                theme === 'light' ? 'border-slate-200 text-slate-600' : 'border-white/10 text-white'
                            }`}
                        >
                            Ver Manual
                        </button>
                    </div>
                </div>
            </section>

            {/* DASHBOARD PREVIEW */}
            <section className="relative pb-32 z-10 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className={`relative rounded-[3rem] p-2 md:p-4 border shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300 ${
                        theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'
                    }`}>
                        <div className="aspect-video bg-slate-950 rounded-[2.5rem] relative group overflow-hidden shadow-inner">
                            {desktopSlides.map((slide, index) => (
                                <div
                                    key={index}
                                    className={`absolute inset-0 transition-all duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
                                >
                                    <img
                                        src={slide}
                                        alt={`Dashboard Preview ${index + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* THE THREE PILLARS SECTION */}
            <section className="py-32 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid lg:grid-cols-3 gap-8">
                        <div className={`p-10 rounded-[3rem] border transition-all hover:scale-[1.02] ${
                            theme === 'light' ? 'bg-white border-slate-100 shadow-xl' : 'bg-slate-900 border-white/5'
                        }`}>
                            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-8">
                                <Wallet className="w-8 h-8 text-blue-500" />
                            </div>
                            <h3 className="text-2xl font-black mb-4">Fluxo Inteligente</h3>
                            <p className="text-slate-500 leading-relaxed">
                                Gerencie entradas, saídas e <span className="text-blue-500 font-bold">resgates de investimentos</span> com um clique. O Guardião Financeiro avisa se você estiver prestes a criar uma dívida.
                            </p>
                        </div>

                        <div className={`p-10 rounded-[3rem] border transition-all hover:scale-[1.02] ${
                            theme === 'light' ? 'bg-white border-slate-100 shadow-xl' : 'bg-slate-900 border-white/5 shadow-2xl ring-1 ring-emerald-500/20'
                        }`}>
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-8">
                                <Activity className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h3 className="text-2xl font-black mb-4">Engenharia de Patrimônio</h3>
                            <p className="text-slate-500 leading-relaxed">
                                Visualize seu futuro. Acompanhe sua <span className="text-emerald-500 font-bold">Reserva de Emergência</span> e metas de longo prazo com cálculos automáticos de CDI.
                            </p>
                        </div>

                        <div className={`p-10 rounded-[3rem] border transition-all hover:scale-[1.02] ${
                            theme === 'light' ? 'bg-white border-slate-100 shadow-xl' : 'bg-slate-900 border-white/5'
                        }`}>
                            <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-8">
                                <BrainCircuit className="w-8 h-8 text-purple-500" />
                            </div>
                            <h3 className="text-2xl font-black mb-4">Consultoria Emocional</h3>
                            <p className="text-slate-500 leading-relaxed">
                                A Alívia IA não apenas mostra números, ela entende sua ansiedade. O <span className="text-purple-500 font-bold">Modo Pânico</span> ajuda você a tomar decisões racionais.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* INTERACTIVE ALÍVIA SECTION */}
            <section className={`py-32 border-y ${theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/[0.02] border-white/5'}`}>
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid lg:grid-cols-2 gap-20 items-center">
                        <div className="space-y-8">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-xs font-black uppercase">
                                <Bot className="w-4 h-4" />
                                Inteligência que se importa
                            </div>
                            <h2 className="text-4xl md:text-6xl font-black leading-tight text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-emerald-600">
                                Mais que um app,<br/>uma Aliada.
                            </h2>
                            <p className="text-slate-500 text-xl leading-relaxed">
                                A Alívia foi desenhada para entender que dinheiro gera estresse. Por isso, ela foca no seu acolhimento e clareza.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {Object.entries(scenarios).map(([id, s]) => (
                                    <button
                                        key={id}
                                        onClick={() => setActiveScenario(id)}
                                        className={`p-6 rounded-[2rem] border text-left transition-all ${
                                            activeScenario === id 
                                            ? 'bg-emerald-600 border-emerald-500 text-white shadow-xl shadow-emerald-500/20' 
                                            : `${theme === 'light' ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/5 border-white/5 text-slate-400'} hover:border-emerald-500/50`
                                        }`}
                                    >
                                        <s.icon className={`w-6 h-6 mb-3 ${activeScenario === id ? 'text-white' : s.color}`} />
                                        <div className="font-black text-sm">{s.title}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="relative">
                            <div className={`rounded-[3rem] border shadow-2xl overflow-hidden transition-all duration-500 ${
                                theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'
                            }`}>
                                <div className={`p-6 border-b flex items-center justify-between ${theme === 'light' ? 'bg-slate-50' : 'bg-white/5'}`}>
                                    <div className="flex items-center gap-3">
                                        <img src={aliviaFinal} alt="Alívia" className="w-12 h-12 rounded-full border-2 border-emerald-500 object-cover" />
                                        <div>
                                            <div className="font-black text-sm uppercase">Alívia IA</div>
                                            <div className="text-[10px] text-emerald-500 font-bold animate-pulse">Online agora</div>
                                        </div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-[10px] font-black text-white ${scenarios[activeScenario].tagColor}`}>
                                        {scenarios[activeScenario].tag}
                                    </div>
                                </div>
                                
                                <div className="p-8 space-y-6 h-[400px] overflow-y-auto custom-scrollbar">
                                    <div className="flex justify-end">
                                        <div className="bg-emerald-600 text-white px-5 py-3 rounded-[1.5rem] rounded-br-none text-sm max-w-[80%] font-bold">
                                            {scenarios[activeScenario].user}
                                        </div>
                                    </div>
                                    <div className="flex justify-start">
                                        <div className={`px-5 py-3 rounded-[1.5rem] rounded-bl-none text-sm max-w-[80%] font-bold ${
                                            theme === 'light' ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-slate-200'
                                        }`}>
                                            {scenarios[activeScenario].reply.map((line, i) => (
                                                <p key={i} className={i === 0 ? "mb-2" : ""}>{line}</p>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* PRICING SECTION */}
            <section className="py-32 relative">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="text-center space-y-6 mb-20">
                        <h2 className="text-4xl md:text-6xl font-black">Plano <span className="text-emerald-500">Premium.</span></h2>
                        <p className="text-slate-500 text-xl max-w-2xl mx-auto font-medium">
                            Tecnologia que economiza seu tempo, dinheiro e saúde mental.
                        </p>

                        <div className="flex items-center justify-center gap-4 pt-4">
                            <span className={`text-sm font-black ${billing === 'monthly' ? 'text-emerald-500' : 'text-slate-400'}`}>Mensal</span>
                            <button
                                onClick={() => setBilling(billing === 'monthly' ? 'annual' : 'monthly')}
                                className="w-16 h-9 bg-slate-200 dark:bg-white/10 rounded-full relative p-1 transition-all"
                            >
                                <div className={`w-7 h-7 bg-emerald-600 rounded-full transition-all transform ${billing === 'annual' ? 'translate-x-7' : 'translate-x-0'}`}></div>
                            </button>
                            <span className={`text-sm font-black ${billing === 'annual' ? 'text-emerald-500' : 'text-slate-400'}`}>
                                Anual <span className="bg-emerald-500/20 text-emerald-500 text-[10px] px-2 py-1 rounded-full ml-1">ECONOMIA 16%</span>
                            </span>
                        </div>
                    </div>

                    <div className={`relative rounded-[4rem] p-8 md:p-16 border overflow-hidden group hover:scale-[1.01] transition-all duration-500 ${
                        theme === 'light' ? 'bg-white border-slate-200 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl ring-1 ring-emerald-500/30'
                    }`}>
                        <div className="grid md:grid-cols-2 gap-16 items-center relative z-10">
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-emerald-500 font-black tracking-widest text-sm uppercase mb-2">Acesso Ilimitado</h3>
                                    <h2 className="text-5xl font-black">Premium</h2>
                                </div>
                                <div className="space-y-4">
                                    <CheckItem text="7 Dias de Teste Gratuito" theme={theme} />
                                    <CheckItem text="Consultora IA Alívia Ilimitada" theme={theme} />
                                    <CheckItem text="Módulo de Patrimônio & CDI" theme={theme} />
                                    <CheckItem text="Guardião de Saldo & Dívidas" theme={theme} />
                                    <CheckItem text="Resgates Inteligentes" theme={theme} />
                                </div>
                            </div>

                            <div className={`p-10 rounded-[3rem] text-center space-y-6 ${
                                theme === 'light' ? 'bg-slate-50' : 'bg-white/5'
                            }`}>
                                <div className="space-y-1">
                                    <div className="text-slate-500 font-bold text-xs uppercase tracking-widest">Apenas</div>
                                    <div className="text-6xl font-black flex items-center justify-center gap-2">
                                        <span className="text-2xl opacity-40 font-bold">R$</span>
                                        {billing === 'monthly' ? '29,90' : '24,90'}
                                    </div>
                                    <div className="text-slate-500 font-bold text-sm">por mês</div>
                                </div>

                                <button
                                    onClick={onLogin}
                                    className="w-full py-5 rounded-[2rem] bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg shadow-xl shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                                >
                                    Começar Teste Grátis
                                </button>
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Cancele quando quiser • Sem fidelidade</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className={`py-20 border-t ${theme === 'light' ? 'bg-white border-slate-100' : 'bg-slate-950 border-white/5'}`}>
                <div className="max-w-7xl mx-auto px-6 text-center space-y-10">
                    <img src={logo} alt="Alívia" className={`w-32 mx-auto ${theme === 'dark' ? 'brightness-0 invert' : ''}`} />
                    
                    <div className="flex flex-wrap justify-center gap-10 text-sm font-bold uppercase tracking-widest text-slate-500">
                        <button onClick={onViewManual} className="hover:text-emerald-500 transition-colors">Manual</button>
                        <button onClick={onViewTerms} className="hover:text-emerald-500 transition-colors">Termos</button>
                        <button onClick={onViewPrivacy} className="hover:text-emerald-500 transition-colors">Privacidade</button>
                        <button onClick={onViewContact} className="hover:text-emerald-500 transition-colors">Contato</button>
                    </div>

                    <div className="text-slate-500 text-xs font-medium opacity-60">
                        &copy; {new Date().getFullYear()} Alívia • Sua Inteligência Financeira.<br/>
                        <span className="text-[9px] font-black tracking-[0.3em] uppercase mt-4 block opacity-30">Versão 7.0 Build Premium</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function CheckItem({ text, theme }) {
    return (
        <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 p-1.5 rounded-full shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <span className={`font-bold text-sm ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{text}</span>
        </div>
    );
}
