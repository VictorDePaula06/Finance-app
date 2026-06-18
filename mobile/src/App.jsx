import React, { useState } from 'react';
import BottomNav from './components/BottomNav.jsx';
import GeralTab from './tabs/GeralTab.jsx';
import RecebimentosTab from './tabs/RecebimentosTab.jsx';
import LancamentosTab from './tabs/LancamentosTab.jsx';
import CartaoTab from './tabs/CartaoTab.jsx';
import AnalisesTab from './tabs/AnalisesTab.jsx';
import AjustesTab from './tabs/AjustesTab.jsx';

export default function App() {
  const [tab, setTab] = useState('geral');

  return (
    // Em telas grandes (PC) aparece como um "celular" centralizado; no Android ocupa a tela toda.
    <div className="min-h-screen w-full flex justify-center bg-black">
      <div className="relative w-full max-w-[440px] min-h-screen bg-ink flex flex-col shadow-2xl shadow-black/50 overflow-hidden">
        <main className="flex-1 overflow-y-auto no-scrollbar pb-24">
          {tab === 'geral' && <GeralTab onOpenSettings={() => setTab('ajustes')} />}
          {tab === 'recebimentos' && <RecebimentosTab />}
          {tab === 'lancamentos' && <LancamentosTab />}
          {tab === 'cartao' && <CartaoTab />}
          {tab === 'analises' && <AnalisesTab />}
          {tab === 'ajustes' && <AjustesTab />}
        </main>
        <BottomNav tab={tab} setTab={setTab} />
      </div>
    </div>
  );
}
