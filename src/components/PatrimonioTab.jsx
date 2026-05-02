import { useState, useMemo, useEffect } from 'react';
import { Wallet, PiggyBank, TrendingUp, ArrowUpCircle, ArrowDownCircle, Eye, EyeOff, BarChart3, Bot, Loader2, Sparkles } from 'lucide-react';
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
  const { currentUser } = useAuth();
  const isDark = theme !== 'light';

  // ── state ──────────────────────────────────────────────────────────────────
  const [jars, setJars] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [cdiAnual, setCdiAnual] = useState(10.65); // fallback %
  const [hidePatrimonio, setHidePatrimonio] = useState(() => localStorage.getItem('hidePatrimonio') === 'true');
  const [usdRate, setUsdRate] = useState(5.0);
  const [userConfig, setUserConfig] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

    // 2. Yield from Fixed Income Investments (Renda Fixa with CDI %)
    const fixedIncomeYield = investments.reduce((a, inv) => {
      if (inv.type === 'renda_fixa' && inv.cdiPercent) {
        const cdiP = parseFloat(String(inv.cdiPercent).replace(',', '.'));
        const rate = Math.pow(1 + (cdiAnual / 100) * (cdiP / 100), 1 / 365) - 1;
        const currentVal = (inv.manualCurrentPrice || inv.purchasePrice) * inv.quantity;
        return a + currentVal * rate;
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

      {/* Header */}
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

      {/* spacer for floating button */}
      <div className="h-2" />

      {/* ── METAS E PERFIL ── */}
      {userConfig && (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${sub}`}>Seu Plano de Construção</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`p-6 rounded-3xl border flex flex-col justify-center ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100 shadow-sm'}`}>
            <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Objetivos</h3>
            <div className="flex flex-wrap gap-2">
               {userConfig.objectives?.map(obj => (
                  <span key={obj} className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold">{obj}</span>
               ))}
               {(!userConfig.objectives || userConfig.objectives.length === 0) && <span className="text-xs text-slate-500">Nenhuma meta definida.</span>}
            </div>
          </div>
          <div className={`p-6 rounded-3xl border flex flex-col justify-center ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100 shadow-sm'}`}>
            <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Perfil de Investidor</h3>
            <p className={`text-3xl font-black capitalize tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {userConfig.riskProfile || 'Não definido'}
            </p>
          </div>
        </div>
      </div>
      )}

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
      
    </div>
  );
}
