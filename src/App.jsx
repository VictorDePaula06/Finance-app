import { useState, useEffect, useMemo } from 'react';
import TransactionSection from './components/TransactionSection';
import GoalTracker from './components/GoalTracker';
import DebtManagementTab from './components/DebtManagementTab';
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TrendingUp, History, ArrowRight, Wallet, X, Bell, Clock, HelpCircle, CreditCard, BookOpen, Landmark, ChevronDown, Pencil, Trash2, ShieldCheck, Sparkles, Activity, Home, Briefcase, AlertTriangle, Umbrella, Gauge, Target } from 'lucide-react';
import InstallPrompt from './components/InstallPrompt';
import logo from './assets/logo.png';
import AdminPanel from './components/AdminPanel';
import HealthScoreCard from './components/HealthScoreCard';
import { calculateHealthIndex, calculatePatrimonyHealthScore } from './utils/healthScore';
import { db } from './services/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import Manual from './components/Manual';
import PanicButton from './components/PanicButton';
import { generateSundayBreath } from './utils/sundayBreath';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import MonthlyReviewModal from './components/MonthlyReviewModal';
import { generateMonthlyReview } from './services/gemini';
import { CATEGORIES } from './constants/categories';
import aliviaFinal from './assets/alivia/alivia-final.png';

// NEW COMPONENTS
import Hub from './components/Hub';
import Sidebar from './components/Sidebar';
import PatrimonyWelcome from './components/PatrimonyWelcome';
import EvolucaoPatrimonialTab from './components/EvolucaoPatrimonialTab';
import PatrimonioPlaceholderTab from './components/PatrimonioPlaceholderTab';
import FluxoPatrimonialTab from './components/FluxoPatrimonialTab';
import BensImoveisTab from './components/BensImoveisTab';
import SegurosTab from './components/SegurosTab';
import IndependenciaTab from './components/IndependenciaTab';
import SettingsTab from './components/SettingsTab';
import AIChat from './components/AIChat';
import PaceAlerts from './components/PaceAlerts';
import { calculateSpendingPace, getExpenseBasis, isMonthlyExpenseTx, txMonthKey } from './utils/financialLogic';
import { OBJECTIVE_LABELS_SHORT } from './constants/onboarding';
import AnalysisTab from './components/AnalysisTab';
import IncomeTab from './components/IncomeTab';
import CardsTab from './components/CardsTab';
import InvestmentsTab from './components/InvestmentsTab';
import EmergencyReserveTab from './components/EmergencyReserveTab';
import WalletSummary from './components/WalletSummary';
import ExitsTab from './components/ExitsTab';
import { calculateCumulativeBalance } from './utils/financialLogic';
import AliviaConfigForm from './components/AliviaConfigForm';
import OverviewTab from './components/OverviewTab';
import TermsAcceptanceModal from './components/TermsAcceptanceModal';
import CookieConsent from './components/CookieConsent';
import FixedExpensesTab from './components/FixedExpensesTab';
import { useCdiRate, useUsdRate } from './utils/marketRates';
import PremiumPaywall from './components/PremiumPaywall';
import { CURRENT_TERMS_VERSION } from './components/TermsAcceptanceModal';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { TAB_SLUG_TO_ID, TAB_ID_TO_SLUG, DEFAULT_TAB_BY_MODULE, TAB_TO_MODULE, buildTabPath } from './constants/routes';

// CONFIGURAÇÃO MASTER
const MASTER_EMAIL = 'financealivia@gmail.com';

