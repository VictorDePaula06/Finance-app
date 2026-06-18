import React, { useState } from 'react';
import { TabHeader, Card, Chip, SectionLabel, fmt } from '../components/ui.jsx';
import { EXPENSES, CATS, WEEK } from '../data/sample.js';

const PERIODS = ['Este mês', '30 dias', 'Ano'];

export default function AnalisesTab() {
  const [period, setPeriod] = useState('Este mês');

  // Por categoria (a partir dos gastos de exemplo).
  const byCat = {};
  EXPENSES.forEach(t => { byCat[t.cat] = (byCat[t.cat] || 0) + t.amount; });
  const cats = Object.entries(byCat).map(([k, v]) => ({ key: k, ...CATS[k], value: v })).sort((a, b) => b.value - a.value);
  const totalExp = cats.reduce((a, c) => a + c.value, 0);

  const maxBar = Math.max(...WEEK.map(w => Math.max(w.inc, w.exp)), 1);

  return (
    <div className="pb-6">
      <TabHeader title="Análises" subtitle="Para onde seu dinheiro vai" />

      <div className="px-5 flex gap-2 overflow-x-auto no-scrollbar mt-1">
        {PERIODS.map(p => <Chip key={p} active={period === p} onClick={() => setPeriod(p)}>{p}</Chip>)}
      </div>

      {/* Resumo */}
      <div className="px-5 mt-5 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Gasto total</p>
          <p className="text-[20px] font-extrabold text-rose-400 mt-1">R$ {fmt(totalExp)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">vs. mês anterior</p>
          <p className="text-[20px] font-extrabold text-emerald-400 mt-1">−8%</p>
        </Card>
      </div>

      {/* Evolução (barras por dia) */}
      <SectionLabel>Evolução no período</SectionLabel>
      <div className="px-5">
        <Card className="p-4">
          <div className="flex items-end justify-between gap-2 h-36">
            {WEEK.map(w => (
              <div key={w.d} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div className="w-full flex items-end justify-center gap-1 h-full">
                  <div className="w-1/2 rounded-t-md bg-emerald-500" style={{ height: `${(w.inc / maxBar) * 100}%` }} />
                  <div className="w-1/2 rounded-t-md bg-rose-500" style={{ height: `${(w.exp / maxBar) * 100}%` }} />
                </div>
                <span className="text-[9px] text-white/35">{w.d}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 pl-1">
            <span className="flex items-center gap-1.5 text-[10px] text-white/45"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Entradas</span>
            <span className="flex items-center gap-1.5 text-[10px] text-white/45"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Saídas</span>
          </div>
        </Card>
      </div>

      {/* Por categoria */}
      <SectionLabel>Por categoria</SectionLabel>
      <div className="px-5">
        <Card className="p-4 space-y-3.5">
          {cats.map(c => {
            const pct = totalExp > 0 ? (c.value / totalExp) * 100 : 0;
            const Icon = c.Icon;
            return (
              <div key={c.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${c.color}22` }}>
                      {Icon && <Icon className="w-3.5 h-3.5" style={{ color: c.color }} />}
                    </span>
                    <span className="text-[13px] font-semibold truncate">{c.label}</span>
                  </div>
                  <span className="text-[12px] font-bold tabular-nums shrink-0">R$ {fmt(c.value)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
