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
    Compass,
    Star,
    Users,
    Bell,
    CalendarCheck,
    Flame,
    ChartNoAxesCombined,
    Receipt,
} from 'lucide-react';
import logo from '../assets/logo.png';
import aliviaFinal from '../assets/alivia/alivia-final.png';

import hubImg from '../assets/screenshots/hub.png';
import gastosImg from '../assets/screenshots/gastos.png';
import patrimonioImg from '../assets/screenshots/patrimonio.png';

export default function LandingPage({ onLogin, onViewPrivacy, onViewTerms, onViewManual, onViewContact }) {
    const [billing, setBilling] = React.useState('monthly');
    const [activeScenario, setActiveScenario] = React.useState('panic');

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

            {/* Navbar via Portal — renderiza direto no body, garante position:fixed */}
            {ReactDOM.createPortal(
                <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
                    <div className="max-w-7xl mx-auto px-6 h-20 md:h-24 grid grid-cols-3 items-center">
                        <div></div>
                        <div className="flex justify-center">
                            <img src={logo} alt="Alívia Logo" className="w-36 md:w-48 h-auto drop-shadow-sm" />
                        </div>
                        <div className="flex items-center justify-end gap-3">
                            <button onClick={onLogin} className="hidden md:block text-xs font-bold px-4 py-2 rounded-xl text-slate-600 hover:text-[#69C8B9] transition-colors">Entrar</button>
                            <button onClick={onLogin} className="px-5 py-2 md:px-6 md:py-2.5 rounded-xl bg-[#69C8B9] hover:bg-[#5bb1a3] text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95">Assinar Agora</button>
                        </div>
                    </div>
                </nav>,
                document.body
            )}

            {/* Main wrapper — overflow-x-hidden aqui não quebra o fixed do nav acima */}
            <div className="min-h-screen overflow-x-hidden bg-white text-slate-800" style={{
                backgroundImage: `radial-gradient(at 0% 0%, rgba(105,200,185,0.12) 0px, transparent 60%), radial-gradient(at 100% 0%, rgba(92,206,234,0.12) 0px, transparent 60%)`,
                backgroundAttachment: 'fixed'
            }}>

                {/* HERO */}
                <section className="relative pt-36 pb-16 lg:pt-52 lg:pb-24 text-center overflow-hidden">
                    <div className="max-w-5xl mx-auto px-6 space-y-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#69C8B9]/10 border border-[#69C8B9]/10 text-[#5bb1a3] text-[10px] font-black uppercase tracking-widest">
                            <span>A única consultora IA que protege seu futuro</span>
                        </div>
                        <h1 className="text-4xl md:text-7xl font-black tracking-tight leading-[1.1] text-slate-900">
                            Sua Vida Financeira <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#69C8B9] to-[#5CCEEA]">Elevada ao Máximo.</span>
                        </h1>
                        <p className="text-base md:text-xl max-w-2xl mx-auto leading-relaxed font-medium text-slate-500">
                            Alívia une <span className="text-[#5CCEEA] font-bold">Gestão de Gastos</span> cirúrgica com <span className="text-[#69C8B9] font-bold">Engenharia de Patrimônio</span>. Tudo guiado por uma IA que combina com seu ritmo.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                            <button onClick={onLogin} className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#69C8B9] hover:bg-[#5bb1a3] text-white font-black text-lg shadow-xl shadow-[#69C8B9]/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 group">
                                Começar Grátis <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium">7 dias Premium grátis · sem cartão de crédito</p>
                    </div>
                </section>

                {/* DASHBOARD PREVIEW */}
                <section className="relative py-24 z-10 px-6">
                    <div className="max-w-5xl mx-auto">
                        <div className="relative rounded-[2.5rem] p-2 md:p-4 border shadow-xl bg-white/60 border-slate-100 overflow-hidden">
                            <div className="aspect-video bg-white rounded-[2rem] relative group overflow-hidden shadow-inner flex items-center justify-center p-2">
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
                            <h2 className="text-3xl md:text-5xl font-black text-slate-900">O Caminho para a Liberdade Real.</h2>
                        </div>
                        <div className="grid md:grid-cols-3 gap-6">
                            <MethodStep number="01" title="Respira" icon={HeartHandshake} desc="Saia do caos emocional. A IA acolhe sua situação atual e remove a culpa." color="bg-rose-400" />
                            <MethodStep number="02" title="Organiza" icon={RefreshCw} desc="Controle cirúrgico de gastos e cartões. Cada centavo ganha um propósito." color="bg-[#5CCEEA]" />
                            <MethodStep number="03" title="Evolui" icon={TrendingUp} desc="Engenharia de patrimônio ativa. Veja suas reservas crescerem." color="bg-[#69C8B9]" />
                        </div>
                    </div>
                </section>

                {/* MODULE 1: GASTOS */}
                <section className="py-24 relative bg-slate-50/30">
                    <div className="max-w-6xl mx-auto px-6">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div className="space-y-8">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#5CCEEA]/10 text-[#5CCEEA] text-[10px] font-black uppercase tracking-widest">
                                    Módulo 01 — Controle Total de Gastos
                                </div>
                                <h2 className="text-3xl md:text-5xl font-black leading-[1.1] text-slate-900">
                                    Cada centavo com <br /><span className="text-[#5CCEEA]">destino certo.</span>
                                </h2>
                                <p className="text-slate-500 text-base md:text-lg leading-relaxed font-medium">
                                    Pare de adivinhar onde o dinheiro foi. A Alívia organiza, categoriza e alerta — antes do problema acontecer.
                                </p>
                                <div className="space-y-4">
                                    <FeatureRow icon={CreditCard} title="Gestão de Cartões" desc="Acompanhe a fatura de todos os seus cartões em um só lugar. Alerta automático quando está chegando no limite." color="text-[#5CCEEA]" />
                                    <FeatureRow icon={Layers} title="Regra 50/30/20 Automática" desc="Distribuição inteligente da sua renda: essenciais, lazer e investimentos — calculada automaticamente todo mês." color="text-[#5CCEEA]" />
                                    <FeatureRow icon={Bell} title="Alertas de Estouro" desc="Notificação em tempo real quando alguma categoria ultrapassar o orçamento definido por você." color="text-[#5CCEEA]" />
                                    <FeatureRow icon={FileText} title="Relatórios Profissionais" desc="Exportação em PDF com design Alívia — perfeito para revisão mensal ou consulta com seu contador." color="text-[#5CCEEA]" />
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

                {/* MODULE 2: PATRIMÔNIO */}
                <section className="py-24 relative">
                    <div className="max-w-6xl mx-auto px-6">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div className="order-2 lg:order-1 relative group">
                                <div className="p-3 bg-white/80 backdrop-blur-md rounded-[2.5rem] shadow-lg border border-slate-100">
                                    <img src={patrimonioImg} alt="Patrimônio" className="relative rounded-[2rem] shadow-md transition-transform duration-700 group-hover:scale-[1.02] w-full" />
                                </div>
                            </div>
                            <div className="order-1 lg:order-2 space-y-8">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#69C8B9]/10 text-[#69C8B9] text-[10px] font-black uppercase tracking-widest">
                                    Módulo 02 — Engenharia Patrimonial
                                </div>
                                <h2 className="text-3xl md:text-5xl font-black leading-[1.1] text-slate-900">
                                    Seu patrimônio <br /><span className="text-[#69C8B9]">crescendo visível.</span>
                                </h2>
                                <p className="text-slate-500 text-base md:text-lg leading-relaxed font-medium">
                                    Não basta guardar dinheiro. Você precisa ver ele trabalhar para você. O módulo de patrimônio transforma números em evolução real.
                                </p>
                                <div className="space-y-4">
                                    <FeatureRow icon={TrendingUp} title="Evolução Patrimonial no Tempo" desc="Gráficos que mostram sua curva de crescimento mês a mês — com projeção do futuro baseada no seu ritmo atual." color="text-[#69C8B9]" />
                                    <FeatureRow icon={Activity} title="Score de Saúde Financeira" desc="Um número que resume tudo: reserva, controle de gastos, investimentos e metas. Suba seu score e sinta a diferença." color="text-[#69C8B9]" />
                                    <FeatureRow icon={ShieldCheck} title="Reserva de Emergência" desc="Cálculo automático de quanto você precisa guardar para estar protegido por 3, 6 ou 12 meses." color="text-[#69C8B9]" />
                                    <FeatureRow icon={Landmark} title="Rastreamento CDI e Renda Fixa" desc="Acompanhe seus investimentos crescendo pelo CDI em tempo real. Saiba exatamente quanto cada reserva rende." color="text-[#69C8B9]" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* WHY PREMIUM */}
                <section className="py-24 bg-gradient-to-b from-slate-50/60 to-white relative overflow-hidden">
                    <div className="max-w-6xl mx-auto px-6">
                        <div className="text-center space-y-4 mb-16">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-100 text-amber-600 text-[10px] font-black uppercase tracking-widest">
                                <Flame className="w-3 h-3" /> Por que o Premium vale cada centavo
                            </div>
                            <h2 className="text-3xl md:text-5xl font-black text-slate-900">
                                A diferença entre{' '}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#69C8B9] to-[#5CCEEA]">sobreviver</span>
                                {' '}e{' '}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5CCEEA] to-[#69C8B9]">prosperar.</span>
                            </h2>
                            <p className="text-slate-500 text-base md:text-lg font-medium max-w-2xl mx-auto">
                                Enquanto o Standard te mantém no controle, o Premium te coloca em movimento. Veja o que muda na prática:
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                            <WhyPremiumCard
                                accentColor="#5CCEEA"
                                icon={Receipt}
                                tag="Controle de Gastos"
                                title="Nunca mais estoure o orçamento"
                                subtitle="Com o Premium, seu controle financeiro vai além do básico — ele é proativo."
                                items={[
                                    { icon: Layers, text: 'Regra 50/30/20 calculada automaticamente todo mês com base na sua renda real' },
                                    { icon: Bell, text: 'Alerta instantâneo quando qualquer categoria se aproxima do limite definido' },
                                    { icon: CreditCard, text: 'Visão unificada de todas as faturas de cartão — nunca pague juros por esquecimento' },
                                    { icon: BarChart3, text: 'Análise de tendências: veja quais categorias crescem mês a mês e aja antes' },
                                    { icon: FileText, text: 'Relatório PDF mensal profissional para revisão completa das suas finanças' },
                                ]}
                            />
                            <WhyPremiumCard
                                accentColor="#69C8B9"
                                icon={ChartNoAxesCombined}
                                tag="Controle de Patrimônio"
                                title="Veja seu dinheiro crescer de verdade"
                                subtitle="O módulo de patrimônio transforma esforço em evolução visível e mensurável."
                                items={[
                                    { icon: TrendingUp, text: 'Gráfico de evolução patrimonial mês a mês com projeção baseada no seu ritmo atual' },
                                    { icon: Activity, text: 'Score de saúde financeira que resume reserva, gastos e metas em um único número' },
                                    { icon: ShieldCheck, text: 'Reserva de emergência calculada automaticamente: saiba exatamente quanto você precisa' },
                                    { icon: Landmark, text: 'Rendimento CDI em tempo real — veja cada real da reserva trabalhando por você' },
                                    { icon: Target, text: 'Metas com projeção de data: "Com esse ritmo, você chega lá em Março/2027"' },
                                ]}
                            />
                        </div>

                        <div className="mt-12 text-center p-8 rounded-[2rem] bg-gradient-to-r from-[#69C8B9]/10 via-white to-[#5CCEEA]/10 border border-slate-100">
                            <p className="text-xl md:text-2xl font-black text-slate-800 leading-relaxed">
                                "O Premium não é um gasto.<br />
                                <span className="text-[#69C8B9]">É o investimento que organiza todos os outros."</span>
                            </p>
                        </div>
                    </div>
                </section>

                {/* ALÍVIA IA */}
                <section className="py-24 border-y bg-white/40 border-slate-100">
                    <div className="max-w-6xl mx-auto px-6">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div className="space-y-8">
                                <div className="text-[#69C8B9] text-[10px] font-black uppercase tracking-widest">Inteligência Artificial</div>
                                <h2 className="text-4xl md:text-6xl font-black leading-[1.1] text-slate-900">Sua Mentora <br />Financeira 24/7.</h2>
                                <p className="text-slate-500 text-lg md:text-xl font-medium">Alívia estuda seus dados para te dar <span className="text-[#69C8B9] font-black">Silêncio na Mente.</span></p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {Object.entries(scenarios).map(([id, s]) => (
                                        <button key={id} onClick={() => setActiveScenario(id)} className={`p-6 rounded-[2rem] border text-left transition-all duration-500 ${activeScenario === id ? 'bg-white border-[#69C8B9] text-slate-800 shadow-xl' : 'bg-white/40 border-slate-50 text-slate-400 hover:border-[#69C8B9]/30'}`}>
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

                {/* SECURITY */}
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
                                    <LockIcon className="w-10 h-10" />
                                    <div className="font-black text-xs uppercase tracking-widest">Privado</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* PRICING */}
                <section className="py-24 relative">
                    <div className="max-w-5xl mx-auto px-6 text-center">
                        <div className="space-y-6 mb-16">
                            <h2 className="text-3xl md:text-5xl font-black text-slate-900">Planos de Tranquilidade.</h2>
                            <p className="text-slate-500 text-base font-medium">Comece grátis por 7 dias. Sem cartão de crédito.</p>
                            <div className="flex items-center justify-center gap-6 pt-4">
                                <span className={`text-sm font-black ${billing === 'monthly' ? 'text-[#69C8B9]' : 'text-slate-400'}`}>Mensal</span>
                                <button onClick={() => setBilling(billing === 'monthly' ? 'annual' : 'monthly')} className="w-16 h-8 bg-slate-100 rounded-full relative p-1 transition-all border border-slate-200">
                                    <div className={`w-6 h-6 bg-[#69C8B9] rounded-full transition-all transform ${billing === 'annual' ? 'translate-x-8' : 'translate-x-0'}`}></div>
                                </button>
                                <span className={`text-sm font-black ${billing === 'annual' ? 'text-[#69C8B9]' : 'text-slate-400'}`}>
                                    Anual <span className="bg-[#69C8B9] text-white text-[8px] px-3 py-1 rounded-full ml-2">Melhor Valor</span>
                                </span>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8 text-left max-w-4xl mx-auto">
                            {/* Standard */}
                            <div className="relative rounded-[2.5rem] p-10 border border-slate-100 shadow-md bg-white flex flex-col">
                                <div className="space-y-3 mb-8">
                                    <h3 className="text-2xl font-black text-slate-900">Standard</h3>
                                    <p className="text-slate-400 text-sm font-medium">Para quem quer organizar os gastos e sair do caos.</p>
                                    <div className="flex items-end gap-1 pt-2">
                                        <span className="text-slate-300 text-lg font-black">R$</span>
                                        <span className="text-5xl font-black text-slate-900">{billing === 'monthly' ? '9,99' : '7,83'}</span>
                                        <span className="text-slate-400 text-sm font-medium mb-1">/mês</span>
                                    </div>
                                    {billing === 'annual' && <p className="text-[11px] text-[#69C8B9] font-bold">Cobrado anualmente</p>}
                                </div>
                                <div className="space-y-3 flex-1 mb-8">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">O que está incluso:</p>
                                    {[
                                        '7 dias Premium grátis',
                                        'Lançamento de gastos ilimitados',
                                        'Gestão de cartões de crédito',
                                        'Categorias de despesas',
                                        'Histórico mensal completo',
                                    ].map((f, i) => (
                                        <div key={i} className="flex items-start gap-3">
                                            <CheckCircle2 className="w-4 h-4 text-[#69C8B9] shrink-0 mt-0.5" />
                                            <span className="text-sm font-medium text-slate-600">{f}</span>
                                        </div>
                                    ))}
                                    <div className="border-t border-slate-100 pt-3 mt-3 space-y-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Não incluso:</p>
                                        {[
                                            'Módulo Patrimônio e Investimentos',
                                            'Score de saúde financeira',
                                            'Consultora IA Alívia',
                                            'Reserva de emergência calculada',
                                            'Metas com projeção temporal',
                                        ].map((f, i) => (
                                            <div key={i} className="flex items-start gap-3">
                                                <XCircle className="w-4 h-4 text-slate-200 shrink-0 mt-0.5" />
                                                <span className="text-sm font-medium text-slate-300 line-through">{f}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={onLogin} className="w-full py-4 rounded-xl font-black text-base bg-slate-800 text-white shadow-lg transition-all hover:bg-slate-700 active:scale-95">
                                    Começar Agora
                                </button>
                            </div>

                            {/* Premium */}
                            <div className="relative rounded-[2.5rem] p-10 border-2 border-[#69C8B9]/40 shadow-2xl shadow-[#69C8B9]/10 bg-white flex flex-col overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#69C8B9] to-[#5CCEEA]" />
                                <div className="absolute top-6 right-6 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#69C8B9] to-[#5CCEEA] text-white text-[9px] font-black uppercase tracking-widest shadow-md"
                                    style={{ animation: 'pulse-ring 2.5s ease-in-out infinite' }}>
                                    <Flame className="w-3 h-3" /> Mais Popular
                                </div>
                                <div className="space-y-3 mb-8">
                                    <h3 className="text-2xl font-black text-slate-900">Premium</h3>
                                    <p className="text-slate-500 text-sm font-medium">Para quem quer controlar gastos <strong>e</strong> construir patrimônio.</p>
                                    <div className="flex items-end gap-1 pt-2">
                                        <span className="text-slate-300 text-lg font-black">R$</span>
                                        <span className="text-5xl font-black text-slate-900">{billing === 'monthly' ? '29,90' : '24,91'}</span>
                                        <span className="text-slate-400 text-sm font-medium mb-1">/mês</span>
                                    </div>
                                    {billing === 'annual' && <p className="text-[11px] text-[#69C8B9] font-bold">Cobrado anualmente</p>}
                                </div>
                                <div className="space-y-3 flex-1 mb-8">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Tudo do Standard, mais:</p>
                                    {[
                                        'Regra 50/30/20 automática',
                                        'Alertas de estouro de orçamento',
                                        'Módulo Patrimônio completo',
                                        'Score de saúde financeira',
                                        'Reserva de emergência calculada',
                                        'Rastreamento CDI e renda fixa',
                                        'Metas com projeção temporal',
                                        'Consultora IA Alívia 24/7',
                                        'Relatórios PDF profissionais',
                                    ].map((f, i) => (
                                        <div key={i} className="flex items-start gap-3">
                                            <CheckCircle2 className="w-4 h-4 text-[#69C8B9] shrink-0 mt-0.5" />
                                            <span className="text-sm font-medium text-slate-700">{f}</span>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={onLogin} className="w-full py-4 rounded-xl font-black text-base bg-gradient-to-r from-[#69C8B9] to-[#5CCEEA] text-white shadow-xl shadow-[#69C8B9]/20 transition-all hover:scale-[1.02] active:scale-95">
                                    Ativar Premium Agora
                                </button>
                            </div>
                        </div>

                        <div className="mt-10 flex flex-wrap justify-center gap-8 text-sm text-slate-500 font-medium">
                            <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#69C8B9]" /> 7 dias grátis</span>
                            <span className="flex items-center gap-2"><LockKeyhole className="w-4 h-4 text-[#69C8B9]" /> Cancele quando quiser</span>
                            <span className="flex items-center gap-2"><Fingerprint className="w-4 h-4 text-[#69C8B9]" /> Sem compartilhar dados bancários</span>
                        </div>
                    </div>
                </section>

                {/* FINAL CTA */}
                <section className="py-24 bg-[#69C8B9] text-white text-center rounded-[3rem] mx-6 mb-16 shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 0%, transparent 60%), radial-gradient(circle at 70% 50%, white 0%, transparent 60%)' }} />
                    <div className="max-w-3xl mx-auto px-6 space-y-8 relative z-10">
                        <h2 className="text-3xl md:text-5xl font-black tracking-tight">O futuro está te esperando.</h2>
                        <p className="text-white/80 text-lg font-medium">Comece hoje com 7 dias grátis. Sem cartão, sem risco.</p>
                        <button onClick={onLogin} className="px-10 py-5 rounded-2xl bg-white text-[#69C8B9] font-black text-xl shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 mx-auto group">
                            Ativar Agora <ArrowRight className="w-6 h-6 transition-transform group-hover:translate-x-1" />
                        </button>
                    </div>
                </section>

                {/* FOOTER */}
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
        </React.Fragment>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

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

function FeatureRow({ icon: Icon, title, desc, color }) {
    return (
        <div className="flex gap-4 p-4 rounded-2xl bg-white/60 border border-slate-50 hover:border-slate-100 hover:shadow-sm transition-all group">
            <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="space-y-0.5">
                <h4 className="font-black text-sm text-slate-800">{title}</h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}

function WhyPremiumCard({ accentColor, icon: Icon, tag, title, subtitle, items }) {
    return (
        <div className="rounded-[2rem] p-8 border space-y-6" style={{
            borderColor: accentColor + '33',
            backgroundColor: accentColor + '11',
        }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white text-xs font-black uppercase tracking-widest shadow-sm" style={{ color: accentColor }}>
                <Icon className="w-3 h-3" /> {tag}
            </div>
            <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900">{title}</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">{subtitle}</p>
            </div>
            <div className="space-y-3">
                {items.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/80 border border-white shadow-sm">
                        <item.icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: accentColor }} />
                        <p className="text-sm text-slate-700 font-medium leading-relaxed">{item.text}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
