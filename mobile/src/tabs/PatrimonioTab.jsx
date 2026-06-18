import React, { useMemo } from 'react';
import { Settings, Landmark, TrendingUp, Target, Lock, PiggyBank } from 'lucide-react';
import { useStore } from '../store.jsx';
import { reserveTotal, fmt } from '../lib/finance.js';
import { summarizeInvestments, ASSET_LABEL } from '../lib/patrimonio.js';
import ModuleToggle from '../components/ModuleToggle.jsx';
import logo from '../assets/logo.png';

export default function PatrimonioTab({ onOpenSettings, module, onModule }) {
  const { user, savings_jars = [], investments = [], goals = [] } = useStore();

  const firstName = user?.displayName ? user.displayName.split(' ')[0] : 'Você';
  const initial = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

  const reserve = useMemo(() => reserveTotal(savings_jars), [savings_jars]);
  const inv = useMemo(() => summarizeInvestments(investments), [investments]);
  const total = reserve + inv.current;
  const activeGoals = goals.filter((g) => (g.status || 'active') === 'active');

  return (
    <div className="px-5 pt-4 pb-6">
      {/* Marca */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <img src={logo} alt="Alívia" className="w-6 h-6 object-contain" />
        <span className="text-[14px] font-extrabold tracking-tight">Alívia</span>
      </div>

      {/* Header com seletor de módulo */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {user?.photoURL
            ? <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
            : <div className="w-9 h-9 rounded-full bg-gradient-to-br from-info to-blue-500 flex items-center justify-center font-black text-sm shrink-0">{initial}</div>}
          <div className="min-w-0">
            <p className="text-[11px] text-fg/40 leading-none">Olá,</p>
            <p className="text-[14px] font-bold leading-tight truncate">{firstName}</p>
          </div>
        </div>
        <ModuleToggle value={module} onChange={onModule} />
        <button onClick={onOpenSettings} aria-label="Ajustes" className="w-9 h-9 rounded-full bg-fg/[0.06] flex items-center justify-center active:scale-95 transition shrink-0"><Settings className="w-[18px] h-[18px] text-fg/70" /></button>
      </div>

      {/* Patrimônio total */}
      <div className="mt-6 rounded-3xl p-5 bg-gradient-to-br from-violet-500/15 via-card to-card border border-violet-500/15">
        <div className="flex items-center gap-1.5"><Landmark className="w-4 h-4 text-info" /><span className="text-[11px] uppercase tracking-widest text-fg/40 font-bold">Patrimônio total</span></div>
        <p className="text-[32px] leading-none font-extrabold tracking-tight mt-2">R$ {fmt(total)}</p>
        <div className="flex gap-4 mt-3">
          <div><span className="text-[10px] uppercase tracking-wider text-fg/35 font-bold">Reserva</span><p className="text-[13px] font-bold text-pos">R$ {fmt(reserve)}</p></div>
          <div><span className="text-[10px] uppercase tracking-wider text-fg/35 font-bold">Investido</span><p className="text-[13px] font-bold text-info">R$ {fmt(inv.current)}</p></div>
        </div>
      </div>

      {/* Reserva de emergência */}
      <p className="text-[11px] font-black uppercase tracking-widest text-fg/35 mt-6 mb-2">Reserva de emergência</p>
      <div className="rounded-2xl bg-card border border-fg/[0.05] shadow-sm shadow-black/5">
        {savings_jars.length === 0 ? (
          <p className="text-center text-[13px] text-fg/40 py-8">Nenhuma reserva cadastrada.</p>
        ) : savings_jars.map((j, i) => (
          <div key={j.id} className={`flex items-center gap-3 px-4 py-3 ${i === savings_jars.length - 1 ? '' : 'border-b border-fg/[0.04]'}`}>
            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/12"><PiggyBank className="w-[18px] h-[18px] text-pos" /></span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold truncate">{j.name || 'Reserva'}</p>
              <p className="text-[11px] text-fg/40">{j.cdiPercent || 100}% do CDI</p>
            </div>
            <span className="text-[14px] font-extrabold tabular-nums text-pos shrink-0">R$ {fmt(parseFloat(j.balance) || 0)}</span>
          </div>
        ))}
      </div>

      {/* Investimentos */}
      <div className="flex items-center justify-between mt-6 mb-2">
        <p className="text-[11px] font-black uppercase tracking-widest text-fg/35">Investimentos</p>
        {inv.count > 0 && (
          <span className={`text-[11px] font-bold ${inv.profit >= 0 ? 'text-pos' : 'text-neg'}`}>
            {inv.profit >= 0 ? '+' : '−'} R$ {fmt(Math.abs(inv.profit))}
          </span>
        )}
      </div>
      <div className="rounded-2xl bg-card border border-fg/[0.05] shadow-sm shadow-black/5">
        {investments.length === 0 ? (
          <p className="text-center text-[13px] text-fg/40 py-8">Nenhum investimento cadastrado.</p>
        ) : investments.map((a, i) => {
          const m = summarizeInvestments([a]);
          return (
            <div key={a.id} className={`flex items-center gap-3 px-4 py-3 ${i === investments.length - 1 ? '' : 'border-b border-fg/[0.04]'}`}>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-violet-500/12"><TrendingUp className="w-[18px] h-[18px] text-info" /></span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold truncate">{a.name || a.symbol || 'Ativo'}</p>
                <p className="text-[11px] text-fg/40">{ASSET_LABEL[a.type] || 'Outros'}{a.quantity ? ` · ${a.quantity}` : ''}</p>
              </div>
              <span className="text-[14px] font-extrabold tabular-nums text-info shrink-0">R$ {fmt(m.current)}</span>
            </div>
          );
        })}
      </div>

      {/* Metas */}
      <p className="text-[11px] font-black uppercase tracking-widest text-fg/35 mt-6 mb-2">Metas</p>
      <div className="rounded-2xl bg-card border border-fg/[0.05] shadow-sm shadow-black/5 p-1">
        {activeGoals.length === 0 ? (
          <p className="text-center text-[13px] text-fg/40 py-7">Nenhuma meta ativa.</p>
        ) : activeGoals.map((g, i) => {
          const cur = parseFloat(g.current) || 0;
          const tgt = parseFloat(g.target) || 0;
          const pct = tgt > 0 ? Math.min(100, (cur / tgt) * 100) : 0;
          return (
            <div key={g.id} className={`px-3.5 py-3 ${i === activeGoals.length - 1 ? '' : 'border-b border-fg/[0.04]'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/12"><Target className="w-4 h-4 text-warn" /></span>
                <p className="text-[13px] font-semibold flex-1 min-w-0 truncate">{g.title || 'Meta'}</p>
                <span className="text-[11px] font-bold text-fg/50">{Math.round(pct)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-fg/[0.06] overflow-hidden"><div className="h-full rounded-full bg-warn" style={{ width: `${pct}%` }} /></div>
              <div className="flex justify-between mt-1.5"><span className="text-[10px] text-fg/35">R$ {fmt(cur)}</span><span className="text-[10px] text-fg/35">de R$ {fmt(tgt)}</span></div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2 mt-7 opacity-40">
        <Lock className="w-3 h-3" /><span className="text-[10px] tracking-widest uppercase font-bold">Dados sincronizados com o site</span>
      </div>
    </div>
  );
}
