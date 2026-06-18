import React, { useMemo } from 'react';
import { PiggyBank, ShieldCheck } from 'lucide-react';
import { TabHeader, Card } from '../../components/ui.jsx';
import { useStore } from '../../store.jsx';
import { reserveTotal, fmt } from '../../lib/finance.js';

const num = (v) => parseFloat(v) || 0;

export default function PatReserva() {
  const { savings_jars = [] } = useStore();

  const totalNow = useMemo(() => reserveTotal(savings_jars), [savings_jars]);
  const deposited = savings_jars.reduce((a, j) => a + num(j.balance), 0);
  const yield_ = Math.max(0, totalNow - deposited);

  return (
    <div className="pb-6">
      <TabHeader title="Reserva" subtitle="Sua segurança com rendimento CDI" />

      <div className="px-5 mt-1">
        <Card className="p-5 bg-gradient-to-br from-emerald-500/12 via-card to-card border-emerald-500/15">
          <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-pos" /><span className="text-[11px] uppercase tracking-widest text-fg/40 font-bold">Reserva total</span></div>
          <p className="text-[30px] font-extrabold tracking-tight text-pos mt-1.5">R$ {fmt(totalNow)}</p>
          <div className="flex gap-5 mt-2">
            <div><span className="text-[10px] uppercase tracking-wider text-fg/35 font-bold">Depositado</span><p className="text-[12px] font-bold">R$ {fmt(deposited)}</p></div>
            <div><span className="text-[10px] uppercase tracking-wider text-fg/35 font-bold">Rendimento</span><p className="text-[12px] font-bold text-pos">+R$ {fmt(yield_)}</p></div>
          </div>
        </Card>
      </div>

      <div className="px-5 mt-4">
        <Card>
          {savings_jars.length === 0 ? (
            <p className="text-center text-[13px] text-fg/40 py-10">Nenhuma reserva cadastrada. Crie um cofrinho no site.</p>
          ) : savings_jars.map((j, i) => {
            const bal = num(j.balance);
            const cdi = num(j.cdiPercent) || 100;
            return (
              <div key={j.id} className={`flex items-center gap-3 px-4 py-3.5 ${i === savings_jars.length - 1 ? '' : 'border-b border-fg/[0.04]'}`}>
                <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/12"><PiggyBank className="w-5 h-5 text-pos" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate">{j.name || 'Reserva'}</p>
                  <p className="text-[11px] text-fg/40">{cdi}% do CDI</p>
                </div>
                <span className="text-[15px] font-extrabold tabular-nums text-pos shrink-0">R$ {fmt(bal)}</span>
              </div>
            );
          })}
        </Card>
      </div>

      <p className="text-[10px] text-fg/30 text-center mt-4 px-8">O valor cresce automaticamente pelo CDI desde a última atualização — igual ao site.</p>
    </div>
  );
}
