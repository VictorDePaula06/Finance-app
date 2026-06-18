import React, { useMemo, useState } from 'react';
import { Scale, ArrowUpRight, ArrowDownRight, CheckCircle2, SlidersHorizontal } from 'lucide-react';
import { TabHeader, Card } from '../../components/ui.jsx';
import Sheet from '../../components/Sheet.jsx';
import RebalanceForm from '../../components/forms/RebalanceForm.jsx';
import { useStore } from '../../store.jsx';
import { fmt } from '../../lib/finance.js';
import { summarizeInvestments, buildRebalancePlan } from '../../lib/patrimonio.js';

const ConfigBtn = ({ onClick }) => (
  <button onClick={onClick} aria-label="Configurar alvo" className="w-9 h-9 rounded-full bg-info/15 text-info flex items-center justify-center active:scale-90 transition shrink-0"><SlidersHorizontal className="w-[18px] h-[18px]" /></button>
);

export default function PatRebalanceamento({ livePrices = {} }) {
  const { investments = [], prefs = {}, savePref } = useStore();
  const targets = prefs?.rebalanceTargets || {};
  const [config, setConfig] = useState(false);

  const summary = useMemo(() => summarizeInvestments(investments, { livePrices }), [investments, livePrices]);
  const plan = useMemo(() => buildRebalancePlan(summary.byClass, targets), [summary, targets]);
  const rowsWithValue = plan.rows.filter((r) => r.current > 0 || r.target > 0);

  const saveTargets = async (t) => { await savePref({ rebalanceTargets: t }); return true; };

  return (
    <div className="pb-6">
      <TabHeader title="Rebalanceamento" subtitle="Sua carteira x a alocação-alvo" right={<ConfigBtn onClick={() => setConfig(true)} />} />

      {!plan.hasTargets ? (
        <div className="px-5 mt-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-2"><Scale className="w-5 h-5 text-warn" /><p className="text-[14px] font-bold">Defina sua alocação-alvo</p></div>
            <p className="text-[12px] text-fg/50 leading-relaxed">
              Defina os percentuais por classe (Renda Fixa, Ações, FIIs, Cripto, Imóveis). Aí eu comparo com a sua
              carteira e mostro exatamente o que comprar ou vender para chegar lá.
            </p>
            <button onClick={() => setConfig(true)} className="mt-4 w-full py-3 rounded-xl bg-info text-white font-bold text-[13px] flex items-center justify-center gap-2 active:scale-95 transition"><SlidersHorizontal className="w-4 h-4" /> Configurar alocação-alvo</button>
          </Card>
          {plan.total > 0 && <AllocationOnly rows={rowsWithValue} total={plan.total} />}
        </div>
      ) : (
        <div className="px-5 mt-1 space-y-3">
          {rowsWithValue.map((r) => {
            const aporte = r.diff >= 0;
            const ok = Math.abs(r.currentPct - r.targetPct) < 1;
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-bold" style={{ color: r.hex }}>{r.label}</span>
                  <span className="text-[12px] font-semibold text-fg/55">{r.currentPct.toFixed(0)}% <span className="text-fg/30">/ meta {r.targetPct.toFixed(0)}%</span></span>
                </div>
                <div className="relative h-2 rounded-full bg-fg/[0.06] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.currentPct)}%`, background: r.hex }} />
                  <div className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-fg/80" style={{ left: `${Math.min(100, r.targetPct)}%` }} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-fg/40">R$ {fmt(r.current)} <span className="text-fg/25">· meta R$ {fmt(r.targetValue)}</span></span>
                  {ok ? (
                    <span className="text-[11px] font-bold text-pos flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Equilibrado</span>
                  ) : (
                    <span className={`text-[11px] font-bold flex items-center gap-1 ${aporte ? 'text-pos' : 'text-neg'}`}>
                      {aporte ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {aporte ? 'Aportar' : 'Vender'} R$ {fmt(Math.abs(r.diff))}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {config && (
        <Sheet title="Alocação-alvo" subtitle="Defina o percentual de cada classe" onClose={() => setConfig(false)}>
          <RebalanceForm initial={targets} onSubmit={saveTargets} onDone={() => setConfig(false)} />
        </Sheet>
      )}
    </div>
  );
}

// Mostra só a alocação atual quando ainda não há metas configuradas.
function AllocationOnly({ rows, total }) {
  return (
    <Card className="mt-3 p-4">
      <p className="text-[11px] font-black uppercase tracking-widest text-fg/35 mb-3">Alocação atual</p>
      <div className="space-y-2">
        {rows.map((r) => {
          const pct = total > 0 ? (r.current / total) * 100 : 0;
          return (
            <div key={r.id}>
              <div className="flex justify-between text-[11px] mb-1"><span className="font-semibold" style={{ color: r.hex }}>{r.label}</span><span className="text-fg/40">{pct.toFixed(0)}% · R$ {fmt(r.current)}</span></div>
              <div className="h-1.5 rounded-full bg-fg/[0.06] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.hex }} /></div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
