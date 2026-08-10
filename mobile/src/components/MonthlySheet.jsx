import React, { useState } from 'react';
import { Check, Plus, ChevronLeft, CheckCircle2, Trash2 } from 'lucide-react';
import Sheet from './Sheet.jsx';
import { fmt } from './ui.jsx';
import TxForm from './forms/TxForm.jsx';
import { FixedIncomeForm, FixedExpenseForm } from './forms/RecurringForms.jsx';
import { monthLabel, isFixedDoneInMonth } from '../lib/finance.js';
import { catMeta } from '../lib/categories.js';

// Janela do mês: confirma os fixos já recebidos/pagos, permite cadastrar um novo
// fixo e lançar um avulso — tudo a partir de um único botão (+) no topo da aba.
export default function MonthlySheet({ kind, month, items = [], transactions = [], cards = [], onConfirm, onAddFixed, onDeleteFixed, onAddAvulso, onClose }) {
  const isIncome = kind === 'income';
  const L = isIncome
    ? { title: 'Recebimentos', fixed: 'Recebimentos fixos', done: 'Recebido', action: 'Confirmar', avulso: 'Lançar recebimento avulso', newFixed: 'Cadastrar recebimento fixo', tone: 'pos', accent: 'text-pos', sign: '+', empty: 'Nenhum recebimento fixo cadastrado.' }
    : { title: 'Contas', fixed: 'Contas fixas', done: 'Pago', action: 'Pagar', avulso: 'Lançar gasto avulso', newFixed: 'Cadastrar conta fixa', tone: 'neg', accent: 'text-neg', sign: '−', empty: 'Nenhuma conta fixa cadastrada.' };

  const [mode, setMode] = useState('list'); // 'list' | 'avulso' | 'newFixed'
  const [busyId, setBusyId] = useState(null);
  const [varVals, setVarVals] = useState({}); // valores editáveis (contas variáveis)
  const [delId, setDelId] = useState(null); // confirmação de exclusão do fixo

  const sorted = [...items].sort((a, b) => (a.day || 0) - (b.day || 0));

  const confirm = async (item) => {
    setBusyId(item.id);
    const val = item.isVariable ? (varVals[item.id] ?? String(item.value ?? '')) : undefined;
    await onConfirm(item, val);
    setBusyId(null);
  };

  const back = () => setMode('list');

  return (
    <Sheet
      title={mode === 'list' ? `${L.title} de ${monthLabel(month)}` : mode === 'avulso' ? L.avulso : L.newFixed}
      subtitle={mode === 'list' ? 'Confirme os fixos do mês ou lance um avulso' : undefined}
      onClose={onClose}
    >
      {mode !== 'list' && (
        <button onClick={back} className="flex items-center gap-1 text-[12px] font-bold text-fg/50 mb-3 active:scale-95 transition">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
      )}

      {mode === 'avulso' && (
        <TxForm kind={kind} cards={cards} onSubmit={onAddAvulso} onDone={onClose} />
      )}

      {mode === 'newFixed' && (
        isIncome
          ? <FixedIncomeForm onSubmit={onAddFixed} onDone={back} />
          : <FixedExpenseForm onSubmit={onAddFixed} onDone={back} />
      )}

      {mode === 'list' && (
        <div className="space-y-4">
          {/* Fixos do mês com confirmação */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-fg/35 mb-2">{L.fixed}</p>
            <div className="rounded-2xl bg-fg/[0.03] border border-fg/[0.06] divide-y divide-fg/[0.05]">
              {sorted.length === 0 ? (
                <p className="text-center text-[13px] text-fg/40 py-7">{L.empty}</p>
              ) : sorted.map((item) => {
                const c = catMeta(item.category);
                const done = isFixedDoneInMonth(item, transactions, month, kind);
                const editable = !isIncome && item.isVariable && !done;
                return (
                  <div key={item.id} className="flex items-center gap-3 px-3.5 py-3">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${c.color}22` }}>
                      <c.Icon className="w-[18px] h-[18px]" style={{ color: c.color }} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold truncate">{item.name}</p>
                      <p className="text-[11px] text-fg/40 truncate mt-0.5">Dia {item.day} · {c.label}{item.isVariable ? ' · variável' : ''}</p>
                    </div>
                    {delId === item.id ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => setDelId(null)} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-fg/[0.06] text-fg/60 active:scale-95 transition">Cancelar</button>
                        <button onClick={async () => { await onDeleteFixed(item.id); setDelId(null); }} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-rose-500 text-white active:scale-95 transition">Excluir</button>
                      </div>
                    ) : (
                      <>
                        {done ? (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-pos shrink-0"><CheckCircle2 className="w-4 h-4" /> {L.done}</span>
                        ) : editable ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1 rounded-lg bg-fg/[0.06] border border-fg/[0.1] px-2 py-1.5">
                              <span className="text-[11px] text-fg/40 font-bold">R$</span>
                              <input inputMode="decimal" value={varVals[item.id] ?? String(item.value ?? '')}
                                onChange={(e) => setVarVals(v => ({ ...v, [item.id]: e.target.value.replace(/[^0-9.,]/g, '') }))}
                                className="w-16 bg-transparent outline-none text-[13px] font-bold text-fg" />
                            </div>
                            <button onClick={() => confirm(item)} disabled={busyId === item.id}
                              className="text-[12px] font-bold px-3 py-2 rounded-lg bg-emerald-500 text-white active:scale-95 transition disabled:opacity-50">
                              {L.action}
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => confirm(item)} disabled={busyId === item.id}
                            className="flex items-center gap-1 text-[12px] font-bold px-3 py-2 rounded-lg bg-emerald-500 text-white active:scale-95 transition disabled:opacity-50 shrink-0">
                            <Check className="w-3.5 h-3.5" /> {L.action}
                          </button>
                        )}
                        {onDeleteFixed && (
                          <button onClick={() => setDelId(item.id)} aria-label="Excluir" className="w-8 h-8 -mr-1 rounded-lg flex items-center justify-center text-fg/25 active:text-neg active:scale-90 transition shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setMode('newFixed')} className={`mt-2.5 flex items-center gap-1.5 text-[12px] font-bold ${L.accent} active:scale-95 transition`}>
              <Plus className="w-4 h-4" /> {L.newFixed}
            </button>
          </div>

          {/* Avulso */}
          <div className="pt-1 border-t border-fg/[0.06]">
            <button onClick={() => setMode('avulso')}
              className="mt-3 w-full py-3.5 rounded-2xl bg-fg/[0.05] border border-fg/[0.08] font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition">
              <Plus className="w-4 h-4" /> {L.avulso}
            </button>
            <p className="text-[11px] text-fg/35 text-center mt-2">Uma entrada única, fora dos fixos.</p>
          </div>
        </div>
      )}
    </Sheet>
  );
}
