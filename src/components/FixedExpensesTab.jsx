import React, { useState, useEffect, useMemo } from 'react';
import {
  Home,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  Calendar,
  DollarSign,
  FileText,
  X,
  Shield,
  Sparkles,
  Flame,
  Repeat,
  HelpCircle,
  Zap,
  Info,
  Download,
  AlertCircle
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import TrialLimitModal from './TrialLimitModal';
import OverdraftWarningModal from './OverdraftWarningModal';
import { CATEGORIES, categoryHex } from '../constants/categories';

export default function FixedExpensesTab({ transactions = [], setActiveTab, walletStats, hideBalance, toggleHideBalance, expenseBasis = 'competencia' }) {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const { currentUser, isTrial, planLevel } = useAuth();

  // Limites aplicados ao trial e ao Plano Gratuito permanente
  const isLimited = isTrial || planLevel === 'free';
  const TRIAL_FIXED_LIMIT = 2;
  const [showTrialModal, setShowTrialModal] = useState(false);

  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);

  // 'isVariable': contas tipo luz/gás/água que mudam de valor todo mês.
  // O 'value' nesse caso é apenas referência (estimativa/média) — o valor real é
  // perguntado no momento do pagamento.
  const [newExpense, setNewExpense] = useState({
    name: '', value: '', day: 1, category: 'housing', priority: 'essential', isVariable: false
  });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [undoConfirm, setUndoConfirm] = useState(null);
  const [payingExpense, setPayingExpense] = useState(null);
  // Valor real do mês (usado quando paying uma conta variável)
  const [actualValue, setActualValue] = useState('');
  // Data do pagamento (editável; padrão = hoje), formato YYYY-MM-DD
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showHelp, setShowHelp] = useState(false);
  // Aviso de endividamento — armazena o pagamento pendente até o usuário confirmar.
  const [overdraftPending, setOverdraftPending] = useState(null);

  // Mês selecionado nas abas (YYYY-MM, local). O status de cada conta é derivado
  // das transações lançadas naquele mês — assim as abas de mês são funcionais.
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'fixed_expenses'), where('userId', '==', currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFixedExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [currentUser]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.name || !newExpense.value) return;
    if (isLimited && fixedExpenses.length >= TRIAL_FIXED_LIMIT) { setShowTrialModal(true); return; }

    await addDoc(collection(db, 'fixed_expenses'), {
      ...newExpense,
      value: parseFloat(newExpense.value),
      category: newExpense.category || 'housing',
      priority: newExpense.priority || 'essential',
      isVariable: !!newExpense.isVariable,
      userId: currentUser.uid,
      createdAt: Date.now()
    });

    setNewExpense({ name: '', value: '', day: 1, category: 'housing', priority: 'essential', isVariable: false });
    setIsAddingExpense(false);
  };

  const handleUpdateExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.name || !editingExpenseId) return;

    await updateDoc(doc(db, 'fixed_expenses', editingExpenseId), {
      name: newExpense.name,
      value: parseFloat(newExpense.value),
      day: parseInt(newExpense.day),
      category: newExpense.category || 'housing',
      priority: newExpense.priority || 'essential',
      isVariable: !!newExpense.isVariable
    });

    setNewExpense({ name: '', value: '', day: 1, category: 'housing', priority: 'essential', isVariable: false });
    setEditingExpenseId(null);
    setIsAddingExpense(false);
  };

  const handleDeleteExpense = async (id) => {
    // Não permite excluir conta que já está paga no mês visualizado — é preciso
    // estornar o pagamento antes.
    const exp = fixedExpenses.find(e => e.id === id);
    if (exp && getPaid(exp)) return;
    await deleteDoc(doc(db, 'fixed_expenses', id));
    setDeleteConfirm(null);
  };

  // Executa o pagamento de fato (chamado depois da checagem de saldo).
  const executePayExpense = async (expense, paidAmount) => {
    try {
      const now = new Date();
      const [y, m, d] = (payDate || now.toISOString().slice(0, 10)).split('-').map(Number);
      const payDateTime = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
      const transactionData = {
        description: expense.name,
        amount: paidAmount,
        type: 'expense',
        category: expense.category || 'housing',
        date: payDateTime.toISOString(),
        userId: currentUser.uid,
        month: payDateTime.toISOString().slice(0, 7),
        createdAt: Date.now(),
        isFixed: true,
        paymentMethod: 'pix',
        priority: expense.priority || 'essential'
      };

      await addDoc(collection(db, 'transactions'), transactionData);

      const lastPaidMonth = payDateTime.toISOString().slice(0, 7);
      const updateData = { lastPaidMonth };
      if (expense.isVariable) {
        updateData.lastPaidValue = paidAmount;
        updateData.lastPaidValueMonth = lastPaidMonth;
      }
      await updateDoc(doc(db, 'fixed_expenses', expense.id), updateData);

      setPayingExpense(null);
      setActualValue('');
      setOverdraftPending(null);
    } catch (err) {
      console.error("Erro ao pagar conta fixa:", err);
    }
  };

  // Wrapper: valida valor + checa se cabe no saldo em carteira.
  const handlePayExpense = async (expense) => {
    const paidAmount = expense.isVariable ? parseFloat(actualValue) : parseFloat(expense.value);

    if (!isFinite(paidAmount) || paidAmount <= 0) {
      alert('Informe um valor válido para o pagamento.');
      return;
    }

    const currentBalance = Number(walletStats?.balance) || 0;
    if (paidAmount > currentBalance) {
      setOverdraftPending({ expense, amount: paidAmount });
      return;
    }

    await executePayExpense(expense, paidAmount);
  };

  const handleUndoPayment = async (expense) => {
    try {
      const qT = query(
        collection(db, 'transactions'),
        where('userId', '==', currentUser.uid),
        where('description', '==', expense.name),
        where('isFixed', '==', true),
        where('month', '==', selectedMonth)
      );
      const snap = await getDocs(qT);
      const deletePromises = snap.docs.map(d => deleteDoc(doc(db, 'transactions', d.id)));
      await Promise.all(deletePromises);

      if (expense.lastPaidMonth === selectedMonth) {
        await updateDoc(doc(db, 'fixed_expenses', expense.id), { lastPaidMonth: null });
      }
    } catch (err) {
      console.error("Erro ao estornar:", err);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  const fmt = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const catLabel = (id) => CATEGORIES.expense.find(c => c.id === id)?.label || 'Outro';
  const fmtDay = (iso) => {
    const d = new Date(iso);
    const mm = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    return `${String(d.getDate()).padStart(2, '0')}/${mm}`;
  };

  // ── Índice de pagamentos do mês selecionado (derivado das transações) ──
  // Uma conta é considerada paga no mês se existe uma transação isFixed com o mesmo
  // nome lançada naquele mês. Mantém o último lançamento (por createdAt).
  const paidIndex = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      if (!t.isFixed) return;
      const m = t.month || (t.date ? t.date.slice(0, 7) : '');
      if (m !== selectedMonth) return;
      const key = (t.description || '').trim().toLowerCase();
      if (!key) return;
      if (!map[key] || (t.createdAt || 0) > (map[key].createdAt || 0)) {
        map[key] = { amount: parseFloat(t.amount) || 0, date: t.date, createdAt: t.createdAt || 0 };
      }
    });
    return map;
  }, [transactions, selectedMonth]);

  const getPaid = (exp) => paidIndex[(exp.name || '').trim().toLowerCase()] || null;

  // Abas de mês: 3 meses anteriores + atual + 1 futuro (chaves locais, sem UTC).
  const monthTabs = useMemo(() => {
    const arr = [];
    for (let off = -3; off <= 1; off++) {
      const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      let label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      label = label.charAt(0).toUpperCase() + label.slice(1);
      arr.push({ key, label });
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isCurrentMonth = selectedMonth === currentMonthStr;
  const todayDay = now.getDate();

  // Urgência da conta no mês visualizado (só faz sentido no mês corrente).
  const urgencyOf = (exp, paid) => {
    if (paid) return 'paid';
    if (!isCurrentMonth) return 'pending';
    const day = exp.day || 1;
    if (day < todayDay) return 'overdue';
    if (day === todayDay) return 'today';
    if (day - todayDay <= 5) return 'soon';
    return 'pending';
  };

  const fixedList = fixedExpenses.filter(e => !e.isVariable);
  const variableList = fixedExpenses.filter(e => e.isVariable);

  // ── KPIs do topo ──
  const stats = useMemo(() => {
    let total = 0, paidSum = 0, pendingSum = 0, paidCount = 0, dueSoonSum = 0, dueSoonCount = 0;
    const urgentBills = [];
    fixedExpenses.forEach(exp => {
      const paid = getPaid(exp);
      const val = parseFloat(exp.value) || 0;
      if (paid) {
        paidSum += paid.amount; total += paid.amount; paidCount++;
      } else {
        pendingSum += val; total += val;
        if (isCurrentMonth) {
          const day = exp.day || 1;
          if (day === todayDay || day === todayDay + 1) { dueSoonSum += val; dueSoonCount++; }
          if (day <= todayDay) urgentBills.push(exp); // hoje ou vencida
        }
      }
    });
    const totalCount = fixedExpenses.length;
    const pct = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;
    return { total, paidSum, pendingSum, paidCount, totalCount, pct, dueSoonSum, dueSoonCount, urgentBills };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedExpenses, paidIndex, isCurrentMonth, todayDay]);

  const openAddExpense = (isVariable) => {
    if (isLimited && fixedExpenses.length >= TRIAL_FIXED_LIMIT) { setShowTrialModal(true); return; }
    setEditingExpenseId(null);
    setNewExpense({ name: '', value: '', day: 1, category: isVariable ? 'utilities' : 'housing', priority: 'essential', isVariable });
    setIsAddingExpense(true);
  };

  const startPay = (exp) => {
    setActualValue(exp.isVariable ? '' : String(exp.value || ''));
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayingExpense(exp);
  };

  const startEdit = (exp) => {
    setEditingExpenseId(exp.id);
    setNewExpense({
      name: exp.name, value: exp.value, day: exp.day || 1,
      category: exp.category || 'housing', priority: exp.priority || 'essential',
      isVariable: !!exp.isVariable
    });
    setIsAddingExpense(true);
  };

  const handleExport = () => {
    const head = ['Conta', 'Tipo', 'Categoria', 'Vencimento', 'Valor', 'Status'];
    const rows = [head];
    fixedExpenses.forEach(exp => {
      const paid = getPaid(exp);
      rows.push([
        exp.name,
        exp.isVariable ? 'Variável' : 'Fixa',
        catLabel(exp.category),
        `Dia ${exp.day || 1}`,
        (paid ? paid.amount : parseFloat(exp.value) || 0).toFixed(2).replace('.', ','),
        paid ? 'Pago' : 'Pendente'
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `contas_${selectedMonth}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const PRIORITY = {
    essential: { label: 'Essencial', tint: isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600' },
    comfort: { label: 'Conforto', tint: isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600' },
    superfluous: { label: 'Supérfluo', tint: isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-50 text-rose-600' },
  };

  const cardBg = isDark ? 'bg-[#1e2330] border-slate-800/60' : 'bg-white border-slate-100 shadow-sm';

  // ── KPI cards ──
  const KPIS = [
    { label: 'Total do mês', value: stats.total, hex: '#3b82f6', hint: 'fixas + variáveis' },
    { label: 'Já pagas', value: stats.paidSum, hex: '#10b981', hint: `${stats.paidCount} ${stats.paidCount === 1 ? 'conta' : 'contas'} · ${stats.pct}%` },
    { label: 'A pagar', value: stats.pendingSum, hex: '#f59e0b', hint: `${stats.totalCount - stats.paidCount} ${stats.totalCount - stats.paidCount === 1 ? 'conta restante' : 'contas restantes'}` },
    { label: 'Vence hoje/amanhã', value: stats.dueSoonSum, hex: '#f43f5e', hint: `${stats.dueSoonCount} ${stats.dueSoonCount === 1 ? 'conta urgente' : 'contas urgentes'}` },
  ];

  // ── Linha de uma conta ──
  const renderRow = (exp) => {
    const paid = getPaid(exp);
    const u = urgencyOf(exp, paid);
    const cat = CATEGORIES.expense.find(c => c.id === exp.category);
    const hex = categoryHex(cat);
    const Icon = cat?.icon || Home;
    const prio = PRIORITY[exp.priority] || PRIORITY.essential;

    const accent =
      u === 'today' || u === 'overdue' ? 'border-l-2 border-rose-500'
      : u === 'soon' ? 'border-l-2 border-amber-500'
      : 'border-l-2 border-transparent';

    const sub =
      paid ? `${catLabel(exp.category)} · ${paid.date ? `Pago em ${fmtDay(paid.date)}` : 'Pago'}`
      : `${catLabel(exp.category)} · Dia ${exp.day || 1}`;

    const subStatus =
      u === 'today' ? <span className="text-rose-500 font-bold">Vence HOJE</span>
      : u === 'overdue' ? <span className="text-rose-500 font-bold">Vencida</span>
      : u === 'soon' ? <span className="text-amber-500 font-semibold">{`Vence em ${(exp.day || 1) - todayDay} ${((exp.day || 1) - todayDay) === 1 ? 'dia' : 'dias'}`}</span>
      : null;

    return (
      <div key={exp.id} className={`group flex items-center gap-3 pl-2.5 pr-1 py-2.5 rounded-lg transition-colors ${accent} ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: paid ? (isDark ? 'rgba(16,185,129,0.12)' : '#ecfdf5') : `${hex}1A` }}>
          {paid ? <CheckCircle2 className="w-[18px] h-[18px] text-emerald-500" /> : <Icon className="w-[18px] h-[18px]" style={{ color: hex }} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`font-bold text-sm truncate ${paid ? 'text-slate-400' : (isDark ? 'text-white' : 'text-slate-800')}`}>{exp.name}</span>
            <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${prio.tint}`}>{prio.label}</span>
            {!paid && (
              <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>Pendente</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">{sub}</p>
        </div>

        {/* Ações de editar/excluir (hover) */}
        <div className="flex opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => startEdit(exp)} className="p-1.5 text-slate-400 hover:text-emerald-400 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => setDeleteConfirm(exp)} className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>

        <div className="text-right shrink-0">
          <p className={`text-sm font-black tabular-nums ${paid ? 'text-slate-400' : (exp.isVariable ? 'text-amber-500' : (isDark ? 'text-white' : 'text-slate-800'))}`}>
            {!paid && exp.isVariable && <span className="text-[10px] mr-0.5">≈</span>}
            R$ {fmt(paid ? paid.amount : exp.value)}
          </p>
          {subStatus && <p className="text-[10px] mt-0.5">{subStatus}</p>}
        </div>

        {paid ? (
          <button
            onClick={() => setUndoConfirm(exp)}
            title="Estornar pagamento"
            className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${isDark ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
          >
            <CheckCircle2 className="w-3 h-3" /> Pago
          </button>
        ) : (
          <button
            onClick={() => startPay(exp)}
            className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-white transition-all active:scale-95 ${
              u === 'today' || u === 'overdue' ? 'bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/20' : 'bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20'
            }`}
          >
            {u === 'today' || u === 'overdue' ? 'Pagar agora' : 'Pagar'}
          </button>
        )}
      </div>
    );
  };

  // ── Coluna (Fixas / Variáveis) ──
  const renderColumn = (list, isVariable) => {
    const title = isVariable ? 'Contas Variáveis' : 'Contas Fixas';
    const subtitle = isVariable ? 'Valor muda a cada mês' : 'Valor igual todo mês';
    const ColIcon = isVariable ? Zap : Repeat;
    const accentText = isVariable ? 'text-amber-500' : 'text-emerald-500';
    const accentSoft = isVariable ? (isDark ? 'bg-amber-500/10' : 'bg-amber-50') : (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50');

    let colTotal = 0, paidSum = 0, paidCount = 0;
    list.forEach(exp => {
      const paid = getPaid(exp);
      if (paid) { paidSum += paid.amount; paidCount++; colTotal += paid.amount; }
      else colTotal += parseFloat(exp.value) || 0;
    });

    // Ordena: Pagar agora (vencida/hoje) → a vencer em breve → a pagar → pagas (fim).
    // Dentro do mesmo grupo, por dia de vencimento.
    const rank = { overdue: 0, today: 0, soon: 1, pending: 2, paid: 3 };
    const sortedList = [...list].sort((a, b) => {
      const ra = rank[urgencyOf(a, getPaid(a))] ?? 2;
      const rb = rank[urgencyOf(b, getPaid(b))] ?? 2;
      if (ra !== rb) return ra - rb;
      return (a.day || 1) - (b.day || 1);
    });
    const restSum = colTotal - paidSum;
    const pct = colTotal > 0 ? Math.round((paidSum / colTotal) * 100) : 0;
    const barColor = isVariable ? 'bg-amber-500' : 'bg-emerald-500';

    const headBand = isVariable
      ? (isDark ? 'bg-amber-500/[0.07] border-amber-500/20' : 'bg-amber-50/80 border-amber-200')
      : (isDark ? 'bg-emerald-500/[0.07] border-emerald-500/20' : 'bg-emerald-50/80 border-emerald-200');

    return (
      <div className="p-5">
        {/* Cabeçalho da coluna — faixa destacada, separada das contas */}
        <div className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 mb-3 ${headBand}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isVariable ? 'bg-amber-500' : 'bg-emerald-500'} shadow-lg ${isVariable ? 'shadow-amber-500/25' : 'shadow-emerald-500/25'}`}>
              <ColIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className={`font-black text-base tracking-tight leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
              <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${accentText}`}>{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="text-right">
              <p className={`text-base font-black tabular-nums leading-none ${accentText}`}>R$ {fmt(colTotal)}</p>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider mt-1">total do mês</p>
            </div>
            <button
              onClick={() => openAddExpense(isVariable)}
              className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider text-white transition-all active:scale-95 shadow-lg ${
                isVariable ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/25' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25'
              }`}
            >
              <Plus className="w-3 h-3" /> Nova
            </button>
          </div>
        </div>

        {/* Linhas */}
        <div className="space-y-0.5 min-h-[60px]">
          {sortedList.length > 0 ? sortedList.map(renderRow) : (
            <div className={`flex flex-col items-center justify-center text-center py-8 px-4 rounded-xl border border-dashed ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${accentSoft} ${accentText}`}>
                <ColIcon className="w-5 h-5" />
              </div>
              <p className={`font-bold text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Nenhuma conta {isVariable ? 'variável' : 'fixa'}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 max-w-[200px]">{isVariable ? 'Ex: luz, gás, água, telefone.' : 'Ex: aluguel, internet, plano de saúde.'}</p>
              <button onClick={() => openAddExpense(isVariable)} className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white font-bold text-[10px] uppercase tracking-wider transition-all ${isVariable ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                <Plus className="w-3 h-3" /> Nova conta
              </button>
            </div>
          )}
        </div>

        {/* Progresso de pagamentos */}
        {list.length > 0 && (
          <div className={`mt-4 pt-4 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Progresso de pagamentos — {isVariable ? 'Variáveis' : 'Fixas'}</span>
              <span className={`text-[10px] font-black ${accentText}`}>{paidCount} de {list.length} pagas</span>
            </div>
            <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
              <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-slate-500 tabular-nums">R$ {fmt(paidSum)} pagos</span>
              <span className="text-[10px] text-slate-500 tabular-nums">R$ {fmt(restSum)} restantes</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Contas</h1>
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className={`p-1 rounded-lg transition-colors ${isDark ? 'text-slate-500 hover:text-blue-400 hover:bg-white/5' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50'}`}
              title="Como funcionam as contas"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Gerencie e acompanhe o pagamento das suas contas mensais</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={fixedExpenses.length === 0}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button
            onClick={() => openAddExpense(false)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black transition-all active:scale-95 shadow-lg shadow-emerald-500/25"
          >
            <Plus className="w-4 h-4" /> Nova Conta
          </button>
        </div>
      </div>

      {/* KPIs com linha de destaque */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPIS.map((k) => (
          <div key={k.label} className={`relative rounded-2xl border overflow-hidden ${cardBg}`}>
            <div className="h-1 w-full" style={{ background: k.hex }} />
            <div className="p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{k.label}</p>
              <p className="text-2xl font-black tabular-nums mt-1" style={{ color: k.hex }}>R$ {fmt(k.value)}</p>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{k.hint}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Banner de urgência — contas vencendo hoje / vencidas (mês corrente) */}
      {isCurrentMonth && stats.urgentBills.length > 0 && (() => {
        const first = stats.urgentBills[0];
        const many = stats.urgentBills.length > 1;
        return (
          <div className={`flex items-center justify-between gap-4 flex-wrap rounded-2xl border px-4 py-3 ${isDark ? 'bg-rose-500/[0.08] border-rose-500/20' : 'bg-rose-50 border-rose-200'}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-7 h-7 rounded-full bg-rose-500/15 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 text-rose-500" />
              </div>
              <p className={`text-xs min-w-0 ${isDark ? 'text-rose-200' : 'text-rose-700'}`}>
                {many ? (
                  <><span className="font-black">{stats.urgentBills.length} contas</span> precisam de atenção hoje! Total de <span className="font-black">R$ {fmt(stats.urgentBills.reduce((a, e) => a + (parseFloat(e.value) || 0), 0))}</span> em aberto.</>
                ) : (
                  <><span className="font-black">Conta {first.name} vence hoje!</span> Valor de <span className="font-black">R$ {fmt(first.value)}</span> precisa ser pago para evitar multa e interrupção do serviço.</>
                )}
              </p>
            </div>
            <button
              onClick={() => startPay(first)}
              className="shrink-0 text-xs font-black text-rose-500 hover:text-rose-400 transition-colors whitespace-nowrap"
            >
              Registrar pagamento →
            </button>
          </div>
        );
      })()}

      {/* Container com abas de mês + duas colunas */}
      <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
        {/* Abas de mês */}
        <div className={`flex items-center gap-1 px-4 pt-3 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
          {monthTabs.map(mt => {
            const active = mt.key === selectedMonth;
            return (
              <button
                key={mt.key}
                onClick={() => setSelectedMonth(mt.key)}
                className={`px-3 py-2 text-sm font-bold border-b-2 -mb-px transition-colors ${
                  active
                    ? 'text-emerald-400 border-emerald-400'
                    : `border-transparent ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`
                }`}
              >
                {mt.label}
              </button>
            );
          })}
        </div>

        {/* Colunas */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 ${isDark ? 'lg:divide-x divide-white/5' : 'lg:divide-x divide-slate-100'}`}>
          {renderColumn(fixedList, false)}
          {renderColumn(variableList, true)}
        </div>
      </div>

      {/* ───────── MODAIS ───────── */}

      {/* Pagar conta */}
      {payingExpense && (() => {
        const expense = payingExpense;
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => { setPayingExpense(null); setActualValue(''); }}>
            <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-sm rounded-2xl p-6 border relative animate-in zoom-in-95 duration-300 shadow-2xl text-center ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${expense.isVariable ? 'bg-amber-500/10' : 'bg-blue-500/10'}`}>
                {expense.isVariable ? <Zap className="w-6 h-6 text-amber-500" /> : <DollarSign className="w-6 h-6 text-blue-500" />}
              </div>
              <h4 className={`font-black text-sm uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {expense.isVariable ? 'Qual foi o valor?' : 'Confirmar Pagamento'}
              </h4>

              {expense.isVariable ? (
                <div className="mt-3 space-y-3">
                  <p className={`text-[11px] leading-relaxed ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
                    Informe quanto veio a fatura de <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{expense.name}</span> neste mês:
                  </p>
                  <div className="relative">
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>R$</span>
                    <input
                      autoFocus type="number" step="0.01" inputMode="decimal"
                      placeholder={String(parseFloat(expense.value).toFixed(2))}
                      value={actualValue}
                      onChange={(e) => setActualValue(e.target.value)}
                      className={`w-full px-3 py-2.5 pl-9 rounded-xl border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all text-center ${isDark ? 'bg-white/5 border-amber-500/40 text-white' : 'bg-white border-amber-300 text-slate-800'}`}
                    />
                  </div>
                  <p className="text-[9px] text-slate-400">Média cadastrada: R$ {fmt(expense.value)}</p>
                </div>
              ) : (
                <p className={`mt-3 text-[11px] leading-relaxed ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
                  Lançar <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{expense.name}</span> no valor de R$ {fmt(expense.value)} nas despesas do mês?
                </p>
              )}

              <div className="text-left mt-3">
                <label className="text-[9px] font-bold uppercase tracking-widest block mb-1 text-slate-500">Data do pagamento</label>
                <input
                  type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-bold focus:outline-none focus:ring-2 transition-all ${expense.isVariable ? 'focus:ring-amber-500/30' : 'focus:ring-blue-500/30'} ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                />
              </div>

              <div className="flex flex-col gap-2 pt-4">
                <button
                  onClick={() => handlePayExpense(expense)}
                  disabled={(expense.isVariable && (!actualValue || parseFloat(actualValue) <= 0)) || !payDate}
                  className={`w-full py-2.5 rounded-xl text-white font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${expense.isVariable ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'}`}
                >
                  {expense.isVariable && actualValue && parseFloat(actualValue) > 0 ? `Pagar R$ ${fmt(actualValue)}` : 'Sim, Confirmar'}
                </button>
                <button onClick={() => { setPayingExpense(null); setActualValue(''); }} className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Cancelar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Excluir conta */}
      {deleteConfirm && (() => {
        const expense = deleteConfirm;
        const isPaid = !!getPaid(expense);
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setDeleteConfirm(null)}>
            <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-xs rounded-2xl p-6 border relative animate-in zoom-in-95 duration-300 shadow-2xl text-center ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
              {isPaid ? (
                <>
                  <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto mb-3" />
                  <p className={`font-black text-sm mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Esta conta está paga</p>
                  <p className="text-[11px] text-slate-400 mb-5 leading-relaxed">Não é possível excluir uma conta paga neste mês. Estorne o pagamento primeiro.</p>
                  <button onClick={() => setDeleteConfirm(null)} className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Entendi</button>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-3"><Trash2 className="w-6 h-6 text-rose-500" /></div>
                  <p className={`font-black text-sm mb-5 ${isDark ? 'text-white' : 'text-slate-800'}`}>Excluir {expense.name}?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setDeleteConfirm(null)} className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Não</button>
                    <button onClick={() => handleDeleteExpense(expense.id)} className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-black text-xs uppercase tracking-wider hover:bg-rose-600 transition-all">Sim</button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Estornar pagamento */}
      {undoConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setUndoConfirm(null)}>
          <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-xs rounded-2xl p-6 border relative animate-in zoom-in-95 duration-300 shadow-2xl text-center ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
            <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-3"><X className="w-6 h-6 text-rose-500" /></div>
            <p className={`font-black text-sm mb-5 ${isDark ? 'text-white' : 'text-slate-800'}`}>Estornar o pagamento de {undoConfirm.name}?</p>
            <div className="flex gap-2">
              <button onClick={() => setUndoConfirm(null)} className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Não</button>
              <button onClick={() => { handleUndoPayment(undoConfirm); setUndoConfirm(null); }} className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-black text-xs uppercase tracking-wider hover:bg-rose-600 transition-all">Sim</button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowHelp(false)}>
          <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-2xl p-6 border relative animate-in zoom-in-95 duration-300 shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
            <button type="button" onClick={() => setShowHelp(false)} className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}><X className="w-4 h-4" /></button>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-xl shrink-0 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}><HelpCircle className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} /></div>
              <div>
                <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Como funcionam as Contas</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Dois tipos possíveis</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50/50 border-emerald-100'}`}>
                <div className="flex items-center gap-2 mb-2"><Repeat className="w-4 h-4 text-emerald-500" /><h4 className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Conta Fixa</h4></div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Cobra o <strong>mesmo valor todo mês</strong>. Cadastre uma vez e clique em "Pagar" quando o boleto chegar.</p>
                <p className={`text-[10px] mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Exemplos: Aluguel, Internet, Plano de Saúde, Streamings</p>
              </div>
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50/50 border-amber-100'}`}>
                <div className="flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-amber-500" /><h4 className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Conta Variável</h4></div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Cobra <strong>valor diferente a cada mês</strong>. Cadastre uma <strong>média</strong> só pra previsão; ao pagar, o app pergunta o valor real.</p>
                <p className={`text-[10px] mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Exemplos: Luz, Gás, Água, Conta de Celular, Condomínio</p>
              </div>
            </div>
            <button type="button" onClick={() => setShowHelp(false)} className="w-full mt-5 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95">Entendi</button>
          </div>
        </div>
      )}

      {/* Trial Limit Modal */}
      <TrialLimitModal
        isOpen={showTrialModal}
        onClose={() => setShowTrialModal(false)}
        limitMessage={`Você atingiu o limite de ${TRIAL_FIXED_LIMIT} contas fixas do ${planLevel === 'free' ? 'Plano Gratuito' : 'período de teste'}.`}
      />

      {/* Aviso de endividamento */}
      <OverdraftWarningModal
        isOpen={!!overdraftPending}
        amount={overdraftPending?.amount || 0}
        balance={Number(walletStats?.balance) || 0}
        itemName={overdraftPending?.expense?.name || 'Esta despesa'}
        onCancel={() => setOverdraftPending(null)}
        onConfirm={() => { if (overdraftPending) executePayExpense(overdraftPending.expense, overdraftPending.amount); }}
      />

      {/* Modal Add/Edit */}
      {isAddingExpense && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <form onSubmit={editingExpenseId ? handleUpdateExpense : handleAddExpense} className={`border rounded-2xl w-full max-w-md p-6 space-y-5 relative animate-in zoom-in-95 duration-300 shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
            <button
              type="button"
              onClick={() => { setIsAddingExpense(false); setEditingExpenseId(null); setNewExpense({ name: '', value: '', day: 1, category: 'housing', priority: 'essential', isVariable: false }); }}
              className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors z-[10] ${isDark ? 'hover:bg-white/10 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-1">
              <div className={`p-2 rounded-xl shrink-0 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}><FileText className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} /></div>
              <div>
                <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{editingExpenseId ? 'Editar Conta' : 'Nova Conta'}</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Cadastre suas despesas recorrentes</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Nome da Conta</label>
                <input
                  type="text" placeholder="ex: Aluguel, Luz, Internet" required
                  value={newExpense.name} onChange={(e) => setNewExpense({ ...newExpense, name: e.target.value })}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${isDark ? 'bg-white/5 border-white/5 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-slate-800 focus:border-blue-500'}`}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Tipo de Valor</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setNewExpense({ ...newExpense, isVariable: false })}
                    className={`p-3 rounded-xl border text-left transition-all ${!newExpense.isVariable ? (isDark ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-emerald-50 border-emerald-400') : (isDark ? 'bg-white/5 border-white/5 hover:border-white/10' : 'bg-slate-50 border-slate-100 hover:border-slate-200')}`}>
                    <div className="flex items-center gap-2 mb-1"><Repeat className={`w-3.5 h-3.5 ${!newExpense.isVariable ? 'text-emerald-500' : 'text-slate-400'}`} /><span className={`text-[10px] font-black uppercase tracking-widest ${!newExpense.isVariable ? 'text-emerald-600' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>Valor Fixo</span></div>
                    <p className="text-[9px] text-slate-400 leading-tight">Mesmo valor todo mês — ex: aluguel, internet</p>
                  </button>
                  <button type="button" onClick={() => setNewExpense({ ...newExpense, isVariable: true })}
                    className={`p-3 rounded-xl border text-left transition-all ${newExpense.isVariable ? (isDark ? 'bg-amber-500/10 border-amber-500/40' : 'bg-amber-50 border-amber-400') : (isDark ? 'bg-white/5 border-white/5 hover:border-white/10' : 'bg-slate-50 border-slate-100 hover:border-slate-200')}`}>
                    <div className="flex items-center gap-2 mb-1"><Zap className={`w-3.5 h-3.5 ${newExpense.isVariable ? 'text-amber-500' : 'text-slate-400'}`} /><span className={`text-[10px] font-black uppercase tracking-widest ${newExpense.isVariable ? 'text-amber-600' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>Valor Variável</span></div>
                    <p className="text-[9px] text-slate-400 leading-tight">Muda todo mês — ex: luz, gás, água</p>
                  </button>
                </div>
                {newExpense.isVariable && (
                  <div className={`mt-2 p-3 rounded-xl border flex items-start gap-2 ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50/50 border-amber-100'}`}>
                    <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] leading-relaxed text-amber-700 dark:text-amber-400">O valor abaixo será apenas uma <strong>estimativa/média</strong>. Quando for pagar, o app vai pedir o valor real do mês.</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">{newExpense.isVariable ? 'Valor médio (estimativa)' : 'Valor'}</label>
                  <input type="number" step="0.01" placeholder="R$ 0,00" required value={newExpense.value} onChange={(e) => setNewExpense({ ...newExpense, value: e.target.value })}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${isDark ? 'bg-white/5 border-white/5 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-slate-800 focus:border-blue-500'}`} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Vencimento (Dia)</label>
                  <input type="number" min={1} max={31} placeholder="1-31" required value={newExpense.day} onChange={(e) => setNewExpense({ ...newExpense, day: e.target.value })}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${isDark ? 'bg-white/5 border-white/5 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-slate-800 focus:border-blue-500'}`} />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Categoria</label>
                <select
                  value={newExpense.category}
                  onChange={(e) => { const newCat = e.target.value; const catDef = CATEGORIES.expense.find(c => c.id === newCat); setNewExpense({ ...newExpense, category: newCat, priority: catDef?.defaultPriority || newExpense.priority }); }}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all appearance-none ${isDark ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                >
                  {CATEGORIES.expense.map(cat => (<option key={cat.id} value={cat.id}>{cat.label}</option>))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Prioridade do Gasto</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'essential', label: 'Essencial', icon: Shield, color: 'emerald' },
                    { id: 'comfort', label: 'Conforto', icon: Sparkles, color: 'amber' },
                    { id: 'superfluous', label: 'Supérfluo', icon: Flame, color: 'rose' }
                  ].map(opt => {
                    const PIcon = opt.icon;
                    const isSelected = newExpense.priority === opt.id;
                    return (
                      <button key={opt.id} type="button" onClick={() => setNewExpense({ ...newExpense, priority: opt.id })}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? (opt.color === 'emerald' ? (isDark ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-emerald-50 border-emerald-400') : opt.color === 'rose' ? (isDark ? 'bg-rose-500/10 border-rose-500/40' : 'bg-rose-50 border-rose-400') : (isDark ? 'bg-amber-500/10 border-amber-500/40' : 'bg-amber-50 border-amber-400'))
                            : (isDark ? 'bg-white/5 border-white/5 hover:border-white/10' : 'bg-slate-50 border-slate-100 hover:border-slate-200')
                        }`}>
                        <PIcon className={`w-4 h-4 mx-auto mb-1 ${isSelected ? (opt.color === 'emerald' ? 'text-emerald-500' : opt.color === 'rose' ? 'text-rose-500' : 'text-amber-500') : 'text-slate-400'}`} />
                        <span className={`text-[9px] font-black uppercase tracking-widest block ${isSelected ? (opt.color === 'emerald' ? 'text-emerald-600' : opt.color === 'rose' ? 'text-rose-600' : 'text-amber-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setIsAddingExpense(false); setEditingExpenseId(null); setNewExpense({ name: '', value: '', day: 1, category: 'housing', priority: 'essential', isVariable: false }); }}
                className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Cancelar</button>
              <button type="submit" className="flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] bg-blue-500 hover:bg-blue-600 transition-all text-white shadow-lg shadow-blue-500/20 active:scale-95">{editingExpenseId ? 'Salvar Alterações' : 'Salvar Conta'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
