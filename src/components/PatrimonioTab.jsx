import { useState, useMemo, useEffect } from 'react';
import { Wallet, PiggyBank, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, Eye, EyeOff, BarChart3, Bot, Loader2, Sparkles, LayoutDashboard, LineChart, Layers, List, HelpCircle, ShieldCheck, Target, Home, Gem, Pencil, Trash2, Save, RefreshCw, Info, Settings } from 'lucide-react';
import aliviaFinal from '../assets/alivia/alivia-final.png';
import AliviaConfigForm from './AliviaConfigForm';
import { calculatePatrimonyHealthScore } from '../utils/healthScore';
import { PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer, AreaChart, Area, LineChart as RLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip } from 'recharts';
import ReactMarkdown from 'react-markdown';
import { generatePatrimonyAnalysis, isGeminiConfigured } from '../services/gemini';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useCdiRate, useUsdRate, getUsdRate } from '../utils/marketRates';
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
export default function PatrimonioTab({ transactions, manualConfig, updateManualConfig }) {
  const { theme } = useTheme();
  const { currentUser, userPrefs } = useAuth();
  const isDark = theme !== 'light';
  const [showPatrimonioConfig, setShowPatrimonioConfig] = useState(false);
  const [configInitialSection, setConfigInitialSection] = useState(null);

  // ── state ──────────────────────────────────────────────────────────────────
  const [jars, setJars] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [tangibleAssets, setTangibleAssets] = useState([]);
  const [includeBens, setIncludeBens] = useState(true);
  const cdiAnual = useCdiRate();
  const [hidePatrimonio, setHidePatrimonio] = useState(() => localStorage.getItem('hidePatrimonio') === 'true');
  const usdRateFromHook = useUsdRate();
  const [usdRate, setUsdRate] = useState(usdRateFromHook);
  useEffect(() => { setUsdRate(usdRateFromHook); }, [usdRateFromHook]);
  const [livePrices, setLivePrices] = useState({ USD: 5.0 });
  const [tesouroData, setTesouroData] = useState([]);
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

  // Helper: get live Tesouro rate for a bond name
  const getLiveTesouroRate = (bondName) => {
    if (!bondName || tesouroData.length === 0) return null;
    const normalizedName = bondName.trim().toLowerCase();
    const match = tesouroData.find(b => b.nm && b.nm.trim().toLowerCase() === normalizedName);
    if (match) return { rate: parseFloat(match.anulRentPrcnt), unitPrice: parseFloat(match.untrPric) };
    const fuzzy = tesouroData.find(b => b.nm && (
      normalizedName.includes(b.nm.trim().toLowerCase()) || 
      b.nm.trim().toLowerCase().includes(normalizedName)
    ));
    if (fuzzy) return { rate: parseFloat(fuzzy.anulRentPrcnt), unitPrice: parseFloat(fuzzy.untrPric) };
    return null;
  };

  const fetchLivePrices = async () => {
    try {
      const newPrices = { ...livePrices };
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      // Crypto from Binance
      const cryptoTickers = [...new Set(investments.filter(a => a.type === 'crypto' && a.symbol).map(a => a.symbol.toUpperCase()))];
      if (cryptoTickers.length > 0) {
        try {
          const binanceRes = await fetch('https://api.binance.com/api/v3/ticker/price');
          const binanceData = await binanceRes.json();
          cryptoTickers.forEach(ticker => {
            const usdtPair = binanceData.find(p => p.symbol === `${ticker}USDT`);
            const brlPair  = binanceData.find(p => p.symbol === `${ticker}BRL`);
            if (usdtPair) newPrices[`${ticker}_USD`] = parseFloat(usdtPair.price);
            if (brlPair)  newPrices[`${ticker}_BRL`] = parseFloat(brlPair.price);
          });
        } catch (e) { console.warn('Binance fetch failed', e); }
      }

      // Stocks, ETFs, FIIs
      const stockTickers = [...new Set(investments.filter(a => ['acoes', 'etfs', 'fiis'].includes(a.type) && a.symbol).map(a => a.symbol.toUpperCase()))];
      const stockTypes   = stockTickers.map(t => {
        const asset = investments.find(a => a.symbol?.toUpperCase() === t);
        return asset?.type || 'acoes';
      });

      if (stockTickers.length > 0) {
        if (!isLocalhost) {
          try {
            const apiUrl = `/api/prices?tickers=${stockTickers.join(',')}&types=${stockTypes.join(',')}`;
            const res = await fetch(apiUrl);
            if (res.ok) {
              const data = await res.json();
              Object.assign(newPrices, data.prices);
            }
          } catch (e) { console.warn('Serverless fetch failed', e); }
        } else {
          await Promise.all(stockTickers.map(async (ticker) => {
            try {
              const brapiRes = await fetch(`https://brapi.dev/api/quote/${ticker}`);
              if (brapiRes.ok) {
                const brapiData = await brapiRes.json();
                const price = brapiData?.results?.[0]?.regularMarketPrice;
                if (price) { newPrices[ticker] = parseFloat(price); return; }
              }
            } catch (e) {}
            try {
              const isProbablyBR = /\d/.test(ticker) || (ticker.length >= 5 && !ticker.includes('.'));
              const yahooTicker = isProbablyBR ? `${ticker}.SA` : ticker;
              const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}`;
              const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
              if (res.ok) {
                const data = await res.json();
                const meta  = data?.chart?.result?.[0]?.meta;
                const price = meta?.regularMarketPrice || meta?.previousClose;
                if (price) { newPrices[ticker] = parseFloat(price); return; }
              }
            } catch (e) {}
          }));
        }
      }

      // USD/BRL — usa cache compartilhado (dedupe entre componentes)
      const usd = await getUsdRate();
      newPrices.USD = usd;
      setUsdRate(usd);

      setLivePrices(newPrices);
    } catch (error) {
      console.error("Price fetch failed:", error);
    }
  };

  const fetchTesouro = async () => {
    try {
      const res = await fetch('/api/tesouro', { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const data = await res.json();
        if (data.bonds && data.bonds.length > 0) {
          setTesouroData(data.bonds);
          return;
        }
      }
    } catch (e) {
      console.warn('/api/tesouro failed:', e.message);
    }

    const tesouroUrl = 'https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/service/api/treasurybondpriceandsavings.json';
    const proxies = [
      `https://api.allorigins.win/get?url=${encodeURIComponent(tesouroUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(tesouroUrl)}`,
    ];

    for (const proxyUrl of proxies) {
      try {
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const data = await res.json();
          const rawContents = data.contents ? JSON.parse(data.contents) : data;
          const list = rawContents?.response?.TrsryBondArr || [];
          if (list.length > 0) {
            setTesouroData(list);
            break;
          }
        }
      } catch (e) {}
    }
  };

  useEffect(() => {
    fetchTesouro();
  }, []);

  useEffect(() => {
    fetchLivePrices();
    fetchTesouro();
    const interval = setInterval(() => {
      fetchLivePrices();
      fetchTesouro();
    }, 60000 * 2); 
    return () => clearInterval(interval);
  }, [investments.length]);

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

  // Valor atual dos bens tangíveis (currentValue persistido pela aba Bens & Imóveis)
  const bensTotal = useMemo(() => tangibleAssets.reduce((a, x) => {
    if (x.currentValue != null) return a + (parseFloat(x.currentValue) || 0);
    if (x.manualCurrentValue != null && x.manualCurrentValue !== '') return a + (parseFloat(x.manualCurrentValue) || 0);
    return a + (parseFloat(x.fipeValue || x.acquisitionValue) || 0);
  }, 0), [tangibleAssets]);

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

  // CDI e USD agora vêm dos hooks compartilhados (cache global). Não precisa fetch local.
  // O usdRate ainda é mantido no estado local porque fetchLivePrices também atualiza
  // ele a partir do retorno da awesomeapi (caso o livePrices.USD seja mais recente).

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
        const currentVal = (inv.manualCurrentPrice || inv.purchasePrice) * inv.quantity;
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

  // Calculate investments total, cost, and profit/loss matching InvestmentsTab logic
  const { investmentsTotal, investmentsCost, investmentsProfit } = useMemo(() => {
    let totalInvested = 0;
    let currentValue = 0;

    investments.forEach(asset => {
      const usdMultiplier = asset.isUSD ? (livePrices.USD || usdRate || 5.0) : 1;

      // Renda Fixa: use totalApplied vs calculated/manual current value
      if (asset.type === 'renda_fixa') {
        const applied = asset.totalApplied || (asset.quantity * asset.purchasePrice) || 0;
        let current = asset.manualCurrentPrice || applied;

        // Try to get live rate from Tesouro API for mark-to-market
        const liveData = getLiveTesouroRate(asset.name);
        const pRate = parseFloat(asset.purchaseRate || asset.fixedRate || 0);
        let cRate = liveData ? liveData.rate : parseFloat(asset.currentMarketRate || asset.fixedRate || 0);

        if (pRate > 0 && cRate > 0 && pRate !== cRate && !asset.manualCurrentPrice) {
          current = applied * (pRate / cRate);
        }
        totalInvested += applied;
        currentValue += current;
        return;
      }

      const invested = asset.quantity * asset.purchasePrice * usdMultiplier;
      totalInvested += invested;

      let currentPrice = asset.manualCurrentPrice || asset.purchasePrice || 0;
      if (asset.type === 'crypto' && asset.symbol) {
        const sym = asset.symbol.toUpperCase();
        if (asset.isUSD && livePrices[`${sym}_USD`]) currentPrice = livePrices[`${sym}_USD`];
        else if (!asset.isUSD && livePrices[`${sym}_BRL`]) currentPrice = livePrices[`${sym}_BRL`];
        else if (!asset.isUSD && livePrices[`${sym}_USD`] && (livePrices.USD || usdRate)) currentPrice = livePrices[`${sym}_USD`] * (livePrices.USD || usdRate);
      } else if (['acoes', 'etfs', 'fiis'].includes(asset.type) && asset.symbol) {
        const sym = asset.symbol.toUpperCase();
        if (livePrices[sym]) currentPrice = livePrices[sym];
      }
      currentValue += (asset.quantity * currentPrice * usdMultiplier);
    });

    return {
      investmentsTotal: currentValue,
      investmentsCost: totalInvested,
      investmentsProfit: currentValue - totalInvested
    };
  }, [investments, livePrices, usdRate, tesouroData]);

  const patrimonioTotal = jarsTotal + investmentsTotal + bensTotal;

  // Rentabilidade das reservas que têm valor aplicado informado (posição atual − aplicado).
  const reservesProfit = useMemo(() => jars.reduce((acc, j) => {
    if (j.appliedValue != null && j.appliedValue > 0) return acc + ((parseFloat(j.balance) || 0) - j.appliedValue);
    return acc;
  }, 0), [jars]);
  const totalProfit = investmentsProfit + reservesProfit;

  // Saúde Patrimonial (Reserva · Diversificação · Rentabilidade) — mesma fonte da sidebar.
  const investmentsSummary = useMemo(() => {
    const byClass = {};
    investments.forEach(inv => {
      const usdM = inv.isUSD ? usdRate : 1;
      let cur;
      if (inv.type === 'renda_fixa') cur = inv.manualCurrentPrice || inv.totalApplied || (inv.quantity * inv.purchasePrice) || 0;
      else cur = (inv.quantity || 0) * (inv.manualCurrentPrice || inv.purchasePrice || 0) * usdM;
      const cls = inv.type || 'outros';
      byClass[cls] = (byClass[cls] || 0) + cur;
    });
    return { current: investmentsTotal, cost: investmentsCost, byClass, count: investments.length };
  }, [investments, usdRate, investmentsTotal, investmentsCost]);

  const patrimonyHealth = useMemo(
    () => calculatePatrimonyHealthScore([], manualConfig, { totalGuarded: jarsTotal }, [], investmentsSummary),
    [manualConfig, jarsTotal, investmentsSummary]
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
    const OBJ_LABELS = {
      independence: 'independência financeira', start: 'começar a investir',
      debt: 'sair das dívidas', goal: 'conquistar um bem', control: 'controle total',
    };
    const PROFILE_LABELS = { conservative: 'conservador', moderate: 'moderado', aggressive: 'arrojado' };
    if (objectives.length > 0 && riskProfile) {
      const obj = objectives[0];
      if (obj === 'debt') {
        parts.push('Foco em sair das dívidas — liquide-as antes de ampliar investimentos de risco.');
      } else if (obj === 'independence' && riskProfile === 'aggressive') {
        parts.push('Perfil arrojado alinhado ao objetivo de independência financeira — caminho certo para crescimento acelerado.');
      } else if (obj === 'independence' && riskProfile === 'conservative') {
        parts.push('Objetivo de independência com perfil conservador — bom para preservar capital, porém o crescimento tende a ser mais lento.');
      } else if (obj === 'start') {
        parts.push(`Iniciando os investimentos com perfil ${PROFILE_LABELS[riskProfile] || riskProfile} — ótimo momento para criar consistência nos aportes.`);
      } else {
        parts.push(`Objetivo: ${OBJ_LABELS[obj] || obj}. Perfil ${PROFILE_LABELS[riskProfile] || riskProfile} — estratégia alinhada.`);
      }
    } else if (!riskProfile && objectives.length === 0) {
      parts.push('Configure seu perfil e objetivos em "Configurar Alívia" para análise personalizada.');
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
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* ═══ LEFT COLUMN (3/5) ═══ */}
        <div className="lg:col-span-3 flex flex-col gap-4">

      {/* ── HERO: PATRIMÔNIO TOTAL ── */}
      <div className={`p-5 md:p-7 rounded-[2rem] border relative overflow-hidden ${isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30 border-white/[0.06]' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900/40 border-slate-700'}`}>
        <div className="absolute top-[-50%] right-[-15%] w-[60%] h-[140%] rounded-full blur-[120px] pointer-events-none opacity-[0.12] bg-emerald-400" />
        <div className="absolute bottom-[-40%] left-[-10%] w-[40%] h-[100%] rounded-full blur-[100px] pointer-events-none opacity-[0.06] bg-purple-500" />
        <div className="relative">
          <div className="mb-4">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400/80 mb-1">Patrimônio Total Consolidado</p>
            <p className={`text-3xl md:text-4xl font-black tracking-tight leading-none ${patrimonioTotal >= 0 ? 'text-white' : 'text-rose-400'}`}>
              {fmtSigned(patrimonioTotal)}
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
          {patrimonioTotal > 0 && (
            <div className="space-y-2 pt-3 border-t border-white/[0.06]">
              <div className="flex rounded-full overflow-hidden h-2 bg-white/[0.06]">
                <div style={{ width: `${jarsTotal / patrimonioTotal * 100}%` }} className="bg-emerald-500 transition-all duration-700" />
                <div style={{ width: `${investmentsTotal / patrimonioTotal * 100}%` }} className="bg-purple-500 transition-all duration-700" />
                <div style={{ width: `${bensTotal / patrimonioTotal * 100}%` }} className="bg-orange-500 transition-all duration-700" />
              </div>
              <div className="flex justify-between flex-wrap gap-x-3 text-[9px] font-black text-slate-400">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Reserva — R$ {fmt(jarsTotal)} ({patrimonioTotal > 0 ? (jarsTotal/patrimonioTotal*100).toFixed(0) : 0}%)</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />Investimentos — R$ {fmt(investmentsTotal)} ({patrimonioTotal > 0 ? (investmentsTotal/patrimonioTotal*100).toFixed(0) : 0}%)</span>
                {bensTotal > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />Bens — R$ {fmt(bensTotal)} ({patrimonioTotal > 0 ? (bensTotal/patrimonioTotal*100).toFixed(0) : 0}%)</span>}
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
      <div className="flex-1 min-h-0">
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
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 h-full">
            <div className={`rounded-2xl border overflow-hidden h-full ${isDark ? 'bg-slate-900/80 border-white/[0.06]' : 'bg-white border-slate-100 shadow-sm'}`}>
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

      {/* ── PATRIMONY GOAL PROGRESS CARD ── */}
      {patrimonyGoals.length > 0 && (() => {
        const goal = patrimonyGoals[0];
        const goalTarget = goal.target || 0;
        const currentValue = patrimonioTotal;
        const remaining = Math.max(0, goalTarget - currentValue);
        const progressPct = goalTarget > 0 ? Math.min((currentValue / goalTarget) * 100, 100) : 0;
        const isGoalReached = currentValue >= goalTarget;
        const GoalIcon = goal.patrimonyGoalType === 'imovel' ? Home : Gem;
        const goalLabel = goal.patrimonyGoalType === 'imovel' ? 'Meta: Imóvel' : 'Meta de Patrimônio';

        // CDI médio últimos 10 anos ≈ 11.15% a.a. (fonte: BCB 2014-2024)
        const CDI_MEDIO_10A = 11.15;
        const monthlyRate = Math.pow(1 + CDI_MEDIO_10A / 100, 1 / 12) - 1;
        const fmtTime = (m) => m < 12 ? `${m} meses` : `${Math.floor(m/12)}a ${m%12}m`;

        return (
          <div className={`p-4 md:p-5 rounded-2xl border relative overflow-hidden ${
            isGoalReached
              ? 'bg-gradient-to-r from-emerald-900/40 to-teal-900/30 border-emerald-500/30'
              : isDark ? 'bg-gradient-to-r from-slate-900 to-blue-950/40 border-white/[0.06]' : 'bg-gradient-to-r from-white to-blue-50/50 border-slate-200 shadow-sm'
          }`}>
            <div className={`absolute top-[-50%] right-[-15%] w-[40%] h-[120%] rounded-full blur-[80px] pointer-events-none opacity-10 ${isGoalReached ? 'bg-emerald-400' : 'bg-blue-500'}`} />

            <div className="relative">
              {/* Header + Progress inline */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${isGoalReached ? 'bg-emerald-500/20' : isDark ? 'bg-blue-500/15' : 'bg-blue-100'}`}>
                    <GoalIcon className={`w-4 h-4 ${isGoalReached ? 'text-emerald-400' : isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                  </div>
                  <div>
                    <p className={`text-[9px] font-black uppercase tracking-[0.15em] ${isGoalReached ? 'text-emerald-400' : isDark ? 'text-blue-400' : 'text-blue-500'}`}>{goalLabel}</p>
                    <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{goal.title}</p>
                  </div>
                </div>
                {isGoalReached && (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-widest animate-pulse">✨ Alcançada!</span>
                )}
              </div>

              {/* Values Row */}
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div>
                  <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Alvo</p>
                  <p className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>R$ {fmt(goalTarget)}</p>
                </div>
                <div>
                  <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Acumulado</p>
                  <p className="text-base font-black text-emerald-400">R$ {fmt(currentValue)}</p>
                </div>
                <div>
                  <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Faltam</p>
                  <p className={`text-base font-black ${remaining > 0 ? (isDark ? 'text-amber-400' : 'text-amber-500') : 'text-emerald-400'}`}>{remaining > 0 ? `R$ ${fmt(remaining)}` : '✔'}</p>
                </div>
                <div>
                  <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Progresso</p>
                  <p className={`text-base font-black ${isGoalReached ? 'text-emerald-400' : isDark ? 'text-blue-400' : 'text-blue-500'}`}>{progressPct.toFixed(1)}%</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className={`h-2 rounded-full overflow-hidden mb-3 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                <div className={`h-full rounded-full transition-all duration-1000 ${isGoalReached ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-emerald-500'}`} style={{ width: `${progressPct}%` }} />
              </div>

              {/* Goal Simulation — saved or CTA */}
              {!isGoalReached && remaining > 0 && (() => {
                const savedYears = goal.simYears ? parseFloat(goal.simYears) : null;
                const savedAporte = goal.simAporte || null;
                const hasSavedSim = savedYears && savedAporte;

                const simMonths = savedYears ? Math.round(savedYears * 12) : 0;
                const simAporteVal = savedAporte ? parseFloat(String(savedAporte).replace(/\D/g, '')) / 100 : 0;

                // FV = PV*(1+r)^n + PMT*((1+r)^n - 1)/r
                const projectedValue = hasSavedSim
                  ? currentValue * Math.pow(1 + monthlyRate, simMonths) + simAporteVal * ((Math.pow(1 + monthlyRate, simMonths) - 1) / monthlyRate)
                  : 0;
                const willReach = projectedValue >= goalTarget;

                let monthsNeeded = null;
                if (simAporteVal > 0) {
                  for (let n = 1; n <= 600; n++) {
                    const fv = currentValue * Math.pow(1 + monthlyRate, n) + simAporteVal * ((Math.pow(1 + monthlyRate, n) - 1) / monthlyRate);
                    if (fv >= goalTarget) { monthsNeeded = n; break; }
                  }
                }

                const handleOpenModal = (isEdit = false) => {
                  if (isEdit && hasSavedSim) {
                    setSimModalYears(String(savedYears));
                    const v = (parseFloat(String(savedAporte).replace(/\D/g, '')) / 100);
                    setSimModalAporte(v.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
                  } else {
                    setSimModalYears('');
                    setSimModalAporte('');
                  }
                  setShowSimModal(true);
                };

                const handleDeleteSim = async () => {
                  try {
                    const { deleteField } = await import('firebase/firestore');
                    await updateDoc(doc(db, 'goals', goal.id), {
                      simYears: deleteField(),
                      simAporte: deleteField(),
                    });
                  } catch (e) { console.error(e); }
                };

                return (
                  <>
                    {!hasSavedSim ? (
                      <button
                        onClick={() => handleOpenModal(false)}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all border ${
                          isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20' : 'bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100'
                        }`}
                      >
                        <LineChart className="w-3.5 h-3.5" />
                        Planejar minha meta
                      </button>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className={`flex items-baseline gap-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Seu Plano:</p>
                            <p className="text-base font-black">
                              R$ {fmt(simAporteVal)}<span className="text-[10px] font-bold opacity-70 ml-0.5">/mês</span>
                            </p>
                            <div className="w-px h-3 bg-current opacity-20"></div>
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-70">
                              Por {savedYears} ano{savedYears !== 1 ? 's' : ''} + CDI {CDI_MEDIO_10A}%
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleOpenModal(true)} className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-white/5 text-slate-500 hover:text-blue-400' : 'hover:bg-slate-100 text-slate-400 hover:text-blue-500'}`}>
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={handleDeleteSim} className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-white/5 text-slate-500 hover:text-rose-400' : 'hover:bg-slate-100 text-slate-400 hover:text-rose-500'}`}>
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className={`p-3 rounded-xl border ${willReach ? (isDark ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-emerald-50 border-emerald-100') : (isDark ? 'bg-amber-500/5 border-amber-500/15' : 'bg-amber-50 border-amber-100')}`}>
                            <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${willReach ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-amber-400' : 'text-amber-600')}`}>
                              Em {savedYears} ano{savedYears !== 1 ? 's' : ''} você terá
                            </p>
                            <p className={`text-base font-black ${willReach ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-amber-400' : 'text-amber-600')}`}>
                              R$ {fmt(projectedValue)}
                            </p>
                            <p className={`text-[8px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              {willReach ? '✓ Meta atingida com aportes + CDI' : `Faltarão R$ ${fmt(goalTarget - projectedValue)}`}
                            </p>
                          </div>
                          <div className={`p-3 rounded-xl border ${isDark ? 'bg-blue-500/5 border-blue-500/15' : 'bg-blue-50 border-blue-100'}`}>
                            <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Tempo com aportes + CDI</p>
                            <p className={`text-base font-black ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{monthsNeeded ? fmtTime(monthsNeeded) : '–'}</p>
                            <p className={`text-[8px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>CDI médio {CDI_MEDIO_10A}% a.a.</p>
                          </div>
                          <div className={`p-3 rounded-xl border ${isDark ? 'bg-purple-500/5 border-purple-500/15' : 'bg-purple-50 border-purple-100'}`}>
                            <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>Ativos de Maior Risco</p>
                            <p className={`text-[10px] font-bold leading-snug ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Com ações, FIIs ou cripto, essa meta pode ser atingida em menos tempo — porém com maior volatilidade.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* ── SAÚDE PATRIMONIAL ── */}
      <div className="flex-1 min-h-0">
        {(() => {
          const h = patrimonyHealth;
          const d = h.breakdown?.data || {};
          const PILLAR_META = {
            reserve: { color: '#10b981', desc: `Sua reserva cobre ${d.monthsCovered || '0.0'} de ${d.reserveMonthsTarget || 6} meses de despesa.` },
            diversification: { color: '#3b82f6', desc: d.invCount > 0 ? `${d.classCount} classe(s) de ativo · maior peso ${d.maxWeight || 0}%.` : 'Cadastre investimentos para diversificar.' },
            profitability: { color: '#a855f7', desc: d.invCount > 0 ? `Retorno acumulado de ${d.returnPct || 0}% sobre o investido.` : 'Sem investimentos para medir retorno.' },
          };
          const ring = h.score >= 70 ? '#10b981' : h.score >= 50 ? '#eab308' : h.score > 0 ? '#f43f5e' : '#64748b';
          const C = 2 * Math.PI * 34;
          return (
            <div className={`rounded-2xl border h-full p-4 md:p-5 flex flex-col ${isDark ? 'bg-slate-900/80 border-white/[0.06]' : 'bg-white border-slate-100 shadow-sm'}`}>
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
                  return (
                    <div key={p.key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-2 text-[11px] font-bold"><span className="w-2 h-2 rounded-full" style={{ background: meta.color }} /><span className={isDark ? 'text-slate-200' : 'text-slate-700'}>{p.label}</span></span>
                        <span className={`text-[10px] font-black ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{p.score}<span className="text-slate-500">/{p.max} pts</span></span>
                      </div>
                      <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meta.color }} />
                      </div>
                      <p className="text-[9.5px] mt-1 text-slate-500">{meta.desc}</p>
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