import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Field, TextInput, SubmitBtn } from './fields.jsx';
import { DEFAULT_HEALTH_CONFIG } from '../../lib/finance.js';

const num = (v, fb = 0) => { const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? fb : n; };

// Segmento de unidade (ex.: % / R$  ·  Meses / R$).
const UnitToggle = ({ value, onChange, options }) => (
  <div className="inline-flex rounded-lg p-0.5 bg-fg/[0.06] shrink-0">
    {options.map((o) => (
      <button key={o.id} type="button" onClick={() => onChange(o.id)}
        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${value === o.id ? 'bg-emerald-500 text-white' : 'text-fg/45'}`}>{o.short}</button>
    ))}
  </div>
);

// Campo de meta: rótulo + toggle de unidade + input.
const MetaField = ({ label, value, setValue, unit, setUnit, options }) => {
  const isMoney = unit === 'amount';
  const suffix = options.find(o => o.id === unit)?.suffix;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-fg/45">{label}</span>
        <UnitToggle value={unit} onChange={setUnit} options={options} />
      </div>
      <div className="flex items-center gap-1.5 rounded-xl bg-fg/[0.05] border border-fg/[0.08] px-3.5 py-3 focus-within:border-fg/25 transition">
        {isMoney && <span className="text-[14px] font-bold text-fg/40">R$</span>}
        <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9.,]/g, ''))}
          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] font-bold text-fg" placeholder="0" />
        {suffix && <span className="text-[11px] font-bold text-fg/40 shrink-0">{suffix}</span>}
      </div>
    </div>
  );
};

const BasisBtn = ({ active, onClick, title, desc }) => (
  <button type="button" onClick={onClick}
    className={`w-full flex items-start gap-2.5 p-3 rounded-xl border text-left transition active:scale-[0.99] ${active ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-fg/[0.08] bg-fg/[0.03]'}`}>
    <span className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 ${active ? 'border-emerald-500 bg-emerald-500' : 'border-fg/30'}`} />
    <span className="min-w-0"><span className="block text-[13px] font-bold">{title}</span><span className="block text-[11px] text-fg/45 leading-snug">{desc}</span></span>
  </button>
);

// Configurações da Alívia — mesmas do site (renda, regime, metas do Índice).
export default function AliviaConfigForm({ prefs, onSave, onDone }) {
  const mc = prefs?.manualConfig || {};
  const hc = { ...DEFAULT_HEALTH_CONFIG, ...(mc.healthConfig || {}) };

  const [income, setIncome] = useState(mc.income ? String(mc.income) : '');
  const [fixed, setFixed] = useState(mc.fixedExpenses ? String(mc.fixedExpenses) : '');
  const [basis, setBasis] = useState(prefs?.expenseBasis === 'caixa' ? 'caixa' : 'competencia');
  const [includeInvoice, setIncludeInvoice] = useState(!!hc.includeInvoice);

  const [surplusUnit, setSurplusUnit] = useState(hc.surplusUnit);
  const [surplusVal, setSurplusVal] = useState(String(hc.surplusUnit === 'amount' ? (hc.surplusTargetAmount || '') : hc.surplusTargetPct));
  const [reserveUnit, setReserveUnit] = useState(hc.reserveUnit);
  const [reserveVal, setReserveVal] = useState(String(hc.reserveUnit === 'amount' ? (hc.reserveTargetAmount || '') : hc.reserveTargetMonths));
  const [superUnit, setSuperUnit] = useState(hc.superfluousUnit);
  const [superVal, setSuperVal] = useState(String(hc.superfluousUnit === 'amount' ? (hc.superfluousCapAmount || '') : hc.superfluousCap));

  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const healthConfig = {
      ...hc,
      includeInvoice,
      surplusUnit,
      surplusTargetPct: surplusUnit === 'percent' ? Math.max(0, num(surplusVal, 20)) : hc.surplusTargetPct,
      surplusTargetAmount: surplusUnit === 'amount' ? Math.max(0, num(surplusVal, 0)) : hc.surplusTargetAmount,
      reserveUnit,
      reserveTargetMonths: reserveUnit === 'months' ? Math.max(1, num(reserveVal, 6)) : hc.reserveTargetMonths,
      reserveTargetAmount: reserveUnit === 'amount' ? Math.max(0, num(reserveVal, 0)) : hc.reserveTargetAmount,
      superfluousUnit: superUnit,
      superfluousCap: superUnit === 'percent' ? Math.max(1, num(superVal, 30)) : hc.superfluousCap,
      superfluousCapAmount: superUnit === 'amount' ? Math.max(0, num(superVal, 0)) : hc.superfluousCapAmount,
    };
    await onSave({
      expenseBasis: basis,
      manualConfig: { ...mc, income: num(income, mc.income || 0), fixedExpenses: num(fixed, mc.fixedExpenses || 0), healthConfig },
    });
    setSaving(false);
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Renda base mensal" hint="Usada quando não há recebimentos lançados no mês.">
        <div className="flex items-center gap-1.5 rounded-xl bg-fg/[0.05] border border-fg/[0.08] px-3.5 py-3 focus-within:border-fg/25 transition">
          <span className="text-[14px] font-bold text-fg/40">R$</span>
          <input inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0,00" className="flex-1 min-w-0 bg-transparent outline-none text-[15px] font-bold text-fg" />
        </div>
      </Field>

      <Field label="Gastos fixos estimados" hint="Base para a cobertura da reserva de emergência.">
        <div className="flex items-center gap-1.5 rounded-xl bg-fg/[0.05] border border-fg/[0.08] px-3.5 py-3 focus-within:border-fg/25 transition">
          <span className="text-[14px] font-bold text-fg/40">R$</span>
          <input inputMode="decimal" value={fixed} onChange={(e) => setFixed(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0,00" className="flex-1 min-w-0 bg-transparent outline-none text-[15px] font-bold text-fg" />
        </div>
      </Field>

      <div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-fg/45">Gastos no cartão de crédito</span>
        <p className="text-[11px] text-fg/40 mt-1 mb-2 leading-snug">Pix, débito e dinheiro sempre contam no mês do gasto. A escolha vale só para o cartão.</p>
        <div className="space-y-2">
          <BasisBtn active={basis === 'competencia'} onClick={() => setBasis('competencia')} title="No mês da compra" desc="A compra conta no mês em que você comprou." />
          <BasisBtn active={basis === 'caixa'} onClick={() => setBasis('caixa')} title="No mês que pago a fatura" desc="A compra conta no mês em que você paga a fatura." />
        </div>
      </div>

      <div className="space-y-3.5">
        <span className="text-[11px] font-bold uppercase tracking-widest text-fg/45">Metas do Índice de Saúde</span>
        <MetaField label="Meta de sobra" value={surplusVal} setValue={setSurplusVal} unit={surplusUnit} setUnit={setSurplusUnit}
          options={[{ id: 'percent', short: '%', suffix: '% da renda' }, { id: 'amount', short: 'R$', suffix: null }]} />
        <MetaField label="Reserva de emergência" value={reserveVal} setValue={setReserveVal} unit={reserveUnit} setUnit={setReserveUnit}
          options={[{ id: 'months', short: 'Meses', suffix: 'meses' }, { id: 'amount', short: 'R$', suffix: null }]} />
        <MetaField label="Teto de supérfluos" value={superVal} setValue={setSuperVal} unit={superUnit} setUnit={setSuperUnit}
          options={[{ id: 'percent', short: '%', suffix: '% da renda' }, { id: 'amount', short: 'R$', suffix: null }]} />
      </div>

      <button type="button" onClick={() => setIncludeInvoice(v => !v)}
        className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl bg-fg/[0.03] border border-fg/[0.06] active:scale-[0.99] transition">
        <span className="text-[13px] font-semibold text-left">Considerar fatura em aberto<span className="block text-[11px] text-fg/40 font-normal">Inclui a fatura do cartão no Índice.</span></span>
        <span className={`relative w-10 h-6 rounded-full transition shrink-0 ${includeInvoice ? 'bg-emerald-500' : 'bg-fg/15'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${includeInvoice ? 'left-[18px]' : 'left-0.5'}`} />
        </span>
      </button>

      <SubmitBtn disabled={saving} tone="pos">
        <Check className="w-4 h-4" /> {saving ? 'Salvando…' : 'Salvar configurações'}
      </SubmitBtn>
    </form>
  );
}
