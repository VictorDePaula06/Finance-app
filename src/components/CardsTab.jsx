import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Trash2,
  ChevronRight,
  Calendar,
  DollarSign,
  Tag,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
  Pencil,
  Hash,
  ShoppingBag,
  Eye,
  X,
  Repeat
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { CATEGORIES } from '../constants/categories';
import TrialLimitModal from './TrialLimitModal';

const CardsTab = ({ transactions = [], setActiveTab }) => {
  const { theme } = useTheme();
  const { currentUser, isTrial } = useAuth();

  // Trial limits
  const TRIAL_CARDS_LIMIT = 1;
  const TRIAL_SUBS_LIMIT  = 3;
  const [showTrialModal, setShowTrialModal]     = useState(false);
  const [trialModalMsg, setTrialModalMsg]       = useState('');

  const openTrialModal = (msg) => { setTrialModalMsg(msg); setShowTrialModal(true); };

  const [cards, setCards] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [isAddingSub, setIsAddingSub] = useState(false);
  
  // Form States
  const [newCard, setNewCard] = useState({ name: '', color: 'bg-blue-600', last4: '', brand: 'Visa', dueDay: 10, closingDay: '' });
  const [editingCardId, setEditingCardId] = useState(null);
  const [newSub, setNewSub] = useState({ name: '', value: '', day: 1, cardId: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, type, title }
  const [payingInstallment, setPayingInstallment] = useState(null); // { sub object }
  const [payingInvoice, setPayingInvoice] = useState(null); // { cardId, total, expenses, invoiceMonth }
  const [paidInvoiceSuccess, setPaidInvoiceSuccess] = useState(null); // cardId
  const [viewingInvoiceCardId, setViewingInvoiceCardId] = useState(null);
  
  // Edit Transaction State
  const [editingTransaction, setEditingTransaction] = useState(null); // { id, description, amount, date }
  const [editingSub, setEditingSub] = useState(null); // { id, name, value, day }

  useEffect(() => {
    if (!currentUser) return;

    // Listen to Cards
    const qCards = query(collection(db, 'cards'), where('userId', '==', currentUser.uid));
    const unsubCards = onSnapshot(qCards, (snapshot) => {
      setCards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to Subscriptions
    const qSubs = query(collection(db, 'subscriptions'), where('userId', '==', currentUser.uid));
    const unsubSubs = onSnapshot(qSubs, (snapshot) => {
      setSubscriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubCards();
      unsubSubs();
    };
  }, [currentUser]);

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!newCard.name) return;
    await addDoc(collection(db, 'cards'), { 
        ...newCard, 
        closingDay: parseInt(newCard.closingDay) || ((newCard.dueDay - 7 > 0) ? newCard.dueDay - 7 : 25),
        userId: currentUser.uid 
    });
    setNewCard({ name: '', color: 'bg-blue-600', last4: '', brand: 'Visa', dueDay: 10, closingDay: '' });
    setIsAddingCard(false);
  };

  const handleUpdateCard = async (e) => {
    e.preventDefault();
    if (!newCard.name || !editingCardId) return;
    await updateDoc(doc(db, 'cards', editingCardId), { 
        ...newCard,
        closingDay: parseInt(newCard.closingDay) || ((newCard.dueDay - 7 > 0) ? newCard.dueDay - 7 : 25)
    });
    setNewCard({ name: '', color: 'bg-blue-600', last4: '', brand: 'Visa', dueDay: 10, closingDay: '' });
    setEditingCardId(null);
    setIsAddingCard(false);
  };

  const handleDeleteCard = async (id) => {
    await deleteDoc(doc(db, 'cards', id));
    setDeleteConfirm(null);
  };

  const handleDeleteTransaction = async (id) => {
    await deleteDoc(doc(db, 'transactions', id));
    setDeleteConfirm(null);
  };

  const handleUpdateTransaction = async (e) => {
    e.preventDefault();
    if (!editingTransaction?.description || !editingTransaction?.amount) return;
    
    let formattedDate = editingTransaction.date;
    if (formattedDate && formattedDate.includes('-')) {
        const [y, m, d] = formattedDate.split('-').map(Number);
        const transactionDate = new Date(y, m - 1, d, 12, 0, 0);
        formattedDate = transactionDate.toISOString();
    }

    await updateDoc(doc(db, 'transactions', editingTransaction.id), {
        description: editingTransaction.description,
        amount: parseFloat(editingTransaction.amount),
        category: editingTransaction.category || 'other',
        date: formattedDate
    });
    setEditingTransaction(null);
  };

  const handleUpdateSub = async (e) => {
    e.preventDefault();
    if (!editingSub?.name || !editingSub?.value) return;
    
    let finalDay = editingSub.day;
    if (editingSub.cardId) {
        const linkedCard = cards.find(c => c.id === editingSub.cardId);
        if (linkedCard) finalDay = linkedCard.dueDay;
    }
    
    await updateDoc(doc(db, 'subscriptions', editingSub.id), {
        name: editingSub.name,
        value: parseFloat(editingSub.value),
        day: parseInt(finalDay) || 1,
        category: editingSub.category || 'other',
        cardId: editingSub.cardId || ''
    });
    setEditingSub(null);
  };

  const handleAddSub = async (e) => {
    e.preventDefault();
    if (!newSub.name || !newSub.value) return;
    
    let finalDay = newSub.day;
    if (newSub.cardId) {
        const linkedCard = cards.find(c => c.id === newSub.cardId);
        if (linkedCard) finalDay = linkedCard.dueDay;
    }
    
    await addDoc(collection(db, 'subscriptions'), { 
      ...newSub, 
      day: parseInt(finalDay) || 1,
      value: parseFloat(newSub.value), 
      type: 'recurring',
      userId: currentUser.uid 
    });
    setNewSub({ name: '', value: '', day: 1, cardId: '' });
    setIsAddingSub(false);
  };

  const handleDeleteSub = async (id) => {
    await deleteDoc(doc(db, 'subscriptions', id));
    setDeleteConfirm(null);
  };

  const handlePayInstallment = async (sub, createTransaction = true) => {
    if (!sub) return;
    try {
        const nextInstallment = (sub.currentInstallment || 1) + 1;
        const total = sub.totalInstallments || 1;

        if (createTransaction) {
            // 1. Create Transaction in History
            await addDoc(collection(db, 'transactions'), {
                description: `Parcela ${sub.currentInstallment}/${total} - ${sub.name}`,
                amount: parseFloat(sub.value),
                type: 'expense',
                category: 'other',
                date: new Date().toISOString(),
                userId: currentUser.uid,
                month: new Date().toISOString().slice(0, 7),
                createdAt: Date.now(),
                paymentMethod: 'credito',
                selectedCardId: sub.cardId || null,
                invoiceStatus: sub.cardId ? 'unpaid' : null,
                isInstallmentPayment: true
            });
        }

        // 2. Update or Delete Subscription
        if (nextInstallment > total) {
            await deleteDoc(doc(db, 'subscriptions', sub.id));
        } else {
            await updateDoc(doc(db, 'subscriptions', sub.id), {
                currentInstallment: nextInstallment
            });
        }

        setPayingInstallment(null);
    } catch (err) {
        console.error("Erro ao dar baixa na parcela:", err);
    }
  };

  const handlePayInvoice = async () => {
    if (!payingInvoice || (payingInvoice.expenses.length === 0 && (!payingInvoice.subs || payingInvoice.subs.length === 0))) return;
    
    try {
        const now = new Date();
        const paidMonth = payingInvoice.invoiceMonth; // Uses the computed invoice month

        // 1. Criar transação de pagamento de fatura na carteira (que vai deduzir o saldo)
        await addDoc(collection(db, 'transactions'), {
            description: `Pagamento de Fatura - ${cards.find(c => c.id === payingInvoice.cardId)?.name || 'Cartão'}`,
            amount: payingInvoice.total,
            type: 'expense',
            category: 'credit_card_bill',
            date: now.toISOString(),
            userId: currentUser.uid,
            month: now.toISOString().slice(0, 7), // Calendar month of payment
            invoiceMonthPaid: paidMonth, // Store which invoice was paid
            createdAt: Date.now(),
            paymentMethod: 'pix',
            selectedCardId: payingInvoice.cardId
        });

        // 2. Marcar todas as transações avulsas da fatura como pagas
        const updatePromises = payingInvoice.expenses.map(exp => 
            updateDoc(doc(db, 'transactions', exp.id), { invoiceStatus: 'paid', paidInInvoice: paidMonth })
        );
        await Promise.all(updatePromises);
        
        // 3. Atualizar subscriptions vinculadas ao cartão
        if (payingInvoice.subs && payingInvoice.subs.length > 0) {
            const subPromises = payingInvoice.subs.map(sub => {
                if (sub.type === 'installment') {
                    const nextInstallment = (sub.currentInstallment || 1) + 1;
                    const total = sub.totalInstallments || 1;
                    if (nextInstallment > total) {
                        return deleteDoc(doc(db, 'subscriptions', sub.id));
                    } else {
                        return updateDoc(doc(db, 'subscriptions', sub.id), { currentInstallment: nextInstallment });
                    }
                } else {
                    return updateDoc(doc(db, 'subscriptions', sub.id), { lastPaidMonth: paidMonth });
                }
            });
            await Promise.all(subPromises);
        }
        
        const paidCardId = payingInvoice.cardId;
        setPayingInvoice(null);
        setPaidInvoiceSuccess(paidCardId);
        
        setTimeout(() => {
            setPaidInvoiceSuccess(prev => prev === paidCardId ? null : prev);
        }, 3000);
        
    } catch (err) {
        console.error("Erro ao pagar fatura:", err);
    }
  };

  const getCardSubs = (cardId) => subscriptions.filter(s => s.cardId === cardId);

  const getInvoiceMonth = (dateStr, closingDay) => {
      const d = new Date(dateStr);
      const day = d.getDate();
      let month = d.getMonth();
      let year = d.getFullYear();
      if (day >= closingDay) {
          month += 1;
          if (month > 11) {
              month = 0;
              year += 1;
          }
      }
      return `${year}-${String(month + 1).padStart(2, '0')}`;
  };

  const getUnpaidExpenses = (cardId) => transactions.filter(t => t.selectedCardId === cardId && t.invoiceStatus === 'unpaid');

  const getUnpaidExpensesByPeriod = (card) => {
    const all = getUnpaidExpenses(card.id);
    const closingDay = card.closingDay || ((card.dueDay - 7 > 0) ? card.dueDay - 7 : 25);
    const todayStr = new Date().toISOString();
    const currentInvoiceMonth = getInvoiceMonth(todayStr, closingDay);

    const current = all.filter(t => getInvoiceMonth(t.date || new Date().toISOString(), closingDay) === currentInvoiceMonth);
    const previous = all.filter(t => getInvoiceMonth(t.date || new Date().toISOString(), closingDay) < currentInvoiceMonth);
    
    return { current, previous, all, currentInvoiceMonth, closingDay };
  };

  const getUnlinkedSubs = () => subscriptions.filter(s => !s.cardId);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* SECTION: CARDS */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <CreditCard className="w-6 h-6 text-blue-500" />
            </div>
            <h2 className={`text-xl font-medium tracking-wide uppercase ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Meus Cartões</h2>
          </div>
          <button
            onClick={() => {
              if (isTrial && cards.length >= TRIAL_CARDS_LIMIT) {
                openTrialModal(`Você atingiu o limite de ${TRIAL_CARDS_LIMIT} cartão no período de teste.`);
                return;
              }
              setIsAddingCard(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" /> Novo Cartão
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map(card => {
            const cardSubs = getCardSubs(card.id);
            const { current: currentExpenses, previous: previousExpenses, all: unpaidExpenses, currentInvoiceMonth, closingDay } = getUnpaidExpensesByPeriod(card);
            
            const today = new Date();
            const unpaidSubs = cardSubs.filter(s => {
                if (s.lastPaidMonth === currentInvoiceMonth) return false;
                
                const subDay = parseInt(s.day) || 1;
                // Calculate when this subscription charges this month
                const chargeDateThisMonth = new Date(today.getFullYear(), today.getMonth(), subDay, 12, 0, 0);
                const subInvoiceMonth = getInvoiceMonth(chargeDateThisMonth.toISOString(), closingDay);
                
                // If it charges on a date that falls into a future invoice, don't include it in the current open invoice
                if (subInvoiceMonth > currentInvoiceMonth) return false;
                
                return true;
            });
            const subsTotal = unpaidSubs.reduce((acc, s) => acc + (parseFloat(s.value) || 0), 0);
            const expensesTotal = unpaidExpenses.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
            const totalInvoice = expensesTotal + subsTotal;
            const hasPreviousDebt = previousExpenses.length > 0;
            
            const lastPayment = transactions
              .filter(t => t.category === 'credit_card_bill' && t.description && card.name && t.description.includes(card.name))
              .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

            const currentMonthName = new Date().toLocaleDateString('pt-BR', { month: 'long' });
            
            return (
              <div key={card.id} className={`group relative p-4 rounded-2xl border transition-all duration-500 ${
                theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-[#1e2330] border-slate-800/60 shadow-2xl'
              }`}>
                {/* Visual Card Element */}
                <div className={`w-full aspect-[1.6/1] rounded-3xl p-6 flex flex-col justify-between text-white shadow-2xl relative overflow-hidden transition-transform group-hover:scale-[1.02] duration-500 ${card.color}`}>
                  {/* Card Gloss/Texture Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-50"></div>
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
                  
                  <div className="relative z-10 flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{card.brand}</p>
                      <h3 className="text-xl font-black tracking-tight drop-shadow-md">{card.name}</h3>
                    </div>
                    <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl">
                        <CreditCard className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="relative z-10 flex justify-between items-end">
                    <div className="space-y-1.5">
                        <p className="font-mono text-sm tracking-[0.25em] drop-shadow-sm">•••• {card.last4 || '0000'}</p>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black uppercase opacity-60 bg-black/20 px-2 py-0.5 rounded-full">Vencimento</span>
                                <span className="text-xs font-bold">Dia {card.dueDay}</span>
                            </div>
                            {lastPayment && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-black uppercase opacity-60 bg-emerald-500/20 px-2 py-0.5 rounded-full text-emerald-200">Último Pago</span>
                                    <span className="text-[10px] font-bold">{new Date(lastPayment.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase font-black opacity-60 mb-0.5">Fatura de {new Date(currentInvoiceMonth + '-15').toLocaleDateString('pt-BR', { month: 'long' })}</p>
                      <p className="text-xl font-black tabular-nums">R$ {totalInvoice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>

                {/* Fatura Actions */}
                <div className="mt-4 px-2 flex flex-col gap-2">
                    {/* Aviso de dívida de meses anteriores */}
                    {hasPreviousDebt && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">⚠ Inclui fatura(s) anterior(es) não paga(s)</span>
                      </div>
                    )}
                    <button 
                        onClick={() => totalInvoice > 0 && setPayingInvoice({ cardId: card.id, total: totalInvoice, expenses: unpaidExpenses, subs: unpaidSubs, invoiceMonth: currentInvoiceMonth })}
                        disabled={totalInvoice === 0}
                        className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                            totalInvoice > 0 
                            ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20 hover:bg-rose-600' 
                            : (theme === 'light' ? 'bg-slate-100 text-slate-450 border border-slate-200/60' : 'bg-white/5 text-slate-500 border border-white/5')
                        }`}
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        {totalInvoice > 0 ? 'Pagar Fatura' : 'Fatura Zerada'}
                    </button>

                    <button 
                        onClick={() => setViewingInvoiceCardId(card.id)}
                        className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border ${
                            theme === 'light' 
                            ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' 
                            : 'bg-slate-800/40 border-white/10 text-white hover:bg-slate-800'
                        }`}
                    >
                        <Eye className="w-4 h-4" />
                        Ver Fatura do Cartão
                    </button>
                </div>

                {/* Action Buttons (Repositioned to avoid overlap) */}
                <div className="absolute top-2 right-8 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 md:translate-y-2 md:group-hover:translate-y-0 z-20">
                    <button 
                    onClick={() => {
                        setEditingCardId(card.id);
                        setNewCard({ name: card.name, color: card.color, last4: card.last4, brand: card.brand, dueDay: card.dueDay || 10, closingDay: card.closingDay || '' });
                        setIsAddingCard(true);
                    }}
                    className="p-2.5 bg-white/20 hover:bg-white/40 text-white rounded-xl shadow-2xl backdrop-blur-md border border-white/20 transition-colors"
                    >
                    <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                    onClick={() => setDeleteConfirm({ id: card.id, type: 'card', title: card.name })}
                    className="p-2.5 bg-rose-500/80 hover:bg-rose-500 text-white rounded-xl shadow-2xl backdrop-blur-md transition-colors"
                    >
                    <Trash2 className="w-4 h-4" />
                    </button>
                </div>
              </div>
            );
          })}

          {/* ORPHANED CREDIT CARD TRANSACTIONS */}
          {(() => {
            const activeCardIds = cards.map(c => c.id);
            const orphanedExpenses = transactions.filter(t => t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid' && (!t.selectedCardId || !activeCardIds.includes(t.selectedCardId)));
            const orphanedSubs = subscriptions.filter(s => s.isInstallment && (!s.cardId || !activeCardIds.includes(s.cardId)));
            
            if (orphanedExpenses.length === 0 && orphanedSubs.length === 0) return null;
            
            const subsTotal = orphanedSubs.reduce((acc, s) => acc + s.value, 0);
            const expensesTotal = orphanedExpenses.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
            const totalInvoice = expensesTotal + subsTotal;

            return (
              <div key="orphaned" className={`group relative p-4 rounded-2xl border transition-all duration-500 border-rose-500/30 ${
                theme === 'light' ? 'bg-white shadow-sm' : 'bg-[#1e2330] shadow-2xl'
              }`}>
                {/* Visual Card Element */}
                <div className="w-full aspect-[1.6/1] rounded-3xl p-6 flex flex-col justify-between text-white shadow-2xl relative overflow-hidden transition-transform group-hover:scale-[1.02] duration-500 bg-slate-800">
                  <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/20 to-transparent opacity-50"></div>
                  
                  <div className="relative z-10 flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 text-rose-400">Atenção</p>
                      <h3 className="text-xl font-black tracking-tight drop-shadow-md text-rose-500">Cartão Excluído</h3>
                    </div>
                    <AlertCircle className="w-6 h-6 text-rose-500 opacity-80" />
                  </div>
                  
                  <div className="relative z-10">
                    <p className="text-[9px] uppercase font-black opacity-60 mb-0.5">Total Pendente</p>
                    <p className="text-xl font-black tabular-nums text-rose-500">R$ {totalInvoice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                {/* Orphaned Fatura Actions */}
                <div className="mt-4 px-2">
                    <button 
                        onClick={() => setViewingInvoiceCardId('orphaned')}
                        className={`w-full py-3.5 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
                            theme === 'light' 
                            ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' 
                            : 'bg-slate-800/40 border-white/10 text-white hover:bg-slate-800'
                        }`}
                    >
                        <Eye className="w-4 h-4" />
                        Ver Lançamentos Órfãos
                    </button>
                </div>
              </div>
            );
          })()}

          {cards.length === 0 && !isAddingCard && (
            <div className={`aspect-[1.6/1] md:aspect-auto rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-8 opacity-40 hover:opacity-100 transition-all cursor-pointer ${
              theme === 'light' ? 'border-slate-200 text-slate-400' : 'border-slate-700 text-slate-500'
            }`} onClick={() => {
              if (isTrial && cards.length >= TRIAL_CARDS_LIMIT) { openTrialModal(`Você atingiu o limite de ${TRIAL_CARDS_LIMIT} cartão no período de teste.`); return; }
              setIsAddingCard(true);
            }}>
              <CreditCard className="w-10 h-10 mb-3" />
              <p className="font-bold">Cadastrar Primeiro Cartão</p>
            </div>
          )}
        </div>
      </section>

      {/* SECTION: ASSINATURAS AVULSAS */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-xl">
              <Calendar className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h2 className={`text-xl font-medium tracking-wide uppercase ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Assinaturas Avulsas</h2>
              {subscriptions.filter(s => s.type !== 'installment').length > 0 && (
                <p className="text-[10px] font-bold text-purple-500 mt-0.5">
                  Total mensal: R$ {subscriptions.filter(s => s.type !== 'installment').reduce((acc, s) => acc + (parseFloat(s.value) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • {subscriptions.filter(s => s.type !== 'installment').length} {subscriptions.filter(s => s.type !== 'installment').length === 1 ? 'assinatura' : 'assinaturas'}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              if (isTrial && subscriptions.length >= TRIAL_SUBS_LIMIT) {
                openTrialModal(`Você atingiu o limite de ${TRIAL_SUBS_LIMIT} assinaturas no período de teste.`);
                return;
              }
              setIsAddingSub(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-500 text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-purple-600 transition-all shadow-lg shadow-purple-500/20"
          >
            <Plus className="w-4 h-4" /> Nova Assinatura
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {subscriptions.filter(s => s.type !== 'installment').map(sub => {
            const linkedCard = cards.find(c => c.id === sub.cardId);
            return (
              <div key={sub.id} className={`p-5 rounded-2xl border group relative transition-all hover:shadow-xl hover:-translate-y-1 ${
                theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-[#1e2330] border-slate-800/60'
              }`}>
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center">
                    <Tag className="w-6 h-6 text-purple-500" />
                  </div>
                  <div className="flex opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                    <button onClick={() => setEditingSub({ id: sub.id, name: sub.name, value: sub.value, day: sub.day, category: sub.category || 'other' })} className={`p-2 rounded-lg transition-colors mr-1 ${
                      theme === 'light' ? 'hover:bg-slate-100 text-slate-400 hover:text-emerald-600' : 'hover:bg-white/5 text-slate-500 hover:text-emerald-400'
                    }`}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteConfirm({ id: sub.id, type: 'sub', title: sub.name })} className={`p-2 rounded-lg transition-colors ${
                      theme === 'light' ? 'hover:bg-slate-100 text-slate-400 hover:text-rose-600' : 'hover:bg-white/5 text-slate-500 hover:text-rose-400'
                    }`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Delete overlay for Subscription */}
                {deleteConfirm?.id === sub.id && deleteConfirm?.type === 'sub' && (
                    <div className={`absolute inset-0 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-6 text-center z-50 animate-in fade-in duration-300 ${
                        theme === 'light' ? 'bg-white/95 border border-slate-100' : 'bg-slate-950/95'
                    }`}>
                        <div className="max-w-[200px] w-full">
                            <Trash2 className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                            <p className={`font-bold text-sm mb-6 leading-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Excluir {sub.name}?</p>
                            <div className="flex gap-2">
                                <button onClick={() => setDeleteConfirm(null)} className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
                                    theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/10 text-white hover:bg-white/20'
                                }`}>Não</button>
                                <button onClick={() => handleDeleteSub(sub.id)} className="flex-1 py-2 rounded-lg bg-rose-500 text-white font-bold text-xs uppercase tracking-wider hover:bg-rose-600 transition-all">Sim</button>
                            </div>
                        </div>
                    </div>
                )}
                <div className="space-y-1">
                  <h4 className={`font-bold text-base ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{sub.name}</h4>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> {linkedCard ? `Na Fatura (Vence dia ${linkedCard.dueDay})` : `Vence dia ${sub.day}`}
                  </p>
                </div>
                <div className="mt-6 pt-5 border-t border-white/5 flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Valor Mensal</p>
                    <span className="text-lg font-bold text-emerald-500 tabular-nums">R$ {sub.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {linkedCard ? (
                    <span className={`text-[9px] font-bold px-3 py-1.5 rounded-xl ${linkedCard.color} text-white shadow-lg shadow-black/20`}>
                      {linkedCard.name}
                    </span>
                  ) : (
                    <span className={`text-[9px] font-bold px-3 py-1.5 rounded-xl ${theme === 'light' ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-500 border border-white/5'}`}>
                      Sem Cartão
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {subscriptions.filter(s => s.type !== 'installment').length === 0 && (
            <div className={`col-span-full py-12 text-center rounded-2xl border-2 border-dashed ${theme === 'light' ? 'border-slate-100 text-slate-400' : 'border-white/5 text-slate-600'}`}>
              <p className="text-xs font-bold uppercase tracking-widest">Nenhuma assinatura avulsa cadastrada.</p>
            </div>
          )}
        </div>
      </section>

      {/* SECTION: PARCELAMENTOS */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-rose-500/10 rounded-xl">
            <Hash className="w-6 h-6 text-rose-500" />
          </div>
          <div>
            <h2 className={`text-xl font-medium tracking-wide uppercase ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Parcelamentos Ativos</h2>
            {subscriptions.filter(s => s.type === 'installment').length > 0 && (
              <p className="text-[10px] font-bold text-rose-500 mt-0.5">
                Total mensal: R$ {subscriptions.filter(s => s.type === 'installment').reduce((acc, s) => acc + (parseFloat(s.value) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • {subscriptions.filter(s => s.type === 'installment').length} {subscriptions.filter(s => s.type === 'installment').length === 1 ? 'parcelamento' : 'parcelamentos'}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {subscriptions.filter(s => s.type === 'installment').map(sub => {
            const linkedCard = cards.find(c => c.id === sub.cardId);
            const remaining = (sub.totalInstallments || 0) - (sub.currentInstallment || 0) + 1;
            const progress = ((sub.currentInstallment || 1) / (sub.totalInstallments || 1)) * 100;
            return (
              <div key={sub.id} className={`p-5 rounded-2xl border group relative transition-all hover:shadow-xl hover:-translate-y-1 ${
                theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-[#1e2330] border-slate-800/60'
              }`}>
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center">
                    <Hash className="w-6 h-6 text-rose-500" />
                  </div>
                  <div className="flex opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                    <button onClick={() => setEditingSub({ id: sub.id, name: sub.name, value: sub.value, day: sub.day, category: sub.category || 'other' })} className={`p-2 rounded-lg transition-colors mr-1 ${
                      theme === 'light' ? 'hover:bg-slate-100 text-slate-400 hover:text-emerald-600' : 'hover:bg-white/5 text-slate-500 hover:text-emerald-400'
                    }`}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteConfirm({ id: sub.id, type: 'sub', title: sub.name })} className={`p-2 rounded-lg transition-colors ${
                      theme === 'light' ? 'hover:bg-slate-100 text-slate-400 hover:text-rose-600' : 'hover:bg-white/5 text-slate-500 hover:text-rose-400'
                    }`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Delete overlay for Installment */}
                {deleteConfirm?.id === sub.id && deleteConfirm?.type === 'sub' && (
                    <div className={`absolute inset-0 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-6 text-center z-50 animate-in fade-in duration-300 ${
                        theme === 'light' ? 'bg-white/95 border border-slate-100' : 'bg-slate-950/95'
                    }`}>
                        <div className="max-w-[200px] w-full">
                            <Trash2 className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                            <p className={`font-bold text-sm mb-6 leading-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Excluir {sub.name}?</p>
                            <div className="flex gap-2">
                                <button onClick={() => setDeleteConfirm(null)} className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
                                    theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/10 text-white hover:bg-white/20'
                                }`}>Não</button>
                                <button onClick={() => handleDeleteSub(sub.id)} className="flex-1 py-2 rounded-lg bg-rose-500 text-white font-bold text-xs uppercase tracking-wider hover:bg-rose-600 transition-all">Sim</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-1">
                  <h4 className={`font-bold text-base ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{sub.name}</h4>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      Parcela {sub.currentInstallment} de {sub.totalInstallments}
                    </p>
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider bg-rose-500/10 px-2 py-0.5 rounded-full">
                      Faltam {remaining}
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-1.5 bg-slate-500/10 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="h-full bg-rose-500 transition-all duration-1000" 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>

                  {!sub.cardId && (
                    <button 
                      onClick={() => setPayingInstallment(sub)}
                      className={`w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                          theme === 'light' 
                          ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-100 shadow-sm' 
                          : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 shadow-xl'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Dar Baixa na Parcela
                    </button>
                  )}
                </div>

                {/* Confirmation Overlay for Payment */}
                {payingInstallment?.id === sub.id && (
                    <div className={`absolute inset-0 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-6 text-center z-50 animate-in fade-in duration-300 ${
                        theme === 'light' ? 'bg-white/95 border border-slate-100' : 'bg-slate-950/95'
                    }`}>
                        <div className="max-w-[220px] w-full space-y-4">
                            <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                            </div>
                            <h4 className={`text-base font-bold uppercase tracking-wider ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Confirmar Pagamento</h4>
                            <p className={`text-[11px] leading-relaxed mb-4 ${theme === 'light' ? 'text-slate-655 text-slate-600' : 'text-white/60'}`}>
                                Dar baixa na parcela <span className="text-emerald-500 font-bold">{sub.currentInstallment}/{sub.totalInstallments}</span> de <span className={`font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{sub.name}</span>?
                            </p>
                            <div className="flex flex-col gap-2 pt-2">
                                <button onClick={() => handlePayInstallment(sub, true)} className="w-full py-2 rounded-lg bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-colors">
                                    Sim, criar saída (R$ {sub.value.toLocaleString('pt-BR')})
                                </button>
                                <button onClick={() => handlePayInstallment(sub, false)} className={`w-full py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors ${
                                    theme === 'light' ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100/50' : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/10'
                                }`}>
                                    Avançar parcela (Já lancei fatura)
                                </button>
                                <button onClick={() => setPayingInstallment(null)} className={`w-full py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
                                    theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/10 text-white hover:bg-white/20'
                                }`}>Cancelar</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-6 pt-5 border-t border-white/5 flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Valor Parcela</p>
                    <span className="text-lg font-bold text-rose-500 tabular-nums">R$ {sub.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {linkedCard && (
                    <span className={`text-[9px] font-bold px-3 py-1.5 rounded-xl ${linkedCard.color} text-white shadow-lg shadow-black/20`}>
                      {linkedCard.name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {subscriptions.filter(s => s.type === 'installment').length === 0 && (
            <div className={`col-span-full py-12 text-center rounded-2xl border-2 border-dashed ${theme === 'light' ? 'border-slate-100 text-slate-400' : 'border-white/5 text-slate-600'}`}>
              <p className="text-xs font-bold uppercase tracking-widest">Nenhum parcelamento ativo.</p>
            </div>
          )}
        </div>
      </section>

      {/* MODAL: ADD CARD */}
      {isAddingCard && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <form onSubmit={editingCardId ? handleUpdateCard : handleAddCard} className={`border rounded-2xl w-full max-w-sm p-6 space-y-4 relative animate-in zoom-in-95 duration-300 shadow-2xl ${
            theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
          }`}>
            <button
              type="button"
              onClick={() => {
                setIsAddingCard(false);
                setEditingCardId(null);
                setNewCard({ name: '', color: 'bg-blue-600', last4: '', brand: 'Visa', dueDay: 10 });
              }}
              className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors ${
                theme === 'light' ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/10 text-slate-500'
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-1">
              <div className={`p-2 rounded-xl shrink-0 ${theme === 'light' ? 'bg-emerald-50' : 'bg-emerald-500/10'}`}>
                <CreditCard className={`w-5 h-5 ${theme === 'light' ? 'text-emerald-500' : 'text-emerald-400'}`} />
              </div>
              <div>
                <h3 className={`text-base font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                  {editingCardId ? 'Editar Cartão' : 'Novo Cartão'}
                </h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  Cadastre seus cartões de crédito
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Nome do Cartão</label>
                <input
                  type="text"
                  placeholder="ex: Nubank, Inter"
                  required
                  value={newCard.name}
                  onChange={(e) => setNewCard({...newCard, name: e.target.value})}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                    theme === 'light' ? 'bg-slate-50 border-slate-100 focus:border-emerald-500 text-slate-800' : 'bg-white/5 border-white/5 focus:border-emerald-500 text-white placeholder-slate-500'
                  }`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Final (4 Dígitos)</label>
                  <input
                    type="text"
                    placeholder="ex: 1234"
                    maxLength={4}
                    value={newCard.last4}
                    onChange={(e) => setNewCard({...newCard, last4: e.target.value})}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                      theme === 'light' ? 'bg-slate-50 border-slate-100 focus:border-emerald-500 text-slate-800' : 'bg-white/5 border-white/5 focus:border-emerald-500 text-white placeholder-slate-500'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Vencimento (Dia)</label>
                  <input
                    type="number"
                    placeholder="1-31"
                    min={1}
                    max={31}
                    value={newCard.dueDay}
                    onChange={(e) => setNewCard({...newCard, dueDay: parseInt(e.target.value)})}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                      theme === 'light' ? 'bg-slate-50 border-slate-100 focus:border-emerald-500 text-slate-800' : 'bg-white/5 border-white/5 focus:border-emerald-500 text-white placeholder-slate-500'
                    }`}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Data de Fechamento</label>
                <input
                  type="number"
                  placeholder="Melhor dia para compra (ex: 8)"
                  min={1}
                  max={31}
                  value={newCard.closingDay}
                  onChange={(e) => setNewCard({...newCard, closingDay: e.target.value})}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                    theme === 'light' ? 'bg-slate-50 border-slate-100 focus:border-emerald-500 text-slate-800' : 'bg-white/5 border-white/5 focus:border-emerald-500 text-white placeholder-slate-500'
                  }`}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Bandeira</label>
                <select
                  value={newCard.brand}
                  onChange={(e) => setNewCard({...newCard, brand: e.target.value})}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none appearance-none transition-all ${
                    theme === 'light' ? 'bg-slate-50 border-slate-100 focus:border-emerald-500 text-slate-800' : 'bg-white/5 border-white/5 focus:border-emerald-500 text-white'
                  }`}
                >
                  <option value="Visa" className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>Visa</option>
                  <option value="Mastercard" className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>Mastercard</option>
                  <option value="Elo" className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>Elo</option>
                  <option value="Amex" className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>Amex</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Cor de Identificação</label>
                <div className="grid grid-cols-5 gap-2">
                  {['bg-blue-600', 'bg-purple-600', 'bg-emerald-600', 'bg-rose-600', 'bg-slate-800'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCard({...newCard, color})}
                      className={`w-full aspect-square rounded-xl transition-all ${color} ${newCard.color === color ? 'ring-4 ring-white/50 scale-110' : ''}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => {
                setIsAddingCard(false);
                setEditingCardId(null);
                setNewCard({ name: '', color: 'bg-blue-600', last4: '', brand: 'Visa', dueDay: 10 });
              }} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>Cancelar</button>
              <button type="submit" className="flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] bg-emerald-500 hover:bg-emerald-600 transition-all text-white shadow-lg shadow-emerald-500/20 active:scale-95">
                {editingCardId ? 'Salvar Alterações' : 'Salvar Cartão'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADD SUB */}
      {isAddingSub && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <form onSubmit={handleAddSub} className={`border rounded-2xl w-full max-w-sm p-6 space-y-4 relative animate-in zoom-in-95 duration-300 shadow-2xl ${
            theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
          }`}>
            <button
              type="button"
              onClick={() => setIsAddingSub(false)}
              className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors ${
                theme === 'light' ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/10 text-slate-500'
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-1">
              <div className={`p-2 rounded-xl shrink-0 ${theme === 'light' ? 'bg-purple-50' : 'bg-purple-500/10'}`}>
                <Plus className={`w-5 h-5 ${theme === 'light' ? 'text-purple-500' : 'text-purple-400'}`} />
              </div>
              <div>
                <h3 className={`text-base font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                  Nova Assinatura
                </h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  Cadastre um novo serviço ou parcelamento
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Nome do Serviço</label>
                <input
                  type="text"
                  placeholder="ex: Netflix, Academia"
                  required
                  value={newSub.name}
                  onChange={(e) => setNewSub({...newSub, name: e.target.value})}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                    theme === 'light' ? 'bg-slate-50 border-slate-100 focus:border-purple-500 text-slate-800' : 'bg-white/5 border-white/5 focus:border-purple-500 text-white placeholder-slate-500'
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
                    value={newSub.value}
                    onChange={(e) => setNewSub({...newSub, value: e.target.value})}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                      theme === 'light' ? 'bg-slate-50 border-slate-100 focus:border-purple-500 text-slate-800' : 'bg-white/5 border-white/5 focus:border-purple-500 text-white placeholder-slate-500'
                    }`}
                  />
                </div>
                {!newSub.cardId && (
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Dia da Cobrança</label>
                    <input
                      type="number"
                      placeholder="1-31"
                      min={1} max={31}
                      required={!newSub.cardId}
                      value={newSub.day}
                      onChange={(e) => setNewSub({...newSub, day: e.target.value})}
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                        theme === 'light' ? 'bg-slate-50 border-slate-100 focus:border-purple-500 text-slate-800' : 'bg-white/5 border-white/5 focus:border-purple-500 text-white placeholder-slate-500'
                      }`}
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Vincular Cartão</label>
                <select
                  value={newSub.cardId}
                  onChange={(e) => setNewSub({...newSub, cardId: e.target.value})}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none appearance-none transition-all ${
                    theme === 'light' ? 'bg-slate-50 border-slate-100 focus:border-purple-500 text-slate-800' : 'bg-white/5 border-white/5 focus:border-purple-500 text-white'
                  }`}
                >
                  <option value="" className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>Sem cartão (Avulsa)</option>
                  {cards.map(c => (
                    <option key={c.id} value={c.id} className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>{c.name} (•• {c.last4})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIsAddingSub(false)} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>Cancelar</button>
              <button type="submit" className="flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] bg-purple-500 hover:bg-purple-600 transition-all text-white shadow-lg shadow-purple-500/20 active:scale-95">Salvar Assinatura</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: VIEW INVOICE ITEMS */}
      {viewingInvoiceCardId && (() => {
          const isOrphaned = viewingInvoiceCardId === 'orphaned';
          const card = isOrphaned 
            ? { name: 'Cartão Excluído', color: 'bg-slate-850', brand: 'Desconhecido', last4: '0000' }
            : cards.find(c => c.id === viewingInvoiceCardId);

          if (!card) return null;

          const allCardSubs = isOrphaned 
            ? subscriptions.filter(s => s.isInstallment && (!s.cardId || !cards.map(c => c.id).includes(s.cardId)))
            : getCardSubs(card.id);

          // Subscriptions: só entrar na fatura se o dia de vencimento já chegou
          const todayDay = new Date().getDate();
          const currentMonthKey = new Date().toISOString().slice(0, 7);
          const cardSubs = isOrphaned
            ? allCardSubs
            : allCardSubs.filter(s => {
                if (s.lastPaidMonth === currentMonthKey) return false;
                const dueDay = parseInt(s.day) || 1;
                return todayDay >= dueDay;
              });

          const unpaidExpenses = isOrphaned
            ? transactions.filter(t => t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid' && (!t.selectedCardId || !cards.map(c => c.id).includes(t.selectedCardId)))
            : getUnpaidExpenses(card.id);

          const totalInvoice = unpaidExpenses.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0) + cardSubs.reduce((acc, s) => acc + s.value, 0);

          return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className={`border rounded-[3rem] w-full max-w-lg p-8 md:p-10 space-y-6 relative max-h-[90vh] flex flex-col justify-between animate-in zoom-in-95 duration-300 ${
                theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
              }`}>
                {/* Close Button */}
                <button 
                  onClick={() => setViewingInvoiceCardId(null)}
                  className={`absolute top-6 right-6 p-2 rounded-xl transition-colors z-[10] ${
                    theme === 'light' ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/10 text-slate-500'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div className="space-y-1 pr-8">
                  <span className={`text-[9px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded-md text-white ${card.color}`}>
                    {card.brand} •••• {card.last4}
                  </span>
                  <h3 className={`text-2xl font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                    Fatura do {card.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                    {unpaidExpenses.length + cardSubs.length} itens lançados • Total: <span className="text-rose-500 font-bold">R$ {totalInvoice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </p>
                </div>

                {/* Content Area - Scrollable */}
                <div className="flex-1 overflow-y-auto pr-1 my-4 space-y-3 max-h-[50vh] scrollbar-thin">
                  {unpaidExpenses.length === 0 && cardSubs.length === 0 ? (
                    <div className="py-12 text-center text-sm text-slate-500 font-medium">
                      Nenhum item lançado nesta fatura.
                    </div>
                  ) : (
                    <>
                      {/* Gastos Avulsos */}
                      {unpaidExpenses.map(exp => {
                        const catDef = CATEGORIES.expense.find(c => c.id === exp.category) || { icon: ShoppingBag, color: 'text-rose-500' };
                        const Icon = catDef.icon;
                        return (
                          <div key={exp.id} className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                            theme === 'light' 
                            ? 'bg-slate-50 border-slate-100 hover:bg-slate-100/80 hover:border-slate-200' 
                            : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                          }`}>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                                <Icon className={`w-4.5 h-4.5 ${catDef.color}`} />
                              </div>
                              <div>
                                <p className={`text-[13px] font-semibold leading-tight ${theme === 'light' ? 'text-slate-700' : 'text-white'}`}>{exp.description}</p>
                                <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">
                                  {new Date(exp.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-rose-500">
                                R$ {parseFloat(exp.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              <div className="flex gap-0.5">
                                <button 
                                  onClick={() => {
                                    const d = new Date(exp.date);
                                    const formattedDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                                    setEditingTransaction({
                                      id: exp.id,
                                      description: exp.description,
                                      amount: exp.amount,
                                      category: exp.category || 'other',
                                      date: formattedDate
                                    });
                                  }}
                                  className={`p-2 rounded-lg transition-colors ${
                                    theme === 'light' ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-600' : 'hover:bg-white/5 text-slate-500 hover:text-slate-300'
                                  }`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => setDeleteConfirm({ id: exp.id, type: 'transaction', title: exp.description, cardId: viewingInvoiceCardId })}
                                  className={`p-2 rounded-lg transition-colors ${
                                    theme === 'light' ? 'hover:bg-slate-100 text-slate-400 hover:text-rose-600' : 'hover:bg-white/5 text-slate-500 hover:text-rose-400'
                                  }`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Assinaturas e Parcelas */}
                      {cardSubs.map(sub => {
                        const catDef = CATEGORIES.expense.find(c => c.id === sub.category) || { icon: Tag, color: 'text-blue-500' };
                        const Icon = catDef.icon;
                        const isInstallment = sub.type === 'installment';
                        const bgClass = isInstallment ? 'bg-slate-500/10' : 'bg-blue-500/10';
                        return (
                          <div key={sub.id} className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                            theme === 'light' ? 'bg-slate-50 border-slate-100 hover:bg-slate-100/80 hover:border-slate-200' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                          }`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl ${bgClass} flex items-center justify-center shrink-0`}>
                                <Icon className={`w-4.5 h-4.5 ${catDef.color}`} />
                              </div>
                              <div>
                                <p className={`text-[13px] font-semibold leading-tight ${theme === 'light' ? 'text-slate-700' : 'text-white'}`}>{sub.name}</p>
                                <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">
                                  {isInstallment ? `Parcela ${sub.currentInstallment}/${sub.totalInstallments}` : 'Assinatura'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-rose-500">
                                R$ {sub.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              <div className="flex gap-0.5">
                                <button 
                                  onClick={() => setEditingSub({ id: sub.id, name: sub.name, value: sub.value, day: sub.day, category: sub.category || 'other' })}
                                  className={`p-2 rounded-lg transition-colors ${
                                    theme === 'light' ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-600' : 'hover:bg-white/10 text-slate-500 hover:text-slate-300'
                                  }`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                {isOrphaned && (
                                  <button 
                                    onClick={() => setDeleteConfirm({ id: sub.id, type: 'sub', title: sub.name, cardId: 'orphaned' })}
                                    className={`p-2 rounded-lg transition-colors ${
                                      theme === 'light' ? 'hover:bg-slate-100 text-slate-400 hover:text-rose-600' : 'hover:bg-white/5 text-slate-500 hover:text-rose-400'
                                    }`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-slate-700/10 flex gap-3">
                  <button 
                    onClick={() => setViewingInvoiceCardId(null)} 
                    className={`flex-1 py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${
                      theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    Fechar
                  </button>
                  {!isOrphaned && totalInvoice > 0 && (
                    <button 
                      onClick={() => {
                        setViewingInvoiceCardId(null);
                        setPayingInvoice({ cardId: card.id, total: totalInvoice, expenses: unpaidExpenses, subs: cardSubs });
                      }}
                      className="flex-1 py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 transition-all"
                    >
                      Pagar Fatura
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
      })()}

      {/* Trial Limit Modal */}
      <TrialLimitModal
        isOpen={showTrialModal}
        onClose={() => setShowTrialModal(false)}
        limitMessage={trialModalMsg}
      />

      {/* MODAL: DELETE CONFIRMATION (CARD) */}
      {deleteConfirm && deleteConfirm.type === 'card' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[220] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`border rounded-[3rem] w-full max-w-sm p-8 space-y-6 animate-in zoom-in-95 duration-300 ${
            theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
          }`}>
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <Trash2 className="w-8 h-8 text-rose-500" />
            </div>
            <h4 className={`text-2xl font-bold text-center ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Excluir Cartão?</h4>
            <p className={`text-xs leading-relaxed text-center ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
              Você está removendo o cartão <span className={`font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{deleteConfirm.title}</span>. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setDeleteConfirm(null)} className={`flex-1 py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${
                theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}>Voltar</button>
              <button onClick={() => handleDeleteCard(deleteConfirm.id)} className="flex-1 py-3.5 rounded-xl bg-rose-500 text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION (TRANSACTION/SUB) */}
      {deleteConfirm && (deleteConfirm.type === 'transaction' || deleteConfirm.type === 'sub') && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[220] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`border rounded-[3rem] w-full max-w-sm p-8 space-y-6 animate-in zoom-in-95 duration-300 ${
            theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
          }`}>
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <Trash2 className="w-8 h-8 text-rose-500" />
            </div>
            <h4 className={`text-2xl font-bold text-center ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Excluir Item?</h4>
            <p className={`text-xs leading-relaxed text-center ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
              Remover <span className={`font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{deleteConfirm.title}</span> da fatura?
            </p>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setDeleteConfirm(null)} className={`flex-1 py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${
                theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}>Voltar</button>
              <button onClick={() => {
                if (deleteConfirm.type === 'transaction') {
                  handleDeleteTransaction(deleteConfirm.id);
                } else {
                  handleDeleteSub(deleteConfirm.id);
                }
              }} className="flex-1 py-3.5 rounded-xl bg-rose-500 text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PAY INVOICE */}
      {payingInvoice && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[220] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`border rounded-[3rem] w-full max-w-sm p-8 space-y-6 animate-in zoom-in-95 duration-300 ${
            theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
          }`}>
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <DollarSign className="w-8 h-8 text-rose-500" />
            </div>
            <h4 className={`text-2xl font-bold text-center ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Pagar Fatura</h4>
            <p className={`text-xs leading-relaxed text-center ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
              Você vai debitar <span className="text-rose-500 font-bold">R$ {payingInvoice.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> do seu saldo principal para pagar a fatura do cartão <span className={`font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{cards.find(c => c.id === payingInvoice.cardId)?.name || 'Cartão'}</span>. Confirmar?
            </p>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setPayingInvoice(null)} className={`flex-1 py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${
                theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}>Voltar</button>
              <button onClick={handlePayInvoice} className="flex-1 py-3.5 rounded-xl bg-rose-500 text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all">Pagar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INVOICE PAID SUCCESS */}
      {paidInvoiceSuccess && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[220] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
          <div className={`border rounded-[3rem] w-full max-w-sm p-8 space-y-6 animate-in zoom-in-95 duration-300 ${
            theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
          }`}>
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h4 className={`text-2xl font-bold text-center ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Fatura Paga!</h4>
            <p className={`text-xs leading-relaxed text-center ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
              A fatura do cartão <span className="font-bold text-emerald-500">{cards.find(c => c.id === paidInvoiceSuccess)?.name || 'Cartão'}</span> foi paga com sucesso e o saldo foi debitado.
            </p>
            <div className="flex pt-4">
              <button onClick={() => setPaidInvoiceSuccess(null)} className="flex-1 py-3.5 rounded-xl bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all">
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT TRANSACTION */}
      {editingTransaction && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <form onSubmit={handleUpdateTransaction} className={`border rounded-[3rem] w-full max-w-sm p-8 space-y-6 animate-in zoom-in-95 duration-300 ${
            theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl shadow-emerald-500/10'
          }`}>
            <h3 className={`text-xl font-bold tracking-wide uppercase ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Editar Gasto</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Descrição"
                required
                value={editingTransaction.description}
                onChange={(e) => setEditingTransaction({...editingTransaction, description: e.target.value})}
                className={`w-full p-4 rounded-2xl border font-bold text-sm transition-all ${
                  theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-100 text-slate-800' : 'bg-white/5 focus:bg-white/10 border-white/5 text-white'
                }`}
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Valor R$"
                  required
                  value={editingTransaction.amount}
                  onChange={(e) => setEditingTransaction({...editingTransaction, amount: e.target.value})}
                  className={`w-full p-4 rounded-2xl border font-bold text-sm transition-all ${
                    theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-100 text-slate-800' : 'bg-white/5 focus:bg-white/10 border-white/5 text-white'
                  }`}
                />
                <input
                  type="date"
                  required
                  value={editingTransaction.date}
                  onChange={(e) => setEditingTransaction({...editingTransaction, date: e.target.value})}
                  className={`w-full p-4 rounded-2xl border font-bold text-sm transition-all ${
                    theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-100 text-slate-800 [color-scheme:light]' : 'bg-white/5 focus:bg-white/10 border-white/5 text-white [color-scheme:dark]'
                  }`}
                />
              </div>
              <select
                required
                value={editingTransaction.category || 'other'}
                onChange={(e) => setEditingTransaction({...editingTransaction, category: e.target.value})}
                className={`w-full p-4 rounded-2xl border font-bold text-sm transition-all outline-none appearance-none cursor-pointer ${
                  theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-100 text-slate-800' : 'bg-white/5 focus:bg-white/10 border-white/5 text-white'
                }`}
              >
                  {CATEGORIES.expense.map(cat => (
                      <option key={cat.id} value={cat.id} className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>{cat.label}</option>
                  ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditingTransaction(null)} className={`flex-1 py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>Cancelar</button>
              <button type="submit" className="flex-1 py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">Salvar Alterações</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EDIT SUB */}
      {editingSub && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <form onSubmit={handleUpdateSub} className={`border rounded-[3rem] w-full max-w-sm p-8 space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl ${
            theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/10 shadow-purple-500/10'
          }`}>
            <div className="text-center space-y-2 mb-6">
              <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-purple-500/20">
                <Repeat className="w-8 h-8 text-purple-500" />
              </div>
              <h3 className={`text-xl font-medium uppercase tracking-widest ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                  Editar Assinatura
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Ajuste os dados da cobrança recorrente
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Nome da Assinatura</label>
                <input
                  type="text"
                  placeholder="ex: Netflix, Spotify"
                  required
                  value={editingSub.name}
                  onChange={(e) => setEditingSub({...editingSub, name: e.target.value})}
                  className={`w-full p-4 rounded-2xl border transition-all text-sm font-bold ${
                    theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-100 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-slate-800' : 'bg-slate-800/50 focus:bg-slate-800 border-white/5 focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 text-white placeholder-slate-500'
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
                    value={editingSub.value}
                    onChange={(e) => setEditingSub({...editingSub, value: e.target.value})}
                    className={`w-full p-4 rounded-2xl border transition-all text-sm font-bold ${
                      theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-100 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-slate-800' : 'bg-slate-800/50 focus:bg-slate-800 border-white/5 focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 text-white placeholder-slate-500'
                    }`}
                  />
                </div>
                {!editingSub.cardId && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Dia da Cobrança</label>
                    <input
                      type="number"
                      placeholder="1-31"
                      min="1"
                      max="31"
                      required={!editingSub.cardId}
                      value={editingSub.day}
                      onChange={(e) => setEditingSub({...editingSub, day: e.target.value})}
                      className={`w-full p-4 rounded-2xl border transition-all text-sm font-bold ${
                        theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-100 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-slate-800' : 'bg-slate-800/50 focus:bg-slate-800 border-white/5 focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 text-white placeholder-slate-500'
                      }`}
                    />
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Categoria</label>
                <select
                  required
                  value={editingSub.category || 'other'}
                  onChange={(e) => setEditingSub({...editingSub, category: e.target.value})}
                  className={`w-full p-4 rounded-2xl border transition-all text-sm font-bold appearance-none outline-none ${
                    theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-100 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-slate-800' : 'bg-slate-800/50 focus:bg-slate-800 border-white/5 focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 text-white'
                  }`}
                >
                    {CATEGORIES.expense.map(cat => (
                        <option key={cat.id} value={cat.id} className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>{cat.label}</option>
                    ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Cartão Vinculado</label>
                <select
                  value={editingSub.cardId || ''}
                  onChange={(e) => setEditingSub({...editingSub, cardId: e.target.value})}
                  className={`w-full p-4 rounded-2xl border transition-all text-sm font-bold appearance-none outline-none ${
                    theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-100 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-slate-800' : 'bg-slate-800/50 focus:bg-slate-800 border-white/5 focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 text-white'
                  }`}
                >
                  <option value="" className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>Sem cartão (Avulsa)</option>
                  {cards.map(c => (
                    <option key={c.id} value={c.id} className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>{c.name} (•• {c.last4})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setEditingSub(null)} className={`flex-1 py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>Cancelar</button>
              <button type="submit" className="flex-1 py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest bg-purple-500 hover:bg-purple-600 transition-all text-white shadow-lg shadow-purple-500/20">Salvar Alterações</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default CardsTab;
