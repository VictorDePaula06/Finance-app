import React, { useMemo } from 'react';
import { TabHeader, Card, SectionLabel } from '../components/ui.jsx';
import { useFinance } from '../hooks/useFinance.js';
import { fmt, txMonthKey, isMonthlyExpenseTx, walletAffecting } from '../lib/finance.js';
import { catMeta } from '../lib/categories.js';

const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function AnalisesTab() {
  const { transactions, monthKey, basis } = useFinance();

  // Gastos do mês por categoria
  const { cats, totalExp } = useMemo(() => {
    const byCat = {};
    transactions.filter(t => isMonthlyExpenseTx(t, basis) && txMonthKey(t) === monthKey)
      .forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + (parseFloat(t.amount) || 0); });
    const cats = Object.entries(byCat).map(([k, v]) => ({ key: k, ...catMeta(k), value: v })).sort((a, b) => b.value - a.value);
    return { cats, totalExp: cats.reduce((a, c) => a + c.value, 0) };
  }, [transactions, monthKey, basis]);

  // Evolução: últimos 7 dias (entradas verde / saídas vermelho)
  const week = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setHours(0, 0, 0, 0); d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ key, label: DOW[d.getDay()], inc: 0, exp: 0 });
    }
    const idx = {}; days.forEach((b, i) => { idx[b.key] = i; });
    transactions.forEach(t => {
      if (!walletAffecting(t)) return;
      const k = String(t.date || '').slice(0, 10);
      const i = idx[k]; if (i == null) return;
      const v = parseFloat(t.amount) || 0;
      if (t.type === 'income') days[i].inc += v; else days[i].exp += v;
    });
    return days;
  }, [transactions]);
  const maxBar = Math.max(...week.map(w => Math.max(w.inc, w.exp)), 1);

  return (
    <div className="pb-6">
      <TabHeader title="Análises" subtitle="Para onde seu dinheiro vai" />

      <SectionLabel>Evolução · últimos 7 dias</SectionLabel>
      <div className="px-5">
        <Card className="p-4">
          <div className="flex items-end justify-between gap-2 h-36">
            {week.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div className="w-full flex items-end justify-center gap-1 h-full">
                  <div className="w-1/2 rounded-t-md bg-emerald-500" style={{ height: `${(w.inc / maxBar) * 100}%` }} />
                  <div className="w-1/2 rounded-t-md bg-rose-500" style={{ height: `${(w.exp / maxBar) * 100}%` }} />
                </div>
                <span className="text-[9px] text-white/35">{w.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 pl-1">
            <span className="flex items-center gap-1.5 text-[10px] text-white/45"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Entradas</span>
            <span className="flex items-center gap-1.5 text-[10px] text-white/45"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Saídas</span>
          </div>
        </Card>
      </div>

      <SectionLabel>Gastos do mês por categoria</SectionLabel>
      <div className="px-5">
        <Card className="p-4 space-y-3.5">
          {cats.length === 0 ? (
            <p className="text-center text-[13px] text-white/40 py-6">Sem gastos neste mês.</p>
          ) : cats.map(c => {
            const pct = totalExp > 0 ? (c.value / totalExp) * 100 : 0;
            const Icon = c.Icon;
            return (
              <div key={c.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${c.color}22` }}>{Icon && <Icon className="w-3.5 h-3.5" style={{ color: c.color }} />}</span>
                    <span className="text-[13px] font-semibold truncate">{c.label}</span>
                  </div>
                  <span className="text-[12px] font-bold tabular-nums shrink-0">R$ {fmt(c.value)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} /></div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
