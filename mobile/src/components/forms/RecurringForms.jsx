import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Field, TextInput, MoneyInput, Select, CategoryGrid, SubmitBtn } from './fields.jsx';
import { INCOME_CATS, EXPENSE_CATS, PRIORITY_META, defaultPriorityOf } from '../../lib/categories.js';

const PRIORITIES = ['essential', 'comfort', 'superfluous'];

const PillGroup = ({ options, value, onChange, cols = 3 }) => (
  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
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

const DayInput = ({ value, onChange }) => (
  <TextInput inputMode="numeric" value={value}
    onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="5" />
);

// Recebimento fixo (salário, aluguel recebido…) — coleção fixed_incomes.
export function FixedIncomeForm({ onSubmit, onDone }) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [day, setDay] = useState('5');
  const [category, setCategory] = useState('salary');
  const [saving, setSaving] = useState(false);
  const valid = name.trim() && value;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    const ok = await onSubmit({ name: name.trim(), value, day, category });
    setSaving(false);
    if (ok) onDone(); else alert('Não foi possível salvar. Tente de novo.');
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <MoneyInput value={value} onChange={setValue} autoFocus />
      <Field label="Nome"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Salário" maxLength={40} /></Field>
      <Field label="Categoria"><CategoryGrid cats={INCOME_CATS} value={category} onChange={setCategory} /></Field>
      <Field label="Dia do recebimento" hint="Dia do mês (1 a 31)."><DayInput value={day} onChange={setDay} /></Field>
      <SubmitBtn disabled={!valid || saving} tone="pos">
        <Check className="w-4 h-4" /> {saving ? 'Salvando…' : 'Salvar recebimento fixo'}
      </SubmitBtn>
    </form>
  );
}

// Conta fixa (aluguel, luz, internet…) — coleção fixed_expenses.
export function FixedExpenseForm({ onSubmit, onDone }) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [day, setDay] = useState('5');
  const [category, setCategory] = useState('housing');
  const [priority, setPriority] = useState(defaultPriorityOf('housing'));
  const [isVariable, setIsVariable] = useState(false);
  const [saving, setSaving] = useState(false);
  const valid = name.trim() && value;

  const pickCategory = (id) => { setCategory(id); setPriority(defaultPriorityOf(id)); };

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    const ok = await onSubmit({ name: name.trim(), value, day, category, priority, isVariable });
    setSaving(false);
    if (ok) onDone(); else alert('Não foi possível salvar. Tente de novo.');
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <MoneyInput value={value} onChange={setValue} autoFocus />
      <Field label="Nome"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Aluguel" maxLength={40} /></Field>
      <Field label="Categoria"><CategoryGrid cats={EXPENSE_CATS} value={category} onChange={pickCategory} /></Field>
      <Field label="Prioridade">
        <PillGroup value={priority} onChange={setPriority} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label }))} />
      </Field>
      <Field label="Dia do vencimento" hint="Dia do mês (1 a 31)."><DayInput value={day} onChange={setDay} /></Field>
      <button type="button" onClick={() => setIsVariable(v => !v)}
        className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl bg-fg/[0.03] border border-fg/[0.06] active:scale-[0.99] transition">
        <span className="text-[13px] font-semibold text-left">Valor variável<span className="block text-[11px] text-fg/40 font-normal">Conta que muda de valor todo mês (ex.: luz).</span></span>
        <span className={`relative w-10 h-6 rounded-full transition shrink-0 ${isVariable ? 'bg-emerald-500' : 'bg-fg/15'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${isVariable ? 'left-[18px]' : 'left-0.5'}`} />
        </span>
      </button>
      <SubmitBtn disabled={!valid || saving} tone="neg">
        <Check className="w-4 h-4" /> {saving ? 'Salvando…' : 'Salvar conta fixa'}
      </SubmitBtn>
    </form>
  );
}

// Assinatura recorrente de cartão (Netflix, Spotify…) — coleção subscriptions.
// `initial` pré-preenche o formulário para edição.
export function SubscriptionForm({ cards = [], initial = null, onSubmit, onDone }) {
  const [name, setName] = useState(initial?.name || '');
  const [value, setValue] = useState(initial?.value != null ? String(initial.value).replace('.', ',') : '');
  const [cardId, setCardId] = useState(initial?.cardId ?? (cards[0]?.id || ''));
  const [day, setDay] = useState(String(initial?.day || '10'));
  const [category, setCategory] = useState(initial?.category || 'subscriptions');
  const [priority, setPriority] = useState(initial?.priority || 'comfort');
  const [saving, setSaving] = useState(false);
  const valid = name.trim() && value;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    const ok = await onSubmit({ name: name.trim(), value, cardId, day, category, priority });
    setSaving(false);
    if (ok) onDone(); else alert('Não foi possível salvar. Tente de novo.');
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <MoneyInput value={value} onChange={setValue} autoFocus />
      <Field label="Nome"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Netflix" maxLength={40} /></Field>
      <Field label="Categoria"><CategoryGrid cats={EXPENSE_CATS} value={category} onChange={setCategory} /></Field>
      {cards.length > 0 && (
        <Field label="Cartão" hint="A cobrança entra na fatura desse cartão.">
          <Select value={cardId} onChange={(e) => setCardId(e.target.value)}>
            <option value="">Sem cartão</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{c.name} · •••• {c.last4 || '0000'}</option>)}
          </Select>
        </Field>
      )}
      {!cardId && (
        <Field label="Dia da cobrança" hint="Dia do mês (1 a 31).">
          <DayInput value={day} onChange={setDay} />
        </Field>
      )}
      <SubmitBtn disabled={!valid || saving} tone="info">
        <Check className="w-4 h-4" /> {saving ? 'Salvando…' : (initial ? 'Salvar alterações' : 'Salvar assinatura')}
      </SubmitBtn>
    </form>
  );
}
