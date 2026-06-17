import React, { useState } from 'react';
import {
  Search, Eye, Bell, Mic, Send, ArrowUpRight, ArrowDownRight,
  Sparkles, CreditCard, ChevronRight, StopCircle,
} from 'lucide-react';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Dados de exemplo (milestone 1 — só para validar o layout). A integração com o
// mesmo Firebase do site entra no próximo passo.
const SAMPLE = {
  name: 'Felipe',
  balance: 8240.55,
  monthDelta: 1230,
  income: 6500,
  expense: 5269.45,
  invoice: 476.75,
  invoiceDue: '15/jul',
};

const SUGGESTIONS = ['Como estão meus gastos?', 'Quanto posso gastar hoje?', 'Registrar mercado R$ 120', 'Minha reserva está boa?'];

export default function GeralTab() {
  const [recording, setRecording] = useState(false);

  return (
    <div className="px-5 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center font-black text-sm shrink-0">
            {SAMPLE.name.charAt(0)}
          </div>
          <div>
            <p className="text-[11px] text-white/40 leading-none">Olá,</p>
            <p className="text-[15px] font-bold leading-tight">{SAMPLE.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center active:scale-95 transition"><Search className="w-[18px] h-[18px] text-white/70" /></button>
          <button className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center active:scale-95 transition"><Eye className="w-[18px] h-[18px] text-white/70" /></button>
          <button className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center active:scale-95 transition"><Bell className="w-[18px] h-[18px] text-white/70" /></button>
        </div>
      </div>

      {/* Falar com a Alívia (chat rápido + áudio) */}
      <div className="mt-5 rounded-3xl p-4 bg-gradient-to-br from-emerald-500/15 via-card to-card border border-emerald-500/15">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center"><Sparkles className="w-[18px] h-[18px] text-emerald-400" /></div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-card" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold leading-none">Fale com a Alívia</p>
            <p className="text-[10px] text-white/40 mt-1">Sua consultora financeira por IA</p>
          </div>
        </div>

        {/* Caixa de mensagem com microfone (áudio) e enviar */}
        <div className="flex items-center gap-2 bg-black/35 rounded-2xl p-1.5 pl-4">
          <input
            placeholder={recording ? 'Gravando áudio…' : 'Pergunte ou registre um gasto…'}
            className="flex-1 min-w-0 bg-transparent outline-none text-[13px] placeholder:text-white/30"
          />
          <button
            onClick={() => setRecording(r => !r)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition ${recording ? 'bg-rose-500/20' : 'bg-white/[0.06]'}`}
            aria-label="Enviar áudio"
          >
            {recording
              ? <StopCircle className="w-5 h-5 text-rose-400 animate-pulse" />
              : <Mic className="w-5 h-5 text-emerald-400" />}
          </button>
          <button className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 active:scale-95 transition" aria-label="Enviar">
            <Send className="w-[18px] h-[18px] text-black" />
          </button>
        </div>

        {/* Sugestões rápidas */}
        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
          {SUGGESTIONS.map(s => (
            <button key={s} className="shrink-0 text-[11px] px-3 py-1.5 rounded-full bg-white/[0.06] text-white/60 whitespace-nowrap active:scale-95 transition">{s}</button>
          ))}
        </div>
      </div>

      {/* Saldo em carteira */}
      <div className="mt-6">
        <div className="flex items-center gap-2">
          <p className="text-[12px] text-white/40 uppercase tracking-widest font-semibold">Saldo em carteira</p>
        </div>
        <p className="text-[34px] leading-none font-extrabold tracking-tight mt-2">
          R$ {fmt(SAMPLE.balance)}
        </p>
        <p className="text-[12px] text-emerald-400 mt-2 flex items-center gap-1">
          <ArrowUpRight className="w-3.5 h-3.5" /> +R$ {fmt(SAMPLE.monthDelta)} este mês
        </p>
      </div>

      {/* Ganhos / Gastos */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="rounded-2xl bg-card border border-white/[0.05] p-4">
          <div className="flex items-center gap-1.5">
            <ArrowDownRight className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Ganhos</span>
          </div>
          <p className="text-lg font-extrabold mt-2 text-emerald-400">R$ {fmt(SAMPLE.income)}</p>
        </div>
        <div className="rounded-2xl bg-card border border-white/[0.05] p-4">
          <div className="flex items-center gap-1.5">
            <ArrowUpRight className="w-4 h-4 text-rose-400" />
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Gastos</span>
          </div>
          <p className="text-lg font-extrabold mt-2 text-rose-400">R$ {fmt(SAMPLE.expense)}</p>
        </div>
      </div>

      {/* Fatura do cartão */}
      <button className="mt-3 w-full rounded-2xl bg-card border border-white/[0.05] p-4 flex items-center gap-3 text-left active:scale-[0.99] transition">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
          <CreditCard className="w-5 h-5 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Fatura do cartão</p>
          <p className="text-lg font-extrabold text-violet-300 leading-tight">R$ {fmt(SAMPLE.invoice)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] text-white/30">vence {SAMPLE.invoiceDue}</p>
          <ChevronRight className="w-4 h-4 text-white/25 ml-auto mt-1" />
        </div>
      </button>

      <p className="text-center text-[10px] text-white/20 mt-7">
        Pré-visualização do app · dados de exemplo
      </p>
    </div>
  );
}