function Dashboard() {
  const { currentUser, saveUserPreferences, getUserPreferences, userPrefs, planLevel, isAdmin } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Deriva module/tab da URL — fonte da verdade é a URL.
  // /inicio              → module=hub
  // /gastos/:tab         → module=gastos, tab=<id mapeado>
  // /patrimonio/:tab     → module=patrimonio, tab=<id mapeado>
  // /ajustes             → module=ÚLTIMO módulo visitado (gastos OU patrimonio),
  //                        tab=ajustes — preserva o contexto da Sidebar.
  const pathParts = location.pathname.split('/').filter(Boolean);
  const urlSegment = pathParts[0] || 'inicio';
  const urlTabSlug = pathParts[1] || '';

  // Recupera o último módulo "real" (gastos/patrimonio) onde o usuário esteve
  // antes de entrar em uma rota transversal como /ajustes. Persistido em
  // sessionStorage para sobreviver a reloads na mesma aba.
  const getLastModule = () => {
    try {
      const stored = sessionStorage.getItem('lastModule');
      return (stored === 'patrimonio' || stored === 'gastos') ? stored : 'gastos';
    } catch { return 'gastos'; }
  };

  const moduleFromUrl =
    urlSegment === 'inicio'      ? 'hub'
    : urlSegment === 'patrimonio' ? 'patrimonio'
    : urlSegment === 'gastos'     ? 'gastos'
    : urlSegment === 'ajustes'    ? getLastModule() // preserva contexto
    : 'gastos';

  const tabFromUrl =
    urlSegment === 'inicio'  ? 'visao'
    : urlSegment === 'ajustes' ? 'ajustes'
    : urlTabSlug ? (TAB_SLUG_TO_ID[urlTabSlug] || urlTabSlug)
    : (DEFAULT_TAB_BY_MODULE[moduleFromUrl] || 'visao');

  // Persiste o último módulo "real" para o /ajustes saber a quem pertencer.
  useEffect(() => {
    if (moduleFromUrl === 'gastos' || moduleFromUrl === 'patrimonio') {
      try {
        sessionStorage.setItem('lastModule', moduleFromUrl);
      } catch { /* sessionStorage indisponível */ }
    }
  }, [moduleFromUrl]);

  const [transactions, setTransactions] = useState([]);
  const [savingsJars, setSavingsJars] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [goals, setGoals] = useState([]);
  const [debts, setDebts] = useState([]);
  const [cards, setCards] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [fixedExpensesList, setFixedExpensesList] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // State interno sincronizado com a URL (single source of truth = URL)
  const [activeModule, _setActiveModule] = useState(moduleFromUrl);
  const [activeTab, _setActiveTab] = useState(tabFromUrl);

  // Sincroniza URL → state quando a URL muda (ex: voltar do navegador)
  useEffect(() => {
    if (activeModule !== moduleFromUrl) _setActiveModule(moduleFromUrl);
    if (activeTab !== tabFromUrl) _setActiveTab(tabFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleFromUrl, tabFromUrl]);

  // Wrappers que navegam pela URL (a URL change vai atualizar o state via useEffect acima)
  const setActiveModule = (mod) => {
    if (mod === 'hub') {
      navigate('/inicio');
    } else {
      const defaultTab = DEFAULT_TAB_BY_MODULE[mod] || 'visao';
      navigate(buildTabPath(mod, defaultTab));
    }
  };
  const setActiveTab = (tabId) => {
    // Ajustes é overlay especial — URL própria /ajustes
    if (tabId === 'ajustes') {
      navigate('/ajustes');
      return;
    }
    // Aba 'manual' é a antiga aba interna do Manual — vira /manual
    if (tabId === 'manual') {
      navigate('/manual');
      return;
    }
    const mod = TAB_TO_MODULE[tabId] || activeModule || 'gastos';
    if (mod === 'common' || mod === 'hub') {
      navigate(buildTabPath('gastos', tabId));
    } else {
      navigate(buildTabPath(mod, tabId));
    }
  };
  const [showReservesList, setShowReservesList] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showMonthlyReview, setShowMonthlyReview] = useState(false);
  const [showInvestmentHistory, setShowInvestmentHistory] = useState(false);
  const [monthlyReviewText, setMonthlyReviewText] = useState('');
  const [previousMonthStats, setPreviousMonthStats] = useState({ income: 0, expense: 0, balance: 0, topCategory: '' });
  const [previousMonthName, setPreviousMonthName] = useState('');
  const cdiRate = useCdiRate();
  const usdRate = useUsdRate();
  const [editingJar, setEditingJar] = useState(null);
  const [jarDeleteConfirm, setJarDeleteConfirm] = useState(null);
  const [showAliviaConfig, setShowAliviaConfig] = useState(false);
  const [isAcceptingTerms, setIsAcceptingTerms] = useState(false);

  // LGPD: usuário precisa re-aceitar se nunca aceitou OU se a versão mudou.
  const needsToAcceptTerms = userPrefs && (
    userPrefs.hasAcceptedTerms !== true ||
    userPrefs.termsVersion !== CURRENT_TERMS_VERSION
  );

  const handleAcceptTerms = async () => {
    setIsAcceptingTerms(true);
    try {
      const acceptedAt = new Date().toISOString();
      // Salva versão + timestamp nas preferências do usuário
      await saveUserPreferences({
        hasAcceptedTerms: true,
        termsVersion: CURRENT_TERMS_VERSION,
        termsAcceptedAt: acceptedAt,
      });

      // Cria log imutável de auditoria (LGPD art. 8º — comprovação de consentimento).
      // A regra do Firestore impede update/delete nesta subcoleção.
      if (currentUser?.uid) {
        try {
          await addDoc(collection(db, 'users', currentUser.uid, 'terms_log'), {
            termsVersion: CURRENT_TERMS_VERSION,
            acceptedAt,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          });
        } catch (logErr) {
          // Falha no log não bloqueia o usuário (best-effort).
          console.warn('[Termos] log de auditoria falhou:', logErr?.message);
        }
      }
    } finally {
      setIsAcceptingTerms(false);
    }
  };

  const [manualConfig, setManualConfig] = useState({
    income: '',
    fixedExpenses: '',
    variableEstimate: '',
    invested: '',
    categoryBudgets: {},
    recurringSubs: []
  });

  const [hideBalance, setHideBalance] = useState(() => localStorage.getItem('hideBalance') === 'true');

  const toggleHideBalance = () => {
    const newValue = !hideBalance;
    setHideBalance(newValue);
    localStorage.setItem('hideBalance', String(newValue));
  };

  const updateManualConfig = (newConfig) => {
    setManualConfig(newConfig);
    localStorage.setItem('financialAdvisorSettings', JSON.stringify(newConfig));
    saveUserPreferences({ manualConfig: newConfig });
  };

  const handleDeleteJar = async (id) => {
    try {
      await deleteDoc(doc(db, 'savings_jars', id));
      setJarDeleteConfirm(null);
    } catch (err) {
      console.error("Erro ao excluir reserva:", err);
    }
  };

  const handleUpdateJar = async (e) => {
    e.preventDefault();
    if (!editingJar) return;
    try {
      const { id, name, balance, cdiPercent } = editingJar;
      await updateDoc(doc(db, 'savings_jars', id), {
        name,
        balance: parseFloat(balance),
        cdiPercent: parseFloat(cdiPercent),
        updatedAt: new Date().toISOString()
      });
      setEditingJar(null);
    } catch (err) {
      console.error("Erro ao atualizar reserva:", err);
    }
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
    const handler = (e) => {
      if (e.detail && typeof e.detail === 'object') {
        updateManualConfig(e.detail);
      }
    };
    window.addEventListener('onboarding-complete', handler);
    return () => window.removeEventListener('onboarding-complete', handler);
  }, []);

  // Eventos de navegação cross-component (AliviaConfigForm → aba específica)
  useEffect(() => {
    const handler = (e) => {
      if (typeof e.detail === 'string') {
        setActiveTab(e.detail);
        setActiveModule('gastos'); // navegação dentro do módulo de gastos
      }
    };
    window.addEventListener('navigate-tab', handler);
    return () => window.removeEventListener('navigate-tab', handler);
  }, []);

  // Abre o perfil completo da Alívia (AliviaConfigForm) a partir da config unificada.
  useEffect(() => {
    const handler = () => setShowAliviaConfig(true);
    window.addEventListener('open-alivia-config', handler);
    return () => window.removeEventListener('open-alivia-config', handler);
  }, []);

  // CDI agora vem do hook compartilhado useCdiRate (cache global). Não precisa fetch local.

  useEffect(() => {
    if (!currentUser) return;

    // Listen to Transactions
    const qT = query(collection(db, 'transactions'), where('userId', '==', currentUser.uid), orderBy('date', 'desc'));
    const unsubscribeTransactions = onSnapshot(qT, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoadingData(false);
    }, (err) => {
      console.warn("[Dev] Erro ao buscar transações:", err);
      setIsLoadingData(false);
    });

    // Listen to Goals
    const qGoals = query(collection(db, 'goals'), where('userId', '==', currentUser.uid));
    const unsubscribeGoals = onSnapshot(qGoals, (snapshot) => {
      setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to Debts (dívidas)
    const qDebts = query(collection(db, 'debts'), where('userId', '==', currentUser.uid));
    const unsubscribeDebts = onSnapshot(qDebts, (snapshot) => {
      setDebts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

    // Listen to Fixed Expenses
    const qFE = query(collection(db, 'fixed_expenses'), where('userId', '==', currentUser.uid));
    const unsubFE = onSnapshot(qFE, (snapshot) => {
      setFixedExpensesList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to Savings Jars
    const qSavings = query(collection(db, 'savings_jars'), where('userId', '==', currentUser.uid));
    const unsubscribeSavings = onSnapshot(qSavings, { includeMetadataChanges: true }, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log("[Dev] Dados de Investimentos (savings_jars) recebidos:", data);
      setSavingsJars(data);
    }, (err) => {
      console.warn("[Dev] Erro de conexão ao buscar investimentos:", err);
    });

    // Listen to Investments (carteira de ativos do módulo Patrimônio)
    const qInv = query(collection(db, 'investments'), where('userId', '==', currentUser.uid));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      setInvestments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, () => {});

    return () => {
      unsubscribeTransactions();
      unsubscribeGoals();
      unsubscribeDebts();
      unsubC();
      unsubS();
      unsubFE();
      unsubscribeSavings();
      unsubInv();
    };
  }, [currentUser]);

  const handleAIChatAddTransaction = async (data) => {
    if (!currentUser) return false;
    try {
      const dateStr = data.date || new Date().toISOString().split('T')[0];
      const transactionData = {
        ...data,
        userId: currentUser.uid,
        createdAt: Date.now(),
        date: dateStr,
        month: dateStr.slice(0, 7),
        amount: parseFloat(data.amount) || 0
      };
      if (transactionData.paymentMethod === 'credito') {
          transactionData.invoiceStatus = 'unpaid';
      }
      await addDoc(collection(db, 'transactions'), transactionData);
      return true;
    } catch (error) {
      console.error("Erro ao adicionar transação via AI:", error);
      return false;
    }
  };

  const handleSetInitialBalance = async (amount) => {
    if (!currentUser) return;
    const now = new Date();
    await addDoc(collection(db, 'transactions'), {
      description: 'Saldo Inicial',
      amount: parseFloat(amount),
      type: 'income',
      category: 'initial_balance',
      date: now.toISOString(),
      month: now.toISOString().slice(0, 7),
      userId: currentUser.uid,
      createdAt: Date.now(),
    });
  };

  const handleAIChatDeleteTransaction = async (id) => {
    if (!currentUser) return false;
    try {
      await deleteDoc(doc(db, 'transactions', id));
      return true;
    } catch (error) {
      console.error("Erro ao deletar transação via AI:", error);
      return false;
    }
  };


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

          // ── Dados CORRETOS (mesma lógica do saldo/visão geral) ──
          const sumv = (arr) => arr.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
          const realExpenses = prevTransactions.filter(t => t.type === 'expense' && !['investment', 'vault'].includes(t.category) && t.paymentMethod !== 'credito');
          const realIncomeV = sumv(prevTransactions.filter(t => t.type === 'income' && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category)));
          const realExpenseV = sumv(realExpenses);
          const creditSpend = sumv(prevTransactions.filter(t => t.type === 'expense' && t.paymentMethod === 'credito'));
          const invested = sumv(prevTransactions.filter(t => t.type === 'expense' && ['investment', 'vault'].includes(t.category)));
          const catReal = {};
          realExpenses.forEach(t => { catReal[t.category] = (catReal[t.category] || 0) + (parseFloat(t.amount) || 0); });
          let rTopId = 'other', rMax = 0;
          Object.entries(catReal).forEach(([id, v]) => { if (v > rMax) { rMax = v; rTopId = id; } });
          const rTopLabel = CATEGORIES.expense.find(c => c.id === rTopId)?.label || 'Outros';
          const superfluous = sumv(realExpenses.filter(t => t.priority === 'superfluous'));
          const rich = {
            income: realIncomeV, expense: realExpenseV, balance: realIncomeV - realExpenseV,
            creditSpend, invested, superfluous,
            topCategory: rTopLabel, topValue: rMax,
            reserve: investmentStats?.totalGuarded || 0,
            monthName: prevMonthNameFull,
          };

          const stats = { income, expense, balance: income - expense, topCategory: topCatLabel, rich };
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

  const paceAlerts = useMemo(() => calculateSpendingPace(transactions, manualConfig), [transactions, manualConfig]);

  // GLOBAL WALLET STATS
  const walletStats = useMemo(() => {
    // Usar ISO string para garantir compatibilidade entre navegadores (YYYY-MM-DD)
    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const filtered = transactions.filter(t => {
        const txMonth = t.month || (t.date ? t.date.slice(0, 7) : '');
        return txMonth === currentMonthKey;
    });
    
    const income = filtered
        .filter(t => t.type === 'income' && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category))
        .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

    // GASTOS NO MÊS conforme o REGIME de apuração escolhido pelo usuário
    // (competência ou caixa) — ver helper isMonthlyExpenseTx.
    const basis = getExpenseBasis(manualConfig);
    const expense = transactions
        .filter(t => isMonthlyExpenseTx(t, basis) && txMonthKey(t) === currentMonthKey)
        .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    
    // O Saldo Acumulado deve considerar o histórico total do usuário
    const balance = calculateCumulativeBalance(transactions, currentMonthKey);
    
    return { income, expense, balance };
  }, [transactions, manualConfig]);

  // INVESTMENT STATS FOR OVERVIEW
  const investmentStats = useMemo(() => {
    const jarsWithBalance = savingsJars.map(curr => {
        const cdiAnual = cdiRate / 100;
        const percent = (curr.cdiPercent || 100) / 100;
        const dailyRate = Math.pow(1 + (cdiAnual * percent), 1 / 365) - 1;
        const lastUpdate = curr.updatedAt ? new Date(curr.updatedAt) : (curr.createdAt ? new Date(curr.createdAt) : new Date());
        const diffDays = Math.max(0, new Date() - lastUpdate) / (1000 * 60 * 60 * 24);
        const dynamicBalance = (parseFloat(curr.balance) || 0) * Math.pow(1 + dailyRate, diffDays);
        const dailyYield = dynamicBalance * dailyRate;
        return { ...curr, dynamicBalance, dailyYield };
    });

    const totalGuarded = jarsWithBalance.reduce((acc, curr) => acc + curr.dynamicBalance, 0);
    
    const dailyYield = savingsJars.reduce((acc, curr) => {
        const cdiAnual = cdiRate / 100; 
        const percent = (parseFloat(curr.cdiPercent) || 100) / 100;
        const dailyRate = Math.pow(1 + (cdiAnual * percent), 1 / 365) - 1;
        const val = parseFloat(curr.balance) || 0;
        return acc + (val * dailyRate);
    }, 0);
    
    return { totalGuarded, dailyYield, jarsWithBalance };
  }, [savingsJars, cdiRate]);

  // Resumo da carteira de investimentos (valor atual, custo, diversificação por classe)
  const investmentsSummary = useMemo(() => {
    let current = 0, cost = 0; const byClass = {};
    investments.forEach(inv => {
      let c, cur;
      if (inv.type === 'renda_fixa') {
        c = inv.totalApplied || (inv.quantity * inv.purchasePrice) || 0;
        cur = inv.manualCurrentPrice || c;
      } else {
        const usdM = inv.isUSD ? (usdRate || 5) : 1;
        c = (inv.quantity || 0) * (inv.purchasePrice || 0) * usdM;
        cur = (inv.quantity || 0) * (inv.manualCurrentPrice || inv.purchasePrice || 0) * usdM;
      }
      current += cur; cost += c;
      const cls = inv.type || 'outros';
      byClass[cls] = (byClass[cls] || 0) + cur;
    });
    return { current, cost, byClass, count: investments.length };
  }, [investments, usdRate]);

  // Auto-calculate fixed expenses: gastos fixos cadastrados + assinaturas do cartão
  const autoFixedExpenses = useMemo(() => {
    const fixed = fixedExpensesList.reduce((acc, e) => acc + (parseFloat(e.value) || 0), 0);
    const subs = subscriptions
      .filter(s => !s.isInstallment) // only recurring, not installments
      .reduce((acc, s) => acc + (parseFloat(s.value) || 0), 0);
    return fixed + subs;
  }, [fixedExpensesList, subscriptions]);

  const effectiveConfig = { ...manualConfig, fixedExpenses: autoFixedExpenses || manualConfig.fixedExpenses };
  // Índice de Saúde Financeira (Gastos) — reformulado e configurável (sobra, reserva, supérfluos).
  const healthIndex = calculateHealthIndex(transactions, effectiveConfig, investmentStats.totalGuarded);
  // Dívida total em aberto (saldo devedor das dívidas ativas).
  const totalDebt = useMemo(
    () => debts.reduce((s, d) => (d.paidOff ? s : s + (parseFloat(d.remainingAmount) || 0)), 0),
    [debts]
  );
  // Saúde Patrimonial — função própria (reserva em meses, aportes, progresso de metas, dívidas).
  const patrimonyHealthScore = calculatePatrimonyHealthScore(transactions, effectiveConfig, investmentStats, goals, investmentsSummary, totalDebt);
  // O card da sidebar usa a saúde do módulo ativo.
  const sidebarHealthScore = activeModule === 'patrimonio' ? patrimonyHealthScore : healthIndex;

  if (activeModule === 'hub') {
    return (
      <Hub
        onSelectModule={(mod) => {
          // Patrimônio: Free, Standard e Premium acessam (Free/Standard com limites).
          // setActiveModule (wrapper que navega) já leva pra aba default do módulo
          setActiveModule(mod);
        }}
      />
    );
  }

  return (
    <div className={`sidebar-layout transition-colors duration-500 ${
      theme === 'light' ? 'theme-light' : 'theme-dark'
    }`}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} activeModule={activeModule} setActiveModule={setActiveModule} healthScore={sidebarHealthScore} />

      <main className="main-content relative z-10 p-4 md:p-12 overflow-x-hidden">
        <InstallPrompt />
        
        <div className="max-w-6xl mx-auto space-y-10 pb-32">
          
          {/* TOP BAR — barra slim de ações. Fora da Visão Geral, vira o cabeçalho
              mobile com título + menu; na Visão Geral é só uma faixa de ações. */}
          <div className={`animate-in fade-in slide-in-from-top-4 duration-700 ${
            activeTab === 'visao'
              ? 'flex items-center justify-between gap-2 lg:hidden'
              : `flex items-center justify-between lg:hidden p-4 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'}`
          }`}>
            <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
              {/* Botão de menu (mobile) */}
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

              {/* Título — só fora da Visão Geral */}
              {activeTab !== 'visao' && (
                <div className="min-w-0">
                  <h2 className={`text-base md:text-2xl font-black truncate ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                    <span className="capitalize text-emerald-500">{activeTab}</span>
                  </h2>
                  <p className="text-[9px] md:text-xs text-slate-500 font-mono opacity-80 truncate">Alívia Financeira</p>
                </div>
              )}
            </div>

            {/* Ações do topo movidas: a config fica no botão "Configurar" da Visão Geral. */}
            <div className="shrink-0" />
          </div>

          {activeTab === 'visao' && (() => {
            // Visão Geral unificada (layout em 2 colunas) — ativa em produção.
            const isLocalhost = true;
            const fmtMoney = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            // Análise da Alívia (Visão Geral · Gastos): reserva, supérfluos, sobra do mês.
            const aliviaCard = (() => {
              const cm = new Date().toISOString().slice(0, 7);
              // Gastos do mês conforme o regime configurado (competência/caixa).
              const basis = getExpenseBasis(manualConfig);
              const exp = transactions.filter(t => isMonthlyExpenseTx(t, basis) && txMonthKey(t) === cm);
              const sum = (a) => a.reduce((x, t) => x + (parseFloat(t.amount) || 0), 0);
              const essential = sum(exp.filter(t => (t.priority || 'comfort') === 'essential'));
              const superf = sum(exp.filter(t => t.priority === 'superfluous'));
              const totalExp = sum(exp);
              const supPct = totalExp > 0 ? Math.round((superf / totalExp) * 100) : 0;
              const reserveMonths = healthIndex?.pillars?.reserve?.months || 0;
              const reserveAmount = investmentStats?.totalGuarded || 0;
              const sobrou = (walletStats.income || 0) - (walletStats.expense || 0);
              const hasDebt = totalDebt > 0.005;
              const accent = hasDebt ? 'text-rose-400' : (sobrou >= 0 && supPct <= 30 && reserveMonths >= 6 ? 'text-emerald-400' : (sobrou < 0 || supPct > 30) ? 'text-amber-400' : 'text-blue-400');
              // Personalização com base no que o usuário preencheu no onboarding.
              const ob = userPrefs?.onboarding || {};
              const primaryObjective = (ob.objectives || []).find(o => o !== 'debt') || (ob.objectives || [])[0] || '';
              const objLabel = OBJECTIVE_LABELS_SHORT[primaryObjective] || '';
              const aporteAlvo = parseFloat(ob.monthlyContribution) || 0;
              return (
                <div className={`p-5 rounded-2xl border ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-[#1e2330] border-slate-700/50'}`}>
                  <div className="flex items-start gap-3">
                    <img src={aliviaFinal} alt="Alívia" className="w-11 h-11 object-cover rounded-full border-2 border-white/20 shadow-md shrink-0" />
                    <div className="min-w-0">
                      <span className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${accent}`}>Alívia · análise do mês</span>
                      {hasDebt && (
                        <p className={`text-[12px] leading-relaxed mb-1.5 font-medium ${theme === 'light' ? 'text-rose-600' : 'text-rose-300'}`}>
                          ⚠️ Prioridade: você tem <span className="font-bold">R$ {fmtMoney(totalDebt)}</span> em dívidas. Quitar a dívida vem antes de qualquer investimento — <button onClick={() => { setActiveModule('patrimonio'); setActiveTab('dividas'); }} className="font-black text-rose-500 hover:text-rose-400 underline">gerenciar dívidas →</button>
                        </p>
                      )}
                      <p className={`text-[12px] leading-relaxed ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                        Este mês os gastos essenciais somaram <span className="font-bold">R$ {fmtMoney(essential)}</span> e os supérfluos <span className="font-bold">R$ {fmtMoney(superf)}</span> ({supPct}% dos gastos{supPct > 30 ? ' — acima do ideal de 30%' : ' — dentro do ideal'}).
                      </p>
                      <p className={`text-[12px] leading-relaxed mt-1.5 ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                        {sobrou >= 0 ? <>Você está no positivo este mês: sobram <span className="font-bold text-emerald-500">R$ {fmtMoney(sobrou)}</span>.</> : <>Atenção: você gastou <span className="font-bold text-rose-500">R$ {fmtMoney(Math.abs(sobrou))}</span> a mais do que ganhou neste mês.</>}
                      </p>
                      <p className={`text-[12px] leading-relaxed mt-1.5 ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                        {reserveAmount > 0
                          ? <>Sua reserva de emergência é de <span className="font-bold text-emerald-500">R$ {fmtMoney(reserveAmount)}</span> ({reserveMonths.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {reserveMonths === 1 ? 'mês' : 'meses'} de cobertura){reserveMonths < 6 ? ' — mire ao menos 6 meses.' : ' — ótimo nível!'}</>
                          : <>Você ainda não tem reserva de emergência registrada — comece a construir uma para mais tranquilidade.</>}
                      </p>
                      {!hasDebt && (objLabel || aporteAlvo > 0) && (
                        <p className={`text-[12px] leading-relaxed mt-1.5 ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                          {objLabel && <>Seu objetivo é <span className="font-bold text-emerald-500">{objLabel}</span>. </>}
                          {aporteAlvo > 0
                            ? (sobrou >= aporteAlvo
                                ? <>Sua meta de aporte é <span className="font-bold">R$ {fmtMoney(aporteAlvo)}/mês</span> — e a sobra deste mês já cobre isso. <span className="font-bold text-emerald-500">Bom momento para investir.</span></>
                                : sobrou > 0
                                  ? <>Sua meta de aporte é <span className="font-bold">R$ {fmtMoney(aporteAlvo)}/mês</span>; este mês sobraram <span className="font-bold">R$ {fmtMoney(sobrou)}</span> — faltam <span className="font-bold text-amber-500">R$ {fmtMoney(aporteAlvo - sobrou)}</span> para o aporte completo.</>
                                  : <>Sua meta de aporte é <span className="font-bold">R$ {fmtMoney(aporteAlvo)}/mês</span>, mas este mês não houve sobra — reveja os gastos supérfluos para conseguir investir.</>)
                            : <>Defina um aporte mensal em <span className="font-semibold">Construção de Patrimônio</span> para a Alívia acompanhar seu ritmo de investimento.</>}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })();
            const overview = (
              <OverviewTab
                transactions={transactions}
                savingsJars={savingsJars}
                walletStats={walletStats}
                investmentStats={investmentStats}
                healthIndex={healthIndex}
                manualConfig={manualConfig}
                onUpdateConfig={updateManualConfig}
                theme={theme}
                hideBalance={hideBalance}
                toggleHideBalance={toggleHideBalance}
                cards={cards}
                subscriptions={subscriptions}
                setActiveTab={setActiveTab}
                setEditingJar={setEditingJar}
                setJarDeleteConfirm={setJarDeleteConfirm}
                baseIncome={parseFloat(manualConfig.income) || 0}
                onUpdateBaseIncome={(val) => updateManualConfig({ ...manualConfig, income: val })}
                onSetInitialBalance={handleSetInitialBalance}
              />
            );

            // Metas de Gasto — só categorias perto/acima do teto (relatório de Análise de Gastos).
            const metasCard = (() => {
              const budgets = manualConfig.categoryBudgets || {};
              const cm = new Date().toISOString().slice(0, 7);
              const spentByCat = {};
              transactions
                .filter(t => t.type === 'expense' && !['investment', 'vault', 'credit_card_bill'].includes(t.category) && ((t.date?.slice(0, 7)) || t.month) === cm)
                .forEach(t => { const c = t.category || 'other'; spentByCat[c] = (spentByCat[c] || 0) + (parseFloat(t.amount) || 0); });
              const withBudget = CATEGORIES.expense.filter(c => parseFloat(budgets[c.id]) > 0);
              const rows = withBudget
                .map(c => { const ceiling = parseFloat(budgets[c.id]) || 0; const spent = spentByCat[c.id] || 0; const ratio = ceiling > 0 ? spent / ceiling : 0; return { id: c.id, label: c.label, icon: c.icon, ceiling, spent, ratio }; })
                .sort((a, b) => b.ratio - a.ratio);
              return (
                <div className={`flex-1 min-h-0 flex flex-col rounded-2xl border p-5 ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-[#1e2330] border-slate-700/50'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}><Gauge className="w-4 h-4 text-indigo-400" /> Metas de Gasto</h3>
                    <button onClick={() => setActiveTab('analise_metas')} className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-300">Ver tudo →</button>
                  </div>
                  {withBudget.length === 0 ? (
                    <p className="text-xs text-slate-500 italic text-center py-6">Defina tetos por categoria em <button onClick={() => setActiveTab('analise_metas')} className="text-blue-400 font-bold">Metas de Gasto</button>.</p>
                  ) : (
                    <div className="space-y-4 overflow-y-auto custom-scrollbar pr-1 flex-1 min-h-0">
                      {rows.map(r => {
                        const pct = Math.min(100, r.ratio * 100);
                        const over = r.ratio >= 1;
                        const near = !over && r.ratio >= 0.85;
                        const col = over ? '#fb7185' : near ? '#fbbf24' : '#34d399';
                        const Icon = r.icon;
                        const fmtv = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        return (
                          <div key={r.id} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-2 min-w-0">
                                {Icon && <Icon className="w-4 h-4 shrink-0 text-slate-400" />}
                                <span className={`text-[13px] font-medium truncate ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>{r.label}</span>
                              </span>
                              <span className="flex items-center gap-2 shrink-0">
                                {over && <span className="text-[8px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-400">acima</span>}
                                <span className="text-[12px] font-semibold tabular-nums" style={{ color: col }}>{Math.round(r.ratio * 100)}%</span>
                              </span>
                            </div>
                            <div className={`w-full h-1.5 rounded-full overflow-hidden ${theme === 'light' ? 'bg-slate-100' : 'bg-white/[0.06]'}`}>
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(4, pct)}%`, background: col }} />
                            </div>
                            <p className="text-[10px] text-slate-400 tabular-nums">R$ {fmtv(r.spent)} <span className="opacity-50">de</span> R$ {fmtv(r.ceiling)}{!over && <span className="opacity-70"> · restam R$ {fmtv(r.ceiling - r.spent)}</span>}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })();

            const compromissos = (
              <div className={`rounded-2xl border ${isLocalhost ? 'p-5' : 'p-8 rounded-[2.5rem]'} ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'}`}>
                <h3 className={`text-xs font-black uppercase tracking-widest text-slate-500 ${isLocalhost ? 'mb-4' : 'mb-6'} flex items-center gap-2`}>
                  <Clock className="w-4 h-4 text-blue-500" /> Próximos Compromissos
                </h3>
                <div className={isLocalhost ? 'space-y-2.5' : 'space-y-4'}>
                  {(() => {
                      // Mês da fatura (ciclo) de uma compra, conforme o dia de fechamento.
                      const invoiceMonthOf = (dateStr, closingDay) => {
                          const d = new Date(dateStr); if (isNaN(d.getTime())) return '';
                          let month = d.getMonth(), year = d.getFullYear();
                          if (d.getDate() >= closingDay) { month += 1; if (month > 11) { month = 0; year += 1; } }
                          return `${year}-${String(month + 1).padStart(2, '0')}`;
                      };
                      const nowD = new Date();
                      const todayD = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate());
                      const consolidated = [
                          ...subscriptions.filter(s => !s.cardId).map(s => {
                              const day = parseInt(s.day) || 1;
                              let due = new Date(nowD.getFullYear(), nowD.getMonth(), day);
                              if (due < todayD) due = new Date(nowD.getFullYear(), nowD.getMonth() + 1, day);
                              return { id: s.id, name: s.name, value: parseFloat(s.value) || 0, day, sortKey: due.getTime(), type: 'sub' };
                          }),
                          ...cards.map(card => {
                              const closingDay = card.closingDay || ((card.dueDay - 7 > 0) ? card.dueDay - 7 : 25);
                              const dueDay = card.dueDay || 10;
                              const unpaid = transactions.filter(t => t.selectedCardId === card.id && t.invoiceStatus === 'unpaid');
                              // Agrupa as compras não pagas por CICLO de fatura.
                              const byCycle = {};
                              unpaid.forEach(t => { const m = invoiceMonthOf(t.date || nowD.toISOString(), closingDay); if (m) byCycle[m] = (byCycle[m] || 0) + (parseFloat(t.amount) || 0); });
                              // Assinaturas do cartão entram na fatura corrente.
                              const cardSubs = subscriptions.filter(s => s.cardId === card.id).reduce((acc, s) => acc + (parseFloat(s.value) || 0), 0);
                              const currInv = invoiceMonthOf(nowD.toISOString(), closingDay);
                              if (cardSubs > 0) byCycle[currInv] = (byCycle[currInv] || 0) + cardSubs;
                              // Próxima fatura a vencer = ciclo mais antigo em aberto.
                              const cycles = Object.keys(byCycle).sort();
                              const nearest = cycles[0];
                              const value = nearest ? byCycle[nearest] : 0;
                              if (value <= 0.005) return null;
                              const [iy, im] = nearest.split('-').map(Number);
                              const dueDate = new Date(iy, im - 1, dueDay);
                              return { id: card.id, name: `Fatura ${card.name || card.brand}`, value, day: dueDay, sortKey: dueDate.getTime(), type: 'card' };
                          }).filter(Boolean)
                      ].sort((a, b) => a.sortKey - b.sortKey).slice(0, isLocalhost ? 5 : 4);

                      return consolidated.map(item => (
                          <div key={item.id} className={`flex items-center justify-between ${isLocalhost ? 'p-3' : 'p-4'} rounded-2xl ${theme === 'light' ? 'bg-slate-50' : 'bg-white/5'}`}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`${isLocalhost ? 'w-9 h-9' : 'w-10 h-10'} rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 ${item.type === 'card' ? 'bg-violet-500/10 text-violet-500' : 'bg-blue-500/10 text-blue-500'}`}>{item.day}</div>
                              <span className={`text-sm font-bold truncate ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>{item.name}</span>
                            </div>
                            <span className="text-sm font-black text-emerald-500 shrink-0">R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                      ));
                  })()}
                  {subscriptions.length === 0 && cards.length === 0 && (
                    <p className="text-xs text-slate-500 italic text-center py-4">Nenhum compromisso para este mês.</p>
                  )}
                </div>
              </div>
            );

            if (isLocalhost) {
              return (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="min-w-0">{overview}</div>
                  <div className="flex flex-col gap-4 min-w-0">
                    {aliviaCard}
                    {metasCard}
                    {compromissos}
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {overview}
                {paceAlerts.length > 0 && <PaceAlerts paceAlerts={paceAlerts} />}
                <div className="grid grid-cols-1 gap-8">{compromissos}</div>
              </div>
            );
          })()}

          { activeTab === 'patrimonio' && (
            planLevel === 'premium' || planLevel === 'standard' || planLevel === 'free' || isAdmin ? (
              <PatrimonioTab
                transactions={transactions}
                manualConfig={manualConfig}
                updateManualConfig={updateManualConfig}
                totalDebt={totalDebt}
                onNavigateTab={setActiveTab}
              />
            ) : <div className="p-12 text-center font-bold text-slate-500">Este módulo requer o plano Premium.</div>
          )}

          { activeTab === 'metas' && (
            planLevel === 'premium' || planLevel === 'lifetime' || isAdmin ? (
              <GoalTracker />
            ) : (
              <PremiumPaywall
                title="Metas Financeiras"
                description="Defina objetivos de patrimônio e acompanhe o progresso até alcançá-los."
                icon={Target}
                features={[
                  'Metas de patrimônio com prazo e valor-alvo',
                  'Acompanhamento do progresso em tempo real',
                  'Simulação de quanto guardar por mês',
                  'Alertas ao atingir cada marco',
                ]}
              />
            )
          )}

          { activeTab === 'dividas' && <DebtManagementTab /> }

          { activeTab === 'evolucao' && (
            planLevel === 'premium' || planLevel === 'lifetime' || isAdmin ? (
              <EvolucaoPatrimonialTab />
            ) : (
              <PremiumPaywall
                title="Evolução Patrimonial"
                description="Acompanhe o desempenho real do seu patrimônio comparado ao IBOVESPA, S&P 500 e CDI ao longo do tempo."
                icon={TrendingUp}
                features={[
                  'Gráfico de retorno acumulado com benchmarks reais (Yahoo Finance)',
                  'Performance vs CDI, IBOVESPA e S&P 500',
                  'Comparação por período: 1m, 3m, 6m, 1 ano',
                  'Análise de rentabilidade dos seus ativos',
                ]}
              />
            )
          )}

          { activeTab === 'fluxo' && (
            planLevel === 'premium' || planLevel === 'lifetime' || isAdmin ? (
              <FluxoPatrimonialTab />
            ) : (
              <PremiumPaywall
                title="Fluxo Patrimonial"
                description="Acompanhe a movimentação do seu patrimônio ao longo do tempo: entradas, saídas e a evolução consolidada."
                icon={Activity}
                features={[
                  'Entradas e saídas realizadas por período',
                  'Gráfico de patrimônio acumulado com benchmarks',
                  'Breakdown por origem (aportes, rendimentos, dividendos)',
                  'Variação não realizada e comparativo vs inflação',
                ]}
              />
            )
          )}

          { activeTab === 'bens' && <BensImoveisTab /> }

          { activeTab === 'previdencia' && (
            <PatrimonioPlaceholderTab
              title="Previdência"
              subtitle="Planeje sua aposentadoria e previdência privada"
              icon={Briefcase}
              badge="Novo"
              description="Em breve você poderá consolidar seus planos de previdência (PGBL, VGBL) e projetar sua renda na aposentadoria."
            />
          )}

          { activeTab === 'independencia' && (
            planLevel === 'premium' || planLevel === 'lifetime' || isAdmin ? (
              <IndependenciaTab />
            ) : (
              <PremiumPaywall
                title="Independência Financeira"
                description="Descubra quando você poderá parar de depender do salário, com uma projeção concreta e personalizada."
                icon={TrendingUp}
                features={[
                  'Patrimônio atual, renda desejada e data estimada de independência',
                  'Projeção do patrimônio com efeito dos juros compostos',
                  'Simulador interativo (aporte, taxa e renda desejada)',
                  'Marcos da jornada (25%, 50%, 75%, 100%)',
                ]}
              />
            )
          )}

          { activeTab === 'rebalanceamento' && (
            planLevel === 'premium' || planLevel === 'lifetime' || isAdmin ? (
              <PatrimonioPlaceholderTab
                title="Rebalanceamento"
                subtitle="Mantenha sua carteira alinhada à sua estratégia"
                icon={AlertTriangle}
                badge="Ação"
                description="Em breve você receberá sugestões de rebalanceamento para manter a alocação da sua carteira de acordo com seus objetivos."
              />
            ) : (
              <PremiumPaywall
                title="Rebalanceamento"
                description="Mantenha a alocação da sua carteira de acordo com a sua estratégia e perfil de risco."
                icon={AlertTriangle}
                features={[
                  'Sugestões de rebalanceamento automáticas',
                  'Alocação-alvo por classe de ativo',
                  'Alertas quando a carteira sai do seu perfil',
                  'Acompanhamento contínuo da estratégia',
                ]}
              />
            )
          )}

          { activeTab === 'seguros' && <SegurosTab manualConfig={manualConfig} /> }

          { activeTab === 'cartoes' && <CardsTab transactions={transactions} setActiveTab={setActiveTab} walletStats={walletStats} /> }

          { activeTab === 'reserva' && (planLevel === 'premium' || planLevel === 'standard' || planLevel === 'free' || isAdmin ? <EmergencyReserveTab /> : null) }

          { activeTab === 'investimentos' && (planLevel === 'premium' || planLevel === 'standard' || planLevel === 'free' || isAdmin ? <InvestmentsTab /> : null) }

          {['analise', 'analise_metas', 'analise_comparativo'].includes(activeTab) && (
            <AnalysisTab
              transactions={transactions}
              cards={cards}
              subscriptions={subscriptions}
              manualConfig={manualConfig}
              onUpdateConfig={updateManualConfig}
              initialView={
                activeTab === 'analise_metas' ? 'metas'
                : activeTab === 'analise_comparativo' ? 'comparativo'
                : 'periodo'
              }
            />
          )}

          {/* Entradas: 'entradas' = Recebimentos, 'resgates' = sub-aba Resgates */}
          {(activeTab === 'entradas' || activeTab === 'resgates') && (
            <div className="space-y-10">
              <IncomeTab
                transactions={transactions}
                savingsJars={savingsJars}
                walletStats={walletStats}
                hideBalance={hideBalance}
                toggleHideBalance={toggleHideBalance}
                initialSubTab={activeTab === 'resgates' ? 'resgates' : 'recebimentos'}
                setActiveTab={setActiveTab}
                expenseBasis={getExpenseBasis(manualConfig)}
              />
            </div>
          )}

          {activeTab === 'fixas' && (
            <div className="space-y-10">
              <FixedExpensesTab
                transactions={transactions}
                setActiveTab={setActiveTab}
                walletStats={walletStats}
                hideBalance={hideBalance}
                toggleHideBalance={toggleHideBalance}
                expenseBasis={getExpenseBasis(manualConfig)}
              />
            </div>
          )}

          {/* Lançamentos: 'gastos' = Despesas, 'aportes' = sub-aba Aportes */}
          {(activeTab === 'gastos' || activeTab === 'aportes') && (
            <div className="space-y-10">
              <ExitsTab
                transactions={transactions}
                savingsJars={investmentStats.jarsWithBalance}
                cdiRate={cdiRate}
                cards={cards}
                subscriptions={subscriptions}
                walletStats={walletStats}
                hideBalance={hideBalance}
                toggleHideBalance={toggleHideBalance}
                setActiveTab={setActiveTab}
                initialSubTab={activeTab === 'aportes' ? 'reservas' : 'despesas'}
                expenseBasis={getExpenseBasis(manualConfig)}
              />
            </div>
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
          onAddTransaction={handleAIChatAddTransaction}
          onDeleteTransaction={handleAIChatDeleteTransaction}
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

        {activeModule === 'patrimonio' && !userPrefs?.hasSeenPatrimonyWelcome && (
          <PatrimonyWelcome onComplete={() => {
            window.dispatchEvent(new CustomEvent('patrimony-onboarding-complete'));
          }} />
        )}

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
        {/* MODALS PARA RESERVAS NA VISÃO GERAL */}
        {editingJar && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            <div className={`w-full max-w-md rounded-[3rem] p-8 md:p-10 border animate-in zoom-in-95 duration-300 ${
              theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
            }`}>
              <h3 className={`text-2xl font-black mb-1 text-center ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Editar Reserva</h3>
              <p className="text-slate-500 text-[10px] font-black text-center mb-8 uppercase tracking-widest">Ajuste os detalhes da sua reserva</p>
              <form onSubmit={handleUpdateJar} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Nome da Reserva</label>
                  <input 
                    type="text" required
                    value={editingJar.name}
                    onChange={e => setEditingJar({...editingJar, name: e.target.value})}
                    className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                      theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white'
                    }`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Saldo Base (R$)</label>
                    <input 
                      type="number" step="0.01" required
                      value={editingJar.balance}
                      onChange={e => setEditingJar({...editingJar, balance: e.target.value})}
                      className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                        theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">% do CDI</label>
                    <input 
                      type="number" step="0.1" required
                      value={editingJar.cdiPercent}
                      onChange={e => setEditingJar({...editingJar, cdiPercent: e.target.value})}
                      className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                        theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white'
                      }`}
                    />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setEditingJar(null)} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest ${theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-400'}`}>Cancelar</button>
                  <button type="submit" className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20">Salvar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {jarDeleteConfirm && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            <div className={`w-full max-w-sm rounded-[3rem] p-8 border text-center animate-in zoom-in-95 duration-300 ${
              theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
            }`}>
              <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className={`text-xl font-black mb-2 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Excluir Reserva?</h3>
              <p className="text-slate-500 text-xs font-bold leading-relaxed mb-8">
                Tem certeza que deseja excluir a reserva <span className="text-emerald-500">"{jarDeleteConfirm.name}"</span>? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setJarDeleteConfirm(null)} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest ${theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-400'}`}>Cancelar</button>
                <button onClick={() => handleDeleteJar(jarDeleteConfirm.id)} className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20">Excluir</button>
              </div>
            </div>
          </div>
        )}

        {/* Alívia Config Modal */}
        {showAliviaConfig && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-500">
            <div className={`relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500 custom-scrollbar ${
              theme === 'light' ? 'bg-white' : 'bg-slate-900'
            }`}>
              <AliviaConfigForm 
                manualConfig={manualConfig} 
                onConfigChange={updateManualConfig} 
                onClose={() => setShowAliviaConfig(false)} 
              />
            </div>
          </div>
        )}

        {/* Terms Acceptance Modal */}
        {needsToAcceptTerms && (
          <TermsAcceptanceModal 
            theme={theme} 
            onAccept={handleAcceptTerms} 
            isAccepting={isAcceptingTerms} 
          />
        )}
      </div>
  );
}

import LandingPage from './components/LandingPage';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfUse from './components/TermsOfUse';
import SubscriptionBlock from './components/SubscriptionBlock';
import Contact from './components/Contact';
import PatrimonioTab from './components/PatrimonioTab';

// ─────────────────────────────────────────────────────────────────
// ROTAS DA APLICAÇÃO
//
// Antes era um SPA com URL fixa e state interno (`view`). Agora cada
// tela tem URL própria, navegável, compartilhável e indexável.
//
// Estrutura:
//   /                       → Landing (publicado se não logado)
//   /login                  → Login com Google
//   /politica-privacidade   → Pública sempre
//   /termos                 → Pública sempre
//   /manual                 → Manual público / interno
//   /contato                → Contato
//   /planos                 → SubscriptionBlock (escolha de plano)
//   /inicio                 → Hub (logado, escolhe módulo)
//   /admin                  → AdminPanel (só admins)
//   /*                      → catch-all (redireciona conforme estado)
// ─────────────────────────────────────────────────────────────────

// Componente interno que tem acesso ao navigate via hook
function AppRoutes() {
  const { currentUser, isPremium, getUserPreferences, saveUserPreferences, isDataLoaded, needsPlanSelection, isAdmin, resetUserData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Reset do usuário de teste master (admin)
  useEffect(() => {
    if (currentUser && currentUser.email === MASTER_EMAIL) {
      resetUserData(currentUser.uid);
    }
  }, [currentUser?.uid]);

  // Marca o primeiro acesso bem-vindo quando logado e entra no app
  useEffect(() => {
    if (currentUser && location.pathname.startsWith('/inicio')) {
      getUserPreferences().then(prefs => {
        if (!prefs || !prefs.hasSeenWelcome) {
          saveUserPreferences({ hasSeenWelcome: true });
        }
      });
    }
  }, [currentUser, location.pathname]);

  // Listener legacy de `change-view` — agora redireciona pra navigate
  // (mantém compatibilidade com componentes que ainda disparam o evento).
  useEffect(() => {
    const handler = (e) => {
      const target = e.detail;
      const map = {
        landing:  '/',
        login:    '/login',
        privacy:  '/politica-privacidade',
        terms:    '/termos',
        manual:   '/manual',
        contact:  '/contato',
        dashboard:'/inicio',
        admin:    '/admin',
      };
      if (map[target]) navigate(map[target]);
    };
    window.addEventListener('change-view', handler);
    return () => window.removeEventListener('change-view', handler);
  }, [navigate]);

  // Loading state — evita piscar a tela de planos enquanto dados sobem
  if (currentUser && !isDataLoaded) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 text-sm font-medium">Carregando sua área financeira...</p>
      </div>
    );
  }

  const isNewAccount = currentUser?.metadata?.creationTime &&
                       (new Date() - new Date(currentUser.metadata.creationTime)) < 10000;
  const hasAppAccess = isPremium || isAdmin || isNewAccount;

  return (
    <Routes>
      {/* ─── ROTAS PÚBLICAS ─── */}
      <Route
        path="/"
        element={currentUser ? <Navigate to="/inicio" replace /> : (
          <LandingPage
            onLogin={() => navigate('/login')}
            onViewPrivacy={() => navigate('/politica-privacidade')}
            onViewTerms={() => navigate('/termos')}
            onViewManual={() => navigate('/manual')}
            onViewContact={() => navigate('/contato')}
          />
        )}
      />
      <Route
        path="/login"
        element={currentUser ? <Navigate to="/inicio" replace /> : <Login onBack={() => navigate('/')} />}
      />
      <Route
        path="/politica-privacidade"
        element={<PrivacyPolicy onBack={() => navigate(currentUser ? '/inicio' : '/')} />}
      />
      <Route
        path="/termos"
        element={<TermsOfUse onBack={() => navigate(currentUser ? '/inicio' : '/')} />}
      />
      <Route
        path="/manual"
        element={<Manual onBack={() => navigate(currentUser ? '/inicio' : '/')} />}
      />
      <Route
        path="/contato"
        element={<Contact onBack={() => navigate(currentUser ? '/inicio' : '/')} />}
      />

      {/* ─── ROTAS LOGADAS ─── */}
      <Route
        path="/planos"
        element={
          !currentUser ? <Navigate to="/login" replace />
            : (!needsPlanSelection && hasAppAccess) ? <Navigate to="/inicio" replace />
            : <SubscriptionBlock onAdminAccess={() => isAdmin && navigate('/admin')} />
        }
      />
      {/* Todas as rotas do Dashboard passam pelo mesmo guard.
          Se o usuário não pode entrar, é redirecionado para /login ou /planos. */}
      <Route path="/inicio"            element={!currentUser ? <Navigate to="/login" replace /> : (needsPlanSelection && !isAdmin) ? <Navigate to="/planos" replace /> : !hasAppAccess ? <Navigate to="/planos" replace /> : <Dashboard />} />
      <Route path="/gastos"            element={!currentUser ? <Navigate to="/login" replace /> : (needsPlanSelection && !isAdmin) ? <Navigate to="/planos" replace /> : !hasAppAccess ? <Navigate to="/planos" replace /> : <Navigate to="/gastos/visao-geral" replace />} />
      <Route path="/gastos/:tab"       element={!currentUser ? <Navigate to="/login" replace /> : (needsPlanSelection && !isAdmin) ? <Navigate to="/planos" replace /> : !hasAppAccess ? <Navigate to="/planos" replace /> : <Dashboard />} />
      <Route path="/patrimonio"        element={!currentUser ? <Navigate to="/login" replace /> : (needsPlanSelection && !isAdmin) ? <Navigate to="/planos" replace /> : !hasAppAccess ? <Navigate to="/planos" replace /> : <Navigate to="/patrimonio/visao" replace />} />
      <Route path="/patrimonio/:tab"   element={!currentUser ? <Navigate to="/login" replace /> : (needsPlanSelection && !isAdmin) ? <Navigate to="/planos" replace /> : !hasAppAccess ? <Navigate to="/planos" replace /> : <Dashboard />} />
      <Route path="/ajustes"           element={!currentUser ? <Navigate to="/login" replace /> : (needsPlanSelection && !isAdmin) ? <Navigate to="/planos" replace /> : !hasAppAccess ? <Navigate to="/planos" replace /> : <Dashboard />} />

      {/* Compatibilidade: /dashboard → /inicio */}
      <Route path="/dashboard/*" element={<Navigate to="/inicio" replace />} />

      {/* ─── ROTAS ADMIN ─── */}
      <Route path="/admin"           element={!currentUser ? <Navigate to="/login" replace /> : !isAdmin ? <Navigate to="/inicio" replace /> : <AdminPanel onBack={() => navigate('/inicio')} />} />
      <Route path="/admin/:section"  element={!currentUser ? <Navigate to="/login" replace /> : !isAdmin ? <Navigate to="/inicio" replace /> : <AdminPanel onBack={() => navigate('/inicio')} />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to={currentUser ? '/inicio' : '/'} replace />} />
    </Routes>
  );
}

function AppContent() {
  return <AppRoutes />;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
        <CookieConsent />
      </ThemeProvider>
    </AuthProvider>
  );
}
