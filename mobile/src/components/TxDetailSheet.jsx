import React, { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import Sheet from './Sheet.jsx';
import { fmt } from '../lib/finance.js';
import { catMeta } from '../lib/categories.js';
import { useStore } from '../store.jsx';

const PAY_LABEL = { credito: 'Crédito', debito: 'Débito', pix: 'Pix', dinheiro: 'Dinheiro', boleto: 'Boleto' };

const DetailRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-fg/[0.05] last:border-0">
    <span className="text-[12px] text-fg/45">{label}</span>
    <span className="text-[13px] font-semibold text-right">{value}</span>
  </div>
);

// Detalhes de um lançamento + exclusão (confirmação dentro do app).
export default function TxDetailSheet({ tx, onClose }) {
  const { deleteTransaction, cards = [] } = useStore();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!tx) return null;
  const c = catMeta(tx.category);
  const Icon = c.Icon;
  const isIncome = tx.type === 'income';
  const amount = parseFloat(tx.amount) || 0;
  const dateLabel = tx.date
    ? new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';
  const cardName = tx.selectedCardId ? (cards.find((c) => c.id === tx.selectedCardId)?.name || 'Cartão') : null;
  const pay = cardName ? 'Crédito' : (PAY_LABEL[tx.paymentMethod] || null);

  const doDelete = async () => {
    setBusy(true);
    const ok = await deleteTransaction(tx.id);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Sheet title="Detalhes do lançamento" onClose={onClose}>
      {/* Resumo */}
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${c.color}22` }}>
          {Icon && <Icon className="w-6 h-6" style={{ color: c.color }} />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-bold truncate">{tx.description || c.label}</p>
          <p className="text-[12px] text-fg/45">{c.label}</p>
        </div>
        <span className={`text-[18px] font-extrabold tabular-nums shrink-0 ${isIncome ? 'text-pos' : 'text-neg'}`}>
          {isIncome ? '+' : '−'} R$ {fmt(amount)}
        </span>
      </div>

      {/* Campos */}
      <div className="mt-4 rounded-2xl bg-fg/[0.03] border border-fg/[0.05] px-4">
        <DetailRow label="Tipo" value={isIncome ? 'Recebimento' : 'Despesa'} />
        <DetailRow label="Categoria" value={c.label} />
        <DetailRow label="Data" value={dateLabel} />
        {pay && <DetailRow label="Forma de pagamento" value={pay} />}
        {cardName && <DetailRow label="Cartão" value={cardName} />}
        {tx.isFixed && <DetailRow label="Recorrência" value="Despesa fixa" />}
        {tx.invoiceStatus && <DetailRow label="Fatura" value={tx.invoiceStatus === 'paid' ? 'Paga' : 'Em aberto'} />}
      </div>

      {/* Exclusão */}
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="mt-5 w-full py-3.5 rounded-2xl border border-neg/25 text-neg font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition"
        >
          <Trash2 className="w-4 h-4" /> Excluir lançamento
        </button>
      ) : (
        <div className="mt-5 rounded-2xl bg-neg/[0.07] border border-neg/20 p-4">
          <p className="text-[13px] font-semibold flex items-center gap-2 text-neg">
            <AlertTriangle className="w-4 h-4 shrink-0" /> Excluir este lançamento?
          </p>
          <p className="text-[12px] text-fg/50 mt-1">Esta ação não pode ser desfeita.</p>
          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <button onClick={() => setConfirming(false)} disabled={busy} className="py-3 rounded-xl bg-fg/[0.06] text-fg/70 font-bold text-[13px] active:scale-95 transition">
              Cancelar
            </button>
            <button onClick={doDelete} disabled={busy} className="py-3 rounded-xl bg-rose-500 text-white font-bold text-[13px] active:scale-95 transition disabled:opacity-50">
              {busy ? 'Excluindo…' : 'Excluir'}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
