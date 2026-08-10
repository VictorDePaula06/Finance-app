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
  AlertCircle,
  Loader2,
  CreditCard,
  ChevronRight
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import TrialLimitModal from './TrialLimitModal';
import OverdraftWarningModal from './OverdraftWarningModal';
import ConfirmSaveDialog from './ConfirmSaveDialog';
import { EditTxModal, DeleteTxDialog } from './TransactionActions';
import { CATEGORIES, categoryHex } from '../constants/categories';
import { generateTablePDF } from '../utils/generatePDF';
import logo from '../assets/logo.png';

// mode="cadastro"   → Recorrentes › Contas Fixas. Só cadastra/edita/exclui (sem baixa).
// mode="lancamento" → Lançamentos › Despesas. Só dá baixa/estorna (sem cadastrar).
export default function FixedExpensesTab({ transactions = [], setActiveTab, walletStats, hideBalance, toggleHideBalance, expenseBasis = 'competencia', mode = 'cadastro' }) {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const isCadastro = mode === 'cadastro';
  const { currentUser, isTrial, planLevel } = useAuth();

  // Limites aplicados ao trial e ao Plano Gratuito permanente
  const isLimited = isTrial || planLevel === 'free';
  const TRIAL_FIXED_LIMIT = 2;
  const [showTrialModal, setShowTrialModal] = useState(false);

  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  // Seletor "Fixa ou Variável?" — único ponto de entrada para criar conta.
  const [choosingType, setChoosingType] = useState(false);
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

  // Cartões (para a despesa avulsa no crédito).
  const [cards, setCards] = useState([]);
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'cards'), where('userId', '==', currentUser.uid));
    return onSnapshot(q, snap => setCards(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);

  // Lançamentos › Despesas: escolher entre dar baixa numa conta cadastrada ou lançar avulsa.
  const [expenseChooser, setExpenseChooser] = useState(false);
  const [showPayBoard, setShowPayBoard] = useState(false); // modal grande de baixa
  // "Ver todos" por seção (fixo/avulso/parcelamento) com filtro de período.
  const [viewAllType, setViewAllType] = useState(null);
  const [viewPeriod, setViewPeriod] = useState('30d');
  const [viewAllFilter, setViewAllFilter] = useState('todos'); // todos | fixo | avulso | parcelamento
  // Editar/excluir um gasto já lançado (feed / ver todos).
  const [editTx, setEditTx] = useState(null);
  const [deleteTx, setDeleteTx] = useState(null);

  // ── Despesa avulsa: um gasto só deste mês (não vira conta fixa) ──
  const [manualOpen, setManualOpen] = useState(false);
  const [mForm, setMForm] = useState({ desc: '', value: '', date: new Date().toISOString().slice(0, 10), category: 'housing', priority: 'essential', pay: 'pix', cardId: '' });
  const [mBusy, setMBusy] = useState(false);
  const [mError, setMError] = useState(null);

  const openManual = () => {
    setMError(null);
    setMForm({ desc: '', value: '', date: new Date().toISOString().slice(0, 10), category: 'housing', priority: 'essential', pay: 'pix', cardId: cards[0]?.id || '' });
    setManualOpen(true);
  };

  const doManualExpense = async () => {
    const value = parseFloat(String(mForm.value).replace(/\./g, '').replace(',', '.')) || 0;
    if (!mForm.desc.trim() || value <= 0 || mBusy) return;
    if (mForm.pay === 'credito' && !mForm.cardId) { setMError('Selecione o cartão da compra.'); return; }
    setMBusy(true); setMError(null);
    try {
      const [y, mo, d] = (mForm.date || new Date().toISOString().slice(0, 10)).split('-').map(Number);
      const dt = new Date(y, mo - 1, d, 12, 0, 0);
      const isCredit = mForm.pay === 'credito';
      await addDoc(collection(db, 'transactions'), {
        description: mForm.desc.trim(),
        amount: value,
        type: 'expense',
        category: mForm.category,
        date: dt.toISOString(),
        month: dt.toISOString().slice(0, 7),
        userId: currentUser.uid,
        createdAt: Date.now(),
        isFixed: false,
        paymentMethod: mForm.pay,
        selectedCardId: isCredit ? mForm.cardId : null,
        invoiceStatus: isCredit ? 'unpaid' : null,
        isInstallment: false,
        priority: mForm.priority,
      });
      setManualOpen(false);
    } catch (err) {
      console.error('Erro ao lançar despesa avulsa:', err);
      setMError(err?.message || 'Erro inesperado. Tente novamente.');
    }
    setMBusy(false);
  };

  // ── Salvar conta: confirma → grava → fecha (erro visível) ──
  const [confirmSave, setConfirmSave] = useState(false);
  const [savingExp, setSavingExp] = useState(false);
  const [expError, setExpError] = useState(null);

  const requestSaveExpense = (e) => {
    e.preventDefault();
    if (!newExpense.name || !newExpense.value) return;
    if (!editingExpenseId && isLimited && fixedExpenses.length >= TRIAL_FIXED_LIMIT) { setShowTrialModal(true); return; }
    setExpError(null);
    setConfirmSave(true);
  };

  const doSaveExpense = async () => {
    if (savingExp) return;
    setSavingExp(true);
    setExpError(null);
    try {
      if (editingExpenseId) {
        await updateDoc(doc(db, 'fixed_expenses', editingExpenseId), {
          name: newExpense.name,
          value: parseFloat(newExpense.value),
          day: parseInt(newExpense.day),
          category: newExpense.category || 'housing',
          priority: newExpense.priority || 'essential',
          isVariable: !!newExpense.isVariable
        });
      } else {
        await addDoc(collection(db, 'fixed_expenses'), {
          ...newExpense,
          value: parseFloat(newExpense.value),
          category: newExpense.category || 'housing',
          priority: newExpense.priority || 'essential',
          isVariable: !!newExpense.isVariable,
          userId: currentUser.uid,
          createdAt: Date.now()
        });
      }
      setNewExpense({ name: '', value: '', day: 1, category: 'housing', priority: 'essential', isVariable: false });
      setEditingExpenseId(null);
      setConfirmSave(false);
      setIsAddingExpense(false);
    } catch (err) {
      console.error('Erro ao salvar conta fixa:', err);
      setExpError(err?.message || 'Erro inesperado. Tente novamente.');
    }
    setSavingExp(false);
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

  // Todos os gastos (baixas de contas + avulsas + parcelas), mais recentes primeiro.
  const isInstallmentTx = (t) => !!(t.isInstallmentPayment || t.isInstallment || t.installmentInfo);
  const allExpenseTx = useMemo(() =>
    [...transactions]
      .filter(t => t.type === 'expense' && !['investment', 'vault', 'credit_card_bill'].includes(t.category))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  , [transactions]);

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
    setChoosingType(false);
    setEditingExpenseId(null);
    setNewExpense({ name: '', value: '', day: 1, category: isVariable ? 'utilities' : 'housing', priority: 'essential', isVariable });
    setIsAddingExpense(true);
  };

  // Único ponto de entrada: pergunta o tipo antes de abrir o formulário.
  const openTypeChooser = () => {
    if (isLimited && fixedExpenses.length >= TRIAL_FIXED_LIMIT) { setShowTrialModal(true); return; }
    setChoosingType(true);
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

  const handleExport = async () => {
    const monthName = new Date(selectedMonth + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    let totalPagoExp = 0, totalPendExp = 0;
    const rows = fixedExpenses.map(exp => {
      const paid = getPaid(exp);
      const val = paid ? paid.amount : parseFloat(exp.value) || 0;
      if (paid) totalPagoExp += val; else totalPendExp += val;
      return [
        exp.name,
        exp.isVariable ? 'Variável' : 'Fixa',
        catLabel(exp.category),
        `Dia ${exp.day || 1}`,
        paid ? 'Pago' : 'Pendente',
        `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      ];
    });
    await generateTablePDF({
      title: 'Contas do Mês',
      subtitle: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      badge: `${fixedExpenses.length} ${fixedExpenses.length === 1 ? 'conta' : 'contas'}`,
      fileName: `Contas_Alivia_${selectedMonth}.pdf`,
      summary: [
        { label: 'Total do mês', value: `R$ ${(totalPagoExp + totalPendExp).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: 'blue' },
        { label: 'Pagas', value: `R$ ${totalPagoExp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: 'green' },
        { label: 'A pagar', value: `R$ ${totalPendExp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: 'amber' },
      ],
      columns: ['Conta', 'Tipo', 'Categoria', 'Vencimento', 'Status', 'Valor'],
      rows,
      columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } },
    }, logo);
  };

  const PRIORITY = {
    essential: { label: 'Essencial', tint: isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600' },
    comfort: { label: 'Conforto', tint: isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600' },
    superfluous: { label: 'Supérfluo', tint: isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-50 text-rose-600' },
  };

  const cardBg = 'pat-card';

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

        {/* Ações de editar/excluir (hover) — só em CADASTROS */}
        {isCadastro && (
          <div className="flex opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => startEdit(exp)} className="p-1.5 text-slate-400 hover:text-emerald-400 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={() => setDeleteConfirm(exp)} className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        )}

        <div className="text-right shrink-0">
          <p className={`text-sm font-black tabular-nums ${paid ? 'text-slate-400' : (exp.isVariable ? 'text-amber-500' : (isDark ? 'text-white' : 'text-slate-800'))}`}>
            {!paid && exp.isVariable && <span className="text-[10px] mr-0.5">≈</span>}
            R$ {fmt(paid ? paid.amount : exp.value)}
          </p>
          {subStatus && <p className="text-[10px] mt-0.5">{subStatus}</p>}
        </div>

        {/* Baixa/estorno só em LANÇAMENTOS. Em Cadastros mostra apenas o status. */}
        {isCadastro ? (
          <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
            paid
              ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
              : (isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500')
          }`}>
            {paid ? <><CheckCircle2 className="w-3 h-3" /> Pago</> : 'Em aberto'}
          </span>
        ) : paid ? (
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
            {/* Sem botão aqui: criar conta é só pelo "Nova Conta" do topo. */}
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
              {isCadastro && (
                <p className="text-[10px] text-slate-500 mt-2">Use <strong>“Nova Conta”</strong> no topo.</p>
              )}
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

  // Board de contas cadastradas (colunas Fixa/Variável) — SEMPRE do mês atual.
  // A baixa só acontece no mês corrente; meses anteriores não são navegáveis aqui.
  const currentMonthName = new Date(currentMonthStr + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const renderBillsBoard = () => (
    <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
      <div className={`flex items-center justify-between gap-2 px-4 py-2.5 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
        <span className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <Calendar className="w-3.5 h-3.5 text-emerald-500" /> Contas de <span className="capitalize text-emerald-500">{currentMonthName}</span>
        </span>
      </div>
      <div className={`grid grid-cols-1 lg:grid-cols-2 ${isDark ? 'lg:divide-x divide-white/5' : 'lg:divide-x divide-slate-100'}`}>
        {renderColumn(fixedList, false)}
        {renderColumn(variableList, true)}
      </div>
    </div>
  );

  // Tipo do lançamento (uma coluna).
  const txKind = (t) => isInstallmentTx(t) ? 'Parcela' : (t.isFixed ? 'Fixo' : 'Avulso');
  const KIND_CLS = {
    Fixo: isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600',
    Parcela: isDark ? 'bg-violet-500/10 text-violet-400' : 'bg-violet-50 text-violet-600',
    Avulso: isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500',
  };

  // Linha de um gasto — compacta, com colunas (tipo · prioridade · valor). Editável.
  const renderExpenseRow = (t) => {
    const cat = CATEGORIES.expense.find(c => c.id === t.category);
    const hex = categoryHex(cat);
    const Icon = cat?.icon || DollarSign;
    const dt = t.date ? new Date(t.date) : null;
    const isCredit = t.paymentMethod === 'credito';
    const prio = PRIORITY[t.priority];
    const kind = txKind(t);
    return (
      <div key={t.id} className={`group flex items-center gap-3 px-4 py-2 transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}>
        <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${hex}1a`, color: hex }}><Icon className="w-4 h-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={`text-[13px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{t.description || 'Gasto'}</p>
            <span className={`shrink-0 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${KIND_CLS[kind]}`}>{kind}</span>
          </div>
          <p className="text-[10px] font-bold text-slate-500 truncate">
            {dt ? dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : '—'}
            {' · '}{cat?.label || 'Outro'}
            {isCredit ? ' · crédito' : ''}
          </p>
        </div>
        {prio && <span className={`hidden sm:inline shrink-0 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${prio.tint}`}>{prio.label}</span>}
        <span className="text-[13px] font-black tabular-nums text-rose-500 shrink-0 w-24 text-right">− R$ {fmt(parseFloat(t.amount) || 0)}</span>
        <div className="flex items-center shrink-0">
          <button onClick={() => setEditTx(t)} title="Editar" className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => setDeleteTx(t)} title="Excluir" className={`p-1.5 rounded-lg text-rose-400 opacity-0 group-hover:opacity-100 transition-all ${isDark ? 'hover:bg-rose-500/10' : 'hover:bg-rose-50'}`}><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    );
  };

  // Feed único dos últimos gastos (últimos 8, compactos) + "Ver todos".
  const renderFeed = () => {
    if (allExpenseTx.length === 0) {
      return (
        <div className={`rounded-2xl border ${cardBg} text-center py-12`}>
          <DollarSign className={`w-9 h-9 mx-auto mb-2 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
          <p className="text-sm font-bold text-slate-500">Nenhum gasto lançado ainda.</p>
          <p className="text-[11px] text-slate-500 mt-1">Use <strong>“Despesa”</strong> no topo para dar baixa numa conta ou lançar avulsa.</p>
        </div>
      );
    }
    return (
      <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
        <div className={`flex items-center justify-between gap-2 px-4 py-3 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}><DollarSign className="w-[18px] h-[18px] text-rose-500" /></span>
            <div className="min-w-0">
              <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Últimos gastos</p>
              <p className="text-[10px] font-bold text-slate-500">{allExpenseTx.length} {allExpenseTx.length === 1 ? 'lançamento' : 'lançamentos'}</p>
            </div>
          </div>
        </div>
        <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-100'}`}>
          {allExpenseTx.slice(0, 8).map(renderExpenseRow)}
        </div>
        {allExpenseTx.length > 8 && (
          <button
            onClick={() => { setViewPeriod('30d'); setViewAllFilter('todos'); setViewAllType('todos'); }}
            className={`w-full flex items-center justify-center gap-1 px-4 py-3 border-t text-[11px] font-black uppercase tracking-widest transition-colors ${isDark ? 'border-white/5 text-rose-400 hover:bg-rose-500/[0.06]' : 'border-slate-100 text-rose-500 hover:bg-rose-50'}`}
          >
            Ver todos ({allExpenseTx.length}) <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  // ── CADASTRO: linha simples de uma conta (sem status de pagamento) ──
  const renderCadastroRow = (exp, isVariable) => {
    const cat = CATEGORIES.expense.find(c => c.id === exp.category);
    const hex = categoryHex(cat);
    const Icon = cat?.icon || Home;
    const prio = PRIORITY[exp.priority] || PRIORITY.essential;
    return (
      <div key={exp.id} className={`group flex items-center gap-3 py-3 -mx-1 px-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${hex}1A` }}>
          <Icon className="w-[18px] h-[18px]" style={{ color: hex }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`font-bold text-sm truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{exp.name}</span>
            <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${prio.tint}`}>{prio.label}</span>
          </div>
          <p className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1"><Calendar className="w-3 h-3" /> {catLabel(exp.category)} · Todo dia {exp.day || 1}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-black tabular-nums ${isVariable ? 'text-amber-500' : (isDark ? 'text-white' : 'text-slate-800')}`}>
            {isVariable && <span className="text-[10px] mr-0.5">≈</span>}R$ {fmt(exp.value)}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => startEdit(exp)} title="Editar" className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => setDeleteConfirm(exp)} title="Excluir" className={`p-2 rounded-lg text-rose-400 ${isDark ? 'hover:bg-rose-500/10' : 'hover:bg-rose-50'}`}><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    );
  };

  // ── CADASTRO: painel de um grupo (Minhas Contas Fixas / Variáveis) ──
  const renderCadastroPanel = (list, isVariable) => {
    const title = isVariable ? 'Minhas Contas Variáveis' : 'Minhas Contas Fixas';
    const subtitle = isVariable ? 'valor muda a cada mês (estimativa)' : 'valor igual todo mês';
    const ColIcon = isVariable ? Zap : Repeat;
    const accentText = isVariable ? 'text-amber-500' : 'text-emerald-500';
    const accentSoft = isVariable ? (isDark ? 'bg-amber-500/10' : 'bg-amber-50') : (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50');
    const iconBg = isVariable ? 'bg-amber-500' : 'bg-emerald-500';
    const shadow = isVariable ? 'shadow-amber-500/25' : 'shadow-emerald-500/25';
    const total = list.reduce((a, e) => a + (parseFloat(e.value) || 0), 0);
    const sorted = [...list].sort((a, b) => (a.day || 1) - (b.day || 1));

    return (
      <div className="pat-card p-5">
        {/* Cabeçalho com o TOTAL em destaque — a pessoa vê de imediato */}
        <div className={`flex items-center justify-between gap-3 pb-4 mb-2 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${iconBg} shadow-lg ${shadow}`}>
              <ColIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className={`font-black text-base tracking-tight leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
              <p className="text-[10px] font-bold text-slate-500 mt-0.5">{list.length} {list.length === 1 ? 'conta' : 'contas'} · {subtitle}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total / mês</p>
            <p className={`text-xl font-black tabular-nums leading-tight ${accentText}`}>
              {isVariable && total > 0 && <span className="text-xs mr-0.5">≈</span>}R$ {fmt(total)}
            </p>
          </div>
        </div>

        {sorted.length > 0 ? (
          <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-100'}`}>
            {sorted.map(exp => renderCadastroRow(exp, isVariable))}
          </div>
        ) : (
          <div className={`flex flex-col items-center justify-center text-center py-10 px-4 mt-1 rounded-xl border border-dashed ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${accentSoft} ${accentText}`}>
              <ColIcon className="w-5 h-5" />
            </div>
            <p className={`font-bold text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Nenhuma conta {isVariable ? 'variável' : 'fixa'}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 max-w-[200px]">{isVariable ? 'Ex: luz, gás, água, telefone.' : 'Ex: aluguel, internet, plano de saúde.'}</p>
            <p className="text-[10px] text-slate-500 mt-2">Use <strong>“Nova Conta”</strong> no topo.</p>
          </div>
        )}
      </div>
    );
  };

  const renderCadastroPanels = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {renderCadastroPanel(fixedList, false)}
      {renderCadastroPanel(variableList, true)}
    </div>
  );

  // ── CADASTRO: dois cartões-resumo com o total de cada tipo ──
  const renderCadastroSummary = () => {
    const fixedTotal = fixedList.reduce((a, e) => a + (parseFloat(e.value) || 0), 0);
    const varTotal = variableList.reduce((a, e) => a + (parseFloat(e.value) || 0), 0);
    const grandTotal = fixedTotal + varTotal;
    const totalCount = fixedList.length + variableList.length;
    return (
      <div className="space-y-3">
        {/* Total geral em destaque: fixas + variáveis */}
        <div className={`relative rounded-2xl border overflow-hidden ${cardBg}`}>
          <div className="h-1 w-full bg-blue-500" />
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total de contas / mês</p>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{totalCount} {totalCount === 1 ? 'conta cadastrada' : 'contas cadastradas'} · fixas + variáveis</p>
            </div>
            <p className="text-3xl font-black tabular-nums text-blue-500 shrink-0">{varTotal > 0 && <span className="text-lg mr-0.5">≈</span>}R$ {fmt(grandTotal)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
        <div className={`relative rounded-2xl border overflow-hidden ${cardBg}`}>
          <div className="h-1 w-full bg-emerald-500" />
          <div className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Contas fixas</p>
            <p className="text-2xl font-black tabular-nums mt-1 text-emerald-500">R$ {fmt(fixedTotal)}</p>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fixedList.length} {fixedList.length === 1 ? 'conta' : 'contas'} · valor igual todo mês</p>
          </div>
        </div>
        <div className={`relative rounded-2xl border overflow-hidden ${cardBg}`}>
          <div className="h-1 w-full bg-amber-500" />
          <div className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Contas variáveis</p>
            <p className="text-2xl font-black tabular-nums mt-1 text-amber-500">{varTotal > 0 && <span className="text-sm mr-0.5">≈</span>}R$ {fmt(varTotal)}</p>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{variableList.length} {variableList.length === 1 ? 'conta' : 'contas'} · estimativa mensal</p>
          </div>
        </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{isCadastro ? 'Contas Fixas' : 'Despesas do mês'}</h1>
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className={`p-1 rounded-lg transition-colors ${isDark ? 'text-slate-500 hover:text-blue-400 hover:bg-white/5' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50'}`}
              title="Como funcionam as contas"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {isCadastro
              ? 'Cadastre suas contas recorrentes — a baixa é feita em Lançamentos › Despesas'
              : 'Dê baixa nas contas fixas quando vencerem e lance despesas avulsas do mês'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={fixedExpenses.length === 0}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <Download className="w-4 h-4" /> Exportar
          </button>
          {isCadastro ? (
            <button
              onClick={openTypeChooser}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" /> Nova Conta
            </button>
          ) : (
            // Um único botão: abre o seletor (dar baixa numa cadastrada OU lançar avulsa).
            // Vermelho: indica saída/despesa.
            <button
              onClick={() => setExpenseChooser(true)}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/25 flex items-center gap-2 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" /> Despesa
            </button>
          )}
        </div>
      </div>

      {/* Cadastro: totais por tipo. Lançamentos: KPIs de pagamento do mês. */}
      {isCadastro ? renderCadastroSummary() : (
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
      )}

      {/* Banner de urgência — contas vencendo hoje / vencidas (só em Lançamentos) */}
      {!isCadastro && isCurrentMonth && stats.urgentBills.length > 0 && (() => {
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

      {/* Cadastro: painéis "Minhas Contas Fixas / Variáveis" com total em destaque.
          Lançamentos: feed dos últimos gastos (contas cadastradas vão para o
          modal "Despesa cadastrada"). */}
      {isCadastro ? renderCadastroPanels() : renderFeed()}

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

      {/* Confirmação de cadastro/edição de conta */}
      <ConfirmSaveDialog
        open={confirmSave}
        title={editingExpenseId ? 'Salvar alterações da conta?' : 'Cadastrar esta conta?'}
        message={editingExpenseId ? 'Os valores passam a valer para as próximas baixas.' : 'Depois é só dar baixa todo mês em Lançamentos › Despesas.'}
        confirmLabel={editingExpenseId ? 'Salvar alterações' : 'Cadastrar conta'}
        details={[
          { label: 'Nome', value: newExpense.name },
          { label: 'Tipo', value: newExpense.isVariable ? 'Variável (muda todo mês)' : 'Fixa (valor igual)' },
          { label: newExpense.isVariable ? 'Média' : 'Valor', value: newExpense.value ? `R$ ${newExpense.value}` : '—' },
          { label: 'Vencimento', value: `Dia ${newExpense.day || 1}` },
        ]}
        busy={savingExp}
        error={expError}
        onConfirm={doSaveExpense}
        onCancel={() => { setConfirmSave(false); setExpError(null); }}
      />

      {/* Modal: escolher tipo de despesa (cadastrada × avulsa) */}
      {expenseChooser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setExpenseChooser(false)}>
          <div onClick={e => e.stopPropagation()} className={`border rounded-[2rem] w-full max-w-md p-6 relative animate-in zoom-in-95 duration-300 shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
            <button onClick={() => setExpenseChooser(false)} className={`absolute top-4 right-4 p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><X className="w-5 h-5" /></button>
            <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Lançar despesa</h3>
            <p className="text-[11px] text-slate-500 mt-0.5 mb-5">O que você quer lançar?</p>
            <div className="space-y-3">
              <button
                onClick={() => { setExpenseChooser(false); setShowPayBoard(true); }}
                className={`w-full flex items-start gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.99] ${isDark ? 'border-white/10 hover:border-rose-500/40 hover:bg-rose-500/[0.06]' : 'border-slate-200 hover:border-rose-300 hover:bg-rose-50/60'}`}
              >
                <span className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-100 text-rose-600'}`}><Repeat className="w-5 h-5" /></span>
                <span className="min-w-0">
                  <span className={`block text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Despesa Fixa</span>
                  <span className="block text-[10px] text-slate-500 mt-1 leading-relaxed">Dar baixa numa conta fixa ou variável que já está cadastrada.</span>
                </span>
              </button>
              <button
                onClick={() => { setExpenseChooser(false); openManual(); }}
                className={`w-full flex items-start gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.99] ${isDark ? 'border-white/10 hover:border-rose-500/40 hover:bg-rose-500/[0.06]' : 'border-slate-200 hover:border-rose-300 hover:bg-rose-50/60'}`}
              >
                <span className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-100 text-rose-600'}`}><Zap className="w-5 h-5" /></span>
                <span className="min-w-0">
                  <span className={`block text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Despesa avulsa</span>
                  <span className="block text-[10px] text-slate-500 mt-1 leading-relaxed">Um gasto único deste mês (mercado, uber, farmácia…), sem virar conta fixa.</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal "Ver todos": todos os gastos com filtro por tipo e período */}
      {viewAllType && (() => {
        const PERIODS = [['7d', 'Últimos 7 dias', 7], ['30d', 'Últimos 30 dias', 30], ['3m', 'Últimos 3 meses', 90], ['6m', 'Últimos 6 meses', 180]];
        const KINDS = [['todos', 'Todos'], ['fixo', 'Fixos'], ['avulso', 'Avulsos'], ['parcelamento', 'Parcelamentos']];
        const days = (PERIODS.find(p => p[0] === viewPeriod) || PERIODS[1])[2];
        const cutoff = Date.now() - days * 86400000;
        const byKind = (t) => viewAllFilter === 'todos'
          || (viewAllFilter === 'parcelamento' && isInstallmentTx(t))
          || (viewAllFilter === 'fixo' && t.isFixed && !isInstallmentTx(t))
          || (viewAllFilter === 'avulso' && !t.isFixed && !isInstallmentTx(t));
        const list = allExpenseTx.filter(byKind).filter(t => (t.date ? new Date(t.date).getTime() : 0) >= cutoff);
        const total = list.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setViewAllType(null)}>
            <div onClick={e => e.stopPropagation()} className={`border rounded-[2rem] w-full max-w-lg h-[82vh] max-h-[720px] flex flex-col relative animate-in zoom-in-95 duration-300 shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
              <div className={`flex items-center justify-between gap-3 p-5 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}><DollarSign className="w-5 h-5 text-rose-500" /></span>
                  <div className="min-w-0">
                    <h3 className={`text-base font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>Todos os gastos</h3>
                    <p className="text-[10px] font-bold text-slate-500">Filtre por tipo e período</p>
                  </div>
                </div>
                <button onClick={() => setViewAllType(null)} className={`p-2 rounded-lg shrink-0 ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><X className="w-5 h-5" /></button>
              </div>

              {/* Filtro por tipo */}
              <div className={`flex items-center gap-2 px-5 py-2.5 border-b overflow-x-auto ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                {KINDS.map(([id, label]) => (
                  <button key={id} onClick={() => setViewAllFilter(id)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${viewAllFilter === id ? 'bg-rose-500 text-white border-rose-500' : (isDark ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}`}>
                    {label}
                  </button>
                ))}
              </div>
              {/* Filtro por período */}
              <div className={`flex items-center gap-2 px-5 py-2.5 border-b overflow-x-auto ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                {PERIODS.map(([id, label]) => (
                  <button key={id} onClick={() => setViewPeriod(id)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${viewPeriod === id ? 'bg-slate-500/80 text-white border-slate-500' : (isDark ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Total */}
              <div className={`flex items-center justify-between px-5 py-2.5 border-b ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50'}`}>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{list.length} {list.length === 1 ? 'lançamento' : 'lançamentos'}</span>
                <span className="text-sm font-black tabular-nums text-rose-500">− R$ {fmt(total)}</span>
              </div>

              {/* Lista */}
              <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                {list.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className={`w-9 h-9 mx-auto mb-2 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
                    <p className="text-sm font-bold text-slate-500">Nada neste filtro/período.</p>
                    <p className="text-[11px] text-slate-500 mt-1">Tente outro tipo ou um período maior.</p>
                  </div>
                ) : (
                  <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-100'}`}>
                    {list.map(renderExpenseRow)}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal grande: baixa das contas cadastradas (Fixa × Variável, lado a lado) */}
      {showPayBoard && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowPayBoard(false)}>
          <div onClick={e => e.stopPropagation()} className={`border rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar p-5 relative animate-in zoom-in-95 duration-300 shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Dar baixa em contas</h3>
                <p className="text-[11px] text-slate-500">Marque como pagas suas contas fixas e variáveis do mês.</p>
              </div>
              <button onClick={() => setShowPayBoard(false)} className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><X className="w-5 h-5" /></button>
            </div>
            {renderBillsBoard()}
          </div>
        </div>
      )}

      {/* Modal: despesa avulsa (só este mês) */}
      {manualOpen && (() => {
        const inCls = `w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold outline-none transition-colors ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-rose-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-rose-500'}`;
        const lbl = 'text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5';
        const PRIOS = [['essential', 'Essencial'], ['comfort', 'Conforto'], ['superfluous', 'Supérfluo']];
        const PAYS = [['dinheiro', 'Dinheiro'], ['pix', 'Pix'], ['credito', 'Crédito']];
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className={`border rounded-[2rem] w-full max-w-md p-6 space-y-4 relative animate-in zoom-in-95 duration-300 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
              <button onClick={() => setManualOpen(false)} className={`absolute top-4 right-4 p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><X className="w-5 h-5" /></button>
              <div className="flex items-center gap-3">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}><Zap className="w-5 h-5 text-rose-500" /></span>
                <div>
                  <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Despesa avulsa</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Um gasto só deste mês — não vira conta fixa.</p>
                </div>
              </div>

              <div>
                <label className={lbl}>Descrição</label>
                <input autoFocus className={inCls} placeholder="Ex: Mercado, farmácia, uber" value={mForm.desc} onChange={e => setMForm({ ...mForm, desc: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Valor (R$)</label>
                  <input className={inCls} inputMode="decimal" placeholder="0,00" value={mForm.value} onChange={e => setMForm({ ...mForm, value: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}>Data</label>
                  <input type="date" className={inCls} value={mForm.date} onChange={e => setMForm({ ...mForm, date: e.target.value })} />
                </div>
              </div>

              <div>
                <label className={lbl}>Categoria</label>
                <select className={inCls} value={mForm.category} onChange={e => setMForm({ ...mForm, category: e.target.value })}>
                  {(CATEGORIES.expense || []).map(c => <option key={c.id} value={c.id} className={isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label className={lbl}>Prioridade</label>
                <div className="grid grid-cols-3 gap-2">
                  {PRIOS.map(([id, label]) => (
                    <button key={id} type="button" onClick={() => setMForm({ ...mForm, priority: id })}
                      className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${mForm.priority === id ? 'bg-rose-500 text-white border-rose-500' : (isDark ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={lbl}>Forma de pagamento</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYS.map(([id, label]) => (
                    <button key={id} type="button" onClick={() => setMForm({ ...mForm, pay: id })}
                      className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${mForm.pay === id ? 'bg-rose-500 text-white border-rose-500' : (isDark ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {mForm.pay === 'credito' && (
                <div>
                  <label className={lbl}>Cartão</label>
                  {cards.length === 0 ? (
                    <p className="text-[11px] text-amber-500">Nenhum cartão. Cadastre em Recorrentes › Cartão para lançar no crédito.</p>
                  ) : (
                    <select className={inCls} value={mForm.cardId} onChange={e => setMForm({ ...mForm, cardId: e.target.value })}>
                      {cards.map(c => <option key={c.id} value={c.id} className={isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'}>{c.name}</option>)}
                    </select>
                  )}
                  <p className="text-[10px] text-slate-500 mt-1.5">No crédito, o gasto entra na fatura e sai do saldo só quando você pagar a fatura.</p>
                </div>
              )}

              {mError && (
                <div className={`flex items-start gap-2 p-3 rounded-xl border ${isDark ? 'bg-rose-500/10 border-rose-500/25' : 'bg-rose-50 border-rose-200'}`}>
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-rose-400 leading-relaxed break-words">{mError}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setManualOpen(false)} disabled={mBusy} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest disabled:opacity-50 ${isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Cancelar</button>
                <button onClick={doManualExpense} disabled={mBusy || !mForm.desc.trim() || !mForm.value} className="flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest bg-rose-500 hover:bg-rose-400 text-white disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {mBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> Lançando...</> : 'Lançar despesa'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: escolher o tipo da conta (único caminho para criar) */}
      {choosingType && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setChoosingType(false)}>
          <div
            onClick={e => e.stopPropagation()}
            className={`border rounded-[2rem] w-full max-w-md p-6 relative animate-in zoom-in-95 duration-300 shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}
          >
            <button onClick={() => setChoosingType(false)} className={`absolute top-4 right-4 p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}>
              <X className="w-5 h-5" />
            </button>

            <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Que tipo de conta?</h3>
            <p className="text-[11px] text-slate-500 mt-0.5 mb-5">Isso muda como o app cobra o valor todo mês.</p>

            <div className="space-y-3">
              {/* Fixa */}
              <button
                onClick={() => openAddExpense(false)}
                className={`w-full flex items-start gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.99] ${
                  isDark ? 'border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/[0.06]' : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/60'
                }`}
              >
                <span className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                  <Repeat className="w-5 h-5" />
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Conta Fixa</span>
                  <span className="block text-[11px] font-bold text-emerald-500 mt-0.5">Valor igual todo mês</span>
                  <span className="block text-[10px] text-slate-500 mt-1 leading-relaxed">Ex.: aluguel, internet, plano de saúde, mensalidade.</span>
                </span>
              </button>

              {/* Variável */}
              <button
                onClick={() => openAddExpense(true)}
                className={`w-full flex items-start gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.99] ${
                  isDark ? 'border-white/10 hover:border-amber-500/40 hover:bg-amber-500/[0.06]' : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/60'
                }`}
              >
                <span className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
                  <Zap className="w-5 h-5" />
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Conta Variável</span>
                  <span className="block text-[11px] font-bold text-amber-500 mt-0.5">Valor muda a cada mês</span>
                  <span className="block text-[10px] text-slate-500 mt-1 leading-relaxed">Ex.: luz, água, gás, telefone. Você cadastra uma média e informa o valor real ao pagar.</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add/Edit */}
      {isAddingExpense && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <form onSubmit={requestSaveExpense} className={`border rounded-2xl w-full max-w-md p-6 space-y-5 relative animate-in zoom-in-95 duration-300 shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
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
                  {CATEGORIES.expense.map(cat => (<option key={cat.id} value={cat.id} className={isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'}>{cat.label}</option>))}
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

      {/* Editar / excluir um gasto lançado */}
      <EditTxModal tx={editTx} categories={CATEGORIES.expense} onClose={() => setEditTx(null)} />
      <DeleteTxDialog tx={deleteTx} onClose={() => setDeleteTx(null)} />
    </div>
  );
}
