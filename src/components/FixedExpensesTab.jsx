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
  X
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import TrialLimitModal from './TrialLimitModal';

export default function FixedExpensesTab({ transactions = [], setActiveTab }) {
  const { theme } = useTheme();
  const { currentUser, isTrial } = useAuth();

  // Trial limits
  const TRIAL_FIXED_LIMIT = 2;
  const [showTrialModal, setShowTrialModal] = useState(false);

  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  
  const [newExpense, setNewExpense] = useState({ name: '', value: '', day: 1 });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [undoConfirm, setUndoConfirm] = useState(null);
  const [payingExpense, setPayingExpense] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

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
    
    await addDoc(collection(db, 'fixed_expenses'), { 
      ...newExpense, 
      value: parseFloat(newExpense.value),
      userId: currentUser.uid,
      createdAt: Date.now()
    });
    
    setNewExpense({ name: '', value: '', day: 1 });
    setIsAddingExpense(false);
  };

  const handleUpdateExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.name || !editingExpenseId) return;
    
    await updateDoc(doc(db, 'fixed_expenses', editingExpenseId), { 
      name: newExpense.name,
      value: parseFloat(newExpense.value),
      day: parseInt(newExpense.day)
    });
    
    setNewExpense({ name: '', value: '', day: 1 });
    setEditingExpenseId(null);
    setIsAddingExpense(false);
  };

  const handleDeleteExpense = async (id) => {
    await deleteDoc(doc(db, 'fixed_expenses', id));
    setDeleteConfirm(null);
  };

  const handlePayExpense = async (expense) => {
    try {
      const today = new Date();
      const transactionData = {
        description: expense.name,
        amount: parseFloat(expense.value),
        type: 'expense',
        category: 'conta_fixa',
        date: today.toISOString(),
        userId: currentUser.uid,
        month: today.toISOString().slice(0, 7),
        createdAt: Date.now(),
        isFixed: true,
        paymentMethod: 'pix',
        priority: 'essential'
      };

      await addDoc(collection(db, 'transactions'), transactionData);
      
      // Mark as paid for this month
      const lastPaidMonth = today.toISOString().slice(0, 7);
      await updateDoc(doc(db, 'fixed_expenses', expense.id), {
        lastPaidMonth
      });

      setPayingExpense(null);
      if (typeof setActiveTab === 'function') {
        setActiveTab('gastos');
      }
    } catch (err) {
      console.error("Erro ao pagar conta fixa:", err);
    }
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

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 px-2 sm:px-4 md:px-0 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex items-center justify-center pt-8 pb-4">
        <h2 className={`text-xl font-medium tracking-wide uppercase ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Contas Fixas</h2>
      </div>

      <div className="flex justify-center mb-8">
        <button
          onClick={() => {
            if (isTrial && fixedExpenses.length >= TRIAL_FIXED_LIMIT) {
              setShowTrialModal(true);
              return;
            }
            setIsAddingExpense(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(59,130,246,0.15)] active:scale-95"
        >
          <Plus className="w-4 h-4" /> Nova Conta
        </button>
      </div>

      {/* Summary Cards */}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
        {fixedExpenses.map(expense => {
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
                      setNewExpense({ name: expense.name, value: expense.value, day: expense.day || 1 });
                      setIsAddingExpense(true);
                  }} className={`p-2 text-slate-400 hover:text-emerald-400 transition-colors rounded-md ${theme === 'light' ? 'hover:bg-slate-50' : ''}`}><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteConfirm(expense)} className={`p-2 text-slate-400 hover:text-rose-400 transition-colors rounded-md ${theme === 'light' ? 'hover:bg-slate-50' : ''}`}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className={`font-bold text-base ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{expense.name}</h4>
                <p className={`text-[10px] uppercase tracking-wider font-medium flex items-center gap-1.5 ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`}>
                  <Calendar className="w-3 h-3" /> {isOverdue ? `Venceu dia ${expense.day || 1}` : `Vence dia ${expense.day || 1}`}
                </p>
              </div>

              <div className={`mt-6 pt-5 border-t flex justify-between items-end ${theme === 'light' ? 'border-slate-100' : 'border-white/5'}`}>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-medium text-slate-400 tracking-wider">Valor Estimado</p>
                  <span className="text-lg font-bold text-blue-500 tabular-nums">R$ {parseFloat(expense.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="mt-4">
                  {!isPaidThisMonth ? (
                      <button 
                          onClick={() => setPayingExpense(expense)}
                          className="w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                      >
                          <DollarSign className="w-4 h-4" /> Pagar Conta
                      </button>
                  ) : (
                      <div className="w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider bg-emerald-500/10 text-emerald-500 flex items-center justify-center gap-2 relative">
                          <CheckCircle2 className="w-4 h-4" /> Conta Paga
                          <button onClick={() => setUndoConfirm(expense)} className="absolute right-4 text-[10px] text-emerald-600 hover:text-emerald-700 underline normal-case">Estornar</button>
                      </div>
                  )}
              </div>

              {/* Delete Confirm */}
              {deleteConfirm?.id === expense.id && (
                  <div className={`absolute inset-0 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-6 text-center z-50 animate-in fade-in duration-300 ${
                      theme === 'light' ? 'bg-white/95 border border-slate-100' : 'bg-slate-950/95'
                  }`}>
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
                  </div>
              )}

              {/* Pay Confirm */}
              {payingExpense?.id === expense.id && (
                  <div className={`absolute inset-0 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-6 text-center z-50 animate-in fade-in duration-300 ${
                      theme === 'light' ? 'bg-white/95 border border-slate-100' : 'bg-slate-950/95'
                  }`}>
                      <div className="max-w-[220px] w-full space-y-4">
                          <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                              <DollarSign className="w-6 h-6 text-blue-500" />
                          </div>
                          <h4 className={`font-bold text-sm uppercase tracking-widest ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Confirmar Pagamento</h4>
                          <p className={`text-[10px] leading-relaxed mb-4 ${theme === 'light' ? 'text-slate-500' : 'text-white/60'}`}>
                              Lançar <span className={`font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{expense.name}</span> no valor de R$ {parseFloat(expense.value).toLocaleString('pt-BR')} nas despesas do mês?
                          </p>
                          <div className="flex flex-col gap-2 pt-2">
                              <button onClick={() => handlePayExpense(expense)} className="w-full py-2 rounded-lg bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all active:scale-95">
                                  Sim, Confirmar
                              </button>
                              <button onClick={() => setPayingExpense(null)} className={`w-full py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
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
        })}
        {fixedExpenses.length === 0 && (
          <div className={`col-span-full py-12 text-center rounded-2xl border-2 border-dashed ${theme === 'light' ? 'border-slate-200 text-slate-400' : 'border-white/5 text-slate-500'}`}>
            <p className="text-xs font-bold uppercase tracking-widest">Nenhuma conta fixa cadastrada.</p>
          </div>
        )}
      </div>

      {/* Trial Limit Modal */}
      <TrialLimitModal
        isOpen={showTrialModal}
        onClose={() => setShowTrialModal(false)}
        limitMessage={`Você atingiu o limite de ${TRIAL_FIXED_LIMIT} contas fixas no período de teste.`}
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
                setNewExpense({ name: '', value: '', day: 1 });
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
                  placeholder="ex: Aluguel, Luz"
                  required
                  value={newExpense.name}
                  onChange={(e) => setNewExpense({...newExpense, name: e.target.value})}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-blue-500' : 'bg-white/5 border-white/5 text-white focus:border-blue-500'
                  }`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Valor</label>
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
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddingExpense(false);
                  setEditingExpenseId(null);
                  setNewExpense({ name: '', value: '', day: 1 });
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
