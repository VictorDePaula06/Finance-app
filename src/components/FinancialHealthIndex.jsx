import React, { useState } from 'react';
import { Coins, ShieldCheck, ShoppingBag, Clock, ArrowRight, CreditCard, AlertTriangle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

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

// Cor de cada estado (para a escala de exibição).
const STATE_ACCENT = { excelente: 'emerald', bom: 'yellow', atencao: 'orange', critico: 'rose' };

// ── Gauge circular ──────────────────────────────────────────────────────────
function ScoreGauge({ score, ringColor, isDark }) {
    const r = 46, c = 2 * Math.PI * r;
    const offset = c * (1 - Math.max(0, Math.min(100, score)) / 100);
    return (
        <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 110 110" className="w-full h-full -rotate-90">
                <circle cx="55" cy="55" r={r} fill="none" strokeWidth="8" stroke={isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'} />
                <circle
                    cx="55" cy="55" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
                    stroke={ringColor} strokeDasharray={c} strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.4s ease' }}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{score}</span>
            </div>
        </div>
    );
}

// ── Semáforo ────────────────────────────────────────────────────────────────
function TrafficLight({ activeState, statusLabel, accentText }) {
    return (
        <div className="flex flex-col items-center gap-1.5 shrink-0">
            <div className="flex flex-col gap-1 p-1 rounded-xl bg-black/30 border border-white/5">
                {LIGHTS.slice().reverse().map(light => {
                    const on = light.state === activeState;
                    return (
                        <div
                            key={light.state}
                            className="w-3.5 h-3.5 rounded-full transition-all duration-500"
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
export default function FinancialHealthIndex({ data, invoiceInfo = null }) {
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const [showDetails, setShowDetails] = useState(false);

    if (!data) return null;

    const acc = ACCENT[data.accent] || ACCENT.slate;

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
        <div className="space-y-2">
            {/* Cabeçalho — a configuração agora é feita no botão "Configurar" do topo
                da Visão Geral (config unificada de TODO o Controle de Gastos). */}
            <div className="flex items-center justify-center gap-2 relative">
                <p className={`text-[10px] font-black uppercase tracking-[0.25em] ${sub} text-center`}>
                    Índice de Saúde Financeira
                </p>
            </div>

            {/* Card principal */}
            <div className={`relative overflow-hidden rounded-3xl border ${cardBg} ${acc.border} shadow-lg ${acc.glow}`}>
                {/* faixa de acento no topo */}
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: acc.ring }} />

                {/* Topo: semáforo + texto + gauge */}
                <div className="p-4 md:p-5 flex flex-col md:flex-row items-center gap-4">
                    <TrafficLight activeState={data.state} statusLabel={data.statusLabel} accentText={acc.text} />

                    <div className="flex-1 min-w-0 text-center md:text-left">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${acc.soft} ${acc.text} mb-1.5`}>
                            <span className={`w-1.5 h-1.5 rounded-full`} style={{ background: acc.ring }} />
                            {data.badge}
                        </span>
                        <h2 className={`text-base md:text-lg font-black leading-tight ${txt}`}>{data.heading}</h2>
                        <p className={`text-xs mt-1 ${sub} leading-snug max-w-xl`}>{data.description}</p>
                    </div>

                    <ScoreGauge score={data.score} ringColor={acc.ring} isDark={isDark} />
                </div>

                {/* Fatura do cartão em aberto (quando habilitado em Configurar índice) */}
                {data.config?.includeInvoice && invoiceInfo && invoiceInfo.total > 0.005 && (
                    <div className={`flex items-center gap-3 px-5 py-3 border-t ${isDark ? 'border-white/5 bg-violet-500/[0.05]' : 'border-slate-100 bg-violet-50/60'}`}>
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-violet-500/15' : 'bg-violet-100'}`}>
                            <CreditCard className="w-4 h-4 text-violet-400" />
                        </span>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-violet-400 flex items-center gap-1.5">
                                <AlertTriangle className="w-3 h-3" /> Fatura em aberto
                                {invoiceInfo.label && <span className={`font-medium normal-case tracking-normal ${sub}`}>· {invoiceInfo.label}</span>}
                            </p>
                            <p className={`text-[11px] ${sub}`}>
                                {invoiceInfo.dueDate
                                    ? <>Vence em <span className="font-bold text-violet-400">{invoiceInfo.daysUntil} {invoiceInfo.daysUntil === 1 ? 'dia' : 'dias'}</span> · {invoiceInfo.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</>
                                    : 'Lançamentos no crédito ainda não pagos.'}
                            </p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-base font-black text-violet-400 tabular-nums">{fmtCurrency(invoiceInfo.total)}</p>
                            <p className="text-[9px] text-slate-500">a pagar</p>
                        </div>
                    </div>
                )}

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

                    {/* Pilar 2 — Reserva de emergência (sempre a reserva aplicada atual) */}
                    <PillarCell
                        isDark={isDark} icon={ShieldCheck} title="Reserva de emergência" status={reserve.status}
                        value={fmtCurrency(reserve.value || 0)}
                        target={`${(reserve.months || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} meses · ${reserve.targetLabel}`}
                        message={reserve.message} borderR
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
                <div className={`flex items-center justify-between gap-3 px-5 py-2.5 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                    <span className={`text-[11px] font-medium ${sub} flex items-center gap-1.5`}>
                        <Clock className="w-3.5 h-3.5" /> Atualizado hoje às {updatedLabel} · {data.incomeSource === 'launched' ? 'Renda do mês' : 'Renda base'}: {fmtCurrency(data.income)}
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

            {/* Escala de estados — apenas exibição (destaca o estado atual) */}
            <div className="flex flex-wrap items-center justify-center gap-2">
                {[
                    { st: 'excelente', label: 'Excelente', range: '80–100' },
                    { st: 'bom', label: 'Bom', range: '60–79' },
                    { st: 'atencao', label: 'Atenção', range: '40–59' },
                    { st: 'critico', label: 'Crítico', range: '0–39' },
                ].map(b => {
                    const a = ACCENT[STATE_ACCENT[b.st]];
                    const active = data.state === b.st;
                    return (
                        <div
                            key={b.st}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                                active ? `${a.soft} ${a.text} ${a.border} shadow-md ${a.glow}` : `border-transparent ${isDark ? 'text-slate-500' : 'text-slate-400'}`
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full" style={{ background: active ? a.ring : (isDark ? '#475569' : '#cbd5e1') }} />
                            {b.label} <span className="opacity-60 font-medium">({b.range} pts)</span>
                        </div>
                    );
                })}
            </div>
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
        <div className={`p-3.5 ${borderR ? (isDark ? 'md:border-r border-white/5' : 'md:border-r border-slate-100') : ''}`}>
            <div className="flex items-center justify-between mb-1.5">
                <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${sub}`}>
                    <Icon className="w-3.5 h-3.5" /> {title}
                </span>
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status] || 'bg-slate-500'}`} />
            </div>
            <p className={`text-base font-black ${txt}`}>{value}</p>
            <p className={`text-[10px] ${sub} mb-2`}>{target}</p>
            {children}
            <p className={`text-[10px] mt-2 leading-snug ${sub}`}>{message}</p>
        </div>
    );
}
