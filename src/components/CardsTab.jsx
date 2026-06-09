import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
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
import { CATEGORIES, categoryHex } from '../constants/categories';
import TrialLimitModal from './TrialLimitModal';
import OverdraftWarningModal from './OverdraftWarningModal';

const CardsTab = ({ transactions = [], setActiveTab, walletStats }) => {
  const { theme } = useTheme();
  const { currentUser, isTrial, planLevel } = useAuth();

  // Limites aplicados ao trial e ao Plano Gratuito permanente
  const isLimited = isTrial || planLevel === 'free';
  const TRIAL_CARDS_LIMIT = 1;
  const TRIAL_SUBS_LIMIT  = 3;
  const [showTrialModal, setShowTrialModal]     = useState(false);
  const [trialModalMsg, setTrialModalMsg]       = useState('');

  const openTrialModal = (msg) => { setTrialModalMsg(msg); setShowTrialModal(true); };

  const [cards, setCards] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [isAddingSub, setIsAddingSub] = useState(false);
  // Cartão selecionado no painel de detalhe + aba do detalhe.
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [detailTab, setDetailTab] = useState('lancamentos');

  // Form States
  const [newCard, setNewCard] = useState({ name: '', color: 'bg-blue-600', last4: '', brand: 'Visa', dueDay: 10, closingDay: '', limit: '' });
  const [editingCardId, setEditingCardId] = useState(null);
  const [newSub, setNewSub] = useState({ name: '', value: '', day: 1, cardId: '', category: 'subscriptions', priority: 'comfort' });
  // Novo: estado dedicado para o modal de parcelamento (separado das assinaturas)
  const [isAddingInstallment, setIsAddingInstallment] = useState(false);
  const [newInstallment, setNewInstallment] = useState({
    name: '',
    value: '',
    valueMode: 'total', // 'total' (valor total dividido) | 'per' (valor de cada parcela)
    installments: '2',
    day: 1,
    cardId: '',
    category: 'shopping',
    priority: 'comfort'
  });
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, type, title }
  const [payingInstallment, setPayingInstallment] = useState(null); // { sub object }
  const [payingInvoice, setPayingInvoice] = useState(null); // { cardId, total, expenses, invoiceMonth }
  const [paidInvoiceSuccess, setPaidInvoiceSuccess] = useState(null); // cardId
  const [viewingInvoiceCardId, setViewingInvoiceCardId] = useState(null);
  const [historyCardId, setHistoryCardId] = useState(null); // cartão do modal "Histórico de faturas"
  const [expandedHistoryMonth, setExpandedHistoryMonth] = useState(null); // mês expandido no histórico

  // Edit Transaction State
  const [editingTransaction, setEditingTransaction] = useState(null); // { id, description, amount, date }
  const [editingSub, setEditingSub] = useState(null); // { id, name, value, day }

  // Aviso de endividamento — { type: 'installment' | 'invoice', amount, itemName, payload }
  const [overdraftPending, setOverdraftPending] = useState(null);

  // Colapso de cada seção (mostra o total mesmo minimizado)

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
    // Reforço do limite no salvamento.
    if (isLimited && cards.length >= TRIAL_CARDS_LIMIT) {
      openTrialModal(`Você atingiu o limite de ${TRIAL_CARDS_LIMIT} cartão do ${planLevel === 'free' ? 'Plano Gratuito' : 'período de teste'}.`);
      setIsAddingCard(false);
      return;
    }
    await addDoc(collection(db, 'cards'), {
        ...newCard,
        closingDay: parseInt(newCard.closingDay) || ((newCard.dueDay - 7 > 0) ? newCard.dueDay - 7 : 25),
        limit: parseFloat(newCard.limit) || null,
        userId: currentUser.uid
    });
    setNewCard({ name: '', color: 'bg-blue-600', last4: '', brand: 'Visa', dueDay: 10, closingDay: '', limit: '' });
    setIsAddingCard(false);
  };

  const handleUpdateCard = async (e) => {
    e.preventDefault();
    if (!newCard.name || !editingCardId) return;
    await updateDoc(doc(db, 'cards', editingCardId), {
        ...newCard,
        closingDay: parseInt(newCard.closingDay) || ((newCard.dueDay - 7 > 0) ? newCard.dueDay - 7 : 25),
        limit: parseFloat(newCard.limit) || null
    });
    setNewCard({ name: '', color: 'bg-blue-600', last4: '', brand: 'Visa', dueDay: 10, closingDay: '', limit: '' });
    setEditingCardId(null);
    setIsAddingCard(false);
  };

  const handleDeleteCard = async (id) => {
    // Evita órfãos: ao excluir o cartão, remove também as assinaturas/parcelas
    // ligadas a ele e as compras no crédito ainda EM ABERTO (não pagas) — que sem
    // o cartão não poderiam mais ser quitadas e seguiriam contando como despesa.
    // O histórico já pago é mantido.
    try {
      const subCleanup = subscriptions
        .filter(s => s.cardId === id)
        .map(s => deleteDoc(doc(db, 'subscriptions', s.id)));
      const txCleanup = transactions
        .filter(t => t.selectedCardId === id && t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid')
        .map(t => deleteDoc(doc(db, 'transactions', t.id)));
      await Promise.all([...subCleanup, ...txCleanup]);
    } catch (err) {
      console.error('Erro ao limpar dados do cartão:', err);
    }
    await deleteDoc(doc(db, 'cards', id));
    setDeleteConfirm(null);
  };

  const handleDeleteTransaction = async (id) => {
    await deleteDoc(doc(db, 'transactions', id));
    setDeleteConfirm(null);
  };

  // Carrega TODOS os campos relevantes do doc no estado de edição.
  // Antes, cardId/priority/dados de parcela ficavam de fora — o modal
  // abria sem cartão vinculado e sem prioridade, e não diferenciava
  // parcelamento de assinatura.
  const openEditSub = (sub) => {
    setEditingSub({
      id: sub.id,
      name: sub.name,
      value: sub.value,
      day: sub.day,
      category: sub.category || 'other',
      cardId: sub.cardId || '',
      priority: sub.priority || 'comfort',
      type: sub.type || 'recurring',
      isInstallment: sub.type === 'installment' || !!sub.isInstallment,
      currentInstallment: sub.currentInstallment,
      totalInstallments: sub.totalInstallments,
    });
  };

  const openEditTransaction = (exp) => {
    const d = new Date(exp.date);
    const formattedDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    setEditingTransaction({
      id: exp.id,
      description: exp.description,
      amount: exp.amount,
      category: exp.category || 'other',
      date: formattedDate,
      cardId: exp.selectedCardId || '',
      priority: exp.priority || 'comfort',
    });
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
        priority: editingTransaction.priority || 'comfort',
        selectedCardId: editingTransaction.cardId || null,
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
        priority: editingSub.priority || 'comfort',
        cardId: editingSub.cardId || ''
    });
    setEditingSub(null);
  };

  const handleAddSub = async (e) => {
    e.preventDefault();
    if (!newSub.name || !newSub.value) return;
    // Reforço do limite no salvamento.
    if (isLimited && subscriptions.length >= TRIAL_SUBS_LIMIT) {
      openTrialModal(`Você atingiu o limite de ${TRIAL_SUBS_LIMIT} assinaturas do ${planLevel === 'free' ? 'Plano Gratuito' : 'período de teste'}.`);
      return;
    }

    let finalDay = newSub.day;
    if (newSub.cardId) {
        const linkedCard = cards.find(c => c.id === newSub.cardId);
        if (linkedCard) finalDay = linkedCard.dueDay;
    }

    await addDoc(collection(db, 'subscriptions'), {
      ...newSub,
      day: parseInt(finalDay) || 1,
      value: parseFloat(newSub.value),
      category: newSub.category || 'subscriptions',
      priority: newSub.priority || 'comfort',
      type: 'recurring',
      userId: currentUser.uid,
      createdAt: Date.now()
    });
    setNewSub({ name: '', value: '', day: 1, cardId: '', category: 'subscriptions', priority: 'comfort' });
    setIsAddingSub(false);
  };

  const handleAddInstallment = async (e) => {
    e.preventDefault();
    if (!newInstallment.name || !newInstallment.value || !newInstallment.installments) return;

    const rawValue = parseFloat(newInstallment.value);
    const totalInstallments = parseInt(newInstallment.installments) || 1;
    // Se o usuário digitou o total: divide pelas parcelas. Se digitou o valor de cada parcela: usa direto.
    const valuePerInstallment = newInstallment.valueMode === 'total'
        ? rawValue / totalInstallments
        : rawValue;

    let finalDay = newInstallment.day;
    if (newInstallment.cardId) {
        const linkedCard = cards.find(c => c.id === newInstallment.cardId);
        if (linkedCard) finalDay = linkedCard.dueDay;
    }

    await addDoc(collection(db, 'subscriptions'), {
      name: newInstallment.name,
      value: valuePerInstallment,
      day: parseInt(finalDay) || 1,
      cardId: newInstallment.cardId || '',
      category: newInstallment.category || 'shopping',
      priority: newInstallment.priority || 'comfort',
      isInstallment: true,
      totalInstallments,
      currentInstallment: 1,
      installmentMode: newInstallment.valueMode,
      type: 'installment',
      userId: currentUser.uid,
      createdAt: Date.now()
    });

    setNewInstallment({
      name: '', value: '', valueMode: 'total', installments: '2',
      day: 1, cardId: '', category: 'shopping', priority: 'comfort'
    });
    setIsAddingInstallment(false);
  };

  const handleDeleteSub = async (id) => {
    await deleteDoc(doc(db, 'subscriptions', id));
    setDeleteConfirm(null);
  };

  // Executa a baixa de parcela (com ou sem criação de transação).
  const executePayInstallment = async (sub, createTransaction = true) => {
    if (!sub) return;
    try {
        const nextInstallment = (sub.currentInstallment || 1) + 1;
        const total = sub.totalInstallments || 1;

        if (createTransaction) {
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

        if (nextInstallment > total) {
            await deleteDoc(doc(db, 'subscriptions', sub.id));
        } else {
            await updateDoc(doc(db, 'subscriptions', sub.id), {
                currentInstallment: nextInstallment
            });
        }

        setPayingInstallment(null);
        setOverdraftPending(null);
    } catch (err) {
        console.error("Erro ao dar baixa na parcela:", err);
    }
  };

  // Wrapper: checa saldo SE for parcela avulsa (sem cartão) com criação de transação.
  // Parcelas com cartão vão pra fatura — validação acontece no pagamento dela.
  const handlePayInstallment = async (sub, createTransaction = true) => {
    if (!sub) return;
    const impactsBalance = createTransaction && !sub.cardId;
    if (impactsBalance) {
      const amount = parseFloat(sub.value) || 0;
      const currentBalance = Number(walletStats?.balance) || 0;
      if (amount > currentBalance) {
        setOverdraftPending({
          type: 'installment',
          amount,
          itemName: `Parcela ${sub.currentInstallment}/${sub.totalInstallments} - ${sub.name}`,
          payload: { sub, createTransaction }
        });
        return;
      }
    }
    await executePayInstallment(sub, createTransaction);
  };

  // Executa o pagamento de fatura.
  const executePayInvoice = async (invoiceData) => {
    if (!invoiceData || (invoiceData.expenses.length === 0 && (!invoiceData.subs || invoiceData.subs.length === 0))) return;

    try {
        const now = new Date();
        const paidMonth = invoiceData.invoiceMonth;

        // Snapshot da fatura paga — guarda os itens exatos do momento do pagamento,
        // para o Histórico de Faturas ficar preciso (assinaturas/parcelas mudam com o tempo).
        const invoiceSnapshot = {
            total: invoiceData.total,
            items: [
                ...(invoiceData.expenses || []).map(e => ({
                    description: e.description || 'Compra',
                    amount: parseFloat(e.amount) || 0,
                    badge: e.installmentInfo || null,
                    date: e.date || null,
                })),
                ...(invoiceData.subs || []).map(s => ({
                    description: s.name,
                    amount: parseFloat(s.value) || 0,
                    badge: s.type === 'installment' ? `${s.currentInstallment || 1}/${s.totalInstallments || 1}` : 'assinatura',
                    date: null,
                })),
            ],
        };

        await addDoc(collection(db, 'transactions'), {
            description: `Pagamento de Fatura - ${cards.find(c => c.id === invoiceData.cardId)?.name || 'Cartão'}`,
            amount: invoiceData.total,
            type: 'expense',
            category: 'credit_card_bill',
            date: now.toISOString(),
            userId: currentUser.uid,
            month: now.toISOString().slice(0, 7),
            invoiceMonthPaid: paidMonth,
            invoiceSnapshot,
            createdAt: Date.now(),
            paymentMethod: 'pix',
            selectedCardId: invoiceData.cardId
        });

        const updatePromises = invoiceData.expenses.map(exp =>
            updateDoc(doc(db, 'transactions', exp.id), { invoiceStatus: 'paid', paidInInvoice: paidMonth })
        );
        await Promise.all(updatePromises);

        if (invoiceData.subs && invoiceData.subs.length > 0) {
            const subPromises = invoiceData.subs.map(sub => {
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

        const paidCardId = invoiceData.cardId;
        setPayingInvoice(null);
        setOverdraftPending(null);
        setPaidInvoiceSuccess(paidCardId);

        setTimeout(() => {
            setPaidInvoiceSuccess(prev => prev === paidCardId ? null : prev);
        }, 3000);

    } catch (err) {
        console.error("Erro ao pagar fatura:", err);
    }
  };

  // Wrapper: pagamento de fatura sempre impacta saldo (PIX) → checa.
  const handlePayInvoice = async () => {
    if (!payingInvoice) return;
    const amount = parseFloat(payingInvoice.total) || 0;
    const currentBalance = Number(walletStats?.balance) || 0;
    if (amount > currentBalance) {
      const cardName = cards.find(c => c.id === payingInvoice.cardId)?.name || 'Cartão';
      setOverdraftPending({
        type: 'invoice',
        amount,
        itemName: `Fatura ${cardName}`,
        payload: payingInvoice
      });
      return;
    }
    await executePayInvoice(payingInvoice);
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

  // Uma assinatura pertence à fatura `invoiceMonth` se a cobrança no mês atual
  // OU no mês anterior cai nesse ciclo (ciclo pode começar no mês anterior).
  const isSubInInvoice = (subDay, invoiceMonth, closingDay) => {
    const [iy, im] = invoiceMonth.split('-').map(Number);
    const prevM = im === 1 ? 12 : im - 1;
    const prevY = im === 1 ? iy - 1 : iy;
    const chargeCurr = new Date(iy, im - 1, subDay, 12, 0, 0);
    const chargePrev = new Date(prevY, prevM - 1, subDay, 12, 0, 0);
    return getInvoiceMonth(chargeCurr.toISOString(), closingDay) === invoiceMonth ||
           getInvoiceMonth(chargePrev.toISOString(), closingDay) === invoiceMonth;
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

  // ── Resumo (KPIs do topo) ──
  const fmt = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const recurringSubs = subscriptions.filter(s => s.type !== 'installment');
  const installmentSubs = subscriptions.filter(s => s.type === 'installment');
  const monthlySubsTotal = recurringSubs.reduce((a, s) => a + (parseFloat(s.value) || 0), 0);
  const monthlyInstallTotal = installmentSubs.reduce((a, s) => a + (parseFloat(s.value) || 0), 0);
  const monthlyCommitment = monthlySubsTotal + monthlyInstallTotal;

  // Soma real das faturas abertas — mesma lógica de cada cartão (transações + assinaturas vinculadas)
  const _today = new Date();
  const unpaidInvoiceTotal = cards.reduce((total, card) => {
    const { all: unpaidExpenses, currentInvoiceMonth, closingDay } = getUnpaidExpensesByPeriod(card);
    const cardSubs = getCardSubs(card.id).filter(s => {
      if (s.lastPaidMonth === currentInvoiceMonth) return false;
      const subDay = parseInt(s.day) || 1;
      return isSubInInvoice(subDay, currentInvoiceMonth, closingDay);
    });
    const expensesTotal = unpaidExpenses.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const subsTotal = cardSubs.reduce((a, s) => a + (parseFloat(s.value) || 0), 0);
    // Não conta faturas que só vencem no PRÓXIMO mês (consistente com o selo
    // "fatura paga" do cartão e o card "em dia" da Visão Geral).
    const dueDay = card.dueDay || 10;
    const [iy, im] = currentInvoiceMonth.split('-').map(Number);
    const due = new Date(iy, im - 1, dueDay);
    const isFuture = due.getFullYear() > _today.getFullYear()
      || (due.getFullYear() === _today.getFullYear() && due.getMonth() > _today.getMonth());
    return total + (isFuture ? 0 : expensesTotal + subsTotal);
  }, 0);

  const isDark = theme !== 'light';
  const kpiCardBg = isDark ? 'bg-[#1e2330] border-slate-800/60' : 'bg-white border-slate-100 shadow-sm';

  const kpiInvoiceHint = cards.length === 0
    ? 'nenhum cartão'
    : cards.map(c => c.name).join(' + ');

  const KPIS = [
    { label: 'Faturas em aberto', value: unpaidInvoiceTotal, icon: CreditCard, accent: 'rose', hint: kpiInvoiceHint },
    { label: 'Assinaturas / mês', value: monthlySubsTotal, icon: Calendar, accent: 'purple', hint: `${recurringSubs.length} ${recurringSubs.length === 1 ? 'ativa' : 'ativas'}` },
    { label: 'Parcelas / mês', value: monthlyInstallTotal, icon: Hash, accent: 'amber', hint: `${installmentSubs.length} ${installmentSubs.length === 1 ? 'parcelamento' : 'parcelamentos'}` },
    { label: 'Comprometido / mês', value: monthlyCommitment, icon: Repeat, accent: 'emerald', hint: 'assinaturas + parcelas' },
  ];
  const KPI_ACCENT = {
    rose: { text: 'text-rose-500', soft: isDark ? 'bg-rose-500/10' : 'bg-rose-50' },
    purple: { text: 'text-purple-500', soft: isDark ? 'bg-purple-500/10' : 'bg-purple-50' },
    amber: { text: 'text-amber-500', soft: isDark ? 'bg-amber-500/10' : 'bg-amber-50' },
    emerald: { text: 'text-emerald-500', soft: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50' },
  };

  // Estatísticas completas de um cartão (fatura atual, vencimento, limite, abas).
  const cardStats = (card) => {
    const { all: unpaidExpenses, previous, currentInvoiceMonth, closingDay } = getUnpaidExpensesByPeriod(card);
    const cardSubsAll = getCardSubs(card.id);
    const unpaidSubs = cardSubsAll.filter(s => {
      if (s.lastPaidMonth === currentInvoiceMonth) return false;
      const d = parseInt(s.day) || 1;
      return isSubInInvoice(d, currentInvoiceMonth, closingDay);
    });
    const expensesTotal = unpaidExpenses.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const subsTotal = unpaidSubs.reduce((a, s) => a + (parseFloat(s.value) || 0), 0);
    const invoiceTotal = expensesTotal + subsTotal;
    const dueDay = card.dueDay || 10;
    const [iy, im] = currentInvoiceMonth.split('-').map(Number);
    const dueDate = new Date(iy, im - 1, dueDay);
    const now = new Date();
    const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysUntil = Math.max(0, Math.ceil((dueDate - t0) / 86400000));
    const recurring = cardSubsAll.filter(s => s.type !== 'installment');
    const installments = cardSubsAll.filter(s => s.type === 'installment');
    // Quadrinhos "Parcelas/Assinaturas" mostram o valor RECORRENTE do cartão (igual à
    // lista das abas), pra o usuário antecipar quanto vem no mês seguinte — mesmo que
    // a fatura atual já tenha sido paga.
    const parcelasMes = installments.reduce((a, s) => a + (parseFloat(s.value) || 0), 0);
    const assinaturasMes = recurring.reduce((a, s) => a + (parseFloat(s.value) || 0), 0);

    // PREVISÃO (com assinaturas) = fatura em aberto + assinaturas recorrentes que
    // ainda não estão somadas na fatura (ex.: marcada como paga no ciclo). Mostra o
    // total real que vem. Ex.: parcelas 349,19 + assinatura 16,90 = 366,09.
    const recurringInInvoiceIds = new Set(unpaidSubs.filter(s => s.type !== 'installment').map(s => s.id));
    const recurringExtra = recurring
      .filter(r => !recurringInInvoiceIds.has(r.id))
      .reduce((a, s) => a + (parseFloat(s.value) || 0), 0);
    const nextInvoiceEstimate = invoiceTotal + recurringExtra;

    // Fatura quitada = nada em aberto (R$ 0). Uma fatura futura em aberto NÃO é paga.
    const isFutureInvoice = dueDate.getFullYear() > now.getFullYear()
      || (dueDate.getFullYear() === now.getFullYear() && dueDate.getMonth() > now.getMonth());
    const currentCyclePaid = invoiceTotal <= 0.005;

    const limit = parseFloat(card.limit) || 0;
    const available = limit > 0 ? Math.max(0, limit - invoiceTotal) : 0;
    const usagePct = limit > 0 ? Math.min(100, (invoiceTotal / limit) * 100) : 0;
    // Itens da fatura (despesas no crédito + assinaturas/parcelas do ciclo).
    const invoiceItems = [
      ...unpaidExpenses.map(t => ({ key: t.id, name: t.description || 'Compra', category: t.category, priority: t.priority || 'comfort', amount: parseFloat(t.amount) || 0, date: t.date, installment: t.installmentInfo || null, totalLabel: null })),
      ...unpaidSubs.map(s => ({
        key: s.id, name: s.name, category: s.category, priority: s.priority || 'comfort',
        amount: parseFloat(s.value) || 0, date: null,
        installment: s.type === 'installment' ? `${s.currentInstallment || 1}/${s.totalInstallments || 1}` : null,
        totalLabel: s.type === 'installment' ? `R$ ${fmt((parseFloat(s.value) || 0) * (s.totalInstallments || 1))} total` : null,
      })),
    ];
    return { unpaidExpenses, unpaidSubs, invoiceTotal, currentInvoiceMonth, closingDay, dueDate, daysUntil, recurring, installments, parcelasMes, assinaturasMes, nextInvoiceEstimate, currentCyclePaid, isFutureInvoice, limit, available, usagePct, invoiceItems, hasPreviousDebt: previous.length > 0 };
  };
  // Histórico de faturas: baseado em fontes CONFIÁVEIS — os registros de pagamento
  // (valor + data + snapshot dos itens) e a fatura ATUAL em aberto. Não reconstrói
  // meses a partir de assinaturas recorrentes (gerava meses-fantasma e totais errados).
  const getInvoiceHistory = (card) => {
    if (!card) return [];
    const closingDay = card.closingDay || ((card.dueDay - 7 > 0) ? card.dueDay - 7 : 25);
    const currentInvoiceMonth = getInvoiceMonth(new Date().toISOString(), closingDay);
    const stats = cardStats(card);
    const now = new Date();
    const mkLabel = (M) => new Date(M + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const payments = transactions.filter(t => t.selectedCardId === card.id
      && t.category === 'credit_card_bill' && t.invoiceMonthPaid);

    const byMonth = new Map();

    // Faturas PAGAS (registros reais). Itens vêm do snapshot; sem snapshot (faturas
    // antigas), cai para os lançamentos avulsos reais do mês (assinaturas antigas
    // não são recuperáveis).
    payments.forEach(p => {
      const M = p.invoiceMonthPaid;
      const snap = p.invoiceSnapshot;
      const paidTotal = parseFloat(p.amount) || (snap?.total) || 0;
      let items;
      if (snap?.items) {
        items = snap.items; // exato
      } else {
        // Compras EXATAS daquela fatura: as transações marcam paidInInvoice === mês
        // quando a fatura é paga. (fallback: pela data, p/ registros bem antigos.)
        const exact = transactions.filter(t => t.selectedCardId === card.id
          && t.category !== 'credit_card_bill' && t.paidInInvoice === M);
        const purchaseTx = exact.length > 0
          ? exact
          : transactions.filter(t => t.selectedCardId === card.id && t.category !== 'credit_card_bill'
              && getInvoiceMonth(t.date || now.toISOString(), closingDay) === M);
        const purchaseItems = purchaseTx
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
          .map(t => ({ description: t.description || 'Compra', amount: parseFloat(t.amount) || 0, badge: t.installmentInfo || null, date: t.date || null }));
        // Assinaturas/parcelas atuais que caem nessa fatura (aproximação para a parte recorrente).
        const subItems = getCardSubs(card.id)
          .filter(s => isSubInInvoice(parseInt(s.day) || 1, M, closingDay))
          .map(s => ({ description: s.name, amount: parseFloat(s.value) || 0, badge: s.type === 'installment' ? `${s.currentInstallment || 1}/${s.totalInstallments || 1}` : 'assinatura', date: null }));
        items = [...purchaseItems, ...subItems];
        const sum = items.reduce((a, i) => a + (i.amount || 0), 0);
        const diff = paidTotal - sum;
        if (diff > 0.5) items.push({ description: 'Assinaturas e parcelas (não detalhado)', amount: diff, badge: null, date: null });
      }
      const entry = {
        month: M, label: mkLabel(M), total: paidTotal,
        status: 'paid', paidDate: p.date || null,
        items, hasSnapshot: !!snap,
      };
      const prev = byMonth.get(M);
      if (!prev || (p.date || '') > (prev.paidDate || '')) byMonth.set(M, entry);
    });

    // Fatura ATUAL em aberto (se não estiver paga e tiver valor).
    if (!byMonth.has(currentInvoiceMonth) && stats.invoiceTotal > 0.005) {
      byMonth.set(currentInvoiceMonth, {
        month: currentInvoiceMonth, label: mkLabel(currentInvoiceMonth),
        total: stats.invoiceTotal,
        status: stats.daysUntil > 0 ? 'open' : 'overdue', paidDate: null,
        items: stats.invoiceItems.map(i => ({ description: i.name, amount: i.amount, badge: i.installment || (i.date ? null : 'assinatura'), date: i.date })),
        hasSnapshot: true,
      });
    }

    return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
  };

  const selectedCard = cards.find(c => c.id === selectedCardId) || cards[0] || null;
  const selStats = selectedCard ? cardStats(selectedCard) : null;

  return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Cartões</h1>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Gerencie faturas, parcelamentos e assinaturas dos seus cartões</p>
        </div>
        <button
          onClick={() => {
            if (isLimited && cards.length >= TRIAL_CARDS_LIMIT) { openTrialModal(`Você atingiu o limite de ${TRIAL_CARDS_LIMIT} cartão do ${planLevel === 'free' ? 'Plano Gratuito' : 'período de teste'}.`); return; }
            setEditingCardId(null);
            setNewCard({ name: '', color: 'bg-blue-600', last4: '', brand: 'Visa', dueDay: 10, closingDay: '', limit: '' });
            setIsAddingCard(true);
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black transition-all active:scale-95 shadow-lg shadow-emerald-500/25"
        >
          <Plus className="w-4 h-4" /> Novo Cartão
        </button>
      </div>

      {/* KPIs com linha de destaque */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPIS.map((k) => {
          const hex = { rose: '#f43f5e', purple: '#a855f7', amber: '#f59e0b', emerald: '#10b981' }[k.accent];
          return (
            <div key={k.label} className={`relative rounded-2xl border overflow-hidden ${kpiCardBg}`}>
              <div className="h-1 w-full" style={{ background: hex }} />
              <div className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{k.label}</p>
                <p className="text-2xl font-black tabular-nums mt-1" style={{ color: hex }}>R$ {fmt(k.value)}</p>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{k.hint}</p>
              </div>
            </div>
          );
        })}
      </div>

      {cards.length === 0 ? (
        <div className={`p-12 rounded-2xl border text-center ${kpiCardBg}`}>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-500'}`}><CreditCard className="w-7 h-7" /></div>
          <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Nenhum cartão cadastrado</p>
          <p className="text-sm text-slate-500 mb-4 mt-1">Adicione seus cartões para acompanhar faturas, parcelamentos e assinaturas.</p>
          <button onClick={() => { setEditingCardId(null); setNewCard({ name: '', color: 'bg-blue-600', last4: '', brand: 'Visa', dueDay: 10, closingDay: '', limit: '' }); setIsAddingCard(true); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white font-black text-xs hover:bg-emerald-600"><Plus className="w-4 h-4" /> Novo Cartão</button>
        </div>
      ) : (
      <>
      {/* Detalhe do cartão selecionado (largura cheia; cartão escolhido no seletor do topo) */}
        {selectedCard && selStats && (
          <div className={`rounded-2xl border p-5 ${kpiCardBg}`}>
            {/* Cabeçalho da fatura */}
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fatura de {new Date(selStats.currentInvoiceMonth + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                  {selStats.currentCyclePaid && selStats.nextInvoiceEstimate <= 0.005 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Fatura paga
                    </span>
                  )}
                </div>
                {(() => {
                  // Fatura zerada mas com assinaturas recorrentes vindo (ex.: Nubank):
                  // mostra a ESTIMATIVA (com assinaturas) como número principal.
                  const paidWithUpcoming = selStats.currentCyclePaid && selStats.nextInvoiceEstimate > 0.005;
                  const amount = paidWithUpcoming ? selStats.nextInvoiceEstimate : selStats.invoiceTotal;
                  const color = paidWithUpcoming ? '#a855f7' : (selStats.invoiceTotal > 0.005 ? '#f59e0b' : '#10b981');
                  return (
                    <>
                      <p className="text-3xl font-black tabular-nums mt-1" style={{ color }}><span className="text-base font-bold text-slate-400 mr-0.5">R$</span>{fmt(amount)}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {paidWithUpcoming
                          ? <>Próxima fatura estimada · com assinaturas · vence dia {selectedCard.dueDay || 10}</>
                          : selStats.invoiceTotal > 0.005
                            ? <>Vence em <span className="font-bold text-rose-400">{selStats.daysUntil} {selStats.daysUntil === 1 ? 'dia' : 'dias'}</span> · {selStats.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</>
                            : 'Fatura zerada 🎉'}
                      </p>
                    </>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Seletor de cartão */}
                <div className="relative">
                  <select
                    value={selectedCard.id}
                    onChange={(e) => setSelectedCardId(e.target.value)}
                    className={`appearance-none pl-3 pr-8 py-2 rounded-xl border text-xs font-bold outline-none cursor-pointer max-w-[200px] ${isDark ? 'bg-[#161b27] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                  >
                    {cards.map(c => (
                      <option key={c.id} value={c.id} className={isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'}>{c.name} · •••• {c.last4 || '0000'}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                </div>
                <button onClick={() => { setEditingCardId(selectedCard.id); setNewCard({ name: selectedCard.name, color: selectedCard.color, last4: selectedCard.last4, brand: selectedCard.brand, dueDay: selectedCard.dueDay || 10, closingDay: selectedCard.closingDay || '', limit: selectedCard.limit != null ? String(selectedCard.limit) : '' }); setIsAddingCard(true); }} className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><Pencil className="w-4 h-4" /></button>
                <button onClick={() => setDeleteConfirm({ id: selectedCard.id, type: 'card', title: selectedCard.name })} className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/5 hover:text-rose-400' : 'text-slate-500 hover:bg-slate-100 hover:text-rose-500'}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
              {/* Cartão visual */}
              <div className={`aspect-[1.6/1] rounded-2xl p-4 flex flex-col justify-between text-white shadow-2xl relative overflow-hidden ${selectedCard.color}`}>
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-50" />
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
                <div className="relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{selectedCard.brand}</p>
                  <h3 className="text-xl font-black tracking-tight drop-shadow-md">{selectedCard.name}</h3>
                </div>
                <div className="relative z-10 flex justify-between items-end">
                  <p className="font-mono text-sm tracking-[0.25em] drop-shadow-sm">•••• •••• •••• {selectedCard.last4 || '0000'}</p>
                  <div className="text-right">
                    <p className="text-[8px] font-black uppercase opacity-60">Vencimento</p>
                    <p className="text-sm font-bold">Dia {selectedCard.dueDay || 10}</p>
                  </div>
                </div>
              </div>

              {/* Limite + stats */}
              <div className="space-y-3">
                <div className={`rounded-xl border p-3 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Uso do limite</span>
                    <span className="text-[11px] font-black tabular-nums" style={{ color: selStats.usagePct >= 80 ? '#f43f5e' : selStats.usagePct >= 50 ? '#f59e0b' : '#10b981' }}>{selStats.limit > 0 ? `${Math.round(selStats.usagePct)}%` : '—'}</span>
                  </div>
                  <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${selStats.limit > 0 ? selStats.usagePct : 0}%`, background: selStats.usagePct >= 80 ? '#f43f5e' : selStats.usagePct >= 50 ? '#f59e0b' : '#10b981' }} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[9px] text-slate-500 tabular-nums">R$ {fmt(selStats.invoiceTotal)} usado</span>
                    <span className="text-[9px] text-slate-500 tabular-nums">{selStats.limit > 0 ? `Limite R$ ${fmt(selStats.limit)}` : 'Defina o limite ✎'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`rounded-xl border p-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}><p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Limite Total</p><p className={`text-sm font-black tabular-nums mt-0.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>{selStats.limit > 0 ? `R$ ${fmt(selStats.limit)}` : '—'}</p></div>
                  <div className={`rounded-xl border p-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}><p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Disponível</p><p className="text-sm font-black tabular-nums mt-0.5 text-emerald-500">{selStats.limit > 0 ? `R$ ${fmt(selStats.available)}` : '—'}</p></div>
                  <div className={`rounded-xl border p-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}><p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Parcelas no mês</p><p className={`text-sm font-black tabular-nums mt-0.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>R$ {fmt(selStats.parcelasMes)}</p></div>
                  <div className={`rounded-xl border p-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}><p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Assinaturas</p><p className="text-sm font-black tabular-nums mt-0.5 text-violet-400">R$ {fmt(selStats.assinaturasMes)}</p></div>
                </div>
              </div>
            </div>

            {selStats.hasPreviousDebt && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-[10px] font-bold text-amber-500">Inclui fatura(s) anterior(es) ainda não paga(s).</span>
              </div>
            )}

            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <button
                onClick={() => selStats.invoiceTotal > 0.005 && setPayingInvoice({ cardId: selectedCard.id, total: selStats.invoiceTotal, expenses: selStats.unpaidExpenses, subs: selStats.unpaidSubs, invoiceMonth: selStats.currentInvoiceMonth })}
                disabled={selStats.invoiceTotal <= 0.005}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 ${selStats.invoiceTotal > 0.005 ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/25' : (isDark ? 'bg-white/5 text-slate-500' : 'bg-slate-100 text-slate-400')}`}
              >
                <CheckCircle2 className="w-4 h-4" /> Registrar pagamento
              </button>
              <button onClick={() => setViewingInvoiceCardId(selectedCard.id)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <Eye className="w-4 h-4" /> Ver lançamentos
              </button>
              <button onClick={() => { setHistoryCardId(selectedCard.id); setExpandedHistoryMonth(null); }} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <Calendar className="w-4 h-4" /> Histórico de faturas
              </button>
            </div>
          </div>
        )}

      {/* Abas: Lançamentos / Parcelamentos / Assinaturas */}
      {selectedCard && selStats && (
        <div className={`rounded-2xl border overflow-hidden ${kpiCardBg}`}>
          <div className={`flex items-stretch border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
            {[
              { id: 'lancamentos', label: 'Lançamentos', count: selStats.invoiceItems.length },
              { id: 'parcelamentos', label: 'Parcelamentos', count: selStats.installments.length },
              { id: 'assinaturas', label: 'Assinaturas', count: selStats.recurring.length },
            ].map(t => (
              <button key={t.id} onClick={() => setDetailTab(t.id)} className={`flex-1 py-3 text-[12px] font-bold transition-all inline-flex items-center justify-center gap-1.5 ${detailTab === t.id ? (isDark ? 'text-white bg-white/[0.03]' : 'text-slate-900 bg-slate-50') : 'text-slate-500 hover:text-slate-400'} ${detailTab === t.id ? 'border-b-2 border-emerald-500' : ''}`}>
                {t.label} <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${detailTab === t.id ? 'bg-emerald-500/15 text-emerald-400' : (isDark ? 'bg-white/5 text-slate-500' : 'bg-slate-100 text-slate-500')}`}>{t.count}</span>
              </button>
            ))}
          </div>

          <div className="p-3">
            {detailTab === 'lancamentos' && (
              <>
                <div className="flex items-center justify-between px-1 pb-2">
                  <span className="text-[11px] font-bold text-slate-500">Lançamentos de {new Date(selStats.currentInvoiceMonth + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                  <span className="text-[12px] font-black tabular-nums text-rose-400">R$ {fmt(selStats.invoiceTotal)}</span>
                </div>
                {selStats.invoiceItems.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-8">Nenhum lançamento nesta fatura.</p>
                ) : selStats.invoiceItems.map(it => {
                  const cat = CATEGORIES.expense.find(c => c.id === it.category);
                  const Icon = cat?.icon || ShoppingBag;
                  const hex = categoryHex(cat || {});
                  const pm = { essential: { l: 'Essencial', c: 'text-blue-400' }, comfort: { l: 'Conforto', c: 'text-amber-500' }, superfluous: { l: 'Supérfluo', c: 'text-rose-400' } }[it.priority] || { l: '', c: '' };
                  return (
                    <div key={it.key} className={`flex items-center gap-3 px-1 py-2.5 ${isDark ? 'border-t border-white/[0.04]' : 'border-t border-slate-50'}`}>
                      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${hex}1f`, color: hex }}><Icon className="w-[18px] h-[18px]" /></span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[13px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{it.name}</p>
                        <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 mt-0.5">
                          {it.date && <span className="text-[10px] text-slate-500">{new Date(it.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}</span>}
                          <span className="text-[10px] text-slate-500">· {cat?.label || 'Outro'}</span>
                          {pm.l && <span className={`text-[9px] font-bold ${pm.c}`}>{pm.l}</span>}
                          {it.installment && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-400">{it.installment}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-black tabular-nums text-rose-400">R$ {fmt(it.amount)}</p>
                        {it.totalLabel && <p className="text-[9px] text-slate-500">{it.totalLabel}</p>}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {detailTab === 'parcelamentos' && (
              selStats.installments.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-8">Nenhum parcelamento neste cartão.</p>
              ) : selStats.installments.map(sub => {
                const cat = CATEGORIES.expense.find(c => c.id === sub.category);
                const Icon = cat?.icon || ShoppingBag;
                const hex = categoryHex(cat || {});
                const total = sub.totalInstallments || 1;
                const paid = Math.max(0, (sub.currentInstallment || 1) - 1);
                const pct = (paid / total) * 100;
                return (
                  <div key={sub.id} className={`flex items-center gap-3 px-1 py-2.5 ${isDark ? 'border-t border-white/[0.04]' : 'border-t border-slate-50'}`}>
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${hex}1f`, color: hex }}><Icon className="w-[18px] h-[18px]" /></span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{sub.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className={`flex-1 h-1.5 rounded-full overflow-hidden max-w-[140px] ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}><div className="h-full rounded-full bg-rose-500" style={{ width: `${pct}%` }} /></div>
                        <span className="text-[10px] text-slate-500 tabular-nums">{paid}/{total} pagas</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <span className="text-[13px] font-black tabular-nums text-rose-400">R$ {fmt(sub.value)}</span>
                      <button onClick={() => openEditSub(sub)} className={`p-1.5 rounded-lg ${isDark ? 'text-slate-500 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-100'}`}><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteConfirm({ id: sub.id, type: 'sub', title: sub.name })} className={`p-1.5 rounded-lg ${isDark ? 'text-slate-500 hover:bg-white/5 hover:text-rose-400' : 'text-slate-400 hover:bg-slate-100 hover:text-rose-500'}`}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                );
              })
            )}

            {detailTab === 'assinaturas' && (
              selStats.recurring.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-8">Nenhuma assinatura neste cartão.</p>
              ) : selStats.recurring.map(sub => {
                const cat = CATEGORIES.expense.find(c => c.id === sub.category);
                const Icon = cat?.icon || ShoppingBag;
                const hex = categoryHex(cat || {});
                return (
                  <div key={sub.id} className={`flex items-center gap-3 px-1 py-2.5 ${isDark ? 'border-t border-white/[0.04]' : 'border-t border-slate-50'}`}>
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${hex}1f`, color: hex }}><Icon className="w-[18px] h-[18px]" /></span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{sub.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Na fatura · vence dia {selectedCard.dueDay || sub.day}</p>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <span className="text-[13px] font-black tabular-nums text-violet-400">R$ {fmt(sub.value)}</span>
                      <button onClick={() => openEditSub(sub)} className={`p-1.5 rounded-lg ${isDark ? 'text-slate-500 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-100'}`}><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteConfirm({ id: sub.id, type: 'sub', title: sub.name })} className={`p-1.5 rounded-lg ${isDark ? 'text-slate-500 hover:bg-white/5 hover:text-rose-400' : 'text-slate-400 hover:bg-slate-100 hover:text-rose-500'}`}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Ações de adicionar */}
          <div className={`flex items-center gap-2 p-3 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
            <button onClick={() => { if (isLimited && subscriptions.length >= TRIAL_SUBS_LIMIT) { openTrialModal(`Você atingiu o limite de ${TRIAL_SUBS_LIMIT} assinaturas do ${planLevel === 'free' ? 'Plano Gratuito' : 'período de teste'}.`); return; } setNewSub({ name: '', value: '', day: 1, cardId: selectedCard.id, category: 'subscriptions', priority: 'comfort' }); setIsAddingSub(true); }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Plus className="w-3.5 h-3.5" /> Assinatura</button>
            <button onClick={() => { setNewInstallment({ name: '', value: '', valueMode: 'total', installments: '2', day: 1, cardId: selectedCard.id, category: 'shopping', priority: 'comfort' }); setIsAddingInstallment(true); }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Plus className="w-3.5 h-3.5" /> Parcelamento</button>
          </div>
        </div>
      )}
      </>
      )}


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
                setNewCard({ name: '', color: 'bg-blue-600', last4: '', brand: 'Visa', dueDay: 10, closingDay: '', limit: '' });
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
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Limite Total (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Opcional · ex: 3000"
                  min={0}
                  value={newCard.limit ?? ''}
                  onChange={(e) => setNewCard({...newCard, limit: e.target.value})}
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
                setNewCard({ name: '', color: 'bg-blue-600', last4: '', brand: 'Visa', dueDay: 10, closingDay: '', limit: '' });
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

              {/* Categoria + Prioridade — necessário para classificar no Health Score */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Categoria</label>
                <select
                  value={newSub.category}
                  onChange={(e) => {
                    const newCat = e.target.value;
                    const catDef = CATEGORIES.expense.find(c => c.id === newCat);
                    setNewSub({
                      ...newSub,
                      category: newCat,
                      priority: catDef?.defaultPriority || newSub.priority
                    });
                  }}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none appearance-none transition-all ${
                    theme === 'light' ? 'bg-slate-50 border-slate-100 focus:border-purple-500 text-slate-800' : 'bg-slate-800 border-white/5 focus:border-purple-500 text-white'
                  }`}
                >
                  {CATEGORIES.expense.map(cat => (
                    <option key={cat.id} value={cat.id} className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Prioridade</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'essential', label: 'Essencial', color: 'emerald' },
                    { id: 'comfort', label: 'Conforto', color: 'amber' },
                    { id: 'superfluous', label: 'Supérfluo', color: 'rose' }
                  ].map(opt => {
                    const isSelected = newSub.priority === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setNewSub({...newSub, priority: opt.id})}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          isSelected
                            ? (opt.color === 'emerald'
                                ? (theme === 'light' ? 'bg-emerald-50 border-emerald-400' : 'bg-emerald-500/10 border-emerald-500/40')
                                : opt.color === 'rose'
                                ? (theme === 'light' ? 'bg-rose-50 border-rose-400' : 'bg-rose-500/10 border-rose-500/40')
                                : (theme === 'light' ? 'bg-amber-50 border-amber-400' : 'bg-amber-500/10 border-amber-500/40'))
                            : (theme === 'light' ? 'bg-slate-50 border-slate-100 hover:border-slate-200' : 'bg-white/5 border-white/5 hover:border-white/10')
                        }`}
                      >
                        <span className={`text-[9px] font-black uppercase tracking-widest ${
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
              <button type="button" onClick={() => setIsAddingSub(false)} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>Cancelar</button>
              <button type="submit" className="flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] bg-purple-500 hover:bg-purple-600 transition-all text-white shadow-lg shadow-purple-500/20 active:scale-95">Salvar Assinatura</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADD INSTALLMENT (dedicado, separado de Assinatura/Despesa) */}
      {isAddingInstallment && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <form onSubmit={handleAddInstallment} className={`border rounded-2xl w-full max-w-sm p-6 space-y-4 relative animate-in zoom-in-95 duration-300 shadow-2xl max-h-[92vh] overflow-y-auto custom-scrollbar ${
            theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
          }`}>
            <button
              type="button"
              onClick={() => setIsAddingInstallment(false)}
              className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors z-10 ${
                theme === 'light' ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/10 text-slate-500'
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-1">
              <div className={`p-2 rounded-xl shrink-0 ${theme === 'light' ? 'bg-rose-50' : 'bg-rose-500/10'}`}>
                <Hash className={`w-5 h-5 ${theme === 'light' ? 'text-rose-500' : 'text-rose-400'}`} />
              </div>
              <div>
                <h3 className={`text-base font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                  Novo Parcelamento
                </h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  Cadastre uma compra em parcelas
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Descrição</label>
                <input
                  type="text"
                  placeholder="ex: Notebook, Geladeira"
                  required
                  value={newInstallment.name}
                  onChange={(e) => setNewInstallment({...newInstallment, name: e.target.value})}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                    theme === 'light' ? 'bg-slate-50 border-slate-100 focus:border-rose-500 text-slate-800' : 'bg-white/5 border-white/5 focus:border-rose-500 text-white placeholder-slate-500'
                  }`}
                />
              </div>

              {/* Toggle: Valor total vs valor por parcela */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">O valor que vou digitar é:</label>
                <div className={`p-1 rounded-xl flex gap-1 ${theme === 'light' ? 'bg-slate-100' : 'bg-white/5'}`}>
                  <button
                    type="button"
                    onClick={() => setNewInstallment({...newInstallment, valueMode: 'total'})}
                    className={`flex-1 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${
                      newInstallment.valueMode === 'total'
                        ? (theme === 'light' ? 'bg-white text-rose-500 shadow-sm' : 'bg-white/10 text-rose-400')
                        : 'text-slate-500'
                    }`}
                  >
                    Valor Total
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewInstallment({...newInstallment, valueMode: 'per'})}
                    className={`flex-1 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${
                      newInstallment.valueMode === 'per'
                        ? (theme === 'light' ? 'bg-white text-rose-500 shadow-sm' : 'bg-white/10 text-rose-400')
                        : 'text-slate-500'
                    }`}
                  >
                    Por Parcela
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">
                    {newInstallment.valueMode === 'total' ? 'Valor Total (R$)' : 'Valor por Parcela (R$)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    required
                    value={newInstallment.value}
                    onChange={(e) => setNewInstallment({...newInstallment, value: e.target.value})}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                      theme === 'light' ? 'bg-slate-50 border-slate-100 focus:border-rose-500 text-slate-800' : 'bg-white/5 border-white/5 focus:border-rose-500 text-white placeholder-slate-500'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Nº de Parcelas</label>
                  <input
                    type="number"
                    min={2}
                    max={120}
                    placeholder="ex: 12"
                    required
                    value={newInstallment.installments}
                    onChange={(e) => setNewInstallment({...newInstallment, installments: e.target.value})}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                      theme === 'light' ? 'bg-slate-50 border-slate-100 focus:border-rose-500 text-slate-800' : 'bg-white/5 border-white/5 focus:border-rose-500 text-white placeholder-slate-500'
                    }`}
                  />
                </div>
              </div>

              {/* Preview do cálculo */}
              {newInstallment.value && newInstallment.installments && parseFloat(newInstallment.value) > 0 && parseInt(newInstallment.installments) > 0 && (
                <div className={`p-3 rounded-xl border text-center ${theme === 'light' ? 'bg-rose-50 border-rose-100' : 'bg-rose-500/5 border-rose-500/20'}`}>
                  <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest mb-1">
                    {newInstallment.valueMode === 'total' ? 'Cada parcela ficará em:' : 'Valor total da compra:'}
                  </p>
                  <p className="text-lg font-black text-rose-500">
                    R$ {(newInstallment.valueMode === 'total'
                      ? parseFloat(newInstallment.value) / parseInt(newInstallment.installments)
                      : parseFloat(newInstallment.value) * parseInt(newInstallment.installments)
                    ).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="text-xs font-bold text-rose-500/70 ml-1">
                      {newInstallment.valueMode === 'total' ? `× ${newInstallment.installments}x` : `(${newInstallment.installments}x)`}
                    </span>
                  </p>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Vincular Cartão</label>
                <select
                  value={newInstallment.cardId}
                  onChange={(e) => setNewInstallment({...newInstallment, cardId: e.target.value})}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none appearance-none transition-all ${
                    theme === 'light' ? 'bg-slate-50 border-slate-100 focus:border-rose-500 text-slate-800' : 'bg-white/5 border-white/5 focus:border-rose-500 text-white'
                  }`}
                >
                  <option value="" className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>Sem cartão (Avulso)</option>
                  {cards.map(c => (
                    <option key={c.id} value={c.id} className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>{c.name} (•• {c.last4})</option>
                  ))}
                </select>
              </div>

              {/* Dia da cobrança — só se não tiver cartão vinculado (cartão usa dueDay automaticamente) */}
              {!newInstallment.cardId && (
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Dia da Cobrança</label>
                  <input
                    type="number"
                    min={1} max={31}
                    placeholder="1-31"
                    required
                    value={newInstallment.day}
                    onChange={(e) => setNewInstallment({...newInstallment, day: e.target.value})}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                      theme === 'light' ? 'bg-slate-50 border-slate-100 focus:border-rose-500 text-slate-800' : 'bg-white/5 border-white/5 focus:border-rose-500 text-white placeholder-slate-500'
                    }`}
                  />
                </div>
              )}

              {/* Categoria */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Categoria</label>
                <select
                  value={newInstallment.category}
                  onChange={(e) => {
                    const newCat = e.target.value;
                    const catDef = CATEGORIES.expense.find(c => c.id === newCat);
                    setNewInstallment({
                      ...newInstallment,
                      category: newCat,
                      priority: catDef?.defaultPriority || newInstallment.priority
                    });
                  }}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none appearance-none transition-all ${
                    theme === 'light' ? 'bg-slate-50 border-slate-100 focus:border-rose-500 text-slate-800' : 'bg-slate-800 border-white/5 focus:border-rose-500 text-white'
                  }`}
                >
                  {CATEGORIES.expense.map(cat => (
                    <option key={cat.id} value={cat.id} className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Prioridade */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Prioridade</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'essential', label: 'Essencial', color: 'emerald' },
                    { id: 'comfort', label: 'Conforto', color: 'amber' },
                    { id: 'superfluous', label: 'Supérfluo', color: 'rose' }
                  ].map(opt => {
                    const isSelected = newInstallment.priority === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setNewInstallment({...newInstallment, priority: opt.id})}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          isSelected
                            ? (opt.color === 'emerald'
                                ? (theme === 'light' ? 'bg-emerald-50 border-emerald-400' : 'bg-emerald-500/10 border-emerald-500/40')
                                : opt.color === 'rose'
                                ? (theme === 'light' ? 'bg-rose-50 border-rose-400' : 'bg-rose-500/10 border-rose-500/40')
                                : (theme === 'light' ? 'bg-amber-50 border-amber-400' : 'bg-amber-500/10 border-amber-500/40'))
                            : (theme === 'light' ? 'bg-slate-50 border-slate-100 hover:border-slate-200' : 'bg-white/5 border-white/5 hover:border-white/10')
                        }`}
                      >
                        <span className={`text-[9px] font-black uppercase tracking-widest ${
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
              <button type="button" onClick={() => setIsAddingInstallment(false)} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>Cancelar</button>
              <button type="submit" className="flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] bg-rose-500 hover:bg-rose-600 transition-all text-white shadow-lg shadow-rose-500/20 active:scale-95">Salvar Parcelamento</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: VIEW INVOICE ITEMS */}
      {/* Modal: Histórico de faturas */}
      {historyCardId && (() => {
        const card = cards.find(c => c.id === historyCardId);
        if (!card) return null;
        const history = getInvoiceHistory(card);
        const statusMeta = {
          paid:    { label: 'Paga',      cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
          open:    { label: 'Em aberto', cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
          overdue: { label: 'Vencida',   cls: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
          future:  { label: 'Próxima',   cls: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
        };
        return (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className={`border rounded-[2rem] w-full max-w-lg p-6 relative max-h-[88vh] flex flex-col animate-in zoom-in-95 duration-300 ${theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Histórico de faturas</h3>
                  <p className="text-xs text-slate-500">{card.name} · •••• {card.last4 || '0000'}</p>
                </div>
                <button onClick={() => { setHistoryCardId(null); setExpandedHistoryMonth(null); }} className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {history.length === 0 ? (
                  <p className="text-center text-sm text-slate-500 py-10">Sem faturas registradas ainda.</p>
                ) : history.map(inv => {
                  const meta = statusMeta[inv.status];
                  const open = expandedHistoryMonth === inv.month;
                  return (
                    <div key={inv.month} className={`rounded-xl border ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50'}`}>
                      <button onClick={() => setExpandedHistoryMonth(open ? null : inv.month)} className="w-full flex items-center justify-between gap-3 p-3 text-left">
                        <div className="min-w-0">
                          <p className={`text-sm font-black capitalize ${isDark ? 'text-white' : 'text-slate-800'}`}>{inv.label}</p>
                          <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${meta.cls}`}>
                            {meta.label}{inv.status === 'paid' && inv.paidDate ? ` em ${new Date(inv.paidDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-sm font-black tabular-nums ${isDark ? 'text-white' : 'text-slate-800'}`}>R$ {fmt(inv.total)}</span>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {open && (
                        <div className={`px-3 pb-3 space-y-1.5 border-t pt-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                          {!inv.hasSnapshot && inv.items.length > 0 && (
                            <p className="text-[10px] text-amber-500/80 italic pb-1">≈ valores aproximados (fatura anterior à atualização)</p>
                          )}
                          {inv.items.length === 0 ? (
                            <p className="text-[11px] text-slate-500 py-1">{inv.hasSnapshot ? 'Sem itens nesta fatura.' : 'Detalhes não disponíveis. Total pago confirmado.'}</p>
                          ) : inv.items.map(it => (
                            <div key={it.id} className="flex items-center justify-between gap-2 text-[11px]">
                              <span className={`truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                {it.description}
                                {it.badge
                                  ? <span className="text-slate-500"> · {it.badge}</span>
                                  : (it.date ? <span className="text-slate-500"> · {new Date(it.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span> : '')}
                              </span>
                              <span className="font-bold tabular-nums text-rose-400 shrink-0">R$ {fmt(parseFloat(it.amount) || 0)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {viewingInvoiceCardId && (() => {
          const isOrphaned = viewingInvoiceCardId === 'orphaned';
          const card = isOrphaned 
            ? { name: 'Cartão Excluído', color: 'bg-slate-850', brand: 'Desconhecido', last4: '0000' }
            : cards.find(c => c.id === viewingInvoiceCardId);

          if (!card) return null;

          const allCardSubs = isOrphaned 
            ? subscriptions.filter(s => s.isInstallment && (!s.cardId || !cards.map(c => c.id).includes(s.cardId)))
            : getCardSubs(card.id);

          const { currentInvoiceMonth: modalInvoiceMonth, closingDay: modalClosingDay } = getUnpaidExpensesByPeriod(card);
          const cardSubs = isOrphaned
            ? allCardSubs
            : allCardSubs.filter(s => {
                if (s.lastPaidMonth === modalInvoiceMonth) return false;
                const subDay = parseInt(s.day) || 1;
                return isSubInInvoice(subDay, modalInvoiceMonth, modalClosingDay);
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
                                  onClick={() => openEditTransaction(exp)}
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
                                  onClick={() => openEditSub(sub)}
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

      {/* Aviso de endividamento — pagamento de parcela avulsa ou fatura supera saldo */}
      <OverdraftWarningModal
        isOpen={!!overdraftPending}
        amount={overdraftPending?.amount || 0}
        balance={Number(walletStats?.balance) || 0}
        itemName={overdraftPending?.itemName || 'Este pagamento'}
        onCancel={() => setOverdraftPending(null)}
        onConfirm={() => {
          if (!overdraftPending) return;
          if (overdraftPending.type === 'installment') {
            const { sub, createTransaction } = overdraftPending.payload;
            executePayInstallment(sub, createTransaction);
          } else if (overdraftPending.type === 'invoice') {
            executePayInvoice(overdraftPending.payload);
          }
        }}
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
      {editingTransaction && (() => {
        const inputCls = `w-full p-4 rounded-2xl border font-bold text-sm transition-all ${
          theme === 'light' ? 'bg-slate-50 focus:bg-white border-slate-100 text-slate-800' : 'bg-white/5 focus:bg-white/10 border-white/5 text-white'
        }`;
        const PRIORITY_OPTS = [
          { id: 'essential',   label: 'Essencial', color: 'emerald' },
          { id: 'comfort',     label: 'Conforto',  color: 'amber'   },
          { id: 'superfluous', label: 'Supérfluo', color: 'rose'    },
        ];
        return (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <form onSubmit={handleUpdateTransaction} className={`border rounded-[3rem] w-full max-w-sm p-8 space-y-5 animate-in zoom-in-95 duration-300 max-h-[92vh] overflow-y-auto custom-scrollbar ${
              theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl shadow-emerald-500/10'
            }`}>
              <h3 className={`text-xl font-bold tracking-wide uppercase ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Editar Gasto</h3>

              <input
                type="text"
                placeholder="Descrição"
                required
                value={editingTransaction.description}
                onChange={(e) => setEditingTransaction({...editingTransaction, description: e.target.value})}
                className={inputCls}
              />

              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Valor R$"
                  required
                  value={editingTransaction.amount}
                  onChange={(e) => setEditingTransaction({...editingTransaction, amount: e.target.value})}
                  className={inputCls}
                />
                <input
                  type="date"
                  required
                  value={editingTransaction.date}
                  onChange={(e) => setEditingTransaction({...editingTransaction, date: e.target.value})}
                  className={`${inputCls} ${theme === 'light' ? '[color-scheme:light]' : '[color-scheme:dark]'}`}
                />
              </div>

              {/* Cartão Vinculado — agora aparece carregado */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Cartão Vinculado</label>
                <select
                  value={editingTransaction.cardId || ''}
                  onChange={(e) => setEditingTransaction({...editingTransaction, cardId: e.target.value})}
                  className={`${inputCls} outline-none appearance-none cursor-pointer`}
                >
                  <option value="" className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>Sem cartão</option>
                  {cards.map(c => (
                    <option key={c.id} value={c.id} className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>{c.name} (•• {c.last4})</option>
                  ))}
                </select>
              </div>

              {/* Categoria */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Categoria</label>
                <select
                  required
                  value={editingTransaction.category || 'other'}
                  onChange={(e) => {
                    const newCat = e.target.value;
                    const catDef = CATEGORIES.expense.find(c => c.id === newCat);
                    setEditingTransaction({
                      ...editingTransaction,
                      category: newCat,
                      priority: catDef?.defaultPriority || editingTransaction.priority,
                    });
                  }}
                  className={`${inputCls} outline-none appearance-none cursor-pointer`}
                >
                  {CATEGORIES.expense.map(cat => (
                    <option key={cat.id} value={cat.id} className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Prioridade */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Prioridade</label>
                <div className="grid grid-cols-3 gap-2">
                  {PRIORITY_OPTS.map(opt => {
                    const isSelected = editingTransaction.priority === opt.id;
                    const selBg = opt.color === 'emerald'
                      ? (theme === 'light' ? 'bg-emerald-50 border-emerald-400' : 'bg-emerald-500/10 border-emerald-500/40')
                      : opt.color === 'rose'
                        ? (theme === 'light' ? 'bg-rose-50 border-rose-400' : 'bg-rose-500/10 border-rose-500/40')
                        : (theme === 'light' ? 'bg-amber-50 border-amber-400' : 'bg-amber-500/10 border-amber-500/40');
                    const selText = opt.color === 'emerald' ? 'text-emerald-600'
                      : opt.color === 'rose' ? 'text-rose-600'
                      : 'text-amber-600';
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setEditingTransaction({...editingTransaction, priority: opt.id})}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          isSelected
                            ? selBg
                            : (theme === 'light' ? 'bg-slate-50 border-slate-100 hover:border-slate-200' : 'bg-white/5 border-white/5 hover:border-white/10')
                        }`}
                      >
                        <span className={`text-[9px] font-black uppercase tracking-widest ${
                          isSelected ? selText : (theme === 'light' ? 'text-slate-500' : 'text-slate-400')
                        }`}>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingTransaction(null)} className={`flex-1 py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>Cancelar</button>
                <button type="submit" className="flex-1 py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20">Salvar Alterações</button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* MODAL: EDIT SUB (assinatura ou parcelamento) */}
      {editingSub && (() => {
        // Diferencia visual e textualmente parcelamento vs assinatura.
        // Antes: o mesmo modal abria pra ambos como "Editar Assinatura".
        const isInst = editingSub.isInstallment;
        const accent = isInst ? 'rose' : 'purple';
        const accentBg = isInst ? 'bg-rose-500/10 border-rose-500/20' : 'bg-purple-500/10 border-purple-500/20';
        const accentText = isInst ? 'text-rose-500' : 'text-purple-500';
        const accentRing = isInst
          ? 'focus:border-rose-500/50 focus:ring-rose-500/10'
          : 'focus:border-purple-500/50 focus:ring-purple-500/10';
        const accentBtn = isInst
          ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
          : 'bg-purple-500 hover:bg-purple-600 shadow-purple-500/20';
        const ModalIcon = isInst ? Hash : Repeat;
        const inputCls = `w-full p-4 rounded-2xl border transition-all text-sm font-bold ${
          theme === 'light'
            ? `bg-slate-50 focus:bg-white border-slate-100 focus:ring-4 ${accentRing} text-slate-800`
            : `bg-slate-800/50 focus:bg-slate-800 border-white/5 focus:ring-4 ${accentRing} text-white placeholder-slate-500`
        }`;
        const PRIORITY_OPTS = [
          { id: 'essential',   label: 'Essencial', color: 'emerald' },
          { id: 'comfort',     label: 'Conforto',  color: 'amber'   },
          { id: 'superfluous', label: 'Supérfluo', color: 'rose'    },
        ];

        return (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <form onSubmit={handleUpdateSub} className={`border rounded-[3rem] w-full max-w-sm p-8 space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl max-h-[92vh] overflow-y-auto custom-scrollbar ${
              theme === 'light' ? 'bg-white border-slate-100' : `bg-slate-900 border-white/10 ${isInst ? 'shadow-rose-500/10' : 'shadow-purple-500/10'}`
            }`}>
              <div className="text-center space-y-2">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 border ${accentBg}`}>
                  <ModalIcon className={`w-8 h-8 ${accentText}`} />
                </div>
                <h3 className={`text-xl font-medium uppercase tracking-widest ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                  {isInst ? 'Editar Parcelamento' : 'Editar Assinatura'}
                </h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  {isInst
                    ? `Parcela ${editingSub.currentInstallment || 1} de ${editingSub.totalInstallments || '?'}`
                    : 'Ajuste os dados da cobrança recorrente'}
                </p>
              </div>

              <div className="space-y-5">
                {/* Nome */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                    {isInst ? 'Descrição da Compra' : 'Nome da Assinatura'}
                  </label>
                  <input
                    type="text"
                    placeholder={isInst ? 'ex: Notebook, Geladeira' : 'ex: Netflix, Spotify'}
                    required
                    value={editingSub.name}
                    onChange={(e) => setEditingSub({...editingSub, name: e.target.value})}
                    className={inputCls}
                  />
                </div>

                {/* Valor + Dia (se sem cartão) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                      {isInst ? 'Valor / Parcela' : 'Valor'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="R$ 0,00"
                      required
                      value={editingSub.value}
                      onChange={(e) => setEditingSub({...editingSub, value: e.target.value})}
                      className={inputCls}
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
                        className={inputCls}
                      />
                    </div>
                  )}
                </div>

                {/* Cartão Vinculado — agora carregado corretamente do doc */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Cartão Vinculado</label>
                  <select
                    value={editingSub.cardId || ''}
                    onChange={(e) => setEditingSub({...editingSub, cardId: e.target.value})}
                    className={`${inputCls} appearance-none outline-none`}
                  >
                    <option value="" className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>
                      {isInst ? 'Sem cartão (Avulso)' : 'Sem cartão (Avulsa)'}
                    </option>
                    {cards.map(c => (
                      <option key={c.id} value={c.id} className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>
                        {c.name} (•• {c.last4})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Categoria */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Categoria</label>
                  <select
                    required
                    value={editingSub.category || 'other'}
                    onChange={(e) => {
                      const newCat = e.target.value;
                      const catDef = CATEGORIES.expense.find(c => c.id === newCat);
                      setEditingSub({
                        ...editingSub,
                        category: newCat,
                        priority: catDef?.defaultPriority || editingSub.priority,
                      });
                    }}
                    className={`${inputCls} appearance-none outline-none`}
                  >
                    {CATEGORIES.expense.map(cat => (
                      <option key={cat.id} value={cat.id} className={theme === 'light' ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                {/* Prioridade — agora editável */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Prioridade</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PRIORITY_OPTS.map(opt => {
                      const isSelected = editingSub.priority === opt.id;
                      const selBg = opt.color === 'emerald'
                        ? (theme === 'light' ? 'bg-emerald-50 border-emerald-400' : 'bg-emerald-500/10 border-emerald-500/40')
                        : opt.color === 'rose'
                          ? (theme === 'light' ? 'bg-rose-50 border-rose-400' : 'bg-rose-500/10 border-rose-500/40')
                          : (theme === 'light' ? 'bg-amber-50 border-amber-400' : 'bg-amber-500/10 border-amber-500/40');
                      const selText = opt.color === 'emerald' ? 'text-emerald-600'
                        : opt.color === 'rose' ? 'text-rose-600'
                        : 'text-amber-600';
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setEditingSub({...editingSub, priority: opt.id})}
                          className={`p-2 rounded-xl border text-center transition-all ${
                            isSelected
                              ? selBg
                              : (theme === 'light' ? 'bg-slate-50 border-slate-100 hover:border-slate-200' : 'bg-white/5 border-white/5 hover:border-white/10')
                          }`}
                        >
                          <span className={`text-[9px] font-black uppercase tracking-widest ${
                            isSelected ? selText : (theme === 'light' ? 'text-slate-500' : 'text-slate-400')
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
                  onClick={() => setEditingSub(null)}
                  className={`flex-1 py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all text-white shadow-lg ${accentBtn}`}
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        );
      })()}
    </div>
  );
};

export default CardsTab;
