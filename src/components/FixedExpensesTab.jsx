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
  Wallet,
  CircleDollarSign,
  X,
  Shield,
  Sparkles,
  Flame,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  Repeat,
  HelpCircle,
  Zap,
  Info,
  ChevronDown
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import TrialLimitModal from './TrialLimitModal';
import OverdraftWarningModal from './OverdraftWarningModal';
import { CATEGORIES } from '../constants/categories';
import { isMonthlyExpenseTx, txMonthKey } from '../utils/financialLogic';

export default function FixedExpensesTab({ transactions = [], setActiveTab, walletStats, hideBalance, toggleHideBalance, expenseBasis = 'competencia' }) {
  const { theme } = useTheme();
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
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  // Colapso de cada painel (Valor Fixo / Valor Variável)
  const [collapsed, setCollapsed] = useState({ fixed: false, variable: false });
  const toggleSection = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    if (!currentUser) return;
    // We'll store fixed expenses in 'fixed_expenses' collection
    const q = query(collection(db, 'fixed_expenses'), where('userId', '==', currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFixedExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [currentUser]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.name || !newExpense.value) return;
    // Reforço do limite no salvamento.
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
    // Não permite excluir conta (fixa ou variável) que já está paga neste mês —
    // é preciso estornar o pagamento antes.
    const monthStr = new Date().toISOString().slice(0, 7);
    const exp = fixedExpenses.find(e => e.id === id);
    if (exp && exp.lastPaidMonth === monthStr) {
      return;
    }
    await deleteDoc(doc(db, 'fixed_expenses', id));
    setDeleteConfirm(null);
  };

  // Executa o pagamento de fato (chamado depois da checagem de saldo).
  const executePayExpense = async (expense, paidAmount) => {
    try {
      // Data do pagamento escolhida pelo usuário (padrão: hoje). Preserva o horário
      // atual para manter ordenação por createdAt/hora dentro do dia.
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

      // Marca como paga e, se for variável, registra o último valor pago como referência futura.
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
      // Permanece na tela de Contas Fixas após o pagamento.
    } catch (err) {
      console.error("Erro ao pagar conta fixa:", err);
    }
  };

  // Wrapper: valida valor + checa se cabe no saldo em carteira.
  // Se NÃO couber, abre o aviso de endividamento antes de executar.
  const handlePayExpense = async (expense) => {
    const paidAmount = expense.isVariable
      ? parseFloat(actualValue)
      : parseFloat(expense.value);

    if (!isFinite(paidAmount) || paidAmount <= 0) {
      alert('Informe um valor válido para o pagamento.');
      return;
    }

    const currentBalance = Number(walletStats?.balance) || 0;
    if (paidAmount > currentBalance) {
      // Guarda o pagamento e mostra o modal de aviso.
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
        where('month', '==', currentMonthStr)
      );
      const snap = await getDocs(qT);
      const deletePromises = snap.docs.map(d => deleteDoc(doc(db, 'transactions', d.id)));
      await Promise.all(deletePromises);

      await updateDoc(doc(db, 'fixed_expenses', expense.id), {
        lastPaidMonth: null
      });
    } catch (err) {
      console.error("Erro ao estornar:", err);
    }
  };

  const currentMonthStr = new Date().toISOString().slice(0, 7);

  // Cards padronizados com IncomeTab/ExitsTab — totais do mês corrente.
  const totalIncomeMonth = useMemo(() => {
    return transactions.filter(t => {
      const isIncome = t.type === 'income';
      const isNotSpecial = !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category);
      const matchesMonth = t.month === currentMonthStr || (t.date && t.date.startsWith(currentMonthStr));
      return isIncome && isNotSpecial && matchesMonth;
    }).reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
  }, [transactions, currentMonthStr]);

  const totalExpensesMonth = useMemo(() => {
    return transactions
      .filter(t => isMonthlyExpenseTx(t, expenseBasis) && txMonthKey(t) === currentMonthStr)
      .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
  }, [transactions, currentMonthStr, expenseBasis]);

  const { totalToPay, totalPaid, paidCount, totalCount } = useMemo(() => {
    let toPay = 0;
    let paid = 0;
    let pCount = 0;
    fixedExpenses.forEach(exp => {
      const val = parseFloat(exp.value) || 0;
      if (exp.lastPaidMonth === currentMonthStr) {
        paid += val;
        pCount++;
      } else {
        toPay += val;
      }
    });
    return { totalToPay: toPay, totalPaid: paid, paidCount: pCount, totalCount: fixedExpenses.length };
  }, [fixedExpenses, currentMonthStr]);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  // Separação por tipo (Valor Fixo x Valor Variável) + totais de cada painel.
  const fixedList = fixedExpenses.filter(e => !e.isVariable);
  const variableList = fixedExpenses.filter(e => e.isVariable);
  const fixedTotal = fixedList.reduce((a, e) => a + (parseFloat(e.value) || 0), 0);
  const variableTotal = variableList.reduce((a, e) => a + (parseFloat(e.value) || 0), 0);

  // Abre o modal de cadastro já com o tipo correto pré-selecionado.
  const openAddExpense = (isVariable) => {
    if (isLimited && fixedExpenses.length >= TRIAL_FIXED_LIMIT) { setShowTrialModal(true); return; }
    setEditingExpenseId(null);
    setNewExpense({ name: '', value: '', day: 1, category: isVariable ? 'utilities' : 'housing', priority: 'essential', isVariable });
    setIsAddingExpense(true);
  };

  // Renderiza o card de uma conta (reutilizado nos dois painéis).
  const renderExpenseCard = (expense) => {
    const isPaidThisMonth = expense.lastPaidMonth === currentMonthStr;
    const isOverdue = !isPaidThisMonth && new Date().getDate() > (expense.day || 1);

    return (
            <div key={expense.id} className={`p-5 rounded-2xl group relative transition-all hover:shadow-xl hover:-translate-y-1 ${
              isOverdue
              ? (theme === 'light' ? 'bg-rose-50 border border-rose-200' : 'bg-rose-500/10 border border-rose-500/20')
              : (theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]')
            }`}>
              <div className="flex justify-between items-start mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  isPaidThisMonth ? 'bg-emerald-500/10' : (isOverdue ? 'bg-rose-500/10' : 'bg-blue-500/10')
                }`}>
                  {isPaidThisMonth ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <Home className={`w-6 h-6 ${isOverdue ? 'text-rose-500' : 'text-blue-500'}`} />}
                </div>
                <div className="flex opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                  <button onClick={() => {
                      setEditingExpenseId(expense.id);
                      setNewExpense({
                        name: expense.name,
                        value: expense.value,
                        day: expense.day || 1,
                        category: expense.category || 'housing',
                        priority: expense.priority || 'essential',
                        isVariable: !!expense.isVariable
                      });
                      setIsAddingExpense(true);
                  }} className={`p-2 text-slate-400 hover:text-emerald-400 transition-colors rounded-md ${theme === 'light' ? 'hover:bg-slate-50' : ''}`}><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteConfirm(expense)} className={`p-2 text-slate-400 hover:text-rose-400 transition-colors rounded-md ${theme === 'light' ? 'hover:bg-slate-50' : ''}`}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className={`font-bold text-base ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{expense.name}</h4>
                  {expense.isVariable && (
                    <span className={`inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${theme === 'light' ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-400'}`}>
                      <Zap className="w-2.5 h-2.5" /> Variável
                    </span>
                  )}
                </div>
                <p className={`text-[10px] uppercase tracking-wider font-medium flex items-center gap-1.5 ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`}>
                  <Calendar className="w-3 h-3" /> {isOverdue ? `Venceu dia ${expense.day || 1}` : `Vence dia ${expense.day || 1}`}
                </p>
              </div>

              <div className={`mt-6 pt-5 border-t flex justify-between items-end ${theme === 'light' ? 'border-slate-100' : 'border-white/5'}`}>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-medium text-slate-400 tracking-wider">
                    {expense.isVariable ? 'Média mensal' : 'Valor mensal'}
                  </p>
                  <span className={`text-lg font-bold tabular-nums ${expense.isVariable ? 'text-amber-500' : 'text-blue-500'}`}>
                    {expense.isVariable && <span className="text-xs mr-0.5">≈</span>}
                    R$ {parseFloat(expense.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  {expense.isVariable && expense.lastPaidValue && (
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      Último mês: R$ {parseFloat(expense.lastPaidValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                  {!isPaidThisMonth ? (
                      <button
                          onClick={() => {
                              setActualValue(expense.isVariable ? '' : String(expense.value || ''));
                              setPayDate(new Date().toISOString().slice(0, 10));
                              setPayingExpense(expense);
                          }}
                          className={`w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider text-white flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${
                              expense.isVariable
                                ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                                : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'
                          }`}
                      >
                          <DollarSign className="w-4 h-4" /> {expense.isVariable ? 'Informar e Pagar' : 'Pagar Conta'}
                      </button>
                  ) : (
                      <div className="w-full py-2 rounded-lg bg-emerald-500/10 flex flex-col items-center justify-center gap-1">
                          <span className="font-bold text-xs uppercase tracking-wider text-emerald-500 flex items-center justify-center gap-2">
                              <CheckCircle2 className="w-4 h-4" /> Conta Paga
                          </span>
                          <button onClick={() => setUndoConfirm(expense)} className="text-[10px] text-emerald-600 hover:text-emerald-700 underline normal-case">Estornar</button>
                      </div>
                  )}
              </div>

              {/* Delete Confirm */}
              {deleteConfirm?.id === expense.id && (
                  <div className={`absolute inset-0 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-6 text-center z-50 animate-in fade-in duration-300 ${
                      theme === 'light' ? 'bg-white/95 border border-slate-100' : 'bg-slate-950/95'
                  }`}>
                      {isPaidThisMonth ? (
                          <div className="max-w-[220px] w-full">
                              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
                              <p className={`font-bold text-sm mb-2 leading-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Esta conta está paga</p>
                              <p className="text-[11px] text-slate-400 mb-5 leading-relaxed">Não é possível excluir uma conta paga neste mês. Estorne o pagamento primeiro e depois exclua.</p>
                              <button onClick={() => setDeleteConfirm(null)} className={`w-full py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
                                  theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/10 text-white hover:bg-white/20'
                              }`}>Entendi</button>
                          </div>
                      ) : (
                          <div className="max-w-[200px] w-full">
                              <Trash2 className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                              <p className={`font-bold text-sm mb-6 leading-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Excluir {expense.name}?</p>
                              <div className="flex gap-2">
                                  <button onClick={() => setDeleteConfirm(null)} className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
                                      theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/10 text-white hover:bg-white/20'
                                  }`}>Não</button>
                                  <button onClick={() => handleDeleteExpense(expense.id)} className="flex-1 py-2 rounded-lg bg-rose-500 text-white font-bold text-xs uppercase tracking-wider hover:bg-rose-600 transition-all">Sim</button>
                              </div>
                          </div>
                      )}
                  </div>
              )}

              {/* Pay Confirm — pra contas variáveis pede o valor real do mês */}
              {payingExpense?.id === expense.id && (
                  <div className={`absolute inset-0 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-5 text-center z-50 animate-in fade-in duration-300 ${
                      theme === 'light' ? 'bg-white/95 border border-slate-100' : 'bg-slate-950/95'
                  }`}>
                      <div className="max-w-[240px] w-full space-y-3">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-1 ${
                              expense.isVariable ? 'bg-amber-500/10' : 'bg-blue-500/10'
                          }`}>
                              {expense.isVariable
                                ? <Zap className="w-6 h-6 text-amber-500" />
                                : <DollarSign className="w-6 h-6 text-blue-500" />}
                          </div>
                          <h4 className={`font-bold text-sm uppercase tracking-widest ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                              {expense.isVariable ? 'Qual foi o valor?' : 'Confirmar Pagamento'}
                          </h4>

                          {expense.isVariable ? (
                              <>
                                  <p className={`text-[10px] leading-relaxed ${theme === 'light' ? 'text-slate-500' : 'text-white/60'}`}>
                                      Informe quanto veio a fatura de <span className={`font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{expense.name}</span> neste mês:
                                  </p>
                                  <div className="relative">
                                      <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>R$</span>
                                      <input
                                          autoFocus
                                          type="number"
                                          step="0.01"
                                          inputMode="decimal"
                                          placeholder={String(parseFloat(expense.value).toFixed(2))}
                                          value={actualValue}
                                          onChange={(e) => setActualValue(e.target.value)}
                                          className={`w-full px-3 py-2.5 pl-9 rounded-xl border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all text-center ${
                                              theme === 'light' ? 'bg-white border-amber-300 text-slate-800' : 'bg-white/5 border-amber-500/40 text-white'
                                          }`}
                                      />
                                  </div>
                                  <p className="text-[9px] text-slate-400">
                                      Média cadastrada: R$ {parseFloat(expense.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </p>
                              </>
                          ) : (
                              <p className={`text-[10px] leading-relaxed ${theme === 'light' ? 'text-slate-500' : 'text-white/60'}`}>
                                  Lançar <span className={`font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{expense.name}</span> no valor de R$ {parseFloat(expense.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} nas despesas do mês?
                              </p>
                          )}

                          <div className="text-left">
                              <label className={`text-[9px] font-bold uppercase tracking-widest block mb-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Data do pagamento</label>
                              <input
                                  type="date"
                                  value={payDate}
                                  onChange={(e) => setPayDate(e.target.value)}
                                  className={`w-full px-3 py-2 rounded-xl border text-xs font-bold focus:outline-none focus:ring-2 transition-all ${
                                      expense.isVariable ? 'focus:ring-amber-500/30' : 'focus:ring-blue-500/30'
                                  } ${theme === 'light' ? 'bg-white border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white'}`}
                              />
                          </div>

                          <div className="flex flex-col gap-2 pt-1">
                              <button
                                  onClick={() => handlePayExpense(expense)}
                                  disabled={(expense.isVariable && (!actualValue || parseFloat(actualValue) <= 0)) || !payDate}
                                  className={`w-full py-2 rounded-lg text-white font-bold text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                                      expense.isVariable
                                        ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                                        : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'
                                  }`}
                              >
                                  {expense.isVariable && actualValue && parseFloat(actualValue) > 0
                                    ? `Pagar R$ ${parseFloat(actualValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                    : 'Sim, Confirmar'}
                              </button>
                              <button onClick={() => { setPayingExpense(null); setActualValue(''); }} className={`w-full py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
                                  theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/10 text-white hover:bg-white/20'
                              }`}>Cancelar</button>
                          </div>
                      </div>
                  </div>
              )}

              {/* Undo Confirm Modal */}
              {undoConfirm?.id === expense.id && (
                  <div className={`absolute inset-0 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-6 text-center z-50 animate-in fade-in duration-300 ${
                      theme === 'light' ? 'bg-white/95 border border-slate-100' : 'bg-slate-950/95'
                  }`}>
                      <div className="max-w-[200px] w-full">
                          <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                            <X className="w-6 h-6 text-rose-500" />
                          </div>
                          <p className={`font-bold text-sm mb-6 leading-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Estornar o pagamento de {expense.name}?</p>
                          <div className="flex gap-2">
                              <button onClick={() => setUndoConfirm(null)} className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
                                  theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/10 text-white hover:bg-white/20'
                              }`}>Não</button>
                              <button onClick={() => {
                                  handleUndoPayment(expense);
                                  setUndoConfirm(null);
                              }} className="flex-1 py-2 rounded-lg bg-rose-500 text-white font-bold text-xs uppercase tracking-wider hover:bg-rose-600 transition-all">Sim</button>
                          </div>
                      </div>
                  </div>
              )}

            </div>
    );
  };

  // Cabeçalho de painel reutilizável (título + botão Novo + total quando minimizado + toggle).
  const PanelHeader = ({ sectionKey, title, icon: PIcon, accentText, accentSoft, total, isVariable, addLabel = 'Novo', addClass }) => {
    const isCollapsed = collapsed[sectionKey];
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <div className={`p-2 rounded-xl shrink-0 ${accentSoft}`}>
            <PIcon className={`w-5 h-5 ${accentText}`} />
          </div>
          <h2 className={`text-base font-medium tracking-wide uppercase ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{title}</h2>
          <button
            onClick={() => openAddExpense(isVariable)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-[11px] font-black uppercase tracking-wider shadow-lg hover:scale-[1.03] active:scale-95 transition-all ${addClass}`}
          >
            <Plus className="w-3.5 h-3.5" /> {addLabel}
          </button>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isCollapsed && (
            <span className={`hidden sm:inline-flex items-baseline gap-1 text-sm font-black tabular-nums ${theme === 'light' ? 'text-slate-700' : 'text-white'}`}>
              {isVariable && <span className="text-xs text-slate-400">≈</span>}R$ {formatCurrency(total).replace('R$', '').trim()}<span className="text-[10px] font-bold text-slate-500">/mês</span>
            </span>
          )}
          <button
            onClick={() => toggleSection(sectionKey)}
            title={isCollapsed ? 'Expandir' : 'Minimizar'}
            className={`p-2 rounded-xl transition-colors ${theme === 'light' ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/10 text-slate-400'}`}
          >
            <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? '-rotate-90' : ''}`} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 px-2 sm:px-4 md:px-0 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header — padronizado com as outras abas (título + botão no canto direito) */}
      <div className="flex items-center justify-between pt-8 pb-4 flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <h2 className={`text-xl font-medium tracking-wide uppercase ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Contas Fixas</h2>
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className={`p-1.5 rounded-lg transition-colors ${theme === 'light' ? 'text-slate-400 hover:text-blue-500 hover:bg-blue-50' : 'text-slate-500 hover:text-blue-400 hover:bg-white/5'}`}
            title="Como funcionam as contas fixas"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cards padrão (Saldo / Recebimentos / Despesas no Mês) — alinhado com IncomeTab/ExitsTab */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Saldo em Carteira */}
        <div className={`p-5 rounded-xl flex flex-col justify-center gap-3 ${theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-blue-400">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Saldo em Carteira</span>
            </div>
            {typeof toggleHideBalance === 'function' && (
              <button onClick={toggleHideBalance} className={`text-slate-500 hover:text-white transition-colors ${theme === 'light' ? 'hover:text-slate-800' : ''}`}>
                {hideBalance ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}
          </div>
          <div className={`text-2xl font-bold ${hideBalance ? 'blur-md' : ''} ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
            {hideBalance ? 'R$ 0,00' : formatCurrency(walletStats?.balance)}
          </div>
        </div>

        {/* Recebimentos no Mês */}
        <div className={`p-5 rounded-xl flex flex-col justify-center gap-3 ${theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]'}`}>
          <div className="flex items-center gap-2">
            <div className="text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Recebimentos no Mês</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 items-end text-emerald-500 pb-1">
              <div className="w-1 h-2 bg-emerald-500 rounded-sm"></div>
              <div className="w-1 h-3 bg-emerald-500 rounded-sm"></div>
              <div className="w-1 h-4 bg-emerald-500 rounded-sm"></div>
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {formatCurrency(totalIncomeMonth)}
            </div>
          </div>
        </div>

        {/* Despesas no Mês */}
        <div className={`p-5 rounded-xl flex flex-col justify-center gap-3 ${theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]'}`}>
          <div className="flex items-center gap-2">
            <div className="text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Despesas no Mês</span>
          </div>
          <div className="text-2xl font-bold text-rose-400">
            {formatCurrency(totalExpensesMonth)}
          </div>
        </div>
      </div>

      {/* Summary Cards (a pagar / pago) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total a Pagar */}
        <div className={`p-5 rounded-xl relative overflow-hidden transition-all ${
          theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Total a Pagar</p>
              <p className="text-[9px] text-slate-400 font-medium">
                {totalCount - paidCount} {totalCount - paidCount === 1 ? 'conta pendente' : 'contas pendentes'}
              </p>
            </div>
          </div>
          <span className={`text-2xl font-bold tabular-nums ${
            totalToPay > 0 ? 'text-amber-500' : (theme === 'light' ? 'text-slate-300' : 'text-slate-600')
          }`}>
            {formatCurrency(totalToPay)}
          </span>
          {totalToPay > 0 && (
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          )}
        </div>

        {/* Total Pago */}
        <div className={`p-5 rounded-xl relative overflow-hidden transition-all ${
          theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Total Pago</p>
              <p className="text-[9px] text-slate-400 font-medium">
                {paidCount} de {totalCount} {totalCount === 1 ? 'conta paga' : 'contas pagas'}
              </p>
            </div>
          </div>
          <span className={`text-2xl font-bold tabular-nums ${
            paidCount > 0 ? 'text-emerald-500' : (theme === 'light' ? 'text-slate-300' : 'text-slate-600')
          }`}>
            {formatCurrency(totalPaid)}
          </span>
          {paidCount === totalCount && totalCount > 0 && (
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          )}
        </div>
      </div>

      {/* DOIS PAINÉIS LADO A LADO: VALOR FIXO x VALOR VARIÁVEL */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-2">

        {/* PAINEL: VALOR FIXO (emerald) */}
        <section className={`space-y-5 rounded-3xl border p-5 md:p-6 ${
          theme === 'light' ? 'bg-gradient-to-br from-emerald-50/70 via-white to-white border-emerald-100' : 'bg-gradient-to-br from-emerald-500/[0.06] via-[#1a1f2b] to-[#161b27] border-emerald-500/15'
        }`}>
          <PanelHeader sectionKey="fixed" title="Valor Fixo" icon={Repeat} accentText="text-emerald-500" accentSoft="bg-emerald-500/10" total={fixedTotal} isVariable={false} addLabel="Novo" addClass="bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/25" />
          {!collapsed.fixed && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fixedList.length > 0 ? fixedList.map(renderExpenseCard) : (
                <div className={`col-span-full flex flex-col items-center justify-center text-center py-10 px-6 rounded-2xl border-2 border-dashed ${theme === 'light' ? 'border-slate-200' : 'border-white/5'}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${theme === 'light' ? 'bg-emerald-50 text-emerald-500' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    <Repeat className="w-6 h-6" />
                  </div>
                  <p className={`font-bold text-sm ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>Nenhuma conta de valor fixo</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs">Ex: aluguel, internet, plano de saúde, streamings.</p>
                  <button onClick={() => openAddExpense(false)} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold text-[11px] uppercase tracking-wider hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20">
                    <Plus className="w-3.5 h-3.5" /> Nova conta fixa
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* PAINEL: VALOR VARIÁVEL (amber) */}
        <section className={`space-y-5 rounded-3xl border p-5 md:p-6 ${
          theme === 'light' ? 'bg-gradient-to-br from-amber-50/70 via-white to-white border-amber-100' : 'bg-gradient-to-br from-amber-500/[0.06] via-[#1a1f2b] to-[#161b27] border-amber-500/15'
        }`}>
          <PanelHeader sectionKey="variable" title="Valor Variável" icon={Zap} accentText="text-amber-500" accentSoft="bg-amber-500/10" total={variableTotal} isVariable={true} addLabel="Novo" addClass="bg-gradient-to-r from-amber-500 to-amber-600 shadow-amber-500/25" />
          {!collapsed.variable && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {variableList.length > 0 ? variableList.map(renderExpenseCard) : (
                <div className={`col-span-full flex flex-col items-center justify-center text-center py-10 px-6 rounded-2xl border-2 border-dashed ${theme === 'light' ? 'border-slate-200' : 'border-white/5'}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${theme === 'light' ? 'bg-amber-50 text-amber-500' : 'bg-amber-500/10 text-amber-400'}`}>
                    <Zap className="w-6 h-6" />
                  </div>
                  <p className={`font-bold text-sm ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>Nenhuma conta de valor variável</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs">Ex: luz, gás, água, conta de telefone.</p>
                  <button onClick={() => openAddExpense(true)} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-white font-bold text-[11px] uppercase tracking-wider hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20">
                    <Plus className="w-3.5 h-3.5" /> Nova conta variável
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

      </div>

      {/* Help Modal — explica os dois tipos de conta fixa */}
      {showHelp && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className={`w-full max-w-md rounded-2xl p-6 border relative animate-in zoom-in-95 duration-300 shadow-2xl ${
            theme === 'light' ? 'bg-white border-slate-100' : 'bg-slate-900 border-white/10'
          }`}>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors ${theme === 'light' ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/10 text-slate-500'}`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-xl shrink-0 ${theme === 'light' ? 'bg-blue-50' : 'bg-blue-500/10'}`}>
                <HelpCircle className={`w-5 h-5 ${theme === 'light' ? 'text-blue-500' : 'text-blue-400'}`} />
              </div>
              <div>
                <h3 className={`text-base font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Como funcionam as Contas Fixas</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Dois tipos possíveis</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Valor Fixo */}
              <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Repeat className="w-4 h-4 text-emerald-500" />
                  <h4 className={`text-xs font-black uppercase tracking-widest ${theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'}`}>Valor Fixo</h4>
                </div>
                <p className={`text-[11px] leading-relaxed ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                  Cobra o <strong>mesmo valor todo mês</strong>. Você cadastra uma vez e clica em "Pagar Conta" quando o boleto chegar.
                </p>
                <p className={`text-[10px] mt-1.5 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Exemplos: Aluguel, Internet, Plano de Saúde, Streamings
                </p>
              </div>

              {/* Valor Variável */}
              <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-amber-50/50 border-amber-100' : 'bg-amber-500/5 border-amber-500/20'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <h4 className={`text-xs font-black uppercase tracking-widest ${theme === 'light' ? 'text-amber-700' : 'text-amber-400'}`}>Valor Variável</h4>
                </div>
                <p className={`text-[11px] leading-relaxed ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                  Cobra <strong>valor diferente a cada mês</strong>. Você cadastra uma <strong>média</strong> só pra previsão.
                  Quando clicar em <strong>"Informar e Pagar"</strong>, o app pergunta quanto veio a fatura no mês.
                </p>
                <p className={`text-[10px] mt-1.5 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Exemplos: Luz, Gás, Água, Conta de Celular, Condomínio
                </p>
              </div>

              <div className={`p-3 rounded-xl border flex items-start gap-2 ${theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                <Pencil className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <p className={`text-[10px] leading-relaxed ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                  <strong>Pode mudar o tipo depois:</strong> clica no lápis pra editar a conta a qualquer momento.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="w-full mt-5 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* Trial Limit Modal */}
      <TrialLimitModal
        isOpen={showTrialModal}
        onClose={() => setShowTrialModal(false)}
        limitMessage={`Você atingiu o limite de ${TRIAL_FIXED_LIMIT} contas fixas do ${planLevel === 'free' ? 'Plano Gratuito' : 'período de teste'}.`}
      />

      {/* Aviso de endividamento — pagamento supera o saldo em carteira */}
      <OverdraftWarningModal
        isOpen={!!overdraftPending}
        amount={overdraftPending?.amount || 0}
        balance={Number(walletStats?.balance) || 0}
        itemName={overdraftPending?.expense?.name || 'Esta despesa'}
        onCancel={() => setOverdraftPending(null)}
        onConfirm={() => {
          if (overdraftPending) {
            executePayExpense(overdraftPending.expense, overdraftPending.amount);
          }
        }}
      />

      {/* Modal Add/Edit */}
      {isAddingExpense && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <form onSubmit={editingExpenseId ? handleUpdateExpense : handleAddExpense} className={`border rounded-2xl w-full max-w-md p-6 space-y-5 relative animate-in zoom-in-95 duration-300 shadow-2xl ${
            theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
          }`}>
            <button
              type="button"
              onClick={() => {
                setIsAddingExpense(false);
                setEditingExpenseId(null);
                setNewExpense({ name: '', value: '', day: 1, category: 'housing', priority: 'essential', isVariable: false });
              }}
              className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors z-[10] ${
                theme === 'light' ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/10 text-slate-500'
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-1">
              <div className={`p-2 rounded-xl shrink-0 ${theme === 'light' ? 'bg-blue-50' : 'bg-blue-500/10'}`}>
                <FileText className={`w-5 h-5 ${theme === 'light' ? 'text-blue-500' : 'text-blue-400'}`} />
              </div>
              <div>
                <h3 className={`text-base font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                  {editingExpenseId ? 'Editar Conta Fixa' : 'Nova Conta Fixa'}
                </h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  Cadastre suas despesas recorrentes
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Nome da Conta</label>
                <input
                  type="text"
                  placeholder="ex: Aluguel, Luz, Internet"
                  required
                  value={newExpense.name}
                  onChange={(e) => setNewExpense({...newExpense, name: e.target.value})}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-blue-500' : 'bg-white/5 border-white/5 text-white focus:border-blue-500'
                  }`}
                />
              </div>

              {/* Tipo da conta: valor exato (aluguel, internet) ou variável (luz, gás, água) */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Tipo de Valor</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewExpense({...newExpense, isVariable: false})}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      !newExpense.isVariable
                        ? (theme === 'light' ? 'bg-emerald-50 border-emerald-400' : 'bg-emerald-500/10 border-emerald-500/40')
                        : (theme === 'light' ? 'bg-slate-50 border-slate-100 hover:border-slate-200' : 'bg-white/5 border-white/5 hover:border-white/10')
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Repeat className={`w-3.5 h-3.5 ${!newExpense.isVariable ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${
                        !newExpense.isVariable ? 'text-emerald-600' : (theme === 'light' ? 'text-slate-500' : 'text-slate-400')
                      }`}>Valor Fixo</span>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-tight">Mesmo valor todo mês — ex: aluguel, internet, plano</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewExpense({...newExpense, isVariable: true})}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      newExpense.isVariable
                        ? (theme === 'light' ? 'bg-amber-50 border-amber-400' : 'bg-amber-500/10 border-amber-500/40')
                        : (theme === 'light' ? 'bg-slate-50 border-slate-100 hover:border-slate-200' : 'bg-white/5 border-white/5 hover:border-white/10')
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className={`w-3.5 h-3.5 ${newExpense.isVariable ? 'text-amber-500' : 'text-slate-400'}`} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${
                        newExpense.isVariable ? 'text-amber-600' : (theme === 'light' ? 'text-slate-500' : 'text-slate-400')
                      }`}>Valor Variável</span>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-tight">Muda todo mês — ex: luz, gás, água, conta de telefone</p>
                  </button>
                </div>
                {newExpense.isVariable && (
                  <div className={`mt-2 p-3 rounded-xl border flex items-start gap-2 ${theme === 'light' ? 'bg-amber-50/50 border-amber-100' : 'bg-amber-500/5 border-amber-500/20'}`}>
                    <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] leading-relaxed text-amber-700 dark:text-amber-400">
                      O valor abaixo será apenas uma <strong>estimativa/média</strong>. Quando for pagar, o app vai pedir o valor real do mês.
                    </p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">
                    {newExpense.isVariable ? 'Valor médio (estimativa)' : 'Valor'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="R$ 0,00"
                    required
                    value={newExpense.value}
                    onChange={(e) => setNewExpense({...newExpense, value: e.target.value})}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                      theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-blue-500' : 'bg-white/5 border-white/5 text-white focus:border-blue-500'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Vencimento (Dia)</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    placeholder="1-31"
                    required
                    value={newExpense.day}
                    onChange={(e) => setNewExpense({...newExpense, day: e.target.value})}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                      theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-blue-500' : 'bg-white/5 border-white/5 text-white focus:border-blue-500'
                    }`}
                  />
                </div>
              </div>

              {/* Categoria — alinha com ExitsTab para o Health Score classificar corretamente */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Categoria</label>
                <select
                  value={newExpense.category}
                  onChange={(e) => {
                    const newCat = e.target.value;
                    const catDef = CATEGORIES.expense.find(c => c.id === newCat);
                    setNewExpense({
                      ...newExpense,
                      category: newCat,
                      priority: catDef?.defaultPriority || newExpense.priority
                    });
                  }}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all appearance-none ${
                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-slate-800 border-white/5 text-white'
                  }`}
                >
                  {CATEGORIES.expense.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Prioridade — necessária pro Health Score (50/30/20) */}
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
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setNewExpense({...newExpense, priority: opt.id})}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? (opt.color === 'emerald'
                                ? (theme === 'light' ? 'bg-emerald-50 border-emerald-400' : 'bg-emerald-500/10 border-emerald-500/40')
                                : opt.color === 'rose'
                                ? (theme === 'light' ? 'bg-rose-50 border-rose-400' : 'bg-rose-500/10 border-rose-500/40')
                                : (theme === 'light' ? 'bg-amber-50 border-amber-400' : 'bg-amber-500/10 border-amber-500/40'))
                            : (theme === 'light' ? 'bg-slate-50 border-slate-100 hover:border-slate-200' : 'bg-white/5 border-white/5 hover:border-white/10')
                        }`}
                      >
                        <PIcon className={`w-4 h-4 mx-auto mb-1 ${
                          isSelected
                            ? (opt.color === 'emerald' ? 'text-emerald-500' : opt.color === 'rose' ? 'text-rose-500' : 'text-amber-500')
                            : 'text-slate-400'
                        }`} />
                        <span className={`text-[9px] font-black uppercase tracking-widest block ${
                          isSelected
                            ? (opt.color === 'emerald' ? 'text-emerald-600' : opt.color === 'rose' ? 'text-rose-600' : 'text-amber-600')
                            : (theme === 'light' ? 'text-slate-500' : 'text-slate-400')
                        }`}>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddingExpense(false);
                  setEditingExpenseId(null);
                  setNewExpense({ name: '', value: '', day: 1, category: 'housing', priority: 'essential', isVariable: false });
                }}
                className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all ${
                  theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] bg-blue-500 hover:bg-blue-600 transition-all text-white shadow-lg shadow-blue-500/20 active:scale-95"
              >
                {editingExpenseId ? 'Salvar Alterações' : 'Salvar Conta'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
