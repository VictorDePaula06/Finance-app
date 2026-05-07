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
    Bot,
    Lock,
    Globe,
    BarChart3,
    Smartphone,
    Cloud,
    FileText,
    HelpCircle,
    ChevronDown,
    Plus,
    Minus,
    CreditCard,
    Landmark,
    PiggyBank,
    LineChart,
    Layers,
    Navigation,
    Shield,
    User,
    LockKeyhole,
    Fingerprint,
    HeartHandshake,
    Quote,
    RefreshCw,
    Compass
} from 'lucide-react';
import logo from '../assets/logo.png';
import aliviaFinal from '../assets/alivia/alivia-final.png';

// Import New Screenshots
import hubImg from '../assets/screenshots/hub.png';
import gastosImg from '../assets/screenshots/gastos.png';
import patrimonioImg from '../assets/screenshots/patrimonio.png';

export default function LandingPage({ onLogin, onViewPrivacy, onViewTerms, onViewManual, onViewContact }) {
    const [billing, setBilling] = React.useState('monthly');
    const [activeScenario, setActiveScenario] = React.useState('panic');
    const [openFaq, setOpenFaq] = React.useState(null);

    const scenarios = {
        panic: {
            title: "Modo Pânico",
            icon: AlertCircle,
            color: "text-rose-400",
            bg: "bg-rose-50",
            user: "Alívia, surgiu um gasto inesperado e estou desesperada... 😰",
            reply: ["Calma, Ana. Eu analisei suas reservas.", "Sua Margem de Segurança cobre isso. Vamos ajustar o plano?"],
            tag: "Guardião Ativado",
            tagColor: "bg-rose-400"
        },
        invest: {
            title: "Crescimento",
            icon: TrendingUp,
            color: "text-[#69C8B9]",
            bg: "bg-[#69C8B9]/10",
            user: "Alívia! Consegui investir R$ 500 hoje! 🚀",
            reply: ["Incrível! Esse aporte acelerou sua meta de Independência em 2 meses.", "Seu patrimônio cresceu 2.5% hoje. Parabéns!"],
            tag: "Patrimônio ↑",
            tagColor: "bg-[#69C8B9]"
        },
        expense: {
            title: "Decisão Inteligente",
            icon: MessageSquare,
            color: "text-[#5CCEEA]",
            bg: "bg-[#5CCEEA]/10",
            user: "Posso comprar esse tênis de R$ 350? 👟",
            reply: ["Olhando seu saldo disponível para lazer: Sim!", "A compra está liberada sem comprometer suas metas."],
            tag: "Compra Segura",
            tagColor: "bg-[#5CCEEA]"
        }
    };

    const faqs = [
        {
            q: "Como funciona o teste grátis?",
            a: "Ao criar sua conta, você recebe acesso total a todas as funcionalidades Premium por 7 dias. Não pedimos cartão de crédito para começar."
        },
        {
            q: "Meus dados bancários estão seguros?",
            a: "A Alívia não pede suas senhas bancárias. Você registra seus gastos de forma manual ou por IA, garantindo 100% de privacidade e controle."
        },
        {
            q: "Qual a diferença entre os planos?",
            a: "O plano Standard foca no controle rigoroso de gastos e cartões. O Premium adiciona inteligência artificial avançada e gestão completa de patrimônio e investimentos."
        }
    ];

    return (
        <div className="landing-page-wrapper min-h-screen selection:bg-[#69C8B9]/30 overflow-x-hidden transition-all duration-700 bg-white text-slate-800" style={{
            backgroundImage: `
                radial-gradient(at 0% 0%, rgba(105, 200, 185, 0.12) 0px, transparent 60%),
                radial-gradient(at 100% 0%, rgba(92, 206, 234, 0.12) 0px, transparent 60%)
            `,
            backgroundAttachment: 'fixed'
        }}>
            
            {/* Navbar Premium - Compact */}
            <nav className="fixed top-0 left-0 right-0 z-[100] backdrop-blur-md border-b bg-white/70 border-slate-100">
                <div className="max-w-7xl mx-auto px-6 h-16 md:h-20 grid grid-cols-3 items-center">
                    <div className="flex items-center gap-4"></div>
                    <div className="flex justify-center">
                        <img src={logo} alt="Alívia Logo" className="w-24 md:w-28 h-auto" />
                    </div>
                    <div className="flex items-center justify-end gap-3">
                        <button onClick={onLogin} className="hidden md:block text-xs font-bold px-4 py-2 rounded-xl text-slate-500 hover:text-[#69C8B9] transition-colors">Entrar</button>
                        <button onClick={onLogin} className="px-5 py-2 md:px-6 md:py-2.5 rounded-xl bg-[#69C8B9] hover:bg-[#5bb1a3] text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-[#69C8B9]/10 active:scale-95">Assinar Agora</button>
                    </div>
                </div>
            </nav>

            {/* HERO SECTION - COMPACT */}
            <section className="relative pt-32 pb-16 lg:pt-48 lg:pb-24 overflow-hidden text-center">
                <div className="max-w-5xl mx-auto px-6 space-y-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#69C8B9]/10 border border-[#69C8B9]/10 text-[#5bb1a3] text-[10px] font-black uppercase tracking-widest mx-auto">
                        <span>A única consultora IA que protege seu futuro</span>
                    </div>
                    <h1 className="text-4xl md:text-7xl font-black tracking-tight leading-[1.1] text-slate-900">
                        Sua Vida Financeira <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#69C8B9] to-[#5CCEEA]">Elevada ao Máximo.</span>
                    </h1>
                    <p className="text-base md:text-xl max-w-2xl mx-auto leading-relaxed font-medium text-slate-500">
                        Alívia une <span className="text-[#5CCEEA] font-bold">Gestão de Gastos</span> cirúrgica com <span className="text-[#69C8B9] font-bold">Engenharia de Patrimônio</span>. Tudo guiado por uma IA que combina com seu ritmo.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        <button onClick={onLogin} className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#69C8B9] hover:bg-[#5bb1a3] text-white font-black text-lg shadow-xl shadow-[#69C8B9]/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 group">
                            Começar Agora <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                        </button>
                    </div>
                </div>
            </section>

            {/* DASHBOARD PREVIEW - COMPACT */}
            <section className="relative pb-24 z-10 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="relative rounded-[2.5rem] p-2 md:p-4 border shadow-xl bg-white/60 border-slate-100 overflow-hidden">
                        <div className="aspect-video bg-white rounded-[2rem] relative group overflow-hidden shadow-inner flex items-center justify-center p-2">
                            <img src={hubImg} alt="App Hub" className="w-full h-full object-contain rounded-[1.8rem] transition-transform duration-700 group-hover:scale-[1.01]" />
                        </div>
                    </div>
                </div>
            </section>

            {/* METHODOLOGY - COMPACT */}
            <section className="py-24 relative overflow-hidden">
                <div className="max-w-6xl mx-auto px-6 text-center">
                    <div className="space-y-4 mb-16">
                        <div className="text-[#69C8B9] text-[10px] font-black uppercase tracking-widest">A Metodologia Alívia</div>
                        <h2 className="text-3xl md:text-5xl font-black text-slate-900">O Caminho para a Liberdade Real.</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                        <MethodStep 
                            number="01" 
                            title="Respira" 
                            icon={HeartHandshake}
                            desc="Saia do caos emocional. A IA acolhe sua situação atual e remove a culpa."
                            color="bg-rose-400"
                        />
                        <MethodStep 
                            number="02" 
                            title="Organiza" 
                            icon={RefreshCw}
                            desc="Controle cirúrgico de gastos e cartões. Cada centavo ganha um propósito."
                            color="bg-[#5CCEEA]"
                        />
                        <MethodStep 
                            number="03" 
                            title="Evolui" 
                            icon={TrendingUp}
                            desc="Engenharia de patrimônio ativa. Veja suas reservas crescerem."
                            color="bg-[#69C8B9]"
                        />
                    </div>
                </div>
            </section>

            {/* MODULE 1: GASTOS - COMPACT */}
            <section className="py-24 relative bg-slate-50/30">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#5CCEEA]/10 text-[#5CCEEA] text-[10px] font-black uppercase tracking-widest">
                                Módulo 01 - Controle Total
                            </div>
                            <h2 className="text-3xl md:text-5xl font-black leading-[1.1] text-slate-900">
                                Gestão de <br/><span className="text-[#5CCEEA]">Fluxo Cirúrgico.</span>
                            </h2>
                            <p className="text-slate-500 text-base md:text-lg leading-relaxed font-medium">
                                Domine seu orçamento antes mesmo do dinheiro sair. Decisões claras em uma interface leve.
                            </p>
                            <div className="grid sm:grid-cols-2 gap-6 pt-2">
                                <FeatureMini icon={CreditCard} title="Cartões" desc="Alertas de limite e faturas unificadas." color="text-[#5CCEEA]" />
                                <FeatureMini icon={Layers} title="50/30/20" desc="Divisão automática entre essencial e lazer." color="text-[#5CCEEA]" />
                                <FeatureMini icon={Target} title="Metas" desc="Insights da IA para você nunca mais estourar." color="text-[#5CCEEA]" />
                                <FeatureMini icon={FileText} title="Relatórios" desc="PDFs profissionais com o design Alívia." color="text-[#5CCEEA]" />
                            </div>
                        </div>
                        <div className="relative group">
                            <div className="p-3 bg-white/80 backdrop-blur-md rounded-[2.5rem] shadow-lg border border-slate-100">
                                <img src={gastosImg} alt="Gastos" className="relative rounded-[2rem] shadow-md transition-transform duration-700 group-hover:scale-[1.02]" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* MODULE 2: PATRIMÔNIO - COMPACT */}
            <section className="py-24 relative">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div className="order-2 lg:order-1 relative group">
                            <div className="p-3 bg-white/80 backdrop-blur-md rounded-[2.5rem] shadow-lg border border-slate-100">
                                <img src={patrimonioImg} alt="Patrimônio" className="relative rounded-[2rem] shadow-md transition-transform duration-700 group-hover:scale-[1.02] w-full" />
                            </div>
                        </div>
                        <div className="order-1 lg:order-2 space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#69C8B9]/10 text-[#69C8B9] text-[10px] font-black uppercase tracking-widest">
                                Módulo 02 - Engenharia Patrimonial
                            </div>
                            <h2 className="text-3xl md:text-5xl font-black leading-[1.1] text-slate-900">
                                Construção de <br/><span className="text-[#69C8B9]">Riqueza Ativa.</span>
                            </h2>
                            <p className="text-slate-500 text-base md:text-lg leading-relaxed font-medium">
                                Engenheamos seu crescimento com suavidade. Visualize sua evolução sem pressão.
                            </p>
                            <div className="grid sm:grid-cols-2 gap-6 pt-2">
                                <FeatureMini icon={Landmark} title="CDI Real" desc="Acompanhe suas reservas crescendo." color="text-[#69C8B9]" />
                                <FeatureMini icon={ShieldCheck} title="Segurança" desc="Blindagem matemática da sua paz." color="text-[#69C8B9]" />
                                <FeatureMini icon={Activity} title="Score" desc="O termômetro do seu bem-estar." color="text-[#69C8B9]" />
                                <FeatureMini icon={Compass} title="Guia" desc="A IA sugere o melhor caminho." color="text-[#69C8B9]" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ALÍVIA IA - COMPACT */}
            <section className="py-24 border-y bg-white/40 border-slate-100">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div className="space-y-8">
                            <div className="text-[#69C8B9] text-[10px] font-black uppercase tracking-widest">Inteligência Artificial</div>
                            <h2 className="text-4xl md:text-6xl font-black leading-[1.1] text-slate-900">Sua Mentora <br/>Financeira 24/7.</h2>
                            <p className="text-slate-500 text-lg md:text-xl font-medium">Alívia estuda seus dados para te dar <span className="text-[#69C8B9] font-black">Silêncio na Mente.</span></p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {Object.entries(scenarios).map(([id, s]) => (
                                    <button key={id} onClick={() => setActiveScenario(id)} className={`p-6 rounded-[2rem] border text-left transition-all duration-500 ${activeScenario === id ? 'bg-white border-[#69C8B9] text-slate-800 shadow-xl z-10' : 'bg-white/40 border-slate-50 text-slate-400 hover:border-[#69C8B9]/30'}`}>
                                        <s.icon className={`w-6 h-6 mb-3 ${activeScenario === id ? 'text-[#69C8B9]' : 'text-slate-200'}`} />
                                        <div className="font-black text-sm tracking-tight">{s.title}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="relative">
                            <div className="rounded-[2.5rem] border shadow-2xl bg-white border-slate-100 overflow-hidden">
                                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-[#69C8B9] flex items-center justify-center">
                                            <img src={aliviaFinal} alt="Alívia" className="w-8 h-8 object-contain" />
                                        </div>
                                        <div className="font-black text-sm">ALÍVIA IA</div>
                                    </div>
                                    <div className={`px-4 py-1 rounded-full text-[8px] font-black uppercase tracking-widest text-white ${scenarios[activeScenario].tagColor}`}>
                                        {scenarios[activeScenario].tag}
                                    </div>
                                </div>
                                <div className="p-8 space-y-6 min-h-[350px] flex flex-col justify-end bg-gradient-to-b from-transparent to-[#69C8B9]/5">
                                    <div className="flex justify-end">
                                        <div className="max-w-[80%] p-4 rounded-[1.5rem] rounded-tr-none bg-[#5CCEEA] text-white font-bold text-xs shadow-md">
                                            {scenarios[activeScenario].user}
                                        </div>
                                    </div>
                                    {scenarios[activeScenario].reply.map((msg, i) => (
                                        <div key={i} className="flex gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-[#69C8B9] shrink-0 flex items-center justify-center shadow-sm">
                                                <Bot className="w-4 h-4 text-white" />
                                            </div>
                                            <div className="max-w-[80%] p-4 rounded-[1.5rem] rounded-tl-none font-bold text-xs shadow-sm bg-slate-50 text-slate-700 border border-slate-50">
                                                {msg}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-6 border-t border-slate-50">
                                    <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50/50">
                                        <div className="flex-1 text-slate-300 text-[10px] font-black uppercase tracking-widest italic">Ouvindo você...</div>
                                        <div className="w-8 h-8 rounded-full bg-[#69C8B9] flex items-center justify-center text-white">
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECURITY - COMPACT */}
            <section className="py-24 bg-slate-50/20">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div className="space-y-6">
                            <h2 className="text-3xl md:text-5xl font-black text-slate-900">Privacidade Blindada.</h2>
                            <p className="text-slate-500 text-base md:text-lg font-medium">Usamos criptografia de ponta para que apenas você veja seu futuro.</p>
                            <div className="space-y-4">
                                <SecurityFeature icon={LockKeyhole} title="Criptografia Total" desc="Seus dados viajam seguros por túneis blindados." />
                                <SecurityFeature icon={Fingerprint} title="Identidade Protegida" desc="Não pedimos senhas bancárias. Sua paz é prioridade." />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="aspect-square bg-white rounded-[2.5rem] flex flex-col items-center justify-center text-[#69C8B9] p-6 text-center gap-2 shadow-lg border border-slate-50">
                                <Shield className="w-10 h-10" />
                                <div className="font-black text-xs uppercase tracking-widest">Seguro</div>
                            </div>
                            <div className="aspect-square bg-white rounded-[2.5rem] flex flex-col items-center justify-center text-[#5CCEEA] p-6 text-center gap-2 shadow-lg border border-slate-50 mt-8">
                                <Lock className="w-10 h-10" />
                                <div className="font-black text-xs uppercase tracking-widest">Privado</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* PRICING - COMPACT */}
            <section className="py-24 relative">
                <div className="max-w-5xl mx-auto px-6 text-center">
                    <div className="space-y-6 mb-16">
                        <h2 className="text-3xl md:text-5xl font-black text-slate-900">Planos de Tranquilidade.</h2>
                        <div className="flex items-center justify-center gap-6 pt-6">
                            <span className={`text-sm font-black ${billing === 'monthly' ? 'text-[#69C8B9]' : 'text-slate-400'}`}>Mensal</span>
                            <button onClick={() => setBilling(billing === 'monthly' ? 'annual' : 'monthly')} className="w-16 h-8 bg-slate-100 rounded-full relative p-1 transition-all border border-slate-200">
                                <div className={`w-6 h-6 bg-[#69C8B9] rounded-full transition-all transform ${billing === 'annual' ? 'translate-x-8' : 'translate-x-0'}`}></div>
                            </button>
                            <span className={`text-sm font-black ${billing === 'annual' ? 'text-[#69C8B9]' : 'text-slate-400'}`}>Anual <span className="bg-[#69C8B9] text-white text-[8px] px-3 py-1 rounded-full ml-2">Melhor Valor</span></span>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 text-left max-w-4xl mx-auto">
                        <PricingCard 
                            title="Standard" 
                            price={billing === 'monthly' ? '9,99' : '7,83'}
                            desc="Organize seus gastos mensais."
                            features={["7 Dias Premium Grátis", "Gastos ilimitados", "Cartões de Crédito"]}
                            onLogin={onLogin}
                        />
                        <PricingCard 
                            title="Premium" 
                            price={billing === 'monthly' ? '29,90' : '24,91'}
                            desc="Poder total com IA e Patrimônio."
                            features={["Tudo do Standard", "Módulo Patrimônio", "Consultora IA Alívia"]}
                            onLogin={onLogin}
                            isFeatured
                        />
                    </div>
                </div>
            </section>

            {/* FINAL CTA - COMPACT */}
            <section className="py-24 bg-[#69C8B9] text-white text-center rounded-[3rem] mx-6 mb-16 shadow-2xl relative">
                <div className="max-w-3xl mx-auto px-6 space-y-8">
                    <h2 className="text-3xl md:text-5xl font-black tracking-tight">O futuro está te esperando.</h2>
                    <button onClick={onLogin} className="px-10 py-5 rounded-2xl bg-white text-[#69C8B9] font-black text-xl shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 mx-auto group">
                        Ativar Agora <ArrowRight className="w-6 h-6 transition-transform group-hover:translate-x-1" />
                    </button>
                </div>
            </section>

            {/* FOOTER - COMPACT */}
            <footer className="py-20 border-t bg-white border-slate-50">
                <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
                    <img src={logo} alt="Alívia" className="w-28 mx-auto" />
                    <div className="flex flex-wrap justify-center gap-8 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <button onClick={onViewTerms} className="hover:text-[#69C8B9]">Termos</button>
                        <button onClick={onViewPrivacy} className="hover:text-[#69C8B9]">Privacidade</button>
                        <button onClick={onViewContact} className="hover:text-[#69C8B9]">Contato</button>
                    </div>
                    <div className="text-slate-300 text-[10px] font-bold opacity-70 italic">
                        &copy; {new Date().getFullYear()} Alívia • Peace of Mind Finance
                    </div>
                </div>
            </footer>
        </div>
    );
}

function MethodStep({ number, title, desc, icon: Icon, color }) {
    return (
        <div className="p-8 rounded-[2rem] bg-white/60 border border-slate-50 text-left space-y-4 shadow-md transition-all hover:shadow-lg group">
            <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center text-white shadow-md mb-4 group-hover:rotate-6 transition-transform`}>
                <Icon className="w-6 h-6" />
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#69C8B9]">Passo {number}</div>
            <h3 className="text-xl font-black text-slate-800">{title}</h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">{desc}</p>
        </div>
    );
}

function SecurityFeature({ icon: Icon, title, desc }) {
    return (
        <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#69C8B9]/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[#69C8B9]" />
            </div>
            <div className="space-y-1">
                <h4 className="font-black text-base text-slate-800">{title}</h4>
                <p className="text-xs text-slate-500 font-medium">{desc}</p>
            </div>
        </div>
    );
}

function FeatureMini({ icon: Icon, title, desc, color }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-slate-50">
                    <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <h4 className="font-black text-sm uppercase tracking-wider text-slate-700">{title}</h4>
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{desc}</p>
        </div>
    );
}

function PricingCard({ title, price, desc, features, onLogin, isFeatured }) {
    return (
        <div className={`relative rounded-[2.5rem] p-10 border transition-all duration-500 bg-white ${isFeatured ? 'border-[#69C8B9]/30 shadow-xl' : 'border-slate-50 shadow-md'}`}>
            <div className="space-y-8 flex flex-col h-full">
                <div className="space-y-4">
                    <h2 className="text-3xl font-black text-slate-900">{title}</h2>
                    <p className="text-slate-500 text-sm font-medium">{desc}</p>
                </div>
                <div className="space-y-4 flex-1">
                    {features.map((f, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <CheckCircle2 className="w-4 h-4 text-[#69C8B9]" />
                            <span className="font-bold text-sm text-slate-600">{f}</span>
                        </div>
                    ))}
                </div>
                <div className="pt-6 border-t border-slate-50 text-center space-y-4">
                    <div className="text-5xl font-black text-slate-900 flex items-center justify-center gap-2">
                        <span className="text-xl opacity-30">R$</span>{price}
                    </div>
                    <button onClick={onLogin} className={`w-full py-5 rounded-xl font-black text-base shadow-lg transition-all active:scale-95 ${isFeatured ? 'bg-[#69C8B9] text-white' : 'bg-slate-800 text-white'}`}>Começar Agora</button>
                </div>
            </div>
        </div>
    );
}
