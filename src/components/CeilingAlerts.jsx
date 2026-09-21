import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import aliviaFinal from '../assets/alivia/alivia-final.png';
import { ceilingsFrom, ceilingAlerts } from '../utils/categoryCeilings';
import { ArrowRight } from 'lucide-react';

// ── Nota rápida da Alívia sobre tetos (cabeçalho do Dashboard) ──────
// Uma linha só, sempre visível sem rolar: fica sob o "Olá, <nome>" no lugar do
// subtítulo padrão. Sem teto definido ou tudo sob controle → mostra `fallback`.

const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CeilingAlerts({ transactions = [], mk, isDark, fallback = null }) {
    const { userPrefs } = useAuth();
    const navigate = useNavigate();
    const ceilings = useMemo(() => ceilingsFrom(userPrefs), [userPrefs]);
    const alerts = useMemo(() => ceilingAlerts(transactions, ceilings, mk), [transactions, ceilings, mk]);
    if (alerts.length === 0) return fallback;

    const over = alerts.filter(a => a.level === 'over');
    const near = alerts.filter(a => a.level === 'near');
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';

    // Uma frase só, no tom da Alívia (os chips ao lado já dizem quais categorias).
    const cat = (n) => `${n} categoria${n > 1 ? 's' : ''}`;
    let frase;
    if (over.length && near.length) {
        frase = <>Passou do teto em <b>{cat(over.length)}</b> e está perto em <b>{cat(near.length)}</b> — vale segurar até o fim do mês.</>;
    } else if (over.length) {
        const total = over.reduce((s, a) => s + (a.spent - a.ceiling), 0);
        frase = over.length === 1
            ? <><b>{over[0].label}</b> passou do teto — R$ {money(total)} acima. Vale segurar até o fim do mês.</>
            : <><b>{cat(over.length)}</b> passaram do teto — R$ {money(total)} acima no total. Vale segurar até o fim do mês.</>;
    } else {
        const a0 = near[0];
        frase = near.length === 1
            ? <><b>{a0.label}</b> está a {a0.pct}% do teto — ainda cabem R$ {money(a0.ceiling - a0.spent)} este mês.</>
            : <><b>{cat(near.length)}</b> estão perto do teto — um olho nelas nas próximas compras. 😉</>;
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
            <button onClick={() => navigate('/app/analises?report=tetos')} title="Ver o relatório de teto por categoria em Análises"
                className={`inline-flex items-center gap-0.5 text-[11px] font-bold transition ${muted} ${isDark ? 'hover:text-slate-300' : 'hover:text-slate-600'}`}>
                Ver relatório <ArrowRight className="w-3 h-3" />
            </button>
        </span>
    );
}
