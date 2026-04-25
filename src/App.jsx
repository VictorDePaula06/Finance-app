import { useState, useEffect, useMemo } from 'react';
import TransactionSection from './components/TransactionSection';
import GoalTracker from './components/GoalTracker';
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TrendingUp, History, ArrowRight, Wallet, X, Bell, Clock, HelpCircle, CreditCard, BookOpen } from 'lucide-react';
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

// NEW COMPONENTS
import Sidebar from './components/Sidebar';
import SettingsTab from './components/SettingsTab';
import AIChat from './components/AIChat';
import PaceAlerts from './components/PaceAlerts';
import { calculateSpendingPace } from './utils/financialLogic';
import AnalysisTab from './components/AnalysisTab';
import CardsTab from './components/CardsTab';
import InvestmentsTab from './components/InvestmentsTab';

// CONFIGURAÇÃO MASTER
const MASTER_EMAIL = 'j.17jvictor@gmail.com';

function Dashboard() {
  const { currentUser, saveUserPreferences, getUserPreferences, userPrefs } = useAuth();
  const { theme } = useTheme();
  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [cards, setCards] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('visao');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showMonthlyReview, setShowMonthlyReview] = useState(false);
  const [showInvestmentHistory, setShowInvestmentHistory] = useState(false);
  const [monthlyReviewText, setMonthlyReviewText] = useState('');
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

  const updateManualConfig = (newConfig) => {
    setManualConfig(newConfig);
    localStorage.setItem('financialAdvisorSettings', JSON.stringify(newConfig));
    saveUserPreferences({ manualConfig: newConfig });
  };

  useEffect(() => {
    if (userPrefs?.manualConfig) {
      setManualConfig(userPrefs.manualConfig);
    } else {
      const saved = localStorage.getItem('financialAdvisorSettings');
      if (saved) setManualConfig(JSON.parse(saved));
    }
  }, [userPrefs]);

  useEffect(() => {
    if (!currentUser) return;

    // Listen to Transactions
    const qT = query(collection(db, 'transactions'), where('userId', '==', currentUser.uid), orderBy('date', 'desc'));
    const unsubT = onSnapshot(qT, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoadingData(false);
    });

    // Listen to Goals
    const qG = query(collection(db, 'goals'), where('userId', '==', currentUser.uid));
    const unsubG = onSnapshot(qG, (snapshot) => {
      setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to Cards
    const qC = query(collection(db, 'cards'), where('userId', '==', currentUser.uid));
    const unsubC = onSnapshot(qC, (snapshot) => {
      setCards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to Subscriptions
    const qS = query(collection(db, 'subscriptions'), where('userId', '==', currentUser.uid));
    const unsubS = onSnapshot(qS, (snapshot) => {
      setSubscriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubT(); unsubG(); unsubC(); unsubS();
    };
  }, [currentUser]);

  // VIRADA DE MÊS LOGIC - Keeping existing logic
  useEffect(() => {
    if (!currentUser || isLoadingData || transactions.length === 0) return;

    const checkMonthlyReview = async () => {
      const prefs = await getUserPreferences();
      const today = new Date();
      const currentMonthKey = today.toLocaleDateString('en-CA').slice(0, 7);
      const lastSeen = prefs?.lastMonthlyReviewSeen || '';
      
      if (lastSeen && lastSeen < currentMonthKey) {
        const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const prevMonthKey = prevDate.toLocaleDateString('en-CA').slice(0, 7);
        const prevMonthNameFull = prevDate.toLocaleDateString('pt-BR', { month: 'long' });
        
        const prevTransactions = transactions.filter(t => (t.date?.slice(0, 7) || t.month) === prevMonthKey);

        if (prevTransactions.length > 0) {
          const income = prevTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + (t.amount || 0), 0);
          const expense = prevTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + (t.amount || 0), 0);
          
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
          
          try {
            const review = await generateMonthlyReview(today.toLocaleDateString('pt-BR', { month: 'long' }), stats, manualConfig);
            setMonthlyReviewText(review);
            setShowMonthlyReview(true);
          } catch (err) {
            console.error("Erro ao carregar resumo da Alívia:", err);
          }
        } else {
            await saveUserPreferences({ lastMonthlyReviewSeen: currentMonthKey });
        }
      } else if (!lastSeen) {
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
  const paceAlerts = useMemo(() => calculateSpendingPace(transactions, manualConfig), [transactions, manualConfig]);

  // STATS FOR ANALYSIS TAB
  const statsForAnalysis = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA').slice(0, 7);
    const filtered = transactions.filter(t => (t.date?.slice(0, 7) || t.month) === todayStr);
    
    const displayIncome = filtered
        .filter(t => t.type === 'income' && t.category !== 'initial_balance' && t.category !== 'carryover' && t.category !== 'vault_redemption')
        .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    
    const displayExpense = filtered
        .filter(t => t.type === 'expense' && t.category !== 'investment' && t.category !== 'vault')
        .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    
    return { displayIncome, displayExpense, balance: displayIncome - displayExpense };
  }, [transactions]);

  return (
    <div className={`sidebar-layout transition-colors duration-500 ${
      theme === 'light' ? 'theme-light' : 'theme-dark'
    }`}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      <main className="main-content relative z-10 p-4 md:p-12 overflow-x-hidden">
        <InstallPrompt />
        
        <div className="max-w-6xl mx-auto space-y-10 pb-32">
          
          {/* GLOBAL HEADER BAR - Persistent on Mobile, Conditional on Desktop */}
          <div className={`p-4 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border items-center justify-between animate-in fade-in slide-in-from-top-4 duration-700 
            ${activeTab === 'visao' ? 'flex' : 'flex lg:hidden'} 
            ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'}
          `}>
            <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
              {/* Mobile Menu Button Integrated */}
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className={`p-2.5 rounded-xl lg:hidden border ${
                  theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-600' : 'bg-white/5 border-white/5 text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
              </button>

              <div className="flex items-center gap-3 min-w-0">
                {activeTab === 'visao' && (
                  <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center text-xl md:text-2xl font-black shrink-0 ${
                    theme === 'light' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    👋
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className={`text-base md:text-2xl font-black truncate ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                    {activeTab === 'visao' ? (
                      <>Olá, <span className="text-emerald-500">{currentUser?.displayName?.split(' ')[0] || 'Joao'}</span></>
                    ) : (
                      <span className="capitalize text-emerald-500">{activeTab}</span>
                    )}
                  </h2>
                  <p className="text-[9px] md:text-xs text-slate-500 font-mono opacity-80 truncate">
                    {activeTab === 'visao' ? currentUser?.email : 'Alívia Financeira'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
              <button 
                onClick={() => {
                  setActiveTab('manual');
                  setTimeout(() => window.dispatchEvent(new CustomEvent('manual-section', { detail: 'billing' })), 100);
                }}
                className={`p-2 md:p-3 rounded-xl md:rounded-2xl border transition-all hover:scale-110 active:scale-95 ${
                  theme === 'light' ? 'bg-white border-slate-100 text-slate-400 hover:text-blue-500 shadow-sm' : 'bg-white/5 border-white/5 text-slate-500 hover:text-blue-400'
                }`}
                title="Gerenciar Assinatura"
              >
                <CreditCard className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              <button 
                onClick={() => setActiveTab('manual')}
                className={`p-2 md:p-3 rounded-xl md:rounded-2xl border transition-all hover:scale-110 active:scale-95 ${
                  theme === 'light' ? 'bg-white border-slate-100 text-slate-400 hover:text-emerald-500 shadow-sm' : 'bg-white/5 border-white/5 text-slate-500 hover:text-emerald-400'
                }`}
                title="Manual do Sistema"
              >
                <BookOpen className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              <div className="hidden md:block w-px h-8 bg-slate-500/20 mx-1"></div>
              <div className="scale-75 md:scale-100 flex items-center gap-1">
                <ReloadPrompt />
                <PushSetup />
              </div>
            </div>
          </div>

          {activeTab === 'visao' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <HealthScoreCard scoreData={healthScore} />
              
              {paceAlerts.length > 0 && <PaceAlerts paceAlerts={paceAlerts} />}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* UPCOMING BILLS WIDGET */}
                <div className={`p-8 rounded-[2.5rem] border ${
                  theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'
                }`}>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" /> Próximos Compromissos
                  </h3>
                  <div className="space-y-4">
                    {subscriptions.sort((a, b) => a.day - b.day).slice(0, 4).map(sub => (
                      <div key={sub.id} className={`flex items-center justify-between p-4 rounded-2xl ${theme === 'light' ? 'bg-slate-50' : 'bg-white/5'}`}>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-[10px] font-black text-blue-500">
                            {sub.day}
                          </div>
                          <span className={`text-sm font-bold ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>{sub.name}</span>
                        </div>
                        <span className="text-sm font-black text-emerald-500">R$ {sub.value.toLocaleString('pt-BR')}</span>
                      </div>
                    ))}
                    {subscriptions.length === 0 && (
                      <p className="text-xs text-slate-500 italic text-center py-4">Nenhuma assinatura para este mês.</p>
                    )}
                  </div>
                </div>

                {/* SUNDAY BREATH / HIGHLIGHTS */}
                <div className="space-y-6">
                  {(() => {
                    const breath = generateSundayBreath(transactions, manualConfig);
                    if (!breath.hasActivity) return (
                      <div className={`p-8 rounded-[2.5rem] border flex items-center justify-center text-center opacity-40 ${
                        theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'
                      }`}>
                        <p className="text-xs font-bold uppercase tracking-widest">Sem atividades relevantes esta semana</p>
                      </div>
                    );
                    return (
                      <div className={`p-8 rounded-[2.5rem] border flex flex-col items-center justify-between gap-6 h-full ${
                        theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'
                      }`}>
                        <div className="flex flex-col items-center text-center gap-4">
                          <div className="p-4 bg-emerald-500/10 rounded-full">
                            <TrendingUp className="w-10 h-10 text-emerald-500" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-2">Insight Semanal</h4>
                            <p className={`text-sm leading-relaxed ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>
                              {breath.message}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowInvestmentHistory(true)}
                          className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all group ${
                            theme === 'light' ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg' : 'bg-emerald-600 text-white hover:bg-emerald-500'
                          }`}
                        >
                          <History className="w-4 h-4" /> Ver Histórico de Reservas
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          { activeTab === 'metas' && <GoalTracker />}

          { activeTab === 'cartoes' && <CardsTab /> }
          
          { activeTab === 'investimentos' && <InvestmentsTab /> }

          {activeTab === 'analise' && (
            <AnalysisTab transactions={transactions} />
          )}
          {activeTab === 'transacoes' && (
            <TransactionSection 
              transactions={transactions}
              goals={goals}
              isLoadingData={isLoadingData}
              manualConfig={manualConfig}
              updateManualConfig={updateManualConfig}
              onGoToSettings={() => setActiveTab('ajustes')}
            />
          )}
          
          { activeTab === 'manual' && (
            <Manual manualConfig={manualConfig} updateManualConfig={updateManualConfig} />
          )}

          {activeTab === 'ajustes' && <SettingsTab manualConfig={manualConfig} updateManualConfig={updateManualConfig} />}

        </div>

        {/* Global Floating Components */}
        <AIChat 
          transactions={transactions} 
          manualConfig={manualConfig} 
          onConfigChange={updateManualConfig}
        />

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

        {/* Investment History Modal */}
        {showInvestmentHistory && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className={`border rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/5'
            }`}>
              <div className="p-8 border-b flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl">
                    <TrendingUp className="w-6 h-6 text-emerald-500" />
                  </div>
                  <h3 className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Histórico de Reservas</h3>
                </div>
                <button onClick={() => setShowInvestmentHistory(false)} className="p-2 text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-4">
                {transactions
                  .filter(t => (t.type === 'expense' && (t.category === 'investment' || t.category === 'vault')) || t.category === 'vault_redemption')
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .slice(0, 15)
                  .map((t) => (
                    <div key={t.id} className={`p-4 rounded-2xl border flex items-center justify-between ${
                      theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'
                    }`}>
                      <div>
                        <p className={`text-sm font-bold ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>{t.description}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">{new Date(t.date).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <p className={`font-black ${t.category === 'vault_redemption' ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {t.category === 'vault_redemption' ? '-' : '+'} R$ {t.amount?.toLocaleString('pt-BR')}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </main>
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
  const { currentUser, isPremium, getUserPreferences, saveUserPreferences } = useAuth();
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
        if (!prefs || !prefs.hasSeenWelcome) setShowWelcome(true);
      });
    }
  }, [currentUser, view]);

  const handleCloseWelcome = async (goToManual = false) => {
    setShowWelcome(false);
    await saveUserPreferences({ hasSeenWelcome: true });
    if (goToManual) {
      setView('manual');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('manual-section', { detail: 'settings' }));
      }, 100);
    }
  };

  useEffect(() => {
    const handleViewChange = (e) => setView(e.detail);
    window.addEventListener('change-view', handleViewChange);
    return () => window.removeEventListener('change-view', handleViewChange);
  }, []);

  if (view === 'login' && !currentUser) return <Login onBack={() => setView('landing')} />;
  if (view === 'privacy') return <PrivacyPolicy onBack={() => setView(currentUser ? 'dashboard' : 'landing')} />;
  if (view === 'terms') return <TermsOfUse onBack={() => setView(currentUser ? 'dashboard' : 'landing')} />;
  if (view === 'manual') return <Manual onBack={() => setView(currentUser ? 'dashboard' : 'landing')} />;
  if (view === 'contact') return <Contact onBack={() => setView(currentUser ? 'dashboard' : 'landing')} />;

  if (currentUser) {
    if (currentUser.email === MASTER_EMAIL && view === 'admin') {
      return <AdminPanel onBack={() => setView('dashboard')} />;
    }
    return isPremium || currentUser.email === MASTER_EMAIL ? (
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
    ) : (
      <SubscriptionBlock onAdminAccess={() => setView('admin')} />
    );
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
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}
