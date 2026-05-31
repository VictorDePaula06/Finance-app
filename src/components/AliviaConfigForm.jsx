import React, { useState, useEffect, useMemo } from 'react';
import {
    Settings, X, Save, Loader2, Sparkles,
    DollarSign, TrendingUp, Bell, Target,
    ShieldCheck, Scale, Rocket, Bot, Activity,
    Home, Sprout, Unlock, Award, Heart, Info,
    ArrowRight
} from 'lucide-react';
import { CATEGORIES } from '../constants/categories';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

// Constantes alinhadas com WelcomeJourney / PatrimonyWelcome
const OBJECTIVES = [
    { id: 'independence', label: 'Viver de Renda',         emoji: '🏝️', desc: 'Independência financeira',   icon: Award },
    { id: 'start',        label: 'Começar a Investir',     emoji: '🌱', desc: 'Dar o primeiro passo',       icon: Sprout },
    { id: 'debt',         label: 'Sair das Dívidas',       emoji: '🔓', desc: 'Organizar e quitar',         icon: Unlock },
    { id: 'goal',         label: 'Conquistar um Bem',      emoji: '🏠', desc: 'Casa, carro, viagem',        icon: Home },
    { id: 'control',      label: 'Controle Total',         emoji: '🧘', desc: 'Paz e organização',          icon: Heart },
];

const RISK_PROFILES = [
    { id: 'conservative', label: 'Conservador', desc: 'Segurança em primeiro lugar', icon: ShieldCheck, color: 'blue'    },
    { id: 'moderate',     label: 'Moderado',    desc: 'Equilíbrio entre risco e retorno', icon: Scale,   color: 'emerald' },
    { id: 'aggressive',   label: 'Arrojado',    desc: 'Foco em alto crescimento',   icon: Rocket,      color: 'purple'  },
];

const fmt = (v) => Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Helper: classes para botões de risk profile selecionados
const riskActiveClasses = {
    blue:    'border-blue-500 bg-blue-500/10',
    emerald: 'border-emerald-500 bg-emerald-500/10',
    purple:  'border-purple-500 bg-purple-500/10',
};
const riskTextClasses = {
    blue:    'text-blue-500',
    emerald: 'text-emerald-500',
    purple:  'text-purple-500',
};

