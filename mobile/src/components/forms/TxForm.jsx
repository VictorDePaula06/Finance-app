import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Field, TextInput, MoneyInput, DateInput, CategoryGrid, SubmitBtn } from './fields.jsx';
import { INCOME_CATS, EXPENSE_CATS, PRIORITY_META, defaultPriorityOf } from '../../lib/categories.js';

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
const PRIORITIES = ['essential', 'comfort', 'superfluous'];
const REPEAT_OPTS = [
  { value: 'once', label: 'À vista' },
  { value: 'installments', label: 'Parcelar' },
  { value: 'fixed', label: 'Fixa' },
];

const parseAmount = (s) => parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0;

// Botões de seleção em grade (genérico).
const PillGroup = ({ options, value, onChange, cols = 4 }) => (
  <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
    {options.map((o) => (
      <button key={o.value} type="button" onClick={() => onChange(o.value)}
        className={`py-2 rounded-xl text-[12px] font-bold border transition active:scale-95 ${
          value === o.value ? 'border-fg/30 bg-fg/[0.08] text-fg' : 'border-transparent bg-fg/[0.03] text-fg/55'
        }`}>
        {o.label}
      </button>
    ))}
  </div>
);

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
  const [priority, setPriority] = useState(defaultPriorityOf(cats[0].id));
  const [date, setDate] = useState(todayStr());
  const [pay, setPay] = useState(fixedCard ? 'credito' : 'pix');
  const [cardId, setCardId] = useState(fixedCard?.id || cards[0]?.id || '');
  const [repeat, setRepeat] = useState('once');
  const [installments, setInstallments] = useState('2');
  const [installmentMode, setInstallmentMode] = useState('total'); // 'total' | 'monthly'
  const [saving, setSaving] = useState(false);

  const usingCredit = !isIncome && pay === 'credito';
  const needsCardButNone = usingCredit && !fixedCard && cards.length === 0;
  // Despesa fixa não se aplica a crédito (a fatura cuida da recorrência).
  const repeatOpts = usingCredit ? REPEAT_OPTS.filter((o) => o.value !== 'fixed') : REPEAT_OPTS;
  const nInstallments = Math.max(2, Math.min(48, parseInt(installments) || 2));
  const valid = parseAmount(amount) > 0 && description.trim() && !needsCardButNone && (!usingCredit || cardId || fixedCard);

  // Ao trocar de categoria, ajusta a prioridade para o padrão dela.
  const pickCategory = (id) => { setCategory(id); setPriority(defaultPriorityOf(id)); };

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
      input.priority = priority;
      input.paymentMethod = pay;
      if (usingCredit) input.selectedCardId = fixedCard?.id || cardId;
      if (repeat === 'installments') { input.installments = nInstallments; input.installmentMode = installmentMode; }
      else if (repeat === 'fixed') input.isFixed = true;
    }
    const ok = await onSubmit(input);
    setSaving(false);
    if (ok) onDone();
    else alert('Não foi possível salvar. Verifique a conexão e tente de novo.');
  };

  const perParcela = installmentMode === 'total' ? parseAmount(amount) / nInstallments : parseAmount(amount);

  return (
    <form onSubmit={submit} className="space-y-4">
      <MoneyInput value={amount} onChange={setAmount} autoFocus />

      <Field label="Descrição">
        <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder={isIncome ? 'Ex.: Salário de junho' : 'Ex.: Mercado'} maxLength={80} />
      </Field>

      <Field label="Categoria">
        <CategoryGrid cats={cats} value={category} onChange={pickCategory} />
      </Field>

      {!isIncome && (
        <Field label="Prioridade" hint="Como esse gasto entra na sua análise (50/30/20).">
          <PillGroup cols={3} value={priority} onChange={setPriority}
            options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label }))} />
        </Field>
      )}

      {!isIncome && !fixedCard && (
        <Field label="Forma de pagamento">
          <PillGroup value={pay} onChange={setPay} options={PAY_OPTS} />
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
                <button key={c.id} type="button" onClick={() => setCardId(c.id)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition ${
                    cardId === c.id ? 'border-fg/30 bg-fg/[0.08]' : 'border-transparent bg-fg/[0.03]'
                  }`}>
                  <span className="text-[13px] font-semibold">{c.name}</span>
                  <span className="text-[11px] text-fg/40">•••• {c.last4 || '••••'}</span>
                </button>
              ))}
            </div>
          </Field>
        )
      )}

      {!isIncome && (
        <Field label="Repetição">
          <PillGroup cols={repeatOpts.length} value={repeat} onChange={setRepeat} options={repeatOpts} />
        </Field>
      )}

      {!isIncome && repeat === 'installments' && (
        <div className="rounded-2xl bg-fg/[0.03] border border-fg/[0.06] p-3.5 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-semibold text-fg/70 flex-1">Nº de parcelas</span>
            <input inputMode="numeric" value={installments}
              onChange={(e) => setInstallments(e.target.value.replace(/\D/g, '').slice(0, 2))}
              className="w-16 text-center rounded-xl bg-fg/[0.06] border border-fg/[0.1] px-2 py-2 text-[15px] font-bold outline-none" />
          </div>
          <PillGroup cols={2} value={installmentMode} onChange={setInstallmentMode}
            options={[{ value: 'total', label: 'Valor total' }, { value: 'monthly', label: 'Valor por mês' }]} />
          <p className="text-[11px] text-fg/45">
            {nInstallments}x de <span className="font-bold text-fg/70">R$ {perParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            {installmentMode === 'total' ? ' (divide o total)' : ' (cada mês)'}
          </p>
        </div>
      )}
      {!isIncome && repeat === 'fixed' && (
        <p className="text-[11px] text-fg/45 -mt-1">Será lançada nos próximos 12 meses (como conta fixa).</p>
      )}

      <Field label="Data">
        <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      <SubmitBtn disabled={!valid || saving} tone={isIncome ? 'pos' : 'neg'}>
        <Check className="w-4 h-4" /> {saving ? 'Salvando…' : isIncome ? 'Adicionar recebimento' : 'Adicionar lançamento'}
      </SubmitBtn>
    </form>
  );
}
