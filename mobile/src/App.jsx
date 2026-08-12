import React, { useState } from 'react';
import { ThemeProvider } from './theme.jsx';
import { StoreProvider, useStore } from './store.jsx';
import Login from './Login.jsx';
import VerifyEmail from './VerifyEmail.jsx';
import TermsGate from './TermsGate.jsx';
import { isLifetimeEmail, isAdminEmail } from './lib/plan.js';
import { CURRENT_TERMS_VERSION } from './lib/terms.js';
import BottomNav from './components/BottomNav.jsx';
import GeralTab from './tabs/GeralTab.jsx';
import RecebimentosTab from './tabs/RecebimentosTab.jsx';
import LancamentosTab from './tabs/LancamentosTab.jsx';
import CartaoTab from './tabs/CartaoTab.jsx';
import AnalisesTab from './tabs/AnalisesTab.jsx';
import AjustesTab from './tabs/AjustesTab.jsx';
import PatrimonioShell from './tabs/PatrimonioShell.jsx';

function Shell() {
  const { user, authReady, firebaseReady, demo, prefs, prefsLoaded } = useStore();
  const [tab, setTab] = useState('geral');
  const [module, setModule] = useState('gastos'); // 'gastos' | 'patrimonio'
  const [settingsOpen, setSettingsOpen] = useState(false); // Ajustes como tela sobreposta

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

  // Verificação de e-mail (link): segura contas de e-mail/senha não verificadas.
  // Google já vem verificado; modo demo não exige.
  const trustedEmail = isAdminEmail(user.email) || isLifetimeEmail(user.email);
  const needsEmailVerification = !demo && user.emailVerified === false
    && (user.providerData || []).some(p => p.providerId === 'password')
    && !trustedEmail;
  if (needsEmailVerification) return <VerifyEmail />;

  // Aceite dos Termos (LGPD) — igual ao site: exige aceitar se nunca aceitou ou
  // se a versão mudou. Só depois que as prefs carregaram (evita piscar a tela).
  const needsTerms = !demo && firebaseReady && prefsLoaded &&
    (prefs?.hasAcceptedTerms !== true || prefs?.termsVersion !== CURRENT_TERMS_VERSION);
  if (needsTerms) return <TermsGate />;

  // Ajustes: tela sobreposta, independente do módulo (não força trocar p/ Gastos).
  if (settingsOpen) {
    return (
      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-6">
        <AjustesTab onBack={() => setSettingsOpen(false)} />
      </main>
    );
  }

  // Módulo Patrimônio: abas próprias (Geral, Monitor, Reserva, Investimentos,
  // Rebalanceamento). A engrenagem abre os Ajustes sem sair do Patrimônio.
  if (module === 'patrimonio') {
    return (
      <PatrimonioShell module={module} onModule={setModule} onOpenSettings={() => setSettingsOpen(true)} />
    );
  }

  return (
    <>
      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-24">
        {tab === 'geral' && <GeralTab module={module} onModule={setModule} onOpenSettings={() => setSettingsOpen(true)} onGoToCard={() => setTab('cartao')} />}
        {tab === 'recebimentos' && <RecebimentosTab />}
        {tab === 'lancamentos' && <LancamentosTab />}
        {tab === 'cartao' && <CartaoTab />}
        {tab === 'analises' && <AnalisesTab />}
      </main>
      <BottomNav tab={tab} setTab={setTab} />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <StoreProvider>
        <div className="h-[100dvh] w-full flex justify-center bg-bg">
          <div className="relative w-full max-w-[440px] h-[100dvh] bg-ink flex flex-col shadow-2xl shadow-black/50 overflow-hidden">
            <Shell />
          </div>
        </div>
      </StoreProvider>
    </ThemeProvider>
  );
}
