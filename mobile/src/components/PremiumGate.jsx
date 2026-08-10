import React from 'react';
import { Lock, Crown } from 'lucide-react';

const SITE = 'https://soualivia.com.br';

// Tela de bloqueio para recursos exclusivos de um plano pago.
// A COMPRA continua no site (política do Google Play não permite venda de
// assinatura digital in-app via Stripe) — aqui só informamos e levamos ao site.
export default function PremiumGate({ feature = 'Este recurso', plan = 'Premium' }) {
  const open = () => { try { window.open(SITE, '_blank', 'noopener'); } catch { /* */ } };
  return (
    <div className="px-5 pt-10 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-3xl bg-amber-500/12 border border-amber-500/20 flex items-center justify-center mb-4">
        <Lock className="w-7 h-7 text-warn" />
      </div>
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/12 text-warn text-[10px] font-black uppercase tracking-widest mb-3">
        <Crown className="w-3 h-3" /> {plan}
      </div>
      <p className="text-[15px] font-bold">{feature} é exclusivo do plano {plan}</p>
      <p className="text-[12px] text-fg/45 mt-1.5 max-w-[280px] leading-snug">
        Faça upgrade para desbloquear. A assinatura é gerenciada no site, com segurança.
      </p>
      <button onClick={open} className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 text-white font-bold text-[13px] active:scale-95 transition">
        <Crown className="w-4 h-4" /> Ver planos no site
      </button>
    </div>
  );
}
