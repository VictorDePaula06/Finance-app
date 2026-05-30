import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Coins, ShieldCheck, ShoppingBag, Settings, Clock, ArrowRight, X, Sparkles } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { DEFAULT_HEALTH_CONFIG } from '../utils/healthScore';

const fmtCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

// Classes estáticas (Tailwind precisa de strings literais).
const ACCENT = {
    emerald: { text: 'text-emerald-400', ring: '#10b981', soft: 'bg-emerald-500/10', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/10' },
    yellow:  { text: 'text-yellow-400',  ring: '#eab308', soft: 'bg-yellow-500/10',  border: 'border-yellow-500/30',  glow: 'shadow-yellow-500/10' },
    orange:  { text: 'text-orange-400',  ring: '#f97316', soft: 'bg-orange-500/10',  border: 'border-orange-500/30',  glow: 'shadow-orange-500/10' },
    rose:    { text: 'text-rose-400',    ring: '#f43f5e', soft: 'bg-rose-500/10',    border: 'border-rose-500/30',    glow: 'shadow-rose-500/10' },
    slate:   { text: 'text-slate-400',   ring: '#64748b', soft: 'bg-slate-500/10',   border: 'border-slate-500/20',   glow: 'shadow-slate-500/10' },
};
const STATUS_DOT = { good: 'bg-emerald-500', warn: 'bg-yellow-500', bad: 'bg-rose-500' };

// Estados do semáforo, de baixo (melhor) para cima (pior) — visual de farol.
const LIGHTS = [
    { state: 'critico',   color: '#f43f5e' },
    { state: 'atencao',   color: '#f97316' },
    { state: 'bom',       color: '#eab308' },
    { state: 'excelente', color: '#10b981' },
];

// Presets para pré-visualizar os 4 estados (não altera os dados reais).
const STATE_PREVIEW = {
    excelente: { score: 90, accent: 'emerald', statusLabel: 'Excelente', badge: 'Sua saúde financeira está excelente', heading: 'Mandou bem! Sua saúde financeira está excelente. 🎉', description: 'Você está no controle: gasta com equilíbrio, guarda e ainda sobra. Continue assim.' },
    bom:       { score: 68, accent: 'yellow',  statusLabel: 'Bom',       badge: 'Sua saúde financeira está boa',       heading: 'Quase lá! Tem uma coisa que vale ajustar. 📌', description: 'No geral você está bem. Mas sua reserva de emergência ainda não chegou no ideal — vale focar nisso.' },
    atencao:   { score: 42, accent: 'orange',  statusLabel: 'Atenção',   badge: 'Sua saúde financeira pede atenção',   heading: 'Atenção! Alguns pontos precisam de cuidado. ⚠️', description: 'Sua saúde financeira pede ajustes, principalmente na sua reserva de emergência. Vamos organizar isso.' },
    critico:   { score: 18, accent: 'rose',    statusLabel: 'Crítico',   badge: 'Sua saúde financeira está crítica',   heading: 'Hora de agir. Sua saúde financeira está crítica. 🚨', description: 'Vários pontos precisam de atenção urgente, começando pela sua reserva de emergência.' },
};

// ── Gauge circular ──────────────────────────────────────────────────────────
function ScoreGauge({ score, ringColor, isDark }) {
    const r = 46, c = 2 * Math.PI * r;
    const offset = c * (1 - Math.max(0, Math.min(100, score)) / 100);
    return (
        <div className="relative w-28 h-28 shrink-0">
            <svg viewBox="0 0 110 110" className="w-full h-full -rotate-90">
                <circle cx="55" cy="55" r={r} fill="none" strokeWidth="9" stroke={isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'} />
                <circle
                    cx="55" cy="55" r={r} fill="none" strokeWidth="9" strokeLinecap="round"
                    stroke={ringColor} strokeDasharray={c} strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.4s ease' }}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{score}</span>
            </div>
        </div>
    );
}

// ── Semáforo ────────────────────────────────────────────────────────────────
function TrafficLight({ activeState, statusLabel, accentText }) {
    return (
        <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="flex flex-col gap-1.5 p-1.5 rounded-2xl bg-black/30 border border-white/5">
                {LIGHTS.slice().reverse().map(light => {
                    const on = light.state === activeState;
                    return (
                        <div
                            key={light.state}
                            className="w-5 h-5 rounded-full transition-all duration-500"
                            style={{
                                backgroundColor: on ? light.color : 'rgba(120,120,120,0.18)',
                                boxShadow: on ? `0 0 12px ${light.color}` : 'none',
                            }}
                        />
                    );
                })}
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${accentText}`}>{statusLabel}</span>
        </div>
    );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function FinancialHealthIndex({ data, config = {}, onUpdateConfig }) {
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const [previewState, setPreviewState] = useState(null);
    const [showConfig, setShowConfig] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    if (!data) return null;

    // Mescla preview (se ativo) sobre os dados reais.
    const preview = previewState ? STATE_PREVIEW[previewState] : null;
    const view = {
        score: preview ? preview.score : data.score,
        accent: preview ? preview.accent : data.accent,
        statusLabel: preview ? preview.statusLabel : data.statusLabel,
        badge: preview ? preview.badge : data.badge,
        heading: preview ? preview.heading : data.heading,
        description: preview ? preview.description : data.description,
        state: previewState || data.state,
    };
    const acc = ACCENT[view.accent] || ACCENT.slate;

    const { surplus, reserve, superfluous } = data.pillars;
    const cardBg = isDark ? 'bg-[#161b27] border-white/5' : 'bg-white border-slate-100 shadow-sm';
    const sub = isDark ? 'text-slate-400' : 'text-slate-500';
    const txt = isDark ? 'text-white' : 'text-slate-800';

    const updatedLabel = (() => {
        try {
            const d = data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt);
            return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } catch { return ''; }
    })();

    // Barra empilhada de gastos (essencial / conforto / supérfluo).
    const bd = superfluous.breakdown || { essential: 0, comfort: 0, superfluous: 0 };
    const bdTotal = bd.essential + bd.comfort + bd.superfluous;
    const seg = (v) => bdTotal > 0 ? (v / bdTotal) * 100 : 0;

    return (
        <div className="space-y-3">
            {/* Cabeçalho */}
            <div className="flex items-center justify-center gap-2 relative">
                <p className={`text-[10px] font-black uppercase tracking-[0.25em] ${sub} text-center`}>
                    Índice de Saúde Financeira — clique para ver os 4 estados
                </p>
                <button
                    onClick={() => setShowConfig(true)}
                    className={`absolute right-0 p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                    title="Configurar índice"
                >
                    <Settings className="w-4 h-4" />
                </button>
            </div>

            {/* Card principal */}
            <div className={`relative overflow-hidden rounded-[2rem] border ${cardBg} ${acc.border} shadow-lg ${acc.glow}`}>
                {/* faixa de acento no topo */}
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: acc.ring }} />
                {preview && (
                    <div className="absolute top-3 right-4 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-black/30 text-slate-300 z-10">
                        Pré-visualização
                    </div>
                )}

                {/* Topo: semáforo + texto + gauge */}
                <div className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
                    <TrafficLight activeState={view.state} statusLabel={view.statusLabel} accentText={acc.text} />

                    <div className="flex-1 min-w-0 text-center md:text-left">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${acc.soft} ${acc.text} mb-3`}>
                            <span className={`w-1.5 h-1.5 rounded-full`} style={{ background: acc.ring }} />
                            {view.badge}
                        </span>
                        <h2 className={`text-xl md:text-2xl font-black leading-tight ${txt}`}>{view.heading}</h2>
                        <p className={`text-sm mt-2 ${sub} leading-relaxed max-w-xl`}>{view.description}</p>
                    </div>

                    <ScoreGauge score={view.score} ringColor={acc.ring} isDark={isDark} />
                </div>

                {/* Pilares */}
                <div className={`grid grid-cols-1 md:grid-cols-3 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    {/* Pilar 1 — Sobra no mês */}
                    <PillarCell
                        isDark={isDark} icon={Coins} title="Sobra no mês" status={surplus.status}
                        value={fmtCurrency(surplus.value)} target={surplus.targetLabel} message={surplus.message}
                        borderR
                    >
                        <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                            <div className={`h-full rounded-full ${STATUS_DOT[surplus.status]}`} style={{ width: surplus.value > 0 ? '100%' : '8%' }} />
                        </div>
                    </PillarCell>

                    {/* Pilar 2 — Reserva de emergência */}
                    <PillarCell
                        isDark={isDark} icon={ShieldCheck} title="Reserva de emergência" status={reserve.status}
                        value={`${(reserve.months || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} meses`}
                        target={reserve.targetLabel} message={reserve.message} borderR
                    >
                        <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                            <div className={`h-full rounded-full ${STATUS_DOT[reserve.status]}`} style={{ width: `${Math.max(4, Math.min(100, reserve.pct || 0))}%` }} />
                        </div>
                    </PillarCell>

                    {/* Pilar 3 — Gastos supérfluos */}
                    <PillarCell
                        isDark={isDark} icon={ShoppingBag} title="Gastos supérfluos" status={superfluous.status}
                        value={`${Math.round(superfluous.pct || 0)}% supérfluo`} target={superfluous.targetLabel} message={superfluous.message}
                    >
                        <div className={`w-full h-1.5 rounded-full overflow-hidden flex ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                            <div className="h-full bg-blue-500" style={{ width: `${seg(bd.essential)}%` }} />
                            <div className="h-full bg-amber-500" style={{ width: `${seg(bd.comfort)}%` }} />
                            <div className="h-full bg-rose-500" style={{ width: `${seg(bd.superfluous)}%` }} />
                        </div>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <Legend color="bg-blue-500" label="Essencial" pct={Math.round(bd.essential)} dark={isDark} />
                            <Legend color="bg-amber-500" label="Conforto" pct={Math.round(bd.comfort)} dark={isDark} />
                            <Legend color="bg-rose-500" label="Supérfluo" pct={Math.round(bd.superfluous)} dark={isDark} />
                        </div>
                    </PillarCell>
                </div>

                {/* Rodapé */}
                <div className={`flex items-center justify-between gap-3 px-6 py-3.5 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    <span className={`text-[11px] font-medium ${sub} flex items-center gap-1.5`}>
                        <Clock className="w-3.5 h-3.5" /> Atualizado hoje às {updatedLabel} · Renda base: {fmtCurrency(data.income)}
                    </span>
                    <button onClick={() => setShowDetails(v => !v)} className={`text-[11px] font-bold flex items-center gap-1 ${acc.text} hover:underline`}>
                        Ver análise completa <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Detalhe expandido (pontuação por pilar) */}
                {showDetails && (
                    <div className={`px-6 pb-5 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t pt-4 ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                        {[
                            { label: 'Sobra no mês', s: surplus.score, m: surplus.max },
                            { label: 'Reserva', s: reserve.score, m: reserve.max },
                            { label: 'Supérfluos', s: superfluous.score, m: superfluous.max },
                        ].map(p => (
                            <div key={p.label} className={`p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${sub}`}>{p.label}</p>
                                <p className={`text-lg font-black ${txt}`}>{p.s}<span className="text-xs text-slate-500"> / {p.m} pts</span></p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Botões dos 4 estados */}
            <div className="flex flex-wrap items-center justify-center gap-2">
                {[
                    { st: 'excelente', label: 'Excelente', pts: 90 },
                    { st: 'bom', label: 'Bom', pts: 68 },
                    { st: 'atencao', label: 'Atenção', pts: 42 },
                    { st: 'critico', label: 'Crítico', pts: 18 },
                ].map(b => {
                    const a = ACCENT[STATE_PREVIEW[b.st].accent];
                    const active = previewState === b.st;
                    return (
                        <button
                            key={b.st}
                            onClick={() => setPreviewState(active ? null : b.st)}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 ${a.soft} ${a.text} ${active ? `${a.border} shadow-md ${a.glow}` : 'border-transparent'}`}
                        >
                            <span className="w-2 h-2 rounded-full" style={{ background: a.ring }} />
                            {b.label} ({b.pts} pts)
                        </button>
                    );
                })}
            </div>

            {/* Modal de configuração */}
            {showConfig && createPortal(
                <ConfigModal
                    isDark={isDark} config={config}
                    onClose={() => setShowConfig(false)}
                    onSave={(payload) => { onUpdateConfig?.(payload); setShowConfig(false); }}
                />, document.body
            )}
        </div>
    );
}

