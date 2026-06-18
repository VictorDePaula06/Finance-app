import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { SubmitBtn } from './fields.jsx';
import { REBAL_CLASSES } from '../../lib/patrimonio.js';

// Define a alocação-alvo (% por classe) → grava em prefs.rebalanceTargets.
export default function RebalanceForm({ initial = {}, onSubmit, onDone }) {
  const [vals, setVals] = useState(() => {
    const o = {};
    REBAL_CLASSES.forEach((c) => { o[c.id] = initial[c.id] != null ? String(initial[c.id]) : ''; });
    return o;
  });
  const [saving, setSaving] = useState(false);

  const total = REBAL_CLASSES.reduce((a, c) => a + (parseFloat(vals[c.id]) || 0), 0);
  const valid = total > 0;

  const setVal = (id, v) => setVals((p) => ({ ...p, [id]: v.replace(/[^0-9]/g, '').slice(0, 3) }));

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    const targets = {};
    REBAL_CLASSES.forEach((c) => { targets[c.id] = parseFloat(vals[c.id]) || 0; });
    const ok = await onSubmit(targets);
    setSaving(false);
    if (ok) onDone(); else alert('Não foi possível salvar a alocação-alvo.');
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-[12px] text-fg/50">Defina o percentual desejado de cada classe. Eu normalizo para 100% e mostro o que comprar/vender.</p>
      {REBAL_CLASSES.map((c) => (
        <div key={c.id} className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.hex }} />
          <span className="text-[13px] font-semibold flex-1">{c.label}</span>
          <div className="flex items-center gap-1">
            <input inputMode="numeric" value={vals[c.id]} onChange={(e) => setVal(c.id, e.target.value)} placeholder="0"
              className="w-16 text-center rounded-xl bg-fg/[0.06] border border-fg/[0.1] px-2 py-2 text-[15px] font-bold outline-none" />
            <span className="text-[13px] text-fg/40 font-bold">%</span>
          </div>
        </div>
      ))}
      <div className={`text-[12px] font-bold text-right ${total === 100 ? 'text-pos' : 'text-fg/45'}`}>Soma: {total}%</div>
      <SubmitBtn disabled={!valid || saving} tone="info">
        <Check className="w-4 h-4" /> {saving ? 'Salvando…' : 'Salvar alocação-alvo'}
      </SubmitBtn>
    </form>
  );
}
