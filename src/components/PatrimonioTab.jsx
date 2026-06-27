import { useState, useMemo, useEffect } from 'react';
import { Wallet, PiggyBank, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, Eye, EyeOff, BarChart3, Bot, Loader2, Sparkles, LayoutDashboard, LineChart, Layers, List, HelpCircle, ShieldCheck, Target, Home, Gem, Pencil, Trash2, Save, RefreshCw, Info, Settings } from 'lucide-react';
import aliviaFinal from '../assets/alivia/alivia-final.png';
import AliviaConfigForm from './AliviaConfigForm';
import { calculatePatrimonyHealthScore } from '../utils/healthScore';
import { summarizeInvestments, jarsDynamicTotal, bensTotal as calcBensTotal, investmentMetrics } from '../utils/investmentValue';
import { useLivePrices } from '../hooks/useLivePrices';
import { OBJECTIVE_LABELS_SHORT, RISK_LABELS } from '../constants/onboarding';
import { PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer, AreaChart, Area, LineChart as RLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip } from 'recharts';
import ReactMarkdown from 'react-markdown';
import { generatePatrimonyAnalysis, isGeminiConfigured } from '../services/gemini';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useCdiRate, useUsdRate } from '../utils/marketRates';
// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (v) => Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtSigned = (v) => (v < 0 ? '-' : '') + 'R$ ' + fmt(v);

