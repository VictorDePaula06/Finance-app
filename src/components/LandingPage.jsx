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
    Calculator,
    Bot,
    Sparkles,
    MessageSquare,
    AlertCircle
} from 'lucide-react';
import logo from '../assets/logo.png';
import aliviaFinal from '../assets/alivia/alivia-final.png';
import dashboardReal from '../assets/dashboard-real.png';
import Dashboard1 from '../assets/Dashboard1.jpeg';

import Dashboard2 from '../assets/Dashboard2.jpeg';
import Dashboard3 from '../assets/Dashboard3.jpeg';
import Dashboard4 from '../assets/Dashboard4.jpeg';
import Mobile1 from '../assets/Mobile1.jpeg';
import Mobile2 from '../assets/Mobile2.jpeg';
import Mobile3 from '../assets/Mobile3.jpeg';
import Mobile4 from '../assets/Mobile4.jpeg';



export default function LandingPage({ onLogin, onViewPrivacy, onViewTerms, onViewManual, onViewContact }) {
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
            user: "Alívia, surgiu um gasto inesperado no carro e estou desesperado... 😰",
            reply: ["Respira fundo, Ana. Eu entendo que isso assusta, mas você não está sozinho nessa.", "Olhando aqui, sua Margem de Segurança cobre esse valor. Vamos ajustar as categorias?"],
            tag: "Pânico Ativado",
            tagColor: "bg-rose-500"
        },
        invest: {
            title: "Investimento",
            icon: TrendingUp,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
            user: "Alívia! Acabei de investir R$ 400 reais hoje! 🚀",
            reply: ["Incrível, Marcos! Esse aporte é um passo gigante para sua liberdade financeira.", "Com isso, seu patrimônio cresceu 1.2% este mês. Continue assim!"],
            tag: "Patrimônio ↑",
            tagColor: "bg-emerald-500"
        },
        expense: {
            title: "Dúvida de Gasto",
            icon: MessageSquare,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
            user: "Alívia, quero comprar um tênis de R$ 300. Posso?",
            reply: ["Bom saber que perguntou! Olhando seu orçamento de Lazer, você ainda tem R$ 450.", "A compra está liberada! Vai sem culpa, você merece esse conforto."],
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
        <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-emerald-500/30 overflow-x-hidden">
            {/* Navbar - Light Mode */}
            <nav className="fixed top-0 left-0 right-0 z-[100] bg-white/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 md:px-6 h-24 md:h-32 flex items-center justify-between relative">
                    {/* Left: Spacer */}
                    <div className="w-20 md:w-32 invisible md:visible h-1"></div>

                    {/* Center: Logo - Perfectly centered vertically and horizontally */}
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
                        <img src={logo} alt="Alívia Logo" className="w-28 md:w-40 h-auto transition-all hover:scale-105 pointer-events-auto" />
                    </div>

                    {/* Right: Login Button */}
                    <div className="flex justify-end z-10">
                        <button
                            onClick={onLogin}
                            className="px-4 py-2 md:px-6 md:py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] md:text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
                        >
                            Entrar
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] -z-10 opacity-50"></div>

                <div className="max-w-4xl mx-auto px-6 text-center">
                    <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <Zap className="w-4 h-4 fill-emerald-400" />
                        <span>Inteligência Artificial Integrada</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1] animate-in fade-in slide-in-from-bottom-6 duration-1000">
                        Domine suas Finanças com <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Poder Real.</span>
                    </h1>

                    <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
                        O primeiro gerenciador financeiro focado no seu <span className="text-slate-900 font-bold">bem-estar</span>. Use a Alívia para entender seus gastos, prever o futuro e encontrar paz de espírito, não apenas números.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200">
                        <button
                            onClick={onLogin}
                            className="w-full sm:w-auto px-8 py-4 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 flex items-center justify-center gap-2"
                        >
                            Começar Agora <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </section>

            {/* Dashboard Preview Section */}
            <section className="relative pb-20 z-10 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="relative rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
                        {/* Browser Header Mockup */}
                        <div className="h-8 bg-slate-50 border-b border-slate-200 flex items-center px-4 gap-2">
                            <div className="w-3 h-3 rounded-full bg-rose-500/50"></div>
                            <div className="w-3 h-3 rounded-full bg-amber-500/50"></div>
                            <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
                        </div>

                        {/* Image Slider */}
                        <div className="aspect-video bg-slate-950 relative group cursor-pointer overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10 pointer-events-none"></div>

                            {desktopSlides.map((slide, index) => (
                                <div
                                    key={index}
                                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
                                >
                                    <img
                                        src={slide}
                                        alt={`Dashboard Preview ${index + 1}`}
                                        className="w-full h-full object-cover"
                                        onError={(e) => e.target.style.display = 'none'}
                                    />
                                </div>
                            ))}

                            {/* Slider Navigation Dots */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                                {desktopSlides.map((_, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setCurrentSlide(index)}
                                        className={`w-2 h-2 rounded-full transition-all ${index === currentSlide ? 'bg-white w-6' : 'bg-white/30 hover:bg-white/50'}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Mobile App Section */}
            <section className="py-24 relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="order-2 md:order-1">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-6">
                                <Zap className="w-4 h-4 fill-emerald-400" />
                                <span>App Completo</span>
                            </div>
                            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                                Consultoria na <span className="text-emerald-400">Palma da Mão</span>
                            </h2>
                            <p className="text-slate-600 text-lg mb-8 leading-relaxed">
                                Gerencie suas finanças de qualquer lugar. Adicione gastos em segundos, verifique seu saldo e receba alertas direto pelo celular.
                            </p>

                            <div className="space-y-4">
                                <CheckItem text="Web App ultra rápido: Acesse de qualquer lugar" />
                                <CheckItem text="Sem instalação: Funciona direto no navegador" />
                                <CheckItem text="Adicione transações em 3 segundos" />
                                <CheckItem text="Notificações inteligentes de gastos" />
                            </div>
                        </div>

                        <div className="order-1 md:order-2 flex justify-center">
                            {/* Phone Mockup */}
                            <div className="relative w-[300px] h-[600px] bg-slate-50 rounded-[3rem] border-8 border-slate-100 shadow-2xl ring-1 ring-slate-200 overflow-hidden">
                                {/* Dynamic Island */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-xl z-20"></div>

                                {/* Screen Content (Realistic App Slider) */}
                                <div className="absolute inset-0 bg-slate-950 overflow-hidden select-none">
                                    <div className="w-full h-full relative">
                                        {/* Background gradient if no image */}
                                        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-950 z-0"></div>

                                        {/* Mobile Slides */}
                                        {mobileSlides.map((slide, index) => (
                                            <div
                                                key={index}
                                                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentMobileSlide ? 'opacity-100' : 'opacity-0'}`}
                                            >
                                                <img
                                                    src={slide}
                                                    alt={`Mobile Screen ${index + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ))}

                                        {/* Mock UI Overlay (Status Bar, etc) */}
                                        <div className="absolute top-2 right-4 flex gap-1 z-10">
                                            <div className="w-4 h-2.5 bg-white rounded-[1px]"></div>
                                            <div className="w-0.5 h-1 bg-white absolute -right-0.5 top-0.5"></div>
                                        </div>
                                        <div className="absolute top-2 left-6 text-[10px] font-bold text-slate-400 z-10">9:41</div>

                                        {/* Bottom Home Indicator */}
                                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full z-10"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
 
             {/* Alívia Advisor Section */}
            <section className="py-24 relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid lg:grid-cols-2 gap-20 items-center">
                        <div className="order-2 lg:order-1 relative">
                            {/* Scenario Selection Tags */}
                            <div className="flex flex-wrap gap-2 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                {Object.entries(scenarios).map(([id, scenario]) => (
                                    <button
                                        key={id}
                                        onClick={() => setActiveScenario(id)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${activeScenario === id
                                            ? `${scenario.bg} ${scenario.color} border-emerald-500/50 shadow-lg`
                                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                            }`}
                                    >
                                        <scenario.icon className="w-3.5 h-3.5" />
                                        {scenario.title}
                                    </button>
                                ))}
                            </div>

                            {/* Chat Mockup Wrapper */}
                            <div className="relative max-w-md mx-auto lg:ml-0 bg-white backdrop-blur-2xl rounded-3xl border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden transition-all duration-500">
                                {/* Chat Header */}
                                <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <img src={aliviaFinal} alt="Alívia" className="w-10 h-10 rounded-full border border-emerald-400/50 object-cover" />
                                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#0B0F1A] rounded-full"></div>
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-800">Pronta para ajudar</div>
                                            <div className="text-[10px] text-emerald-600 font-medium">Sempre online</div>
                                        </div>
                                    </div>
                                    
                                    {/* Action Tags */}
                                    <div className={`px-2.5 py-1 rounded-full text-[9px] font-black text-white ${scenarios[activeScenario].tagColor} animate-pulse shadow-lg`}>
                                        {scenarios[activeScenario].tag}
                                    </div>
                                </div>

                                {/* Chat Body */}
                                <div className="p-6 space-y-6 min-h-[350px] relative bg-gradient-to-b from-transparent to-black/20">
                                    <div className="flex justify-end animate-in fade-in slide-in-from-right-4 duration-500">
                                        <div className="bg-emerald-600/20 text-emerald-100 px-4 py-3 rounded-2xl rounded-br-none text-sm max-w-[85%] border border-emerald-500/20 shadow-lg leading-relaxed">
                                            {scenarios[activeScenario].user}
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-start animate-in fade-in slide-in-from-left-4 duration-500 delay-200">
                                        <div className="bg-slate-100 text-slate-700 px-4 py-3 rounded-2xl rounded-bl-none text-sm max-w-[85%] border border-slate-200 shadow-sm leading-relaxed">
                                            {scenarios[activeScenario].reply.map((line, i) => (
                                                <p key={i} className={i === 0 ? "mb-2" : ""}>{line}</p>
                                            ))}
                                        </div>
                                    </div>

                                    {activeScenario === 'panic' && (
                                        <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-500 delay-500">
                                            <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-xl text-[10px] flex items-center gap-2 border border-emerald-500/20 font-bold backdrop-blur-sm">
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                                Análise de Impacto: Margem Segura ✅
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Chat Input Area */}
                                <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3">
                                    <div className="flex-1 bg-white rounded-2xl h-11 border border-slate-200 px-4 flex items-center">
                                        <span className="text-slate-400 text-xs italic">O que mais você precisa?</span>
                                    </div>
                                    <div className="w-11 h-11 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 hover:scale-105 transition-transform">
                                        <ArrowRight className="w-5 h-5 text-white" />
                                    </div>
                                </div>
                            </div>

                            {/* Glow behind the card */}
                            <div className={`absolute -inset-10 ${scenarios[activeScenario].icon === AlertCircle ? 'bg-rose-500/10' : 'bg-emerald-500/10'} rounded-full blur-[80px] -z-10 transition-colors duration-700`}></div>
                        </div>

                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-6">
                                <Sparkles className="w-4 h-4" />
                                <span>A Inteligência que se importa</span>
                            </div>
                            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight text-slate-900">
                                Menos frieza, mais <span className="text-emerald-400">Acolhimento.</span>
                            </h2>
                             <p className="text-slate-600 text-lg mb-8 leading-relaxed max-w-xl">
                                A Alívia foi desenhada para ser sua aliada emocional. Ela entende que o dinheiro gera ansiedade e está aqui para dar clareza, segurança e incentivo.
                            </p>
                            
                            <div className="space-y-6">
                                <div className={`p-5 rounded-2xl transition-all border ${activeScenario === 'panic' ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
                                    <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-rose-500" /> Suporte em Crises
                                    </h4>
                                    <p className="text-sm text-slate-600 leading-relaxed">O Modo Pânico acalma você e evita decisões impulsivas em momentos de estresse.</p>
                                </div>
                                <div className={`p-5 rounded-2xl transition-all border ${activeScenario === 'invest' ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                                    <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-emerald-400" /> Incentivo Real
                                    </h4>
                                    <p className="text-sm text-slate-600 leading-relaxed">Comemore cada pequena vitória. A Alívia mostra como seus aportes constroem seu futuro.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-20 bg-slate-50/50">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Tudo o que você precisa</h2>
                        <p className="text-slate-500">Uma suite completa para sua liberdade financeira.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={BrainCircuit}
                            title="Consultor IA Pessoal"
                            desc="Converse com sua carteira. Pergunte 'Posso comprar isso?' e receba análises baseadas no seu histórico real."
                            color="text-purple-400"
                            bg="bg-purple-500/10"
                        />
                        <FeatureCard
                            icon={PieChart}
                            title="Analytics Poderoso"
                            desc="Gráficos interativos que mostram exatamente para onde seu dinheiro vai, sem complicações."
                            color="text-emerald-400"
                            bg="bg-emerald-500/10"
                        />
                        <FeatureCard
                            icon={ShieldCheck}
                            title="Simulações de Risco"
                            desc="Preveja o impacto de grandes compras antes de passar o cartão. Evite o vermelho com inteligência."
                            color="text-emerald-400"
                            bg="bg-emerald-500/10"
                        />
                    </div>
                </div>
            </section>

            {/* Pricing Section (Subscription) */}
            <section className="py-24 relative overflow-hidden">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Escolha seu Plano</h2>
                        <p className="text-slate-500">Comece grátis. Cancele quando quiser.</p>

                        {/* Billing Toggle */}
                        <div className="flex items-center justify-center gap-4 mt-8">
                            <span className={`text-sm font-medium ${billing === 'monthly' ? 'text-slate-900' : 'text-slate-400'}`}>Mensal</span>
                            <button
                                onClick={() => setBilling(billing === 'monthly' ? 'annual' : 'monthly')}
                                className="w-14 h-8 bg-slate-100 rounded-full relative border border-slate-200 transition-colors"
                            >
                                <div className={`absolute top-1 left-1 w-6 h-6 bg-emerald-500 rounded-full transition-transform ${billing === 'annual' ? 'translate-x-6' : ''}`}></div>
                            </button>
                            <span className={`text-sm font-medium ${billing === 'annual' ? 'text-slate-900' : 'text-slate-400'}`}>
                                Anual <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full ml-1">-16% OFF</span>
                            </span>
                        </div>
                    </div>

                    <div className="relative bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-2xl">
                        {/* Glow Effect */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>

                        <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
                            <div>
                                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">Assinatura <span className="text-emerald-600">Premium</span></h2>
                                <p className="text-slate-600 text-lg mb-8">
                                    Tenha acesso ilimitado à inteligência artificial que vai transformar sua vida financeira.
                                </p>
                                <div className="space-y-4">
                                    <CheckItem text="7 Dias Totalmente Grátis" />
                                    <CheckItem text="Transações Ilimitadas" />
                                    <CheckItem text="Consultor financeiro com IA" />
                                    <CheckItem text="Simulações de Risco" />
                                    <CheckItem text="Sincronização na Nuvem" />
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-8 border border-emerald-500/20 text-center relative hover:scale-[1.02] transition-transform duration-300">
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg shadow-emerald-500/10">
                                    TESTE GRÁTIS
                                </div>
                                <p className="text-slate-500 mb-2 mt-4">{billing === 'monthly' ? 'Pague apenas' : 'De R$ 358,80 por'}</p>
                                <div className="text-5xl font-bold text-slate-900 mb-2">
                                    R$ {billing === 'monthly' ? '29,90' : '24,90'}
                                    <span className="text-xl text-slate-400">/mês</span>
                                </div>
                                {billing === 'annual' && <p className="text-emerald-400 text-sm font-medium mb-8">Faturado R$ 299,00 anualmente</p>}
                                {billing === 'monthly' && <p className="text-slate-500 text-sm font-medium mb-8">Cancele a qualquer momento</p>}

                                <button
                                    onClick={onLogin}
                                    className="mx-auto px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 group"
                                >
                                    Começar Agora
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                                <p className="text-xs text-slate-500 mt-4">Nenhuma cobrança hoje. Acesso imediato.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section >

            {/* Footer */}
            <footer className="py-12 border-t border-slate-100 bg-white">
                <div className="max-w-7xl mx-auto px-6 text-center text-slate-400">
                    <p className="mb-2">&copy; {new Date().getFullYear()} Alívia. Todos os direitos reservados.</p>
                    <p className="mb-4 text-[10px] font-bold tracking-widest uppercase opacity-40">v6.0</p>
                    <div className="flex flex-wrap justify-center gap-6 text-sm mb-8">
                        <button onClick={onViewManual} className="text-emerald-400 font-bold hover:text-emerald-300 transition-colors">Manual do Sistema</button>
                        <button onClick={onViewTerms} className="hover:text-slate-300 transition-colors">Termos de Uso</button>
                        <button onClick={onViewPrivacy} className="hover:text-slate-300 transition-colors">Privacidade</button>
                    </div>
                    <div className="flex justify-center">
                        <button
                            onClick={onViewContact}
                            className="flex items-center gap-2 px-6 py-2 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg hover:bg-emerald-600/20 transition-all"
                        >
                            Contato
                        </button>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon: Icon, title, desc, color, bg }) {
    return (
        <div className="p-6 rounded-2xl bg-white border border-slate-100 hover:border-emerald-200 transition-all hover:bg-slate-50 group shadow-sm">
            <div className={`w-12 h-12 rounded-lg ${bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <h3 className="text-xl font-bold mb-2">{title}</h3>
            <p className="text-slate-600 leading-relaxed text-sm">
                {desc}
            </p>
        </div>
    );
}

function CheckItem({ text }) {
    return (
        <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 p-1 rounded-full">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-slate-600">{text}</span>
        </div>
    );
}
