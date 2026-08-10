import React from 'react';
import {
  Settings, MessageCircle, ArrowUpRight, ArrowDownRight,
  CreditCard, ChevronRight, Activity,
} from 'lucide-react';
import { useStore } from '../store.jsx';
import { useFinance } from '../hooks/useFinance.js';
import { fmt, fmtDay } from '../lib/finance.js';
import ModuleToggle from '../components/ModuleToggle.jsx';
import logo from '../assets/logo.png';
import aliviaFinal from '../assets/alivia-final.png';

// WhatsApp da Alívia (só dígitos, formato internacional, ex.: '5521999998888').
// Preencha quando o número de produção estiver ativo. Vazio → abre o WhatsApp
// deixando o usuário escolher o contato.
const ALIVIA_WA = '';
const ALIVIA_WA_LINK = `https://wa.me/${ALIVIA_WA}?text=${encodeURIComponent('Oi, Alívia! Quero registrar um gasto 💸')}`;

export default function GeralTab({ onOpenSettings, module = 'gastos', onModule, onGoToCard }) {
  const { user } = useStore();
  const { balance, income, expense, invoice, health } = useFinance();

  const firstName = user?.displayName ? user.displayName.split(' ')[0] : 'Você';
  const initial = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();
  const monthDelta = income - expense;
  const h = health;

  return (
    <div className="px-5 pt-4">
      {/* Marca Alívia */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <img src={logo} alt="Alívia" className="w-6 h-6 object-contain" />
        <span className="text-[14px] font-extrabold tracking-tight">Alívia</span>
      </div>

      {/* Header: Olá · seletor de módulo (Gastos/Patrimônio) · engrenagem */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {user?.photoURL
            ? <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
            : <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pos to-blue-500 flex items-center justify-center font-black text-sm shrink-0">{initial}</div>}
          <div className="min-w-0">
            <p className="text-[11px] text-fg/40 leading-none">Olá,</p>
            <p className="text-[14px] font-bold leading-tight truncate">{firstName}</p>
          </div>
        </div>
        {onModule && <ModuleToggle value={module} onChange={onModule} />}
        <button onClick={onOpenSettings} aria-label="Ajustes" className="w-9 h-9 rounded-full bg-fg/[0.06] flex items-center justify-center active:scale-95 transition shrink-0"><Settings className="w-[18px] h-[18px] text-fg/70" /></button>
      </div>

      {/* Consulta Alívia pelo WhatsApp — registrar gastos e tirar dúvidas por lá */}
      <a
        href={ALIVIA_WA_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 flex items-center gap-3 rounded-3xl p-4 bg-gradient-to-br from-emerald-500/15 via-card to-card border border-emerald-500/20 active:scale-[0.99] transition"
      >
        <div className="relative shrink-0">
          <img src={aliviaFinal} alt="Alívia" className="w-11 h-11 rounded-full object-cover border border-pos/30" />
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-pos border-2 border-card" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold leading-none">Consulta Alívia no WhatsApp</p>
          <p className="text-[11px] text-fg/50 mt-1.5 leading-snug">Registre seus gastos e tire dúvidas direto no WhatsApp.</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0"><MessageCircle className="w-5 h-5 text-black" /></div>
      </a>

      {/* Saldo em carteira */}
      <div className="mt-6">
        <p className="text-[12px] text-fg/40 uppercase tracking-widest font-semibold">Saldo em carteira</p>
        <p className="text-[34px] leading-none font-extrabold tracking-tight mt-2">R$ {fmt(balance)}</p>
        <p className={`text-[12px] mt-2 flex items-center gap-1 ${monthDelta >= 0 ? 'text-pos' : 'text-neg'}`}>
          {monthDelta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          {monthDelta >= 0 ? '+' : '−'} R$ {fmt(Math.abs(monthDelta))} este mês
        </p>
      </div>

      {/* Ganhos / Gastos */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="rounded-2xl bg-card border border-fg/[0.05] p-4">
          <div className="flex items-center gap-1.5"><ArrowDownRight className="w-4 h-4 text-pos" /><span className="text-[10px] uppercase tracking-widest text-fg/40 font-bold">Ganhos</span></div>
          <p className="text-lg font-extrabold mt-2 text-pos">R$ {fmt(income)}</p>
        </div>
        <div className="rounded-2xl bg-card border border-fg/[0.05] p-4">
          <div className="flex items-center gap-1.5"><ArrowUpRight className="w-4 h-4 text-neg" /><span className="text-[10px] uppercase tracking-widest text-fg/40 font-bold">Gastos</span></div>
          <p className="text-lg font-extrabold mt-2 text-neg">R$ {fmt(expense)}</p>
        </div>
      </div>

      {/* Fatura do cartão → leva para a aba Cartão */}
      <button onClick={onGoToCard} className="mt-3 w-full rounded-2xl bg-card border border-fg/[0.05] p-4 flex items-center gap-3 text-left active:scale-[0.99] transition">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0"><CreditCard className="w-5 h-5 text-info" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-fg/40 font-bold">Fatura do cartão</p>
          <p className="text-lg font-extrabold text-info leading-tight">R$ {fmt(invoice.openTotal)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] text-fg/30">{invoice.openDue ? `vence ${fmtDay(invoice.openDue)}` : (invoice.hasCards ? 'sem fatura aberta' : 'nenhum cartão')}</p>
          <ChevronRight className="w-4 h-4 text-fg/25 ml-auto mt-1" />
        </div>
      </button>

      {/* Saúde Financeira */}
      <div className="mt-3 rounded-2xl bg-card border border-fg/[0.05] p-4">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0">
            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
              <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#ffffff14" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9155" fill="none" stroke={h.color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${h.score} 100`} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center"><span className="text-[17px] font-extrabold leading-none">{h.score}</span></div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5"><Activity className="w-3 h-3" style={{ color: h.color }} /><span className="text-[10px] uppercase tracking-widest text-fg/40 font-bold">Saúde Financeira</span></div>
            <p className="text-[15px] font-bold mt-0.5" style={{ color: h.color }}>{h.statusLabel}</p>
            <p className="text-[11px] text-fg/40 leading-snug mt-0.5">Sua reserva cobre {h.reserveMonths.toFixed(1)} meses de despesas.</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2.5 mt-4">
          {h.pillars.map(p => (
            <div key={p.label}>
              <span className="text-[9px] text-fg/40 font-semibold uppercase tracking-wider">{p.label}</span>
              <div className="h-1.5 rounded-full bg-fg/[0.06] overflow-hidden mt-1"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, p.pct))}%`, background: p.color }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
}
