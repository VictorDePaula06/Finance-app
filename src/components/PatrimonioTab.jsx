import { useState, useMemo, useEffect } from 'react';
import { Wallet, PiggyBank, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, Eye, EyeOff, BarChart3, Bot, Loader2, Sparkles, LayoutDashboard, LineChart, Layers, List, HelpCircle, ShieldCheck, Target, Home, Gem, Pencil, Trash2, Save, RefreshCw, Info } from 'lucide-react';
import aliviaFinal from '../assets/alivia/alivia-final.png';
import PatrimonioConfigForm from './PatrimonioConfigForm';
import { PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer, AreaChart, Area, LineChart as RLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip } from 'recharts';
import ReactMarkdown from 'react-markdown';
import { generatePatrimonyAnalysis, isGeminiConfigured } from '../services/gemini';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
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
export default function PatrimonioTab({ transactions, manualConfig }) {
  const { theme } = useTheme();
  const { currentUser, userPrefs } = useAuth();
  const isDark = theme !== 'light';
  const [showPatrimonioConfig, setShowPatrimonioConfig] = useState(false);

  // ── state ──────────────────────────────────────────────────────────────────
  const [jars, setJars] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [cdiAnual, setCdiAnual] = useState(10.65); // fallback %
  const [hidePatrimonio, setHidePatrimonio] = useState(() => localStorage.getItem('hidePatrimonio') === 'true');
  const [usdRate, setUsdRate] = useState(5.0);
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

  useEffect(() => {
    fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json')
      .then(r => r.json())
      .then(d => setCdiAnual(parseFloat(d[0].valor) * 365))
      .catch(() => {});
      
    fetch('https://economia.awesomeapi.com.br/last/USD-BRL')
      .then(r => r.json())
      .then(d => setUsdRate(parseFloat(d.USDBRL.bid)))
      .catch(() => {});
  }, []);

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

  // Investments
  const investmentsTotal = useMemo(() => {
    return investments.reduce((acc, a) => {
      const price = a.manualCurrentPrice || a.purchasePrice;
      const usdMultiplier = a.isUSD ? usdRate : 1;
      return acc + (a.quantity * price * usdMultiplier);
    }, 0);
  }, [investments, usdRate]);

  const investmentsCost = useMemo(() => {
    return investments.reduce((acc, a) => {
      const usdMultiplier = a.isUSD ? usdRate : 1;
      return acc + (a.quantity * (a.purchasePrice || 0) * usdMultiplier);
    }, 0);
  }, [investments, usdRate]);

  const patrimonioTotal = jarsTotal + investmentsTotal;
  const investmentsProfit = investmentsTotal - investmentsCost;

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

  // ── render ─────────────────────────────────────────────────────────────────
  const h1 = isDark ? 'text-white' : 'text-slate-900';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="animate-in fade-in duration-700 pb-4">
      {/* Top bar */}
      <div className="flex items-center justify-end mb-4">
        <button onClick={() => setShowPatrimonioConfig(true)} className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 border ${isDark ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <Pencil className="w-3 h-3" /> Editar Configuração
        </button>
      </div>

      {activeTab === 'visao' && (<>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* ═══ LEFT COLUMN (3/5) ═══ */}
        <div className="lg:col-span-3 space-y-4">

      {/* ── HERO: PATRIMÔNIO TOTAL ── */}
      <div className={`p-5 md:p-7 rounded-[2rem] border relative overflow-hidden ${isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30 border-white/[0.06]' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900/40 border-slate-700'}`}>
        <div className="absolute top-[-50%] right-[-15%] w-[60%] h-[140%] rounded-full blur-[120px] pointer-events-none opacity-[0.12] bg-emerald-400" />
        <div className="absolute bottom-[-40%] left-[-10%] w-[40%] h-[100%] rounded-full blur-[100px] pointer-events-none opacity-[0.06] bg-purple-500" />
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400/80 mb-1">Patrimônio Total Consolidado</p>
              <p className={`text-3xl md:text-4xl font-black tracking-tight leading-none ${patrimonioTotal >= 0 ? 'text-white' : 'text-rose-400'}`}>
                {fmtSigned(patrimonioTotal)}
              </p>
            </div>
            {totalDailyYield > 0 && (
              <div className="flex flex-wrap gap-1.5">
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
                <div style={{ width: `${jarsTotal / patrimonioTotal * 100}%` }} className="bg-emerald-500 transition-all duration-700 rounded-l-full" />
                <div style={{ width: `${investmentsTotal / patrimonioTotal * 100}%` }} className="bg-purple-500 transition-all duration-700 rounded-r-full" />
              </div>
              <div className="flex justify-between text-[9px] font-black text-slate-400">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Reserva — R$ {fmt(jarsTotal)} ({patrimonioTotal > 0 ? (jarsTotal/patrimonioTotal*100).toFixed(0) : 0}%)</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />Investimentos — R$ {fmt(investmentsTotal)} ({patrimonioTotal > 0 ? (investmentsTotal/patrimonioTotal*100).toFixed(0) : 0}%)</span>
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
          <div className={`p-2.5 rounded-xl shrink-0 ${investmentsProfit >= 0 ? (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50') : (isDark ? 'bg-rose-500/10' : 'bg-rose-50')}`}>
            <ArrowUpCircle className={`w-5 h-5 ${investmentsProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Rentabilidade</p>
            <p className={`text-lg font-black truncate ${investmentsProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{fmtSigned(investmentsProfit)}</p>
            <p className={`text-[9px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Lucro acumulado dos investimentos</p>
          </div>
        </div>
      </div>

      {/* ── MEU PATRIMÔNIO: Allocation Chart + Breakdown ── */}
      {(() => {
        const CATEGORY_COLORS = {
          'Reserva': '#10b981',
          'Renda Fixa': '#6366f1',
          'Ações': '#a855f7',
          'ETFs': '#3b82f6',
          'Fundos Imobiliários': '#14b8a6',
          'Criptomoedas': '#f59e0b',
          'Imóveis': '#f97316',
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
                  <div className="relative w-full lg:w-[280px] flex-shrink-0">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={chartItems} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={2} dataKey="value" stroke="none" animationDuration={600}>
                          {chartItems.map((entry, idx) => (<Cell key={idx} fill={entry.color} className="transition-all hover:opacity-80" />))}
                        </Pie>
                        <ReTooltip content={<CustomPieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
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

        </div>{/* end left col */}

        {/* ═══ RIGHT COLUMN (2/5) ═══ */}
        <div className="lg:col-span-2 space-y-4">

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
                          <p className={`text-[8px] font-black uppercase tracking-widest ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                            Seu Plano: R$ {fmt(simAporteVal)}/mês por {savedYears} ano{savedYears !== 1 ? 's' : ''} + CDI {CDI_MEDIO_10A}%
                          </p>
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



      {/* ── ALÍVIA PATRIMÔNIO INSIGHT ── */}
      {(() => {
        // --- Local patrimony insight generation ---
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

        return (
          <div className={`flex items-start gap-3 p-4 rounded-2xl border ${bgColors[pStatus]} transition-all duration-300 shadow-inner`}>
            <div className="relative shrink-0 mt-0.5">
              <img src={aliviaFinal} alt="Alívia" className="w-10 h-10 object-cover rounded-full border-2 border-white/20 shadow-md" />
              <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full ${isDark ? 'bg-[#131621]' : 'bg-white'} border border-white/10 ${textColors[pStatus]}`}>
                {statusIcons[pStatus]}
              </div>
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className={`text-[10px] font-black uppercase tracking-widest ${textColors[pStatus]} opacity-90`}>Alívia</span>
              <span className={`text-[12px] font-medium leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {pMessage}
              </span>
            </div>
            <button
              onClick={() => handleAnalyze(true)}
              title="Atualizar Insight"
              className={`p-2 rounded-lg transition-all shrink-0 ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-black/5 text-slate-400'}`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        );
      })()}

      {/* ── RETORNO ACUMULADO (%) vs CDI — Últimos 3 meses ── */}
      {(() => {
        if (patrimonioTotal <= 0) return null;

        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        
        // 1. Build list of all assets with their parameters and purchase dates
        const assets = [];
        jars.forEach(jar => {
          const balance = parseFloat(jar.balance) || 0;
          if (balance > 0) {
            assets.push({
              value: balance,
              type: 'cdi',
              cdiMultiplier: (parseFloat(jar.cdiPercent) || 100) / 100,
              purchaseDate: jar.createdAt ? new Date(jar.createdAt) : now
            });
          }
        });
        
        investments.forEach(inv => {
          const pDate = inv.purchaseDate ? new Date(inv.purchaseDate) : (inv.createdAt ? new Date(inv.createdAt) : now);
          if (inv.type === 'renda_fixa') {
            const applied = inv.totalApplied || (inv.purchasePrice * (inv.quantity || 1)) || 0;
            if (applied > 0) {
              const yieldType = inv.yieldType || (inv.cdiPercent ? 'cdi' : 'pre');
              if (yieldType === 'cdi') {
                const pct = (parseFloat(String(inv.cdiPercent || 100).replace(',', '.')) || 100) / 100;
                assets.push({ value: applied, type: 'cdi', cdiMultiplier: pct, purchaseDate: pDate });
              } else if (yieldType === 'ipca') {
                const fixedPart = parseFloat(String(inv.fixedRate || 0).replace(',', '.'));
                assets.push({ value: applied, type: 'fixed', annualRate: (4.5 + fixedPart) / 100, purchaseDate: pDate });
              } else {
                const fixedPart = parseFloat(String(inv.fixedRate || 0).replace(',', '.'));
                assets.push({ value: applied, type: 'fixed', annualRate: fixedPart / 100, purchaseDate: pDate });
              }
            }
          } else {
            // Variable
            const cost = (inv.quantity || 1) * (inv.purchasePrice || 0);
            const currentPrice = inv.manualCurrentPrice || inv.purchasePrice || 0; // Using manual/purchase since we don't have live prices here
            const usdM = inv.isUSD ? usdRate : 1;
            const current = (inv.quantity || 1) * currentPrice * usdM;
            const totalCost = cost * usdM;
            if (totalCost > 0) {
              const returnPct = ((current - totalCost) / totalCost) * 100;
              assets.push({ value: current, type: 'variable', returnPct, purchaseDate: pDate });
            }
          }
        });

        // 2. Generate 4 monthly points
        const numPoints = 4;
        const totalPortfolioValue = assets.reduce((acc, a) => acc + a.value, 0);
        const calendarDaysInPeriod = Math.max(1, (now - periodStart) / (1000 * 60 * 60 * 24));
        
        const chartData = Array.from({ length: numPoints }, (_, i) => {
          const pointDate = new Date(periodStart);
          pointDate.setDate(periodStart.getDate() + Math.round((calendarDaysInPeriod * i) / (numPoints - 1)));
          const label = pointDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
          
          let weightedReturn = 0;
          if (totalPortfolioValue > 0) {
            assets.forEach(asset => {
              const weight = asset.value / totalPortfolioValue;
              if (asset.purchaseDate > pointDate) return; // Not purchased yet
              
              const effectiveStart = asset.purchaseDate > periodStart ? asset.purchaseDate : periodStart;
              const calDaysHeld = Math.max(0, (pointDate - effectiveStart) / (1000 * 60 * 60 * 24));
              const tradingDaysHeld = Math.round(calDaysHeld * 252 / 365);
              
              if (asset.type === 'cdi') {
                const dailyRate = Math.pow(1 + (cdiAnual / 100) * asset.cdiMultiplier, 1 / 252) - 1;
                weightedReturn += weight * ((Math.pow(1 + dailyRate, tradingDaysHeld) - 1) * 100);
              } else if (asset.type === 'fixed') {
                const dailyRate = Math.pow(1 + asset.annualRate, 1 / 252) - 1;
                weightedReturn += weight * ((Math.pow(1 + dailyRate, tradingDaysHeld) - 1) * 100);
              } else if (asset.type === 'variable') {
                const totalAssetCalDays = Math.max(1, (now - effectiveStart) / (1000 * 60 * 60 * 24));
                const pointReturn = (asset.returnPct * calDaysHeld) / totalAssetCalDays;
                weightedReturn += weight * pointReturn;
              }
            });
          }

          // Benchmark CDI (from periodStart to pointDate)
          const cdiCalDaysHeld = Math.max(0, (pointDate - periodStart) / (1000 * 60 * 60 * 24));
          const cdiTradingDaysHeld = Math.round(cdiCalDaysHeld * 252 / 365);
          const baseDailyRate = Math.pow(1 + cdiAnual / 100, 1 / 252) - 1;
          const cdiReturn = (Math.pow(1 + baseDailyRate, cdiTradingDaysHeld) - 1) * 100;

          return {
            name: label.charAt(0).toUpperCase() + label.slice(1),
            'Meu Portfólio': Math.round(weightedReturn * 100) / 100,
            'CDI': Math.round(cdiReturn * 100) / 100,
          };
        });

        const CustomTooltip = ({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          return (
            <div className={`px-4 py-3 rounded-2xl border shadow-2xl text-[10px] ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
              <p className="font-black text-slate-500 uppercase tracking-widest mb-2">{label}</p>
              {payload.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-4 mb-1">
                  <span className="flex items-center gap-1.5 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
                    {p.name}
                  </span>
                  <span className="font-black" style={{ color: p.color }}>
                    {p.value >= 0 ? '+' : ''}{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}%
                  </span>
                </div>
              ))}
            </div>
          );
        };

        return (
          <div className={`rounded-[2rem] border overflow-hidden p-6 ${isDark ? 'bg-slate-900/80 border-white/[0.06]' : 'bg-white border-slate-100 shadow-sm'}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-[#00E5A0]" />
                <h3 className={`font-black text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  Retorno Acumulado (%)
                </h3>
              </div>
              <div className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-xl self-start md:self-auto ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                <Info className="w-3 h-3" />
                Base 0% no início do período
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-6 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 rounded-full bg-[#6366f1] opacity-70" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, #6366f1 2px, #6366f1 4px)' }} />
                <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>CDI</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 rounded-full bg-[#00E5A0]" />
                <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Meu Portfólio</span>
              </div>
            </div>

            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RLineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <defs>
                    <filter id="miniPortfolioGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="2" result="glow" />
                      <feMerge>
                        <feMergeNode in="glow" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <linearGradient id="miniPortfolioGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#00E5A0" />
                      <stop offset="100%" stopColor="#00D4FF" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: isDark ? '#64748b' : '#94a3b8', fontWeight: 700 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: isDark ? '#475569' : '#cbd5e1', fontWeight: 600 }}
                    tickFormatter={v => typeof v === 'number' ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : v}
                    width={50}
                  />
                  <RTooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="CDI" 
                    stroke="#6366f1" 
                    strokeWidth={1.5} 
                    strokeDasharray="4 4" 
                    dot={false} 
                    activeDot={{ r: 4, strokeWidth: 0, fill: '#6366f1' }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Meu Portfólio" 
                    stroke="url(#miniPortfolioGradient)" 
                    strokeWidth={3} 
                    dot={false} 
                    activeDot={{ r: 5, strokeWidth: 2, stroke: '#00E5A0', fill: isDark ? '#0f172a' : '#ffffff' }} 
                    filter="url(#miniPortfolioGlow)"
                  />
                </RLineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })()}

        </div>{/* end right col */}
      </div>{/* end grid */}
      </>)}

      {/* ── PATRIMÔNIO CONFIG MODAL ── */}
      {showPatrimonioConfig && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-500">
          <div className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500 custom-scrollbar ${
            isDark ? 'bg-slate-900' : 'bg-white'
          }`}>
            <PatrimonioConfigForm
              onClose={() => setShowPatrimonioConfig(false)}
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