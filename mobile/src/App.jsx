import React, { useState } from 'react';
import BottomNav from './components/BottomNav.jsx';
import GeralTab from './tabs/GeralTab.jsx';
import { TrendingUp, TrendingDown, CreditCard, BarChart3, Settings } from 'lucide-react';

// Telas ainda não construídas (próximos milestones) — placeholder com a identidade.
const Placeholder = ({ Icon, title }) => (
  <div className="flex flex-col items-center justify-center h-full text-center px-10 -mt-16">
    <div className="w-16 h-16 rounded-3xl bg-white/[0.05] border border-white/[0.06] flex items-center justify-center mb-4">
      <Icon className="w-7 h-7 text-white/40" />
    </div>
    <h2 className="text-lg font-bold">{title}</h2>
    <p className="text-[13px] text-white/40 mt-1.5 leading-relaxed">
      Em construção — vamos montar esta aba no próximo passo, no mesmo estilo da Geral.
    </p>
  </div>
);

export default function App() {
  const [tab, setTab] = useState('geral');

  return (
    // Em telas grandes (PC) aparece como um "celular" centralizado; no Android ocupa a tela toda.
    <div className="min-h-screen w-full flex justify-center bg-black">
      <div className="relative w-full max-w-[440px] min-h-screen bg-ink flex flex-col shadow-2xl shadow-black/50 overflow-hidden">
        <main className="flex-1 overflow-y-auto no-scrollbar pb-24">
          {tab === 'geral' && <GeralTab onOpenSettings={() => setTab('ajustes')} />}
          {tab === 'recebimentos' && <Placeholder Icon={TrendingUp} title="Recebimentos" />}
          {tab === 'lancamentos' && <Placeholder Icon={TrendingDown} title="Lançamentos" />}
          {tab === 'cartao' && <Placeholder Icon={CreditCard} title="Cartão" />}
          {tab === 'analises' && <Placeholder Icon={BarChart3} title="Análises" />}
          {tab === 'ajustes' && <Placeholder Icon={Settings} title="Ajustes" />}
        </main>
        <BottomNav tab={tab} setTab={setTab} />
      </div>
    </div>
  );
}
