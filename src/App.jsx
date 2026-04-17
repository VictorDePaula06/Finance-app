import { useState, useEffect } from 'react';
import TransactionSection from './components/TransactionSection';
import GoalTracker from './components/GoalTracker';
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LayoutDashboard, LogOut, Shield, TrendingUp, BookOpen, Sparkles, History, ArrowRight, Clock, Wallet, X, CreditCard } from 'lucide-react';
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
import MonthlyReviewModal from './components/MonthlyReviewModal';
import { generateMonthlyReview } from './services/gemini';
import { CATEGORIES } from './constants/categories';

// CONFIGURAÇÃO MASTER
const MASTER_EMAIL = 'j.17jvictor@gmail.com';

function Dashboard() {
  const { logout, currentUser, saveUserPreferences, getUserPreferences, userPrefs } = useAuth();
  const { theme } = useTheme();
  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showMonthlyReview, setShowMonthlyReview] = useState(false);
  const [showInvestmentHistory, setShowInvestmentHistory] = useState(false);
  const [monthlyReviewData, setMonthlyReviewData] = useState(null);
  const [previousMonthStats, setPreviousMonthStats] = useState({ income: 0, expense: 0, balance: 0, topCategory: '' });
  const [previousMonthName, setPreviousMonthName] = useState('');

  const [manualConfig, setManualConfig] = useState({
    income: '',
    fixedExpenses: '',
    variableEstimate: '',
    invested: '',
    categoryBudgets: {},
    recurringSubs: []
  });

  const [monthlyReviewText, setMonthlyReviewText] = useState('');

  const updateManualConfig = (newConfig) => {
    setManualConfig(newConfig);
    localStorage.setItem('financialAdvisorSettings', JSON.stringify(newConfig));
    saveUserPreferences({ manualConfig: newConfig });
  };

  useEffect(() => {
    if (userPrefs?.manualConfig) {
      setManualConfig(userPrefs.manualConfig);
      localStorage.setItem('financialAdvisorSettings', JSON.stringify(userPrefs.manualConfig));
    } else {
      const saved = localStorage.getItem('financialAdvisorSettings');
      if (saved) setManualConfig(JSON.parse(saved));
    }
  }, [userPrefs]);

  useEffect(() => {
    if (!currentUser) return;

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

  // Efeito para detectar virada de mês e mostrar resumo
  useEffect(() => {
    if (!currentUser || isLoadingData || transactions.length === 0) return;

    const checkMonthlyReview = async () => {
      const prefs = await getUserPreferences();
      const today = new Date();
      const currentMonthKey = today.toLocaleDateString('en-CA').slice(0, 7); // YYYY-MM
      
      const lastSeen = prefs?.lastMonthlyReviewSeen || '';
      
      if (lastSeen && lastSeen < currentMonthKey) {
        // Incrementador de Parcelas Automático
        if (manualConfig?.recurringSubs?.length > 0) {
          const updatedSubs = manualConfig.recurringSubs.map(sub => {
            if (sub.totalInstallments > 0) {
              return { ...sub, currentInstallment: (sub.currentInstallment || 0) + 1 };
            }
            return sub;
          });
          
          const newConfig = { ...manualConfig, recurringSubs: updatedSubs };
          setManualConfig(newConfig);
          localStorage.setItem('financialAdvisorSettings', JSON.stringify(newConfig));
          await saveUserPreferences({ manualConfig: newConfig });
          console.log("[Auto-Increment] Parcelas atualizadas para o novo mês.");
        }

        // O mês virou! Vamos pegar os dados do mês anterior
        const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const prevMonthKey = prevDate.toLocaleDateString('en-CA').slice(0, 7);
        const prevMonthNameFull = prevDate.toLocaleDateString('pt-BR', { month: 'long' });
        
        const prevTransactions = transactions.filter(t => {
          const tDate = t.date?.slice(0, 7) || t.month;
          return tDate === prevMonthKey;
        });

        if (prevTransactions.length > 0) {
          const income = prevTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
          const expense = prevTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
          
          const catTotals = {};
          prevTransactions.filter(t => t.type === 'expense').forEach(t => {
            catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
          });
          
          let topCatId = 'other';
          let max = 0;
          Object.entries(catTotals).forEach(([id, val]) => {
            if (val > max) { max = val; topCatId = id; }
          });
          
          const topCatLabel = CATEGORIES.expense.find(c => c.id === topCatId)?.label || 'Outros';

          const stats = { income, expense, balance: income - expense, topCategory: topCatLabel };
          setPreviousMonthStats(stats);
          setPreviousMonthName(prevMonthNameFull);
          
          // Gerar texto com Gemini
          try {
            const review = await generateMonthlyReview(
              today.toLocaleDateString('pt-BR', { month: 'long' }), 
              stats, 
              manualConfig
            );
            setMonthlyReviewText(review);
            setShowMonthlyReview(true);
          } catch (err) {
            console.error("Erro ao carregar resumo da Alívia:", err);
          }
        } else {
            // Se não tem transações no mês anterior, apenas marca como visto para não tentar de novo
            await saveUserPreferences({ lastMonthlyReviewSeen: currentMonthKey });
        }
      } else if (!lastSeen) {
        // Primeira vez usando o app ou prefs limpas - marca o mês atual como visto
        await saveUserPreferences({ lastMonthlyReviewSeen: currentMonthKey });
      }
    };

    checkMonthlyReview();
  }, [currentUser, isLoadingData, transactions.length]);

  const handleCloseMonthlyReview = async () => {
    setShowMonthlyReview(false);
    const currentMonthKey = new Date().toLocaleDateString('en-CA').slice(0, 7);
    await saveUserPreferences({ lastMonthlyReviewSeen: currentMonthKey });
  };

  const healthScore = calculateHealthScore(transactions, manualConfig);

  return (
    <div className={`min-h-screen relative font-sans transition-colors duration-500 ${
      theme === 'light' ? 'theme-light bg-[var(--bg-primary)] text-slate-800' : 'theme-dark bg-slate-950 text-slate-100'
    }`}>
      {/* Background Decorative Orbs */}
      <div className={`fixed top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] -z-10 pointer-events-none transition-opacity duration-1000 ${
        theme === 'light' ? 'bg-[#69C8B9]/20' : 'bg-blue-600/10'
      }`}></div>
      <div className={`fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] -z-10 pointer-events-none transition-opacity duration-1000 ${
        theme === 'light' ? 'bg-[#5CCEEA]/20' : 'bg-emerald-600/10'
      }`}></div>

      <InstallPrompt />

      <div className="max-w-6xl mx-auto p-6 md:p-12 space-y-8 relative z-10">
        <header className="flex flex-col items-center mb-12 gap-4">
          {/* Top: Logo Centered */}
          <div className="w-full flex justify-center">
            <img src={logo} alt="Alívia Logo" className="w-32 md:w-40 h-auto object-contain drop-shadow-xl" />
          </div>

          {/* Bottom: User Info and Actions */}
          <div className={`w-full flex items-center justify-between p-4 rounded-3xl border ${
            theme === 'light' ? 'bg-white/50 border-slate-100 shadow-sm' : 'bg-slate-800/20 border-slate-700/50'
          }`}>
            <div className="flex flex-col">
              <p className={`font-black tracking-wide text-sm animate-in fade-in slide-in-from-left-3 ${
                theme === 'light' ? 'text-[#69C8B9]' : 'text-emerald-400'
              }`}>
                👋 Olá, <span className={theme === 'light' ? 'text-slate-800' : 'text-white'}>{currentUser?.displayName?.split(' ')[0] || 'Usuário'}</span>
              </p>
              <p className="text-[9px] text-slate-500 font-mono opacity-80 select-all">
                {currentUser?.email}
              </p>
            </div>

            <div className="flex items-center gap-1 md:gap-3">
              <ReloadPrompt />
              <PushSetup />
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('change-view', { detail: 'manual' }));
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('manual-section', { detail: 'billing' }));
                  }, 100);
                }}
                className={`p-2 rounded-xl transition-all ${
                  theme === 'light' ? 'hover:bg-blue-50 text-slate-400 hover:text-blue-500' : 'hover:bg-blue-500/10 text-slate-500 hover:text-blue-400'
                }`}
                title="Sua Assinatura"
              >
                <CreditCard className="w-5 h-5" />
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('change-view', { detail: 'manual' }))}
                className={`p-2 rounded-xl transition-all ${
                  theme === 'light' ? 'hover:bg-blue-50 text-slate-400 hover:text-blue-500' : 'hover:bg-blue-500/10 text-slate-500 hover:text-blue-400'
                }`}
                title="Manual do Sistema"
              >
                <BookOpen className="w-5 h-5" />
              </button>
              <button
                onClick={logout}
                className={`p-2 rounded-xl transition-all ${
                  theme === 'light' ? 'hover:bg-rose-50 text-slate-400 hover:text-rose-500' : 'hover:bg-rose-500/10 text-slate-500 hover:text-rose-400'
                }`}
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {!isLoadingData && (
          <section className="animate-in fade-in slide-in-from-top-4 duration-700">
            <HealthScoreCard scoreData={healthScore} />
          </section>
        )}

        {(() => {
          const breath = generateSundayBreath(transactions, manualConfig);
          if (!breath.hasActivity) return null;
          return !isLoadingData && (
            <section className="animate-in fade-in zoom-in duration-1000">
              <div className={`glass-card p-6 flex flex-col md:flex-row items-center justify-between gap-6 ${
                theme === 'light' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-emerald-500/5 border-emerald-500/10'
              }`}>
                <div className="flex items-center gap-6">
                  <div className="p-4 bg-verde-respira/20 rounded-2xl">
                    <TrendingUp className="w-8 h-8 text-verde-respira" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-800 uppercase tracking-widest mb-1">Destaque da Semana</h4>
                    <p className={theme === 'light' ? 'text-slate-700' : 'text-slate-300'}>
                      {breath.message}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowInvestmentHistory(true)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap group ${
                    theme === 'light' 
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/20' 
                    : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30'
                  }`}
                >
                  <History className="w-4 h-4 group-hover:rotate-[-30deg] transition-transform" />
                  Ver Histórico
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </section>
          );
        })()}

        {/* Investment History Modal */}
        {showInvestmentHistory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className={`border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'
            }`}>
              <div className={`p-6 border-b flex justify-between items-center ${
                theme === 'light' ? 'bg-emerald-50/30 border-emerald-100' : 'bg-emerald-500/5 border-white/5'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Histórico de Reservas</h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Resumo de Investimentos e Reservas</p>
                  </div>
                </div>
                <button onClick={() => setShowInvestmentHistory(false)} className={`p-2 rounded-lg transition-colors ${
                  theme === 'light' ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-600' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                }`}>
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-3">
                  {transactions
                    .filter(t => (t.type === 'expense' && (t.category === 'investment' || t.category === 'vault')) || t.category === 'vault_redemption')
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .slice(0, 15)
                    .map((t, idx) => (
                      <div key={t.id} className={`p-4 rounded-2xl border flex items-center justify-between group transition-all ${
                        theme === 'light' ? 'bg-slate-50 border-slate-100 hover:border-emerald-200' : 'bg-white/5 border-white/5 hover:bg-white/10'
                      }`}>
                        <div className="flex items-center gap-4">
                          <div className={`p-2.5 rounded-xl ${
                             t.category === 'vault_redemption' 
                             ? (theme === 'light' ? 'bg-rose-50 text-rose-500' : 'bg-rose-500/10 text-rose-400')
                             : (theme === 'light' ? 'bg-emerald-50 text-emerald-500' : 'bg-emerald-500/10 text-emerald-400')
                          }`}>
                            {t.category === 'vault_redemption' ? <Wallet className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>{t.description}</p>
                            <p className="text-[10px] text-slate-500 font-medium">
                              {new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-black ${
                            t.category === 'vault_redemption' ? 'text-rose-500' : 'text-emerald-500'
                          }`}>
                            {t.category === 'vault_redemption' ? '-' : '+'} R$ {t.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500">
                            {t.category === 'investment' ? 'Investimento' : 'Cofre'}
                          </span>
                        </div>
                      </div>
                    ))}
                  {transactions.filter(t => (t.type === 'expense' && (t.category === 'investment' || t.category === 'vault')) || t.category === 'vault_redemption').length === 0 && (
                    <div className="text-center py-12 opacity-50">
                      <TrendingUp className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                      <p className="text-sm font-medium">Nenhum investimento registrado ainda.</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className={`p-4 border-t text-center ${theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                <p className={`text-[10px] font-bold italic ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                  "A constância é a base da sua saúde financeira."
                </p>
              </div>
            </div>
          </div>
        )}

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
            VERSÃO 6.5.4
          </p>
        </footer>

        <PanicButton onPanicClick={(msg) => {
          window.dispatchEvent(new CustomEvent('ai-panic', { detail: msg }));
        }} />

        <MonthlyReviewModal 
          isOpen={showMonthlyReview}
          onClose={handleCloseMonthlyReview}
          reviewText={monthlyReviewText}
          monthName={previousMonthName}
          stats={previousMonthStats}
          theme={theme}
        />
      </div>
    </div>
  );
}

import LandingPage from './components/LandingPage';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfUse from './components/TermsOfUse';
import SubscriptionBlock from './components/SubscriptionBlock';
import Contact from './components/Contact';
import WelcomeModal from './components/WelcomeModal';

function AppContent() {
  const { currentUser, isPremium, isTrial, daysRemaining, getUserPreferences, saveUserPreferences } = useAuth();
  const { theme } = useTheme();
  const [view, setView] = useState('landing');
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (currentUser && (view === 'landing' || view === 'login')) {
      setView('dashboard');
    }
  }, [currentUser, view]);

  useEffect(() => {
    if (currentUser && view === 'dashboard') {
      getUserPreferences().then(prefs => {
        if (!prefs || !prefs.hasSeenWelcome) {
          setShowWelcome(true);
        }
      });
    }
  }, [currentUser, view]);

  const handleCloseWelcome = async (goToManual = false) => {
    setShowWelcome(false);
    await saveUserPreferences({ hasSeenWelcome: true });
    if (goToManual) {
      setView('manual');
      // Trigger deep link to settings section in Manual
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('manual-section', { detail: 'settings' }));
      }, 100);
    }
  };
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

  const dashboardView = (
    <>
      <Dashboard />
      {showWelcome && (
        <WelcomeModal 
          theme={theme}
          onStartConfig={() => handleCloseWelcome(true)}
          onSkip={() => handleCloseWelcome(false)}
        />
      )}
    </>
  );

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

  if (view === 'contact') {
    return <Contact onBack={() => setView(currentUser ? 'dashboard' : 'landing')} />;
  }

  if (currentUser) {
    if (currentUser.email === MASTER_EMAIL && (view === 'admin' || window.location.hash === '#admin')) {
      return <AdminPanel onBack={() => {
        window.location.hash = '';
        setView('dashboard');
      }} />;
    }

    if (isPremium || currentUser.email === MASTER_EMAIL) {
      return dashboardView;
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
      onViewContact={() => setView('contact')}
    />
  );
}

export default function App() {
  return (
    <>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </>
  );
}
