import React, { useState } from 'react';
import { Plus, TrendingUp } from 'lucide-react';
import { TabHeader, Card, Chip, TxRow, SectionLabel, fmt } from '../components/ui.jsx';
import { INCOME, CATS } from '../data/sample.js';

const PERIODS = ['Este mês', '30 dias', 'Ano'];

export default function RecebimentosTab() {
  const [period, setPeriod] = useState('Este mês');
  const total = INCOME.reduce((a, t) => a + t.amount, 0);

  return (
    <div className="pb-6">
      <TabHeader
        title="Recebimentos"
        subtitle="O que entrou na sua conta"
        right={(
          <button className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center active:scale-95 transition shadow-lg shadow-emerald-500/25">
            <Plus className="w-5 h-5 text-black" />
          </button>
        )}
      />

      {/* Filtro de período */}
      <div className="px-5 flex gap-2 overflow-x-auto no-scrollbar mt-1">
        {PERIODS.map(p => <Chip key={p} active={period === p} onClick={() => setPeriod(p)}>{p}</Chip>)}
      </div>

      {/* Total */}
      <div className="px-5 mt-5">
        <Card className="p-5 bg-gradient-to-br from-emerald-500/15 via-card to-card border-emerald-500/15">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] uppercase tracking-widest text-white/40 font-bold">Total recebido</span>
          </div>
          <p className="text-[30px] font-extrabold tracking-tight text-emerald-400 mt-1.5">R$ {fmt(total)}</p>
          <p className="text-[11px] text-white/40 mt-1">{INCOME.length} recebimentos em {period.toLowerCase()}</p>
        </Card>
      </div>

      {/* Lista */}
      <SectionLabel>Lançamentos</SectionLabel>
      <div className="px-5">
        <Card>
          {INCOME.map((t, i) => (
            <TxRow
              key={t.id}
              cat={CATS[t.cat]}
              desc={t.desc}
              amount={t.amount}
              date={t.date}
              sub={CATS[t.cat]?.label}
              sign="+"
              color="#34d399"
              last={i === INCOME.length - 1}
            />
          ))}
        </Card>
      </div>
    </div>
  );
}
