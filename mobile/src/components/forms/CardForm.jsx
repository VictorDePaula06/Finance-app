import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Field, TextInput, Select, SubmitBtn } from './fields.jsx';

const BRANDS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outro'];
const onlyDigits = (s, n) => String(s).replace(/\D/g, '').slice(0, n);

// Formulário de cadastro de cartão.
export default function CardForm({ onSubmit, onDone }) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('Visa');
  const [last4, setLast4] = useState('');
  const [dueDay, setDueDay] = useState('10');
  const [closingDay, setClosingDay] = useState('');
  const [limit, setLimit] = useState('');
  const [saving, setSaving] = useState(false);

  const valid = name.trim().length > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    const ok = await onSubmit({
      name: name.trim(),
      brand,
      last4,
      dueDay: parseInt(dueDay) || 10,
      closingDay: closingDay ? parseInt(closingDay) : '',
      limit: limit ? parseFloat(String(limit).replace(/\./g, '').replace(',', '.')) : '',
    });
    setSaving(false);
    if (ok) onDone();
    else alert('Não foi possível salvar o cartão. Tente de novo.');
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nome do cartão">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank" maxLength={40} autoFocus />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Bandeira">
          <Select value={brand} onChange={(e) => setBrand(e.target.value)}>
            {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
        </Field>
        <Field label="Final (4 díg.)">
          <TextInput inputMode="numeric" value={last4} onChange={(e) => setLast4(onlyDigits(e.target.value, 4))} placeholder="1234" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Vencimento (dia)">
          <TextInput inputMode="numeric" value={dueDay} onChange={(e) => setDueDay(onlyDigits(e.target.value, 2))} placeholder="10" />
        </Field>
        <Field label="Fechamento (dia)" hint="Opcional">
          <TextInput inputMode="numeric" value={closingDay} onChange={(e) => setClosingDay(onlyDigits(e.target.value, 2))} placeholder="auto" />
        </Field>
      </div>

      <Field label="Limite" hint="Opcional — usado para mostrar o uso da fatura">
        <TextInput inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="Ex.: 5000" />
      </Field>

      <SubmitBtn disabled={!valid || saving} tone="info">
        <Check className="w-4 h-4" /> {saving ? 'Salvando…' : 'Adicionar cartão'}
      </SubmitBtn>
    </form>
  );
}
