import React, { useMemo } from 'react';
import { Landmark, PiggyBank, TrendingUp, Target, ChevronRight } from 'lucide-react';
import { useStore } from '../../store.jsx';
import { reserveTotal, fmt } from '../../lib/finance.js';
import { summarizeInvestments } from '../../lib/patrimonio.js';

const Stat = ({ label, value, tone, Icon, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-fg/[0.03] transition text-left border-b border-fg/[0.04] last:border-0">
    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0`} style={{ background: `${tone}22` }}><Icon className="w-[18px] h-[18px]" style={{ color: tone }} /></span>
    <div className="flex-1 min-w-0">
      <p className="text-[13px] font-semibold">{label}</p>
    </div>
    <span className="text-[14px] font-extrabold tabular-nums" style={{ color: tone }}>R$ {fmt(value)}</span>
    <ChevronRight className="w-4 h-4 text-fg/25 shrink-0" />
  </button>
);

export default function PatGeral({ livePrices, onNavigate }) {
  const { savings_jars = [], investments = [], goals = [] } = useStore();
  const reserve = useMemo(() => reserveTotal(savings_jars), [savings_jars]);
  const inv = useMemo(() => summarizeInvestments(investments, { livePrices }), [investments, livePrices]);
  const total = reserve + inv.current;
  const activeGoals = goals.filter((g) => (g.status || 'active') === 'active');

  return (
    <div className="px-5 pt-4 pb-6">
      {/* Patrimônio total */}
      <div className="rounded-3xl p-5 bg-gradient-to-br from-violet-500/15 via-card to-card border border-violet-500/15">
        <div className="flex items-center gap-1.5"><Landmark className="w-4 h-4 text-info" /><span className="text-[11px] uppercase tracking-widest text-fg/40 font-bold">Patrimônio total</span></div>
        <p className="text-[32px] leading-none font-extrabold tracking-tight mt-2">R$ {fmt(total)}</p>
        <div className="flex gap-5 mt-3">
          <div><span className="text-[10px] uppercase tracking-wider text-fg/35 font-bold">Reserva</span><p className="text-[13px] font-bold text-pos">R$ {fmt(reserve)}</p></div>
          <div><span className="text-[10px] uppercase tracking-wider text-fg/35 font-bold">Investido</span><p className="text-[13px] font-bold text-info">R$ {fmt(inv.current)}</p></div>
          <div><span className="text-[10px] uppercase tracking-wider text-fg/35 font-bold">Lucro</span><p className={`text-[13px] font-bold ${inv.profit >= 0 ? 'text-pos' : 'text-neg'}`}>{inv.profit >= 0 ? '+' : '−'}R$ {fmt(Math.abs(inv.profit))}</p></div>
        </div>
      </div>

      {/* Atalhos */}
      <div className="mt-4 rounded-2xl bg-card border border-fg/[0.06] shadow-sm shadow-black/5 overflow-hidden">
        <Stat label="Reserva de emergência" value={reserve} tone="#34d399" Icon={PiggyBank} onClick={() => onNavigate?.('reserva')} />
        <Stat label="Investimentos" value={inv.current} tone="#c084fc" Icon={TrendingUp} onClick={() => onNavigate?.('investimentos')} />
      </div>

      {/* Metas */}
      <p className="text-[11px] font-black uppercase tracking-widest text-fg/35 mt-6 mb-2">Metas</p>
      <div className="rounded-2xl bg-card border border-fg/[0.06] shadow-sm shadow-black/5 p-1">
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
    </div>
  );
}