export default function AliviaConfigForm({ manualConfig, onConfigChange, onClose, module = 'gastos', initialSection = null }) {
    const { theme } = useTheme();
    const { saveUserPreferences, userPrefs, currentUser } = useAuth();
    const isDark = theme !== 'light';

    const isPatrimony = module === 'patrimonio';

    const [isSaving, setIsSaving] = useState(false);
    const [tempConfig, setTempConfig] = useState(manualConfig || {});
    // Aba inicial depende do módulo: Gastos abre em "Renda & Custos", Patrimônio em "Perfil Investidor"
    const [activeSection, setActiveSection] = useState(initialSection || (isPatrimony ? 'perfil' : 'financeiro'));

    // Onboarding fields (vinham do WelcomeJourney mas nunca eram editáveis depois)
    const [objectives, setObjectives] = useState([]);
    const [riskProfile, setRiskProfile] = useState('');
    const [investmentPercent, setInvestmentPercent] = useState(20);
    // Alertas separados por módulo — cada módulo tem suas notificações
    const [alerts, setAlerts] = useState({
        // Gastos
        ceiling: true,
        weeklyReport: true,
        // Patrimônio
        goalProgress: true,
        rebalance: true,
    });

    // Soma real das contas fixas cadastradas (substitui o input duplicado)
    const [fixedExpensesSum, setFixedExpensesSum] = useState(0);

    useEffect(() => {
        setTempConfig(manualConfig || {});
    }, [manualConfig]);

    useEffect(() => {
        const ob = userPrefs?.onboarding || {};
        setObjectives(ob.objectives || []);
        setRiskProfile(ob.riskProfile || '');
        setInvestmentPercent(typeof ob.investmentPercent === 'number' ? ob.investmentPercent : 20);
        setAlerts({
            ceiling: ob.alerts?.ceiling ?? true,
            weeklyReport: ob.alerts?.weeklyReport ?? true,
            goalProgress: ob.alerts?.goalProgress ?? true,
            rebalance: ob.alerts?.rebalance ?? true,
        });
    }, [userPrefs]);

    // Auto-cálculo das contas fixas em tempo real (mesma fonte da aba "Contas Fixas")
    useEffect(() => {
        if (!currentUser) return;
        const q = query(collection(db, 'fixed_expenses'), where('userId', '==', currentUser.uid));
        const unsub = onSnapshot(q, (snap) => {
            const total = snap.docs.reduce((acc, d) => acc + (parseFloat(d.data().value) || 0), 0);
            setFixedExpensesSum(total);
        });
        return () => unsub();
    }, [currentUser]);

    const toggleObjective = (id) => {
        setObjectives(prev => prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]);
    };

    const handleSave = async (e) => {
        e?.preventDefault?.();
        setIsSaving(true);

        // Normaliza valores numéricos
        const finalConfig = {
            ...tempConfig,
            income: parseFloat(tempConfig.income) || 0,
            variableEstimate: parseFloat(tempConfig.variableEstimate) || 0,
            // Mantém o auto-cálculo como source-of-truth para fixedExpenses
            fixedExpenses: fixedExpensesSum,
        };

        // Salva também o bloco onboarding atualizado
        const newOnboarding = {
            ...(userPrefs?.onboarding || {}),
            objectives,
            riskProfile,
            investmentPercent,
            alerts,
        };

        try {
            onConfigChange(finalConfig);
            await saveUserPreferences({ onboarding: newOnboarding });
        } catch (err) {
            console.error('Erro ao salvar Configuração da Alívia:', err);
        } finally {
            setTimeout(() => {
                setIsSaving(false);
                if (onClose) onClose();
            }, 600);
        }
    };

    // ── Style helpers (padrão do app) ──
    const card = isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100';
    const inputBase = `w-full px-4 py-3 rounded-xl border text-sm font-bold transition-all focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
        isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
    }`;
    const sectionTitle = `text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2`;

    // Abas dependem do módulo de onde a configuração foi aberta:
    //  - "gastos" : foco em renda/custos/margens e alertas operacionais de gastos
    //  - "patrimonio" : foco em perfil de investidor e alertas patrimoniais
    const navItems = isPatrimony
        ? [
            { id: 'perfil',  label: 'Perfil Investidor', icon: TrendingUp,  color: 'text-blue-500'    },
            { id: 'saude',   label: 'Saúde Patrimonial', icon: ShieldCheck, color: 'text-emerald-500' },
            { id: 'alertas', label: 'Alertas',           icon: Bell,        color: 'text-amber-500'   },
        ]
        : [
            { id: 'financeiro', label: 'Renda & Custos', icon: DollarSign, color: 'text-emerald-500' },
            { id: 'margens',    label: 'Margens',        icon: Target,      color: 'text-rose-500'    },
            { id: 'alertas',    label: 'Alertas',        icon: Bell,        color: 'text-amber-500'   },
        ];

    return (
        <div className="p-6 md:p-10">
            {/* Header */}
            <div className={`flex items-center justify-between mb-8 pb-6 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                        <Bot className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className={`text-xl md:text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            Configurar Alívia
                        </h2>
                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {isPatrimony ? 'Patrimônio · Perfil & Alertas' : 'Controle de Gastos · Renda, Margens & Alertas'}
                        </p>
                    </div>
                </div>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className={`p-2 rounded-xl transition-all ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Nav (chips) — alinha visualmente com SettingsTab */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-1 scrollbar-hide">
                {navItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setActiveSection(item.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all ${
                                isActive
                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                    : isDark
                                        ? 'bg-white/[0.03] text-slate-400 border border-white/5 hover:bg-white/5'
                                        : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'
                            }`}
                        >
                            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-500' : item.color}`} />
                            {item.label}
                        </button>
                    );
                })}
            </div>

            <form onSubmit={handleSave} className="space-y-10">

                {/* ── BLOCO 1: RENDA & CUSTOS ── */}
                {activeSection === 'financeiro' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <h3 className={`${sectionTitle} ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                            <DollarSign className="w-4 h-4" /> Renda & Custo de Vida
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Renda Mensal Média (R$)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={tempConfig.income ?? ''}
                                    onChange={(e) => setTempConfig({ ...tempConfig, income: e.target.value })}
                                    placeholder="Ex: 5000,00"
                                    className={inputBase}
                                />
                                <p className={`text-[10px] mt-2 leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Quanto entra em média na sua conta todo mês. A Alívia usa como base quando você ainda não lançou os recebimentos do mês.
                                </p>
                            </div>

                            <div>
                                <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Estimativa de Variáveis (R$)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={tempConfig.variableEstimate ?? ''}
                                    onChange={(e) => setTempConfig({ ...tempConfig, variableEstimate: e.target.value })}
                                    placeholder="Deixe vazio para usar a média real"
                                    className={inputBase}
                                />
                                <p className={`text-[10px] mt-2 leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Custo de vida flexível (lazer, iFood, compras). Em branco, usamos a média real dos últimos 3 meses automaticamente.
                                </p>
                            </div>
                        </div>

                        {/* Gastos Fixos — agora read-only, link pra Contas Fixas */}
                        <div className={`p-5 rounded-2xl border ${card}`}>
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="min-w-0 flex-1">
                                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2 ${isDark ? 'text-blue-400' : 'text-blue-500'}`}>
                                        <Activity className="w-3.5 h-3.5" /> Gastos Fixos Mensais
                                    </p>
                                    <p className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                        R$ {fmt(fixedExpensesSum)}
                                    </p>
                                    <p className={`text-[10px] mt-1.5 leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                        Calculado automaticamente a partir das suas contas cadastradas. Para alterar, edite na aba <strong>Contas Fixas</strong>.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (onClose) onClose();
                                        window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'fixas' }));
                                    }}
                                    className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${
                                        isDark
                                            ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    Gerenciar <ArrowRight className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── BLOCO 2: PERFIL DE INVESTIDOR ── */}
                {activeSection === 'perfil' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <h3 className={`${sectionTitle} ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                            <TrendingUp className="w-4 h-4" /> Perfil de Investidor
                        </h3>

                        {/* Objetivos (multi-select) */}
                        <div>
                            <label className={`text-[10px] font-black uppercase tracking-widest mb-3 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Seus Objetivos Financeiros
                                <span className={`ml-2 normal-case tracking-normal font-medium text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    (pode selecionar mais de um)
                                </span>
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {OBJECTIVES.map(obj => {
                                    const active = objectives.includes(obj.id);
                                    return (
                                        <button
                                            key={obj.id}
                                            type="button"
                                            onClick={() => toggleObjective(obj.id)}
                                            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                                                active
                                                    ? 'border-emerald-500 bg-emerald-500/10'
                                                    : isDark
                                                        ? 'border-white/10 bg-white/5 hover:border-white/20'
                                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <span className="text-lg shrink-0">{obj.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-black text-xs ${active ? 'text-emerald-500' : (isDark ? 'text-white' : 'text-slate-800')}`}>{obj.label}</p>
                                                <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{obj.desc}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Perfil de Risco */}
                        <div>
                            <label className={`text-[10px] font-black uppercase tracking-widest mb-3 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Perfil de Risco
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                {RISK_PROFILES.map(rp => {
                                    const Icon = rp.icon;
                                    const active = riskProfile === rp.id;
                                    return (
                                        <button
                                            key={rp.id}
                                            type="button"
                                            onClick={() => setRiskProfile(rp.id)}
                                            className={`flex flex-col items-center text-center gap-2 p-4 rounded-xl border transition-all ${
                                                active
                                                    ? riskActiveClasses[rp.color]
                                                    : isDark
                                                        ? 'border-white/10 bg-white/5 hover:border-white/20'
                                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <Icon className={`w-5 h-5 ${active ? riskTextClasses[rp.color] : 'text-slate-400'}`} />
                                            <div>
                                                <p className={`font-black text-xs ${active ? riskTextClasses[rp.color] : (isDark ? 'text-white' : 'text-slate-800')}`}>
                                                    {rp.label}
                                                </p>
                                                <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{rp.desc}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* % alvo de investimento */}
                        <div>
                            <label className={`text-[10px] font-black uppercase tracking-widest mb-3 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Quanto da renda quer investir
                            </label>
                            <div className={`p-5 rounded-2xl border ${card}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className={`text-xs font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>1%</span>
                                    <span className="text-3xl font-black text-emerald-500">{investmentPercent}%</span>
                                    <span className={`text-xs font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>50%</span>
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={50}
                                    value={investmentPercent}
                                    onChange={(e) => setInvestmentPercent(parseInt(e.target.value))}
                                    className="w-full accent-emerald-500"
                                />
                                {tempConfig.income > 0 && (
                                    <p className={`text-[10px] mt-3 leading-relaxed flex items-start gap-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        <span>
                                            Com R$ {fmt(parseFloat(tempConfig.income))} de renda, {investmentPercent}% representa{' '}
                                            <strong>R$ {fmt(parseFloat(tempConfig.income) * investmentPercent / 100)}/mês</strong> para investimentos.
                                        </span>
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── BLOCO 2B: SAÚDE PATRIMONIAL (só Patrimônio) ── */}
                {activeSection === 'saude' && (() => {
                    const ph = tempConfig.patrimonyHealth || {};
                    const reserveMonthsTarget = ph.reserveMonthsTarget ?? 6;
                    const setPH = (patch) => setTempConfig({ ...tempConfig, patrimonyHealth: { ...ph, reserveMonthsTarget, ...patch } });
                    const income = parseFloat(tempConfig.income) || 0;
                    const monthlyExpenses = fixedExpensesSum > 0 ? fixedExpensesSum : (income > 0 ? income * 0.7 : 0);
                    const pillars = [
                        { label: 'Reserva de emergência', pts: 40, desc: 'Sua reserva cobre os meses de despesa definidos abaixo.' },
                        { label: 'Diversificação', pts: 30, desc: 'Quantas classes de ativo você tem e o quão equilibrada é a alocação (evitar concentração).' },
                        { label: 'Rentabilidade', pts: 30, desc: 'Retorno acumulado dos seus investimentos sobre o valor investido.' },
                    ];
                    return (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <h3 className={`${sectionTitle} ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                <ShieldCheck className="w-4 h-4" /> Saúde Patrimonial
                            </h3>
                            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                O índice de <strong>Saúde Patrimonial</strong> (medidor no topo da barra lateral) é composto por 3 pilares, calculados automaticamente a partir dos seus dados do módulo de Patrimônio:
                            </p>
                            <div className="space-y-2">
                                {pillars.map(p => (
                                    <div key={p.label} className={`p-3 rounded-xl border flex items-start gap-3 ${card}`}>
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 shrink-0">{p.pts} pts</span>
                                        <div>
                                            <p className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{p.label}</p>
                                            <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{p.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Único parâmetro configurável: meta de reserva */}
                            <div className={`p-5 rounded-2xl border ${card}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <label className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Reserva ideal</label>
                                    <span className="text-2xl font-black text-emerald-500">{reserveMonthsTarget} {reserveMonthsTarget === 1 ? 'mês' : 'meses'}</span>
                                </div>
                                <input type="range" min={3} max={24} step={1} value={reserveMonthsTarget}
                                    onChange={(e) => setPH({ reserveMonthsTarget: parseInt(e.target.value) })}
                                    className="w-full accent-emerald-500" />
                                <p className={`text-[10px] mt-2 leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Quantos meses de despesas sua reserva deve cobrir para nota máxima no pilar de reserva.
                                    {monthlyExpenses > 0 && <> Com seu custo de vida atual, a meta equivale a <strong>R$ {fmt(reserveMonthsTarget * monthlyExpenses)}</strong>.</>}
                                </p>
                                <p className={`text-[10px] mt-2 leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Diversificação e rentabilidade são medidas automaticamente a partir da sua carteira de investimentos — quanto mais classes de ativo equilibradas e melhor o retorno, maior a nota.
                                </p>
                            </div>
                        </div>
                    );
                })()}

                {/* ── BLOCO 3: ALERTAS ── (alertas distintos por módulo) */}
                {activeSection === 'alertas' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <h3 className={`${sectionTitle} ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                            <Bell className="w-4 h-4" /> Alertas & Notificações
                        </h3>

                        <div className="space-y-3">
                            {(isPatrimony
                                ? [
                                    {
                                        key: 'goalProgress',
                                        label: 'Progresso de Metas',
                                        desc: 'Aviso quando uma meta de patrimônio atingir marcos (25%, 50%, 75%, 100%).',
                                        icon: Target,
                                    },
                                    {
                                        key: 'rebalance',
                                        label: 'Rebalanceamento de Carteira',
                                        desc: 'Aviso quando sua alocação atual estiver fora do seu perfil de risco.',
                                        icon: TrendingUp,
                                    },
                                ]
                                : [
                                    {
                                        key: 'ceiling',
                                        label: 'Alerta de Teto por Categoria',
                                        desc: 'Aviso quando você atingir 80% do limite definido em uma categoria.',
                                        icon: Target,
                                    },
                                    {
                                        key: 'weeklyReport',
                                        label: 'Resumo Semanal',
                                        desc: 'Relatório de saúde financeira todo domingo.',
                                        icon: TrendingUp,
                                    },
                                ]
                            ).map(item => {
                                const Icon = item.icon;
                                const active = !!alerts[item.key];
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => setAlerts(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                                        className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                                            active
                                                ? 'border-emerald-500 bg-emerald-500/10'
                                                : isDark
                                                    ? 'border-white/10 bg-white/5 hover:border-white/20'
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                    >
                                        <div className={`p-2.5 rounded-xl shrink-0 ${active ? 'bg-emerald-500 text-white' : (isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-500')}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-black text-xs ${active ? 'text-emerald-500' : (isDark ? 'text-white' : 'text-slate-800')}`}>
                                                {item.label}
                                            </p>
                                            <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                {item.desc}
                                            </p>
                                        </div>
                                        <div className={`w-10 h-6 rounded-full flex items-center px-1 transition-all shrink-0 ${
                                            active ? 'bg-emerald-500 justify-end' : isDark ? 'bg-white/10 justify-start' : 'bg-slate-200 justify-start'
                                        }`}>
                                            <div className="w-4 h-4 bg-white rounded-full shadow" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── BLOCO 4: MARGENS POR CATEGORIA ── */}
                {activeSection === 'margens' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <h3 className={`${sectionTitle} ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
                            <Target className="w-4 h-4" /> Margem de Segurança por Categoria
                        </h3>
                        <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Define um teto mensal por categoria. A Alívia avisa quando você atingir 80% e sinaliza o ritmo dos gastos.
                            Deixe em branco para desativar o limite naquela categoria.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {CATEGORIES.expense.map(cat => {
                                const Icon = cat.icon;
                                return (
                                    <div key={cat.id} className={`flex items-center justify-between p-3 rounded-xl border ${card}`}>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Icon className={`w-4 h-4 shrink-0 ${cat.color}`} />
                                            <span className={`text-xs font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{cat.label}</span>
                                        </div>
                                        <div className="relative shrink-0">
                                            <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>R$</span>
                                            <input
                                                type="number"
                                                placeholder="0,00"
                                                value={tempConfig.categoryBudgets?.[cat.id] || ''}
                                                onChange={(e) => {
                                                    const newBudgets = { ...(tempConfig.categoryBudgets || {}), [cat.id]: e.target.value };
                                                    setTempConfig({ ...tempConfig, categoryBudgets: newBudgets });
                                                }}
                                                className={`w-24 pl-8 pr-2 py-1.5 text-right text-xs font-bold rounded-lg border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                                                    isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                                                }`}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Save button */}
                <div className={`pt-6 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 disabled:opacity-50 active:scale-95"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" /> Salvando...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" /> Salvar Configurações
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
