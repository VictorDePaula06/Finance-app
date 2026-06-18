import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Field, TextInput, MoneyInput, SubmitBtn } from './fields.jsx';

const numBR = (s) => parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0;

// Formulário de criação de reserva/cofre (coleção 'savings_jars').
export default function JarForm({ onSubmit, onDone }) {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [cdiPercent, setCdiPercent] = useState('100');
  const [saving, setSaving] = useState(false);

  const valid = name.trim().length > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    const ok = await onSubmit({ name: name.trim(), balance, cdiPercent });
    setSaving(false);
    if (ok) onDone(); else alert('Não foi possível salvar a reserva.');
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Valor inicial">
        <MoneyInput value={balance} onChange={setBalance} autoFocus />
      </Field>
      <Field label="Nome da reserva">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Reserva de emergência" maxLength={40} />
      </Field>
      <Field label="% do CDI" hint="Rendimento do cofre (ex.: 100)">
        <TextInput inputMode="decimal" value={cdiPercent} onChange={(e) => setCdiPercent(e.target.value)} placeholder="100" />
      </Field>
      <SubmitBtn disabled={!valid || saving} tone="pos">
        <Check className="w-4 h-4" /> {saving ? 'Salvando…' : 'Criar reserva'}
      </SubmitBtn>
    </form>
  );
}
