import { useState, useEffect } from 'react';
import TransactionSection from './components/TransactionSection';
import GoalTracker from './components/GoalTracker';
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LayoutDashboard, LogOut, Shield, TrendingUp, BookOpen, Sparkles } from 'lucide-react';
import InstallPrompt from './components/InstallPrompt';
import logo from './assets/logo.png';
import AdminPanel from './components/AdminPanel';
import HealthScoreCard from './components/HealthScoreCard';
import { calculateHealthScore } from './utils/healthScore';
import { db } from './services/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import Manual from './components/Manual';
import PanicButton from './components/PanicButton';
import { generateSundayBreath } from './utils/sundayBreath';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import ReloadPrompt from './components/ReloadPrompt';
import PushSetup from './components/PushSetup';

// CONFIGURAÇÃO MASTER
const MASTER_EMAIL = 'j.17jvictor@gmail.com';

function Dashboard() {
  const { logout, currentUser, saveUserPreferences, getUserPreferences } = useAuth();
  const { theme } = useTheme();
  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [manualConfig, setManualConfig] = useState({
    income: '',
    fixedExpenses: '',
    variableEstimate: '',
    invested: '',
    categoryBudgets: {}
  });

  const updateManualConfig = (newConfig) => {
    setManualConfig(newConfig);
    localStorage.setItem('financialAdvisorSettings', JSON.stringify(newConfig));
    saveUserPreferences({ manualConfig: newConfig });
  };

  useEffect(() => {
    if (!currentUser) return;

    getUserPreferences().then(prefs => {
      if (prefs && prefs.manualConfig) {
        setManualConfig(prefs.manualConfig);
        localStorage.setItem('financialAdvisorSettings', JSON.stringify(prefs.manualConfig));
      } else {
        const saved = localStorage.getItem('financialAdvisorSettings');
        if (saved) setManualConfig(JSON.parse(saved));
      }
    });

    const qT = query(
      collection(db, 'transactions'),
      where('userId', '==', currentUser.uid),
      orderBy('date', 'desc')
    );
    const unsubT = onSnapshot(qT, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoadingData(false);
    });

    const qG = query(
      collection(db, 'goals'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'active')
    );
    const unsubG = onSnapshot(qG, (snapshot) => {
      setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubT();
      unsubG();
    };
  }, [currentUser]);

  const healthScore = calculateHealthScore(transactions, manualConfig);

  return (
    <div className={`min-h-screen relative font-sans transition-colors duration-500 ${
      theme === 'light' ? 'theme-light bg-[var(--bg-primary)] text-slate-800' : 'theme-dark bg-slate-950 text-slate-100'
    }`}>
      {/* Banner de Debug para teste de Cache */}
      <div className="bg-red-600 text-white text-[10px] py-1 text-center font-bold sticky top-0 z-[9999]">
        ALÍVIA v5.0 - SINCRONIZADO - SE VOCÊ VÊ ISSO, ESTÁ ATUALIZADO
      </div>
      {/* Background Decorative Orbs */}
      <div className={`fixed top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] -z-10 pointer-events-none transition-opacity duration-1000 ${
        theme === 'light' ? 'bg-[#69C8B9]/20' : 'bg-blue-600/10'
      }`}></div>
      <div className={`fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] -z-10 pointer-events-none transition-opacity duration-1000 ${
        theme === 'light' ? 'bg-[#5CCEEA]/20' : 'bg-emerald-600/10'
      }`}></div>

      <InstallPrompt />

      <div className="max-w-6xl mx-auto p-6 md:p-12 space-y-8 relative z-10">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Alívia Logo" className="w-32 h-auto object-contain drop-shadow-lg -ml-4" />
            <div>
              <p className={`font-medium tracking-wide mt-1 animate-in fade-in slide-in-from-left-3 ${
                theme === 'light' ? 'text-[#69C8B9]' : 'text-emerald-400'
              }`}>
                👋 Olá, <span className={theme === 'light' ? 'text-slate-800' : 'text-white'}>{currentUser?.displayName?.split(' ')[0] || 'Usuário'}</span>
              </p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5 opacity-80 select-all">
                {currentUser?.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('change-view', { detail: 'manual' }))}
              className="p-2 hover:bg-azul-ceu/10 rounded-lg text-slate-400 hover:text-blue-500 transition-colors"
              title="Manual do Sistema"
            >
              <BookOpen className="w-5 h-5" />
            </button>
            <button
              onClick={logout}
              className="p-2 hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <section className="animate-in fade-in slide-in-from-top-4 duration-700">
          <HealthScoreCard scoreData={healthScore} />
        </section>

        {(() => {
          const breath = generateSundayBreath(transactions, manualConfig);
          if (!breath.hasActivity) return null;
          return (
            <section className="animate-in fade-in zoom-in duration-1000">
              <div className={`glass-card p-6 flex items-center gap-6 ${
                theme === 'light' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-emerald-500/5 border-emerald-500/10'
              }`}>
                <div className="p-4 bg-verde-respira/20 rounded-2xl">
                  <Sparkles className="w-8 h-8 text-verde-respira animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-800 uppercase tracking-widest mb-1">O Respiro da Semana</h4>
                  <p className={theme === 'light' ? 'text-slate-700' : 'text-slate-300'}>
                    {breath.message}
                  </p>
                </div>
              </div>
            </section>
          );
        })()}

        <section className="glass-card p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <GoalTracker />
        </section>

        <section className="glass-card p-6 md:p-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <TransactionSection
            transactions={transactions}
            goals={goals}
            isLoadingData={isLoadingData}
            manualConfig={manualConfig}
            updateManualConfig={updateManualConfig}
          />
        </section>

        <footer className="pt-12 pb-8 text-center flex flex-col items-center gap-4">
          {currentUser?.email === MASTER_EMAIL && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('change-view', { detail: 'admin' }))}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/40 border border-slate-200 text-slate-500 hover:text-blue-600 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all shadow-sm"
            >
              <Shield className="w-3.5 h-3.5" />
              Painel Admin
            </button>
          )}
          <p className="text-slate-400 text-[10px] font-medium tracking-widest uppercase opacity-50">
            VERSÃO 5.0
          </p>
        </footer>

        <PanicButton onPanicClick={(msg) => {
          window.dispatchEvent(new CustomEvent('ai-panic', { detail: msg }));
        }} />
      </div>
    </div>
  );
}

