import React, { useState, useMemo } from 'react';
import { CreditCard, CheckCircle2 } from 'lucide-react';
import { TabHeader, Card, SectionLabel, TxRow } from '../components/ui.jsx';
import { useFinance } from '../hooks/useFinance.js';
import { fmt, fmtDay } from '../lib/finance.js';
import { catMeta } from '../lib/categories.js';

export default function CartaoTab() {
  const { cards, subscriptions, transactions } = useFinance();
  const [sel, setSel] = useState(0);
  const card = cards[sel] || cards[0];

  const stats = useMemo(() => {
    if (!card) return null;
    const unpaid = transactions.filter(t => t.selectedCardId === card.id && t.invoiceStatus === 'unpaid');
    const subs = subscriptions.filter(s => s.cardId === card.id);
    const invoice = unpaid.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const limit = parseFloat(card.limit) || 0;
    const usagePct = limit > 0 ? Math.min(100, (invoice / limit) * 100) : 0;
    const items = [
      ...unpaid.map(t => ({ id: t.id, desc: t.description || 'Compra', cat: t.category, amount: parseFloat(t.amount) || 0, date: fmtDay(t.date), badge: t.installmentInfo })),
      ...subs.map(s => ({ id: s.id, desc: s.name, cat: s.category, amount: parseFloat(s.value) || 0, date: '', badge: s.type === 'installment' ? `${s.currentInstallment || 1}/${s.totalInstallments || 1}` : 'Assinatura' })),
    ];
    return { invoice, limit, usagePct, available: Math.max(0, limit - invoice), items };
  }, [card, transactions, subscriptions]);

  if (!card) {
    return (
      <div>
        <TabHeader title="Cartões" subtitle="Faturas, parcelas e assinaturas" />
        <div className="px-5 mt-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-3xl bg-fg/[0.05] border border-fg/[0.06] flex items-center justify-center mb-4"><CreditCard className="w-7 h-7 text-fg/40" /></div>
          <p className="text-[14px] font-bold">Nenhum cartão cadastrado</p>
          <p className="text-[12px] text-fg/40 mt-1">Cadastre um cartão no site para acompanhar a fatura aqui.</p>
        </div>
      </div>
    );
  }

  const usageColor = stats.usagePct >= 80 ? '#f43f5e' : stats.usagePct >= 50 ? '#f59e0b' : '#10b981';

  return (
    <div className="pb-6">
      <TabHeader title="Cartões" subtitle="Faturas, parcelas e assinaturas" />

      {/* Seletor (se mais de um) */}
      {cards.length > 1 && (
        <div className="px-5 flex gap-2 overflow-x-auto no-scrollbar mt-1">
          {cards.map((c, i) => (
            <button key={c.id} onClick={() => setSel(i)} className={`shrink-0 px-4 py-1.5 rounded-full text-[12px] font-semibold transition ${i === sel ? 'bg-fg text-ink' : 'bg-fg/[0.06] text-fg/55'}`}>{c.name}</button>
          ))}
        </div>
      )}

      {/* Cartão visual */}
      <div className="px-5 mt-3">
        <div className="rounded-3xl p-5 h-44 flex flex-col justify-between bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 shadow-xl shadow-violet-900/30">
          <div className="flex items-start justify-between"><span className="text-[15px] font-extrabold">{card.name}</span><span className="text-[11px] font-semibold text-fg/70">{card.brand || ''}</span></div>
          <div className="text-[16px] font-semibold tracking-[0.25em] text-fg/90">•••• {card.last4 || '••••'}</div>
          <div className="flex items-end justify-between"><span className="text-[11px] font-medium text-fg/70 tracking-wide truncate">{card.holder || ''}</span><span className="text-[10px] font-semibold text-fg/60">VENC · DIA {card.dueDay || 10}</span></div>
        </div>
      </div>

      {/* Fatura */}
      <div className="px-5 mt-4">
        <Card className="p-5">
          <span className="text-[11px] uppercase tracking-widest text-fg/40 font-bold">Fatura em aberto</span>
          <p className="text-[30px] font-extrabold tracking-tight text-warn mt-1.5">R$ {fmt(stats.invoice)}</p>
          <p className="text-[11px] text-fg/40 mt-1">vence dia {card.dueDay || 10}</p>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5"><span className="text-[10px] uppercase tracking-widest text-fg/40 font-bold">Uso do limite</span><span className="text-[11px] font-black" style={{ color: usageColor }}>{stats.limit > 0 ? `${Math.round(stats.usagePct)}%` : '—'}</span></div>
            <div className="h-2 rounded-full bg-fg/[0.08] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${stats.limit > 0 ? stats.usagePct : 0}%`, background: usageColor }} /></div>
            <div className="flex items-center justify-between mt-1.5"><span className="text-[10px] text-fg/35">R$ {fmt(stats.invoice)} usado</span><span className="text-[10px] text-fg/35">{stats.limit > 0 ? `Limite R$ ${fmt(stats.limit)}` : 'sem limite definido'}</span></div>
          </div>
          {stats.invoice > 0.005 && (
            <button className="mt-4 w-full py-3 rounded-xl bg-emerald-500 text-black font-bold text-[13px] flex items-center justify-center gap-2 active:scale-95 transition"><CheckCircle2 className="w-4 h-4" /> Registrar pagamento</button>
          )}
        </Card>
      </div>

      {/* Lançamentos da fatura */}
      <SectionLabel>Lançamentos da fatura</SectionLabel>
      <div className="px-5">
        <Card>
          {stats.items.length === 0 ? (
            <p className="text-center text-[13px] text-fg/40 py-8">Sem lançamentos nesta fatura.</p>
          ) : stats.items.map((it, i) => {
            const c = catMeta(it.cat);
            return <TxRow key={it.id} cat={c} desc={it.desc} amount={it.amount} date={it.date || it.badge || c.label} sub={it.date ? (it.badge || c.label) : ''} sign="−" last={i === stats.items.length - 1} />;
          })}
        </Card>
      </div>
    </div>
  );
}
