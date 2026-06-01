import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
    Wallet,
    ChevronRight,
    Landmark,
    Sun,
    Moon,
    Lock as LockIcon,
    ShieldCheck,
    Check,
    Sparkles,
    LogOut,
} from 'lucide-react';
import logo from '../assets/logo.png';
import UpgradeModal from './UpgradeModal';
import { version } from '../../package.json';
import { PLAN_RANK, GASTOS_FEATURES, PATRIMONIO_FEATURES } from '../constants/planFeatures';

export default function Hub({ onSelectModule }) {
    const { theme, toggleTheme } = useTheme();
    const { currentUser, planLevel, isAdmin, logout } = useAuth();
    const [showUpgrade, setShowUpgrade] = useState(false);
    const isDark = theme !== 'light';
    const isStandard = planLevel === 'standard';

    const firstName = currentUser?.displayName?.split(' ')[0] || 'você';

    // Label legível do plano
    const planBadge = {
        free:     { label: 'Plano Gratuito', cls: isDark ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' : 'bg-slate-100 text-slate-600 border-slate-200' },
        standard: { label: 'Plano Standard', cls: isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-700 border-blue-200' },
        premium:  { label: 'Plano Premium',  cls: isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        lifetime: { label: 'Vitalício',      cls: isDark ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-purple-50 text-purple-700 border-purple-200' },
    }[planLevel] || { label: 'Plano Gratuito', cls: isDark ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' : 'bg-slate-100 text-slate-600 border-slate-200' };

    // Hierarquia de planos para liberar/bloquear recursos por item (fonte compartilhada).
    const userRank = isAdmin ? 2 : (PLAN_RANK[planLevel] ?? 0);
    const gastosFeatures = GASTOS_FEATURES;
    const patrimonioFeatures = PATRIMONIO_FEATURES;

    const modules = [
        {
            id: 'gastos',
            title: 'Controle de Gastos',
            tagline: 'Sua vida financeira do dia a dia',
            description: 'Organize entradas, despesas, contas fixas e cartões. Saiba para onde vai cada real e mantenha o orçamento sob controle.',
            features: gastosFeatures,
            icon: Wallet,
            accent: 'blue',
            isLocked: false,
        },
        {
            id: 'patrimonio',
            title: 'Construção de Patrimônio',
            tagline: 'Sua jornada para a independência',
            description: 'Acompanhe reservas, investimentos e metas. Veja a evolução do seu patrimônio e a saúde financeira em tempo real.',
            features: patrimonioFeatures,
            icon: Landmark,
            accent: 'emerald',
            isLocked: false,
            lockReason: null,
        },
    ];

    // Card de Painel Admin — só aparece para admins, mesma estrutura visual dos outros
    if (isAdmin) {
        modules.push({
            id: 'admin',
            title: 'Painel Administrativo',
            tagline: 'Controle da plataforma',
            description: 'Gerencie usuários, planos, permissões e configurações globais da Alívia.',
            features: [
                'Gestão de usuários e assinaturas',
                'Estatísticas operacionais em tempo real',
                'Notificações push e manutenção global',
            ],
            icon: ShieldCheck,
            accent: 'amber',
            isLocked: false,
            isAdmin: true,
        });
    }

    // Mapeamento de cores por accent — Tailwind safelist necessária
    const accentStyles = {
        blue: {
            iconBg:    isDark ? 'bg-blue-500/15' : 'bg-blue-100',
            iconText:  isDark ? 'text-blue-400'  : 'text-blue-600',
            border:    isDark ? 'border-blue-500/20 hover:border-blue-500/50' : 'border-blue-200 hover:border-blue-400',
            ring:      isDark ? 'hover:shadow-blue-500/10' : 'hover:shadow-blue-200/40',
            check:     'text-blue-500',
            tagline:   isDark ? 'text-blue-400' : 'text-blue-600',
            glow:      'bg-blue-500',
        },
        emerald: {
            iconBg:    isDark ? 'bg-emerald-500/15' : 'bg-emerald-100',
            iconText:  isDark ? 'text-emerald-400'  : 'text-emerald-600',
            border:    isDark ? 'border-emerald-500/20 hover:border-emerald-500/50' : 'border-emerald-200 hover:border-emerald-400',
            ring:      isDark ? 'hover:shadow-emerald-500/10' : 'hover:shadow-emerald-200/40',
            check:     'text-emerald-500',
            tagline:   isDark ? 'text-emerald-400' : 'text-emerald-600',
            glow:      'bg-emerald-500',
        },
        amber: {
            iconBg:    isDark ? 'bg-amber-500/15' : 'bg-amber-100',
            iconText:  isDark ? 'text-amber-400'  : 'text-amber-600',
            border:    isDark ? 'border-amber-500/20 hover:border-amber-500/50' : 'border-amber-200 hover:border-amber-400',
            ring:      isDark ? 'hover:shadow-amber-500/10' : 'hover:shadow-amber-200/40',
            check:     'text-amber-500',
            tagline:   isDark ? 'text-amber-400' : 'text-amber-600',
            glow:      'bg-amber-500',
        },
    };

    const handleModuleClick = (mod) => {
        if (mod.isLocked) {
            setShowUpgrade(true);
            return;
        }
        if (mod.isAdmin) {
            window.dispatchEvent(new CustomEvent('change-view', { detail: 'admin' }));
            return;
        }
        onSelectModule(mod.id);
    };

    // Grid responsivo: 3 colunas pra admin, 2 pra cliente padrão
    const gridCols = isAdmin ? 'lg:grid-cols-3' : 'lg:grid-cols-2';

    return (
        <div className={`min-h-screen w-full flex flex-col transition-colors duration-500 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>

            {/* Background glows */}
            <div className="fixed top-[-15%] left-[-10%] w-[60%] h-[55%] rounded-full blur-[140px] pointer-events-none opacity-20 bg-blue-500" />
            <div className="fixed bottom-[-15%] right-[-10%] w-[55%] h-[50%] rounded-full blur-[140px] pointer-events-none opacity-20 bg-emerald-500" />

            {/* TOP BAR — minimalista com plano + tema */}
            <header className="relative z-20 px-6 md:px-10 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img src={logo} alt="Alívia" className="w-10 h-10 object-contain" />
                    <span className={`hidden sm:inline text-sm font-black tracking-tight ${isDark ? 'text-white/90' : 'text-slate-800'}`}>
                        Alívia
                    </span>
                </div>

                <div className="flex items-center gap-2.5">
                    {/* Badge do plano */}
                    <span className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${planBadge.cls}`}>
                        {planLevel === 'premium' && <Sparkles className="w-3 h-3" />}
                        {planLevel === 'lifetime' && <Sparkles className="w-3 h-3" />}
                        {planBadge.label}
                    </span>

                    {/* Toggle tema */}
                    <button
                        onClick={toggleTheme}
                        className={`p-2.5 rounded-full transition-all border ${
                            isDark
                                ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-emerald-400'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-emerald-500 shadow-sm'
                        }`}
                        title={isDark ? 'Mudar para claro' : 'Mudar para escuro'}
                        aria-label="Alternar tema"
                    >
                        {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    </button>

                    {/* Sair */}
                    <button
                        onClick={logout}
                        className={`p-2.5 rounded-full transition-all border ${
                            isDark
                                ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200'
                        }`}
                        title="Sair"
                        aria-label="Sair"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* MAIN */}
            <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 relative z-10">
                <div className="w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">

                    {/* HERO */}
                    <div className="text-center mb-12 md:mb-16">
                        <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.4em] text-emerald-500 mb-3">
                            Bem-vindo(a) de volta
                        </p>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-5">
                            Olá, <span className="text-emerald-500">{firstName}</span>.
                        </h1>
                        <p className={`text-sm md:text-lg max-w-2xl mx-auto leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Escolha por onde começar hoje. Cada módulo é uma ferramenta dedicada para uma área específica da sua vida financeira.
                        </p>
                    </div>

                    {/* GRID DE MÓDULOS */}
                    <div className={`grid grid-cols-1 md:grid-cols-2 ${gridCols} gap-5 md:gap-6`}>
                        {modules.map((mod) => {
                            const Icon = mod.icon;
                            const styles = accentStyles[mod.accent];

                            return (
                                <button
                                    key={mod.id}
                                    onClick={() => handleModuleClick(mod)}
                                    className={`group relative text-left p-6 md:p-7 rounded-[2rem] border transition-all duration-500 backdrop-blur-md flex flex-col overflow-hidden hover:-translate-y-1 hover:shadow-2xl ${styles.ring} ${
                                        isDark ? 'bg-slate-900/70' : 'bg-white/80 shadow-lg shadow-slate-200/30'
                                    } ${styles.border} ${mod.isLocked ? 'opacity-90' : ''}`}
                                    aria-label={mod.title}
                                >
                                    {/* Glow sutil no fundo no hover */}
                                    <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full blur-[60px] opacity-0 group-hover:opacity-20 transition-opacity duration-700 ${styles.glow} pointer-events-none`} />

                                    {/* HEADER */}
                                    <div className="flex items-center justify-between mb-5">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-110 duration-500 ${styles.iconBg}`}>
                                            {mod.isLocked
                                                ? <LockIcon className={`w-7 h-7 ${styles.iconText}`} />
                                                : <Icon className={`w-7 h-7 ${styles.iconText}`} />
                                            }
                                        </div>

                                        {mod.isLocked ? (
                                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                                isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200'
                                            }`}>
                                                Premium
                                            </span>
                                        ) : (
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 group-hover:translate-x-1 ${
                                                isDark ? 'bg-white/5 text-slate-500 group-hover:bg-white/10 group-hover:text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-700'
                                            }`}>
                                                <ChevronRight className="w-4 h-4" />
                                            </div>
                                        )}
                                    </div>

                                    {/* TÍTULO */}
                                    <p className={`text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] mb-1 ${styles.tagline}`}>
                                        {mod.tagline}
                                    </p>
                                    <h3 className={`text-xl md:text-2xl font-black tracking-tight mb-2.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                        {mod.title}
                                    </h3>

                                    {/* DESCRIÇÃO */}
                                    <p className={`text-xs md:text-[13px] leading-relaxed mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        {mod.description}
                                    </p>

                                    {/* DIVIDER */}
                                    <div className={`h-px w-full mb-4 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`} />

                                    {/* FEATURES — ✓ incluído no plano · cadeado quando exige upgrade */}
                                    <ul className="space-y-2 flex-1">
                                        {mod.features.map((feat, i) => {
                                            const included = userRank >= (PLAN_RANK[feat.min] ?? 0);
                                            const limited = included && feat.limitedBelow && userRank < (PLAN_RANK[feat.limitedBelow] ?? 0);
                                            const tag = feat.min === 'premium' ? 'Premium' : feat.min === 'standard' ? 'Standard' : null;
                                            return (
                                                <li key={i} className="flex items-start gap-2">
                                                    {included
                                                        ? <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${styles.check}`} />
                                                        : <LockIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />}
                                                    <span className={`text-[11px] md:text-xs leading-snug font-medium ${
                                                        included ? (isDark ? 'text-slate-300' : 'text-slate-600') : (isDark ? 'text-slate-500' : 'text-slate-400')
                                                    }`}>
                                                        {feat.text}
                                                        {limited && (
                                                            <span className={`ml-1.5 align-middle text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                                                isDark ? 'bg-slate-500/20 text-slate-300' : 'bg-slate-100 text-slate-500'
                                                            }`}>Limitado</span>
                                                        )}
                                                        {!included && tag && (
                                                            <span className={`ml-1.5 align-middle text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                                                tag === 'Premium'
                                                                    ? (isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-600')
                                                                    : (isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600')
                                                            }`}>{tag}</span>
                                                        )}
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>

                                    {/* Lock reason no rodapé */}
                                    {mod.isLocked && mod.lockReason && (
                                        <p className={`mt-4 text-[10px] font-bold uppercase tracking-widest text-center ${
                                            isDark ? 'text-amber-400' : 'text-amber-600'
                                        }`}>
                                            🔒 {mod.lockReason}
                                        </p>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Hint discreta por plano */}
                    {(planLevel === 'free' || isStandard) && (
                        <p className={`text-center text-[10px] sm:text-xs mt-8 font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            Você está no <strong>{planBadge.label}</strong>. {planLevel === 'free'
                                ? 'O Controle de Gastos e o Patrimônio têm limites, e o planejamento avançado (Fluxo, Independência, Rebalanceamento) é exclusivo Premium.'
                                : 'O Controle de Gastos é ilimitado; o Patrimônio tem limites de quantidade. O Premium libera tudo (ilimitado + IA Alívia e Health Score completo).'}
                            {' '}Faça upgrade quando quiser.
                        </p>
                    )}
                </div>
            </main>

            {/* FOOTER */}
            <footer className="relative z-10 px-6 py-6 text-center">
                <p className={`text-[9px] font-black uppercase tracking-[0.4em] opacity-30 ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                }`}>
                    Alívia · v{version}
                </p>
            </footer>

            <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
        </div>
    );
}
