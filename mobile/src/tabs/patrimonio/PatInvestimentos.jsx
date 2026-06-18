import React, { useMemo } from 'react';
import { TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { TabHeader, Card, SectionLabel } from '../../components/ui.jsx';
import { useStore } from '../../store.jsx';
import { fmt } from '../../lib/finance.js';
import { investmentMetrics, summarizeInvestments, ASSET_LABEL } from '../../lib/patrimonio.js';

const CLASS_HEX = { renda_fixa: '#3b82f6', acoes: '#a855f7', etfs: '#a855f7', fiis: '#10b981', crypto: '#f59e0b', outros: '#94a3b8' };

export default function PatInvestimentos({ livePrices = {} }) {
  const { investments = [] } = useStore();
  const summary = useMemo(() => summarizeInvestments(investments, { livePrices }), [investments, livePrices]);
  const profitPct = summary.cost > 0 ? (summary.profit / summary.cost) * 100 : 0;
  const up = summary.profit >= 0;

  return (
    <div className="pb-6">
      <TabHeader title="Investimentos" subtitle="Sua carteira e a rentabilidade" />

      <div className="px-5 mt-1">
        <Card className="p-5">
          <span className="text-[11px] uppercase tracking-widest text-fg/40 font-bold">Valor investido</span>
          <p className="text-[30px] font-extrabold tracking-tight text-info mt-1.5">R$ {fmt(summary.current)}</p>
          <p className={`text-[12px] font-bold flex items-center gap-1 mt-1 ${up ? 'text-pos' : 'text-neg'}`}>
            {up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {up ? '+' : '−'} R$ {fmt(Math.abs(summary.profit))} ({up ? '+' : '−'}{Math.abs(profitPct).toFixed(1)}%) · custo R$ {fmt(summary.cost)}
          </p>

          {/* Alocação por classe */}
          {summary.current > 0 && (
            <div className="mt-4 space-y-2">
              {Object.entries(summary.byClass).sort((a, b) => b[1] - a[1]).map(([cls, val]) => {
                const pct = (val / summary.current) * 100;
                return (
                  <div key={cls}>
                    <div className="flex justify-between text-[10px] mb-1"><span className="text-fg/50 font-semibold">{ASSET_LABEL[cls] || cls}</span><span className="text-fg/40">{pct.toFixed(0)}%</span></div>
                    <div className="h-1.5 rounded-full bg-fg/[0.06] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: CLASS_HEX[cls] || '#94a3b8' }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <SectionLabel>Ativos</SectionLabel>
      <div className="px-5">
        <Card>
          {investments.length === 0 ? (
            <p className="text-center text-[13px] text-fg/40 py-10">Nenhum investimento cadastrado. Cadastre no site.</p>
          ) : investments.map((a, i) => {
            const m = investmentMetrics(a, { livePrices });
            const pl = m.invested > 0 ? ((m.current - m.invested) / m.invested) * 100 : 0;
            const aUp = pl >= 0;
            const hex = CLASS_HEX[a.type] || '#94a3b8';
            return (
              <div key={a.id} className={`flex items-center gap-3 px-4 py-3 ${i === investments.length - 1 ? '' : 'border-b border-fg/[0.04]'}`}>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${hex}22` }}><TrendingUp className="w-[18px] h-[18px]" style={{ color: hex }} /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate">{a.name || a.symbol || 'Ativo'}</p>
                  <p className="text-[11px] text-fg/40 truncate">{ASSET_LABEL[a.type] || 'Outros'}{a.quantity ? ` · ${a.quantity} un.` : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[14px] font-extrabold tabular-nums">R$ {fmt(m.current)}</p>
                  {m.invested > 0 && <p className={`text-[11px] font-bold ${aUp ? 'text-pos' : 'text-neg'}`}>{aUp ? '+' : '−'}{Math.abs(pl).toFixed(1)}%</p>}
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
