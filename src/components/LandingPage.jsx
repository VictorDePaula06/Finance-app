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
    Calculator
} from 'lucide-react';
import logo from '../assets/logo.png';
import dashboardPreview from '../assets/dashboard-preview.png';
import dashboardPreview2 from '../assets/dash.png';
import mobile1 from '../assets/mobile1.png';
import mobile2 from '../assets/mobile2.png';
import mobile3 from '../assets/mobile3.png';
import mobile4 from '../assets/mobile4.png';

export default function LandingPage({ onLogin, onViewPrivacy, onViewTerms }) {
    const [billing, setBilling] = React.useState('monthly');
    const [currentSlide, setCurrentSlide] = React.useState(0);
    const [currentMobileSlide, setCurrentMobileSlide] = React.useState(0);

    const desktopSlides = [dashboardPreview, dashboardPreview2];
    const mobileSlides = [mobile1, mobile2, mobile3, mobile4];

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
        <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30">

            {/* Navbar */}
            <nav className="fixed w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/10">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src={logo} alt="Logo" className="w-10 h-auto" />
                        <span className="font-bold text-xl tracking-tight">Finance Control</span>
                    </div>
                    <button
                        onClick={onLogin}
                        className="px-5 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-sm font-medium transition-all border border-slate-700 hover:border-slate-600"
                    >
                        Entrar
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] -z-10 opacity-50"></div>

                <div className="max-w-4xl mx-auto px-6 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <Zap className="w-4 h-4 fill-blue-400" />
                        <span>Inteligência Artificial Integrada</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1] animate-in fade-in slide-in-from-bottom-6 duration-1000">
                        Domine suas Finanças com <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Poder Real.</span>
                    </h1>

                    <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
                        Deixe planilhas chatas no passado. Use nossa IA para analisar gastos, prever o futuro e tomar decisões financeiras inteligentes em segundos.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200">
                        <button
                            onClick={onLogin}
                            className="w-full sm:w-auto px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg shadow-lg shadow-blue-500/25 transition-all hover:scale-105 flex items-center justify-center gap-2"
                        >
                            Começar Agora <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </section>

            {/* Dashboard Preview Section */}
            <section className="relative pb-20 z-10 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="relative rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300 ring-1 ring-white/10">
                        {/* Browser Header Mockup */}
                        <div className="h-8 bg-slate-800/50 border-b border-slate-700 flex items-center px-4 gap-2">
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
                                Consultoria na <span className="text-blue-400">Palma da Mão</span>
                            </h2>
                            <p className="text-slate-400 text-lg mb-8 leading-relaxed">
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
                            <div className="relative w-[300px] h-[600px] bg-slate-900 rounded-[3rem] border-8 border-slate-800 shadow-2xl ring-1 ring-white/10 overflow-hidden">
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
                                        <div className="absolute top-2 left-6 text-[10px] font-bold text-white z-10">9:41</div>

                                        {/* Bottom Home Indicator */}
                                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full z-10"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-20 bg-slate-900/50">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Tudo o que você precisa</h2>
                        <p className="text-slate-400">Uma suite completa para sua liberdade financeira.</p>
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
                            color="text-blue-400"
                            bg="bg-blue-500/10"
                        />
                    </div>
                </div>
            </section>

            {/* Pricing Section (Subscription) */}
            <section className="py-24 relative overflow-hidden">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Escolha seu Plano</h2>
                        <p className="text-slate-400">Comece grátis. Cancele quando quiser.</p>

                        {/* Billing Toggle */}
                        <div className="flex items-center justify-center gap-4 mt-8">
                            <span className={`text-sm font-medium ${billing === 'monthly' ? 'text-white' : 'text-slate-500'}`}>Mensal</span>
                            <button
                                onClick={() => setBilling(billing === 'monthly' ? 'annual' : 'monthly')}
                                className="w-14 h-8 bg-slate-800 rounded-full relative border border-slate-700 transition-colors"
                            >
                                <div className={`absolute top-1 left-1 w-6 h-6 bg-blue-500 rounded-full transition-transform ${billing === 'annual' ? 'translate-x-6' : ''}`}></div>
                            </button>
                            <span className={`text-sm font-medium ${billing === 'annual' ? 'text-white' : 'text-slate-500'}`}>
                                Anual <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full ml-1">-16% OFF</span>
                            </span>
                        </div>
                    </div>

                    <div className="relative bg-gradient-to-b from-slate-800 to-slate-900 rounded-3xl p-8 md:p-12 border border-slate-700 shadow-2xl">
                        {/* Glow Effect */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>

                        <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
                            <div>
                                <h2 className="text-3xl md:text-4xl font-bold mb-4">Assinatura <span className="text-blue-400">Premium</span></h2>
                                <p className="text-slate-400 text-lg mb-8">
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

                            <div className="bg-slate-950/50 rounded-2xl p-8 border border-blue-500/30 text-center relative hover:scale-[1.02] transition-transform duration-300">
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg shadow-blue-500/20">
                                    TESTE GRÁTIS
                                </div>
                                <p className="text-slate-400 mb-2 mt-4">{billing === 'monthly' ? 'Pague apenas' : 'De R$ 358,80 por'}</p>
                                <div className="text-5xl font-bold text-white mb-2">
                                    R$ {billing === 'monthly' ? '29,90' : '24,90'}
                                    <span className="text-xl text-slate-500">/mês</span>
                                </div>
                                {billing === 'annual' && <p className="text-emerald-400 text-sm font-medium mb-8">Faturado R$ 299,00 anualmente</p>}
                                {billing === 'monthly' && <p className="text-slate-500 text-sm font-medium mb-8">Cancele a qualquer momento</p>}

                                <button
                                    onClick={onLogin}
                                    className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg shadow-lg shadow-blue-500/25 transition-all"
                                >
                                    Iniciar Teste de 7 Dias
                                </button>
                                <p className="text-xs text-slate-500 mt-4">Nenhuma cobrança hoje. Acesso imediato.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section >

            {/* Footer */}
            <footer className="py-12 border-t border-slate-900 bg-slate-950">
                <div className="max-w-7xl mx-auto px-6 text-center text-slate-500">
                    <p className="mb-4">&copy; {new Date().getFullYear()} Finance Control. Todos os direitos reservados.</p>
                    <div className="flex justify-center gap-6 text-sm mb-8">
                        <button onClick={onViewTerms} className="hover:text-slate-300 transition-colors">Termos de Uso</button>
                        <button onClick={onViewPrivacy} className="hover:text-slate-300 transition-colors">Privacidade</button>
                        <a
                            href="https://wa.me/5500000000000"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-slate-300 transition-colors"
                        >
                            Suporte
                        </a>
                    </div>
                    <div className="flex justify-center">
                        <a
                            href="https://wa.me/5500000000000"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg hover:bg-emerald-600/20 transition-all"
                        >
                            Dúvidas? Chame no WhatsApp
                        </a>
                    </div>
                </div>
            </footer>
        </div >
    );
}

function FeatureCard({ icon: Icon, title, desc, color, bg }) {
    return (
        <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-all hover:bg-slate-800 group">
            <div className={`w-12 h-12 rounded-lg ${bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <h3 className="text-xl font-bold mb-2">{title}</h3>
            <p className="text-slate-400 leading-relaxed text-sm">
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
            <span className="text-slate-300">{text}</span>
        </div>
    );
}
