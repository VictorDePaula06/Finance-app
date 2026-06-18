import React, { useState } from 'react';
import { Plus, TrendingDown } from 'lucide-react';
import { TabHeader, Card, Chip, TxRow, SectionLabel, fmt } from '../components/ui.jsx';
import { EXPENSES, CATS } from '../data/sample.js';

const FILTERS = ['Tudo', 'Fixas', 'Cartão', 'Pix'];

export default function LancamentosTab() {
  const [filter, setFilter] = useState('Tudo');

  const list = EXPENSES.filter(t => {
    if (filter === 'Tudo') return true;
    if (filter === 'Fixas') return t.fixed;
    if (filter === 'Cartão') return t.pay === 'Crédito';
    if (filter === 'Pix') return t.pay === 'Pix';
    return true;
  });
  const total = list.reduce((a, t) => a + t.amount, 0);

  return (
    <div className="pb-6">
      <TabHeader
        title="Lançamentos"
        subtitle="O que saiu da sua conta"
        right={(
          <button className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center active:scale-95 transition shadow-lg shadow-emerald-500/25">
            <Plus className="w-5 h-5 text-black" />
          </button>
        )}
      />

      <div className="px-5 flex gap-2 overflow-x-auto no-scrollbar mt-1">
        {FILTERS.map(f => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</Chip>)}
      </div>

      <div className="px-5 mt-5">
        <Card className="p-5 bg-gradient-to-br from-rose-500/15 via-card to-card border-rose-500/15">
          <div className="flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-rose-400" />
            <span className="text-[11px] uppercase tracking-widest text-white/40 font-bold">Total gasto</span>
          </div>
          <p className="text-[30px] font-extrabold tracking-tight text-rose-400 mt-1.5">R$ {fmt(total)}</p>
          <p className="text-[11px] text-white/40 mt-1">{list.length} lançamentos · {filter.toLowerCase()}</p>
        </Card>
      </div>

      <SectionLabel>Lançamentos</SectionLabel>
      <div className="px-5">
        <Card>
          {list.length === 0 ? (
            <p className="text-center text-[13px] text-white/40 py-8">Nenhum lançamento neste filtro.</p>
          ) : list.map((t, i) => (
            <TxRow
              key={t.id}
              cat={CATS[t.cat]}
              desc={t.desc}
              amount={t.amount}
              date={t.date}
              sub={`${CATS[t.cat]?.label} · ${t.pay}${t.fixed ? ' · Fixa' : ''}`}
              sign="−"
              color="#fb7185"
              last={i === list.length - 1}
            />
          ))}
        </Card>
      </div>
    </div>
  );
}
