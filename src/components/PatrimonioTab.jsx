import { useState, useMemo, useEffect } from 'react';
import { Wallet, PiggyBank, TrendingUp, ArrowUpCircle, ArrowDownCircle, Eye, EyeOff, BarChart3 } from 'lucide-react';
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
  const [isCumulativeView, setIsCumulativeView] = useState(() => localStorage.getItem('isCumulativeView') === 'true');
  const [hideBalance, setHideBalance] = useState(() => localStorage.getItem('hideBalance') === 'true');
  const [hidePatrimonio, setHidePatrimonio] = useState(() => localStorage.getItem('hidePatrimonio') === 'true');

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
    fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json')
      .then(r => r.json())
      .then(d => setCdiAnual(parseFloat(d[0].valor) * 365))
      .catch(() => {});
  }, []);

  // ── calculations ───────────────────────────────────────────────────────────
  const selectedMonth = new Date().toLocaleDateString('en-CA').slice(0, 7);

  const getRobustMonth = (t) => {
    try { const d = new Date(t.date); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
    catch { return t.month || ''; }
  };

  const filteredTransactions = useMemo(() =>
    transactions.filter(t => getRobustMonth(t) === selectedMonth),
    [transactions, selectedMonth]
  );

  // Resultado operacional do mes (exclui vault/investimentos - e o "livre" do mes)
  const operationalIncome = useMemo(() =>
    filteredTransactions
      .filter(t => t.type === 'income' && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category))
      .reduce((a, t) => a + (parseFloat(t.amount) || 0), 0),
    [filteredTransactions]
  );

  const operationalExpense = useMemo(() =>
    filteredTransactions
      .filter(t => t.type === 'expense' && !['investment', 'vault'].includes(t.category))
      .reduce((a, t) => a + (parseFloat(t.amount) || 0), 0),
    [filteredTransactions]
  );

  const operationalBalance = operationalIncome - operationalExpense; // ex: R$ 2.805

  const calculateCumulative = (targetMonth) => {
    const allPrev = transactions
      .filter(t => getRobustMonth(t) <= targetMonth)
      .sort((a, b) => {
        const diff = new Date(a.date) - new Date(b.date);
        if (diff !== 0) return diff;
        const aR = ['initial_balance', 'carryover'].includes(a.category);
        const bR = ['initial_balance', 'carryover'].includes(b.category);
        return aR && !bR ? -1 : !aR && bR ? 1 : 0;
      });
    if (!allPrev.length) return 0;
    let start = 0;
    for (let i = allPrev.length - 1; i >= 0; i--) {
      if (['initial_balance', 'carryover'].includes(allPrev[i].category)) { start = i; break; }
    }
    return allPrev.slice(start).reduce((a, t) => t.type === 'income' ? a + (parseFloat(t.amount) || 0) : a - (parseFloat(t.amount) || 0), 0);
  };

  const cumulativeBalance = useMemo(() => calculateCumulative(selectedMonth), [transactions]);
  const prevMonth = (() => { const d = new Date(selectedMonth + '-02'); d.setMonth(d.getMonth() - 1); return d.toLocaleDateString('en-CA').slice(0, 7); })();
  const prevBalance = useMemo(() => calculateCumulative(prevMonth), [transactions]);

  // walletBalance é só informacional (card), NÃO entra no patrimonioTotal
  const walletBalance = isCumulativeView ? cumulativeBalance : operationalBalance;

  // Jars
  const jarsTotal = useMemo(() => jars.reduce((a, j) => a + (j.balance || 0), 0), [jars]);
  const jarsDailyYield = useMemo(() =>
    jars.reduce((a, j) => {
      const rate = Math.pow(1 + (cdiAnual / 100) * (j.cdiPercent / 100), 1 / 365) - 1;
      return a + (j.balance || 0) * rate;
    }, 0),
    [jars, cdiAnual]
  );

  // Investments — only from Firestore collection (matches InvestmentsTab)
  const investmentsTotal = useMemo(() => {
    return investments.reduce((acc, a) => {
      const price = a.manualCurrentPrice || a.purchasePrice;
      return acc + (a.quantity * price);
    }, 0);
  }, [investments]);

  // Patrimônio = apenas ativos acumulados (cofrinhos + investimentos)
  // O saldo operacional do mês NÃO entra aqui para evitar dupla contagem
  const patrimonioTotal = jarsTotal + investmentsTotal;
  const totalDailyYield = jarsDailyYield;

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
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Cofrinhos</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />Investimentos</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 3 pillar cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Saldo Carteira */}
        <div className="relative">
          <MiniCard
            label={isCumulativeView ? 'Saldo em Carteira' : 'Saldo do Mês (Real)'}
            value={walletBalance}
            icon={Wallet}
            color={walletBalance >= 0 ? 'text-blue-400' : 'text-rose-400'}
            isDark={isDark}
            highlight
            isHidable
            isHidden={hideBalance}
            onToggle={() => { const v = !hideBalance; setHideBalance(v); localStorage.setItem('hideBalance', String(v)); }}
            detail={isCumulativeView ? 'Saldo acumulado na conta' : 'Resultado operacional deste mês (sem cofrinhos/invest.)'}
          />
          <button onClick={() => { const v = !isCumulativeView; setIsCumulativeView(v); localStorage.setItem('isCumulativeView', String(v)); }}
            className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold border z-20 shadow-xl transition-all ${
              isCumulativeView ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}>
            {isCumulativeView ? 'Ver Mensal' : 'Ver Acumulado'}
          </button>
        </div>

        {/* Cofrinhos */}
        <MiniCard
          label="Cofrinhos"
          value={jarsTotal}
          icon={PiggyBank}
          color="text-emerald-400"
          isDark={isDark}
          detail={jars.length > 0 ? `${jars.length} cofrinho${jars.length > 1 ? 's' : ''} • +R$ ${fmt(jarsDailyYield)}/dia` : 'Crie cofrinhos na aba Investimentos'}
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
          detail="Tesouro, Cripto, CDB e mais"
        />
      </div>

      {/* spacer for floating button */}
      <div className="h-2" />

      {/* ── 4 operational cards ── */}
      <div>
        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${sub}`}>Fluxo Operacional — {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MiniCard label="Ganhos (Mês)" value={operationalIncome} icon={ArrowUpCircle} color="text-emerald-400" isDark={isDark} />
          <MiniCard label="Gastos (Mês)" value={operationalExpense} icon={ArrowDownCircle} color="text-rose-400" isDark={isDark} />
          <div className={`col-span-2 p-5 rounded-3xl border flex items-center justify-between ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100 shadow-sm'}`}>
            <div>
              <p className={`text-xs font-medium ${sub}`}>Resultado do Mês</p>
              <p className={`text-2xl font-bold mt-1 ${(operationalIncome - operationalExpense) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {fmtSigned(operationalIncome - operationalExpense)}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Sem cofrinhos/investimentos</p>
            </div>
            <BarChart3 className={`w-10 h-10 ${(operationalIncome - operationalExpense) >= 0 ? 'text-emerald-500/30' : 'text-rose-500/30'}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
