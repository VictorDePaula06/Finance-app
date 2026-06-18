import React, { useState, useMemo } from 'react';
import { TrendingDown } from 'lucide-react';
import { TabHeader, Card, Chip, TxRow, SectionLabel } from '../components/ui.jsx';
import { useFinance } from '../hooks/useFinance.js';
import { fmt, fmtDay, txMonthKey, isMonthlyExpenseTx } from '../lib/finance.js';
import { catMeta } from '../lib/categories.js';

const FILTERS = ['Tudo', 'Fixas', 'Cartão', 'Pix'];
const PAY_LABEL = { credito: 'Crédito', debito: 'Débito', pix: 'Pix', dinheiro: 'Dinheiro', boleto: 'Boleto' };

export default function LancamentosTab() {
  const { transactions, monthKey, basis } = useFinance();
  const [filter, setFilter] = useState('Tudo');

  const monthExpenses = useMemo(() => transactions
    .filter(t => isMonthlyExpenseTx(t, basis) && txMonthKey(t) === monthKey)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    [transactions, monthKey, basis]);

  const list = monthExpenses.filter(t => {
    if (filter === 'Tudo') return true;
    if (filter === 'Fixas') return t.isFixed;
    if (filter === 'Cartão') return t.paymentMethod === 'credito';
    if (filter === 'Pix') return t.paymentMethod === 'pix';
    return true;
  });
  const total = list.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);

  return (
    <div className="pb-6">
      <TabHeader title="Lançamentos" subtitle="O que saiu este mês" />

      <div className="px-5 flex gap-2 overflow-x-auto no-scrollbar mt-1">
        {FILTERS.map(f => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</Chip>)}
      </div>

      <div className="px-5 mt-5">
        <Card className="p-5 bg-gradient-to-br from-rose-500/15 via-card to-card border-rose-500/15">
          <div className="flex items-center gap-1.5"><TrendingDown className="w-4 h-4 text-rose-400" /><span className="text-[11px] uppercase tracking-widest text-fg/40 font-bold">Total gasto</span></div>
          <p className="text-[30px] font-extrabold tracking-tight text-rose-400 mt-1.5">R$ {fmt(total)}</p>
          <p className="text-[11px] text-fg/40 mt-1">{list.length} {list.length === 1 ? 'lançamento' : 'lançamentos'} · {filter.toLowerCase()}</p>
        </Card>
      </div>

      <SectionLabel>Lançamentos</SectionLabel>
      <div className="px-5">
        <Card>
          {list.length === 0 ? (
            <p className="text-center text-[13px] text-fg/40 py-10">Nenhum lançamento neste filtro.</p>
          ) : list.map((t, i) => {
            const c = catMeta(t.category);
            const pay = PAY_LABEL[t.paymentMethod] || '';
            const sub = [c.label, pay, t.isFixed ? 'Fixa' : null].filter(Boolean).join(' · ');
            return <TxRow key={t.id} cat={c} desc={t.description || c.label} amount={parseFloat(t.amount) || 0} date={fmtDay(t.date)} sub={sub} sign="−" color="#fb7185" last={i === list.length - 1} />;
          })}
        </Card>
      </div>
    </div>
  );
}
