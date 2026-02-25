import { useState, useEffect } from 'react';
import TransactionSection from './components/TransactionSection';
import GoalTracker from './components/GoalTracker';
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LayoutDashboard, LogOut, Shield, TrendingUp } from 'lucide-react';
import InstallPrompt from './components/InstallPrompt';
import logo from './assets/logo.png';
import AdminPanel from './components/AdminPanel';

// CONFIGURAÇÃO MASTER
const MASTER_EMAIL = 'j.17jvictor@gmail.com'; // E-mail master do proprietário

import HealthScoreCard from './components/HealthScoreCard';
import { calculateHealthScore } from './utils/healthScore';
import { db } from './services/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useEffect as useTransitionEffect } from 'react';

function Dashboard() {
  const { logout, currentUser } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [manualConfig, setManualConfig] = useState(() => {
    const saved = localStorage.getItem('financialAdvisorSettings');
    return saved ? JSON.parse(saved) : { income: '', fixedExpenses: '', variableEstimate: '', invested: '', categoryBudgets: {} };
  });

  const updateManualConfig = (newConfig) => {
    setManualConfig(newConfig);
    localStorage.setItem('financialAdvisorSettings', JSON.stringify(newConfig));
  };

  useEffect(() => {
    if (!currentUser) return;

    // Transactions Listener
    const qT = query(
      collection(db, 'transactions'),
      where('userId', '==', currentUser.uid),
      orderBy('date', 'desc')
    );
    const unsubT = onSnapshot(qT, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoadingData(false);
    });

    // Goals Listener
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
    <div className="min-h-screen bg-slate-950 text-slate-50 relative font-sans">
      {/* Background Decorative Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

      <InstallPrompt />

      <div className="max-w-6xl mx-auto p-6 md:p-12 space-y-8 relative z-10">

        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Finance Control Logo" className="w-28 h-auto object-contain drop-shadow-lg" />
            <div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent tracking-tighter">
                Mêntore
              </h1>
              <p className="text-slate-400 text-sm">Gerencie seus ativos e metas</p>
              <p className="text-emerald-400 font-medium tracking-wide mt-1 animate-in fade-in slide-in-from-left-3">
                👋 Olá, <span className="text-slate-100">{currentUser?.displayName?.split(' ')[0] || 'Usuário'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {currentUser?.email === MASTER_EMAIL && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('change-view', { detail: 'admin' }))}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-500/20 transition-all"
              >
                <Shield className="w-3.5 h-3.5" />
                ADMIN
              </button>
            )}
            <span className="text-xs text-slate-500 hidden md:block">{currentUser?.email}</span>
            <button
              onClick={logout}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Health Score Section */}
        <section className="animate-in fade-in slide-in-from-top-4 duration-700">
          <HealthScoreCard scoreData={healthScore} />
        </section>

        {/* Goal Section */}
        <section className="bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <GoalTracker />
        </section>

        {/* Transactions Section */}
        <section className="bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-6 md:p-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <TransactionSection
            transactions={transactions}
            goals={goals}
            isLoadingData={isLoadingData}
            manualConfig={manualConfig}
            updateManualConfig={updateManualConfig}
          />
        </section>

      </div>
    </div>
  );
}

import LandingPage from './components/LandingPage';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfUse from './components/TermsOfUse';
import SubscriptionBlock from './components/SubscriptionBlock';

function AppContent() {
  const { currentUser, isPremium } = useAuth();
  const [view, setView] = useState('landing'); // 'landing' | 'login' | 'privacy' | 'terms'

  // Handle cross-component view changes and Hash navigation
  useEffect(() => {
    const handleViewChange = (e) => setView(e.detail);
    const handleHashChange = () => {
      if (window.location.hash === '#admin') setView('admin');
    };

    window.addEventListener('change-view', handleViewChange);
    window.addEventListener('hashchange', handleHashChange);

    // Check hash on mount
    handleHashChange();

    return () => {
      window.removeEventListener('change-view', handleViewChange);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // If user is logged in
  if (currentUser) {
    // 1. Admin Priority (Hidden Access or State)
    if (currentUser.email === MASTER_EMAIL && (view === 'admin' || window.location.hash === '#admin')) {
      return <AdminPanel onBack={() => {
        window.location.hash = '';
        setView('dashboard');
      }} />;
    }

    // 2. Premium or Master Email Bypass
    if (isPremium || currentUser.email === MASTER_EMAIL) {
      return <Dashboard />;
    } else {
      return <SubscriptionBlock onAdminAccess={() => setView('admin')} />;
    }
  }

  // If user is not logged in, check view state
  if (view === 'login') {
    return <Login onBack={() => setView('landing')} />;
  }

  if (view === 'privacy') {
    return <PrivacyPolicy onBack={() => setView('landing')} />;
  }

  if (view === 'terms') {
    return <TermsOfUse onBack={() => setView('landing')} />;
  }

  return (
    <LandingPage
      onLogin={() => setView('login')}
      onViewPrivacy={() => setView('privacy')}
      onViewTerms={() => setView('terms')}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
