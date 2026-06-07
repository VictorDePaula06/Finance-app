import { useState, useMemo, useEffect } from 'react';
import { Wallet, PiggyBank, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, Eye, EyeOff, BarChart3, Bot, Loader2, Sparkles, LayoutDashboard, LineChart, Layers, List, HelpCircle, ShieldCheck, Target, Home, Gem, Pencil, Trash2, Save, RefreshCw, Info, Settings } from 'lucide-react';
import aliviaFinal from '../assets/alivia/alivia-final.png';
import AliviaConfigForm from './AliviaConfigForm';
import { calculatePatrimonyHealthScore } from '../utils/healthScore';
import { summarizeInvestments, jarsDynamicTotal, bensTotal as calcBensTotal } from '../utils/investmentValue';
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

  // ── render ─────────────────────────────────────────────────────────────────
  const h1 = isDark ? 'text-white' : 'text-slate-900';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="animate-in fade-in duration-700 pb-4">
      {/* Top bar */}
      <div className="flex items-center justify-end mb-4">
        <button onClick={() => { setConfigInitialSection(null); setShowPatrimonioConfig(true); }} className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 border ${isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'}`}>
          <Sparkles className="w-3 h-3" /> Configurar Alívia
        </button>
      </div>

      {activeTab === 'visao' && (<>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        {/* ═══ LEFT COLUMN (3/5) ═══ */}
        <div className="lg:col-span-3 flex flex-col gap-4">

      {/* ── HERO: PATRIMÔNIO TOTAL ── */}
      <div className={`p-5 md:p-7 rounded-[2rem] border relative overflow-hidden ${isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30 border-white/[0.06]' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900/40 border-slate-700'}`}>
        <div className="absolute top-[-50%] right-[-15%] w-[60%] h-[140%] rounded-full blur-[120px] pointer-events-none opacity-[0.12] bg-emerald-400" />
        <div className="absolute bottom-[-40%] left-[-10%] w-[40%] h-[100%] rounded-full blur-[100px] pointer-events-none opacity-[0.06] bg-purple-500" />
        <div className="relative">
          <div className="mb-4">
            <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400/80">Patrimônio Total Consolidado</p>
              <div className="flex items-center gap-1">
                {[['reserva', 'Reserva', '#10b981'], ['investimentos', 'Investim.', '#a855f7'], ['bens', 'Bens', '#f97316']].map(([key, label, col]) => {
                  const active = patrimonioFilter[key];
                  return (
                    <button key={key} onClick={() => togglePatrimonioFilter(key)} title={active ? `Ocultar ${label} do total` : `Incluir ${label} no total`}
                      className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all"
                      style={active ? { background: `${col}26`, borderColor: `${col}66`, color: col } : { borderColor: 'rgba(255,255,255,0.1)', color: '#64748b' }}>
                      {active ? '✓ ' : ''}{label}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className={`text-3xl md:text-4xl font-black tracking-tight leading-none ${displayedTotal >= 0 ? 'text-white' : 'text-rose-400'}`}>
              {fmtSigned(displayedTotal)}
            </p>
            {totalDailyYield > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black">
                  <TrendingUp className="w-2.5 h-2.5" /> +R$ {fmt(totalDailyYield)}/dia
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black">
                  ≈ R$ {fmt(totalDailyYield * 30)}/mês
                </span>
              </div>
            )}
          </div>
          {displayedTotal > 0 && (
            <div className="space-y-2 pt-3 border-t border-white/[0.06]">
              <div className="flex rounded-full overflow-hidden h-2 bg-white/[0.06]">
                {patrimonioFilter.reserva && <div style={{ width: `${jarsTotal / displayedTotal * 100}%` }} className="bg-emerald-500 transition-all duration-700" />}
                {patrimonioFilter.investimentos && <div style={{ width: `${investmentsTotal / displayedTotal * 100}%` }} className="bg-purple-500 transition-all duration-700" />}
                {patrimonioFilter.bens && <div style={{ width: `${bensTotal / displayedTotal * 100}%` }} className="bg-orange-500 transition-all duration-700" />}
              </div>
              <div className="flex justify-between flex-wrap gap-x-3 text-[9px] font-black text-slate-400">
                {patrimonioFilter.reserva && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Reserva — R$ {fmt(jarsTotal)} ({displayedTotal > 0 ? (jarsTotal/displayedTotal*100).toFixed(0) : 0}%)</span>}
                {patrimonioFilter.investimentos && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />Investimentos — R$ {fmt(investmentsTotal)} ({displayedTotal > 0 ? (investmentsTotal/displayedTotal*100).toFixed(0) : 0}%)</span>}
                {patrimonioFilter.bens && bensTotal > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />Bens — R$ {fmt(bensTotal)} ({displayedTotal > 0 ? (bensTotal/displayedTotal*100).toFixed(0) : 0}%)</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 3 PILLAR CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={`group p-4 rounded-2xl border flex items-center gap-3 transition-all hover:scale-[1.015] ${isDark ? 'bg-slate-900/80 border-white/[0.06] hover:border-emerald-500/30' : 'bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-200'}`}>
          <div className={`p-2.5 rounded-xl shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
            <PiggyBank className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Reserva</p>
            <p className={`text-lg font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{fmtSigned(jarsTotal)}</p>
            <p className={`text-[9px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{jars.length > 0 ? `${jars.length} cofre${jars.length > 1 ? 's' : ''} • +R$ ${fmt(jarsDailyYield)}/dia` : 'Comece sua reserva'}</p>
          </div>
        </div>

        <div className={`group p-4 rounded-2xl border flex items-center gap-3 transition-all hover:scale-[1.015] relative ${isDark ? 'bg-slate-900/80 border-white/[0.06] hover:border-purple-500/30' : 'bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-purple-200'}`}>
          <div className={`p-2.5 rounded-xl shrink-0 ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
            <TrendingUp className="w-5 h-5 text-purple-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Investimentos</p>
            <p className={`text-lg font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{hidePatrimonio ? '••••••' : fmtSigned(investmentsTotal)}</p>
            <p className={`text-[9px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{investments.length > 0 ? `${investments.length} ativo${investments.length > 1 ? 's' : ''}` : 'Nenhum investimento'}</p>
          </div>
          <button onClick={() => { const v = !hidePatrimonio; setHidePatrimonio(v); localStorage.setItem('hidePatrimonio', String(v)); }} className={`absolute top-2 right-2 p-1 rounded-lg transition-all ${isDark ? 'text-slate-600 hover:bg-white/5 hover:text-slate-400' : 'text-slate-300 hover:bg-slate-50 hover:text-slate-500'}`}>
            {hidePatrimonio ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
        </div>

        <div className={`group p-4 rounded-2xl border flex items-center gap-3 transition-all hover:scale-[1.015] ${isDark ? 'bg-slate-900/80 border-white/[0.06] hover:border-blue-500/30' : 'bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200'}`}>
          <div className={`p-2.5 rounded-xl shrink-0 ${totalProfit >= 0 ? (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50') : (isDark ? 'bg-rose-500/10' : 'bg-rose-50')}`}>
            <ArrowUpCircle className={`w-5 h-5 ${totalProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Rentabilidade</p>
            <p className={`text-lg font-black truncate ${totalProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{fmtSigned(totalProfit)}</p>
            <p className={`text-[9px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Investimentos + reservas</p>
          </div>
        </div>
      </div>

      {/* ── MEU PATRIMÔNIO: Allocation Chart + Breakdown ── */}
      <div>
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
                  <p className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Alocação do Patrimônio</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setIncludeReserve(!includeReserve)}
                    className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border ${
                      includeReserve ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}
                  >
                    {includeReserve ? '✓ Reserva' : 'Sem Reserva'}
                  </button>
                  <button
                    onClick={() => setIncludeBens(!includeBens)}
                    className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all border ${
                      includeBens ? 'bg-orange-500/10 border-orange-500/30 text-orange-500' : isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}
                  >
                    {includeBens ? '✓ Bens' : 'Sem Bens'}
                  </button>
                  <div className={`flex rounded-lg border overflow-hidden ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    <button onClick={() => setChartViewMode('category')} className={`flex items-center gap-1 px-2 py-1 text-[8px] font-black uppercase tracking-widest transition-all ${chartViewMode === 'category' ? 'bg-emerald-500 text-white' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Layers className="w-2.5 h-2.5" /> Cat.
                    </button>
                    <button onClick={() => setChartViewMode('asset')} className={`flex items-center gap-1 px-2 py-1 text-[8px] font-black uppercase tracking-widest transition-all ${chartViewMode === 'asset' ? 'bg-emerald-500 text-white' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <List className="w-2.5 h-2.5" /> Ativo
                    </button>
                  </div>
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

        </div>{/* end left col */}

        {/* ═══ RIGHT COLUMN (2/5) ═══ */}
        <div className="lg:col-span-2 flex flex-col gap-4">

      {/* ── ALÍVIA INSIGHT ── */}
      <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900/80 border-white/[0.06]' : 'bg-white border-slate-100 shadow-sm'}`}>
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <img src={aliviaFinal} alt="Alívia" className="w-9 h-9 object-cover rounded-full border border-white/20 shadow-md" />
            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-900 border border-white/10' : 'bg-white border border-slate-200'} ${
              aliviaInsight.pStatus === 'positive' ? 'text-emerald-400' : aliviaInsight.pStatus === 'warning' ? 'text-amber-400' : 'text-slate-400'
            }`}>
              {aliviaInsight.pStatus === 'positive' ? <TrendingUp className="w-2 h-2" /> : <Sparkles className="w-2 h-2" />}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <span className={`text-[9px] font-black uppercase tracking-widest block mb-1 ${isDark ? 'text-emerald-400/80' : 'text-emerald-600'}`}>Alívia</span>
            <span className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{aliviaInsight.pMessage}</span>
          </div>
          <button
            onClick={() => handleAnalyze(true)}
            title="Atualizar"
            className={`p-1.5 rounded-lg transition-all shrink-0 ${isDark ? 'hover:bg-white/10 text-slate-500 hover:text-slate-300' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── SAÚDE PATRIMONIAL ── */}
      <div>
        {(() => {
          const h = patrimonyHealth;
          const d = h.breakdown?.data || {};
          const PILLAR_META = {
            diversification: { desc: d.invCount > 0 ? `${d.classCount} classe(s) de ativo · maior peso ${d.maxWeight || 0}%${d.maxWeight > 60 ? ' — concentrado, acima de 60%' : ''}.` : 'Cadastre investimentos para diversificar entre classes.' },
            profitability: { desc: d.invCount > 0 ? `Retorno real de ${d.realReturnPct || 0}% (já descontada a inflação de ${d.ipcaRef || 4.5}%).` : 'Sem investimentos para medir o retorno real.' },
            debt: { desc: h.hasDebt ? `Dívidas em ${d.debtRatio || 0}% do patrimônio — quite-as primeiro.` : 'Sem dívidas. Pontuação máxima! 👏' },
            protection: { desc: (d.protectionTotal > 0) ? `${d.protectionCovered || 0} de ${d.protectionTotal} riscos cobertos por seguro (${d.coveragePct || 0}%).` : 'Registre seguros para proteger seus principais ativos.' },
          };
          // Cor por desempenho (intuitivo): verde quando bom, âmbar parcial, vermelho baixo.
          const barColorFor = (pct) => pct >= 80 ? '#10b981' : pct >= 50 ? '#eab308' : '#f43f5e';
          const ring = h.statusLabel === 'Sem dados' ? '#64748b' : barColorFor(h.score);
          const C = 2 * Math.PI * 34;
          return (
            <div className={`rounded-2xl border p-4 md:p-5 flex flex-col ${isDark ? 'bg-slate-900/80 border-white/[0.06]' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}><ShieldCheck className="w-4 h-4 text-emerald-500" /></div>
                  <p className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Saúde Patrimonial</p>
                </div>
                <button onClick={() => { setConfigInitialSection('saude'); setShowPatrimonioConfig(true); }}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 border transition-all ${isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'}`}>
                  <Settings className="w-3 h-3" /> Configurar
                </button>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="relative w-[84px] h-[84px] shrink-0">
                  <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                    <circle cx="40" cy="40" r="34" fill="none" strokeWidth="7" stroke={isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'} />
                    <circle cx="40" cy="40" r="34" fill="none" strokeWidth="7" strokeLinecap="round" stroke={ring} strokeDasharray={C} strokeDashoffset={C * (1 - h.score / 100)} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{h.score}</span>
                    <span className="text-[8px] font-bold text-slate-500">/ 100</span>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className={`text-base font-black ${h.color}`}>{h.statusLabel}</p>
                  <p className={`text-[11px] leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{h.feedback}</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {(h.pillars || []).map(p => {
                  const meta = PILLAR_META[p.key] || {};
                  const pct = p.max > 0 ? (p.score / p.max) * 100 : 0;
                  const barColor = barColorFor(pct);
                  return (
                    <div key={p.key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-2 text-[11px] font-bold"><span className="w-2 h-2 rounded-full" style={{ background: barColor }} /><span className={isDark ? 'text-slate-200' : 'text-slate-700'}>{p.label}</span></span>
                        <span className={`text-[10px] font-black ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{p.score}<span className="text-slate-500">/{p.max} pts</span></span>
                      </div>
                      <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                      <p className="text-[9.5px] mt-1 text-slate-500">
                        {meta.desc}
                        {p.key === 'debt' && h.hasDebt && onNavigateTab && (
                          <button onClick={() => onNavigateTab('dividas')} className="ml-1 font-black text-rose-400 hover:text-rose-300">Gerenciar dívidas →</button>
                        )}
                        {p.key === 'protection' && pct < 80 && onNavigateTab && (
                          <button onClick={() => onNavigateTab('seguros')} className="ml-1 font-black text-emerald-400 hover:text-emerald-300">Ver proteção →</button>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

        </div>{/* end right col */}
      </div>{/* end grid */}
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