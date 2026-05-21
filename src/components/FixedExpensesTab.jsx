import React, { useState, useEffect, useMemo } from 'react';
import { 
  Home, 
  Plus, 
  Trash2, 
  Pencil, 
  CheckCircle2, 
  Calendar,
  DollarSign,
  FileText
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';

export default function FixedExpensesTab({ transactions = [] }) {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  
  const [newExpense, setNewExpense] = useState({ name: '', value: '', day: 1 });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
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
        category: 'other', // Or maybe 'housing', but 'other' is safe
        date: today.toISOString(),
        userId: currentUser.uid,
        month: today.toISOString().slice(0, 7),
        createdAt: Date.now(),
        isFixed: true,
        paymentMethod: 'pix', // default to pix or allow choice later
        priority: 'essential'
      };

      await addDoc(collection(db, 'transactions'), transactionData);
      
      // Mark as paid for this month
      const lastPaidMonth = today.toISOString().slice(0, 7);
      await updateDoc(doc(db, 'fixed_expenses', expense.id), {
        lastPaidMonth
      });

      setPayingExpense(null);
    } catch (err) {
      console.error("Erro ao pagar conta fixa:", err);
    }
  };

  const currentMonthStr = new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <Home className="w-6 h-6 text-blue-500" />
            </div>
            <h2 className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Contas Fixas</h2>
          </div>
          <button 
            onClick={() => setIsAddingExpense(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" /> Nova Conta
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {fixedExpenses.map(expense => {
            const isPaidThisMonth = expense.lastPaidMonth === currentMonthStr;
            
            return (
              <div key={expense.id} className={`p-5 rounded-3xl border group relative transition-all hover:shadow-xl hover:-translate-y-1 ${
                theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'
              }`}>
                <div className="flex justify-between items-start mb-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isPaidThisMonth ? 'bg-emerald-500/10' : 'bg-blue-500/10'}`}>
                    {isPaidThisMonth ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <Home className="w-6 h-6 text-blue-500" />}
                  </div>
                  <div className="flex opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                    <button onClick={() => {
                        setEditingExpenseId(expense.id);
                        setNewExpense({ name: expense.name, value: expense.value, day: expense.day || 1 });
                        setIsAddingExpense(true);
                    }} className="p-2 text-slate-500 hover:text-emerald-500 bg-white/5 rounded-xl mr-1">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteConfirm(expense)} className="p-2 text-slate-500 hover:text-rose-500 bg-white/5 rounded-xl">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className={`font-black text-base ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{expense.name}</h4>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> Vence dia {expense.day || 1}
                  </p>
                </div>

                <div className="mt-6 pt-5 border-t border-white/5 flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[9px] uppercase font-black text-slate-500">Valor Estimado</p>
                    <span className="text-lg font-black text-blue-500 tabular-nums">R$ {parseFloat(expense.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="mt-4">
                    {!isPaidThisMonth ? (
                        <button 
                            onClick={() => setPayingExpense(expense)}
                            className="w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                        >
                            <DollarSign className="w-4 h-4" /> Pagar Conta
                        </button>
                    ) : (
                        <div className="w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-emerald-500/10 text-emerald-500 flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> Conta Paga
                        </div>
                    )}
                </div>

                {/* Delete Confirm */}
                {deleteConfirm?.id === expense.id && (
                    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center z-50 animate-in fade-in duration-300">
                        <div className="max-w-[200px] w-full">
                            <Trash2 className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                            <p className="text-white font-black text-sm mb-6 leading-tight">Excluir {expense.name}?</p>
                            <div className="flex gap-2">
                                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-black text-[9px] uppercase tracking-widest">Não</button>
                                <button onClick={() => handleDeleteExpense(expense.id)} className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-black text-[9px] uppercase tracking-widest">Sim</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Pay Confirm */}
                {payingExpense?.id === expense.id && (
                    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center z-50 animate-in fade-in duration-300">
                        <div className="max-w-[220px] w-full space-y-4">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                                <DollarSign className="w-6 h-6 text-blue-500" />
                            </div>
                            <h4 className="text-white font-black text-sm uppercase tracking-widest">Confirmar Pagamento</h4>
                            <p className="text-white/60 text-[10px] leading-relaxed mb-4">
                                Lançar <span className="text-white font-bold">{expense.name}</span> no valor de R$ {parseFloat(expense.value).toLocaleString('pt-BR')} nas despesas do mês?
                            </p>
                            <div className="flex flex-col gap-2 pt-2">
                                <button onClick={() => handlePayExpense(expense)} className="w-full py-2.5 rounded-xl bg-blue-500 text-white font-black text-[9px] uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-colors">
                                    Sim, Confirmar Pagamento
                                </button>
                                <button onClick={() => setPayingExpense(null)} className="w-full py-2.5 rounded-xl bg-white/10 text-white font-black text-[9px] uppercase tracking-widest hover:bg-white/20 transition-colors">Cancelar</button>
                            </div>
                        </div>
                    </div>
                )}

              </div>
            );
          })}
          {fixedExpenses.length === 0 && (
            <div className={`col-span-full py-12 text-center rounded-[2rem] border-2 border-dashed ${theme === 'light' ? 'border-slate-100 text-slate-400' : 'border-white/5 text-slate-600'}`}>
              <p className="text-xs font-bold uppercase tracking-widest">Nenhuma conta fixa cadastrada.</p>
            </div>
          )}
        </div>
      </section>

      {/* Modal Add/Edit */}
      {isAddingExpense && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
          <form onSubmit={editingExpenseId ? handleUpdateExpense : handleAddExpense} className={`border rounded-[2.5rem] w-full max-w-sm p-8 space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl ${
            theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/5 shadow-blue-500/10'
          }`}>
            <div className="text-center space-y-2 mb-6">
              <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                <FileText className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className={`text-xl font-black uppercase tracking-widest ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                  {editingExpenseId ? 'Editar Conta Fixa' : 'Nova Conta Fixa'}
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Cadastre suas despesas recorrentes
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Nome da Conta</label>
                  <input
                    type="text"
                    placeholder="ex: Aluguel, Luz"
                    required
                    value={newExpense.name}
                    onChange={(e) => setNewExpense({...newExpense, name: e.target.value})}
                    className={`w-full p-4 rounded-2xl border transition-all text-sm font-bold ${
                      theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-800' : 'bg-slate-800/50 focus:bg-slate-800 border-white/5 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 text-white placeholder-slate-500'
                    }`}
                  />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Valor</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="R$ 0,00"
                    required
                    value={newExpense.value}
                    onChange={(e) => setNewExpense({...newExpense, value: e.target.value})}
                    className={`w-full p-4 rounded-2xl border transition-all text-sm font-bold ${
                      theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-800' : 'bg-slate-800/50 focus:bg-slate-800 border-white/5 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 text-white placeholder-slate-500'
                    }`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Vencimento (Dia)</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    placeholder="1-31"
                    required
                    value={newExpense.day}
                    onChange={(e) => setNewExpense({...newExpense, day: e.target.value})}
                    className={`w-full p-4 rounded-2xl border transition-all text-sm font-bold ${
                      theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-800' : 'bg-slate-800/50 focus:bg-slate-800 border-white/5 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 text-white placeholder-slate-500'
                    }`}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => {
                  setIsAddingExpense(false);
                  setEditingExpenseId(null);
                  setNewExpense({ name: '', value: '', day: 1 });
              }} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-colors ${theme === 'light' ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Cancelar</button>
              <button type="submit" className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-blue-500 hover:bg-blue-600 transition-colors text-white shadow-lg shadow-blue-500/20">
                  {editingExpenseId ? 'Salvar Alterações' : 'Salvar Conta'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
