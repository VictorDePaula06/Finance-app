import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChevronLeft, ChevronRight, Sparkles, FileDown, Receipt, Shield, Flame, Wallet, CreditCard, Banknote, QrCode, FileText } from 'lucide-react';
import { CATEGORIES } from '../constants/categories';
import { Loader2 } from 'lucide-react';
import aliviaFinal from '../assets/alivia/alivia-final.png';
import { generatePDF } from '../utils/generatePDF';
import logo from '../assets/logo.png';
import { useAuth } from '../contexts/AuthContext';
import UpgradeModal from './UpgradeModal';
import { getExpenseBasis, isMonthlyExpenseTx } from '../utils/financialLogic';
import { Lock } from 'lucide-react';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PALETTE = ['#f43f5e', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ec4899', '#14b8a6', '#eab308', '#64748b'];
const pad = (n) => String(n).padStart(2, '0');
const keyLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const tdate = (t) => (t.date ? t.date.slice(0, 10) : (t.month ? `${t.month}-01` : ''));
const amount = (t) => parseFloat(t.amount) || 0;
const fmtAxis = (v) => {
  const n = Number(v) || 0; const abs = Math.abs(n); const sign = n < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}R$${(abs / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
  return `${sign}R$${Math.round(abs)}`;
};
const fmtDay = (t) => {
  const s = tdate(t); if (!s) return '—';
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const PRIORITY_META = {
  essential: { label: 'Essencial', color: '#10b981', icon: Shield },
  comfort: { label: 'Conforto', color: '#f59e0b', icon: Sparkles },
  superfluous: { label: 'Supérfluo', color: '#f43f5e', icon: Flame },
};
const PRIORITY_ORDER = ['essential', 'comfort', 'superfluous'];

const PAYMENT_META = {
  credito: { label: 'Crédito', color: '#8b5cf6', icon: CreditCard },
  debito: { label: 'Débito', color: '#3b82f6', icon: CreditCard },
  pix: { label: 'Pix', color: '#10b981', icon: QrCode },
  dinheiro: { label: 'Dinheiro', color: '#f59e0b', icon: Banknote },
  boleto: { label: 'Boleto', color: '#64748b', icon: FileText },
  outro: { label: 'Outro', color: '#94a3b8', icon: Wallet },
};
const PAYMENT_ORDER = ['credito', 'debito', 'pix', 'dinheiro', 'boleto', 'outro'];

const PERIOD_MODES = [
  { id: 'dia', label: 'Dia' },
  { id: 'mes', label: 'Mês' },
  { id: 'ano', label: 'Ano' },
  { id: 'custom', label: 'Personalizado' },
];

const effPriority = (t) => t.priority || CATEGORIES.expense.find(c => c.id === t.category)?.defaultPriority || 'comfort';
const payType = (t) => (t.paymentMethod && PAYMENT_META[t.paymentMethod] ? t.paymentMethod : 'outro');

// Intervalo [start, end] para um modo + âncora
function rangeFor(mode, anchor, custom) {
  const d = new Date(anchor);
  if (mode === 'dia') {
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return { start: s, end: s };
  }
  if (mode === 'mes') {
    return { start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 0) };
  }
  if (mode === 'trimestre') {
    const q = Math.floor(d.getMonth() / 3);
    return { start: new Date(d.getFullYear(), q * 3, 1), end: new Date(d.getFullYear(), q * 3 + 3, 0) };
  }
  if (mode === 'ano') {
    return { start: new Date(d.getFullYear(), 0, 1), end: new Date(d.getFullYear(), 11, 31) };
  }
  // custom
  const s = custom.start ? new Date(custom.start + 'T00:00:00') : new Date(d.getFullYear(), d.getMonth(), 1);
  const e = custom.end ? new Date(custom.end + 'T00:00:00') : new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: s, end: e > s ? e : s };
}

// Intervalo do período anterior, mesma duração/granularidade
function prevRangeFor(mode, anchor, custom) {
  const d = new Date(anchor);
  if (mode === 'dia') { const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1); return { start: s, end: s }; }
  if (mode === 'mes') return { start: new Date(d.getFullYear(), d.getMonth() - 1, 1), end: new Date(d.getFullYear(), d.getMonth(), 0) };
  if (mode === 'trimestre') { const q = Math.floor(d.getMonth() / 3); return { start: new Date(d.getFullYear(), q * 3 - 3, 1), end: new Date(d.getFullYear(), q * 3, 0) }; }
  if (mode === 'ano') return { start: new Date(d.getFullYear() - 1, 0, 1), end: new Date(d.getFullYear() - 1, 11, 31) };
  const cur = rangeFor('custom', anchor, custom);
  const len = Math.round((cur.end - cur.start) / 86400000) + 1;
  const end = new Date(cur.start.getFullYear(), cur.start.getMonth(), cur.start.getDate() - 1);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (len - 1));
  return { start, end };
}

