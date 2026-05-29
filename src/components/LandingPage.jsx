import React from 'react';
import ReactDOM from 'react-dom';
import {
    TrendingUp,
    ShieldCheck,
    CheckCircle2,
    XCircle,
    ArrowRight,
    MessageSquare,
    AlertCircle,
    Wallet,
    Target,
    Activity,
    Bot,
    Lock as LockIcon,
    BarChart3,
    FileText,
    CreditCard,
    Landmark,
    Layers,
    Shield,
    LockKeyhole,
    Fingerprint,
    HeartHandshake,
    RefreshCw,
    Bell,
    Flame,
    ChartNoAxesCombined,
    Receipt,
    Sun,
    Moon,
    Gift,
    Sparkles,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import logo from '../assets/logo.png';
import aliviaFinal from '../assets/alivia/alivia-final.png';

import hubImg from '../assets/screenshots/hub.png';
import gastosImg from '../assets/screenshots/gastos.png';
import patrimonioImg from '../assets/screenshots/patrimonio.png';

const TEAL = '#69C8B9';
const CYAN = '#5CCEEA';

export default function LandingPage({ onLogin, onViewPrivacy, onViewTerms, onViewManual, onViewContact }) {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme !== 'light';
    const [billing, setBilling] = React.useState('monthly');
    const [activeScenario, setActiveScenario] = React.useState('panic');

    // ── tokens de tema ──
    const t = {
        pageBg:       isDark ? 'bg-slate-950 text-slate-200' : 'bg-white text-slate-800',
        textH:        isDark ? 'text-white' : 'text-slate-900',
        textBody:     isDark ? 'text-slate-400' : 'text-slate-500',
        card:         isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white border-slate-100',
        cardSoft:     isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white/60 border-slate-50',
        sectionAlt:   isDark ? 'bg-white/[0.02]' : 'bg-slate-50/30',
    };

    const scenarios = {
        panic: {
            title: "Modo Pânico",
            icon: AlertCircle,
            user: "Alívia, surgiu um gasto inesperado e estou desesperada... 😰",
            reply: ["Calma, Ana. Eu analisei suas reservas.", "Sua Margem de Segurança cobre isso. Vamos ajustar o plano?"],
            tag: "Guardião Ativado",
            tagColor: "bg-rose-400"
        },
        invest: {
            title: "Crescimento",
            icon: TrendingUp,
            user: "Alívia! Consegui investir R$ 500 hoje! 🚀",
            reply: ["Incrível! Esse aporte acelerou sua meta de Independência em 2 meses.", "Seu patrimônio cresceu 2.5% hoje. Parabéns!"],
            tag: "Patrimônio ↑",
            tagColor: "bg-[#69C8B9]"
        },
        expense: {
            title: "Decisão Inteligente",
            icon: MessageSquare,
            user: "Posso comprar esse tênis de R$ 350? 👟",
            reply: ["Olhando seu saldo disponível para lazer: Sim!", "A compra está liberada sem comprometer suas metas."],
            tag: "Compra Segura",
            tagColor: "bg-[#5CCEEA]"
        }
    };

    return (
        <React.Fragment>
            <style>{`
                @keyframes pulse-ring {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(105,200,185,0.4); }
                    50% { box-shadow: 0 0 0 10px rgba(105,200,185,0); }
                }
            `}</style>

            {/* Navbar via Portal */}
            {ReactDOM.createPortal(
                <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}
                     className={`${isDark ? 'bg-slate-950/70' : 'bg-white/70'} backdrop-blur-xl border-b ${isDark ? 'border-white/5' : 'border-slate-100/60'}`}>
                    <div className="max-w-7xl mx-auto px-6 h-20 md:h-24 grid grid-cols-3 items-center">
                        <div className="flex items-center">
                            <button
                                onClick={toggleTheme}
                                className={`p-2.5 rounded-full transition-all border ${
                                    isDark
                                        ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-[#69C8B9]'
                                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-[#69C8B9] shadow-sm'
                                }`}
                                title={isDark ? 'Modo claro' : 'Modo escuro'}
                                aria-label="Alternar tema"
                            >
                                {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                            </button>
                        </div>
                        <div className="flex justify-center">
                            <img src={logo} alt="Alívia Logo" className="w-36 md:w-48 h-auto drop-shadow-sm" />
                        </div>
                        <div className="flex items-center justify-end gap-3">
                            <button onClick={onLogin} className={`hidden md:block text-xs font-bold px-4 py-2 rounded-xl transition-colors ${isDark ? 'text-slate-300 hover:text-[#69C8B9]' : 'text-slate-600 hover:text-[#69C8B9]'}`}>Entrar</button>
                            <button onClick={onLogin} className="px-5 py-2 md:px-6 md:py-2.5 rounded-xl bg-[#69C8B9] hover:bg-[#5bb1a3] text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95">Começar Grátis</button>
                        </div>
                    </div>
                </nav>,
                document.body
            )}

            {/* Main wrapper */}
            <div className={`min-h-screen overflow-x-hidden ${t.pageBg}`} style={{
                backgroundImage: isDark
                    ? `radial-gradient(at 0% 0%, rgba(105,200,185,0.10) 0px, transparent 55%), radial-gradient(at 100% 0%, rgba(92,206,234,0.08) 0px, transparent 55%)`
                    : `radial-gradient(at 0% 0%, rgba(105,200,185,0.12) 0px, transparent 60%), radial-gradient(at 100% 0%, rgba(92,206,234,0.12) 0px, transparent 60%)`,
                backgroundAttachment: 'fixed'
            }}>

                {/* HERO */}
                <section className="relative pt-36 pb-16 lg:pt-52 lg:pb-24 text-center overflow-hidden">
                    <div className="max-w-5xl mx-auto px-6 space-y-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#69C8B9]/10 border border-[#69C8B9]/15 text-[#5bb1a3] text-[10px] font-black uppercase tracking-widest">
                            <Sparkles className="w-3 h-3" />
                            <span>A consultora de IA que protege seu futuro</span>
                        </div>
                        <h1 className={`text-4xl md:text-7xl font-black tracking-tight leading-[1.1] ${t.textH}`}>
                            Sua Vida Financeira <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#69C8B9] to-[#5CCEEA]">Elevada ao Máximo.</span>
                        </h1>
                        <p className={`text-base md:text-xl max-w-2xl mx-auto leading-relaxed font-medium ${t.textBody}`}>
                            Alívia une <span className="text-[#5CCEEA] font-bold">Controle de Gastos</span> cirúrgico com <span className="text-[#69C8B9] font-bold">Construção de Patrimônio</span>. Tudo guiado por uma IA que combina com o seu ritmo.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                            <button onClick={onLogin} className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#69C8B9] hover:bg-[#5bb1a3] text-white font-black text-lg shadow-xl shadow-[#69C8B9]/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 group">
                                Começar Grátis <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                            </button>
                        </div>
                        <p className={`text-[11px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Plano Gratuito para sempre · sem cartão de crédito</p>
                    </div>
                </section>

                {/* DASHBOARD PREVIEW */}
                <section className="relative py-24 z-10 px-6">
                    <div className="max-w-5xl mx-auto">
                        <div className={`relative rounded-[2.5rem] p-2 md:p-4 border shadow-xl overflow-hidden ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white/60 border-slate-100'}`}>
                            <div className={`aspect-video rounded-[2rem] relative group overflow-hidden shadow-inner flex items-center justify-center p-2 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                                <img src={hubImg} alt="App Hub" className="w-full h-full object-contain rounded-[1.8rem] transition-transform duration-700 group-hover:scale-[1.01]" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* METHODOLOGY */}
                <section className="py-24 relative overflow-hidden">
                    <div className="max-w-6xl mx-auto px-6 text-center">
                        <div className="space-y-4 mb-16">
                            <div className="text-[#69C8B9] text-[10px] font-black uppercase tracking-widest">A Metodologia Alívia</div>
                            <h2 className={`text-3xl md:text-5xl font-black ${t.textH}`}>O Caminho para a Liberdade Real.</h2>
                        </div>
                        <div className="grid md:grid-cols-3 gap-6">
                            <MethodStep isDark={isDark} number="01" title="Respira" icon={HeartHandshake} desc="Saia do caos emocional. A IA acolhe sua situação atual e remove a culpa." color="bg-rose-400" />
                            <MethodStep isDark={isDark} number="02" title="Organiza" icon={RefreshCw} desc="Controle cirúrgico de gastos e cartões. Cada centavo ganha um propósito." color="bg-[#5CCEEA]" />
                            <MethodStep isDark={isDark} number="03" title="Evolui" icon={TrendingUp} desc="Construção de patrimônio ativa. Veja suas reservas crescerem." color="bg-[#69C8B9]" />
                        </div>
                    </div>
                </section>

                {/* MODULE 1: GASTOS */}
                <section className={`py-24 relative ${t.sectionAlt}`}>
                    <div className="max-w-6xl mx-auto px-6">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div className="space-y-8">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#5CCEEA]/10 text-[#5CCEEA] text-[10px] font-black uppercase tracking-widest">
                                    Módulo 01 — Controle de Gastos
                                </div>
                                <h2 className={`text-3xl md:text-5xl font-black leading-[1.1] ${t.textH}`}>
                                    Cada centavo com <br /><span className="text-[#5CCEEA]">destino certo.</span>
                                </h2>
                                <p className={`text-base md:text-lg leading-relaxed font-medium ${t.textBody}`}>
                                    Pare de adivinhar onde o dinheiro foi. A Alívia organiza, categoriza e alerta — antes do problema acontecer.
                                </p>
                                <div className="space-y-4">
                                    <FeatureRow isDark={isDark} icon={CreditCard} title="Gestão de Cartões" desc="Acompanhe a fatura de todos os seus cartões em um só lugar, com parcelamentos e assinaturas organizados." color="text-[#5CCEEA]" />
                                    <FeatureRow isDark={isDark} icon={Layers} title="Regra 50/30/20" desc="Distribuição inteligente da renda: essenciais, desejos e investimentos — visualizada automaticamente." color="text-[#5CCEEA]" />
                                    <FeatureRow isDark={isDark} icon={Bell} title="Alertas de Estouro" desc="Aviso em tempo real quando uma categoria ultrapassa o orçamento definido por você." color="text-[#5CCEEA]" />
                                    <FeatureRow isDark={isDark} icon={FileText} title="Relatórios em PDF" desc="Exportação com design Alívia — perfeito para revisão mensal ou consulta com seu contador." color="text-[#5CCEEA]" />
                                </div>
                            </div>
                            <div className="relative group">
                                <div className={`p-3 backdrop-blur-md rounded-[2.5rem] shadow-lg border ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white/80 border-slate-100'}`}>
                                    <img src={gastosImg} alt="Gastos" className="relative rounded-[2rem] shadow-md transition-transform duration-700 group-hover:scale-[1.02]" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* MODULE 2: PATRIMÔNIO */}
                <section className="py-24 relative">
                    <div className="max-w-6xl mx-auto px-6">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div className="order-2 lg:order-1 relative group">
                                <div className={`p-3 backdrop-blur-md rounded-[2.5rem] shadow-lg border ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white/80 border-slate-100'}`}>
                                    <img src={patrimonioImg} alt="Patrimônio" className="relative rounded-[2rem] shadow-md transition-transform duration-700 group-hover:scale-[1.02] w-full" />
                                </div>
                            </div>
                            <div className="order-1 lg:order-2 space-y-8">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#69C8B9]/10 text-[#69C8B9] text-[10px] font-black uppercase tracking-widest">
                                    Módulo 02 — Construção de Patrimônio
                                </div>
                                <h2 className={`text-3xl md:text-5xl font-black leading-[1.1] ${t.textH}`}>
                                    Seu patrimônio <br /><span className="text-[#69C8B9]">crescendo visível.</span>
                                </h2>
                                <p className={`text-base md:text-lg leading-relaxed font-medium ${t.textBody}`}>
                                    Não basta guardar dinheiro. Você precisa ver ele trabalhar para você. O módulo de patrimônio transforma números em evolução real.
                                </p>
                                <div className="space-y-4">
                                    <FeatureRow isDark={isDark} icon={TrendingUp} title="Evolução Patrimonial" desc="Gráficos da sua curva de crescimento mês a mês, comparados com CDI, IBOVESPA e S&P 500." color="text-[#69C8B9]" />
                                    <FeatureRow isDark={isDark} icon={Activity} title="Score de Saúde Financeira" desc="Um número que resume tudo: reserva, controle de gastos, investimentos e metas. Suba seu score." color="text-[#69C8B9]" />
                                    <FeatureRow isDark={isDark} icon={ShieldCheck} title="Reserva de Emergência" desc="Cálculo automático de quanto guardar para estar protegido por 3, 6 ou 12 meses." color="text-[#69C8B9]" />
                                    <FeatureRow isDark={isDark} icon={Landmark} title="Rendimento CDI em Tempo Real" desc="Acompanhe reservas e renda fixa rendendo pelo CDI. Saiba exatamente quanto cada real trabalha." color="text-[#69C8B9]" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* WHY PREMIUM */}
                <section className={`py-24 relative overflow-hidden ${isDark ? 'bg-white/[0.02]' : 'bg-gradient-to-b from-slate-50/60 to-white'}`}>
                    <div className="max-w-6xl mx-auto px-6">
                        <div className="text-center space-y-4 mb-16">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/15 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                                <Flame className="w-3 h-3" /> Por que o Premium vale cada centavo
                            </div>
                            <h2 className={`text-3xl md:text-5xl font-black ${t.textH}`}>
                                A diferença entre{' '}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#69C8B9] to-[#5CCEEA]">sobreviver</span>
                                {' '}e{' '}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5CCEEA] to-[#69C8B9]">prosperar.</span>
                            </h2>
                            <p className={`text-base md:text-lg font-medium max-w-2xl mx-auto ${t.textBody}`}>
                                Enquanto o Gratuito te tira do caos, o Premium te coloca em movimento. Veja o que muda na prática:
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                            <WhyPremiumCard
                                isDark={isDark}
                                accentColor="#5CCEEA"
                                icon={Receipt}
                                tag="Controle de Gastos"
                                title="Nunca mais estoure o orçamento"
                                subtitle="Com o Premium, seu controle financeiro vai além do básico — ele é proativo."
                                items={[
                                    { icon: Layers, text: 'Regra 50/30/20 visualizada automaticamente com base na sua renda real' },
                                    { icon: Bell, text: 'Alerta quando qualquer categoria se aproxima do limite definido' },
                                    { icon: CreditCard, text: 'Visão unificada de todas as faturas — nunca pague juros por esquecimento' },
                                    { icon: BarChart3, text: 'Análise de tendências: veja quais categorias crescem mês a mês' },
                                    { icon: FileText, text: 'Relatório PDF mensal profissional das suas finanças' },
                                ]}
                            />
                            <WhyPremiumCard
                                isDark={isDark}
                                accentColor="#69C8B9"
                                icon={ChartNoAxesCombined}
                                tag="Construção de Patrimônio"
                                title="Veja seu dinheiro crescer de verdade"
                                subtitle="O módulo de patrimônio transforma esforço em evolução visível e mensurável."
                                items={[
                                    { icon: TrendingUp, text: 'Evolução patrimonial mês a mês comparada a CDI, IBOVESPA e S&P 500' },
                                    { icon: Activity, text: 'Score de saúde financeira que resume reserva, gastos e metas' },
                                    { icon: ShieldCheck, text: 'Reserva de emergência calculada automaticamente' },
                                    { icon: Landmark, text: 'Rendimento CDI em tempo real — cada real trabalhando por você' },
                                    { icon: Bot, text: 'Consultora IA Alívia 24/7 analisando seus dados e te orientando' },
                                ]}
                            />
                        </div>

                        <div className={`mt-12 text-center p-8 rounded-[2rem] border ${isDark ? 'bg-gradient-to-r from-[#69C8B9]/10 via-transparent to-[#5CCEEA]/10 border-white/10' : 'bg-gradient-to-r from-[#69C8B9]/10 via-white to-[#5CCEEA]/10 border-slate-100'}`}>
                            <p className={`text-xl md:text-2xl font-black leading-relaxed ${t.textH}`}>
                                "O Premium não é um gasto.<br />
                                <span className="text-[#69C8B9]">É o investimento que organiza todos os outros."</span>
                            </p>
                        </div>
                    </div>
                </section>

                {/* ALÍVIA IA */}
                <section className={`py-24 border-y ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-white/40 border-slate-100'}`}>
                    <div className="max-w-6xl mx-auto px-6">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div className="space-y-8">
                                <div className="text-[#69C8B9] text-[10px] font-black uppercase tracking-widest">Inteligência Artificial</div>
                                <h2 className={`text-4xl md:text-6xl font-black leading-[1.1] ${t.textH}`}>Sua Mentora <br />Financeira 24/7.</h2>
                                <p className={`text-lg md:text-xl font-medium ${t.textBody}`}>Alívia estuda seus dados para te dar <span className="text-[#69C8B9] font-black">Silêncio na Mente.</span></p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {Object.entries(scenarios).map(([id, s]) => (
                                        <button key={id} onClick={() => setActiveScenario(id)} className={`p-6 rounded-[2rem] border text-left transition-all duration-500 ${
                                            activeScenario === id
                                                ? (isDark ? 'bg-slate-900 border-[#69C8B9] text-white shadow-xl' : 'bg-white border-[#69C8B9] text-slate-800 shadow-xl')
                                                : (isDark ? 'bg-white/[0.02] border-white/5 text-slate-500 hover:border-[#69C8B9]/30' : 'bg-white/40 border-slate-50 text-slate-400 hover:border-[#69C8B9]/30')
                                        }`}>
                                            <s.icon className={`w-6 h-6 mb-3 ${activeScenario === id ? 'text-[#69C8B9]' : (isDark ? 'text-slate-600' : 'text-slate-200')}`} />
                                            <div className="font-black text-sm tracking-tight">{s.title}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="relative">
                                <div className={`rounded-[2.5rem] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
                                    <div className={`p-6 border-b flex items-center justify-between ${isDark ? 'border-white/5 bg-white/[0.02]' : 'border-slate-50 bg-slate-50/20'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-[#69C8B9] flex items-center justify-center">
                                                <img src={aliviaFinal} alt="Alívia" className="w-8 h-8 object-contain" />
                                            </div>
                                            <div className={`font-black text-sm ${t.textH}`}>ALÍVIA IA</div>
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
                                                <div className={`max-w-[80%] p-4 rounded-[1.5rem] rounded-tl-none font-bold text-xs shadow-sm border ${isDark ? 'bg-white/5 text-slate-200 border-white/5' : 'bg-slate-50 text-slate-700 border-slate-50'}`}>
                                                    {msg}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className={`p-6 border-t ${isDark ? 'border-white/5' : 'border-slate-50'}`}>
                                        <div className={`flex items-center gap-4 p-3 rounded-2xl ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/50'}`}>
                                            <div className="flex-1 text-slate-400 text-[10px] font-black uppercase tracking-widest italic">Ouvindo você...</div>
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

                {/* SECURITY */}
                <section className={`py-24 ${isDark ? 'bg-white/[0.01]' : 'bg-slate-50/20'}`}>
                    <div className="max-w-6xl mx-auto px-6">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div className="space-y-6">
                                <h2 className={`text-3xl md:text-5xl font-black ${t.textH}`}>Privacidade em Primeiro Lugar.</h2>
                                <p className={`text-base md:text-lg font-medium ${t.textBody}`}>Conexões protegidas e dados sob seu controle, em conformidade com a LGPD.</p>
                                <div className="space-y-4">
                                    <SecurityFeature isDark={isDark} icon={LockKeyhole} title="Conexão Segura (TLS)" desc="Seus dados viajam criptografados e ficam protegidos no Google Cloud." />
                                    <SecurityFeature isDark={isDark} icon={Fingerprint} title="Sem Dados Bancários" desc="Não pedimos senha de banco. Você insere o que quiser, no seu controle." />
                                    <SecurityFeature isDark={isDark} icon={Shield} title="Conformidade LGPD" desc="Exporte ou exclua seus dados a qualquer momento, direto no app." />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className={`aspect-square rounded-[2.5rem] flex flex-col items-center justify-center text-[#69C8B9] p-6 text-center gap-2 shadow-lg border ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-50'}`}>
                                    <Shield className="w-10 h-10" />
                                    <div className="font-black text-xs uppercase tracking-widest">Seguro</div>
                                </div>
                                <div className={`aspect-square rounded-[2.5rem] flex flex-col items-center justify-center text-[#5CCEEA] p-6 text-center gap-2 shadow-lg border mt-8 ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-50'}`}>
                                    <LockIcon className="w-10 h-10" />
                                    <div className="font-black text-xs uppercase tracking-widest">Privado</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* PRICING */}
                <section className="py-24 relative">
                    <div className="max-w-6xl mx-auto px-6 text-center">
                        <div className="space-y-6 mb-16">
                            <h2 className={`text-3xl md:text-5xl font-black ${t.textH}`}>Planos de Tranquilidade.</h2>
                            <p className={`text-base font-medium ${t.textBody}`}>Comece grátis, sem cartão de crédito. Faça upgrade quando quiser.</p>
                            <div className="flex items-center justify-center gap-6 pt-4">
                                <span className={`text-sm font-black ${billing === 'monthly' ? 'text-[#69C8B9]' : 'text-slate-400'}`}>Mensal</span>
                                <button onClick={() => setBilling(billing === 'monthly' ? 'annual' : 'monthly')} className={`w-16 h-8 rounded-full relative p-1 transition-all border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                                    <div className={`w-6 h-6 bg-[#69C8B9] rounded-full transition-all transform ${billing === 'annual' ? 'translate-x-8' : 'translate-x-0'}`}></div>
                                </button>
                                <span className={`text-sm font-black ${billing === 'annual' ? 'text-[#69C8B9]' : 'text-slate-400'}`}>
                                    Anual <span className="bg-[#69C8B9] text-white text-[8px] px-3 py-1 rounded-full ml-2">-20%</span>
                                </span>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-6 text-left max-w-6xl mx-auto items-stretch">

                            {/* GRATUITO */}
                            <PlanCard
                                isDark={isDark}
                                name="Gratuito"
                                subtitle="Para sair do caos e organizar o essencial."
                                price="R$ 0"
                                priceSuffix=""
                                note="Para sempre · sem cartão"
                                onClick={onLogin}
                                ctaLabel="Começar Grátis"
                                ctaStyle={isDark ? 'bg-white/5 text-white border border-white/10 hover:bg-white/10' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}
                                included={[
                                    'Controle de Gastos',
                                    'Até 1 cartão cadastrado',
                                    'Até 10 lançamentos de despesa',
                                    '2 recebimentos e 2 contas fixas',
                                    'Sincronização na nuvem',
                                ]}
                                excluded={[
                                    'Cartões e lançamentos ilimitados',
                                    'Módulo de Patrimônio',
                                    'Consultora IA Alívia',
                                ]}
                            />

                            {/* STANDARD */}
                            <PlanCard
                                isDark={isDark}
                                name="Standard"
                                subtitle="Controle de gastos completo, sem limites."
                                price={`R$ ${billing === 'monthly' ? '9,90' : '7,90'}`}
                                priceSuffix="/mês"
                                note={billing === 'annual' ? 'Cobrado anualmente' : 'Cobrança mensal'}
                                onClick={onLogin}
                                ctaLabel="Assinar Standard"
                                ctaStyle="bg-slate-800 text-white hover:bg-slate-700"
                                includedTitle="Tudo do Gratuito, sem limites:"
                                included={[
                                    'Lançamentos ilimitados',
                                    'Cartões e parcelamentos ilimitados',
                                    'Contas fixas e assinaturas ilimitadas',
                                    'Relatórios em PDF',
                                    'Acesso Web e Mobile',
                                ]}
                                excluded={[
                                    'Módulo de Patrimônio',
                                    'Consultora IA Alívia',
                                    'Score de saúde financeira',
                                ]}
                            />

                            {/* PREMIUM */}
                            <PlanCard
                                isDark={isDark}
                                featured
                                name="Premium"
                                subtitle="Controle de gastos + construção de patrimônio."
                                price={`R$ ${billing === 'monthly' ? '19,90' : '15,90'}`}
                                priceSuffix="/mês"
                                note={billing === 'annual' ? 'Cobrado anualmente' : 'Cobrança mensal'}
                                onClick={onLogin}
                                ctaLabel="Ativar Premium"
                                ctaStyle="bg-gradient-to-r from-[#69C8B9] to-[#5CCEEA] text-white shadow-xl shadow-[#69C8B9]/20 hover:scale-[1.02]"
                                includedTitle="Tudo do Standard, mais:"
                                included={[
                                    'Módulo Patrimônio completo',
                                    'Consultora IA Alívia 24/7',
                                    'Score de saúde financeira',
                                    'Evolução patrimonial (CDI, IBOV, S&P)',
                                    'Reserva de emergência calculada',
                                    'Metas com projeção temporal',
                                    'Modo Pânico e alertas avançados',
                                ]}
                            />
                        </div>

                        <div className={`mt-10 flex flex-wrap justify-center gap-8 text-sm font-medium ${t.textBody}`}>
                            <span className="flex items-center gap-2"><Gift className="w-4 h-4 text-[#69C8B9]" /> Plano gratuito para sempre</span>
                            <span className="flex items-center gap-2"><LockKeyhole className="w-4 h-4 text-[#69C8B9]" /> Cancele quando quiser</span>
                            <span className="flex items-center gap-2"><Fingerprint className="w-4 h-4 text-[#69C8B9]" /> Sem dados bancários</span>
                        </div>
                    </div>
                </section>

                {/* FINAL CTA */}
                <section className="py-24 bg-[#69C8B9] text-white text-center rounded-[3rem] mx-6 mb-16 shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 0%, transparent 60%), radial-gradient(circle at 70% 50%, white 0%, transparent 60%)' }} />
                    <div className="max-w-3xl mx-auto px-6 space-y-8 relative z-10">
                        <h2 className="text-3xl md:text-5xl font-black tracking-tight">O futuro está te esperando.</h2>
                        <p className="text-white/80 text-lg font-medium">Comece hoje com o Plano Gratuito. Sem cartão, sem risco.</p>
                        <button onClick={onLogin} className="px-10 py-5 rounded-2xl bg-white text-[#69C8B9] font-black text-xl shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 mx-auto group">
                            Começar Grátis <ArrowRight className="w-6 h-6 transition-transform group-hover:translate-x-1" />
                        </button>
                    </div>
                </section>

                {/* FOOTER */}
                <footer className={`py-20 border-t ${isDark ? 'bg-slate-950 border-white/5' : 'bg-white border-slate-50'}`}>
                    <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
                        <img src={logo} alt="Alívia" className="w-28 mx-auto" />
                        <div className="flex flex-wrap justify-center gap-8 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <button onClick={onViewTerms} className="hover:text-[#69C8B9]">Termos</button>
                            <button onClick={onViewPrivacy} className="hover:text-[#69C8B9]">Privacidade</button>
                            <button onClick={onViewContact} className="hover:text-[#69C8B9]">Contato</button>
                        </div>
                        <div className="text-slate-400 text-[10px] font-bold opacity-70 italic">
                            &copy; {new Date().getFullYear()} Alívia • Peace of Mind Finance
                        </div>
                    </div>
                </footer>
            </div>
        </React.Fragment>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MethodStep({ number, title, desc, icon: Icon, color, isDark }) {
    return (
        <div className={`p-8 rounded-[2rem] border text-left space-y-4 shadow-md transition-all hover:shadow-lg group ${isDark ? 'bg-white/[0.03] border-white/5' : 'bg-white/60 border-slate-50'}`}>
            <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center text-white shadow-md mb-4 group-hover:rotate-6 transition-transform`}>
                <Icon className="w-6 h-6" />
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#69C8B9]">Passo {number}</div>
            <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{title}</h3>
            <p className={`text-sm font-medium leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{desc}</p>
        </div>
    );
}

function SecurityFeature({ icon: Icon, title, desc, isDark }) {
    return (
        <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#69C8B9]/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[#69C8B9]" />
            </div>
            <div className="space-y-1">
                <h4 className={`font-black text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>{title}</h4>
                <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{desc}</p>
            </div>
        </div>
    );
}

function FeatureRow({ icon: Icon, title, desc, color, isDark }) {
    return (
        <div className={`flex gap-4 p-4 rounded-2xl border transition-all group ${isDark ? 'bg-white/[0.03] border-white/5 hover:border-white/10' : 'bg-white/60 border-slate-50 hover:border-slate-100 hover:shadow-sm'}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="space-y-0.5">
                <h4 className={`font-black text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>{title}</h4>
                <p className={`text-xs font-medium leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{desc}</p>
            </div>
        </div>
    );
}

function WhyPremiumCard({ accentColor, icon: Icon, tag, title, subtitle, items, isDark }) {
    return (
        <div className="rounded-[2rem] p-8 border space-y-6" style={{
            borderColor: accentColor + (isDark ? '22' : '33'),
            backgroundColor: accentColor + (isDark ? '0c' : '11'),
        }}>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest shadow-sm ${isDark ? 'bg-slate-900' : 'bg-white'}`} style={{ color: accentColor }}>
                <Icon className="w-3 h-3" /> {tag}
            </div>
            <div className="space-y-2">
                <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
                <p className={`text-sm font-medium leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</p>
            </div>
            <div className="space-y-3">
                {items.map((item, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border shadow-sm ${isDark ? 'bg-white/[0.03] border-white/5' : 'bg-white/80 border-white'}`}>
                        <item.icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: accentColor }} />
                        <p className={`text-sm font-medium leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{item.text}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PlanCard({ isDark, featured, name, subtitle, price, priceSuffix, note, included, includedTitle, excluded, onClick, ctaLabel, ctaStyle }) {
    return (
        <div className={`relative rounded-[2.5rem] p-8 flex flex-col overflow-hidden ${
            featured
                ? `border-2 border-[#69C8B9]/40 shadow-2xl shadow-[#69C8B9]/10 ${isDark ? 'bg-slate-900' : 'bg-white'}`
                : `border ${isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white border-slate-100 shadow-md'}`
        }`}>
            {featured && (
                <>
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#69C8B9] to-[#5CCEEA]" />
                    <div className="absolute top-6 right-6 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#69C8B9] to-[#5CCEEA] text-white text-[9px] font-black uppercase tracking-widest shadow-md"
                        style={{ animation: 'pulse-ring 2.5s ease-in-out infinite' }}>
                        <Flame className="w-3 h-3" /> Mais Popular
                    </div>
                </>
            )}

            <div className="space-y-3 mb-8">
                <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{name}</h3>
                <p className={`text-sm font-medium min-h-[40px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</p>
                <div className="flex items-end gap-1 pt-2">
                    <span className={`text-5xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{price}</span>
                    {priceSuffix && <span className="text-slate-400 text-sm font-medium mb-1">{priceSuffix}</span>}
                </div>
                <p className="text-[11px] text-[#69C8B9] font-bold">{note}</p>
            </div>

            <div className="space-y-3 flex-1 mb-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">{includedTitle || 'O que está incluso:'}</p>
                {included.map((f, i) => (
                    <div key={i} className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-[#69C8B9] shrink-0 mt-0.5" />
                        <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{f}</span>
                    </div>
                ))}
                {excluded && excluded.length > 0 && (
                    <div className={`border-t pt-3 mt-3 space-y-3 ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Não incluso:</p>
                        {excluded.map((f, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <XCircle className={`w-4 h-4 shrink-0 mt-0.5 ${isDark ? 'text-slate-700' : 'text-slate-200'}`} />
                                <span className={`text-sm font-medium line-through ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>{f}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <button onClick={onClick} className={`w-full py-4 rounded-xl font-black text-base transition-all active:scale-95 ${ctaStyle}`}>
                {ctaLabel}
            </button>
        </div>
    );
}
