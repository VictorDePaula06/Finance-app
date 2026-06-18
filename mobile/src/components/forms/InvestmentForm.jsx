import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Field, TextInput, SubmitBtn } from './fields.jsx';

const TYPES = [
  { value: 'renda_fixa', label: 'Renda Fixa' },
  { value: 'acoes', label: 'Ações' },
  { value: 'etfs', label: 'ETFs' },
  { value: 'fiis', label: 'FIIs' },
  { value: 'crypto', label: 'Cripto' },
];

const Pills = ({ options, value, onChange, cols = 3 }) => (
  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
    {options.map((o) => (
      <button key={o.value} type="button" onClick={() => onChange(o.value)}
        className={`py-2 rounded-xl text-[12px] font-bold border transition active:scale-95 ${value === o.value ? 'border-fg/30 bg-fg/[0.08] text-fg' : 'border-transparent bg-fg/[0.03] text-fg/55'}`}>
        {o.label}
      </button>
    ))}
  </div>
);

const numBR = (s) => parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0;

// Formulário de cadastro de investimento (grava na coleção 'investments').
export default function InvestmentForm({ onSubmit, onDone }) {
  const [type, setType] = useState('renda_fixa');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [manualCurrentPrice, setManualCurrentPrice] = useState('');
  const [totalApplied, setTotalApplied] = useState('');
  const [cdiPercent, setCdiPercent] = useState('100');
  const [isUSD, setIsUSD] = useState(false);
  const [saving, setSaving] = useState(false);

  const isRf = type === 'renda_fixa';
  const valid = name.trim() && (isRf ? numBR(totalApplied) > 0 : (symbol.trim() && numBR(quantity) > 0 && numBR(purchasePrice) > 0));

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    const ok = await onSubmit({
      type, name: name.trim(), symbol: symbol.trim(),
      quantity, purchasePrice, manualCurrentPrice,
      totalApplied: isRf ? totalApplied : '', cdiPercent: isRf ? cdiPercent : '',
      isUSD,
    });
    setSaving(false);
    if (ok) onDone(); else alert('Não foi possível salvar o investimento.');
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Tipo de ativo">
        <Pills options={TYPES} value={type} onChange={setType} cols={3} />
      </Field>

      <Field label="Nome">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={isRf ? 'Ex.: Tesouro Selic 2029' : 'Ex.: Bitcoin'} maxLength={50} autoFocus />
      </Field>

      {isRf ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor aplicado"><TextInput inputMode="decimal" value={totalApplied} onChange={(e) => setTotalApplied(e.target.value)} placeholder="5000" /></Field>
            <Field label="Valor atual" hint="Opcional"><TextInput inputMode="decimal" value={manualCurrentPrice} onChange={(e) => setManualCurrentPrice(e.target.value)} placeholder="igual" /></Field>
          </div>
          <Field label="% do CDI" hint="Opcional"><TextInput inputMode="decimal" value={cdiPercent} onChange={(e) => setCdiPercent(e.target.value)} placeholder="100" /></Field>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código (ticker)"><TextInput value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder={type === 'crypto' ? 'BTC' : 'BOVA11'} /></Field>
            <Field label="Quantidade"><TextInput inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="10" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço de compra"><TextInput inputMode="decimal" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="100" /></Field>
            <Field label="Preço atual" hint="Opcional / ao vivo"><TextInput inputMode="decimal" value={manualCurrentPrice} onChange={(e) => setManualCurrentPrice(e.target.value)} placeholder="auto" /></Field>
          </div>
          <button type="button" onClick={() => setIsUSD((v) => !v)}
            className={`w-full py-2.5 rounded-xl text-[12px] font-bold border transition ${isUSD ? 'border-info/40 bg-info/10 text-info' : 'border-fg/[0.08] bg-fg/[0.03] text-fg/55'}`}>
            {isUSD ? '✓ ' : ''}Preços em dólar (US$)
          </button>
        </>
      )}

      <SubmitBtn disabled={!valid || saving} tone="info">
        <Check className="w-4 h-4" /> {saving ? 'Salvando…' : 'Adicionar investimento'}
      </SubmitBtn>
    </form>
  );
}
