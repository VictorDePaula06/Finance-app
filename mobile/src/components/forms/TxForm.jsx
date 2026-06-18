import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Field, TextInput, MoneyInput, DateInput, CategoryGrid, SubmitBtn } from './fields.jsx';
import { INCOME_CATS, EXPENSE_CATS } from '../../lib/categories.js';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const PAY_OPTS = [
  { value: 'pix', label: 'Pix' },
  { value: 'debito', label: 'Débito' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'credito', label: 'Crédito' },
];

const parseAmount = (s) => parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0;

// Formulário de receita ou despesa.
// - kind: 'income' | 'expense'
// - cards: lista de cartões (para crédito)
// - fixedCard: se passado, força compra no crédito desse cartão (oculta seleção)
export default function TxForm({ kind, cards = [], fixedCard, onSubmit, onDone }) {
  const isIncome = kind === 'income';
  const cats = isIncome ? INCOME_CATS : EXPENSE_CATS;

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(cats[0].id);
  const [date, setDate] = useState(todayStr());
  const [pay, setPay] = useState(fixedCard ? 'credito' : 'pix');
  const [cardId, setCardId] = useState(fixedCard?.id || cards[0]?.id || '');
  const [saving, setSaving] = useState(false);

  const usingCredit = !isIncome && pay === 'credito';
  const needsCardButNone = usingCredit && !fixedCard && cards.length === 0;
  const valid = parseAmount(amount) > 0 && description.trim() && !needsCardButNone && (!usingCredit || cardId || fixedCard);

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    const input = {
      type: kind,
      amount: parseAmount(amount),
      description: description.trim(),
      category,
      date,
    };
    if (!isIncome) {
      input.paymentMethod = pay;
      if (usingCredit) input.selectedCardId = fixedCard?.id || cardId;
    }
    const ok = await onSubmit(input);
    setSaving(false);
    if (ok) onDone();
    else alert('Não foi possível salvar. Verifique a conexão e tente de novo.');
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <MoneyInput value={amount} onChange={setAmount} autoFocus />

      <Field label="Descrição">
        <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder={isIncome ? 'Ex.: Salário de junho' : 'Ex.: Mercado'} maxLength={80} />
      </Field>

      <Field label="Categoria">
        <CategoryGrid cats={cats} value={category} onChange={setCategory} />
      </Field>

      {!isIncome && !fixedCard && (
        <Field label="Forma de pagamento">
          <div className="grid grid-cols-4 gap-2">
            {PAY_OPTS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setPay(o.value)}
                className={`py-2 rounded-xl text-[12px] font-bold border transition active:scale-95 ${
                  pay === o.value ? 'border-fg/30 bg-fg/[0.08] text-fg' : 'border-transparent bg-fg/[0.03] text-fg/55'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Field>
      )}

      {usingCredit && !fixedCard && (
        needsCardButNone ? (
          <p className="text-[12px] text-warn bg-warn/10 border border-warn/20 rounded-xl px-3 py-2.5">
            Você ainda não tem cartões. Cadastre um cartão na aba Cartão para lançar no crédito.
          </p>
        ) : (
          <Field label="Cartão">
            <div className="flex flex-col gap-2">
              {cards.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCardId(c.id)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition ${
                    cardId === c.id ? 'border-fg/30 bg-fg/[0.08]' : 'border-transparent bg-fg/[0.03]'
                  }`}
                >
                  <span className="text-[13px] font-semibold">{c.name}</span>
                  <span className="text-[11px] text-fg/40">•••• {c.last4 || '••••'}</span>
                </button>
              ))}
            </div>
          </Field>
        )
      )}

      <Field label="Data">
        <DateInput value={date} onChange={(e) => setDate(e.target.value)} max={todayStr()} />
      </Field>

      <SubmitBtn disabled={!valid || saving} tone={isIncome ? 'pos' : 'neg'}>
        <Check className="w-4 h-4" /> {saving ? 'Salvando…' : isIncome ? 'Adicionar recebimento' : 'Adicionar lançamento'}
      </SubmitBtn>
    </form>
  );
}
