import React, { useState, useEffect } from 'react';
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
    Download,
    Sparkles,
    Megaphone,
    Search,
    Key,
    Settings,
    Loader2,
    Eye,
    EyeOff,
    Video,
    ChevronDown
} from 'lucide-react';
import tutorialVideoManual from '../assets/tutorial-gemini-key2.mp4';
import tutorialVideoOriginal from '../assets/tutorial-gemini-key.mp4';
import { generateManualPDF } from '../utils/manualPDF';
import { useTheme } from '../contexts/ThemeContext';
import { validateApiKey } from '../services/gemini';

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
    const [apiKey, setApiKey] = useState(localStorage.getItem('user_gemini_api_key') || '');
    const [showPassword, setShowPassword] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error'

    useEffect(() => {
        const handleManualSection = (e) => {
            if (e.detail) setActiveSection(e.detail);
        };
        window.addEventListener('manual-section', handleManualSection);
        return () => window.removeEventListener('manual-section', handleManualSection);
    }, []);

    const handleSaveApiKey = async () => {
        if (!apiKey.trim()) {
            localStorage.removeItem('user_gemini_api_key');
            setSaveStatus('success');
            setTimeout(() => setSaveStatus(null), 3000);
            return;
        }

        setIsValidating(true);
        setSaveStatus(null);
        
        const isValid = await validateApiKey(apiKey.trim());
        
        if (isValid) {
            localStorage.setItem('user_gemini_api_key', apiKey.trim());
            setSaveStatus('success');
            setTimeout(() => setSaveStatus(null), 3000);
        } else {
            setSaveStatus('error');
        }
        setIsValidating(false);
    };

    const sections = [
        { id: 'intro', title: 'Boas-vindas', icon: BookOpen },
        { id: 'settings', title: 'Configurações de IA', icon: Settings },
        { id: 'dashboard', title: 'Dashboard & Saldo', icon: Wallet },
        { id: 'health', title: 'Saúde Financeira', icon: ShieldCheck },
        { id: 'goals', title: 'Metas e Objetivos', icon: Target },
        { id: 'advisor', title: 'Sua Alívia', icon: MessageSquare },
        { id: 'experience', title: 'Experiência Alívia', icon: Zap },
        { id: 'news', title: 'Novidades', icon: Sparkles },
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

                        {/* 1. SETTINGS */}
                        <Section id="settings" title="Configurações de Inteligência Artificial" icon={Settings} activeSection={activeSection} theme={theme}>
                            <div className={`p-8 rounded-[2rem] border mb-8 ${
                                theme === 'light' ? 'bg-white border-emerald-100 shadow-sm' : 'bg-slate-900 border-white/5'
                            }`}>
                                <div className="flex flex-col md:flex-row gap-8 items-start">
                                    <div className="flex-1 space-y-6">
                                        <h3 className={`text-lg font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                            <Key className="w-5 h-5 text-emerald-500" />
                                            Sua Chave de API Gemini
                                        </h3>
                                        <p className="text-sm">
                                            Para que a Alívia possa falar com você e analisar suas finanças, precisamos de uma chave de API do Google Gemini. 
                                            A chave é gratuita para uso pessoal e fica guardada apenas no seu navegador.
                                        </p>
                                        
                                        <div className="space-y-4">
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Pule ou cole sua chave aqui (AIza...)"
                                                    value={apiKey}
                                                    onChange={(e) => setApiKey(e.target.value)}
                                                    className={`w-full px-5 py-4 rounded-2xl border transition-all pr-14 ${
                                                        theme === 'light' 
                                                        ? 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20' 
                                                        : 'bg-slate-800 border-white/5 focus:bg-slate-700/50 focus:ring-2 focus:ring-blue-500/20 text-white'
                                                    }`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400"
                                                    title={showPassword ? "Esconder" : "Mostrar"}
                                                >
                                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </button>
                                                
                                                {saveStatus === 'success' && !showPassword && (
                                                    <div className="absolute right-14 top-1/2 -translate-y-1/2 text-emerald-500 flex items-center gap-1 animate-in fade-in slide-in-from-right-2">
                                                        <Check className="w-5 h-5" />
                                                        <span className="text-xs font-bold">Salvo!</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <button
                                                    onClick={handleSaveApiKey}
                                                    disabled={isValidating}
                                                    className={`flex-1 py-4 px-6 rounded-2xl font-black text-white flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50 ${
                                                        theme === 'light' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
                                                    }`}
                                                >
                                                    {isValidating ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                                                    Salvar e Validar Chave
                                                </button>
                                                
                                                <a
                                                    href="https://aistudio.google.com/app/apikey"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-sm border transition-all ${
                                                        theme === 'light' ? 'border-slate-200 text-slate-500 hover:bg-slate-50' : 'border-white/5 text-slate-400 hover:bg-white/5'
                                                    }`}
                                                >
                                                    Pegar chave gratuita
                                                    <ChevronRight className="w-4 h-4" />
                                                </a>
                                            </div>

                                            <div className={`p-4 rounded-2xl border ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'}`}>
                                                <details className="group">
                                                    <summary className="flex items-center justify-between cursor-pointer text-sm font-bold text-slate-500 hover:text-emerald-500 transition-colors">
                                                        <span className="flex items-center gap-2">
                                                            <Video className="w-5 h-5" />
                                                            Como obter uma chave? (Tutorial em Vídeo)
                                                        </span>
                                                        <ChevronDown className="w-5 h-5 transition-transform group-open:rotate-180" />
                                                    </summary>
                                                    <div className="mt-4 space-y-4">
                                                        <p className="text-xs leading-relaxed opacity-70">
                                                            Siga o passo a passo no vídeo abaixo para gerar sua chave gratuita no Google AI Studio em menos de 1 minuto.
                                                        </p>
                                                        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black shadow-lg">
                                                            <video
                                                                src={tutorialVideoManual}
                                                                controls
                                                                className="w-full aspect-video object-contain"
                                                            >
                                                                Seu navegador não suporta a tag de vídeo.
                                                            </video>
                                                        </div>
                                                    </div>
                                                </details>
                                            </div>
                                        </div>

                                        {saveStatus === 'success' && (
                                            <div className="mt-6 p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-center animate-in fade-in slide-in-from-top-4 duration-500 shadow-lg shadow-emerald-500/5">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="p-3 bg-emerald-500/20 rounded-full">
                                                        <Sparkles className="w-6 h-6 animate-pulse" />
                                                    </div>
                                                    <p className="font-black tracking-tight text-lg">
                                                        Sua Alívia está configurada e pronta para te ajudar! 🍃
                                                    </p>
                                                    <p className="text-xs opacity-70">
                                                        Agora você pode aproveitar o poder da inteligência artificial nas suas finanças.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {saveStatus === 'error' && (
                                            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold animate-shake">
                                                Chave inválida. Por favor, verifique se copiou corretamente do Google AI Studio.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className={`text-lg font-bold border-b pb-4 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>Por que preciso disso?</h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className={`p-5 rounded-2xl border ${theme === 'light' ? 'bg-white border-slate-100' : 'bg-slate-900 border-white/5'}`}>
                                        <h4 className="font-bold mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-500" /> Inteligência Real</h4>
                                        <p className="text-xs">Diferente de planilhas comuns, a Alívia usa o Gemini 2.5 Flash para entender sua linguagem natural e te dar conselhos empáticos.</p>
                                    </div>
                                    <div className={`p-5 rounded-2xl border ${theme === 'light' ? 'bg-white border-slate-100' : 'bg-slate-900 border-white/5'}`}>
                                        <h4 className="font-bold mb-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Total Privacidade</h4>
                                        <p className="text-xs">Sua chave é armazenada LOCALMENTE. Nós não temos acesso a ela, garantindo que suas conversas fiquem apenas entre você e a IA.</p>
                                    </div>
                                </div>
                            </div>
                        </Section>

                        {/* 2. INTRO */}
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

                        {/* 7. NEWS */}
                        <Section id="news" title="Novidades do Sistema" icon={Sparkles} activeSection={activeSection} theme={theme}>
                            <p className="mb-8">Acompanhe aqui todas as atualizações e melhorias que implementamos para tornar sua jornada financeira cada vez mais leve.</p>

                            <div className="space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:to-transparent">
                                
                                {/* Item 1 */}
                                <div className="relative pl-12">
                                    <div className={`absolute left-0 top-1 w-8 h-8 rounded-full border-4 flex items-center justify-center z-10 ${
                                        theme === 'light' ? 'bg-white border-emerald-500' : 'bg-slate-900 border-emerald-500'
                                    }`}>
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                    </div>
                                    <div className={`p-6 rounded-2xl border transition-all hover:scale-[1.01] ${
                                        theme === 'light' ? 'bg-white border-emerald-100 shadow-sm' : 'bg-slate-800/40 border-slate-700'
                                    }`}>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                                            <h4 className={`text-lg font-black ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>Notificações Inteligentes 🔔</h4>
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                theme === 'light' ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/20 text-emerald-400'
                                            }`}>Hoje</span>
                                        </div>
                                        <p className="text-sm mb-4">Lançamos um novo sistema de avisos integrados no cabeçalho. Agora você pode ativar notificações push para receber alertas de segurança e atualizações em tempo real.</p>
                                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <li className="flex items-center gap-2 text-[11px] opacity-75"><Check className="w-3 h-3 text-emerald-500" /> Ativação em um clique</li>
                                            <li className="flex items-center gap-2 text-[11px] opacity-75"><Check className="w-3 h-3 text-emerald-500" /> Sem cards intrusivos</li>
                                            <li className="flex items-center gap-2 text-[11px] opacity-75"><Check className="w-3 h-3 text-emerald-500" /> Histórico no Manual</li>
                                            <li className="flex items-center gap-2 text-[11px] opacity-75"><Check className="w-3 h-3 text-emerald-500" /> Modo Silencioso</li>
                                        </ul>
                                    </div>
                                </div>

                                {/* Item 2 */}
                                <div className="relative pl-12">
                                    <div className={`absolute left-0 top-1 w-8 h-8 rounded-full border-4 flex items-center justify-center z-10 ${
                                        theme === 'light' ? 'bg-white border-blue-500/50' : 'bg-slate-900 border-blue-500/50'
                                    }`}>
                                        <div className="w-2 h-2 rounded-full bg-blue-500/50" />
                                    </div>
                                    <div className={`p-6 rounded-2xl border transition-all hover:scale-[1.01] ${
                                        theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-800/20 border-slate-800'
                                    }`}>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                                            <h4 className={`text-lg font-black ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>Refinamento Visual (v5.0) ✨</h4>
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-slate-800 text-slate-400'
                                            }`}>Março 2026</span>
                                        </div>
                                        <p className="text-sm">Modernizamos toda a interface com Glassmorphism (Efeito Vidro) e um novo sistema de cores mais suave para reduzir a ansiedade ao olhar para os números.</p>
                                    </div>
                                </div>

                                {/* Item 3 */}
                                <div className="relative pl-12">
                                    <div className={`absolute left-0 top-1 w-8 h-8 rounded-full border-4 flex items-center justify-center z-10 ${
                                        theme === 'light' ? 'bg-white border-purple-500/30' : 'bg-slate-900 border-purple-500/30'
                                    }`}>
                                        <div className="w-2 h-2 rounded-full bg-purple-500/30" />
                                    </div>
                                    <div className={`p-6 rounded-2xl border transition-all hover:scale-[1.01] ${
                                        theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-800/10 border-slate-800'
                                    }`}>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                                            <h4 className={`text-lg font-black ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>IA Evoluída com Gemini 🤖</h4>
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-slate-800 text-slate-400'
                                            }`}>Fevereiro 2026</span>
                                        </div>
                                        <p className="text-sm">A Sua Alívia agora entende melhor o seu contexto financeiro e consegue dar dicas muito mais precisas sobre onde economizar.</p>
                                    </div>
                                </div>
                            </div>

                            <div className={`mt-12 p-6 rounded-3xl border text-center ${
                                theme === 'light' ? 'bg-blue-50 border-blue-100' : 'bg-blue-500/5 border-blue-500/10'
                            }`}>
                                <Megaphone className="w-8 h-8 text-blue-500 mx-auto mb-4" />
                                <h5 className={`font-bold mb-2 ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>Queremos te ouvir!</h5>
                                <p className="text-xs opacity-75">Sentiu falta de alguma funcionalidade? Converse com a Alívia no chat e dê sua sugestão. Evoluímos o sistema com base no seu feedback.</p>
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
                        Alívia • Tranquilidade Financeira • v5.5
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