function shiftAnchor(mode, anchor, dir, custom) {
  const d = new Date(anchor);
  if (mode === 'dia') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir);
  if (mode === 'mes') return new Date(d.getFullYear(), d.getMonth() + dir, 1);
  if (mode === 'trimestre') return new Date(d.getFullYear(), d.getMonth() + dir * 3, 1);
  if (mode === 'ano') return new Date(d.getFullYear() + dir, d.getMonth(), 1);
  const cur = rangeFor('custom', anchor, custom);
  const len = Math.round((cur.end - cur.start) / 86400000) + 1;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir * len);
}

function labelFor(mode, range) {
  const { start, end } = range;
  if (mode === 'dia') return start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  if (mode === 'mes') return start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  if (mode === 'trimestre') return `${Math.floor(start.getMonth() / 3) + 1}º Trim · ${start.getFullYear()}`;
  if (mode === 'ano') return String(start.getFullYear());
  return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} – ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}`;
}

export default function PeriodAnalysis({ transactions = [], cards = [], subscriptions = [], manualConfig = {}, theme }) {
  const isDark = theme !== 'light';
  const { planLevel, isAdmin } = useAuth();
  // Relatórios em PDF são a partir do plano Standard (Free não exporta).
  const canExportPDF = planLevel === 'standard' || planLevel === 'premium' || planLevel === 'lifetime' || isAdmin;
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [mode, setMode] = useState('mes');
  const [anchor, setAnchor] = useState(() => new Date());
  const [custom, setCustom] = useState({ start: '', end: '' });
  const [selPriorities, setSelPriorities] = useState([]); // vazio = todas
  const [selPayments, setSelPayments] = useState([]);      // vazio = todos
  const [chartMode, setChartMode] = useState('acumulado'); // 'diario' | 'acumulado'
  const [creditMode, setCreditMode] = useState('fatura');  // 'fatura' (atual) | 'mes' — só quando filtra crédito
  const [showAll, setShowAll] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const range = useMemo(() => rangeFor(mode, anchor, custom), [mode, anchor, custom]);
  const prevRange = useMemo(() => prevRangeFor(mode, anchor, custom), [mode, anchor, custom]);
  const rangeLabel = useMemo(() => labelFor(mode, range), [mode, range]);

  const goPrev = () => setAnchor(a => shiftAnchor(mode, a, -1, custom));
  const goNext = () => setAnchor(a => shiftAnchor(mode, a, +1, custom));

  // Base: TODOS os lançamentos de gasto reais (inclui crédito), excluindo
  // investimentos, cofre e o pagamento de fatura (evita dupla contagem com a compra no crédito).
  const inR = (t, s, e) => { const td = tdate(t); return td && td >= s && td <= e; };
  const startStr = keyLocal(range.start), endStr = keyLocal(range.end);
  const prevStartStr = keyLocal(prevRange.start), prevEndStr = keyLocal(prevRange.end);

  // Despesa conforme o REGIME configurado (competência/caixa) — mesmo critério do
  // saldo e do índice. Competência: inclui crédito (pela data), exclui o pagamento
  // de fatura. Caixa: exclui crédito, inclui o pagamento de fatura.
  const expenseBasis = getExpenseBasis(manualConfig);
  const isExpense = (t) => isMonthlyExpenseTx(t, expenseBasis);
  const isIncome = (t) => t.type === 'income' && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category);

  // Quando o filtro de pagamento "Crédito" está ativo, o usuário escolhe se conta
  // a FATURA ATUAL (mesma da aba Cartões) ou apenas o crédito lançado no período.
  const creditFilterActive = selPayments.includes('credito');

  // Itens da fatura atual (em aberto) — réplica da lógica da aba Cartões:
  // compras no crédito ainda não pagas + assinaturas/parcelas do ciclo aberto.
  const currentInvoiceItems = useMemo(() => {
    const closingOf = (id) => { const c = cards.find(x => x.id === id); if (!c) return 25; return c.closingDay || ((c.dueDay - 7 > 0) ? c.dueDay - 7 : 25); };
    const getInvoiceMonth = (dateStr, closingDay) => {
      const d = new Date(dateStr); if (isNaN(d.getTime())) return '';
      let month = d.getMonth(), year = d.getFullYear();
      if (d.getDate() >= closingDay) { month += 1; if (month > 11) { month = 0; year += 1; } }
      return `${year}-${pad(month + 1)}`;
    };
    const now = new Date();
    const purchases = transactions.filter(t => isExpense(t) && t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid');
    const subs = subscriptions.filter(s => s.cardId).map(s => {
      const closing = closingOf(s.cardId);
      const currInv = getInvoiceMonth(now.toISOString(), closing);
      const subDay = parseInt(s.day) || 1;
      const chargeDate = new Date(now.getFullYear(), now.getMonth(), subDay, 12, 0, 0);
      const chargeInv = getInvoiceMonth(chargeDate.toISOString(), closing);
      const isOpen = s.lastPaidMonth !== currInv && chargeInv <= currInv;
      if (!isOpen) return null;
      return {
        id: `sub-${s.id}`,
        description: `${s.name} ${s.type === 'installment' ? '(parcela)' : '(assinatura)'}`,
        category: s.category || (s.type === 'installment' ? 'shopping' : 'subscriptions'),
        amount: parseFloat(s.value) || 0,
        date: keyLocal(chargeDate),
        paymentMethod: 'credito',
        priority: s.priority,
      };
    }).filter(Boolean);
    return [...purchases, ...subs];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, subscriptions, cards]);

  const periodExpenses = useMemo(() => {
    const nonCredit = transactions.filter(t => isExpense(t) && t.paymentMethod !== 'credito' && inR(t, startStr, endStr));
    const credit = (creditFilterActive && creditMode === 'fatura')
      ? currentInvoiceItems
      : transactions.filter(t => isExpense(t) && t.paymentMethod === 'credito' && inR(t, startStr, endStr));
    return [...nonCredit, ...credit];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, startStr, endStr, creditFilterActive, creditMode, currentInvoiceItems]);
  const periodIncomeItems = useMemo(() => transactions.filter(t => isIncome(t) && inR(t, startStr, endStr)), [transactions, startStr, endStr]);

  // Formas de pagamento que realmente aparecem no período (para montar os chips)
  const availablePayments = useMemo(() => {
    const set = new Set(periodExpenses.map(payType));
    return PAYMENT_ORDER.filter(p => set.has(p));
  }, [periodExpenses]);

  // Aplica filtros de prioridade e pagamento (multi-seleção; vazio = todos)
  const filteredItems = useMemo(() => periodExpenses.filter(t => {
    if (selPriorities.length && !selPriorities.includes(effPriority(t))) return false;
    if (selPayments.length && !selPayments.includes(payType(t))) return false;
    return true;
  }), [periodExpenses, selPriorities, selPayments]);

  const income = useMemo(() => periodIncomeItems.reduce((a, t) => a + amount(t), 0), [periodIncomeItems]);
  const totalExpense = useMemo(() => filteredItems.reduce((a, t) => a + amount(t), 0), [filteredItems]);
  const balance = income - totalExpense;
  const txCount = filteredItems.length;

  // Período anterior (mesmos filtros) para comparativo
  const prev = useMemo(() => {
    const exp = transactions.filter(t => isExpense(t) && inR(t, prevStartStr, prevEndStr)
      && (!selPriorities.length || selPriorities.includes(effPriority(t)))
      && (!selPayments.length || selPayments.includes(payType(t))));
    const inc = transactions.filter(t => isIncome(t) && inR(t, prevStartStr, prevEndStr));
    const expense = exp.reduce((a, t) => a + amount(t), 0);
    const incomeV = inc.reduce((a, t) => a + amount(t), 0);
    return { income: incomeV, expense, balance: incomeV - expense, count: exp.length };
  }, [transactions, prevStartStr, prevEndStr, selPriorities, selPayments]);

  const byCategory = useMemo(() => {
    const map = {};
    filteredItems.forEach(t => { const c = t.category || 'other'; map[c] = (map[c] || 0) + amount(t); });
    return Object.entries(map).sort(([, a], [, b]) => b - a).map(([id, value], i) => ({
      id, value, label: CATEGORIES.expense.find(c => c.id === id)?.label || 'Outro', color: PALETTE[i % PALETTE.length],
    }));
  }, [filteredItems]);

  const byPayment = useMemo(() => {
    const map = {}, count = {};
    filteredItems.forEach(t => { const p = payType(t); map[p] = (map[p] || 0) + amount(t); count[p] = (count[p] || 0) + 1; });
    return PAYMENT_ORDER.filter(p => map[p]).map(p => ({ id: p, value: map[p], count: count[p], ...PAYMENT_META[p] }));
  }, [filteredItems]);

  const byPriority = useMemo(() => {
    const map = {};
    filteredItems.forEach(t => { const p = effPriority(t); map[p] = (map[p] || 0) + amount(t); });
    return PRIORITY_ORDER.map(p => ({ id: p, value: map[p] || 0, ...PRIORITY_META[p] }));
  }, [filteredItems]);

  const sortedExpenses = useMemo(() => [...filteredItems].sort((a, b) => amount(b) - amount(a)), [filteredItems]);
  const topExpenses = showAll ? sortedExpenses : sortedExpenses.slice(0, 6);

  // Série temporal da evolução (barras)
  const series = useMemo(() => {
    const span = Math.round((range.end - range.start) / 86400000) + 1;
    const daily = span <= 45;
    const buckets = [];
    if (daily) {
      const cur = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
      while (cur <= range.end) { buckets.push({ key: keyLocal(cur), label: pad(cur.getDate()), gastos: 0, ganhos: 0 }); cur.setDate(cur.getDate() + 1); }
    } else {
      let cur = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
      while (cur <= range.end) { buckets.push({ key: `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}`, label: cur.toLocaleDateString('pt-BR', { month: 'short' }), gastos: 0, ganhos: 0 }); cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); }
    }
    const idx = {}; buckets.forEach((b, i) => { idx[b.key] = i; });
    const keyOf = (t) => { const td = tdate(t); return daily ? td : td.slice(0, 7); };
    filteredItems.forEach(t => { const i = idx[keyOf(t)]; if (i != null) buckets[i].gastos += amount(t); });
    periodIncomeItems.forEach(t => { const i = idx[keyOf(t)]; if (i != null) buckets[i].ganhos += amount(t); });
    if (chartMode === 'acumulado') {
      let ag = 0, ai = 0;
      buckets.forEach(b => { ag += b.gastos; ai += b.ganhos; b.gastos = ag; b.ganhos = ai; });
    }
    buckets.forEach(b => { b.resultado = b.ganhos - b.gastos; });
    return buckets;
  }, [filteredItems, periodIncomeItems, range, chartMode]);

  const hasFilters = selPriorities.length > 0 || selPayments.length > 0;
  const clearFilters = () => { setSelPriorities([]); setSelPayments([]); };
  const togglePriority = (id) => setSelPriorities(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const togglePayment = (id) => setSelPayments(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleExportPDF = async () => {
    if (!canExportPDF) { setShowUpgrade(true); return; }
    setIsExportingPDF(true);
    try {
      const incomeRows = periodIncomeItems.map(t => ({ date: t.date, description: t.description, category: t.category, amount: amount(t), type: 'income' }));
      const expenseRows = filteredItems.map(t => ({ date: t.date, description: t.description, category: t.category, amount: amount(t), type: 'expense' }));
      await generatePDF({ monthKey: keyLocal(range.start).slice(0, 7), monthLabel: rangeLabel, income, expense: totalExpense, balance, byCategory, rows: [...incomeRows, ...expenseRows] }, logo);
    } catch (e) { console.error(e); alert('Erro ao gerar PDF.'); }
    finally { setIsExportingPDF(false); }
  };

  const card = isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';
  const txt = isDark ? 'text-white' : 'text-slate-800';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';
  const inset = isDark ? 'bg-[#161b27] border-white/10' : 'bg-slate-50 border-slate-200';
  const fieldBg = isDark ? 'bg-[#161b27] border-white/10' : 'bg-white border-slate-200';

  const Chip = ({ active, onClick, hex, icon: Icon, children }) => (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${active ? 'text-white' : (isDark ? 'text-slate-400 border-white/10 hover:bg-white/5' : 'text-slate-500 border-slate-200 hover:bg-slate-50')}`}
      style={active ? { background: hex, borderColor: hex } : undefined}>
      {Icon ? <Icon className="w-3 h-3" style={!active ? { color: hex } : undefined} /> : (hex && !active && <span className="w-2 h-2 rounded-full" style={{ background: hex }} />)}
      {children}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className={`text-2xl font-black tracking-tight ${txt}`}>Gastos por Período</h1>
          <p className={`text-sm mt-0.5 ${sub}`}>Analise para onde foi o seu dinheiro em cada período</p>
        </div>
        <button onClick={handleExportPDF} disabled={isExportingPDF}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${canExportPDF ? (isDark ? 'border border-white/10 text-slate-300 hover:bg-white/5' : 'border border-slate-200 text-slate-600 hover:bg-slate-50') : 'bg-blue-500 text-white hover:bg-blue-600'} disabled:opacity-50`}>
          {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : (canExportPDF ? <FileDown className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />)} {canExportPDF ? 'Exportar PDF' : 'Exportar PDF · Standard'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard isDark={isDark} accent="#34d399" label="Ganhos" value={`R$ ${fmt(income)}`} delta={pctDelta(income, prev.income)} />
        <KpiCard isDark={isDark} accent="#f43f5e" label="Gastos" value={`R$ ${fmt(totalExpense)}`} delta={pctDelta(totalExpense, prev.expense)} invert />
        <KpiCard isDark={isDark} accent={balance >= 0 ? '#34d399' : '#f43f5e'} label="Resultado" value={`R$ ${fmt(balance)}`} delta={pctDelta(balance, prev.balance)} />
        <KpiCard isDark={isDark} accent="#f59e0b" label="Transações" value={String(txCount)} delta={pctDelta(txCount, prev.count)} />
      </div>

      {/* Barra de filtros (mesmo padrão de Metas de Gasto) */}
      <div className={`rounded-2xl border p-3 flex flex-wrap items-center gap-x-5 gap-y-2.5 ${card}`}>
        {/* Período */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Período</span>
          <div className={`flex items-center rounded-lg border ${fieldBg}`}>
            <button onClick={goPrev} className="p-1.5 text-slate-400 hover:text-emerald-400"><ChevronLeft className="w-4 h-4" /></button>
            <span className={`text-[11px] font-bold capitalize px-1 min-w-[96px] text-center ${txt}`}>{rangeLabel}</span>
            <button onClick={goNext} className="p-1.5 text-slate-400 hover:text-emerald-400"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-1">
            {PERIOD_MODES.map(m => {
              const active = mode === m.id;
              return (
                <button key={m.id} onClick={() => setMode(m.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${active ? 'bg-rose-500 text-white' : (isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}`}>
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Prioridade */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Prioridade</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {PRIORITY_ORDER.map(id => {
              const meta = PRIORITY_META[id];
              return <Chip key={id} active={selPriorities.includes(id)} onClick={() => togglePriority(id)} hex={meta.color} icon={meta.icon}>{meta.label}</Chip>;
            })}
          </div>
        </div>

        {/* Pagamento */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pagamento</span>
          {availablePayments.length === 0 ? (
            <span className={`text-[10px] ${sub}`}>—</span>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              {availablePayments.map(id => {
                const meta = PAYMENT_META[id];
                return <Chip key={id} active={selPayments.includes(id)} onClick={() => togglePayment(id)} hex={meta.color} icon={meta.icon}>{meta.label}</Chip>;
              })}
            </div>
          )}
        </div>

        <button onClick={clearFilters} disabled={!hasFilters} className={`ml-auto text-[11px] font-bold transition-colors ${hasFilters ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-600 cursor-default'}`}>Limpar</button>
      </div>

      {/* Datas personalizadas */}
      {mode === 'custom' && (
        <div className={`rounded-2xl border p-3 flex flex-wrap items-center gap-3 ${card}`}>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Intervalo</span>
          <input type="date" value={custom.start} onChange={e => setCustom(c => ({ ...c, start: e.target.value }))} className={`px-2.5 py-1.5 rounded-lg border text-[11px] ${fieldBg} ${txt}`} />
          <span className="text-slate-400 text-xs">até</span>
          <input type="date" value={custom.end} onChange={e => setCustom(c => ({ ...c, end: e.target.value }))} className={`px-2.5 py-1.5 rounded-lg border text-[11px] ${fieldBg} ${txt}`} />
        </div>
      )}

      {/* Crédito: fatura atual x período (aparece ao filtrar Crédito) */}
      {creditFilterActive && (
        <div className={`rounded-2xl border p-3 flex flex-wrap items-center gap-3 ${isDark ? 'border-violet-500/30 bg-violet-500/[0.05]' : 'border-violet-200 bg-violet-50'}`}>
          <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-violet-300' : 'text-violet-600'}`}><CreditCard className="w-3.5 h-3.5" /> Crédito — o que contar?</span>
          <div className="flex items-center gap-1.5">
            {[['fatura', 'Fatura atual'], ['mes', 'Período selecionado']].map(([id, lbl]) => {
              const active = creditMode === id;
              return (
                <button key={id} onClick={() => setCreditMode(id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${active ? 'bg-violet-500 text-white' : (isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200')}`}>
                  {lbl}
                </button>
              );
            })}
          </div>
          <p className={`text-[10px] leading-snug ${sub}`}>
            {creditMode === 'fatura' ? 'Mostra a fatura em aberto (mesma da aba Cartões), independente do período.' : 'Mostra apenas o crédito lançado dentro do período selecionado.'}
          </p>
        </div>
      )}

        {totalExpense === 0 && income === 0 ? (
          <div className={`p-12 rounded-2xl border text-center ${card}`}>
            <Receipt className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className={`font-bold ${txt}`}>Nenhum lançamento neste período</p>
            <p className={`text-sm ${sub}`}>Ajuste o período ou os filtros ao lado.</p>
          </div>
        ) : (
          <>
            {/* Evolução + painéis laterais */}
            <div className="grid grid-cols-1 xl:grid-cols-[1.55fr_1fr] gap-5">
              <div className={`p-5 rounded-2xl border flex flex-col ${card}`}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className={`text-sm font-bold uppercase tracking-wider ${txt}`}>Evolução no período</h4>
                  <div className={`flex rounded-lg p-0.5 ${inset}`}>
                    {[['diario', 'Diário'], ['acumulado', 'Acumulado']].map(([id, lbl]) => (
                      <button key={id} onClick={() => setChartMode(id)}
                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all ${chartMode === id ? 'bg-blue-500 text-white' : 'text-slate-400'}`}>{lbl}</button>
                    ))}
                  </div>
                </div>
                <div className="w-full flex-1 min-h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#ffffff0d' : '#0000000d'} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: isDark ? '#64748b' : '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
                      <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 9, fill: isDark ? '#64748b' : '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
                      <Tooltip cursor={{ stroke: isDark ? '#334155' : '#cbd5e1', strokeWidth: 1 }} formatter={(v, n) => [`R$ ${fmt(v)}`, n === 'gastos' ? 'Gastos' : n === 'ganhos' ? 'Ganhos' : 'Resultado líquido']} contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', borderColor: isDark ? '#1e293b' : '#e2e8f0', borderRadius: '12px', fontSize: 12 }} labelStyle={{ color: isDark ? '#e2e8f0' : '#0f172a' }} />
                      <Line type="monotone" dataKey="ganhos" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="gastos" stroke="#f43f5e" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="resultado" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 2.5, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-between gap-3 mt-3 pl-1 flex-wrap">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400"><span className="w-3 h-1 rounded-full bg-emerald-500" /> Ganhos</span>
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400"><span className="w-3 h-1 rounded-full bg-rose-500" /> Gastos</span>
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400"><span className="w-2 h-2 rounded-full bg-blue-500" /> Resultado líquido</span>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black tabular-nums ${balance >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {balance >= 0 ? '↑' : '↓'} R$ {fmt(Math.abs(balance))} de saldo
                  </span>
                </div>
              </div>

              <div className="space-y-5">
                {/* Por categoria */}
                <div className={`p-5 rounded-2xl border ${card}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className={`text-sm font-bold uppercase tracking-wider ${txt}`}>Por categoria</h4>
                    <span className={`text-[10px] font-bold ${sub}`}>R$ {fmt(totalExpense)} total</span>
                  </div>
                  {byCategory.length === 0 ? <p className={`text-[11px] ${sub}`}>Sem gastos.</p> : (
                    <div className="space-y-2.5 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                      {byCategory.map(c => {
                        const pct = totalExpense > 0 ? (c.value / totalExpense) * 100 : 0;
                        return (
                          <div key={c.id}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="flex items-center gap-2 text-xs font-bold"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} /><span className={txt}>{c.label}</span></span>
                              <span className={`text-xs font-bold ${txt}`}>R$ {fmt(c.value)} <span className="text-slate-400 font-medium">({pct.toFixed(0)}%)</span></span>
                            </div>
                            <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Por forma de pagamento */}
                <div className={`p-5 rounded-2xl border ${card}`}>
                  <h4 className={`text-sm font-bold uppercase tracking-wider mb-3 ${txt}`}>Por forma de pagamento</h4>
                  {byPayment.length === 0 ? <p className={`text-[11px] ${sub}`}>Sem gastos.</p> : (
                    <div className="space-y-3">
                      {byPayment.map(p => {
                        const Icon = p.icon; const pct = totalExpense > 0 ? (p.value / totalExpense) * 100 : 0;
                        return (
                          <div key={p.id} className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${p.color}1f` }}><Icon className="w-4 h-4" style={{ color: p.color }} /></span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-bold ${txt}`}>{p.label}</span>
                                <span className={`text-xs font-black ${txt}`}>R$ {fmt(p.value)}</span>
                              </div>
                              <div className="flex items-center justify-between mt-0.5">
                                <span className="text-[10px] text-slate-400">{p.count} {p.count === 1 ? 'transação' : 'transações'}</span>
                                <div className={`w-20 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.color }} /></div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Maiores gastos + Distribuição por prioridade */}
            <div className="grid grid-cols-1 xl:grid-cols-[1.55fr_1fr] gap-5 items-start">
              <div className={`p-5 md:p-6 rounded-2xl border ${card}`}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className={`text-sm font-bold uppercase tracking-wider ${txt}`}>Maiores gastos</h4>
                  {sortedExpenses.length > 6 && (
                    <button onClick={() => setShowAll(s => !s)} className="text-[10px] font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300">{showAll ? 'Ver menos' : 'Ver todos →'}</button>
                  )}
                </div>
                {topExpenses.length === 0 ? <p className={`text-[11px] ${sub}`}>Sem gastos no período.</p> : (
                  <div className="space-y-1 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                    {topExpenses.map(t => {
                      const cat = CATEGORIES.expense.find(c => c.id === t.category);
                      const pm = PAYMENT_META[payType(t)]; const pr = PRIORITY_META[effPriority(t)];
                      return (
                        <div key={t.id} className="flex items-center gap-3 py-2.5">
                          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${pm.color}1a` }}>{cat?.icon ? React.createElement(cat.icon, { className: 'w-4 h-4', style: { color: pm.color } }) : <Receipt className="w-4 h-4" style={{ color: pm.color }} />}</span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-[13px] font-bold truncate ${txt}`}>{t.description || 'Sem descrição'}</p>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span className="text-[10px] text-slate-400">{fmtDay(t)} · {cat?.label || 'Outro'}</span>
                              <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md" style={{ background: `${pm.color}1f`, color: pm.color }}>{pm.label}</span>
                              <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md" style={{ background: `${pr.color}1f`, color: pr.color }}>{pr.label}</span>
                            </div>
                          </div>
                          <span className="text-right font-black text-rose-400 tabular-nums text-sm">R$ {fmt(amount(t))}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className={`p-5 md:p-6 rounded-2xl border ${card}`}>
                <h4 className={`text-sm font-bold uppercase tracking-wider mb-5 ${txt}`}>Distribuição por prioridade</h4>
                <div className="space-y-4">
                  {byPriority.map(p => {
                    const Icon = p.icon; const pct = totalExpense > 0 ? (p.value / totalExpense) * 100 : 0;
                    return (
                      <div key={p.id} className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${p.color}1f` }}><Icon className="w-4 h-4" style={{ color: p.color }} /></span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-bold ${txt}`}>{p.label}</span>
                            <span className={`text-xs font-black ${txt}`}>R$ {fmt(p.value)} <span className="text-slate-400 font-medium">{pct.toFixed(0)}%</span></span>
                          </div>
                          <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: p.color }} /></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Insight Alívia */}
            {(() => {
              const superfluous = byPriority.find(p => p.id === 'superfluous')?.value || 0;
              const supPct = totalExpense > 0 ? (superfluous / totalExpense) * 100 : 0;
              let status = 'neutral', msg = '';
              if (income > 0 && totalExpense > income) { status = 'negative'; msg = `Seus gastos (R$ ${fmt(totalExpense)}) superaram as entradas (R$ ${fmt(income)}).`; }
              else if (balance > 0) { status = 'positive'; msg = `Período positivo! Sobrou R$ ${fmt(balance)}.`; }
              else { status = 'warning'; msg = 'Acompanhe seus gastos para fechar o período no azul.'; }
              if (byCategory[0]) msg += ` Maior categoria: ${byCategory[0].label} (R$ ${fmt(byCategory[0].value)}).`;
              if (supPct > 0) msg += ` Supérfluos somaram R$ ${fmt(superfluous)} (${supPct.toFixed(0)}% dos gastos).`;
              const bg = { positive: isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200', negative: isDark ? 'bg-rose-500/10 border-rose-500/20' : 'bg-rose-50 border-rose-200', warning: isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200', neutral: isDark ? 'bg-slate-500/10 border-slate-500/20' : 'bg-slate-50 border-slate-200' }[status];
              const tc = { positive: 'text-emerald-400', negative: 'text-rose-400', warning: 'text-amber-400', neutral: 'text-slate-400' }[status];
              return (
                <div className={`flex items-start gap-3 p-4 rounded-2xl border ${bg}`}>
                  <img src={aliviaFinal} alt="Alívia" className="w-10 h-10 object-cover rounded-full border-2 border-white/20 shadow-md shrink-0" />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${tc}`}>Alívia · Análise do período</span>
                    <span className={`text-[12px] font-medium leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{msg}</span>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
}

function pctDelta(cur, prev) {
  if (prev == null || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function KpiCard({ isDark, accent, label, value, delta, invert }) {
  const card = isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';
  let deltaEl = <span className="text-[11px] text-slate-400 font-medium">—</span>;
  if (delta != null && isFinite(delta) && Math.abs(delta) >= 0.5) {
    const up = delta > 0;
    const good = invert ? !up : up;
    deltaEl = (
      <span className={`text-[11px] font-bold ${good ? 'text-emerald-500' : 'text-rose-500'}`}>
        {up ? '↑' : '↓'} {Math.abs(delta).toFixed(0)}% <span className="text-slate-400 font-medium">vs anterior</span>
      </span>
    );
  }
  return (
    <div className={`relative rounded-2xl border overflow-hidden ${card}`}>
      <div className="h-1 w-full" style={{ background: accent }} />
      <div className="p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-2xl font-black tabular-nums mt-1 truncate" style={{ color: accent }}>{value}</p>
        <div className="mt-0.5">{deltaEl}</div>
      </div>
    </div>
  );
}
