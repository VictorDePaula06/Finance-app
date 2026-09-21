import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { categoryHex } from '../constants/categories';
import aliviaFinal from '../assets/alivia/alivia-final.png';
import { ceilingsFrom, ceilingAlerts, ceilingMessage } from '../utils/categoryCeilings';
import { AlertTriangle, Target, ArrowRight } from 'lucide-react';

// ── Avisos da Alívia sobre teto por categoria (Dashboard) ───────────
// Só aparece quando alguma categoria com teto está perto (≥ 80%) ou acima
// do limite do mês. Sem teto definido ou tudo sob controle → não renderiza.

const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CeilingAlerts({ transactions = [], mk, isDark }) {
    const { userPrefs } = useAuth();
    const navigate = useNavigate();
    const ceilings = useMemo(() => ceilingsFrom(userPrefs), [userPrefs]);
    const alerts = useMemo(() => ceilingAlerts(transactions, ceilings, mk), [transactions, ceilings, mk]);
    if (alerts.length === 0) return null;

    const overCount = alerts.filter(a => a.level === 'over').length;
    const headline = overCount > 0
        ? `${overCount === 1 ? 'Uma categoria passou' : `${overCount} categorias passaram`} do teto este mês`
        : `${alerts.length === 1 ? 'Uma categoria está' : `${alerts.length} categorias estão`} perto do teto`;
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';

    return (
        <div className={`mt-4 rounded-2xl border overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500 ${overCount > 0
            ? (isDark ? 'border-rose-500/25 bg-rose-500/[0.05]' : 'border-rose-200 bg-rose-50/60')
            : (isDark ? 'border-amber-500/25 bg-amber-500/[0.05]' : 'border-amber-200 bg-amber-50/60')}`}>
            {/* Alívia fala */}
            <div className="flex items-start gap-3 px-4 sm:px-5 py-4">
                <img src={aliviaFinal} alt="Alívia" className="w-11 h-11 rounded-full object-cover border-2 border-emerald-400 shrink-0 shadow-[0_0_18px_rgba(16,185,129,0.25)]" />
                <div className="min-w-0 flex-1">
                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${overCount > 0 ? 'text-rose-500' : 'text-amber-500'}`}>Alívia · teto por categoria</p>
                    <p className={`text-[15px] font-black tracking-tight mt-0.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>{headline}</p>
                </div>
                <button onClick={() => navigate('/app/configuracoes?tab=cadastros')} className={`hidden sm:inline-flex items-center gap-1 text-[12px] font-bold shrink-0 ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                    <Target className="w-3.5 h-3.5" /> Ajustar tetos <ArrowRight className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Um bloco por categoria */}
            <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-black/5'}`}>
                {alerts.map(a => {
                    const hex = categoryHex(a);
                    const Icon = a.icon;
                    const over = a.level === 'over';
                    return (
                        <div key={a.id} className="px-4 sm:px-5 py-3.5 flex items-start gap-3">
                            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${hex}1f`, color: hex }}>{Icon && <Icon className="w-4 h-4" />}</span>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <p className={`text-[13px] font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                        {a.label}
                                        <span className={`ml-2 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${over ? 'bg-rose-500/15 text-rose-500' : 'bg-amber-500/15 text-amber-500'}`}>
                                            <AlertTriangle className="w-3 h-3" /> {over ? 'Passou' : 'Perto'} · {a.pct}%
                                        </span>
                                    </p>
                                    <p className={`text-[12px] tabular-nums ${muted}`}>R$ {money(a.spent)} <span className="opacity-60">/ R$ {money(a.ceiling)}</span></p>
                                </div>
                                <p className={`text-[12.5px] leading-relaxed mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{ceilingMessage(a)}</p>
                                <div className={`mt-2 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-black/10'}`}>
                                    <div className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, a.pct)}%` }} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
