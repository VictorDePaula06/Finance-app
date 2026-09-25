import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/LanguageContext';
import aliviaFinal from '../assets/alivia/alivia-final.png';
import { ceilingsFrom, ceilingAlerts } from '../utils/categoryCeilings';
import { ArrowRight } from 'lucide-react';

// ── Nota rápida da Alívia sobre tetos (cabeçalho do Dashboard) ──────
// Uma linha só, sempre visível sem rolar: fica sob o "Olá, <nome>" no lugar do
// subtítulo padrão. Sem teto definido ou tudo sob controle → mostra `fallback`.

const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CeilingAlerts({ transactions = [], mk, isDark, fallback = null }) {
    const { t, fmtMoney: money } = useI18n();
    const { userPrefs } = useAuth();
    const navigate = useNavigate();
    const ceilings = useMemo(() => ceilingsFrom(userPrefs), [userPrefs]);
    const alerts = useMemo(() => ceilingAlerts(transactions, ceilings, mk), [transactions, ceilings, mk]);
    if (alerts.length === 0) return fallback;

    const over = alerts.filter(a => a.level === 'over');
    const near = alerts.filter(a => a.level === 'near');
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';

    // Uma frase só, no tom da Alívia (os chips ao lado já dizem quais categorias).
    const cat = (n) => t('ceil.nCategories', { n });
    let frase;
    if (over.length && near.length) {
        frase = t('ceil.overAndNear', { over: cat(over.length), near: cat(near.length) });
    } else if (over.length) {
        const total = over.reduce((s, a) => s + (a.spent - a.ceiling), 0);
        frase = over.length === 1
            ? t('ceil.overOne', { label: over[0].label, value: money(total) })
            : t('ceil.overMany', { cats: cat(over.length), value: money(total) });
    } else {
        const a0 = near[0];
        frase = near.length === 1
            ? t('ceil.nearOne', { label: a0.label, pct: a0.pct, value: `R$ ${money(a0.ceiling - a0.spent)}` })
            : t('ceil.nearMany', { cats: cat(near.length) });
    }

    return (
        <span className="inline-flex items-center gap-2 flex-wrap max-w-full">
            <img src={aliviaFinal} alt="Alívia" className="w-5 h-5 rounded-full object-cover border border-emerald-400 shrink-0" />
            <span className={`text-[13px] sm:text-sm leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{frase}</span>
            {alerts.map(a => (
                <span key={a.id} title={`R$ ${money(a.spent)} de R$ ${money(a.ceiling)}`}
                    className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${a.level === 'over' ? 'bg-rose-500/12 text-rose-500' : 'bg-amber-500/12 text-amber-500'}`}>
                    {a.label} {a.pct}%
                </span>
            ))}
            <button onClick={() => navigate('/app/analises?report=tetos')} title={t('ceil.reportTitle')}
                className={`inline-flex items-center gap-0.5 text-[11px] font-bold transition ${muted} ${isDark ? 'hover:text-slate-300' : 'hover:text-slate-600'}`}>
                {t('ceil.report')} <ArrowRight className="w-3 h-3" />
            </button>
        </span>
    );
}
