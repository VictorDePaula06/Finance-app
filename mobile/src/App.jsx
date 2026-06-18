import React, { useState } from 'react';
import { ThemeProvider } from './theme.jsx';
import { StoreProvider, useStore } from './store.jsx';
import Login from './Login.jsx';
import BottomNav from './components/BottomNav.jsx';
import GeralTab from './tabs/GeralTab.jsx';
import RecebimentosTab from './tabs/RecebimentosTab.jsx';
import LancamentosTab from './tabs/LancamentosTab.jsx';
import CartaoTab from './tabs/CartaoTab.jsx';
import AnalisesTab from './tabs/AnalisesTab.jsx';
import AjustesTab from './tabs/AjustesTab.jsx';

function Shell() {
  const { user, authReady, firebaseReady } = useStore();
  const [tab, setTab] = useState('geral');

  // Carregando auth
  if (firebaseReady && !authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-fg/15 border-t-pos animate-spin" />
      </div>
    );
  }

  // Sem login (ou sem config) → tela de entrada
  if (!user) return <Login />;

  return (
    <>
      <main className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {tab === 'geral' && <GeralTab onOpenSettings={() => setTab('ajustes')} />}
        {tab === 'recebimentos' && <RecebimentosTab />}
        {tab === 'lancamentos' && <LancamentosTab />}
        {tab === 'cartao' && <CartaoTab />}
        {tab === 'analises' && <AnalisesTab />}
        {tab === 'ajustes' && <AjustesTab />}
      </main>
      <BottomNav tab={tab} setTab={setTab} />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <StoreProvider>
        <div className="min-h-screen w-full flex justify-center bg-bg">
          <div className="relative w-full max-w-[440px] min-h-screen bg-ink flex flex-col shadow-2xl shadow-black/50 overflow-hidden">
            <Shell />
          </div>
        </div>
      </StoreProvider>
    </ThemeProvider>
  );
}
