import React, { useState, useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { TabHeader, Card, Chip, TxRow, SectionLabel } from '../components/ui.jsx';
import { useFinance } from '../hooks/useFinance.js';
import { fmt, fmtDay, txMonthKey } from '../lib/finance.js';
import { catMeta } from '../lib/categories.js';

const PERIODS = [
  { id: 'month', label: 'Este mês' },
  { id: 'all', label: 'Tudo' },
];

export default function RecebimentosTab() {
  const { transactions, monthKey } = useFinance();
  const [period, setPeriod] = useState('month');

  const list = useMemo(() => transactions
    .filter(t => t.type === 'income' && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category))
    .filter(t => period === 'all' || txMonthKey(t) === monthKey)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    [transactions, period, monthKey]);

  const total = list.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);

  return (
    <div className="pb-6">
      <TabHeader title="Recebimentos" subtitle="O que entrou na sua conta" />

      <div className="px-5 flex gap-2 mt-1">
        {PERIODS.map(p => <Chip key={p.id} active={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</Chip>)}
      </div>

      <div className="px-5 mt-5">
        <Card className="p-5 bg-gradient-to-br from-emerald-500/15 via-card to-card border-emerald-500/15">
          <div className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-pos" /><span className="text-[11px] uppercase tracking-widest text-fg/40 font-bold">Total recebido</span></div>
          <p className="text-[30px] font-extrabold tracking-tight text-pos mt-1.5">R$ {fmt(total)}</p>
          <p className="text-[11px] text-fg/40 mt-1">{list.length} {list.length === 1 ? 'recebimento' : 'recebimentos'}</p>
        </Card>
      </div>

      <SectionLabel>Lançamentos</SectionLabel>
      <div className="px-5">
        <Card>
          {list.length === 0 ? (
            <p className="text-center text-[13px] text-fg/40 py-10">Nenhum recebimento no período.</p>
          ) : list.map((t, i) => {
            const c = catMeta(t.category);
            return <TxRow key={t.id} cat={c} desc={t.description || c.label} amount={parseFloat(t.amount) || 0} date={fmtDay(t.date)} sub={c.label} sign="+" last={i === list.length - 1} />;
          })}
        </Card>
      </div>
    </div>
  );
}
