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
  ShoppingBag
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';

const CardsTab = ({ transactions = [] }) => {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  
  const [cards, setCards] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [isAddingSub, setIsAddingSub] = useState(false);
  
  // Form States
  const [newCard, setNewCard] = useState({ name: '', color: 'bg-blue-600', last4: '', brand: 'Visa', dueDay: 10 });
  const [editingCardId, setEditingCardId] = useState(null);
  const [newSub, setNewSub] = useState({ name: '', value: '', day: 1, cardId: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, type, title }
  const [payingInstallment, setPayingInstallment] = useState(null); // { sub object }
  const [payingInvoice, setPayingInvoice] = useState(null); // { cardId, total, expenses }

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
    await addDoc(collection(db, 'cards'), { ...newCard, userId: currentUser.uid });
    setNewCard({ name: '', color: 'bg-blue-600', last4: '', brand: 'Visa', dueDay: 10 });
    setIsAddingCard(false);
  };

  const handleUpdateCard = async (e) => {
    e.preventDefault();
    if (!newCard.name || !editingCardId) return;
    await updateDoc(doc(db, 'cards', editingCardId), { ...newCard });
    setNewCard({ name: '', color: 'bg-blue-600', last4: '', brand: 'Visa', dueDay: 10 });
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

  const handleAddSub = async (e) => {
    e.preventDefault();
    if (!newSub.name || !newSub.value) return;
    await addDoc(collection(db, 'subscriptions'), { 
      ...newSub, 
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
        // 1. Criar transação de pagamento de fatura na carteira (que vai deduzir o saldo)
        await addDoc(collection(db, 'transactions'), {
            description: `Pagamento de Fatura - ${cards.find(c => c.id === payingInvoice.cardId)?.name || 'Cartão'}`,
            amount: payingInvoice.total,
            type: 'expense',
            category: 'credit_card_bill',
            date: new Date().toISOString(),
            userId: currentUser.uid,
            month: new Date().toISOString().slice(0, 7),
            createdAt: Date.now(),
            paymentMethod: 'pix' // default para pagamento de fatura, deduz da conta corrente
        });

        // 2. Marcar todas as transações da fatura como pagas
        const updatePromises = payingInvoice.expenses.map(exp => 
            updateDoc(doc(db, 'transactions', exp.id), { invoiceStatus: 'paid' })
        );
        await Promise.all(updatePromises);
        
        // 3. Atualizar parcelamentos vinculados ao cartão (avançar parcela)
        // Assinaturas recorrentes NÃO são alteradas - elas sempre aparecem na fatura do cartão
        if (payingInvoice.subs && payingInvoice.subs.length > 0) {
            const cardInstallments = payingInvoice.subs.filter(s => s.type === 'installment');
            const subPromises = cardInstallments.map(sub => {
                const nextInstallment = (sub.currentInstallment || 1) + 1;
                const total = sub.totalInstallments || 1;
                if (nextInstallment > total) {
                    return deleteDoc(doc(db, 'subscriptions', sub.id));
                } else {
                    return updateDoc(doc(db, 'subscriptions', sub.id), { currentInstallment: nextInstallment });
                }
            });
            await Promise.all(subPromises);
        }
        
        setPayingInvoice(null);
    } catch (err) {
        console.error("Erro ao pagar fatura:", err);
    }
  };

  const getCardSubs = (cardId) => subscriptions.filter(s => s.cardId === cardId);
  const getUnpaidExpenses = (cardId) => transactions.filter(t => t.selectedCardId === cardId && t.invoiceStatus === 'unpaid');
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
            <h2 className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Meus Cartões</h2>
          </div>
          <button 
            onClick={() => setIsAddingCard(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-xs hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" /> Novo Cartão
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map(card => {
            const cardSubs = getCardSubs(card.id);
            const unpaidExpenses = getUnpaidExpenses(card.id);
            const subsTotal = cardSubs.reduce((acc, s) => acc + s.value, 0);
            const expensesTotal = unpaidExpenses.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
            const totalInvoice = expensesTotal + subsTotal;
            
            return (
              <div key={card.id} className={`group relative p-4 rounded-[2.5rem] border transition-all duration-500 ${
                theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5 shadow-2xl'
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
                        <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black uppercase opacity-60 bg-black/20 px-2 py-0.5 rounded-full">Vencimento</span>
                            <span className="text-xs font-bold">Dia {card.dueDay}</span>
                        </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase font-black opacity-60 mb-0.5">Fatura Atual</p>
                      <p className="text-xl font-black tabular-nums">R$ {totalInvoice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>

                {/* Fatura Actions */}
                <div className="mt-4 px-2">
                    <button 
                        onClick={() => totalInvoice > 0 && setPayingInvoice({ cardId: card.id, total: totalInvoice, expenses: unpaidExpenses, subs: cardSubs })}
                        disabled={totalInvoice === 0}
                        className={`w-full py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                            totalInvoice > 0 
                            ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20 hover:bg-rose-600' 
                            : (theme === 'light' ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-500')
                        }`}
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        {totalInvoice > 0 ? 'Pagar Fatura' : 'Fatura Zerada'}
                    </button>
                </div>

                {/* Itens da Fatura (Assinaturas + Gastos Avulsos) */}
                <div className="mt-6 px-2">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Itens da Fatura</p>
                        <span className="text-[9px] font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">{cardSubs.length + unpaidExpenses.length} itens</span>
                    </div>
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-hide">

                    {/* Gastos Avulsos do Mês */}
                    {unpaidExpenses.map(exp => (
                        <div key={exp.id} className={`flex items-center justify-between p-3 rounded-2xl border transition-all group/item ${
                            theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'
                        }`}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center">
                                    <ShoppingBag className="w-4 h-4 text-rose-500" />
                                </div>
                                <div>
                                    <p className={`text-[10px] font-black ${theme === 'light' ? 'text-slate-700' : 'text-white'}`}>{exp.description}</p>
                                    <p className="text-[8px] font-bold text-slate-500 uppercase">{new Date(exp.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-rose-500">R$ {parseFloat(exp.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                <button 
                                    onClick={() => setDeleteConfirm({ id: exp.id, type: 'transaction', title: exp.description, cardId: card.id })}
                                    className="p-1.5 text-slate-500 hover:text-rose-500 opacity-100 md:opacity-0 md:group-hover/item:opacity-100 transition-all"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                    
                    {/* Assinaturas Fixas */}
                    {cardSubs.map(sub => (
                        <div key={sub.id} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                            theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'
                        }`}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                    <Tag className="w-4 h-4 text-blue-500" />
                                </div>
                                <p className={`text-[10px] font-black ${theme === 'light' ? 'text-slate-700' : 'text-white'}`}>{sub.name}</p>
                            </div>
                            <span className="text-[10px] font-black text-emerald-500">R$ {sub.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    ))}
                    </div>
                </div>

                {/* Action Buttons (Repositioned to avoid overlap) */}
                <div className="absolute top-2 right-8 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 md:translate-y-2 md:group-hover:translate-y-0 z-20">
                    <button 
                    onClick={() => {
                        setEditingCardId(card.id);
                        setNewCard({ name: card.name, color: card.color, last4: card.last4, brand: card.brand, dueDay: card.dueDay || 10 });
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

                {/* Delete overlay for Card */}
                {deleteConfirm?.id === card.id && deleteConfirm?.type === 'card' && (
                    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-[2.5rem] flex flex-col items-center justify-center p-8 text-center z-[100] animate-in fade-in duration-300">
                        <div className="max-w-[280px] w-full space-y-4">
                            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                                <Trash2 className="w-8 h-8 text-rose-500" />
                            </div>
                            <h4 className="text-white font-black text-xl">Excluir?</h4>
                            <p className="text-white/60 text-xs leading-relaxed">
                                Você está removendo o cartão <span className="text-white font-bold">{card.name}</span>. Esta ação não pode ser desfeita.
                            </p>
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3.5 rounded-2xl bg-white/10 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-colors">Voltar</button>
                                <button onClick={() => handleDeleteCard(card.id)} className="flex-1 py-3.5 rounded-2xl bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-colors">Excluir</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Invoice Payment Overlay */}
                {payingInvoice?.cardId === card.id && (
                    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-[2.5rem] flex flex-col items-center justify-center p-8 text-center z-[100] animate-in fade-in duration-300">
                        <div className="max-w-[280px] w-full space-y-4">
                            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                                <DollarSign className="w-8 h-8 text-rose-500" />
                            </div>
                            <h4 className="text-white font-black text-xl uppercase tracking-widest">Pagar Fatura</h4>
                            <p className="text-white/60 text-xs leading-relaxed">
                                Você vai debitar <span className="text-rose-400 font-bold">R$ {payingInvoice.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> do seu saldo principal para pagar a fatura deste cartão. Confirmar?
                            </p>
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setPayingInvoice(null)} className="flex-1 py-3.5 rounded-2xl bg-white/10 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-colors">Voltar</button>
                                <button onClick={handlePayInvoice} className="flex-1 py-3.5 rounded-2xl bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-colors">Pagar</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete overlay for Transaction */}
                {deleteConfirm?.id && deleteConfirm?.type === 'transaction' && deleteConfirm?.cardId === card.id && (
                    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-[2.5rem] flex flex-col items-center justify-center p-8 text-center z-[100] animate-in fade-in duration-300">
                        <div className="max-w-[280px] w-full space-y-4">
                            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                                <Trash2 className="w-8 h-8 text-rose-500" />
                            </div>
                            <h4 className="text-white font-black text-xl">Excluir Gasto?</h4>
                            <p className="text-white/60 text-xs leading-relaxed">
                                Remover <span className="text-white font-bold">{deleteConfirm.title}</span> da fatura deste cartão?
                            </p>
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3.5 rounded-2xl bg-white/10 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-colors">Voltar</button>
                                <button onClick={() => handleDeleteTransaction(deleteConfirm.id)} className="flex-1 py-3.5 rounded-2xl bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-colors">Excluir</button>
                            </div>
                        </div>
                    </div>
                )}
              </div>
            );
          })}

          {cards.length === 0 && !isAddingCard && (
            <div className={`aspect-[1.6/1] md:aspect-auto rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center p-8 opacity-40 hover:opacity-100 transition-all cursor-pointer ${
              theme === 'light' ? 'border-slate-200 text-slate-400' : 'border-slate-700 text-slate-500'
            }`} onClick={() => setIsAddingCard(true)}>
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
            <h2 className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Assinaturas Avulsas</h2>
          </div>
          <button 
            onClick={() => setIsAddingSub(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl font-bold text-xs hover:bg-purple-600 transition-all shadow-lg shadow-purple-500/20"
          >
            <Plus className="w-4 h-4" /> Nova Assinatura
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {subscriptions.filter(s => s.type !== 'installment').map(sub => {
            const linkedCard = cards.find(c => c.id === sub.cardId);
            return (
              <div key={sub.id} className={`p-5 rounded-3xl border group relative transition-all hover:shadow-xl hover:-translate-y-1 ${
                theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'
              }`}>
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center">
                    <Tag className="w-6 h-6 text-purple-500" />
                  </div>
                  <button onClick={() => setDeleteConfirm({ id: sub.id, type: 'sub', title: sub.name })} className="p-2 text-slate-500 hover:text-rose-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all bg-white/5 rounded-xl">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Delete overlay for Subscription */}
                {deleteConfirm?.id === sub.id && deleteConfirm?.type === 'sub' && (
                    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center z-50 animate-in fade-in duration-300">
                        <div className="max-w-[200px] w-full">
                            <Trash2 className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                            <p className="text-white font-black text-sm mb-6 leading-tight">Excluir {sub.name}?</p>
                            <div className="flex gap-2">
                                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-black text-[9px] uppercase tracking-widest">Não</button>
                                <button onClick={() => handleDeleteSub(sub.id)} className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-black text-[9px] uppercase tracking-widest">Sim</button>
                            </div>
                        </div>
                    </div>
                )}
                <div className="space-y-1">
                  <h4 className={`font-black text-base ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{sub.name}</h4>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> Vence dia {sub.day}
                  </p>
                </div>
                <div className="mt-6 pt-5 border-t border-white/5 flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[9px] uppercase font-black text-slate-500">Valor Mensal</p>
                    <span className="text-lg font-black text-emerald-500 tabular-nums">R$ {sub.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {linkedCard ? (
                    <span className={`text-[9px] font-black px-3 py-1.5 rounded-xl ${linkedCard.color} text-white shadow-lg shadow-black/20`}>
                      {linkedCard.name}
                    </span>
                  ) : (
                    <span className={`text-[9px] font-black px-3 py-1.5 rounded-xl ${theme === 'light' ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-500 border border-white/5'}`}>
                      Sem Cartão
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {subscriptions.filter(s => s.type !== 'installment').length === 0 && (
            <div className={`col-span-full py-12 text-center rounded-[2rem] border-2 border-dashed ${theme === 'light' ? 'border-slate-100 text-slate-400' : 'border-white/5 text-slate-600'}`}>
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
          <h2 className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Parcelamentos Ativos</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {subscriptions.filter(s => s.type === 'installment').map(sub => {
            const linkedCard = cards.find(c => c.id === sub.cardId);
            const remaining = (sub.totalInstallments || 0) - (sub.currentInstallment || 0) + 1;
            const progress = ((sub.currentInstallment || 1) / (sub.totalInstallments || 1)) * 100;
            
            return (
              <div key={sub.id} className={`p-5 rounded-3xl border group relative transition-all hover:shadow-xl hover:-translate-y-1 ${
                theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'
              }`}>
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center">
                    <Hash className="w-6 h-6 text-rose-500" />
                  </div>
                  <button onClick={() => setDeleteConfirm({ id: sub.id, type: 'sub', title: sub.name })} className="p-2 text-slate-500 hover:text-rose-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all bg-white/5 rounded-xl">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Delete overlay for Installment */}
                {deleteConfirm?.id === sub.id && deleteConfirm?.type === 'sub' && (
                    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center z-50 animate-in fade-in duration-300">
                        <div className="max-w-[200px] w-full">
                            <Trash2 className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                            <p className="text-white font-black text-sm mb-6 leading-tight">Excluir {sub.name}?</p>
                            <div className="flex gap-2">
                                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-black text-[9px] uppercase tracking-widest">Não</button>
                                <button onClick={() => handleDeleteSub(sub.id)} className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-black text-[9px] uppercase tracking-widest">Sim</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-1">
                  <h4 className={`font-black text-base ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{sub.name}</h4>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
                      Parcela {sub.currentInstallment} de {sub.totalInstallments}
                    </p>
                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded-full">
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
                      className={`w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all ${
                          theme === 'light' 
                          ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white shadow-sm' 
                          : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white shadow-xl'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Dar Baixa na Parcela
                    </button>
                  )}
                </div>

                {/* Confirmation Overlay for Payment */}
                {payingInstallment?.id === sub.id && (
                    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center z-50 animate-in fade-in duration-300">
                        <div className="max-w-[220px] w-full space-y-4">
                            <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                            </div>
                            <h4 className="text-white font-black text-sm uppercase tracking-widest">Confirmar Pagamento</h4>
                            <p className="text-white/60 text-[10px] leading-relaxed mb-4">
                                Dar baixa na parcela <span className="text-emerald-400 font-black">{sub.currentInstallment}/{sub.totalInstallments}</span> de <span className="text-white font-bold">{sub.name}</span>?
                            </p>
                            <div className="flex flex-col gap-2 pt-2">
                                <button onClick={() => handlePayInstallment(sub, true)} className="w-full py-2.5 rounded-xl bg-emerald-500 text-white font-black text-[9px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-colors">
                                    Sim, criar saída (R$ {sub.value.toLocaleString('pt-BR')})
                                </button>
                                <button onClick={() => handlePayInstallment(sub, false)} className="w-full py-2.5 rounded-xl bg-blue-500/20 text-blue-400 font-black text-[9px] uppercase tracking-widest hover:bg-blue-500/30 transition-colors">
                                    Avançar parcela (Já lancei fatura)
                                </button>
                                <button onClick={() => setPayingInstallment(null)} className="w-full py-2.5 rounded-xl bg-white/10 text-white font-black text-[9px] uppercase tracking-widest hover:bg-white/20 transition-colors">Cancelar</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-6 pt-5 border-t border-white/5 flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[9px] uppercase font-black text-slate-500">Valor Parcela</p>
                    <span className="text-lg font-black text-rose-500 tabular-nums">R$ {sub.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {linkedCard && (
                    <span className={`text-[9px] font-black px-3 py-1.5 rounded-xl ${linkedCard.color} text-white shadow-lg shadow-black/20`}>
                      {linkedCard.name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {subscriptions.filter(s => s.type === 'installment').length === 0 && (
            <div className={`col-span-full py-12 text-center rounded-[2rem] border-2 border-dashed ${theme === 'light' ? 'border-slate-100 text-slate-400' : 'border-white/5 text-slate-600'}`}>
              <p className="text-xs font-bold uppercase tracking-widest">Nenhum parcelamento ativo.</p>
            </div>
          )}
        </div>
      </section>

      {/* MODAL: ADD CARD */}
      {isAddingCard && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <form onSubmit={handleAddCard} className={`border rounded-[2.5rem] w-full max-w-sm p-8 space-y-6 animate-in zoom-in-95 duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-2xl' : 'bg-slate-900 border-white/5 shadow-2xl shadow-emerald-500/10'
          }`}>
            <h3 className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                {editingCardId ? 'Editar Cartão' : 'Novo Cartão'}
            </h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Nome do Cartão (ex: Nubank, Inter)"
                required
                value={newCard.name}
                onChange={(e) => setNewCard({...newCard, name: e.target.value})}
                className={`w-full p-4 rounded-2xl border transition-all ${
                  theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-200' : 'bg-white/5 focus:bg-white/10 border-white/5 text-white'
                }`}
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Últimos 4 dígitos"
                  maxLength={4}
                  value={newCard.last4}
                  onChange={(e) => setNewCard({...newCard, last4: e.target.value})}
                  className={`w-full p-4 rounded-2xl border transition-all ${
                    theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-200' : 'bg-white/5 focus:bg-white/10 border-white/5 text-white'
                  }`}
                />
                <input
                  type="number"
                  placeholder="Dia de Vencimento"
                  min={1}
                  max={31}
                  value={newCard.dueDay}
                  onChange={(e) => setNewCard({...newCard, dueDay: parseInt(e.target.value)})}
                  className={`w-full p-4 rounded-2xl border transition-all ${
                    theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-200' : 'bg-white/5 focus:bg-white/10 border-white/5 text-white'
                  }`}
                />
              </div>
              <select
                value={newCard.brand}
                onChange={(e) => setNewCard({...newCard, brand: e.target.value})}
                className={`w-full p-4 rounded-2xl border transition-all ${
                  theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-200' : 'bg-white/5 focus:bg-white/10 border-white/5 text-white'
                }`}
              >
                  <option value="Visa">Visa</option>
                  <option value="Mastercard">Mastercard</option>
                  <option value="Elo">Elo</option>
                  <option value="Amex">Amex</option>
                </select>
              </div>
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
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => {
                  setIsAddingCard(false);
                  setEditingCardId(null);
                  setNewCard({ name: '', color: 'bg-blue-600', last4: '', brand: 'Visa', dueDay: 10 });
              }} className={`flex-1 py-4 rounded-2xl font-bold text-xs ${theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-400'}`}>Cancelar</button>
              <button type="submit" onClick={editingCardId ? handleUpdateCard : handleAddCard} className="flex-1 py-4 rounded-2xl font-bold text-xs bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                  {editingCardId ? 'Salvar Alterações' : 'Salvar Cartão'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADD SUB */}
      {isAddingSub && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <form onSubmit={handleAddSub} className={`border rounded-[2.5rem] w-full max-w-sm p-8 space-y-6 animate-in zoom-in-95 duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-2xl' : 'bg-slate-900 border-white/5 shadow-2xl shadow-purple-500/10'
          }`}>
            <h3 className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Nova Assinatura</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Serviço (ex: Netflix)"
                required
                value={newSub.name}
                onChange={(e) => setNewSub({...newSub, name: e.target.value})}
                className={`w-full p-4 rounded-2xl border transition-all ${
                  theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-200' : 'bg-white/5 focus:bg-white/10 border-white/5 text-white'
                }`}
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  placeholder="Valor R$"
                  required
                  value={newSub.value}
                  onChange={(e) => setNewSub({...newSub, value: e.target.value})}
                  className={`w-full p-4 rounded-2xl border transition-all ${
                    theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-200' : 'bg-white/5 focus:bg-white/10 border-white/5 text-white'
                  }`}
                />
                <input
                  type="number"
                  placeholder="Vencimento"
                  min={1} max={31}
                  required
                  value={newSub.day}
                  onChange={(e) => setNewSub({...newSub, day: e.target.value})}
                  className={`w-full p-4 rounded-2xl border transition-all ${
                    theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-200' : 'bg-white/5 focus:bg-white/10 border-white/5 text-white'
                  }`}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Vincular Cartão</label>
                <select
                  value={newSub.cardId}
                  onChange={(e) => setNewSub({...newSub, cardId: e.target.value})}
                  className={`w-full p-4 rounded-2xl border transition-all ${
                    theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-200' : 'bg-white/5 focus:bg-white/10 border-white/5 text-white'
                  }`}
                >
                  <option value="" className="bg-slate-800 text-white">Sem cartão (Avulsa)</option>
                  {cards.map(c => (
                    <option key={c.id} value={c.id} className="bg-slate-800 text-white">{c.name} (•• {c.last4})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIsAddingSub(false)} className={`flex-1 py-4 rounded-2xl font-bold text-xs ${theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-400'}`}>Cancelar</button>
              <button type="submit" className="flex-1 py-4 rounded-2xl font-bold text-xs bg-purple-500 text-white shadow-lg shadow-purple-500/20">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default CardsTab;
