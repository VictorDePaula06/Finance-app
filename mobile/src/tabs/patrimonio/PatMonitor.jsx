import React, { useMemo } from 'react';
import { Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { TabHeader, Card } from '../../components/ui.jsx';
import { useStore } from '../../store.jsx';
import { fmt } from '../../lib/finance.js';
import { investmentMetrics, ASSET_LABEL } from '../../lib/patrimonio.js';

// Monitora os ativos variáveis (cripto, ações, ETFs, FIIs) com cotação ao vivo.
export default function PatMonitor({ livePrices = {} }) {
  const { investments = [] } = useStore();
  const tracked = useMemo(
    () => investments.filter((a) => ['crypto', 'acoes', 'etfs', 'fiis'].includes(a.type) && a.symbol),
    [investments]
  );

  return (
    <div className="pb-6">
      <TabHeader title="Monitor" subtitle="Cotação ao vivo dos seus ativos" />

      {tracked.length === 0 ? (
        <div className="px-5 mt-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-3xl bg-fg/[0.05] border border-fg/[0.06] flex items-center justify-center mb-4"><Activity className="w-7 h-7 text-fg/40" /></div>
          <p className="text-[14px] font-bold">Nenhum ativo para monitorar</p>
          <p className="text-[12px] text-fg/40 mt-1 max-w-[250px]">Cadastre ações, ETFs, FIIs ou cripto (com código) para acompanhar a cotação aqui.</p>
        </div>
      ) : (
        <div className="px-5">
          <Card>
            {tracked.map((a, i) => {
              const sym = (a.symbol || '').toUpperCase();
              const m = investmentMetrics(a, { livePrices });
              const chg = livePrices[`${sym}_chg`];
              const pl = m.invested > 0 ? ((m.current - m.invested) / m.invested) * 100 : 0;
              const up = pl >= 0;
              return (
                <div key={a.id} className={`flex items-center gap-3 px-4 py-3 ${i === tracked.length - 1 ? '' : 'border-b border-fg/[0.04]'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[14px] font-bold truncate">{sym}</p>
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-fg/[0.06] text-fg/45">{ASSET_LABEL[a.type] || 'Ativo'}</span>
                    </div>
                    <p className="text-[11px] text-fg/40 truncate mt-0.5">{a.name || sym} · {a.quantity || 0} un.</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[14px] font-extrabold tabular-nums">R$ {fmt(m.current)}</p>
                    <p className={`text-[11px] font-bold flex items-center justify-end gap-0.5 ${up ? 'text-pos' : 'text-neg'}`}>
                      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {up ? '+' : '−'}{Math.abs(pl).toFixed(1)}%
                      {chg != null && <span className="text-fg/30 font-medium ml-1">(dia {chg >= 0 ? '+' : ''}{chg.toFixed(1)}%)</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </Card>
          <p className="text-[10px] text-fg/30 text-center mt-3">Cotações atualizam a cada 2 min · cripto (Binance) e B3 (brapi).</p>
        </div>
      )}
    </div>
  );
}
