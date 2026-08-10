import React, { useMemo } from 'react';
import { Landmark, Target } from 'lucide-react';
import { useStore } from '../../store.jsx';
import { reserveTotal, fmt } from '../../lib/finance.js';
import { summarizeInvestments, investmentMetrics, isActiveInvestment, ASSET_LABEL } from '../../lib/patrimonio.js';
import AssetLogo from '../../components/AssetLogo.jsx';

const CLASS_COLOR = { renda_fixa: '#6366f1', acoes: '#a855f7', etfs: '#3b82f6', fiis: '#14b8a6', crypto: '#f59e0b', outros: '#64748b' };
const RESERVE_COLOR = '#10b981';

export default function PatGeral({ livePrices, onNavigate }) {
  const { savings_jars = [], investments = [], goals = [] } = useStore();
  const reserve = useMemo(() => reserveTotal(savings_jars), [savings_jars]);
  const inv = useMemo(() => summarizeInvestments(investments, { livePrices }), [investments, livePrices]);
  const total = reserve + inv.current;
  const activeGoals = goals.filter((g) => (g.status || 'active') === 'active');

  // Composição do patrimônio: Reservas + cada classe de investimento (igual ao web).
  const composition = useMemo(() => {
    const rows = [];
    if (reserve > 0.005) rows.push({ key: 'reserve', name: 'Reservas', value: reserve, color: RESERVE_COLOR });
    Object.entries(inv.byClass || {}).forEach(([k, v]) => {
      if (v > 0.005) rows.push({ key: k, name: ASSET_LABEL[k] || 'Outros', value: v, color: CLASS_COLOR[k] || '#64748b' });
    });
    return rows.sort((a, b) => b.value - a.value);
  }, [reserve, inv.byClass]);
  const compTotal = composition.reduce((a, r) => a + r.value, 0);

  // Principais ativos (top 5 por valor, sem vendidos).
  const topAssets = useMemo(() => investments
    .filter((a) => isActiveInvestment(a, { livePrices }))
    .map((a) => ({ a, value: investmentMetrics(a, { livePrices }).current }))
    .filter((x) => x.value > 0.005)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5), [investments, livePrices]);

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

      {/* Composição do patrimônio */}
      <p className="text-[11px] font-black uppercase tracking-widest text-fg/35 mt-6 mb-2">Composição do patrimônio</p>
      <div className="rounded-2xl bg-card border border-fg/[0.06] shadow-sm shadow-black/5 p-4">
        {composition.length === 0 ? (
          <p className="text-center text-[13px] text-fg/40 py-6">Sem patrimônio registrado ainda.</p>
        ) : (
          <>
            {/* Barra empilhada */}
            <div className="flex h-2.5 rounded-full overflow-hidden mb-4">
              {composition.map((r) => (
                <div key={r.key} style={{ width: `${(r.value / compTotal) * 100}%`, background: r.color }} />
              ))}
            </div>
            <div className="space-y-2.5">
              {composition.map((r) => (
                <div key={r.key} className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                  <span className="text-[13px] font-semibold flex-1 min-w-0 truncate">{r.name}</span>
                  <span className="text-[12px] font-bold tabular-nums">R$ {fmt(r.value)}</span>
                  <span className="text-[10px] font-bold text-fg/40 tabular-nums w-9 text-right">{Math.round((r.value / compTotal) * 100)}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Principais ativos */}
      {topAssets.length > 0 && (
        <>
          <div className="flex items-center justify-between mt-6 mb-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-fg/35">Principais ativos</span>
            <button onClick={() => onNavigate?.('investimentos')} className="text-[11px] font-bold text-info active:scale-95 transition">Ver todos</button>
          </div>
          <div className="rounded-2xl bg-card border border-fg/[0.06] shadow-sm shadow-black/5 overflow-hidden">
            {topAssets.map(({ a, value }, i) => (
              <button key={a.id} onClick={() => onNavigate?.('investimentos')} className={`w-full text-left flex items-center gap-3 px-4 py-3 active:bg-fg/[0.03] transition ${i === topAssets.length - 1 ? '' : 'border-b border-fg/[0.04]'}`}>
                <AssetLogo asset={a} size={34} color={CLASS_COLOR[a.type] || '#94a3b8'} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate">{a.name || a.symbol || 'Ativo'}</p>
                  <p className="text-[11px] text-fg/40 truncate">{ASSET_LABEL[a.type] || 'Outros'}</p>
                </div>
                <span className="text-[13px] font-extrabold tabular-nums shrink-0">R$ {fmt(value)}</span>
              </button>
            ))}
          </div>
        </>
      )}

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
