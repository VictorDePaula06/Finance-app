import React, { useState, useMemo } from 'react';
import { CreditCard, Plus, ShoppingBag, Repeat, Trash2, AlertTriangle, CheckCircle2, Wallet } from 'lucide-react';
import { TabHeader, Card, SectionLabel, TxRow } from '../components/ui.jsx';
import Sheet from '../components/Sheet.jsx';
import CardForm from '../components/forms/CardForm.jsx';
import TxForm from '../components/forms/TxForm.jsx';
import { SubscriptionForm } from '../components/forms/RecurringForms.jsx';
import TxDetailSheet from '../components/TxDetailSheet.jsx';
import { useFinance } from '../hooks/useFinance.js';
import { useStore } from '../store.jsx';
import { fmt, fmtDay, computeCardInvoice } from '../lib/finance.js';
import { cardGradient } from '../lib/cardColors.js';
import { catMeta } from '../lib/categories.js';

const AddBtn = ({ onClick, label = 'Adicionar' }) => (
  <button onClick={onClick} aria-label={label} className="w-9 h-9 rounded-full bg-info/15 text-info flex items-center justify-center active:scale-90 transition shrink-0">
    <Plus className="w-5 h-5" />
  </button>
);

export default function CartaoTab() {
  const { cards, subscriptions, transactions } = useFinance();
  const { addCard, addTransaction, deleteCard, addSubscription, deleteSubscription, updateSubscription, payCardInvoice } = useStore();
  const [sel, setSel] = useState(0);
  const [sheet, setSheet] = useState(null); // 'newCard' | 'launch' | 'compra' | 'assinatura' | 'pay'
  const [detail, setDetail] = useState(null);
  const [editSub, setEditSub] = useState(null);
  const [confirmSub, setConfirmSub] = useState(false);
  const [confirmCard, setConfirmCard] = useState(false);
  const [paying, setPaying] = useState(false);
  const card = cards[sel] || cards[0];

  const doDeleteCard = () => {
    if (!card) return;
    deleteCard(card.id);
    setConfirmCard(false);
    setSel(0);
  };

  const doPayInvoice = async () => {
    if (!card || paying) return;
    setPaying(true);
    await payCardInvoice(card);
    setPaying(false);
    setSheet(null);
  };

  const stats = useMemo(() => {
    if (!card) return null;
    // Mesma fatura da Visão Geral / web: compras não pagas + assinaturas da fatura
    // corrente (janela pelo dia de fechamento).
    const { total: invoice, unpaid, subs } = computeCardInvoice(card, subscriptions, transactions);
    const limit = parseFloat(card.limit) || 0;
    const usagePct = limit > 0 ? Math.min(100, (invoice / limit) * 100) : 0;
    // Separa a fatura em 3 grupos: compras avulsas, parcelamentos e assinaturas.
    const lancamentos = [], parcelas = [], assinaturas = [];
    unpaid.forEach(t => {
      const it = { id: t.id, isTx: true, raw: t, desc: t.description || 'Compra', cat: t.category, amount: parseFloat(t.amount) || 0, date: fmtDay(t.date), badge: t.installmentInfo };
      (t.installmentInfo ? parcelas : lancamentos).push(it);
    });
    subs.forEach(s => {
      const isInst = s.type === 'installment';
      const it = { id: s.id, isTx: false, sub: s, editable: !isInst, desc: s.name, cat: s.category, amount: parseFloat(s.value) || 0, date: '', badge: isInst ? `${s.currentInstallment || 1}/${s.totalInstallments || 1}` : 'Assinatura' };
      (isInst ? parcelas : assinaturas).push(it);
    });
    const mkGroup = (key, label, arr) => ({ key, label, items: arr, total: arr.reduce((a, x) => a + x.amount, 0) });
    const groups = [
      mkGroup('lancamentos', 'Lançamentos', lancamentos),
      mkGroup('parcelas', 'Parcelamentos', parcelas),
      mkGroup('assinaturas', 'Assinaturas', assinaturas),
    ].filter(g => g.items.length > 0);
    return { invoice, limit, usagePct, available: Math.max(0, limit - invoice), groups, itemCount: lancamentos.length + parcelas.length + assinaturas.length };
  }, [card, transactions, subscriptions]);

  if (!card) {
    return (
      <div>
        <TabHeader title="Cartões" subtitle="Faturas, parcelas e assinaturas" />
        <div className="px-5 mt-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-3xl bg-fg/[0.05] border border-fg/[0.06] flex items-center justify-center mb-4"><CreditCard className="w-7 h-7 text-fg/40" /></div>
          <p className="text-[14px] font-bold">Nenhum cartão cadastrado</p>
          <p className="text-[12px] text-fg/40 mt-1 max-w-[240px]">Cadastre um cartão para acompanhar a fatura e lançar compras no crédito.</p>
          <button onClick={() => setSheet('newCard')} className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-info text-white font-bold text-[13px] active:scale-95 transition">
            <Plus className="w-4 h-4" /> Cadastrar cartão
          </button>
        </div>

        {sheet === 'newCard' && (
          <Sheet title="Novo cartão" onClose={() => setSheet(null)}>
            <CardForm onSubmit={addCard} onDone={() => setSheet(null)} />
          </Sheet>
        )}
      </div>
    );
  }

  const usageColor = stats.usagePct >= 80 ? '#f43f5e' : stats.usagePct >= 50 ? '#f59e0b' : '#10b981';
  const hasInvoice = stats.invoice > 0.005;

  return (
    <div className="pb-6">
      <TabHeader title="Cartões" subtitle="Faturas, parcelas e assinaturas" right={<AddBtn onClick={() => setSheet('launch')} label="Lançar no cartão" />} />

      {/* Seletor de cartões + botão de novo cartão ao lado */}
      <div className="px-5 mt-1 flex gap-2 overflow-x-auto no-scrollbar items-center">
        {cards.length > 1 && cards.map((c, i) => (
          <button key={c.id} onClick={() => setSel(i)} className={`shrink-0 px-4 py-1.5 rounded-full text-[12px] font-semibold transition ${i === sel ? 'bg-fg text-ink' : 'bg-fg/[0.06] text-fg/55'}`}>{c.name}</button>
        ))}
        <button onClick={() => setSheet('newCard')} className="shrink-0 inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-info/12 text-info border border-info/20 active:scale-95 transition">
          <Plus className="w-3.5 h-3.5" /> Novo cartão
        </button>
      </div>

      {/* Cartão: cor fiel ao cadastrado + FATURA e PAGAR no centro */}
      <div className="px-5 mt-3">
        <div className={`rounded-3xl px-5 pt-4 pb-5 flex flex-col bg-gradient-to-br ${cardGradient(card.color)} shadow-xl shadow-black/30 text-white`}>
          <div className="flex items-start justify-between">
            <span className="text-[15px] font-extrabold">{card.name}</span>
            <span className="text-[11px] font-semibold text-white/70">{card.brand || ''}</span>
          </div>

          {/* Centro: fatura em aberto + pagar */}
          <div className="flex flex-col items-center text-center py-5">
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold">Fatura em aberto</span>
            <p className="text-[34px] leading-none font-extrabold tracking-tight mt-1.5">R$ {fmt(stats.invoice)}</p>
            {hasInvoice ? (
              <>
                <span className="text-[10px] text-white/60 mt-1.5">vence dia {card.dueDay || 10}</span>
                <button onClick={() => setSheet('pay')} className="mt-3 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white/20 hover:bg-white/25 backdrop-blur border border-white/25 text-white text-[13px] font-bold active:scale-95 transition">
                  <Wallet className="w-4 h-4" /> Pagar fatura
                </button>
              </>
            ) : (
              <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-white/80"><CheckCircle2 className="w-3.5 h-3.5" /> Tudo em dia</span>
            )}
          </div>

          <div className="flex items-end justify-between">
            <span className="text-[15px] font-semibold tracking-[0.22em] text-white/90">•••• {card.last4 || '••••'}</span>
            <span className="text-[10px] font-semibold text-white/60">VENC · DIA {card.dueDay || 10}</span>
          </div>
        </div>
      </div>

      {/* Uso do limite (compacto) */}
      <div className="px-5 mt-3">
        <div className="rounded-2xl bg-card border border-fg/[0.05] p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-widest text-fg/40 font-bold">Uso do limite</span>
            <span className="text-[11px] font-black" style={{ color: usageColor }}>{stats.limit > 0 ? `${Math.round(stats.usagePct)}%` : '—'}</span>
          </div>
          <div className="h-2 rounded-full bg-fg/[0.08] overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${stats.limit > 0 ? stats.usagePct : 0}%`, background: usageColor }} /></div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-fg/35">R$ {fmt(stats.invoice)} usado</span>
            <span className="text-[10px] text-fg/35">{stats.limit > 0 ? `Disponível R$ ${fmt(stats.available)}` : 'sem limite definido'}</span>
          </div>
        </div>
      </div>

      {/* Lançamentos da fatura — divididos por tipo, com total em cada um */}
      <SectionLabel>Lançamentos da fatura</SectionLabel>
      <div className="px-5 space-y-4">
        {stats.itemCount === 0 ? (
          <Card><p className="text-center text-[13px] text-fg/40 py-8">Sem lançamentos nesta fatura.</p></Card>
        ) : stats.groups.map((g) => (
          <div key={g.key}>
            <div className="flex items-center justify-between px-1 mb-1.5">
              <span className="text-[11px] font-black uppercase tracking-widest text-fg/45">{g.label}</span>
              <span className="text-[11px] font-bold text-warn tabular-nums">R$ {fmt(g.total)}</span>
            </div>
            <Card>
              {g.items.map((it, i) => {
                const c = catMeta(it.cat);
                const onPress = it.isTx ? () => setDetail(it.raw) : (it.editable ? () => { setConfirmSub(false); setEditSub(it.sub); } : undefined);
                const subText = it.isTx ? (it.badge || c.label) : (it.editable ? 'Toque para editar' : c.label);
                return <TxRow key={it.id} cat={c} desc={it.desc} amount={it.amount} date={it.date || it.badge || c.label} sub={subText} sign="−" onPress={onPress} last={i === g.items.length - 1} />;
              })}
            </Card>
          </div>
        ))}
      </div>

      {/* Excluir cartão (confirmação dentro do app) */}
      <div className="px-5 mt-6">
        {!confirmCard ? (
          <button onClick={() => setConfirmCard(true)} className="w-full py-3 rounded-xl border border-neg/25 text-neg font-bold text-[13px] flex items-center justify-center gap-2 active:scale-[0.98] transition">
            <Trash2 className="w-4 h-4" /> Excluir cartão
          </button>
        ) : (
          <div className="rounded-2xl bg-neg/[0.07] border border-neg/20 p-4">
            <p className="text-[13px] font-semibold flex items-center gap-2 text-neg"><AlertTriangle className="w-4 h-4 shrink-0" /> Excluir o cartão "{card.name}"?</p>
            <p className="text-[12px] text-fg/50 mt-1">As compras em aberto deste cartão também serão removidas.</p>
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <button onClick={() => setConfirmCard(false)} className="py-3 rounded-xl bg-fg/[0.06] text-fg/70 font-bold text-[13px] active:scale-95 transition">Cancelar</button>
              <button onClick={doDeleteCard} className="py-3 rounded-xl bg-rose-500 text-white font-bold text-[13px] active:scale-95 transition">Excluir</button>
            </div>
          </div>
        )}
      </div>

      {/* ---- Sheets ---- */}
      {sheet === 'newCard' && (
        <Sheet title="Novo cartão" onClose={() => setSheet(null)}>
          <CardForm onSubmit={addCard} onDone={() => setSheet(null)} />
        </Sheet>
      )}

      {sheet === 'launch' && (
        <Sheet title="Lançar no cartão" subtitle={card.name} onClose={() => setSheet(null)}>
          <div className="space-y-3">
            <button onClick={() => setSheet('compra')} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-fg/[0.04] border border-fg/[0.08] text-left active:scale-[0.99] transition">
              <span className="w-11 h-11 rounded-2xl bg-info/15 flex items-center justify-center shrink-0"><ShoppingBag className="w-5 h-5 text-info" /></span>
              <span className="min-w-0"><span className="block text-[14px] font-bold">Compra no cartão</span><span className="block text-[12px] text-fg/45">Um gasto no crédito (à vista ou parcelado).</span></span>
            </button>
            <button onClick={() => setSheet('assinatura')} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-fg/[0.04] border border-fg/[0.08] text-left active:scale-[0.99] transition">
              <span className="w-11 h-11 rounded-2xl bg-info/15 flex items-center justify-center shrink-0"><Repeat className="w-5 h-5 text-info" /></span>
              <span className="min-w-0"><span className="block text-[14px] font-bold">Assinatura</span><span className="block text-[12px] text-fg/45">Cobrança recorrente (Netflix, Spotify…).</span></span>
            </button>
          </div>
        </Sheet>
      )}

      {sheet === 'compra' && (
        <Sheet title="Compra no cartão" subtitle={`No cartão ${card.name}`} onClose={() => setSheet(null)}>
          <TxForm kind="expense" fixedCard={card} onSubmit={addTransaction} onDone={() => setSheet(null)} />
        </Sheet>
      )}

      {sheet === 'assinatura' && (
        <Sheet title="Nova assinatura" subtitle={`No cartão ${card.name}`} onClose={() => setSheet(null)}>
          <SubscriptionForm cards={[card, ...cards.filter(c => c.id !== card.id)]} onSubmit={addSubscription} onDone={() => setSheet(null)} />
        </Sheet>
      )}

      {sheet === 'pay' && (
        <Sheet title="Pagar fatura" subtitle={card.name} onClose={() => setSheet(null)}>
          <div className="space-y-4">
            <div className="rounded-2xl bg-fg/[0.04] border border-fg/[0.08] p-5 text-center">
              <span className="text-[11px] uppercase tracking-widest text-fg/40 font-bold">Total da fatura</span>
              <p className="text-[30px] font-extrabold tracking-tight text-warn mt-1.5">R$ {fmt(stats.invoice)}</p>
              <p className="text-[11px] text-fg/40 mt-1">{stats.itemCount} {stats.itemCount === 1 ? 'item' : 'itens'} · vence dia {card.dueDay || 10}</p>
            </div>
            <p className="text-[12px] text-fg/50 leading-snug">Isso registra um pagamento de <span className="font-bold text-fg/70">R$ {fmt(stats.invoice)}</span> (sai da carteira), marca as compras como pagas e avança as assinaturas/parcelas do mês.</p>
            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => setSheet(null)} className="py-3.5 rounded-2xl bg-fg/[0.06] text-fg/70 font-bold text-[14px] active:scale-95 transition">Cancelar</button>
              <button onClick={doPayInvoice} disabled={paying} className="py-3.5 rounded-2xl bg-emerald-500 text-white font-extrabold text-[14px] flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50">
                <CheckCircle2 className="w-4 h-4" /> {paying ? 'Pagando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </Sheet>
      )}

      {editSub && (
        <Sheet title="Editar assinatura" subtitle={editSub.name} onClose={() => setEditSub(null)}>
          <SubscriptionForm
            cards={[card, ...cards.filter(c => c.id !== card.id)]}
            initial={editSub}
            onSubmit={(input) => updateSubscription(editSub.id, input)}
            onDone={() => setEditSub(null)}
          />
          <div className="mt-3">
            {!confirmSub ? (
              <button onClick={() => setConfirmSub(true)} className="w-full py-3 rounded-xl border border-neg/25 text-neg font-bold text-[13px] flex items-center justify-center gap-2 active:scale-[0.98] transition">
                <Trash2 className="w-4 h-4" /> Excluir assinatura
              </button>
            ) : (
              <div className="rounded-2xl bg-neg/[0.07] border border-neg/20 p-4">
                <p className="text-[13px] font-semibold flex items-center gap-2 text-neg"><AlertTriangle className="w-4 h-4 shrink-0" /> Excluir "{editSub.name}"?</p>
                <div className="grid grid-cols-2 gap-2.5 mt-3">
                  <button onClick={() => setConfirmSub(false)} className="py-3 rounded-xl bg-fg/[0.06] text-fg/70 font-bold text-[13px]">Cancelar</button>
                  <button onClick={async () => { await deleteSubscription(editSub.id); setEditSub(null); }} className="py-3 rounded-xl bg-rose-500 text-white font-bold text-[13px]">Excluir</button>
                </div>
              </div>
            )}
          </div>
        </Sheet>
      )}
      {detail && <TxDetailSheet tx={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
