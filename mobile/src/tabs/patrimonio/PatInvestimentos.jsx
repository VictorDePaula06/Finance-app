import React, { useMemo, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { TabHeader, Card, SectionLabel } from '../../components/ui.jsx';
import Sheet from '../../components/Sheet.jsx';
import AssetLogo from '../../components/AssetLogo.jsx';
import InvestmentForm from '../../components/forms/InvestmentForm.jsx';
import { useStore } from '../../store.jsx';
import { fmt } from '../../lib/finance.js';
import { investmentMetrics, summarizeInvestments, ASSET_LABEL } from '../../lib/patrimonio.js';

const CLASS_HEX = { renda_fixa: '#3b82f6', acoes: '#a855f7', etfs: '#a855f7', fiis: '#10b981', crypto: '#f59e0b', outros: '#94a3b8' };

const AddBtn = ({ onClick }) => (
  <button onClick={onClick} aria-label="Adicionar" className="w-9 h-9 rounded-full bg-info/15 text-info flex items-center justify-center active:scale-90 transition shrink-0"><Plus className="w-5 h-5" /></button>
);

export default function PatInvestimentos({ livePrices = {} }) {
  const { investments = [], addInvestment, deleteInvestment } = useStore();
  const [sheet, setSheet] = useState(false);
  const [detail, setDetail] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const summary = useMemo(() => summarizeInvestments(investments, { livePrices }), [investments, livePrices]);
  const profitPct = summary.cost > 0 ? (summary.profit / summary.cost) * 100 : 0;
  const up = summary.profit >= 0;

  const openDetail = (a) => { setConfirming(false); setDetail(a); };
  const doDelete = async () => { await deleteInvestment(detail.id); setDetail(null); };

  return (
    <div className="pb-6">
      <TabHeader title="Investimentos" subtitle="Sua carteira e a rentabilidade" right={<AddBtn onClick={() => setSheet(true)} />} />

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
              <button key={a.id} onClick={() => openDetail(a)} className={`w-full text-left flex items-center gap-3 px-4 py-3 active:bg-fg/[0.03] transition ${i === investments.length - 1 ? '' : 'border-b border-fg/[0.04]'}`}>
                <AssetLogo asset={a} size={36} color={hex} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate">{a.name || a.symbol || 'Ativo'}</p>
                  <p className="text-[11px] text-fg/40 truncate">{ASSET_LABEL[a.type] || 'Outros'}{a.quantity ? ` · ${a.quantity} un.` : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[14px] font-extrabold tabular-nums">R$ {fmt(m.current)}</p>
                  {m.invested > 0 && <p className={`text-[11px] font-bold ${aUp ? 'text-pos' : 'text-neg'}`}>{aUp ? '+' : '−'}{Math.abs(pl).toFixed(1)}%</p>}
                </div>
              </button>
            );
          })}
        </Card>
      </div>

      {sheet && (
        <Sheet title="Novo investimento" onClose={() => setSheet(false)}>
          <InvestmentForm onSubmit={addInvestment} onDone={() => setSheet(false)} />
        </Sheet>
      )}

      {detail && (
        <Sheet title="Investimento" subtitle={ASSET_LABEL[detail.type] || 'Ativo'} onClose={() => setDetail(null)}>
          <div className="flex items-center gap-3">
            <AssetLogo asset={detail} size={48} color={CLASS_HEX[detail.type] || '#94a3b8'} />
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-bold truncate">{detail.name || detail.symbol || 'Ativo'}</p>
              <p className="text-[12px] text-fg/45">{detail.symbol || ASSET_LABEL[detail.type]}</p>
            </div>
            <span className="text-[16px] font-extrabold tabular-nums text-info">R$ {fmt(investmentMetrics(detail, { livePrices }).current)}</span>
          </div>
          {!confirming ? (
            <button onClick={() => setConfirming(true)} className="mt-5 w-full py-3.5 rounded-2xl border border-neg/25 text-neg font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition">
              <Trash2 className="w-4 h-4" /> Excluir investimento
            </button>
          ) : (
            <div className="mt-5 rounded-2xl bg-neg/[0.07] border border-neg/20 p-4">
              <p className="text-[13px] font-semibold flex items-center gap-2 text-neg"><AlertTriangle className="w-4 h-4 shrink-0" /> Excluir este investimento?</p>
              <div className="grid grid-cols-2 gap-2.5 mt-3">
                <button onClick={() => setConfirming(false)} className="py-3 rounded-xl bg-fg/[0.06] text-fg/70 font-bold text-[13px]">Cancelar</button>
                <button onClick={doDelete} className="py-3 rounded-xl bg-rose-500 text-white font-bold text-[13px]">Excluir</button>
              </div>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}
