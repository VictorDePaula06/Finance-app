import React, { useMemo, useState } from 'react';
import { PiggyBank, ShieldCheck, Plus, Trash2, AlertTriangle, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { TabHeader, Card } from '../../components/ui.jsx';
import Sheet from '../../components/Sheet.jsx';
import { MoneyInput } from '../../components/forms/fields.jsx';
import JarForm from '../../components/forms/JarForm.jsx';
import { useStore } from '../../store.jsx';
import { reserveTotal, fmt } from '../../lib/finance.js';

const num = (v) => parseFloat(v) || 0;
const parseAmount = (s) => parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0;

const AddBtn = ({ onClick }) => (
  <button onClick={onClick} aria-label="Adicionar" className="w-9 h-9 rounded-full bg-pos/15 text-pos flex items-center justify-center active:scale-90 transition shrink-0"><Plus className="w-5 h-5" /></button>
);

export default function PatReserva() {
  const { savings_jars = [], addJar, adjustJar, deleteJar } = useStore();
  const [sheet, setSheet] = useState(false);
  const [detail, setDetail] = useState(null);
  const [amount, setAmount] = useState('');
  const [confirming, setConfirming] = useState(false);

  const totalNow = useMemo(() => reserveTotal(savings_jars), [savings_jars]);
  const deposited = savings_jars.reduce((a, j) => a + num(j.balance), 0);
  const yield_ = Math.max(0, totalNow - deposited);

  const openDetail = (j) => { setAmount(''); setConfirming(false); setDetail(j); };
  const move = async (sign) => { const v = parseAmount(amount); if (!v) return; await adjustJar(detail.id, sign * v); setDetail(null); };
  const doDelete = async () => { await deleteJar(detail.id); setDetail(null); };

  return (
    <div className="pb-6">
      <TabHeader title="Reserva" subtitle="Sua segurança com rendimento CDI" right={<AddBtn onClick={() => setSheet(true)} />} />

      <div className="px-5 mt-1">
        <Card className="p-5 bg-gradient-to-br from-emerald-500/12 via-card to-card border-emerald-500/15">
          <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-pos" /><span className="text-[11px] uppercase tracking-widest text-fg/40 font-bold">Reserva total</span></div>
          <p className="text-[30px] font-extrabold tracking-tight text-pos mt-1.5">R$ {fmt(totalNow)}</p>
          <div className="flex gap-5 mt-2">
            <div><span className="text-[10px] uppercase tracking-wider text-fg/35 font-bold">Depositado</span><p className="text-[12px] font-bold">R$ {fmt(deposited)}</p></div>
            <div><span className="text-[10px] uppercase tracking-wider text-fg/35 font-bold">Rendimento</span><p className="text-[12px] font-bold text-pos">+R$ {fmt(yield_)}</p></div>
          </div>
        </Card>
      </div>

      <div className="px-5 mt-4">
        <Card>
          {savings_jars.length === 0 ? (
            <p className="text-center text-[13px] text-fg/40 py-10">Nenhuma reserva cadastrada. Crie um cofrinho no site.</p>
          ) : savings_jars.map((j, i) => {
            const bal = num(j.balance);
            const cdi = num(j.cdiPercent) || 100;
            return (
              <button key={j.id} onClick={() => openDetail(j)} className={`w-full text-left flex items-center gap-3 px-4 py-3.5 active:bg-fg/[0.03] transition ${i === savings_jars.length - 1 ? '' : 'border-b border-fg/[0.04]'}`}>
                <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/12"><PiggyBank className="w-5 h-5 text-pos" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate">{j.name || 'Reserva'}</p>
                  <p className="text-[11px] text-fg/40">{cdi}% do CDI</p>
                </div>
                <span className="text-[15px] font-extrabold tabular-nums text-pos shrink-0">R$ {fmt(bal)}</span>
              </button>
            );
          })}
        </Card>
      </div>

      <p className="text-[10px] text-fg/30 text-center mt-4 px-8">O valor cresce automaticamente pelo CDI desde a última atualização — igual ao site.</p>

      {sheet && (
        <Sheet title="Nova reserva" onClose={() => setSheet(false)}>
          <JarForm onSubmit={addJar} onDone={() => setSheet(false)} />
        </Sheet>
      )}

      {detail && (
        <Sheet title={detail.name || 'Reserva'} subtitle={`${num(detail.cdiPercent) || 100}% do CDI · saldo R$ ${fmt(num(detail.balance))}`} onClose={() => setDetail(null)}>
          <MoneyInput value={amount} onChange={setAmount} autoFocus />
          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <button onClick={() => move(1)} disabled={!parseAmount(amount)} className="py-3 rounded-xl bg-emerald-500 text-white font-bold text-[13px] flex items-center justify-center gap-1.5 active:scale-95 transition disabled:opacity-40"><ArrowDownCircle className="w-4 h-4" /> Depositar</button>
            <button onClick={() => move(-1)} disabled={!parseAmount(amount)} className="py-3 rounded-xl bg-fg/[0.08] text-fg font-bold text-[13px] flex items-center justify-center gap-1.5 active:scale-95 transition disabled:opacity-40"><ArrowUpCircle className="w-4 h-4" /> Resgatar</button>
          </div>
          {!confirming ? (
            <button onClick={() => setConfirming(true)} className="mt-4 w-full py-3 rounded-xl border border-neg/25 text-neg font-bold text-[13px] flex items-center justify-center gap-2 active:scale-[0.98] transition"><Trash2 className="w-4 h-4" /> Excluir reserva</button>
          ) : (
            <div className="mt-4 rounded-2xl bg-neg/[0.07] border border-neg/20 p-4">
              <p className="text-[13px] font-semibold flex items-center gap-2 text-neg"><AlertTriangle className="w-4 h-4 shrink-0" /> Excluir esta reserva?</p>
              <div className="grid grid-cols-2 gap-2.5 mt-3">
                <button onClick={() => setConfirming(false)} className="py-3 rounded-xl bg-fg/[0.06] text-fg/70 font-bold text-[13px]">Cancelar</button>
                <button onClick={doDelete} className="py-3 rounded-xl bg-rose-500 text-white font-bold text-[13px]">Excluir</button>
              </div>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}