function BigCard({ label, value, sub, color = 'text-white', bg = 'bg-slate-900 border-white/10', children }) {
  return (
    <div className={`p-7 rounded-[2rem] border flex flex-col gap-2 ${bg}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className={`text-3xl font-black ${color}`}>{fmtSigned(value)}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
      {children}
    </div>
  );
}

function MiniCard({ label, value, icon: Icon, color, isDark, isHidable, isHidden, onToggle, detail, highlight, children }) {
  const bg = highlight
    ? (isDark ? 'bg-blue-600/10 border-blue-500/30' : 'bg-blue-500/10 border-blue-200 shadow-sm')
    : (isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100 shadow-sm');
  return (
    <div className={`p-5 rounded-3xl border flex flex-col items-center text-center relative transition-all hover:scale-[1.02] ${bg}`}>
      {isHidable && (
        <button onClick={onToggle} className={`absolute top-2 right-2 p-1 rounded-lg ${isDark ? 'text-slate-500 hover:bg-white/10' : 'text-slate-400 hover:bg-slate-100'}`}>
          {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      )}
      <div className={`mb-2 p-2.5 rounded-2xl ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
      <span className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
      <span className={`text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
        {isHidable && isHidden ? '••••••' : fmtSigned(value)}
      </span>
      {detail && <span className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{detail}</span>}
      {children}
    </div>
  );
}

// ─── main ──────────────────────────────────────────────────────────────────────
export default function PatrimonioTab({ transactions, manualConfig, updateManualConfig, totalDebt = 0, protectionSummary = {}, onNavigateTab }) {
  const { theme } = useTheme();
  const { currentUser, userPrefs } = useAuth();
  const isDark = theme !== 'light';
  const [showPatrimonioConfig, setShowPatrimonioConfig] = useState(false);
  const [configInitialSection, setConfigInitialSection] = useState(null);
  // Filtro do "Patrimônio Total Consolidado" (persistido) — quais blocos somam no total.
  const [patrimonioFilter, setPatrimonioFilter] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('patrimonioFilter'));
      if (s && typeof s === 'object') return { reserva: s.reserva !== false, investimentos: s.investimentos !== false, bens: s.bens !== false };
    } catch { /* default abaixo */ }
    return { reserva: true, investimentos: true, bens: true };
  });
  const togglePatrimonioFilter = (key) => setPatrimonioFilter(prev => {
    const next = { ...prev, [key]: !prev[key] };
    if (!next.reserva && !next.investimentos && !next.bens) return prev; // mantém ao menos um
    localStorage.setItem('patrimonioFilter', JSON.stringify(next));
    return next;
  });

  // ── state ──────────────────────────────────────────────────────────────────
  const [jars, setJars] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [tangibleAssets, setTangibleAssets] = useState([]);
  const [includeBens, setIncludeBens] = useState(true);
  const cdiAnual = useCdiRate();
  const [hidePatrimonio, setHidePatrimonio] = useState(() => localStorage.getItem('hidePatrimonio') === 'true');
  const usdRate = useUsdRate();
  // Cotações ao vivo + taxas do Tesouro — hook compartilhado (mesma fonte do App,
  // para o card e o medidor da sidebar usarem exatamente os mesmos preços).
  const { livePrices, tesouroData, getTesouroRate: getLiveTesouroRate } = useLivePrices(investments, true);
  const [userConfig, setUserConfig] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('visao');
  const [chartViewMode, setChartViewMode] = useState('category');
  const [sparkRange, setSparkRange] = useState('30D');
  const [includeReserve, setIncludeReserve] = useState(true);
  const [patrimonyGoals, setPatrimonyGoals] = useState([]);

  const [expandAlivia, setExpandAlivia] = useState(false);
  const [expandPlan, setExpandPlan] = useState(false);
  const [showSimModal, setShowSimModal] = useState(false);
  const [simModalYears, setSimModalYears] = useState('');
  const [simModalAporte, setSimModalAporte] = useState('');
  const [simSaving, setSimSaving] = useState(false);


  // ── listeners ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'savings_jars'), where('userId', '==', currentUser.uid));
    return onSnapshot(q, snap => setJars(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'investments'), where('userId', '==', currentUser.uid));
    return onSnapshot(q, snap => setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'tangible_assets'), where('userId', '==', currentUser.uid));
    return onSnapshot(q, snap => setTangibleAssets(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);

  // Valor atual dos bens tangíveis — fonte única (utils/investmentValue).
  const bensTotal = useMemo(() => calcBensTotal(tangibleAssets), [tangibleAssets]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'goals'), where('userId', '==', currentUser.uid));
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPatrimonyGoals(all.filter(g => g.isPatrimonyGoal && g.status === 'active'));
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    import('firebase/firestore').then(({ doc, getDoc }) => {
      getDoc(doc(db, 'users', currentUser.uid)).then(d => {
        if (d.exists()) setUserConfig(d.data());
      });
    });
  }, [currentUser]);

  // CDI, USD e cotações ao vivo vêm de hooks compartilhados (mesma fonte do App).

  // ── calculations ───────────────────────────────────────────────────────────
  // Jars — dynamic balance with CDI accrual since last update
  const { jarsTotal, jarsDynamic } = useMemo(() => {
    const now = new Date();
    let total = 0;
    const dynamic = jars.map(j => {
      const cdiP = (j.cdiPercent || 100) / 100;
      const dailyRate = Math.pow(1 + (cdiAnual / 100) * cdiP, 1 / 365) - 1;
      const lastUpdate = j.updatedAt ? new Date(j.updatedAt) : (j.createdAt ? new Date(j.createdAt) : now);
      const diffDays = Math.max(0, (now - lastUpdate) / (1000 * 60 * 60 * 24));
      const dynBal = (j.balance || 0) * Math.pow(1 + dailyRate, diffDays);
      total += dynBal;
      return { ...j, dynamicBalance: dynBal };
    });
    return { jarsTotal: total, jarsDynamic: dynamic };
  }, [jars, cdiAnual]);

  const { jarsDailyYield, totalDailyYield } = useMemo(() => {
    const jarsYield = jarsDynamic.reduce((a, j) => {
      const cdiP = (j.cdiPercent || 100) / 100;
      const rate = Math.pow(1 + (cdiAnual / 100) * cdiP, 1 / 365) - 1;
      return a + j.dynamicBalance * rate;
    }, 0);

    const fixedIncomeYield = investments.reduce((a, inv) => {
      if (inv.type === 'renda_fixa') {
        let rate = 0;
        // Valor atual da renda fixa = valor manual OU total aplicado (NÃO multiplicar
        // por quantity — totalApplied já é o valor cheio).
        const currentVal = (parseFloat(inv.manualCurrentPrice) || parseFloat(inv.totalApplied) || ((parseFloat(inv.quantity) || 0) * (parseFloat(inv.purchasePrice) || 0))) || 0;
        if (inv.yieldType === 'cdi' && inv.cdiPercent) {
          const cdiP = parseFloat(String(inv.cdiPercent).replace(',', '.'));
          rate = Math.pow(1 + (cdiAnual / 100) * (cdiP / 100), 1 / 365) - 1;
        } else if (inv.yieldType === 'ipca' && inv.fixedRate) {
          const ipcaAnual = 4.5;
          const fixedP = parseFloat(String(inv.fixedRate).replace(',', '.'));
          rate = Math.pow(1 + (ipcaAnual / 100) + (fixedP / 100), 1 / 365) - 1;
        } else if (inv.yieldType === 'pre' && inv.fixedRate) {
          const fixedP = parseFloat(String(inv.fixedRate).replace(',', '.'));
          rate = Math.pow(1 + (fixedP / 100), 1 / 365) - 1;
        } else if (inv.cdiPercent) {
          const cdiP = parseFloat(String(inv.cdiPercent).replace(',', '.'));
          rate = Math.pow(1 + (cdiAnual / 100) * (cdiP / 100), 1 / 365) - 1;
        }
        return a + (currentVal * rate);
      }
      return a;
    }, 0);

    return { jarsDailyYield: jarsYield, totalDailyYield: jarsYield + fixedIncomeYield };
  }, [jarsDynamic, investments, cdiAnual]);

  // Investimentos — fonte única (utils/investmentValue) COM cotação ao vivo.
  const invSummary = useMemo(
    () => summarizeInvestments(investments, { usdRate, livePrices, getTesouroRate: getLiveTesouroRate }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [investments, livePrices, usdRate, tesouroData]
  );
  const investmentsTotal = invSummary.current;
  const investmentsCost = invSummary.cost;
  const investmentsProfit = invSummary.profit;

  const patrimonioTotal = jarsTotal + investmentsTotal + bensTotal;
  // Total exibido conforme o filtro (Reserva / Investimentos / Bens).
  const displayedTotal = (patrimonioFilter.reserva ? jarsTotal : 0)
    + (patrimonioFilter.investimentos ? investmentsTotal : 0)
    + (patrimonioFilter.bens ? bensTotal : 0);

  // Rentabilidade das reservas que têm valor aplicado informado (posição atual − aplicado).
  const reservesProfit = useMemo(() => jars.reduce((acc, j) => {
    if (j.appliedValue != null && j.appliedValue > 0) return acc + ((parseFloat(j.balance) || 0) - j.appliedValue);
    return acc;
  }, 0), [jars]);
  const totalProfit = investmentsProfit + reservesProfit;

  // Saúde Patrimonial usa o MESMO resumo (valor ao vivo + byClass coerente).
  const investmentsSummary = invSummary;

  const patrimonyHealth = useMemo(
    () => calculatePatrimonyHealthScore([], manualConfig, { totalGuarded: jarsTotal }, [], investmentsSummary, totalDebt, protectionSummary),
    [manualConfig, jarsTotal, investmentsSummary, totalDebt, protectionSummary]
  );

  const handleAnalyze = async (force = false) => {
    if (!isGeminiConfigured()) return;
    // Cache: only run every 12h unless forced
    const cacheKey = `alivia_patrimony_${currentUser?.uid}`;
    const cacheTimeKey = `${cacheKey}_time`;
    if (!force) {
      const cached = localStorage.getItem(cacheKey);
      const cachedTime = localStorage.getItem(cacheTimeKey);
      if (cached && cachedTime && (Date.now() - parseInt(cachedTime)) < 12 * 60 * 60 * 1000) {
        setAiAnalysis(cached);
        return;
      }
    }
    setIsAnalyzing(true);
    try {
      const analysis = await generatePatrimonyAnalysis(jarsTotal, investmentsTotal, userConfig);
      setAiAnalysis(analysis);
      localStorage.setItem(cacheKey, analysis);
      localStorage.setItem(cacheTimeKey, String(Date.now()));
    } catch (e) { console.error(e); }
    setIsAnalyzing(false);
  };

  // Auto-generate analysis on mount
  useEffect(() => {
    if (currentUser && jarsTotal + investmentsTotal > 0 && !aiAnalysis && !isAnalyzing) {
      handleAnalyze();
    }
  }, [currentUser, jarsTotal, investmentsTotal]);

  // ── Alívia insight — baseado em perfil, objetivos e ativos ───────────────
  const aliviaInsight = useMemo(() => {
    const objectives  = userPrefs?.onboarding?.objectives || [];
    const riskProfile = userPrefs?.onboarding?.riskProfile || '';
    const hasReserve     = jars.length > 0 && jarsTotal > 0;
    const hasInvestments = investments.length > 0;
    const parts = [];

    // 1. Reserva de emergência
    if (!hasReserve && !hasInvestments) {
      return { pStatus: 'neutral', pMessage: 'Nenhum ativo cadastrado ainda. Comece adicionando sua reserva de emergência ou investimentos para receber análise personalizada.' };
    }
    if (!hasReserve && hasInvestments) {
      parts.push('Sem reserva de emergência — priorize criar uma antes de ampliar a exposição ao risco.');
    } else if (hasReserve) {
      parts.push(`Reserva de emergência ativa (${jars.length} cofre${jars.length > 1 ? 's' : ''}, R$ ${fmt(jarsTotal)}).`);
    }

    // 2. Alinhamento objetivo × perfil de risco
    const profLabel = RISK_LABELS[riskProfile] ? RISK_LABELS[riskProfile].toLowerCase() : riskProfile;
    if (objectives.length > 0 && riskProfile) {
      const obj = objectives[0];
      if (obj === 'debt') {
        parts.push('Foco em sair das dívidas — liquide-as antes de ampliar investimentos de risco.');
      } else if (obj === 'independence' && riskProfile === 'aggressive') {
        parts.push('Perfil arrojado alinhado ao objetivo de independência financeira — caminho certo para crescimento acelerado.');
      } else if (obj === 'independence' && riskProfile === 'conservative') {
        parts.push('Objetivo de independência com perfil conservador — bom para preservar capital, porém o crescimento tende a ser mais lento.');
      } else if (obj === 'start') {
        parts.push(`Iniciando os investimentos com perfil ${profLabel} — ótimo momento para criar consistência nos aportes.`);
      } else {
        parts.push(`Objetivo: ${OBJECTIVE_LABELS_SHORT[obj] || obj}. Perfil ${profLabel} — estratégia alinhada.`);
      }
    } else if (!riskProfile && objectives.length === 0) {
      parts.push('Configure seu perfil e objetivos em "Configurar Alívia" para análise personalizada.');
    }

    // 2b. Meta financeira e aporte mensal informados no onboarding
    const goalValue = parseFloat(userPrefs?.onboarding?.patrimonyGoalValue) || 0;
    const goalType  = userPrefs?.onboarding?.patrimonyGoalType || '';
    const aporte    = parseFloat(userPrefs?.onboarding?.monthlyContribution) || 0;
    const currentTotal = jarsTotal + investmentsTotal;
    if (goalValue > 0) {
      const pct = Math.min(100, Math.round((currentTotal / goalValue) * 100));
      const goalName = goalType === 'imovel' ? 'comprar seu imóvel' : 'atingir seu patrimônio-alvo';
      parts.push(`Meta de R$ ${fmt(goalValue)} para ${goalName}: você já está em ${pct}% do caminho.`);
    }
    if (aporte > 0) {
      parts.push(`Mantendo aportes de R$ ${fmt(aporte)}/mês, você acelera esse ritmo de forma consistente.`);
    }

    // 3. Análise geral dos ativos por categoria
    if (hasInvestments) {
      const TECH_US_SYMS = new Set(['NVDA','AAPL','MSFT','GOOG','GOOGL','META','AMZN','TSLA','AMD','INTC','QCOM','AVGO','CRM','ADBE','SNOW','PLTR','COIN','SHOP','NET','DDOG','SMCI','IVVB11','QQQM','QQQ','SPY','VOO','ARKK','SOXX']);
      const CRYPTO_SYMS  = new Set(['BTC','ETH','SOL','BNB','ADA','XRP','DOT','AVAX','MATIC','DOGE','LTC','LINK','UNI']);
      let hasTechUS = false, hasCrypto = false, hasBR = false, hasFIIs = false, hasOther = false;
      investments.forEach(inv => {
        const sym  = (inv.symbol || '').toUpperCase();
        const type = inv.type || '';
        if (TECH_US_SYMS.has(sym) || (inv.isUSD && type === 'acoes') || (inv.isUSD && type === 'etfs')) hasTechUS = true;
        else if (type === 'crypto' || CRYPTO_SYMS.has(sym)) hasCrypto = true;
        else if (type === 'fiis') hasFIIs = true;
        else if (['acoes','etfs','renda_fixa','imoveis'].includes(type)) hasBR = true;
        else hasOther = true;
      });
      if (hasTechUS)  parts.push('Exposição a grandes empresas de tecnologia dos EUA — boa diversificação internacional.');
      if (hasCrypto)  parts.push('Criptomoedas presentes na carteira — ativos de alta volatilidade, adequados a perfis arrojados.');
      if (hasFIIs)    parts.push('Fundos Imobiliários na carteira — boa fonte de renda passiva em reais.');
      if (hasBR)      parts.push('Ativos do mercado brasileiro presentes — diversificação no mercado doméstico.');
      if (hasOther && !hasTechUS && !hasCrypto && !hasBR && !hasFIIs)
        parts.push('Carteira diversificada — mantenha o acompanhamento regular dos fundamentos.');
    }

    let pStatus = 'neutral';
    if (hasInvestments && hasReserve) pStatus = 'positive';
    else if (hasInvestments && !hasReserve) pStatus = 'warning';
    return { pStatus, pMessage: parts.join(' ') || 'Configure seu patrimônio para receber análise da Alívia.' };
  }, [jars, investments, jarsTotal, userPrefs]);

  // ── Visão Geral: dados derivados ────────────────────────────────────────────
  const allocTotal = jarsTotal + investmentsTotal + bensTotal;
  const allocation = [
    { name: 'Reservas', value: jarsTotal, color: '#10b981' },
    { name: 'Investimentos', value: investmentsTotal, color: '#a855f7' },
    { name: 'Outros Ativos', value: bensTotal, color: '#f59e0b' },
  ].filter(a => a.value > 0);
  const CLASS_LABEL = { renda_fixa: 'Renda Fixa', acoes: 'Ações', fiis: 'Fundos Imobiliários', etfs: 'ETFs', crypto: 'Criptomoedas', imoveis: 'Imóveis', outros: 'Outros' };
  const CLASS_COLOR = { renda_fixa: '#6366f1', acoes: '#a855f7', fiis: '#14b8a6', etfs: '#3b82f6', crypto: '#f59e0b', imoveis: '#f97316', outros: '#64748b' };
  const classRows = Object.entries(invSummary.byClass || {})
    .map(([k, v]) => ({ key: k, name: CLASS_LABEL[k] || 'Outros', value: v, color: CLASS_COLOR[k] || '#64748b' }))
    .filter(r => r.value > 0).sort((a, b) => b.value - a.value);
  const classTotal = classRows.reduce((a, r) => a + r.value, 0);
  const composition = [
    ...(jarsTotal > 0 ? [{ name: 'Reservas', value: jarsTotal, color: '#10b981' }] : []),
    ...classRows.map(r => ({ name: r.name, value: r.value, color: r.color })),
    ...(bensTotal > 0 ? [{ name: 'Outros Ativos', value: bensTotal, color: '#f97316' }] : []),
  ];
  const compTotal = composition.reduce((a, r) => a + r.value, 0);
  const assetOpts = { usdRate, livePrices, getTesouroRate: getLiveTesouroRate };
  const topAssets = investments
    .map(inv => ({ name: inv.name || inv.symbol || 'Ativo', type: CLASS_LABEL[inv.type] || 'Outros', value: investmentMetrics(inv, assetOpts).current }))
    .filter(a => a.value > 0).sort((a, b) => b.value - a.value).slice(0, 5);
  const topAssetsTotal = topAssets.reduce((a, r) => a + r.value, 0);
  const costBasis = Math.max(0, patrimonioTotal - totalProfit);
  const growthPct = costBasis > 0 ? (totalProfit / costBasis) * 100 : 0;
  const invBase = Math.max(0, investmentsTotal - investmentsProfit);
  const easeOut = (t) => 1 - Math.pow(1 - t, 2);
  const sparkData = Array.from({ length: 16 }, (_, i) => ({ i, v: costBasis + (patrimonioTotal - costBasis) * easeOut(i / 15) }));
  const evoData = Array.from({ length: 12 }, (_, i) => {
    const t = i / 11; const d = new Date(); d.setDate(d.getDate() - Math.round((1 - t) * 30));
    return { label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), total: costBasis + (patrimonioTotal - costBasis) * easeOut(t), inv: invBase + (investmentsTotal - invBase) * easeOut(t) };
  });
  const reservePctTotal = allocTotal > 0 ? (jarsTotal / allocTotal * 100) : 0;
  const investPctTotal = allocTotal > 0 ? (investmentsTotal / allocTotal * 100) : 0;
  const bensPctTotal = allocTotal > 0 ? (bensTotal / allocTotal * 100) : 0;
  const goalTarget = patrimonyGoals[0]?.target || 0;
  const goalPct = goalTarget > 0 ? Math.min(100, patrimonioTotal / goalTarget * 100) : 0;
  // Meta de Reserva: quantos meses de despesa a reserva cobre (alvo 12 meses).
  const monthlyExpense = (() => {
    if (!Array.isArray(transactions)) return 0;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    let sum = 0;
    transactions.forEach(t => {
      const isExpense = t.type === 'expense' || (typeof t.amount === 'number' && t.amount < 0);
      const dt = t.date ? new Date(t.date) : (t.createdAt ? new Date(t.createdAt) : null);
      if (isExpense && dt && dt >= cutoff) sum += Math.abs(parseFloat(t.amount) || 0);
    });
    return sum;
  })();
  const reserveGoalMonths = 12;
  const reserveMonths = monthlyExpense > 0 ? jarsTotal / monthlyExpense : 0;
  const reservePctOfGoal = reserveGoalMonths > 0 ? Math.min(100, reserveMonths / reserveGoalMonths * 100) : 0;
  const ovCardBg = isDark ? 'bg-slate-900/80 border-white/[0.06]' : 'bg-white border-slate-100 shadow-sm';
  const ovLabel = isDark ? 'text-slate-500' : 'text-slate-400';
  const DonutTip = ({ active, payload, total }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div className={`px-3 py-2 rounded-xl border shadow-xl text-[11px] ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
        <p className="font-black" style={{ color: d.payload.color }}>{d.name}</p>
        <p className="font-bold">R$ {fmt(d.value)} · {total > 0 ? (d.value / total * 100).toFixed(1) : 0}%</p>
      </div>
    );
  };
  const EvoTip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className={`px-3 py-2 rounded-xl border shadow-xl text-[11px] ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
        <p className="font-black mb-1">{label}</p>
        {payload.map((p, i) => (<p key={i} className="font-bold" style={{ color: p.stroke }}>{p.dataKey === 'total' ? 'Patrimônio' : 'Investimentos'}: R$ {fmt(p.value)}</p>))}
      </div>
    );
  };

  // ── render ─────────────────────────────────────────────────────────────────
  const h1 = isDark ? 'text-white' : 'text-slate-900';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="animate-in fade-in duration-700 pb-4">
      {/* ── HEADER ── */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className={`text-2xl md:text-3xl font-black tracking-tight ${h1}`}>Patrimônio</h1>
          <p className={`text-xs font-bold mt-0.5 ${sub}`}>Visão geral do seu patrimônio e investimentos</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold ${ovLabel}`}>
            <RefreshCw className="w-3 h-3" /> Atualizado agora há pouco
          </span>
          <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-black border ${ovCardBg} ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            Hoje, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} <span className={ovLabel}>▾</span>
          </span>
        </div>
      </div>

      {activeTab === 'visao' && (<>
      {/* ═══ FAIXA SUPERIOR ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">

        {/* ── Patrimônio Total (coluna alta) ── */}
        <div className={`lg:col-span-3 p-5 rounded-[2rem] border relative overflow-hidden flex flex-col ${isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30 border-white/[0.06]' : 'bg-gradient-to-br from-emerald-50 via-white to-emerald-100/60 border-slate-200 shadow-sm'}`}>
          <div className="absolute top-[-30%] right-[-20%] w-[70%] h-[60%] rounded-full blur-[100px] pointer-events-none opacity-[0.12] bg-emerald-400" />
          <div className="relative flex items-center justify-between">
            <p className={`text-[9px] font-black uppercase tracking-[0.25em] ${isDark ? 'text-emerald-400/80' : 'text-emerald-600'}`}>Patrimônio Total</p>
            <button onClick={() => { const v = !hidePatrimonio; setHidePatrimonio(v); localStorage.setItem('hidePatrimonio', String(v)); }} title={hidePatrimonio ? 'Mostrar valores' : 'Ocultar valores'} className={`p-1 rounded-lg ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}>
              {hidePatrimonio ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className={`relative text-3xl font-black tracking-tight leading-none mt-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{hidePatrimonio ? '••••••' : fmtSigned(patrimonioTotal)}</p>
          {!hidePatrimonio && (
            <div className="relative flex items-center gap-1.5 mt-2">
              <span className={`inline-flex items-center gap-1 text-[11px] font-black ${totalProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {totalProfit >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />} {fmtSigned(totalProfit)} ({growthPct >= 0 ? '+' : ''}{growthPct.toFixed(2)}%)
              </span>
              <span className={`text-[9px] font-bold ${ovLabel}`}>no mês</span>
            </div>
          )}
          <div className="relative flex-1 min-h-[64px] mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="patSpark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2} fill="url(#patSpark)" animationDuration={700} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="relative flex justify-between gap-1 mt-3">
            {['7D', '30D', '6M', '1A', 'Todo'].map(r => (
              <button key={r} onClick={() => setSparkRange(r)} className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${sparkRange === r ? 'bg-emerald-500 text-white' : isDark ? 'text-slate-500 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-100'}`}>{r}</button>
            ))}
          </div>
        </div>

        {/* ── Meio: 3 cards + Evolução ── */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`p-4 rounded-2xl border transition-all hover:scale-[1.015] ${ovCardBg}`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-xl ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}><ShieldCheck className="w-4 h-4 text-emerald-500" /></div>
                <span className="text-[10px] font-black text-emerald-500">{reservePctTotal.toFixed(1)}%</span>
              </div>
              <p className={`text-[9px] font-black uppercase tracking-widest ${ovLabel}`}>Reserva de Emergência</p>
              <p className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{hidePatrimonio ? '••••' : fmtSigned(jarsTotal)}</p>
              <p className={`text-[9px] font-bold ${ovLabel}`}>{reservePctTotal.toFixed(1)}% do total</p>
            </div>

            <div className={`p-4 rounded-2xl border transition-all hover:scale-[1.015] ${ovCardBg}`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-xl ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}><TrendingUp className="w-4 h-4 text-purple-500" /></div>
                <span className="text-[10px] font-black text-purple-500">{investPctTotal.toFixed(1)}%</span>
              </div>
              <p className={`text-[9px] font-black uppercase tracking-widest ${ovLabel}`}>Investimentos</p>
              <p className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{hidePatrimonio ? '••••' : fmtSigned(investmentsTotal)}</p>
              <p className={`text-[9px] font-bold ${ovLabel}`}>{investPctTotal.toFixed(1)}% do total</p>
            </div>

            <div className={`p-4 rounded-2xl border transition-all hover:scale-[1.015] ${ovCardBg}`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-xl ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}><Gem className="w-4 h-4 text-amber-500" /></div>
                <span className="text-[10px] font-black text-amber-500">{bensPctTotal.toFixed(1)}%</span>
              </div>
              <p className={`text-[9px] font-black uppercase tracking-widest ${ovLabel}`}>Outros Ativos</p>
              <p className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{hidePatrimonio ? '••••' : fmtSigned(bensTotal)}</p>
              <p className={`text-[9px] font-bold ${ovLabel}`}>{bensPctTotal.toFixed(1)}% do total</p>
            </div>
          </div>

          <div className={`rounded-2xl border p-4 flex-1 flex flex-col ${ovCardBg}`}>
            <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
              <div>
                <p className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Evolução do Patrimônio</p>
                <div className="flex items-center gap-3 text-[9px] font-black mt-1">
                  <span className="flex items-center gap-1 text-emerald-500"><span className="w-2 h-2 rounded-full bg-emerald-500" />Patrimônio Total</span>
                  <span className="flex items-center gap-1 text-purple-500"><span className="w-2 h-2 rounded-full bg-purple-500" />Investimentos</span>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Últimos 30 dias <span className={ovLabel}>▾</span></span>
            </div>
            {allocTotal <= 0 ? (
              <p className="text-slate-500 text-xs font-bold text-center py-12">Cadastre seus ativos para ver a evolução.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <RLineChart data={evoData} margin={{ top: 5, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: isDark ? '#64748b' : '#94a3b8' }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 9, fill: isDark ? '#64748b' : '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={40} />
                  <RTooltip content={<EvoTip />} />
                  <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2.5} dot={false} animationDuration={700} />
                  <Line type="monotone" dataKey="inv" stroke="#a855f7" strokeWidth={2.5} dot={false} animationDuration={700} />
                </RLineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Alocação do Patrimônio (coluna alta) ── */}
        <div className={`lg:col-span-3 rounded-2xl border p-4 flex flex-col ${ovCardBg}`}>
          <p className={`text-xs font-black mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Alocação do Patrimônio</p>
          {allocTotal <= 0 ? (
            <p className="text-slate-500 text-xs font-bold text-center py-8">Sem ativos cadastrados.</p>
          ) : (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={allocation} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value" stroke="none" animationDuration={600}>
                      {allocation.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <ReTooltip content={<DonutTip total={allocTotal} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{hidePatrimonio ? '••••' : `R$ ${fmt(allocTotal)}`}</p>
                  <p className={`text-[8px] font-black uppercase ${ovLabel}`}>Total</p>
                </div>
              </div>
              <div className="space-y-2 mt-3">
                {allocation.map((a, i) => {
                  const pct = allocTotal > 0 ? a.value / allocTotal * 100 : 0;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.color }} />
                      <span className={`text-[11px] font-bold flex-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{a.name}</span>
                      <span className={`text-[11px] font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{hidePatrimonio ? '••••' : `R$ ${fmt(a.value)}`}</span>
                      <span className="text-[10px] font-black w-11 text-right" style={{ color: a.color }}>{pct.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

      </div>{/* end faixa superior */}

      {/* ═══ FAIXA INFERIOR ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4 items-start">

      {/* ── COMPOSIÇÃO DO PATRIMÔNIO ── */}
      <div className="lg:col-span-5">
      {(() => {
        const CATEGORY_COLORS = {
          'Reserva': '#10b981',
          'Renda Fixa': '#6366f1',
          'Ações': '#a855f7',
          'ETFs': '#3b82f6',
          'Fundos Imobiliários': '#14b8a6',
          'Criptomoedas': '#f59e0b',
          'Imóveis': '#f97316',
          'Bens': '#f97316',
          'Veículos': '#0ea5e9',
          'Outros': '#64748b',
        };
        const ASSET_COLORS = ['#10b981','#6366f1','#a855f7','#3b82f6','#14b8a6','#f59e0b','#f97316','#ec4899','#8b5cf6','#06b6d4','#84cc16','#ef4444','#22d3ee','#e879f9'];
        const CATEGORY_MAP = {
          renda_fixa: 'Renda Fixa',
          acoes: 'Ações',
          etfs: 'ETFs',
          fiis: 'Fundos Imobiliários',
          crypto: 'Criptomoedas',
          imoveis: 'Imóveis',
        };

        // Build items
        const items = [];
        if (includeReserve) {
          jars.forEach(j => {
            if ((j.balance || 0) > 0) items.push({ name: j.name, category: 'Reserva', value: j.balance });
          });
        }
        investments.forEach(inv => {
          const price = inv.manualCurrentPrice || inv.purchasePrice || 0;
          const usdM = inv.isUSD ? usdRate : 1;
          const val = (inv.quantity || 1) * price * usdM;
          if (val > 0) items.push({ name: inv.name || inv.symbol || 'Ativo', category: CATEGORY_MAP[inv.type] || 'Outros', value: val });
        });
        if (includeBens) {
          tangibleAssets.forEach(b => {
            const val = b.currentValue != null ? (parseFloat(b.currentValue) || 0)
              : (b.manualCurrentValue != null && b.manualCurrentValue !== '' ? (parseFloat(b.manualCurrentValue) || 0) : (parseFloat(b.fipeValue || b.acquisitionValue) || 0));
            if (val > 0) items.push({ name: b.address || b.model || (b.kind === 'imovel' ? 'Imóvel' : 'Veículo'), category: b.kind === 'veiculo' ? 'Veículos' : 'Imóveis', value: val });
          });
        }

        const totalValue = items.reduce((a, i) => a + i.value, 0);

        // Aggregate by mode
        let chartItems;
        if (chartViewMode === 'category') {
          const catMap = {};
          items.forEach(it => {
            if (!catMap[it.category]) catMap[it.category] = 0;
            catMap[it.category] += it.value;
          });
          chartItems = Object.entries(catMap).map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] || '#64748b' })).sort((a, b) => b.value - a.value);
        } else {
          chartItems = items.map((it, idx) => ({ name: it.name, value: it.value, color: ASSET_COLORS[idx % ASSET_COLORS.length] })).sort((a, b) => b.value - a.value);
        }

        const CustomPieTooltip = ({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const d = payload[0];
          return (
            <div className={`px-4 py-3 rounded-2xl border shadow-2xl text-xs ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
              <p className="font-black mb-1" style={{ color: d.payload.color }}>{d.name}</p>
              <p className="font-bold">R$ {fmt(d.value)}</p>
              <p className="text-slate-500 font-bold">{totalValue > 0 ? ((d.value / totalValue) * 100).toFixed(1) : 0}%</p>
            </div>
          );
        };

        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900/80 border-white/[0.06]' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className={`w-full flex items-center justify-between p-4`}>
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                    <BarChart3 className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                  </div>
                  <p className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Composição do Patrimônio</p>
                </div>
              </div>
              <div className="px-4 pb-4">
              {totalValue <= 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500 text-xs font-bold">Nenhum ativo cadastrado.</p>
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row gap-6 items-center">
                  <div className="relative w-full lg:w-[280px] flex-shrink-0 group">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={chartItems} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={2} dataKey="value" stroke="none" animationDuration={600}>
                          {chartItems.map((entry, idx) => (<Cell key={idx} fill={entry.color} className="transition-all hover:opacity-80" />))}
                        </Pie>
                        <ReTooltip content={<CustomPieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-300 group-hover:opacity-0">
                      <p className={`text-[8px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Total</p>
                      <p className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>R$ {fmt(totalValue)}</p>
                    </div>
                  </div>
                  <div className="flex-1 w-full">
                    <div className="space-y-1 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                      {chartItems.map((item, idx) => {
                        const pct = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                        return (
                          <div key={idx} className={`flex items-center gap-2.5 p-2 rounded-xl transition-all hover:scale-[1.01] ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-[10px] font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.name}</p>
                              <p className={`text-[9px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>R$ {fmt(item.value)}</p>
                            </div>
                            <p className="text-xs font-black flex-shrink-0" style={{ color: item.color }}>{pct.toFixed(1)}%</p>
                            <div className={`w-14 h-1 rounded-full overflow-hidden flex-shrink-0 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: item.color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        );
      })()}
      </div>{/* end flex-1 allocation chart wrapper */}

      {/* ── PRINCIPAIS ATIVOS ── */}
      <div className={`lg:col-span-4 rounded-2xl border p-4 ${ovCardBg}`}>
        <p className={`text-xs font-black mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>Principais Ativos</p>
        {topAssets.length === 0 ? (
          <p className="text-slate-500 text-xs font-bold text-center py-6">Nenhum investimento cadastrado.</p>
        ) : (
          <div className="space-y-1">
            <div className={`grid grid-cols-12 gap-1 pb-2 text-[8px] font-black uppercase tracking-widest ${ovLabel}`}>
              <span className="col-span-5">Ativo</span><span className="col-span-3">Tipo</span><span className="col-span-2 text-right">Valor</span><span className="col-span-2 text-right">%</span>
            </div>
            {topAssets.map((a, i) => {
              const pct = investmentsTotal > 0 ? a.value / investmentsTotal * 100 : 0;
              return (
                <div key={i} className={`grid grid-cols-12 gap-1 py-1.5 items-center border-t ${isDark ? 'border-white/[0.04]' : 'border-slate-50'}`}>
                  <span className={`col-span-5 text-[10px] font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{a.name}</span>
                  <span className={`col-span-3 text-[9px] font-bold truncate ${ovLabel}`}>{a.type}</span>
                  <span className={`col-span-2 text-[10px] font-bold text-right ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{hidePatrimonio ? '••' : fmt(a.value)}</span>
                  <span className="col-span-2 text-[10px] font-black text-right text-purple-500">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
            <div className={`grid grid-cols-12 gap-1 pt-2 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <span className={`col-span-8 text-[9px] font-black uppercase tracking-widest ${ovLabel}`}>Total dos principais</span>
              <span className={`col-span-4 text-[11px] font-black text-right ${isDark ? 'text-white' : 'text-slate-800'}`}>{hidePatrimonio ? '••••' : `R$ ${fmt(topAssetsTotal)}`}</span>
            </div>
          </div>
        )}
      </div>

      {(() => {
        // dead code block — kept to avoid removing variables
        const reservesPct = patrimonioTotal > 0 ? (jarsTotal / patrimonioTotal * 100) : 0;
        const investPct = patrimonioTotal > 0 ? (investmentsTotal / patrimonioTotal * 100) : 0;

        // Category breakdown
        const CATEGORY_LABELS = {
          renda_fixa: 'Renda Fixa', acoes: 'Ações', etfs: 'ETFs',
          fiis: 'Fundos Imobiliários', crypto: 'Criptomoedas', imoveis: 'Imóveis',
        };
        const catCount = {};
        const catValue = {};
        investments.forEach(inv => {
          const cat = inv.type || 'outros';
          catCount[cat] = (catCount[cat] || 0) + 1;
          const price = inv.manualCurrentPrice || inv.purchasePrice || 0;
          const usdM = inv.isUSD ? usdRate : 1;
          catValue[cat] = (catValue[cat] || 0) + ((inv.quantity || 1) * price * usdM);
        });
        const uniqueCategories = Object.keys(catCount);

        // Detect tech/innovation focus by names
        const TECH_KEYWORDS = ['nvda','nvidia','aapl','apple','msft','microsoft','goog','google','meta','amzn','amazon','tsla','tesla','amd','intc','intel','qcom','qualcomm','tsmc','asml','avgo','broadcom','crm','salesforce','adbe','adobe','snow','pltr','palantir','coin','coinbase','sq','block','shop','shopify','net','cloudflare','ddog','datadog','ai','c3ai','smci','ivvb','qqqm','qqq','nasd','spy','voo','arkk','arkg','soxx','btc','bitcoin','eth','ethereum','sol','solana'];
        const techAssets = investments.filter(inv => {
          const n = (inv.name || '').toLowerCase();
          const s = (inv.symbol || '').toLowerCase();
          return TECH_KEYWORDS.some(kw => n.includes(kw) || s.includes(kw));
        });
        const hasTechFocus = techAssets.length > 0;
        const techPct = investmentsTotal > 0 ? techAssets.reduce((acc, inv) => {
          const price = inv.manualCurrentPrice || inv.purchasePrice || 0;
          const usdM = inv.isUSD ? usdRate : 1;
          return acc + ((inv.quantity || 1) * price * usdM);
        }, 0) / investmentsTotal * 100 : 0;

        let pStatus = 'neutral';
        let pMessage = 'Analisando seu patrimônio...';

        if (patrimonioTotal <= 0 && jars.length === 0 && investments.length === 0) {
          pStatus = 'neutral';
          pMessage = 'Ainda não há ativos cadastrados. Comece adicionando suas reservas e investimentos.';
        } else {
          const parts = [];

          // Consolidation check
          const hasReserve = jars.length > 0 && jarsTotal > 0;
          const hasInvestments = investments.length > 0;
          const isConsolidated = hasReserve && hasInvestments && uniqueCategories.length >= 2;

          if (isConsolidated) {
            pStatus = 'positive';
            parts.push(`Patrimônio consolidado com reserva e ${investments.length} ativo${investments.length > 1 ? 's' : ''} em ${uniqueCategories.length} categoria${uniqueCategories.length > 1 ? 's' : ''}.`);
          } else if (hasReserve && !hasInvestments) {
            pStatus = 'warning';
            parts.push(`Reserva ativa com ${jars.length} cofre${jars.length > 1 ? 's' : ''}, mas ainda sem investimentos — considere diversificar.`);
          } else if (!hasReserve && hasInvestments) {
            pStatus = 'warning';
            parts.push(`${investments.length} ativo${investments.length > 1 ? 's' : ''} em carteira, mas sem reserva de emergência — priorize criar uma.`);
          } else if (hasReserve && hasInvestments && uniqueCategories.length < 2) {
            pStatus = 'warning';
            parts.push(`Reserva ativa e ${investments.length} ativo${investments.length > 1 ? 's' : ''}, mas concentrados em ${CATEGORY_LABELS[uniqueCategories[0]] || 'uma categoria'}.`);
          }

          // Tech/innovation profile
          if (hasTechFocus) {
            const techNames = techAssets.slice(0, 3).map(a => a.name || a.symbol).join(', ');
            if (techPct >= 50) {
              parts.push(`Perfil focado em tecnologia e inovação (${techPct.toFixed(0)}% da carteira: ${techNames}).`);
            } else {
              parts.push(`Exposição a tech/inovação com ${techNames} (${techPct.toFixed(0)}%).`);
            }
          }

          // Profit/loss
          if (hasInvestments) {
            if (investmentsProfit > 0) {
              parts.push(`Lucro acumulado de R$ ${fmt(investmentsProfit)}.`);
            } else if (investmentsProfit < 0) {
              pStatus = pStatus === 'positive' ? 'warning' : pStatus;
              parts.push(`Prejuízo de R$ ${fmt(Math.abs(investmentsProfit))} nos investimentos.`);
            }
          }

          // Over-concentration in reserve
          if (reservesPct > 80 && hasInvestments) {
            pStatus = 'warning';
            parts.push('Muita concentração em reserva — considere alocar mais em ativos.');
          }

          pMessage = parts.join(' ');
        }

        const bgColors = {
          positive: isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200',
          negative: isDark ? 'bg-rose-500/10 border-rose-500/20' : 'bg-rose-50 border-rose-200',
          warning: isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200',
          neutral: isDark ? 'bg-slate-500/10 border-slate-500/20' : 'bg-slate-50 border-slate-200',
        };
        const textColors = {
          positive: isDark ? 'text-emerald-400' : 'text-emerald-700',
          negative: isDark ? 'text-rose-400' : 'text-rose-700',
          warning: isDark ? 'text-amber-400' : 'text-amber-700',
          neutral: isDark ? 'text-slate-400' : 'text-slate-700',
        };
        const statusIcons = {
          positive: <TrendingUp className="w-3.5 h-3.5" />,
          negative: <TrendingDown className="w-3.5 h-3.5" />,
          warning: <Sparkles className="w-3.5 h-3.5" />,
          neutral: <Sparkles className="w-3.5 h-3.5" />,
        };

        return null;
      })()}

      {/* ── RESUMO POR CLASSE ── */}
      <div className={`lg:col-span-3 rounded-2xl border p-4 ${ovCardBg}`}>
        <p className={`text-xs font-black mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>Resumo por Classe</p>
        {classRows.length === 0 ? (
          <p className="text-slate-500 text-xs font-bold text-center py-6">Sem investimentos.</p>
        ) : (
          <div className="space-y-2.5">
            {classRows.map((c, i) => {
              const pct = classTotal > 0 ? c.value / classTotal * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold"><span className="w-2 h-2 rounded-full" style={{ background: c.color }} /><span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{c.name}</span></span>
                    <span className={`text-[10px] font-black ${isDark ? 'text-white' : 'text-slate-700'}`}>{pct.toFixed(1)}%</span>
                  </div>
                  <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                  </div>
                </div>
              );
            })}
            <div className={`flex items-center justify-between pt-2 mt-1 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <span className={`text-[10px] font-black uppercase tracking-widest ${ovLabel}`}>Total</span>
              <span className={`text-[11px] font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>100%</span>
            </div>
          </div>
        )}
      </div>
      </div>{/* end faixa inferior */}

      {/* ── META BAR ── */}
      <div className={`mt-4 rounded-2xl border p-4 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 ${totalProfit >= 0 ? (isDark ? 'bg-emerald-500/[0.07] border-emerald-500/20' : 'bg-emerald-50 border-emerald-100') : ovCardBg}`}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`p-2.5 rounded-full shrink-0 ${isDark ? 'bg-emerald-500/15' : 'bg-emerald-100'}`}><Target className="w-5 h-5 text-emerald-500" /></div>
          <div className="min-w-0">
            <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{totalProfit >= 0 ? 'Você está no caminho certo!' : 'Continue construindo seu patrimônio'}</p>
            <p className={`text-[11px] font-bold ${sub}`}>{totalProfit >= 0 ? `Seu patrimônio cresceu ${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(2)}% este mês.` : 'Mantenha aportes consistentes para acelerar.'}</p>
          </div>
        </div>

        {monthlyExpense > 0 && (
          <div className={`lg:min-w-[190px] lg:border-l lg:pl-6 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[9px] font-black uppercase tracking-widest ${ovLabel}`}>Meta de Reserva</span>
              <span className={`text-[11px] font-black ${isDark ? 'text-white' : 'text-slate-700'}`}>{reserveMonths.toFixed(1)} <span className={ovLabel}>/ {reserveGoalMonths} meses</span></span>
            </div>
            <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${reservePctOfGoal}%` }} />
            </div>
          </div>
        )}

        {goalTarget > 0 && (
          <div className={`lg:min-w-[190px] lg:border-l lg:pl-6 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[9px] font-black uppercase tracking-widest ${ovLabel}`}>Próxima meta</span>
              <span className={`text-[11px] font-black ${isDark ? 'text-white' : 'text-slate-700'}`}>R$ {fmt(goalTarget)}</span>
            </div>
            <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${goalPct}%` }} />
            </div>
          </div>
        )}

        {onNavigateTab && (
          <button onClick={() => onNavigateTab('metas')} className={`shrink-0 px-4 py-2.5 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-emerald-400 border border-white/10' : 'bg-white hover:bg-slate-50 text-emerald-600 border border-emerald-100'}`}>Ver metas →</button>
        )}
      </div>

      {/* ── BOTÃO FLUTUANTE (+) ── */}
      <button onClick={() => { setConfigInitialSection(null); setShowPatrimonioConfig(true); }} title="Configurar Alívia"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white shadow-xl shadow-emerald-500/30 flex items-center justify-center transition-all hover:scale-105">
        <span className="text-3xl font-light leading-none -mt-0.5">+</span>
      </button>
      </>)}

      {/* ── ALÍVIA CONFIG MODAL (módulo Patrimônio: Perfil Investidor + Alertas) ── */}
      {showPatrimonioConfig && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-500">
          <div className={`relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500 custom-scrollbar ${
            isDark ? 'bg-slate-900' : 'bg-white'
          }`}>
            <AliviaConfigForm
              module="patrimonio"
              initialSection={configInitialSection}
              manualConfig={manualConfig}
              onConfigChange={updateManualConfig}
              onClose={() => { setShowPatrimonioConfig(false); setConfigInitialSection(null); }}
            />
          </div>
        </div>
      )}

      {/* ── GOAL SIMULATOR MODAL ── */}
      {showSimModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setShowSimModal(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-md rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-500 overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-white'}`}
          >
            {/* Modal Header */}
            <div className={`p-6 pb-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3 mb-1">
                <div className={`p-2.5 rounded-xl ${isDark ? 'bg-blue-500/15' : 'bg-blue-100'}`}>
                  <LineChart className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                </div>
                <div>
                  <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Planejar Meta</h3>
                  <p className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {patrimonyGoals[0]?.title || 'Meta de Patrimônio'} — R$ {fmt(patrimonyGoals[0]?.target || 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              <div className="space-y-4">
                <div>
                  <label className={`text-[9px] font-black uppercase tracking-widest block mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Em quantos anos quer atingir?</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    step="0.5"
                    value={simModalYears}
                    onChange={(e) => setSimModalYears(e.target.value)}
                    placeholder="Ex: 5"
                    className={`w-full px-4 py-3.5 rounded-2xl text-lg font-black border-2 outline-none transition-all focus:ring-2 ${
                      isDark ? 'bg-slate-800 border-white/10 text-white focus:border-blue-500 focus:ring-blue-500/20 placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500 focus:ring-blue-500/10 placeholder:text-slate-300'
                    }`}
                  />
                </div>
                <div>
                  <label className={`text-[9px] font-black uppercase tracking-widest block mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Quanto pode investir por mês? (R$)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={simModalAporte}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      if (!raw) { setSimModalAporte(''); return; }
                      const num = (parseInt(raw) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                      setSimModalAporte(num);
                    }}
                    placeholder="Ex: 500,00"
                    className={`w-full px-4 py-3.5 rounded-2xl text-lg font-black border-2 outline-none transition-all focus:ring-2 ${
                      isDark ? 'bg-slate-800 border-white/10 text-white focus:border-blue-500 focus:ring-blue-500/20 placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500 focus:ring-blue-500/10 placeholder:text-slate-300'
                    }`}
                  />
                </div>
              </div>

              {/* Live Preview */}
              {simModalYears && simModalAporte && (() => {
                const previewMonths = Math.round(parseFloat(simModalYears) * 12);
                const previewAporte = parseFloat(simModalAporte.replace(/\D/g, '')) / 100;
                const CDI_R = Math.pow(1 + 11.15 / 100, 1 / 12) - 1;
                const previewFV = patrimonioTotal * Math.pow(1 + CDI_R, previewMonths) + previewAporte * ((Math.pow(1 + CDI_R, previewMonths) - 1) / CDI_R);
                const previewTarget = patrimonyGoals[0]?.target || 0;
                const previewWill = previewFV >= previewTarget;
                let previewTime = null;
                for (let n = 1; n <= 600; n++) {
                  const fv = patrimonioTotal * Math.pow(1 + CDI_R, n) + previewAporte * ((Math.pow(1 + CDI_R, n) - 1) / CDI_R);
                  if (fv >= previewTarget) { previewTime = n; break; }
                }
                const ft = (m) => m < 12 ? `${m} meses` : `${Math.floor(m/12)}a ${m%12}m`;
                return (
                  <div className={`p-4 rounded-2xl border ${previewWill ? (isDark ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-emerald-50 border-emerald-100') : (isDark ? 'bg-amber-500/5 border-amber-500/15' : 'bg-amber-50 border-amber-100')}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className={`text-[9px] font-black uppercase tracking-widest ${previewWill ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-amber-400' : 'text-amber-600')}`}>Projeção</p>
                      {previewTime && <p className={`text-[9px] font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Meta em {ft(previewTime)}</p>}
                    </div>
                    <p className={`text-2xl font-black ${previewWill ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-amber-400' : 'text-amber-600')}`}>
                      R$ {fmt(previewFV)}
                    </p>
                    <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {previewWill ? `✓ Você ultrapassa a meta de R$ ${fmt(previewTarget)}` : `Faltarão R$ ${fmt(previewTarget - previewFV)} — aumente prazo ou aporte`}
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className={`p-6 pt-4 border-t flex gap-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
              <button
                onClick={() => setShowSimModal(false)}
                className={`flex-1 py-3 rounded-2xl text-sm font-black transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!simModalYears || !simModalAporte || !patrimonyGoals[0]) return;
                  setSimSaving(true);
                  try {
                    await updateDoc(doc(db, 'goals', patrimonyGoals[0].id), {
                      simYears: simModalYears,
                      simAporte: simModalAporte,
                    });
                    setShowSimModal(false);
                  } catch (e) { console.error(e); }
                  setSimSaving(false);
                }}
                disabled={!simModalYears || !simModalAporte || simSaving}
                className={`flex-1 py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all ${
                  simModalYears && simModalAporte && !simSaving
                    ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/20'
                    : isDark ? 'bg-white/5 text-slate-600 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {simSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {simSaving ? 'Salvando...' : 'Salvar Plano'}
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}