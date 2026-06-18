import React from 'react';
import { Plus, CheckCircle2 } from 'lucide-react';
import { TabHeader, Card, SectionLabel, TxRow, fmt } from '../components/ui.jsx';
import { CARD, CATS } from '../data/sample.js';

export default function CartaoTab() {
  const usagePct = Math.min(100, (CARD.invoice / CARD.limit) * 100);
  const available = Math.max(0, CARD.limit - CARD.invoice);

  return (
    <div className="pb-6">
      <TabHeader
        title="Cartões"
        subtitle="Faturas, parcelas e assinaturas"
        right={(
          <button className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center active:scale-95 transition shadow-lg shadow-emerald-500/25">
            <Plus className="w-5 h-5 text-black" />
          </button>
        )}
      />

      {/* Cartão visual */}
      <div className="px-5 mt-3">
        <div className="rounded-3xl p-5 h-44 flex flex-col justify-between bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 shadow-xl shadow-violet-900/30">
          <div className="flex items-start justify-between">
            <span className="text-[15px] font-extrabold">{CARD.name}</span>
            <span className="text-[11px] font-semibold text-white/70">{CARD.brand}</span>
          </div>
          <div className="text-[16px] font-semibold tracking-[0.25em] text-white/90">•••• {CARD.last4}</div>
          <div className="flex items-end justify-between">
            <span className="text-[11px] font-medium text-white/70 tracking-wide">{CARD.holder}</span>
            <span className="text-[10px] font-semibold text-white/60">VENC · DIA {CARD.due}</span>
          </div>
        </div>
      </div>

      {/* Fatura */}
      <div className="px-5 mt-4">
        <Card className="p-5">
          <span className="text-[11px] uppercase tracking-widest text-white/40 font-bold">Fatura atual</span>
          <p className="text-[30px] font-extrabold tracking-tight text-amber-400 mt-1.5">R$ {fmt(CARD.invoice)}</p>
          <p className="text-[11px] text-white/40 mt-1">vence dia {CARD.due}</p>

          {/* Uso do limite */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Uso do limite</span>
              <span className="text-[11px] font-black" style={{ color: usagePct >= 80 ? '#f43f5e' : usagePct >= 50 ? '#f59e0b' : '#10b981' }}>{Math.round(usagePct)}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${usagePct}%`, background: usagePct >= 80 ? '#f43f5e' : usagePct >= 50 ? '#f59e0b' : '#10b981' }} />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-white/35">R$ {fmt(CARD.invoice)} usado</span>
              <span className="text-[10px] text-white/35">Limite R$ {fmt(CARD.limit)}</span>
            </div>
          </div>

          <button className="mt-4 w-full py-3 rounded-xl bg-emerald-500 text-black font-bold text-[13px] flex items-center justify-center gap-2 active:scale-95 transition">
            <CheckCircle2 className="w-4 h-4" /> Registrar pagamento
          </button>
        </Card>
      </div>

      {/* Mini quadros */}
      <div className="px-5 mt-3 grid grid-cols-2 gap-3">
        {[
          { label: 'Disponível', value: available, color: '#34d399' },
          { label: 'Limite total', value: CARD.limit, color: '#e2e8f0' },
          { label: 'Parcelas / mês', value: CARD.parcelas, color: '#e2e8f0' },
          { label: 'Assinaturas', value: CARD.assinaturas, color: '#c084fc' },
        ].map(b => (
          <Card key={b.label} className="p-3.5">
            <p className="text-[9px] uppercase tracking-widest text-white/40 font-bold">{b.label}</p>
            <p className="text-[15px] font-extrabold mt-1" style={{ color: b.color }}>R$ {fmt(b.value)}</p>
          </Card>
        ))}
      </div>

      {/* Lançamentos da fatura */}
      <SectionLabel>Lançamentos da fatura</SectionLabel>
      <div className="px-5">
        <Card>
          {CARD.items.map((t, i) => (
            <TxRow
              key={t.id}
              cat={CATS[t.cat]}
              desc={t.desc}
              amount={t.amount}
              date={t.date}
              sub={t.badge || CATS[t.cat]?.label}
              sign="−"
              color="#fb7185"
              last={i === CARD.items.length - 1}
            />
          ))}
        </Card>
      </div>
    </div>
  );
}