function Legend({ color, label, pct, dark }) {
    return (
        <span className="flex items-center gap-1 text-[10px] font-medium">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            <span className={dark ? 'text-slate-400' : 'text-slate-500'}>{label} {pct}%</span>
        </span>
    );
}

function PillarCell({ isDark, icon: Icon, title, status, value, target, message, children, borderR }) {
    const sub = isDark ? 'text-slate-400' : 'text-slate-500';
    const txt = isDark ? 'text-white' : 'text-slate-800';
    return (
        <div className={`p-5 ${borderR ? (isDark ? 'md:border-r border-white/5' : 'md:border-r border-slate-100') : ''}`}>
            <div className="flex items-center justify-between mb-2">
                <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${sub}`}>
                    <Icon className="w-3.5 h-3.5" /> {title}
                </span>
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status] || 'bg-slate-500'}`} />
            </div>
            <p className={`text-xl font-black ${txt}`}>{value}</p>
            <p className={`text-[11px] ${sub} mb-3`}>{target}</p>
            {children}
            <p className={`text-[11px] mt-3 leading-relaxed ${sub}`}>{message}</p>
        </div>
    );
}

function ConfigModal({ isDark, config, onClose, onSave }) {
    const hc = { ...DEFAULT_HEALTH_CONFIG, ...(config.healthConfig || {}) };
    const [income, setIncome] = useState(config.income ? String(config.income) : '');
    const [reserveTarget, setReserveTarget] = useState(String(hc.reserveTargetMonths));
    const [superfluousCap, setSuperfluousCap] = useState(String(hc.superfluousCap));
    const [surplusTarget, setSurplusTarget] = useState(String(hc.surplusTargetPct));

    const num = (v, fb) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? fb : n; };

    const handleSave = () => {
        onSave({
            ...config,
            income: num(income, config.income || 0),
            healthConfig: {
                reserveTargetMonths: Math.max(1, num(reserveTarget, 6)),
                superfluousCap: Math.max(1, num(superfluousCap, 30)),
                surplusTargetPct: Math.max(1, num(surplusTarget, 20)),
            },
        });
    };

    const field = (label, hint, value, setValue, suffix) => (
        <div>
            <label className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</label>
            <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <input
                    type="text" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)}
                    className={`flex-1 bg-transparent font-bold text-sm focus:outline-none ${isDark ? 'text-white' : 'text-slate-800'}`}
                />
                {suffix && <span className="text-xs font-bold text-slate-500">{suffix}</span>}
            </div>
            {hint && <p className="text-[10px] text-slate-500 mt-1">{hint}</p>}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
            <div
                className={`w-full max-w-md rounded-[2rem] border overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 ${isDark ? 'bg-[#161b27] border-white/10' : 'bg-white border-slate-200'}`}
                onClick={e => e.stopPropagation()}
            >
                <div className={`flex items-center justify-between px-6 py-5 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    <h3 className={`text-lg font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        <Sparkles className="w-5 h-5 text-emerald-500" /> Configurar índice
                    </h3>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-rose-400"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                    {field('Renda base mensal', 'Usada como base para todos os cálculos.', income, setIncome, 'R$')}
                    {field('Meta de reserva', 'Quantos meses de despesa você quer guardar.', reserveTarget, setReserveTarget, 'meses')}
                    {field('Teto de gastos supérfluos', 'Limite saudável de supérfluos sobre a renda.', superfluousCap, setSuperfluousCap, '%')}
                    {field('Meta de sobra mensal', 'Quanto da renda você quer que sobre por mês.', surplusTarget, setSurplusTarget, '%')}
                </div>
                <div className={`flex gap-3 px-6 py-5 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    <button onClick={onClose} className={`flex-1 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest ${isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Cancelar</button>
                    <button onClick={handleSave} className="flex-1 py-3 bg-emerald-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600">Salvar</button>
                </div>
            </div>
        </div>
    );
}
