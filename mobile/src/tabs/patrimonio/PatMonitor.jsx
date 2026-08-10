import React, { useMemo, useState } from 'react';
import { Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { TabHeader, Card } from '../../components/ui.jsx';
import AssetLogo from '../../components/AssetLogo.jsx';
import { useStore } from '../../store.jsx';
import { fmt } from '../../lib/finance.js';
import { investmentMetrics, isActiveInvestment, ASSET_LABEL } from '../../lib/patrimonio.js';

// Monitora os ativos variáveis (cripto, ações, ETFs, FIIs) com cotação ao vivo.
export default function PatMonitor({ livePrices = {} }) {
  const { investments = [] } = useStore();
  const [cur, setCur] = useState('BRL'); // 'BRL' | 'USD'
  const usdRate = Number(livePrices.USD) || 5;

  const tracked = useMemo(
    () => investments.filter((a) => ['crypto', 'acoes', 'etfs', 'fiis'].includes(a.type) && a.symbol && isActiveInvestment(a, { livePrices })),
    [investments, livePrices]
  );

  // Preço unitário e valor da posição nas duas moedas.
  const priceInfo = (a) => {
    const m = investmentMetrics(a, { livePrices });
    const nativeUSD = !!a.isUSD; // cripto em USD → unitPrice em USD; senão BRL
    const unitBRL = nativeUSD ? m.unitPrice * usdRate : m.unitPrice;
    const unitUSD = nativeUSD ? m.unitPrice : m.unitPrice / usdRate;
    const totalBRL = m.current;
    const totalUSD = m.current / usdRate;
    const pl = m.invested > 0 ? ((m.current - m.invested) / m.invested) * 100 : 0;
    return { unit: cur === 'USD' ? unitUSD : unitBRL, total: cur === 'USD' ? totalUSD : totalBRL, pl };
  };

  const sym = (v) => (cur === 'USD' ? `US$ ${fmt(v)}` : `R$ ${fmt(v)}`);

  return (
    <div className="pb-6">
      <TabHeader title="Monitor" subtitle="Preço ao vivo dos seus ativos" />

      {/* Filtro de moeda */}
      <div className="px-5 mt-1 flex gap-2">
        {[{ id: 'BRL', label: 'Real (R$)' }, { id: 'USD', label: 'Dólar (US$)' }].map((o) => (
          <button key={o.id} onClick={() => setCur(o.id)}
            className={`px-4 py-1.5 rounded-full text-[12px] font-semibold transition active:scale-95 ${cur === o.id ? 'bg-fg text-ink' : 'bg-fg/[0.06] text-fg/55'}`}>
            {o.label}
          </button>
        ))}
      </div>

      {tracked.length === 0 ? (
        <div className="px-5 mt-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-3xl bg-fg/[0.05] border border-fg/[0.06] flex items-center justify-center mb-4"><Activity className="w-7 h-7 text-fg/40" /></div>
          <p className="text-[14px] font-bold">Nenhum ativo para monitorar</p>
          <p className="text-[12px] text-fg/40 mt-1 max-w-[250px]">Cadastre ações, ETFs, FIIs ou cripto (com código) na aba Investimentos para acompanhar a cotação aqui.</p>
        </div>
      ) : (
        <div className="px-5 mt-4">
          <Card>
            {tracked.map((a, i) => {
              const s = (a.symbol || '').toUpperCase();
              const { unit, total, pl } = priceInfo(a);
              const chg = livePrices[`${s}_chg`];
              const up = pl >= 0;
              return (
                <div key={a.id} className={`flex items-center gap-3 px-4 py-3 ${i === tracked.length - 1 ? '' : 'border-b border-fg/[0.04]'}`}>
                  <AssetLogo asset={a} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[14px] font-bold truncate">{s}</p>
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-fg/[0.06] text-fg/45">{ASSET_LABEL[a.type] || 'Ativo'}</span>
                    </div>
                    {/* Preço atual (unitário) */}
                    <p className="text-[12px] text-fg/50 mt-0.5">Preço: <span className="font-bold text-fg/80 tabular-nums">{sym(unit)}</span></p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[14px] font-extrabold tabular-nums">{sym(total)}</p>
                    <p className={`text-[11px] font-bold flex items-center justify-end gap-0.5 ${up ? 'text-pos' : 'text-neg'}`}>
                      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {up ? '+' : '−'}{Math.abs(pl).toFixed(1)}%
                      {chg != null && <span className="text-fg/30 font-medium ml-1">(dia {chg >= 0 ? '+' : ''}{chg.toFixed(1)}%)</span>}
                    </p>
                    <p className="text-[10px] text-fg/35 tabular-nums">{a.quantity || 0} un.</p>
                  </div>
                </div>
              );
            })}
          </Card>
          <p className="text-[10px] text-fg/30 text-center mt-3">
            Cotações a cada 2 min · dólar R$ {fmt(usdRate)} · cripto (Binance) e B3 (brapi/serverless).
          </p>
        </div>
      )}
    </div>
  );
}