import LandingPage from './components/LandingPage';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfUse from './components/TermsOfUse';
import SubscriptionBlock from './components/SubscriptionBlock';

function AppContent() {
  const { currentUser, isPremium, isTrial, daysRemaining } = useAuth();
  const [view, setView] = useState('landing');

  useEffect(() => {
    const handleViewChange = (e) => setView(e.detail);
    const handleHashChange = () => {
      if (window.location.hash === '#admin') setView('admin');
    };

    window.addEventListener('change-view', handleViewChange);
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => {
      window.removeEventListener('change-view', handleViewChange);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  if (view === 'login' && !currentUser) {
    return <Login onBack={() => setView('landing')} />;
  }

  if (view === 'privacy') {
    return <PrivacyPolicy onBack={() => setView(currentUser ? 'dashboard' : 'landing')} />;
  }

  if (view === 'terms') {
    return <TermsOfUse onBack={() => setView(currentUser ? 'dashboard' : 'landing')} />;
  }

  if (view === 'manual') {
    return <Manual onBack={() => setView(currentUser ? 'dashboard' : 'landing')} />;
  }

  if (currentUser) {
    if (currentUser.email === MASTER_EMAIL && (view === 'admin' || window.location.hash === '#admin')) {
      return <AdminPanel onBack={() => {
        window.location.hash = '';
        setView('dashboard');
      }} />;
    }

    if (isPremium || currentUser.email === MASTER_EMAIL) {
      return <Dashboard />;
    } else {
      return <SubscriptionBlock onAdminAccess={() => setView('admin')} />;
    }
  }

  return (
    <LandingPage
      onLogin={() => setView('login')}
      onViewPrivacy={() => setView('privacy')}
      onViewTerms={() => setView('terms')}
      onViewManual={() => setView('manual')}
    />
  );
}

export default function App() {
  return (
    <>
      <ReloadPrompt />
      <AuthProvider>
        <PushSetup />
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </>
  );
}
