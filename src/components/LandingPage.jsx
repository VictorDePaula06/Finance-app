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
    Zap,
    Facebook,
    Instagram,
    Youtube,
    Brain,
    AlertTriangle,
    Clock,
    Users,
    Star,
    TrendingDown,
    PiggyBank,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import logo from '../assets/logo.png';
import aliviaFinal    from '../assets/alivia/alivia-final.png';
import aliviaAssist   from '../assets/alivia/alivia-assistant.png';
import aliviaClean    from '../assets/alivia/alivia-clean.png';
import aliviaGoal     from '../assets/alivia/alivia-goal.png';
import aliviaGrowth   from '../assets/alivia/alivia-growth.png';
import aliviaPlanning from '../assets/alivia/alivia-planning.png';

import hubImg from '../assets/screenshots/hub.png';
import gastosImg from '../assets/screenshots/gastos.png';
import patrimonioImg from '../assets/screenshots/patrimonio.png';
import gastosMobile from '../assets/screenshots/gastos-mobile.png';
import patrimonioMobile from '../assets/screenshots/patrimonio-mobile.png';

const TEAL = '#69C8B9';
const CYAN = '#5CCEEA';

export default function LandingPage({ onLogin, onViewPrivacy, onViewTerms, onViewManual, onViewContact }) {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme !== 'light';
    const [billing, setBilling] = React.useState('monthly');
    const [activeScenario, setActiveScenario] = React.useState('panic');

    const t = {
        pageBg:     isDark ? 'bg-slate-950 text-slate-200' : 'bg-white text-slate-800',
        textH:      isDark ? 'text-white' : 'text-slate-900',
        textBody:   isDark ? 'text-slate-400' : 'text-slate-500',
        card:       isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white border-slate-100',
        cardSoft:   isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white/60 border-slate-50',
        sectionAlt: isDark ? 'bg-white/[0.02]' : 'bg-slate-50/30',
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
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-12px); }
                }
                @keyframes glow-pulse {
                    0%, 100% { opacity: 0.5; }
                    50% { opacity: 1; }
                }
                .alivia-float { animation: float 4s ease-in-out infinite; }
                .glow-teal { box-shadow: 0 0 40px rgba(105,200,185,0.3), 0 0 80px rgba(105,200,185,0.1); }
                .glow-cyan { box-shadow: 0 0 40px rgba(92,206,234,0.3), 0 0 80px rgba(92,206,234,0.1); }
            `}</style>

            {/* Navbar — via Portal pro document.body: garante fixo no viewport mesmo
                com ancestrais transformados (perspective dos mockups quebra position:fixed) */}
            {ReactDOM.createPortal(
                <nav style={{
                    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
                    backgroundColor: isDark ? 'rgba(2,6,23,0.45)' : 'rgba(255,255,255,0.55)',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                    borderBottom: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(226,232,240,0.5)',
                }}>
                    <div className="max-w-7xl mx-auto px-6 h-24 md:h-28 grid grid-cols-3 items-center">
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
                            <img src={logo} alt="Alívia Logo" className="h-20 md:h-24 w-auto drop-shadow-sm" />
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
            }}>

                {/* ── HERO ── */}
                <section className="relative pt-36 pb-8 lg:pt-48 lg:pb-0 overflow-hidden">
                    {/* background glow blobs */}
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-20"
                         style={{ background: 'radial-gradient(circle, #69C8B9 0%, transparent 70%)' }} />
                    <div className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-15"
                         style={{ background: 'radial-gradient(circle, #5CCEEA 0%, transparent 70%)' }} />

                    <div className="max-w-7xl mx-auto px-6">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            {/* Left: text */}
                            <div className="space-y-8 text-center lg:text-left">
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#69C8B9]/10 border border-[#69C8B9]/20 text-[#5bb1a3] text-[10px] font-black uppercase tracking-widest">
                                    <Sparkles className="w-3 h-3" />
                                    <span>A consultora de IA que protege seu futuro</span>
                                </div>
                                <h1 className={`text-4xl md:text-6xl xl:text-7xl font-black tracking-tight leading-[1.05] ${t.textH}`}>
                                    Sua Vida<br />Financeira<br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#69C8B9] to-[#5CCEEA]">
                                        Elevada ao Máximo.
                                    </span>
                                </h1>
                                <p className={`text-base md:text-xl leading-relaxed font-medium max-w-xl ${t.textBody}`}>
                                    Alívia une <span className="text-[#5CCEEA] font-bold">Controle de Gastos</span> cirúrgico com <span className="text-[#69C8B9] font-bold">Construção de Patrimônio</span>. Tudo guiado por uma IA que combina com o seu ritmo.
                                </p>
                                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                                    <button onClick={onLogin} className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[#69C8B9] to-[#5CCEEA] hover:opacity-90 text-white font-black text-lg shadow-xl shadow-[#69C8B9]/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 group">
                                        Começar Grátis <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                                    </button>
                                    <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-base border transition-all hover:scale-105 active:scale-95 ${isDark ? 'border-white/10 text-slate-300 hover:border-[#69C8B9]/40 hover:text-[#69C8B9]' : 'border-slate-200 text-slate-700 hover:border-[#69C8B9]/50 hover:text-[#69C8B9]'}`}>
                                        Ver Planos
                                    </button>
                                </div>
                                <p className={`text-[11px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Plano Gratuito para sempre · sem cartão de crédito
                                </p>
                            </div>

                            {/* Right: Alivia em destaque com badges flutuantes */}
                            <div className="relative flex items-center justify-center lg:justify-end">
                                <div className="relative">
                                    {/* glow atrás da Alivia */}
                                    <div className="absolute inset-0 rounded-full blur-3xl opacity-25 pointer-events-none"
                                         style={{ background: 'radial-gradient(circle, #69C8B9 0%, transparent 70%)', transform: 'scale(0.95)' }} />
                                    <img
                                        src={aliviaFinal}
                                        alt="Alívia — sua consultora financeira"
                                        className="alivia-float relative z-10 w-full max-w-[440px] lg:max-w-[500px] drop-shadow-2xl mx-auto rounded-[2.5rem]"
                                    />

                                    {/* floating badges */}
                                    <div className={`absolute top-12 right-0 md:-right-6 z-20 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl border text-sm font-black whitespace-nowrap ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-100 text-slate-800'}`}>
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                                        Patrimônio +12%
                                    </div>
                                    <div className={`absolute bottom-28 right-0 md:-right-8 z-20 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl border text-sm font-black whitespace-nowrap ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-100 text-slate-800'}`}>
                                        <Shield className="w-4 h-4 text-[#69C8B9]" />
                                        Reserva OK
                                    </div>
                                    <div className="absolute bottom-16 left-0 md:-left-6 z-20 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl bg-gradient-to-r from-[#69C8B9] to-[#5CCEEA] text-white text-sm font-black whitespace-nowrap">
                                        <Zap className="w-4 h-4" />
                                        IA ativa 24/7
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── STATS BAR ── */}
                <section className="py-16 px-6">
                    <div className="max-w-5xl mx-auto">
                        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 p-6 md:p-8 rounded-[2rem] border ${isDark ? 'bg-white/[0.03] border-white/8' : 'bg-white/80 border-slate-100 shadow-lg'}`}>
                            {[
                                { value: '100%', label: 'Privacidade', sub: 'Zero dados bancários', icon: ShieldCheck, color: '#69C8B9' },
                                { value: '3 em 1', label: 'Módulos', sub: 'Gastos · Patrimônio · IA', icon: Layers, color: '#5CCEEA' },
                                { value: '24/7', label: 'IA Alívia', sub: 'Sempre disponível', icon: Brain, color: '#69C8B9' },
                                { value: 'R$0', label: 'Para começar', sub: 'Plano gratuito real', icon: Gift, color: '#5CCEEA' },
                            ].map((s, i) => (
                                <div key={i} className="flex flex-col items-center text-center gap-1 py-2">
                                    <s.icon className="w-6 h-6 mb-1" style={{ color: s.color }} />
                                    <div className={`text-2xl md:text-3xl font-black ${t.textH}`}>{s.value}</div>
                                    <div className={`text-xs font-black uppercase tracking-widest`} style={{ color: s.color }}>{s.label}</div>
                                    <div className={`text-[11px] font-medium ${t.textBody}`}>{s.sub}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── COMO FUNCIONA ── */}
                <section className="relative py-20 px-6">
                    <div className="max-w-5xl mx-auto">
                        <div className="text-center mb-10">
                            <p className={`text-[10px] font-black uppercase tracking-widest text-[#69C8B9] mb-2`}>Simples de usar</p>
                            <h2 className={`text-2xl md:text-4xl font-black ${t.textH}`}>Em 3 passos, sua vida financeira muda.</h2>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                            {[
                                { step: '01', icon: Wallet, color: '#5CCEEA', title: 'Registre seus gastos', desc: 'Lance pelo chat com a Alívia ou manualmente. Categorização automática.' },
                                { step: '02', icon: Brain, color: '#69C8B9', title: 'A Alívia analisa', desc: 'IA monitora padrões, compara com suas metas e avisa antes dos limites.' },
                                { step: '03', icon: TrendingUp, color: '#69C8B9', title: 'Veja crescer', desc: 'Patrimônio, reservas e metas evoluindo visíveis no painel em tempo real.' },
                            ].map((item, i) => (
                                <div key={i} className={`relative p-8 rounded-[2rem] border flex flex-col gap-4 group hover:shadow-lg transition-all ${isDark ? 'bg-white/[0.03] border-white/8 hover:border-white/15' : 'bg-white border-slate-100 shadow-sm hover:shadow-md'}`}>
                                    {i < 2 && (
                                        <div className="hidden md:block absolute top-1/2 -right-3 z-10 text-slate-600">
                                            <ArrowRight className="w-5 h-5" />
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: item.color + '22' }}>
                                            <item.icon className="w-5 h-5" style={{ color: item.color }} />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: item.color }}>Passo {item.step}</span>
                                    </div>
                                    <h3 className={`font-black text-lg ${t.textH}`}>{item.title}</h3>
                                    <p className={`text-sm font-medium leading-relaxed ${t.textBody}`}>{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── METHODOLOGY ── */}
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

                {/* ── SENSOR DE URGÊNCIA ── */}
                <section className={`py-24 relative overflow-hidden ${isDark ? 'bg-white/[0.02]' : 'bg-gradient-to-br from-rose-50/40 via-white to-[#69C8B9]/5'}`}>
                    {/* decorative blob */}
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
                         style={{ background: isDark ? 'radial-gradient(circle, rgba(239,68,68,0.06) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)' }} />

                    <div className="max-w-6xl mx-auto px-6">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">

                            {/* Alivia assistant illustration */}
                            <div className="relative flex justify-center order-2 lg:order-1">
                                <div className="relative">
                                    <div className="absolute inset-0 rounded-full blur-3xl opacity-20 pointer-events-none"
                                         style={{ background: 'radial-gradient(circle, #ef4444 0%, transparent 70%)', transform: 'scale(0.7)' }} />
                                    <img
                                        src={aliviaAssist}
                                        alt="Alívia no modo alerta"
                                        className="alivia-float relative z-10 w-64 md:w-80 drop-shadow-2xl"
                                    />
                                    {/* alert bubble */}
                                    <div className={`absolute top-8 -right-4 md:-right-12 z-20 max-w-[180px] p-4 rounded-2xl shadow-xl border text-xs font-bold leading-relaxed ${isDark ? 'bg-slate-900 border-rose-500/30 text-slate-200' : 'bg-white border-rose-100 text-slate-700'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                                            <span className="font-black text-rose-400 text-[10px] uppercase tracking-widest">Alerta</span>
                                        </div>
                                        Você atingiu 85% do seu teto de gastos com lazer este mês.
                                    </div>
                                    <div className={`absolute bottom-16 -left-4 md:-left-10 z-20 max-w-[160px] p-4 rounded-2xl shadow-xl border text-xs font-bold leading-relaxed ${isDark ? 'bg-slate-900 border-[#69C8B9]/30 text-slate-200' : 'bg-white border-[#69C8B9]/20 text-slate-700'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle2 className="w-4 h-4 text-[#69C8B9] shrink-0" />
                                            <span className="font-black text-[#69C8B9] text-[10px] uppercase tracking-widest">Protegida</span>
                                        </div>
                                        Reserva de emergência: 6 meses cobertos.
                                    </div>
                                </div>
                            </div>

                            {/* Text content */}
                            <div className="space-y-8 order-1 lg:order-2">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase tracking-widest border border-rose-500/20">
                                    <Zap className="w-3 h-3" /> Recurso Exclusivo — Sensor de Urgência
                                </div>
                                <h2 className={`text-3xl md:text-5xl font-black leading-[1.1] ${t.textH}`}>
                                    Por que ter um<br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-[#69C8B9]">
                                        Guardião Financeiro?
                                    </span>
                                </h2>
                                <p className={`text-base md:text-lg leading-relaxed font-medium ${t.textBody}`}>
                                    A maioria das pessoas só percebe o problema quando já está no vermelho. O <span className={`font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Sensor de Urgência</span> da Alívia monitora sua saúde financeira em tempo real e age <span className="text-rose-400 font-bold">antes</span> do problema virar crise.
                                </p>

                                <div className="space-y-4">
                                    <SensorFeature isDark={isDark}
                                        icon={Bell}
                                        iconColor="text-amber-400"
                                        bgColor={isDark ? 'bg-amber-400/10' : 'bg-amber-50'}
                                        title="Alerta antes do limite"
                                        desc="Quando você se aproxima do teto de qualquer categoria de gasto, a Alívia te avisa antes — não depois que já passou." />
                                    <SensorFeature isDark={isDark}
                                        icon={TrendingDown}
                                        iconColor="text-rose-400"
                                        bgColor={isDark ? 'bg-rose-400/10' : 'bg-rose-50'}
                                        title="Modo Pânico ativado"
                                        desc="Gasto inesperado chegou? A Alívia analisa sua reserva de emergência e te diz exatamente se você pode cobrir — e como ajustar o plano." />
                                    <SensorFeature isDark={isDark}
                                        icon={PiggyBank}
                                        iconColor="text-[#69C8B9]"
                                        bgColor={isDark ? 'bg-[#69C8B9]/10' : 'bg-[#69C8B9]/10'}
                                        title="Reserva sempre monitorada"
                                        desc="Sua reserva de emergência é acompanhada continuamente. A IA calcula quantos meses você está coberto e o que falta para atingir 6 meses ideais." />
                                    <SensorFeature isDark={isDark}
                                        icon={Clock}
                                        iconColor="text-[#5CCEEA]"
                                        bgColor={isDark ? 'bg-[#5CCEEA]/10' : 'bg-[#5CCEEA]/10'}
                                        title="24/7 — nunca descansa"
                                        desc="Enquanto você vive sua vida, a Alívia fica de olho. É como ter uma CFO pessoal trabalhando em silêncio, o tempo todo." />
                                </div>

                                <div className={`p-5 rounded-2xl border-l-4 border-rose-400 ${isDark ? 'bg-white/[0.03]' : 'bg-white/80'} shadow-sm`}>
                                    <p className={`text-sm font-bold leading-relaxed italic ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                        "Não existe controle financeiro real sem um sistema de proteção ativo. O Sensor de Urgência existe para que o dinheiro nunca te surpreenda negativamente."
                                    </p>
                                    <p className="text-[#69C8B9] text-[10px] font-black uppercase tracking-widest mt-2">— Alívia IA</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── MODULE 1: GASTOS ── */}
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
                                    <FeatureRow isDark={isDark} icon={Layers} title="Essenciais vs. Supérfluos" desc="A Alívia separa o que é essencial do que é desejo e mostra se você passou do ideal de 30% em gastos supérfluos." color="text-[#5CCEEA]" />
                                    <FeatureRow isDark={isDark} icon={Bell} title="Metas de Gasto por Categoria" desc="Defina um teto para cada categoria e receba o aviso quando estiver se aproximando ou ultrapassando o limite." color="text-[#5CCEEA]" />
                                    <FeatureRow isDark={isDark} icon={Bot} title="IA Alívia nos seus gastos" desc="Lance despesas por texto e peça análises pelo chat. No Gratuito são 4 lançamentos/mês; no Standard e Premium, sem limite." color="text-[#5CCEEA]" />
                                    <FeatureRow isDark={isDark} icon={FileText} title="Relatórios em PDF" desc="Exportação com o design Alívia — perfeito para a revisão mensal ou consulta com seu contador." color="text-[#5CCEEA]" />
                                </div>
                            </div>
                            <div className="relative flex justify-center">
                                <div className="absolute inset-0 blur-3xl opacity-25 pointer-events-none rounded-full"
                                     style={{ background: 'radial-gradient(circle, #5CCEEA 0%, transparent 70%)' }} />
                                <PhoneMockup isDark={isDark} width={320} tilt="right">
                                    <img src={gastosMobile} alt="Controle de Gastos" />
                                </PhoneMockup>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── MODULE 2: PATRIMÔNIO ── */}
                <section className="py-24 pb-32 relative">
                    <div className="max-w-6xl mx-auto px-6">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div className="order-2 lg:order-1 relative flex justify-center">
                                <div className="absolute inset-0 blur-3xl opacity-25 pointer-events-none rounded-full"
                                     style={{ background: 'radial-gradient(circle, #69C8B9 0%, transparent 70%)' }} />
                                <PhoneMockup isDark={isDark} width={320} tilt="left">
                                    <img src={patrimonioMobile} alt="Patrimônio" />
                                </PhoneMockup>
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
                                    <FeatureRow isDark={isDark} icon={ShieldCheck} title="Reserva de Emergência" desc="Cálculo automático de quanto guardar para estar protegido por 3, 6 ou 12 meses. Disponível já no Gratuito." color="text-[#69C8B9]" />
                                    <FeatureRow isDark={isDark} icon={Activity} title="Saúde Patrimonial" desc="Um score que resume reservas, investimentos, bens e proteção — e te diz exatamente o próximo passo." color="text-[#69C8B9]" />
                                    <FeatureRow isDark={isDark} icon={ChartNoAxesCombined} title="Evolução e Benchmarks" desc="No Premium: acompanhe a curva do seu patrimônio mês a mês comparada com CDI, IBOVESPA e S&P 500." color="text-[#69C8B9]" />
                                    <FeatureRow isDark={isDark} icon={Target} title="Independência e Metas" desc="No Premium: descubra seu número da independência financeira, simule cenários e acompanhe metas com projeção no tempo." color="text-[#69C8B9]" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── WHY PREMIUM ── */}
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
                                O Gratuito te tira do caos. O Standard libera o controle de gastos sem freios. O Premium coloca seu patrimônio para crescer.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                            <WhyPremiumCard isDark={isDark} accentColor="#5CCEEA" icon={Receipt} tag="Standard desbloqueia" title="Controle de gastos sem limites"
                                subtitle="Tudo do Gratuito, agora sem travas — e com a IA Alívia trabalhando ao seu lado nos gastos."
                                items={[
                                    { icon: Layers, text: 'Lançamentos, cartões, contas fixas e recebimentos ilimitados' },
                                    { icon: Bot, text: 'IA Alívia ilimitada para lançar e analisar seus gastos' },
                                    { icon: Bell, text: 'Metas de gasto por categoria com alerta ao se aproximar do teto' },
                                    { icon: BarChart3, text: 'Essenciais vs. supérfluos sempre à vista, com o ideal de 30%' },
                                    { icon: FileText, text: 'Relatório PDF mensal profissional das suas finanças' },
                                ]}
                            />
                            <WhyPremiumCard isDark={isDark} accentColor="#69C8B9" icon={ChartNoAxesCombined} tag="Premium desbloqueia" title="Patrimônio que cresce visível"
                                subtitle="Tudo do Standard, mais o módulo de patrimônio completo e a IA cuidando dos seus investimentos."
                                items={[
                                    { icon: Activity, text: 'Fluxo patrimonial e seu número da independência financeira' },
                                    { icon: TrendingUp, text: 'Evolução mês a mês comparada a CDI, IBOVESPA e S&P 500' },
                                    { icon: Target, text: 'Metas de patrimônio com projeção no tempo e simulações' },
                                    { icon: Landmark, text: 'Reservas, investimentos e bens sem limite de cadastro' },
                                    { icon: Bot, text: 'IA Alívia ilimitada também analisando o seu patrimônio' },
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

                {/* ── ALÍVIA IA ── */}
                <section className={`py-24 border-y ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-white/40 border-slate-100'}`}>
                    <div className="max-w-6xl mx-auto px-6">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div className="space-y-8">
                                <div className="text-[#69C8B9] text-[10px] font-black uppercase tracking-widest">Inteligência Artificial</div>
                                <h2 className={`text-4xl md:text-6xl font-black leading-[1.1] ${t.textH}`}>Sua Mentora <br />Financeira 24/7.</h2>
                                <p className={`text-lg md:text-xl font-medium ${t.textBody}`}>Alívia estuda seus dados para te dar <span className="text-[#69C8B9] font-black">Silêncio na Mente.</span></p>
                                <div className={`flex flex-col gap-2 p-4 rounded-2xl border text-sm font-medium ${isDark ? 'bg-white/[0.03] border-white/10 text-slate-300' : 'bg-white/70 border-slate-100 text-slate-600'}`}>
                                    <div className="flex items-start gap-2.5"><Gift className="w-4 h-4 text-[#69C8B9] shrink-0 mt-0.5" /><span><span className="font-black">Gratuito:</span> chat com a Alívia com 4 lançamentos por mês.</span></div>
                                    <div className="flex items-start gap-2.5"><MessageSquare className="w-4 h-4 text-[#5CCEEA] shrink-0 mt-0.5" /><span><span className="font-black">Standard:</span> IA ilimitada para o seu Controle de Gastos.</span></div>
                                    <div className="flex items-start gap-2.5"><Sparkles className="w-4 h-4 text-[#69C8B9] shrink-0 mt-0.5" /><span><span className="font-black">Premium:</span> IA ilimitada nos gastos <span className="italic">e</span> no seu patrimônio.</span></div>
                                </div>
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
                                            <div className="w-10 h-10 rounded-xl bg-[#69C8B9] flex items-center justify-center overflow-hidden">
                                                <img src={aliviaFinal} alt="Alívia" className="w-8 h-8 object-contain" />
                                            </div>
                                            <div className={`font-black text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>ALÍVIA IA</div>
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
                                                <div className="w-8 h-8 rounded-lg bg-[#69C8B9] shrink-0 flex items-center justify-center shadow-sm overflow-hidden">
                                                    <img src={aliviaFinal} alt="Alívia" className="w-6 h-6 object-contain" />
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

                {/* ── SECURITY ── */}
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

                {/* ── PRICING ── */}
                <section className="py-24 relative" id="pricing">
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
                                    'Controle de gastos (com limites)',
                                    'Patrimônio essencial: reservas, investimentos e bens (com limites)',
                                    'Saúde Financeira e Patrimonial',
                                    'Seguros e proteção',
                                    'Chat com a Alívia: 4 lançamentos por mês',
                                    'Sincronização na nuvem',
                                ]}
                                excluded={[
                                    'Uso sem limites',
                                    'IA Alívia ilimitada',
                                    'Planejamento avançado de patrimônio',
                                ]}
                            />
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
                                    'Lançamentos, cartões e contas fixas ilimitados',
                                    'Recebimentos e assinaturas ilimitados',
                                    'IA Alívia ilimitada no Controle de Gastos',
                                    'Sensor de Urgência ativo',
                                    'Relatórios em PDF',
                                    'Acesso Web e Mobile',
                                ]}
                                excluded={[
                                    'Planejamento avançado de patrimônio',
                                    'Evolução e benchmarks (CDI, IBOV, S&P)',
                                    'IA Alívia sobre o seu patrimônio',
                                ]}
                            />
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
                                    'Patrimônio completo, sem limites',
                                    'Fluxo patrimonial e independência financeira',
                                    'Evolução patrimonial (CDI, IBOV, S&P)',
                                    'Metas de patrimônio com projeção no tempo',
                                    'IA Alívia ilimitada também no patrimônio',
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

                {/* ── FINAL CTA ── */}
                <section className="py-24 relative overflow-hidden mx-6 mb-16">
                    <div className={`rounded-[3rem] relative overflow-hidden shadow-2xl ${isDark ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'}`}>
                        {/* glow */}
                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #69C8B9 0%, transparent 60%), radial-gradient(circle at 70% 50%, #5CCEEA 0%, transparent 60%)' }} />

                        <div className="relative z-10 grid lg:grid-cols-2 items-center gap-0">
                            {/* Left text */}
                            <div className="p-12 md:p-16 space-y-8 text-center lg:text-left">
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#69C8B9]/20 border border-[#69C8B9]/30 text-[#69C8B9] text-[10px] font-black uppercase tracking-widest">
                                    <Sparkles className="w-3 h-3" /> Comece hoje, grátis
                                </div>
                                <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-[1.1]">
                                    O futuro está<br />te esperando.
                                </h2>
                                <p className="text-white/70 text-lg font-medium">Comece hoje com o Plano Gratuito. Sem cartão, sem risco. Faça upgrade quando quiser — os preços já estão esperando por você.</p>
                                <button onClick={onLogin} className="px-10 py-5 rounded-2xl bg-gradient-to-r from-[#69C8B9] to-[#5CCEEA] text-white font-black text-xl shadow-xl shadow-[#69C8B9]/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-3 mx-auto lg:mx-0 group">
                                    Começar Grátis <ArrowRight className="w-6 h-6 transition-transform group-hover:translate-x-1" />
                                </button>
                            </div>
                            {/* Right: Alivia */}
                            <div className="hidden lg:flex items-end justify-center pt-8">
                                <img src={aliviaFinal} alt="Alívia" className="w-72 xl:w-80 drop-shadow-2xl alivia-float" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── FOOTER ── */}
                <footer className={`py-20 border-t ${isDark ? 'bg-slate-950 border-white/5' : 'bg-white border-slate-50'}`}>
                    <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
                        <img src={logo} alt="Alívia" className="w-28 mx-auto" />
                        {/* Redes sociais */}
                        <div className="flex justify-center gap-4">
                            <SocialLink isDark={isDark} href="https://facebook.com" label="Facebook"><Facebook className="w-5 h-5" /></SocialLink>
                            <SocialLink isDark={isDark} href="https://instagram.com" label="Instagram"><Instagram className="w-5 h-5" /></SocialLink>
                            <SocialLink isDark={isDark} href="https://tiktok.com" label="TikTok"><TikTokIcon className="w-5 h-5" /></SocialLink>
                            <SocialLink isDark={isDark} href="https://youtube.com" label="YouTube"><Youtube className="w-5 h-5" /></SocialLink>
                        </div>

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

// ─── Sub-components ───────────────────────────────────────────────────────────

// ── Redes sociais ─────────────────────────────────────────────────────────────
function SocialLink({ isDark, href, label, children }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            title={label}
            className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all hover:scale-110 hover:text-white ${
                isDark
                    ? 'bg-white/[0.04] border-white/10 text-slate-400 hover:bg-[#69C8B9] hover:border-[#69C8B9]'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-[#69C8B9] hover:border-[#69C8B9]'
            }`}
        >
            {children}
        </a>
    );
}

function TikTokIcon({ className }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16.6 5.82s.51.5 0 0A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.52 2.52 0 0 1-2.59-2.5 2.52 2.52 0 0 1 2.59-2.5c.27 0 .53.04.78.11V9.4a6.84 6.84 0 0 0-.78-.05A5.66 5.66 0 0 0 4.2 15a5.66 5.66 0 0 0 5.66 5.65A5.66 5.66 0 0 0 15.5 15V8.65a7.3 7.3 0 0 0 4.33 1.42V6.97a4.28 4.28 0 0 1-3.23-1.15z"/>
        </svg>
    );
}

// ── Phone Mockup (grande, inclinado 3D — estilo app showcase) ─────────────────
function PhoneMockup({ isDark, width = 300, tilt = 'left', children }) {
    const frame = isDark ? '#0b1120' : '#0f172a';
    const rotateY = tilt === 'left' ? '14deg' : '-14deg';
    return (
        <div style={{ perspective: '1600px' }} className="mx-auto">
            <div style={{
                width,
                background: frame,
                borderRadius: 48,
                padding: 12,
                boxShadow: '0 50px 90px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.07), inset 0 0 0 1px rgba(255,255,255,0.04)',
                position: 'relative',
                transform: `rotateY(${rotateY}) rotateX(3deg)`,
                transformStyle: 'preserve-3d',
            }}>
                {/* tela com aspecto retrato (iPhone ~ 9:19.5) */}
                <div style={{
                    position: 'relative',
                    borderRadius: 38,
                    overflow: 'hidden',
                    background: '#fff',
                    aspectRatio: '9 / 19.5',
                }}>
                    {/* a imagem preenche a tela inteira (cover, alinhada no topo) */}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
                        {React.cloneElement(children, {
                            style: { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block' },
                        })}
                    </div>
                    {/* dynamic island */}
                    <div style={{
                        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                        width: 90, height: 24, background: '#000', borderRadius: 14, zIndex: 2,
                    }} />
                </div>
            </div>
        </div>
    );
}

// ── Browser Mockup (paisagem — para screenshots desktop) ──────────────────────
function BrowserMockup({ isDark, children }) {
    const frame = isDark ? '#0f172a' : '#1e293b';
    return (
        <div className="relative w-full" style={{
            background: frame,
            borderRadius: 20,
            padding: 10,
            boxShadow: '0 30px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
        }}>
            {/* barra de título com os 3 pontos */}
            <div className="flex items-center gap-2 px-2 pb-2.5">
                <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#ef4444' }} />
                <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#f59e0b' }} />
                <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#22c55e' }} />
                <div className="flex-1 mx-2" style={{ height: 16, borderRadius: 8, background: 'rgba(255,255,255,0.08)' }} />
            </div>
            {/* tela */}
            <div style={{ borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                {children}
            </div>
        </div>
    );
}

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

function SensorFeature({ icon: Icon, iconColor, bgColor, title, desc, isDark }) {
    return (
        <div className={`flex gap-4 p-4 rounded-2xl border transition-all group ${isDark ? 'bg-white/[0.03] border-white/5 hover:border-white/10' : 'bg-white/80 border-slate-50 hover:border-slate-100 hover:shadow-sm'}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${bgColor}`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div className="space-y-0.5">
                <h4 className={`font-black text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>{title}</h4>
                <p className={`text-xs font-medium leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{desc}</p>
            </div>
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
