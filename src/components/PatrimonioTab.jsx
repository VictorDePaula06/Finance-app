import { useState, useMemo, useEffect } from 'react';
import { Wallet, PiggyBank, TrendingUp, ArrowUpCircle, ArrowDownCircle, Eye, EyeOff, BarChart3, Bot, Loader2, Sparkles, LayoutDashboard, LineChart, Layers, List, HelpCircle, ShieldCheck, Target, Home, Gem } from 'lucide-react';
import PatrimonioConfigForm from './PatrimonioConfigForm';
import { PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer } from 'recharts';
import ReactMarkdown from 'react-markdown';
import { generatePatrimonyAnalysis, isGeminiConfigured } from '../services/gemini';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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
  // Jars
  const jarsTotal = useMemo(() => jars.reduce((a, j) => a + (j.balance || 0), 0), [jars]);
  const { jarsDailyYield, totalDailyYield } = useMemo(() => {
    // 1. Yield from Jars (cofrinhos)
    const jarsYield = jars.reduce((a, j) => {
      const rate = Math.pow(1 + (cdiAnual / 100) * (j.cdiPercent / 100), 1 / 365) - 1;
      return a + (j.balance || 0) * rate;
    }, 0);

    // 2. Yield from Fixed Income Investments (Renda Fixa)
    const fixedIncomeYield = investments.reduce((a, inv) => {
      if (inv.type === 'renda_fixa') {
        let rate = 0;
        const currentVal = (inv.manualCurrentPrice || inv.purchasePrice) * inv.quantity;
        
        if (inv.yieldType === 'cdi' && inv.cdiPercent) {
          const cdiP = parseFloat(String(inv.cdiPercent).replace(',', '.'));
          rate = Math.pow(1 + (cdiAnual / 100) * (cdiP / 100), 1 / 365) - 1;
        } else if (inv.yieldType === 'ipca' && inv.fixedRate) {
          // IPCA approx fallback
          const ipcaAnual = 4.5; 
          const fixedP = parseFloat(String(inv.fixedRate).replace(',', '.'));
          rate = Math.pow(1 + (ipcaAnual / 100) + (fixedP / 100), 1 / 365) - 1;
        } else if (inv.yieldType === 'pre' && inv.fixedRate) {
          const fixedP = parseFloat(String(inv.fixedRate).replace(',', '.'));
          rate = Math.pow(1 + (fixedP / 100), 1 / 365) - 1;
        } else if (inv.cdiPercent) { // fallback
           const cdiP = parseFloat(String(inv.cdiPercent).replace(',', '.'));
           rate = Math.pow(1 + (cdiAnual / 100) * (cdiP / 100), 1 / 365) - 1;
        }
        
        return a + (currentVal * rate);
      }
      return a;
    }, 0);

    return { 
      jarsDailyYield: jarsYield, 
      totalDailyYield: jarsYield + fixedIncomeYield 
    };
  }, [jars, investments, cdiAnual]);

  // Investments — only from Firestore collection (matches InvestmentsTab)
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

  // Patrimônio = apenas ativos acumulados (cofrinhos + investimentos)
  const patrimonioTotal = jarsTotal + investmentsTotal;
  const investmentsProfit = investmentsTotal - investmentsCost;

  const handleAnalyze = async () => {
    if (!isGeminiConfigured()) {
        alert("Você precisa configurar sua chave da Alívia (Menu Inferior Direito) para usar esta função.");
        return;
    }
    setIsAnalyzing(true);
    const analysis = await generatePatrimonyAnalysis(jarsTotal, investmentsTotal, userConfig);
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  };

  // ── render ─────────────────────────────────────────────────────────────────
  const h1 = isDark ? 'text-white' : 'text-slate-900';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">

      {/* ── TAB NAVIGATION ── */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl border w-fit" style={{ background: isDark ? 'rgba(15,23,42,0.8)' : '#f8fafc', borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0' }}>
        <button
          onClick={() => setActiveTab('visao')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'visao'
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
              : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          Visão Geral
        </button>
      </div>

      {/* ── VISÃO GERAL TAB ── */}
      {activeTab === 'visao' && (<>
        {/* ── PATRIMÔNIO CONFIG BAR ── */}
        {(() => {
          const onboarding = userPrefs?.onboarding || {};
          const hasObjectives = onboarding.objectives?.length > 0;
          const hasProfile = !!onboarding.riskProfile;
          const isConfigured = hasObjectives && hasProfile;
          return (
            <div className={`p-5 md:p-6 rounded-[2rem] border animate-in fade-in slide-in-from-top-4 duration-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100 shadow-sm'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  isConfigured ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                }`}>
                  {isConfigured ? <ShieldCheck className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}
                </div>
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${
                    isConfigured ? 'text-emerald-500' : 'text-amber-500'
                  }`}>
                    {isConfigured ? 'Patrimônio Configurado' : 'Configuração Pendente'}
                  </p>
                  <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {isConfigured
                      ? 'Seu perfil de investidor e objetivos estão definidos.'
                      : 'Defina seu perfil e objetivos para personalizar o módulo.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPatrimonioConfig(true)}
                className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 shrink-0 ${
                  isConfigured
                    ? (isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                    : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isConfigured ? 'Editar Configuração' : 'Configurar Patrimônio'}
              </button>
            </div>
          );
        })()}

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500 mb-1">Patrimônio</p>
          <h2 className={`text-3xl font-black ${h1}`}>Sua Riqueza</h2>
          <p className={`text-sm ${sub}`}>Visão consolidada de todos os seus ativos.</p>
        </div>

      {/* ── PATRIMÔNIO TOTAL ── */}
      <div className={`p-8 rounded-[2.5rem] border relative overflow-hidden ${isDark ? 'bg-gradient-to-br from-slate-900 to-slate-800 border-white/10' : 'bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700'}`}>
        <div className="absolute top-[-30%] right-[-10%] w-[50%] h-[100%] rounded-full blur-[80px] pointer-events-none opacity-20 bg-emerald-500" />
        <div className="relative">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-4">Patrimônio Total Consolidado</p>
          <p className={`text-5xl font-black tracking-tight ${patrimonioTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fmtSigned(patrimonioTotal)}
          </p>
          {totalDailyYield > 0 && (
            <p className="text-emerald-400 text-sm font-bold mt-2">
              ↑ R$ {fmt(totalDailyYield)}/dia em rendimentos estimados
            </p>
          )}
          {/* Breakdown bar */}
          {patrimonioTotal > 0 && (
            <div className="mt-6 space-y-2">
              <div className="flex rounded-full overflow-hidden h-2 bg-white/10">
                <div style={{ width: `${jarsTotal / patrimonioTotal * 100}%` }} className="bg-emerald-500 transition-all" />
                <div style={{ width: `${investmentsTotal / patrimonioTotal * 100}%` }} className="bg-purple-500 transition-all" />
              </div>
              <div className="flex gap-4 text-[10px] font-black text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Reserva</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />Investimentos</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 3 pillar cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Reserva de Emergência */}
        <MiniCard
          label="Reserva"
          value={jarsTotal}
          icon={PiggyBank}
          color="text-emerald-400"
          isDark={isDark}
          detail={jars.length > 0 ? `${jars.length} ativo${jars.length > 1 ? 's' : ''} na reserva • +R$ ${fmt(jarsDailyYield)}/dia` : 'Comece sua reserva de emergência'}
        />

        {/* Investimentos */}
        <MiniCard
          label="Investimentos"
          value={investmentsTotal}
          icon={TrendingUp}
          color="text-purple-400"
          isDark={isDark}
          isHidable
          isHidden={hidePatrimonio}
          onToggle={() => { const v = !hidePatrimonio; setHidePatrimonio(v); localStorage.setItem('hidePatrimonio', String(v)); }}
          detail="Tesouro, Cripto, CDB, Ações e mais"
        />

        {/* Rentabilidade (Lucro Investimentos + Projeção Reservas) */}
        <MiniCard
          label="Lucro (Investimentos)"
          value={investmentsProfit}
          icon={ArrowUpCircle}
          color={investmentsProfit >= 0 ? "text-emerald-400" : "text-rose-400"}
          isDark={isDark}
          detail={`+R$ ${fmt(totalDailyYield * 30)}/mês proj. rendimentos`}
        />
      </div>

      {/* ── PATRIMONY GOAL PROGRESS CARD ── */}
      {patrimonyGoals.length > 0 && (() => {
        const goal = patrimonyGoals[0];
        const goalTarget = goal.target || 0;
        const currentValue = patrimonioTotal;
        const remaining = Math.max(0, goalTarget - currentValue);
        const progressPct = goalTarget > 0 ? Math.min((currentValue / goalTarget) * 100, 100) : 0;
        const isOnTrack = currentValue > 0 && totalDailyYield > 0;
        const monthlyGrowth = totalDailyYield * 30;
        const monthsToGoal = monthlyGrowth > 0 ? Math.ceil(remaining / monthlyGrowth) : null;
        const isGoalReached = currentValue >= goalTarget;
        const GoalIcon = goal.patrimonyGoalType === 'imovel' ? Home : Gem;
        const goalLabel = goal.patrimonyGoalType === 'imovel' ? 'Meta: Imóvel' : 'Meta de Patrimônio';

        return (
          <div className={`p-6 md:p-8 rounded-[2.5rem] border relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 ${
            isGoalReached
              ? 'bg-gradient-to-br from-emerald-900/50 to-teal-900/50 border-emerald-500/30'
              : isDark ? 'bg-gradient-to-br from-slate-900 to-blue-950/50 border-white/10' : 'bg-gradient-to-br from-white to-blue-50 border-slate-200 shadow-sm'
          }`}>
            {/* Glow */}
            <div className={`absolute top-[-40%] right-[-15%] w-[50%] h-[100%] rounded-full blur-[100px] pointer-events-none opacity-15 ${
              isGoalReached ? 'bg-emerald-400' : 'bg-blue-500'
            }`} />

            <div className="relative">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl shadow-inner ${
                    isGoalReached ? 'bg-emerald-500/20' : isDark ? 'bg-blue-500/20' : 'bg-blue-100'
                  }`}>
                    <GoalIcon className={`w-6 h-6 ${isGoalReached ? 'text-emerald-400' : isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                  </div>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                      isGoalReached ? 'text-emerald-400' : isDark ? 'text-blue-400' : 'text-blue-500'
                    }`}>{goalLabel}</p>
                    <p className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{goal.title}</p>
                  </div>
                </div>
                {isGoalReached && (
                  <div className="px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest animate-pulse">
                    ✨ Meta Alcançada!
                  </div>
                )}
              </div>

              {/* Values Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Alvo</p>
                  <p className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>R$ {fmt(goalTarget)}</p>
                </div>
                <div>
                  <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Acumulado</p>
                  <p className="text-xl font-black text-emerald-400">R$ {fmt(currentValue)}</p>
                </div>
                <div>
                  <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Faltam</p>
                  <p className={`text-xl font-black ${remaining > 0 ? (isDark ? 'text-amber-400' : 'text-amber-500') : 'text-emerald-400'}`}>
                    {remaining > 0 ? `R$ ${fmt(remaining)}` : '✔ Completo'}
                  </p>
                </div>
                <div>
                  <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Progresso</p>
                  <p className={`text-xl font-black ${isGoalReached ? 'text-emerald-400' : isDark ? 'text-blue-400' : 'text-blue-500'}`}>
                    {progressPct.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className={`h-3 rounded-full overflow-hidden mb-4 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${isGoalReached ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-gradient-to-r from-blue-500 to-emerald-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]'}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Insights */}
              {!isGoalReached && (
                <div className={`flex flex-col sm:flex-row gap-3 mt-4`}>
                  {monthlyGrowth > 0 && (
                    <div className={`flex-1 p-4 rounded-2xl border ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
                      <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Crescimento Mensal Estimado</p>
                      <p className={`text-lg font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>+R$ {fmt(monthlyGrowth)} <span className="text-[10px] opacity-70">/mês</span></p>
                    </div>
                  )}
                  {monthsToGoal && monthsToGoal < 600 && (
                    <div className={`flex-1 p-4 rounded-2xl border ${isDark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
                      <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Tempo Estimado (só rendimentos)</p>
                      <p className={`text-lg font-black ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                        {monthsToGoal < 12 ? `${monthsToGoal} meses` : `${Math.floor(monthsToGoal / 12)} anos e ${monthsToGoal % 12} meses`}
                      </p>
                    </div>
                  )}
                  {isOnTrack && monthlyGrowth > 0 && (
                    <div className={`flex-1 p-4 rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                      <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Status</p>
                      <p className={`text-sm font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        ✓ Patrimônio crescendo com rendimentos
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
            <div className="flex items-center justify-between mb-4">
              <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${sub}`}>Meu Patrimônio</p>
              <div className="flex items-center gap-2">
                {/* Include/exclude reserve */}
                <button
                  onClick={() => setIncludeReserve(!includeReserve)}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                    includeReserve
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                      : isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
                  }`}
                >
                  {includeReserve ? '✓ Com Reserva' : 'Sem Reserva'}
                </button>
                {/* Category / Asset toggle */}
                <div className={`flex rounded-xl border overflow-hidden ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                  <button
                    onClick={() => setChartViewMode('category')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                      chartViewMode === 'category'
                        ? 'bg-emerald-500 text-white'
                        : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Layers className="w-3 h-3" /> Categoria
                  </button>
                  <button
                    onClick={() => setChartViewMode('asset')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                      chartViewMode === 'asset'
                        ? 'bg-emerald-500 text-white'
                        : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <List className="w-3 h-3" /> Ativo
                  </button>
                </div>
              </div>
            </div>

            <div className={`p-6 md:p-8 rounded-[2.5rem] border ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
              {totalValue <= 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-500 text-sm font-bold">Nenhum ativo cadastrado para exibir.</p>
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row gap-8 items-center">
                  {/* Donut Chart */}
                  <div className="relative w-full lg:w-[340px] flex-shrink-0">
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={chartItems}
                          cx="50%"
                          cy="50%"
                          innerRadius={75}
                          outerRadius={120}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                          animationDuration={600}
                        >
                          {chartItems.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} className="transition-all hover:opacity-80" />
                          ))}
                        </Pie>
                        <ReTooltip content={<CustomPieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Total</p>
                      <p className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>R$ {fmt(totalValue)}</p>
                    </div>
                  </div>

                  {/* Breakdown List */}
                  <div className="flex-1 w-full">
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {chartItems.map((item, idx) => {
                        const pct = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                        return (
                          <div key={idx} className={`flex items-center gap-3 p-3 rounded-2xl transition-all hover:scale-[1.01] ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: item.color }} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.name}</p>
                              <p className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>R$ {fmt(item.value)}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-black" style={{ color: item.color }}>{pct.toFixed(1)}%</p>
                            </div>
                            {/* Mini bar */}
                            <div className={`w-20 h-1.5 rounded-full overflow-hidden flex-shrink-0 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: item.color }} />
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
        );
      })()}

      {/* ── METAS E PERFIL ── */}
      {(() => {
        const onboarding = userPrefs?.onboarding || {};
        const OBJECTIVE_LABELS = {
          independence: '🏝️ Viver de Renda',
          start: '🌱 Começar a Investir',
          debt: '🔓 Sair das Dívidas',
          goal: '🏠 Conquistar um Bem',
          control: '🧘 Controle Total',
        };
        const PROFILE_LABELS = {
          conservative: 'Conservador',
          moderate: 'Moderado',
          aggressive: 'Arrojado',
        };
        const hasData = onboarding.objectives?.length > 0 || onboarding.riskProfile;
        if (!hasData) return null;
        return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${sub}`}>Seu Plano de Construção</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`p-6 rounded-3xl border flex flex-col justify-center ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100 shadow-sm'}`}>
            <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Objetivos</h3>
            <div className="flex flex-wrap gap-2">
               {onboarding.objectives?.map(obj => (
                  <span key={obj} className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold">{OBJECTIVE_LABELS[obj] || obj}</span>
               ))}
               {(!onboarding.objectives || onboarding.objectives.length === 0) && <span className="text-xs text-slate-500">Nenhuma meta definida.</span>}
            </div>
          </div>
          <div className={`p-6 rounded-3xl border flex flex-col justify-center ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100 shadow-sm'}`}>
            <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Perfil de Investidor</h3>
            <p className={`text-3xl font-black capitalize tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {PROFILE_LABELS[onboarding.riskProfile] || onboarding.riskProfile || 'Não definido'}
            </p>
          </div>
        </div>
      </div>
        );
      })()}

      {/* ── ALÍVIA ANALYSIS ── */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <div className={`p-6 md:p-8 rounded-[2rem] border relative overflow-hidden ${
              isDark ? 'bg-slate-900 border-emerald-500/20' : 'bg-[#f0fdfa] border-emerald-500/20 shadow-sm'
          }`}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center gap-3 mb-6">
                  <div className={`p-3 rounded-2xl ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'} shadow-inner`}>
                      <Bot className={`w-6 h-6 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  </div>
                  <div>
                      <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Saúde do seu Patrimônio</h3>
                      <p className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Análise com Alívia AI</p>
                  </div>
              </div>

              {!aiAnalysis && !isAnalyzing && (
                  <button 
                      onClick={handleAnalyze}
                      className={`w-full md:w-auto px-6 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
                          isDark 
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20' 
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                      }`}
                  >
                      <Sparkles className="w-4 h-4" />
                      Gerar Análise Personalizada
                  </button>
              )}

              {isAnalyzing && (
                  <div className="flex items-center gap-3 text-emerald-500 font-bold p-4">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="animate-pulse">Alívia está analisando seus dados...</span>
                  </div>
              )}

              {aiAnalysis && !isAnalyzing && (
                  <div className={`mt-4 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      <ReactMarkdown
                          components={{
                              p: ({ ...props }) => <p className="mb-4 last:mb-0" {...props} />,
                              strong: ({ ...props }) => <strong className={`font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} {...props} />
                          }}
                      >
                          {aiAnalysis}
                      </ReactMarkdown>
                      
                      <button 
                          onClick={handleAnalyze}
                          className={`mt-6 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                              isDark ? 'bg-white/5 hover:bg-white/10 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                          }`}
                      >
                          Atualizar Análise
                      </button>
                  </div>
              )}
          </div>
      </div>
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
      
    </div>
  );
}
