import React, { useState, useMemo, useEffect } from 'react';
import {
    Plus,
    TrendingDown,
    PiggyBank,
    Calendar,
    Tag,
    DollarSign,
    X,
    ArrowRight,
    TrendingUp,
    Circle,
    ChevronRight,
    ChevronLeft,
    ChevronDown,
    Clock,
    Trash2,
    Pencil,
    Filter,
    Shield,
    Sparkles,
    Flame,
    Wallet,
    Eye,
    EyeOff,
    Info,
    CreditCard
} from 'lucide-react';
import TrialLimitModal from './TrialLimitModal';
import OverdraftWarningModal from './OverdraftWarningModal';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, query, where, onSnapshot } from 'firebase/firestore';
import { CATEGORIES } from '../constants/categories';

export default function ExitsTab({ transactions, savingsJars = [], cdiRate = 10.65, cards = [], subscriptions = [], walletStats, hideBalance, toggleHideBalance, setActiveTab, initialSubTab }) {
    const { theme } = useTheme();
    const { currentUser, planLevel, isAdmin, isTrial } = useAuth();

    // Limites aplicados ao trial e ao Plano Gratuito permanente
    const isLimited = isTrial || planLevel === 'free';
    const TRIAL_EXPENSE_LIMIT = 7; // por mês (renova mensalmente)
    const [showTrialModal, setShowTrialModal] = useState(false);

    // States
    const [showModal, setShowModal] = useState(false);
    const [step, setStep] = useState('choice'); // 'choice' | 'expense' | 'investment' | 'success' | 'warning'
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editingIsSubscription, setEditingIsSubscription] = useState(false);
    const [subTab, setSubTab] = useState(initialSubTab || 'despesas'); // 'despesas' | 'reservas'

    // Sincroniza com a sub-aba vinda da sidebar/URL (ex: clicar em "Aportes")
    useEffect(() => {
        if (initialSubTab && initialSubTab !== subTab) setSubTab(initialSubTab);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialSubTab]);
    const [isInstallment, setIsInstallment] = useState(false);
    const [installments, setInstallments] = useState('2');
    const [isRecurring, setIsRecurring] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('pix');
    const [selectedCardId, setSelectedCardId] = useState('');
    const [cardError, setCardError] = useState('');
    const [installmentMode, setInstallmentMode] = useState('total'); // 'total' | 'per_installment'

    // Form States
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [amountError, setAmountError] = useState('');
    const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [category, setCategory] = useState('other');
    const [cdiPercent, setCdiPercent] = useState('100');
    const [pendingSave, setPendingSave] = useState(null); // Para guardar o que seria salvo após o aviso
    
    // Destination States (Caixinhas vs Investimentos)
    const [selectedDestination, setSelectedDestination] = useState(''); // 'jar_ID', 'inv_ID', 'new_jar', 'new_inv'
    const [destinationType, setDestinationType] = useState('jar'); // 'jar' | 'inv'
    const [isNewReserve, setIsNewReserve] = useState(false);
    
    const [reserveType, setReserveType] = useState('cofrinho');
    const [isInstallmentSuccess, setIsInstallmentSuccess] = useState(false);
    // 'jar' = caixinha flow, 'patrimonio' = simple debit + guidance
    const [investMode, setInvestMode] = useState(null);
    const [savedToPatrimonio, setSavedToPatrimonio] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState(null);
    const [investments, setInvestments] = useState([]);
    
    // Month Navigation
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
    // Category Filter
    const [selectedCategory, setSelectedCategory] = useState(null);
    // Priority
    const [priority, setPriority] = useState('comfort');
    const [showCreditCard, setShowCreditCard] = useState(false);
    const [selectedCardFilter, setSelectedCardFilter] = useState('all');
    const [hidePaidInvoices, setHidePaidInvoices] = useState(false);
    const [fixedExpenseWarning, setFixedExpenseWarning] = useState(false);
    const [installmentWarning, setInstallmentWarning] = useState(false);

    const PRIORITY_OPTIONS = [
        { id: 'essential', label: 'Essencial', icon: Shield, color: 'emerald', description: 'Necessidade básica' },
        { id: 'comfort', label: 'Conforto', icon: Sparkles, color: 'amber', description: 'Qualidade de vida' },
        { id: 'superfluous', label: 'Supérfluo', icon: Flame, color: 'rose', description: 'Dispensável' }
    ];

    const handlePrevMonth = () => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const prev = new Date(year, month - 2, 1);
        setSelectedMonth(prev.toISOString().slice(0, 7));
        setSelectedCategory(null);
    };

    const handleNextMonth = () => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const next = new Date(year, month, 1);
        setSelectedMonth(next.toISOString().slice(0, 7));
        setSelectedCategory(null);
    };

    // Load Investments
    React.useEffect(() => {
        if (!currentUser) return;
        const q = query(collection(db, 'investments'), where('userId', '==', currentUser.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setInvestments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [currentUser]);

    const isPremiumUser = planLevel === 'premium' || planLevel === 'lifetime' || isAdmin;

    const monthLabel = useMemo(() => {
        const [year, month] = selectedMonth.split('-').map(Number);
        return new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }, [selectedMonth]);

    // Filtered Transactions (Only Expenses/Exits)
    const exits = useMemo(() => {
        let baseTxs = [...transactions];
        
        // Inject subscriptions to match AnalysisTab behavior
        const [selYear, selMonthNum] = selectedMonth.split('-').map(Number);
        const selTotalMonths = selYear * 12 + selMonthNum;

        // Fallback conservador: subs legadas (sem createdAt) entram no mês atual,
        // não em Jan/2023 — antes inflavam 3 anos de histórico inteiro.
        const nowDateForFallback = new Date();
        subscriptions.forEach(s => {
            let createdDate = s.createdAt ? new Date(s.createdAt) : nowDateForFallback;
            if (isNaN(createdDate.getTime())) createdDate = nowDateForFallback;

            const createdTotalMonths = createdDate.getFullYear() * 12 + (createdDate.getMonth() + 1);
            const monthsPassed = selTotalMonths - createdTotalMonths;

            if (monthsPassed < 0) return; // Future

            if (s.type === 'installment') {
                if (monthsPassed >= (s.totalInstallments || 1)) return; // Finished
            }

            const dueDay = parseInt(s.day) || createdDate.getDate();
            const daysInMonth = new Date(selYear, selMonthNum, 0).getDate();
            const clampedDay = Math.min(dueDay, daysInMonth);
            const dayStr = String(clampedDay).padStart(2, '0');

            baseTxs.push({
                id: s.id + '-' + selectedMonth,
                description: s.type === 'installment' ? `${s.name || s.service} (${monthsPassed + 1}/${s.totalInstallments})` : (s.name || s.service),
                amount: parseFloat(s.value) || 0,
                type: 'expense',
                category: s.category || (s.type === 'installment' ? 'other' : 'subscriptions'),
                date: `${selectedMonth}-${dayStr}T12:00:00Z`,
                month: selectedMonth,
                paymentMethod: s.cardId ? 'credito' : 'pix',
                invoiceStatus: 'unpaid',
                priority: 'superfluous',
                isSubscription: true,
                cardId: s.cardId
            });
        });

        return baseTxs
            .filter(t => t.type === 'expense' && (showCreditCard ? t.paymentMethod === 'credito' : t.paymentMethod !== 'credito'))
            .filter(t => {
                if (showCreditCard && selectedCardFilter !== 'all') {
                    // Subscriptions use cardId, regular transactions use selectedCardId
                    const txCardId = t.isSubscription ? t.cardId : t.selectedCardId;
                    if (txCardId !== selectedCardFilter) return false;
                }
                if (showCreditCard && hidePaidInvoices && t.paymentMethod === 'credito') {
                    return t.invoiceStatus !== 'paid';
                }
                return true;
            })
            .sort((a, b) => {
                const dateDiff = new Date(b.date) - new Date(a.date);
                if (dateDiff !== 0) return dateDiff;
                return (b.createdAt || 0) - (a.createdAt || 0);
            });
    }, [transactions, subscriptions, showCreditCard, selectedCardFilter, hidePaidInvoices, selectedMonth]);

    // Check hash for auto-opening modal
    useEffect(() => {
        if (window.location.hash === '#novo-parcelamento') {
            setShowModal(true);
            setIsInstallment(true);
            setPaymentMethod('credito');
            // Remove the hash without triggering a scroll jump
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }, [showModal]);

    // Calcular saldo total para o aviso — usa o mesmo walletStats.balance
    // que é calculado via calculateCumulativeBalance no App.jsx, garantindo
    // consistência com o saldo mostrado ao usuário em todos os lugares.
    const availableBalance = useMemo(() => {
        if (walletStats && typeof walletStats.balance === 'number') return walletStats.balance;
        // Fallback (caso walletStats não tenha sido passado): calcula localmente
        // com as mesmas exclusões usadas em calculateCumulativeBalance.
        const income = transactions
            .filter(t => t.type === 'income' && t.paymentMethod !== 'credito')
            .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
        const expense = transactions
            .filter(t => t.type === 'expense' && t.paymentMethod !== 'credito')
            .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
        return income - expense;
    }, [transactions, walletStats]);

    // Filter by selected month
    const monthExits = useMemo(() => {
        return exits.filter(t => {
            const txMonth = t.month || (t.date ? t.date.slice(0, 7) : '');
            return txMonth === selectedMonth;
        });
    }, [exits, selectedMonth]);

    const regularExpenses = useMemo(() => {
        let filtered = monthExits.filter(t => t.category !== 'investment');
        if (selectedCategory) {
            filtered = filtered.filter(t => t.category === selectedCategory);
        }
        return filtered;
    }, [monthExits, selectedCategory]);

    const investmentExits = useMemo(() => {
        return monthExits.filter(t => t.category === 'investment');
    }, [monthExits]);

    // Available categories for filter chips
    const availableCategories = useMemo(() => {
        const cats = {};
        monthExits.filter(t => t.category !== 'investment').forEach(t => {
            const cat = t.category || 'other';
            cats[cat] = (cats[cat] || 0) + 1;
        });
        return Object.entries(cats).map(([id, count]) => {
            const catDef = CATEGORIES.expense.find(c => c.id === id) || { label: 'Outro', icon: Circle, color: 'text-slate-400' };
            return { id, count, ...catDef };
        }).sort((a, b) => b.count - a.count);
    }, [monthExits]);

    const resetForm = () => {
        setDescription('');
        setAmount('');
        setAmountError('');
        setDate(new Date().toLocaleDateString('en-CA'));
        setCategory('other');
        setCdiPercent('100');
        setIsInstallmentSuccess(false);
        setStep('choice');
        setShowModal(false);
        setIsSaving(false);
        setPendingSave(null);
        setSelectedDestination('');
        setDestinationType('jar');
        setIsNewReserve(false);
        setReserveType('cofrinho');
        setInvestMode(null);
        setSavedToPatrimonio(false);
        setIsInstallment(false);
        setInstallments('2');
        setIsRecurring(false);
        setPaymentMethod('pix');
        setSelectedCardId('');
        setCardError('');
        setInstallmentMode('total');
        setPriority('comfort');
        setEditingId(null);
        setEditingIsSubscription(false);
    };

    const handleSaveGasto = async (e) => {
        e.preventDefault();
        if (!description || !amount || isSaving) return;
        const val = parseFloat(amount);
        if (!val || val <= 0) { setAmountError('Informe um valor válido maior que zero.'); return; }
        setAmountError('');
        
        // Validação de cartão — mensagem clara inline em vez de alert genérico
        if (paymentMethod === 'credito' && !selectedCardId) {
            setCardError(
                cards.length === 0
                    ? 'Você ainda não cadastrou nenhum cartão. Cadastre um para lançar gastos no crédito.'
                    : 'Selecione em qual cartão essa compra foi feita.'
            );
            return;
        }
        setCardError('');

        setIsSaving(true);

        try {
            const transactionValue = isInstallment && installmentMode === 'total' 
                ? (val / parseInt(installments)) 
                : val;

            let transactionDate = new Date();
            if (date && date.includes('-')) {
                const [y, m, d] = date.split('-').map(Number);
                transactionDate = new Date(y, m - 1, d, 12, 0, 0);
            }

            const transactionData = {
                description,
                amount: transactionValue,
                type: 'expense',
                category,
                date: transactionDate.toISOString(),
                userId: currentUser.uid,
                month: date.slice(0, 7),
                createdAt: Date.now(),
                isFixed: isRecurring,
                paymentMethod,
                selectedCardId: paymentMethod === 'credito' ? selectedCardId : null,
                invoiceStatus: paymentMethod === 'credito' ? 'unpaid' : null,
                isInstallment,
                totalInstallments: isInstallment ? parseInt(installments) : null,
                priority,
                installmentMode
            };

            // If it's recurring or installment, also create a subscription entry for the Cards Tab.
            // Só em NOVOS lançamentos — em edições isso duplicaria a assinatura/parcelamento.
            if (!editingId && (isRecurring || isInstallment)) {
                const subData = {
                    name: description,
                    value: transactionValue,
                    day: parseInt(date.split('-')[2], 10),
                    cardId: selectedCardId || '',
                    userId: currentUser.uid,
                    isInstallment: isInstallment,
                    totalInstallments: isInstallment ? parseInt(installments) : null,
                    currentInstallment: 1,
                    type: isRecurring ? 'recurring' : 'installment',
                    createdAt: Date.now(),
                    installmentMode,
                    category: category
                };
                await addDoc(collection(db, 'subscriptions'), subData);
            }

            // VERIFICAÇÃO DE SALDO (Apenas para novos lançamentos, não para edições).
            // IMPORTANTE: compras no CRÉDITO/parcelamento NÃO saem do saldo agora —
            // só impactam a carteira quando a fatura é paga. Por isso o aviso de
            // saldo insuficiente NÃO deve aparecer aqui para crédito; ele aparece
            // no momento de pagar a fatura (na aba Cartões).
            const impactsBalanceNow = paymentMethod !== 'credito' && !isInstallment;
            if (!editingId && impactsBalanceNow && val > availableBalance) {
                setPendingSave({ type: 'expense', data: transactionData, amount: val, itemName: description || 'Esta despesa' });
                setIsSaving(false);
                setShowModal(false); // fecha o modal de despesa pra dar lugar ao aviso
                return;
            }

            if (editingId && editingIsSubscription) {
                const dayFromDate = parseInt(date.split('-')[2], 10);
                await updateDoc(doc(db, 'subscriptions', editingId), {
                    name: description,
                    value: parseFloat(amount),
                    day: dayFromDate,
                    category,
                    cardId: paymentMethod === 'credito' ? selectedCardId : ''
                });
                resetForm();
            } else if (editingId) {
                const { createdAt, ...updateData } = transactionData;
                await updateDoc(doc(db, 'transactions', editingId), updateData);
                resetForm();
            } else {
                // Se for parcelamento, NÃO adicionamos a transação direta para evitar duplicidade com a aba Cartões
                if (!isInstallment) {
                    // Reforço do limite NO SALVAMENTO (despesas/mês do próprio lançamento).
                    const targetMonth = transactionData.month;
                    const expenseCount = transactions.filter(t => t.type === 'expense' && ((t.month || (t.date ? String(t.date).slice(0, 7) : '')) === targetMonth)).length;
                    if (isLimited && expenseCount >= TRIAL_EXPENSE_LIMIT) {
                        setShowModal(false);
                        setIsSaving(false);
                        setShowTrialModal(true);
                        return;
                    }
                    await addDoc(collection(db, 'transactions'), transactionData);
                } else {
                    setIsInstallmentSuccess(true);
                }

                setIsSaving(false);
                setStep('success');
            }
        } catch (error) {
            console.error("Erro ao salvar gasto:", error);
            setIsSaving(false);
        }
    };

    const handleEdit = (t) => {
        if (t.isFixed || t.category === 'conta_fixa') {
            setFixedExpenseWarning(true);
            return;
        }
        // Parcelamento NÃO é editado pela aba Despesas — orienta o usuário a usar
        // a aba Cartões › Parcelamentos ativos (onde fica o editor dedicado).
        if (t.isSubscription) {
            const subId = t.id.replace(/-\d{4}-\d{2}$/, '');
            const subRef = subscriptions.find(s => s.id === subId);
            if (subRef && (subRef.type === 'installment' || subRef.isInstallment)) {
                setInstallmentWarning(true);
                return;
            }
        }
        // Para assinaturas/parcelamentos, a "transação" exibida é uma ocorrência gerada
        // (usa cardId e tem a descrição com sufixo "(n/total)"). Carregamos os dados a
        // partir da subscription REAL para preencher o formulário corretamente.
        let sub = null;
        if (t.isSubscription) {
            const realSubId = t.id.replace(/-\d{4}-\d{2}$/, '');
            sub = subscriptions.find(s => s.id === realSubId) || null;
            setEditingId(realSubId);
            setEditingIsSubscription(true);
        } else {
            setEditingId(t.id);
            setEditingIsSubscription(false);
        }

        // Remove "Investimento: " e o sufixo de parcela "(1/12)" para não duplicar ao salvar.
        const baseDescription = (sub?.name ?? t.description ?? '')
            .replace('Investimento: ', '')
            .replace(/\s*\(\d+\/\d+\)\s*$/, '');

        setDescription(baseDescription);
        setAmount(String((sub?.value ?? t.amount) ?? ''));
        setDate(new Date(t.date).toLocaleDateString('en-CA'));
        setCategory(sub?.category ?? t.category);
        setIsRecurring(t.isFixed || sub?.type === 'recurring' || false);
        const isInst = sub ? (sub.isInstallment || sub.type === 'installment') : (t.isInstallment || false);
        setIsInstallment(isInst);
        setInstallments((sub?.totalInstallments ?? t.totalInstallments)?.toString() || '2');
        // Cartão: ocorrências usam cardId; lançamentos diretos usam selectedCardId.
        const cardId = sub?.cardId || t.selectedCardId || t.cardId || '';
        setPaymentMethod(cardId ? 'credito' : (t.paymentMethod || 'pix'));
        setSelectedCardId(cardId);
        setInstallmentMode(sub?.installmentMode ?? t.installmentMode ?? 'total');
        setPriority(t.priority || CATEGORIES.expense.find(c => c.id === (sub?.category ?? t.category))?.defaultPriority || 'comfort');
        
        if (t.category === 'investment') {
            setStep('investment');
        } else {
            setStep('expense');
        }
        setShowModal(true);
    };

    const handleDelete = (transaction) => {
        if (transaction.isFixed || transaction.category === 'conta_fixa') {
            setFixedExpenseWarning(true);
            return;
        }
        setTransactionToDelete(transaction);
    };

    const confirmDelete = async () => {
        if (!transactionToDelete) return;
        const transaction = transactionToDelete;
        try {
            // 1. Delete the transaction
            await deleteDoc(doc(db, 'transactions', transaction.id));

            // 2. If it was an investment, try to find and delete the corresponding jar
            if (transaction.category === 'investment') {
                const jarName = transaction.description.replace('Investimento: ', '');
                const qJars = query(
                    collection(db, 'savings_jars'), 
                    where('userId', '==', currentUser.uid),
                    where('name', '==', jarName)
                );
                
                const { getDocs } = await import('firebase/firestore');
                const jarSnap = await getDocs(qJars);
                
                // Delete all jars with this name (usually just one, but safe)
                const deletePromises = jarSnap.docs.map(d => deleteDoc(doc(db, 'savings_jars', d.id)));
                await Promise.all(deletePromises);
                console.log("[Dev] Cofrinho associado removido.");
            }
        } catch (err) {
            console.error("Erro ao deletar:", err);
        } finally {
            setTransactionToDelete(null);
        }
    };

    const handleSaveInvestimento = async (e) => {
        e.preventDefault();
        if (!description || !amount || isSaving) return;

        // Patrimônio mode doesn't need a destination picker
        if (investMode !== 'patrimonio' && !isNewReserve && !selectedDestination) {
            alert("Selecione um destino ou escolha 'Criar Nova'");
            return;
        }

        setIsSaving(true);

        try {
            const val = parseFloat(amount);
            const perc = parseFloat(cdiPercent) || 100;
            const now = new Date();

            const transactionData = {
                description: `Investimento: ${description}`,
                amount: val,
                type: 'expense',
                category: 'investment',
                date: now.toISOString(),
                userId: currentUser.uid,
                month: now.toISOString().slice(0, 7),
                createdAt: Date.now()
            };

            let jarDataToSave = null;
            let existingJarId = null;
            let invDataToSave = null;
            let existingInvId = null;

            if (destinationType === 'jar') {
                if (selectedDestination && !isNewReserve) {
                    // UPDATE EXISTING JAR
                    const jarId = selectedDestination.replace('jar_', '');
                    const jar = savingsJars.find(j => j.id === jarId);
                    if (jar) {
                        existingJarId = jar.id;
                        const cdiAnual = (cdiRate || 10.65) / 100;
                        const percent = (parseFloat(jar.cdiPercent) || 100) / 100;
                        const dailyRate = Math.pow(1 + (cdiAnual * percent), 1 / 365) - 1;
                        const lastUpdate = jar.updatedAt ? new Date(jar.updatedAt) : (jar.createdAt ? new Date(jar.createdAt) : new Date());
                        const diffDays = Math.max(0, now - lastUpdate) / (1000 * 60 * 60 * 24);
                        
                        const jarBalance = parseFloat(jar.balance) || 0;
                        const currentDynamicBalance = jarBalance * Math.pow(1 + dailyRate, diffDays);
                        
                        jarDataToSave = {
                            balance: currentDynamicBalance + val,
                            updatedAt: now.toISOString()
                        };
                    }
                } else {
                    // CREATE NEW JAR
                    jarDataToSave = {
                        name: description,
                        balance: val,
                        cdiPercent: perc,
                        type: reserveType,
                        color: 'emerald',
                        userId: currentUser.uid,
                        createdAt: now.toISOString(),
                        updatedAt: now.toISOString()
                    };
                }
            } else if (destinationType === 'inv') {
                if (selectedDestination && !isNewReserve) {
                    const invId = selectedDestination.replace('inv_', '');
                    const inv = investments.find(i => i.id === invId);
                    if (inv) {
                        existingInvId = inv.id;
                        if (inv.type === 'renda_fixa') {
                            invDataToSave = {
                                totalApplied: (parseFloat(inv.totalApplied || inv.purchasePrice * inv.quantity || 0)) + val,
                                updatedAt: now.toISOString()
                            };
                        } else {
                            const q_new = 1;
                            const v_new = val;
                            const q_old = inv.quantity || 0;
                            const p_old = inv.purchasePrice || 0;
                            const q_total = q_old + q_new;
                            const p_avg = ((q_old * p_old) + v_new) / q_total;
                            
                            invDataToSave = {
                                quantity: q_total,
                                purchasePrice: p_avg,
                                updatedAt: now.toISOString()
                            };
                        }
                    }
                } else {
                    invDataToSave = {
                        name: description,
                        type: 'renda_fixa',
                        quantity: 1,
                        purchasePrice: val,
                        totalApplied: val,
                        isUSD: false,
                        cdiPercent: perc,
                        userId: currentUser.uid,
                        createdAt: now.toISOString(),
                        updatedAt: now.toISOString()
                    };
                }
            }

            // VERIFICAÇÃO DE SALDO — usa OverdraftWarningModal padronizado
            if (!editingId && val > availableBalance) {
                setPendingSave({
                    type: 'investment',
                    transaction: transactionData,
                    jar: jarDataToSave,
                    jarId: existingJarId,
                    inv: invDataToSave,
                    invId: existingInvId,
                    destinationType,
                    amount: val,
                    itemName: description ? `Aporte: ${description}` : 'Este aporte'
                });
                setIsSaving(false);
                setShowModal(false);
                return;
            }

            if (editingId) {
                await updateDoc(doc(db, 'transactions', editingId), {
                    description: `Investimento: ${description}`,
                    amount: val,
                    type: 'expense',
                    category: 'investment',
                    updatedAt: Date.now()
                });
                resetForm();
            } else {
                // Salvamento
                const tRef = collection(db, 'transactions');
                await addDoc(tRef, transactionData);

                // Patrimônio mode: só salva a transação — usuário registra o ativo manualmente
                if (investMode === 'patrimonio') {
                    setSavedToPatrimonio(true);
                } else if (destinationType === 'jar') {
                    if (existingJarId) {
                        await updateDoc(doc(db, 'savings_jars', existingJarId), jarDataToSave);
                    } else {
                        await addDoc(collection(db, 'savings_jars'), jarDataToSave);
                    }
                }

                setIsSaving(false);
                setStep('success');
            }
        } catch (error) {
            console.error("Erro crítico ao salvar investimento:", error);
            alert('Erro ao processar lançamento.');
            setIsSaving(false);
        }
    };

    const handleConfirmWarning = async () => {
        if (!pendingSave || isSaving) return;
        setIsSaving(true);

        try {
            if (pendingSave.type === 'expense') {
                if (!pendingSave.data.isInstallment) {
                    await addDoc(collection(db, 'transactions'), pendingSave.data);
                } else {
                    setIsInstallmentSuccess(true);
                }
            } else if (pendingSave.type === 'investment') {
                await addDoc(collection(db, 'transactions'), pendingSave.transaction);

                if (pendingSave.destinationType === 'jar') {
                    if (pendingSave.jarId) {
                        await updateDoc(doc(db, 'savings_jars', pendingSave.jarId), pendingSave.jar);
                    } else {
                        await addDoc(collection(db, 'savings_jars'), pendingSave.jar);
                    }
                } else if (pendingSave.destinationType === 'inv') {
                    if (pendingSave.invId) {
                        await updateDoc(doc(db, 'investments', pendingSave.invId), pendingSave.inv);
                    } else {
                        await addDoc(collection(db, 'investments'), pendingSave.inv);
                    }
                }
            }

            setIsSaving(false);
            setStep('success');
            setShowModal(true); // reabre o modal pra mostrar a tela de sucesso
            setPendingSave(null);
        } catch (error) {
            console.error("Erro ao confirmar aviso:", error);
            alert("Erro ao salvar lançamento.");
            setIsSaving(false);
        }
    };

    const totalExpensesMonthVal = useMemo(() => {
        return monthExits
            .filter(t => t.category !== 'investment')
            .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    }, [monthExits]);

    const totalInvestmentsMonthVal = useMemo(() => {
        return monthExits
            .filter(t => t.category === 'investment')
            .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    }, [monthExits]);

    const totalIncomeMonthVal = useMemo(() => {
        return transactions.filter(t => {
            const isIncome = t.type === 'income';
            const isNotSpecial = !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category);
            const matchesMonth = t.month === selectedMonth || (t.date && t.date.startsWith(selectedMonth));
            return isIncome && isNotSpecial && matchesMonth;
        }).reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    }, [transactions, selectedMonth]);

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20 px-2 sm:px-4 md:px-0">
            {/* Header — título reflete a sub-aba atual (navegação fica na sidebar) */}
            <div className="flex items-center justify-center pt-8 pb-4">
                <h2 className={`text-xl font-medium tracking-wide uppercase ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                    {subTab === 'reservas' ? 'Gestão de Aportes' : 'Gestão de Lançamentos'}
                </h2>
            </div>

            {/* Cards Row — ACIMA do seletor de mês */}
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
                        <button onClick={toggleHideBalance} className={`text-slate-500 hover:text-white transition-colors ${theme === 'light' ? 'hover:text-slate-800' : ''}`}>
                            {hideBalance ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
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
                            {formatCurrency(totalIncomeMonthVal)}
                        </div>
                    </div>
                </div>

                {/* Lançamentos no Mês / Aportes no Mês */}
                <div className={`p-5 rounded-xl flex flex-col justify-center gap-3 ${theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]'}`}>
                    <div className="flex items-center gap-2">
                        <div className={subTab === 'despesas' ? 'text-rose-400' : 'text-blue-400'}>
                            <TrendingDown className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                            {subTab === 'despesas' ? 'Despesas no Mês' : 'Aportes no Mês'}
                        </span>
                    </div>
                    <div className={`text-2xl font-bold ${subTab === 'despesas' ? 'text-rose-400' : 'text-blue-400'}`}>
                        {formatCurrency(subTab === 'despesas' ? totalExpensesMonthVal : totalInvestmentsMonthVal)}
                    </div>
                </div>
            </div>

            {/* Month Selector — ABAIXO dos cards */}
            <div className="flex flex-col items-center gap-4 mb-2">
                <div className={`flex items-center rounded-lg border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#1e2330] border-slate-700/50'}`}>
                    <button onClick={handlePrevMonth} className="p-2 text-slate-400 hover:text-white transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className={`px-4 text-[10px] font-bold uppercase min-w-[140px] text-center ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
                        {monthLabel}
                    </span>
                    <button onClick={handleNextMonth} className="p-2 text-slate-400 hover:text-white transition-colors">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Transactions List */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                {subTab === 'despesas' ? (
                    <div className={`p-8 rounded-2xl ${theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]'}`}>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                            <h3 className={`text-base font-medium uppercase tracking-wider ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>Últimos Lançamentos</h3>
                            <div className="flex flex-wrap items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input 
                                        type="checkbox"
                                        checked={showCreditCard}
                                        onChange={(e) => {
                                            setShowCreditCard(e.target.checked);
                                            setSelectedCategory(null);
                                        }}
                                        className="sr-only peer"
                                    />
                                    <div className={`w-8 h-4 rounded-full relative transition-all duration-300 ${
                                        showCreditCard 
                                        ? 'bg-rose-500' 
                                        : (theme === 'light' ? 'bg-slate-200' : 'bg-slate-700')
                                    }`}>
                                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-all duration-300 ${
                                            showCreditCard ? 'translate-x-4' : ''
                                        }`} />
                                    </div>
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                                        showCreditCard 
                                        ? 'text-rose-400' 
                                        : (theme === 'light' ? 'text-slate-500' : 'text-slate-400')
                                    }`}>
                                        Exibir Cartão
                                    </span>
                                </label>
                                
                                {showCreditCard && cards.length > 0 && (
                                    <select
                                        value={selectedCardFilter}
                                        onChange={(e) => setSelectedCardFilter(e.target.value)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border outline-none appearance-none cursor-pointer ${
                                            theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-800 border-slate-700/50 text-white'
                                        }`}
                                    >
                                        <option value="all">Todos os Cartões</option>
                                        {cards.map(c => (
                                            <option key={c.id} value={c.id}>{c.name || c.brand} {c.last4}</option>
                                        ))}
                                    </select>
                                )}

                                {showCreditCard && (
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input 
                                            type="checkbox"
                                            checked={hidePaidInvoices}
                                            onChange={(e) => setHidePaidInvoices(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className={`w-8 h-4 rounded-full relative transition-all duration-300 ${
                                            hidePaidInvoices 
                                            ? 'bg-emerald-500' 
                                            : (theme === 'light' ? 'bg-slate-200' : 'bg-slate-700')
                                        }`}>
                                            <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-all duration-300 ${
                                                hidePaidInvoices ? 'translate-x-4' : ''
                                            }`} />
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                                            hidePaidInvoices 
                                            ? 'text-emerald-500' 
                                            : (theme === 'light' ? 'text-slate-500' : 'text-slate-400')
                                        }`}>
                                            Fatura Atual
                                        </span>
                                    </label>
                                )}

                                <button
                                    onClick={() => {
                                        const __cm = new Date().toISOString().slice(0, 7);
                                        const expenseCount = transactions.filter(t => t.type === 'expense' && ((t.month || (t.date ? String(t.date).slice(0, 7) : '')) === __cm)).length;
                                        if (isLimited && expenseCount >= TRIAL_EXPENSE_LIMIT) {
                                            setShowTrialModal(true);
                                            return;
                                        }
                                        setStep('expense');
                                        setShowModal(true);
                                    }}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-500/90 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(244,63,94,0.15)]"
                                >
                                    <span className="text-lg leading-none">+</span> Nova Despesa
                                </button>
                            </div>
                        </div>

                        {/* Category Filter Chips */}
                        {availableCategories.length > 0 && (
                            <div className={`flex flex-wrap gap-2 mb-6 border-b pb-4 px-2 ${theme === 'light' ? 'border-slate-100' : 'border-slate-700'}`}>
                                <button
                                    onClick={() => setSelectedCategory(null)}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
                                        !selectedCategory 
                                        ? 'bg-rose-500/20 text-rose-400'
                                        : (theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10')
                                    }`}
                                >
                                    Todas
                                </button>
                                {availableCategories.map(cat => {
                                    const CatIcon = cat.icon;
                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                                            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                                                selectedCategory === cat.id
                                                ? 'bg-rose-500/20 text-rose-400'
                                                : (theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10')
                                            }`}
                                        >
                                            <CatIcon className="w-3 h-3" />
                                            {cat.label} ({cat.count})
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="w-full">
                            {/* Table Header - Hidden on Mobile */}
                            <div className={`hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr] pb-4 border-b mb-2 px-2 gap-4 ${theme === 'light' ? 'border-slate-200' : 'border-slate-700'}`}>
                                <span className="text-[10px] font-medium text-slate-400 uppercase">Descrição</span>
                                <span className="text-[10px] font-medium text-slate-400 uppercase">Data</span>
                                <span className="text-[10px] font-medium text-slate-400 uppercase">Pagamento</span>
                                <span className="text-[10px] font-medium text-slate-400 uppercase">Prioridade</span>
                                <span className="text-[10px] font-medium text-slate-400 uppercase text-right">Valor</span>
                            </div>

                            {/* Table Body */}
                            <div className="space-y-1">
                                {regularExpenses.length === 0 ? (
                                    <div className="py-8 text-center text-sm text-slate-500">{selectedCategory ? 'Nenhuma despesa nesta categoria.' : 'Nenhuma despesa recente encontrada.'}</div>
                                ) : (
                                    regularExpenses.map(t => {
                                        const cat = CATEGORIES.expense.find(c => c.id === t.category) || { icon: Circle, color: 'text-slate-400', label: 'Outros' };
                                        const Icon = cat.icon;
                                        
                                        const paymentLabel = t.paymentMethod === 'pix' ? 'PIX' : t.paymentMethod === 'debito' ? 'Débito' : t.paymentMethod === 'credito' ? 'Crédito' : 'Dinheiro';
                                        
                                        const priorityLabel = t.priority === 'essential' ? 'Essencial' : t.priority === 'superfluous' ? 'Supérfluo' : 'Conforto';
                                        const priorityColor = t.priority === 'essential' ? 'bg-emerald-500/20 text-emerald-400' : t.priority === 'superfluous' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400';

                                        return (
                                            <div key={t.id} className={`rounded-xl transition-colors group border-b sm:border-b-0 ${theme === 'light' ? 'border-slate-100 hover:bg-slate-50' : 'border-slate-700/30 hover:bg-white/5'}`}>

                                                {/* ── MOBILE CARD (< sm) ── */}
                                                <div className="flex items-start gap-3 px-2 py-3 sm:hidden">
                                                    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-rose-500/20 text-rose-400 shrink-0 mt-0.5">
                                                        <Icon className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        {/* Linha 1: descrição + valor */}
                                                        <div className="flex items-baseline justify-between gap-2">
                                                            <span className={`text-[13px] font-medium leading-snug ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>{t.description}</span>
                                                            <span className={`text-[13px] font-semibold text-rose-400 shrink-0 tabular-nums ${t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid' ? 'opacity-70' : ''}`}>
                                                                - {formatCurrency(parseFloat(t.amount))}
                                                            </span>
                                                        </div>
                                                        {/* Linha 2: categoria · data · badges · ações */}
                                                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{cat.label}</span>
                                                            <span className="text-slate-600 text-[10px]">·</span>
                                                            <span className="text-[10px] text-slate-400">
                                                                {new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}
                                                            </span>
                                                            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-slate-700/50 text-slate-300">{paymentLabel}</span>
                                                            <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md ${priorityColor}`}>{priorityLabel}</span>
                                                            {t.paymentMethod === 'credito' && (
                                                                t.invoiceStatus === 'paid'
                                                                    ? <span className="text-[9px] font-black text-emerald-500 uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded-sm">Fatura Paga</span>
                                                                    : <span className="text-[9px] font-black text-slate-500 uppercase">Fatura Aberta</span>
                                                            )}
                                                            <div className="ml-auto flex gap-0.5">
                                                                <button onClick={() => handleEdit(t)} className="p-1.5 text-slate-500 hover:text-emerald-400 transition-colors rounded-md"><Pencil className="w-3.5 h-3.5" /></button>
                                                                <button onClick={() => handleDelete(t)} className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors rounded-md"><Trash2 className="w-3.5 h-3.5" /></button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* ── DESKTOP TABLE ROW (≥ sm) ── */}
                                                <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr] sm:items-center py-4 px-2 gap-4">
                                                    {/* Description */}
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-rose-500/20 text-rose-400 shrink-0">
                                                            <Icon className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className={`text-[13px] truncate ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>{t.description}</span>
                                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{cat.label}</span>
                                                        </div>
                                                    </div>
                                                    {/* Date */}
                                                    <div className={`text-[13px] ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                                                        {new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}.
                                                    </div>
                                                    {/* Payment */}
                                                    <div className="flex flex-col items-start justify-center">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-300">{paymentLabel}</span>
                                                        {t.selectedCardId && (
                                                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1 ml-1 truncate max-w-full">
                                                                {cards?.find(c => c.id === t.selectedCardId)?.name || 'Cartão'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* Priority */}
                                                    <div className="flex items-center justify-start">
                                                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${priorityColor}`}>{priorityLabel}</span>
                                                    </div>
                                                    {/* Value & Actions */}
                                                    <div className="flex items-center justify-end gap-3 relative">
                                                        <div className="text-right flex flex-col items-end">
                                                            <span className={`text-[13px] font-medium text-rose-400 ${t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid' ? 'opacity-70' : ''}`}>
                                                                - {formatCurrency(parseFloat(t.amount))}
                                                            </span>
                                                            {t.paymentMethod === 'credito' && (
                                                                t.invoiceStatus === 'paid'
                                                                    ? <span className="text-[9px] font-black text-emerald-500 uppercase mt-0.5 bg-emerald-500/10 px-1.5 py-0.5 rounded-sm">Fatura Paga</span>
                                                                    : <span className="text-[9px] font-black text-slate-500 uppercase mt-0.5">Fatura Aberta</span>
                                                            )}
                                                        </div>
                                                        <div className={`absolute right-0 translate-x-16 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all flex gap-1 pl-2 ${theme === 'light' ? 'bg-white' : 'bg-[#1e2330]'}`}>
                                                            <button onClick={() => handleEdit(t)} className={`p-2 text-slate-400 hover:text-emerald-400 transition-colors rounded-md ${theme === 'light' ? 'hover:bg-slate-50' : ''}`}><Pencil className="w-3 h-3" /></button>
                                                            <button onClick={() => handleDelete(t)} className={`p-2 text-slate-400 hover:text-rose-400 transition-colors rounded-md ${theme === 'light' ? 'hover:bg-slate-50' : ''}`}><Trash2 className="w-3 h-3" /></button>
                                                        </div>
                                                    </div>
                                                </div>

                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Total Footer */}
                            <div className={`mt-2 py-4 border-t flex justify-end items-center ${theme === 'light' ? 'border-slate-200' : 'border-slate-700/50'}`}>
                                <span className={`text-[10px] uppercase font-black tracking-widest ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Total Listado: <span className={`font-bold text-sm ml-1 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{formatCurrency(regularExpenses.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0))}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* COLUNA: RESERVAS */
                    <div className={`p-8 rounded-2xl ${theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]'}`}>
                        <div className="flex items-center justify-between mb-8">
                            <h3 className={`text-base font-medium uppercase tracking-wider ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>Histórico de Aportes</h3>
                            <button
                                onClick={() => {
                                    setStep('investment');
                                    setShowModal(true);
                                }}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-500/90 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(59,130,246,0.15)]"
                            >
                                <span className="text-lg leading-none">+</span> Novo Aporte
                            </button>
                        </div>

                        <div className="w-full">
                            {/* Table Header - Hidden on Mobile */}
                            <div className={`hidden sm:grid grid-cols-[1fr_1fr_1fr] pb-4 border-b mb-2 px-2 ${theme === 'light' ? 'border-slate-200' : 'border-slate-700'}`}>
                                <span className="text-[10px] font-medium text-slate-400 uppercase">Reserva</span>
                                <span className="text-[10px] font-medium text-slate-400 uppercase">Data</span>
                                <span className="text-[10px] font-medium text-slate-400 uppercase text-right">Valor</span>
                            </div>

                            <div className="space-y-1">
                                {investmentExits.length === 0 ? (
                                    <div className="py-8 text-center text-sm text-slate-500">Nenhum aporte recente encontrado.</div>
                                ) : (
                                    investmentExits.slice(0, 15).map(t => {
                                        const cat = CATEGORIES.expense.find(c => c.id === t.category) || { icon: Circle, color: 'text-slate-400', label: 'Outros' };
                                        const Icon = cat.icon;
                                        return (
                                            <div key={t.id} className={`grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_1fr_1fr] items-center py-4 px-2 hover:bg-white/5 rounded-xl transition-colors group gap-2 sm:gap-4 border-b sm:border-b-0 ${theme === 'light' ? 'border-slate-100' : 'border-slate-700/30'}`}>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-500/20 text-blue-400 shrink-0">
                                                        <Icon className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className={`text-[13px] truncate ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>{t.description}</span>
                                                        <span className="text-[11px] text-slate-400 sm:hidden">
                                                            {new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className={`text-[13px] hidden sm:block ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                                                    {new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}.
                                                </div>
                                                <div className="flex items-center justify-end gap-3 relative">
                                                    <span className="text-[13px] font-medium text-blue-400">
                                                        + {formatCurrency(parseFloat(t.amount))}
                                                    </span>
                                                    {/* Actions: always visible on mobile, slide-in on hover for desktop */}
                                                    <div className={`sm:absolute sm:right-0 sm:translate-x-16 sm:opacity-0 sm:group-hover:translate-x-0 sm:group-hover:opacity-100 transition-all flex gap-1 sm:pl-2 ${theme === 'light' ? 'sm:bg-white' : 'sm:bg-[#1e2330]'}`}>
                                                        <button onClick={() => handleEdit(t)} className={`p-2 text-slate-400 hover:text-emerald-400 transition-colors rounded-md ${theme === 'light' ? 'hover:bg-slate-50' : ''}`}><Pencil className="w-4 h-4 sm:w-3 sm:h-3" /></button>
                                                        <button onClick={() => handleDelete(t)} className={`p-2 text-slate-400 hover:text-rose-400 transition-colors rounded-md ${theme === 'light' ? 'hover:bg-slate-50' : ''}`}><Trash2 className="w-4 h-4 sm:w-3 sm:h-3" /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Overlay */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className={`w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-hide rounded-2xl p-6 border relative animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
                    }`}>
                        {/* Close button */}
                        <button
                            onClick={resetForm}
                            className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors z-[10] ${
                                theme === 'light' ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/10 text-slate-500'
                            }`}
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* STEP 1: CHOICE */}
                        {step === 'choice' && (
                            <div className="space-y-5 py-2">
                                <div className="text-center space-y-1.5">
                                    <h3 className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>O que deseja lançar?</h3>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Escolha o tipo de saída para continuar</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setStep('expense')}
                                        className={`group p-5 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-95 ${
                                            theme === 'light'
                                            ? 'bg-rose-50 border-rose-100 hover:border-rose-400'
                                            : 'bg-rose-500/5 border-rose-500/10 hover:border-rose-500/40'
                                        }`}
                                    >
                                        <div className="p-2.5 bg-rose-500 text-white rounded-xl w-fit mb-3 shadow-lg shadow-rose-500/20">
                                            <TrendingDown className="w-5 h-5" />
                                        </div>
                                        <h4 className={`text-base font-black mb-1 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Lançar Gasto</h4>
                                        <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                                            Registre compras, contas, lazer e despesas variáveis do dia a dia.
                                        </p>
                                    </button>

                                    <button
                                        onClick={() => setStep('investment')}
                                        className={`group p-5 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-95 ${
                                            theme === 'light'
                                            ? 'bg-emerald-50 border-emerald-100 hover:border-emerald-400'
                                            : 'bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/40'
                                        }`}
                                    >
                                        <div className="p-2.5 bg-emerald-500 text-white rounded-xl w-fit mb-3 shadow-lg shadow-emerald-500/20">
                                            <PiggyBank className="w-5 h-5" />
                                        </div>
                                        <h4 className={`text-base font-black mb-1 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Guardar / Investir</h4>
                                        <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                                            Mova dinheiro para reserva, cofrinho ou investimentos com rendimento.
                                        </p>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: EXPENSE FORM */}
                        {step === 'expense' && (
                            <form onSubmit={handleSaveGasto} className="space-y-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <button type="button" onClick={() => setStep('choice')} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors">
                                        <ArrowRight className="w-4 h-4 rotate-180" />
                                    </button>
                                    <h3 className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Novo Gasto</h3>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Descrição</label>
                                        <input 
                                            type="text" required value={description} onChange={e => setDescription(e.target.value)}
                                            placeholder="Ex: Supermercado, Aluguel..."
                                            className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                                                theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-rose-500' : 'bg-white/5 border-white/5 text-white focus:border-rose-500'
                                            }`}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Valor (R$)</label>
                                            <input 
                                                type="number" step="0.01" required value={amount} onChange={e => { setAmount(e.target.value); if (amountError) setAmountError(''); }}
                                                placeholder="0.00"
                                                className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                                                    amountError
                                                      ? 'border-rose-500 bg-rose-500/5 text-rose-500 focus:border-rose-500'
                                                      : (theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-rose-500' : 'bg-white/5 border-white/5 text-white focus:border-rose-500')
                                                }`}
                                            />
                                            {amountError && (
                                              <p className="text-[10px] font-bold text-rose-500 mt-1 ml-1 flex items-center gap-1">
                                                <span>⚠</span> {amountError}
                                              </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Data</label>
                                            <input 
                                                type="date" required value={date} onChange={e => setDate(e.target.value)}
                                                className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 [color-scheme:light]' : 'bg-white/5 border-white/5 text-white [color-scheme:dark]'
                                                }`}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Categoria</label>
                                        <select 
                                            value={category} onChange={e => {
                                                const newCat = e.target.value;
                                                setCategory(newCat);
                                                const catDef = CATEGORIES.expense.find(c => c.id === newCat);
                                                if (catDef?.defaultPriority) setPriority(catDef.defaultPriority);
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

                                    {/* Priority Selector */}
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Prioridade do Gasto</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {PRIORITY_OPTIONS.map(opt => {
                                                const PIcon = opt.icon;
                                                const isSelected = priority === opt.id;
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        onClick={() => setPriority(priority === opt.id ? '' : opt.id)}
                                                        className={`p-2.5 rounded-xl border text-center transition-all ${
                                                            isSelected
                                                            ? (opt.color === 'emerald' 
                                                                ? (theme === 'light' ? 'bg-emerald-50 border-emerald-400 shadow-sm' : 'bg-emerald-500/10 border-emerald-500/40')
                                                                : opt.color === 'rose'
                                                                ? (theme === 'light' ? 'bg-rose-50 border-rose-400 shadow-sm' : 'bg-rose-500/10 border-rose-500/40')
                                                                : (theme === 'light' ? 'bg-amber-50 border-amber-400 shadow-sm' : 'bg-amber-500/10 border-amber-500/40'))
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

                                    {/* Flags: Parcelada e Recorrente */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <label className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                                            isInstallment ? (theme === 'light' ? 'bg-rose-50 border-rose-200' : 'bg-rose-500/10 border-rose-500/30') : (theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5')
                                        }`}>
                                            <input 
                                                type="checkbox" 
                                                checked={isInstallment} 
                                                onChange={e => {
                                                    setIsInstallment(e.target.checked);
                                                    if (e.target.checked) setPaymentMethod('credito');
                                                }}
                                                className="w-4 h-4 rounded border-slate-300 text-rose-500 focus:ring-rose-500"
                                            />
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>Esse gasto foi um parcelamento</span>
                                        </label>

                                        <label className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                                            isRecurring ? (theme === 'light' ? 'bg-blue-50 border-blue-200' : 'bg-blue-500/10 border-blue-500/30') : (theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5')
                                        }`}>
                                            <input 
                                                type="checkbox" 
                                                checked={isRecurring} 
                                                onChange={e => setIsRecurring(e.target.checked)}
                                                className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                                            />
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>Essa é uma assinatura</span>
                                        </label>
                                    </div>

                                    {isInstallment && (
                                        <div className={`p-4 rounded-2xl border text-left animate-in slide-in-from-top-2 duration-500 ${
                                            theme === 'light' ? 'bg-sky-50 border-sky-100' : 'bg-sky-500/10 border-sky-500/20'
                                        }`}>
                                            <p className={`text-[10px] font-bold leading-relaxed ${theme === 'light' ? 'text-sky-800' : 'text-sky-200'}`}>
                                                <span className="font-black uppercase tracking-widest text-[9px] block mb-2 opacity-70">Entenda as opções:</span> 
                                                <strong className="font-black">• Valor Total:</strong> Divide o valor digitado pelo nº de parcelas.<br/>
                                                <strong className="font-black">• Valor por Parcela:</strong> O valor digitado será o valor de CADA parcela.<br/><br/>
                                                Este gasto vai para a aba <strong className="font-black">Cartões</strong> e não sai do seu saldo hoje. Ao pagar a fatura, você poderá apenas avançar a parcela sem duplicar seus gastos.
                                            </p>
                                        </div>
                                    )}

                                    {isInstallment && (
                                        <div className={`p-1.5 rounded-2xl flex gap-1 animate-in slide-in-from-top-2 duration-500 ${theme === 'light' ? 'bg-slate-100' : 'bg-white/5'}`}>
                                            <button 
                                                type="button"
                                                onClick={() => setInstallmentMode('total')}
                                                className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${
                                                    installmentMode === 'total' 
                                                    ? (theme === 'light' ? 'bg-white text-rose-500 shadow-sm' : 'bg-white/10 text-rose-400 shadow-xl')
                                                    : 'text-slate-500'
                                                }`}
                                            >
                                                Valor Total
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => setInstallmentMode('per_installment')}
                                                className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${
                                                    installmentMode === 'per_installment' 
                                                    ? (theme === 'light' ? 'bg-white text-rose-500 shadow-sm' : 'bg-white/10 text-rose-400 shadow-xl')
                                                    : 'text-slate-500'
                                                }`}
                                            >
                                                Valor por Parcela
                                            </button>
                                        </div>
                                    )}

                                    {/* Payment Method & Installments */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">F. Pagamento</label>
                                            <select 
                                                value={paymentMethod} 
                                                onChange={e => setPaymentMethod(e.target.value)}
                                                className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all appearance-none ${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-slate-800 border-white/5 text-white'
                                                }`}
                                            >
                                                <option value="pix">PIX</option>
                                                <option value="debito">Cartão de Débito</option>
                                                <option value="credito">Cartão de Crédito</option>
                                                <option value="dinheiro">Dinheiro</option>
                                            </select>
                                        </div>

                                        {isInstallment && (
                                            <div className="animate-in slide-in-from-right-4">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Nº Parcelas</label>
                                                <input 
                                                    type="number" min="2" max="48"
                                                    value={installments} 
                                                    onChange={e => setInstallments(e.target.value)}
                                                    className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                                                        theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-rose-500' : 'bg-white/5 border-white/5 text-white focus:border-rose-500'
                                                    }`}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Select Card if Credit Card is active */}
                                    {paymentMethod === 'credito' && (
                                        <div className="animate-in slide-in-from-top-4">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Em qual cartão foi a compra?</label>

                                            {cards.length === 0 ? (
                                                /* Sem cartão cadastrado — guia o usuário leigo a cadastrar */
                                                <div className={`p-4 rounded-2xl border ${
                                                    theme === 'light' ? 'bg-amber-50 border-amber-200' : 'bg-amber-500/10 border-amber-500/20'
                                                }`}>
                                                    <div className="flex items-start gap-3 mb-3">
                                                        <CreditCard className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                                        <p className={`text-xs font-bold leading-relaxed ${theme === 'light' ? 'text-amber-800' : 'text-amber-300'}`}>
                                                            Você ainda não tem nenhum cartão cadastrado. Para registrar uma compra no crédito, primeiro cadastre o seu cartão (leva 30 segundos).
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            resetForm();
                                                            if (typeof setActiveTab === 'function') setActiveTab('cartoes');
                                                        }}
                                                        className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" /> Cadastrar Meu Cartão
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <select
                                                        value={selectedCardId}
                                                        onChange={e => { setSelectedCardId(e.target.value); if (cardError) setCardError(''); }}
                                                        className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all appearance-none ${
                                                            cardError
                                                              ? 'border-rose-500 bg-rose-500/5 text-rose-500 focus:border-rose-500'
                                                              : (theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-rose-500' : 'bg-slate-800 border-white/5 text-white focus:border-rose-500')
                                                        }`}
                                                    >
                                                        <option value="">Selecione um cartão</option>
                                                        {cards.map(card => (
                                                            <option key={card.id} value={card.id}>{card.name} (•• {card.last4})</option>
                                                        ))}
                                                    </select>

                                                    {cardError ? (
                                                        <p className="text-[10px] font-bold text-rose-500 mt-1.5 ml-1 flex items-center gap-1">
                                                            <span>⚠</span> {cardError}
                                                        </p>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                resetForm();
                                                                if (typeof setActiveTab === 'function') setActiveTab('cartoes');
                                                            }}
                                                            className="text-[10px] font-bold text-slate-400 hover:text-rose-500 mt-1.5 ml-1 transition-colors flex items-center gap-1"
                                                        >
                                                            <Plus className="w-3 h-3" /> Cadastrar outro cartão
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Nota explicativa do crédito (não-parcelado) — deixa claro que
                                        a compra entra na fatura e só sai do saldo ao pagá-la */}
                                    {paymentMethod === 'credito' && cards.length > 0 && !isInstallment && (
                                        <div className={`p-3 rounded-2xl border flex items-start gap-2.5 animate-in slide-in-from-top-2 ${
                                            theme === 'light' ? 'bg-blue-50/60 border-blue-100' : 'bg-blue-500/[0.06] border-blue-500/15'
                                        }`}>
                                            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                            <p className={`text-[10px] leading-relaxed ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                                                Esta compra entra na <strong className="font-black">fatura do cartão</strong> e <strong className="font-black">não desconta do seu saldo agora</strong>. O valor sai da carteira somente quando você pagar a fatura, na aba <strong className="font-black">Cartões</strong>.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="submit" disabled={isSaving}
                                    className="w-full py-3 bg-rose-500 hover:bg-rose-400 text-white rounded-xl font-black text-sm shadow-lg shadow-rose-500/20 transition-all active:scale-95"
                                >
                                    {isSaving ? 'Salvando...' : 'Confirmar Lançamento'}
                                </button>
                            </form>
                        )}

                        {/* STEP 3: INVESTMENT FORM */}
                        {step === 'investment' && (
                            <div className="space-y-6">
                                {/* Header */}
                                <div className="flex items-center gap-3 mb-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (investMode) {
                                                setInvestMode(null);
                                                setDescription('');
                                                setAmount('');
                                                setSelectedDestination('');
                                                setIsNewReserve(false);
                                            } else {
                                                setStep('choice');
                                            }
                                        }}
                                        className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        <ArrowRight className="w-4 h-4 rotate-180" />
                                    </button>
                                    <h3 className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                        {investMode === 'jar' ? 'Guardar em Caixinha' : investMode === 'patrimonio' ? 'Aporte no Patrimônio' : 'Guardar / Investir'}
                                    </h3>
                                </div>

                                {/* Sub-choice */}
                                {!investMode && (
                                    <div className="grid grid-cols-1 gap-3 animate-in fade-in duration-300">
                                        <button
                                            type="button"
                                            onClick={() => { setInvestMode('jar'); setDestinationType('jar'); }}
                                            className={`p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] hover:scale-[1.01] ${
                                                theme === 'light'
                                                    ? 'border-emerald-200 bg-emerald-50 hover:border-emerald-400'
                                                    : 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2.5 rounded-xl shrink-0 ${theme === 'light' ? 'bg-emerald-100' : 'bg-emerald-500/20'}`}>
                                                    <PiggyBank className="w-5 h-5 text-emerald-500" />
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Caixinha / Reserva</p>
                                                    <p className="text-xs text-slate-500 mt-0.5">Guardar em cofrinho com rendimento automático por CDI</p>
                                                </div>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setInvestMode('patrimonio')}
                                            className={`p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] hover:scale-[1.01] ${
                                                theme === 'light'
                                                    ? 'border-blue-200 bg-blue-50 hover:border-blue-400'
                                                    : 'border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2.5 rounded-xl shrink-0 ${theme === 'light' ? 'bg-blue-100' : 'bg-blue-500/20'}`}>
                                                    <TrendingUp className="w-5 h-5 text-blue-500" />
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Enviar ao Patrimônio</p>
                                                    <p className="text-xs text-slate-500 mt-0.5">Registrar aporte em ação, fundo, CDB, cripto...</p>
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                )}

                                {/* Mode: Caixinha */}
                                {investMode === 'jar' && (
                                    <form onSubmit={handleSaveInvestimento} className="space-y-4 animate-in fade-in duration-300">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Onde guardar?</label>
                                            <select
                                                required
                                                value={selectedDestination}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setSelectedDestination(val);
                                                    if (val === 'new_jar') {
                                                        setIsNewReserve(true);
                                                        setDestinationType('jar');
                                                        setDescription('');
                                                        setCdiPercent('100');
                                                    } else if (val.startsWith('jar_')) {
                                                        const jarId = val.replace('jar_', '');
                                                        const jar = savingsJars.find(j => j.id === jarId);
                                                        setIsNewReserve(false);
                                                        setDestinationType('jar');
                                                        if (jar) {
                                                            setDescription(jar.name);
                                                            setCdiPercent(jar.cdiPercent?.toString() || '100');
                                                        }
                                                    } else {
                                                        setIsNewReserve(false);
                                                        setDescription('');
                                                    }
                                                }}
                                                className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all appearance-none ${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-slate-800 border-white/5 text-white'
                                                }`}
                                            >
                                                <option value="">Selecione a caixinha...</option>
                                                {savingsJars?.map(jar => (
                                                    <option key={`jar_${jar.id}`} value={`jar_${jar.id}`}>
                                                        {jar.name} (R$ {parseFloat(jar.dynamicBalance || jar.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                                    </option>
                                                ))}
                                                <option value="new_jar">+ Criar Nova Caixinha...</option>
                                            </select>
                                        </div>

                                        {isNewReserve && (
                                            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Nome da Reserva</label>
                                                    <input
                                                        type="text" required value={description} onChange={e => setDescription(e.target.value)}
                                                        placeholder="Ex: Reserva Emergência, Viagem..."
                                                        className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                                                            theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/5 text-white focus:border-emerald-500'
                                                        }`}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Tipo</label>
                                                    <select
                                                        value={reserveType} onChange={e => setReserveType(e.target.value)}
                                                        className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all appearance-none ${
                                                            theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-slate-800 border-white/5 text-white'
                                                        }`}
                                                    >
                                                        <option value="cofrinho">Cofrinho / Poupança</option>
                                                        <option value="tesouro">Tesouro Selic</option>
                                                        <option value="cdb">CDB Liquidez Diária</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Valor (R$)</label>
                                                <input
                                                    type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)}
                                                    placeholder="0.00"
                                                    className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                                                        theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/5 text-white focus:border-emerald-500'
                                                    }`}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">% do CDI</label>
                                                <input
                                                    type="number" required value={cdiPercent} onChange={e => setCdiPercent(e.target.value)}
                                                    placeholder="100"
                                                    className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                                                        theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/5 text-white focus:border-emerald-500'
                                                    }`}
                                                />
                                            </div>
                                        </div>

                                        <div className={`p-4 rounded-2xl border ${theme === 'light' ? 'bg-emerald-50 border-emerald-100' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                                                    <span className="text-[10px] font-black uppercase text-emerald-600">Rendimento Previsto</span>
                                                </div>
                                                <p className="text-sm font-black text-emerald-500">
                                                    {(() => {
                                                        const val = parseFloat(amount) || 0;
                                                        const perc = parseFloat(cdiPercent) || 100;
                                                        const cdiAnual = 0.1065;
                                                        const dailyRate = Math.pow(1 + (cdiAnual * (perc / 100)), 1 / 365) - 1;
                                                        return `+ R$ ${(val * dailyRate).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /dia`;
                                                    })()}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Wallet impact preview */}
                                        {amount > 0 && walletStats?.balance !== undefined && (
                                            <div className={`p-3 rounded-xl border flex items-center justify-between ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'}`}>
                                                <span className={`text-[10px] font-black uppercase tracking-wider ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                                                    Saldo em carteira após aporte
                                                </span>
                                                <span className="text-sm font-black text-rose-400">
                                                    R$ {Math.max(0, (walletStats.balance - (parseFloat(amount) || 0))).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}

                                        <button
                                            type="submit" disabled={isSaving}
                                            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                                        >
                                            {isSaving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Confirmar e Guardar'}
                                        </button>
                                    </form>
                                )}

                                {/* Mode: Patrimônio */}
                                {investMode === 'patrimonio' && (
                                    <form onSubmit={handleSaveInvestimento} className="space-y-5 animate-in fade-in duration-300">
                                        {/* Guidance card */}
                                        <div className={`p-4 rounded-2xl border ${theme === 'light' ? 'bg-blue-50 border-blue-100' : 'bg-blue-500/5 border-blue-500/20'}`}>
                                            <div className="flex items-start gap-3">
                                                <Info className={`w-4 h-4 shrink-0 mt-0.5 ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`} />
                                                <div>
                                                    <p className={`text-xs font-black mb-1.5 ${theme === 'light' ? 'text-blue-900' : 'text-white'}`}>Como funciona</p>
                                                    <p className={`text-[11px] leading-relaxed ${theme === 'light' ? 'text-blue-700' : 'text-blue-300'}`}>
                                                        O valor será descontado do seu saldo aqui. Para registrar o ativo no seu portfólio, acesse o{' '}
                                                        <span className="font-black">Módulo Patrimônio → Investimentos</span>{' '}
                                                        e adicione o investimento manualmente.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Descrição do Aporte</label>
                                            <input
                                                type="text" required value={description} onChange={e => setDescription(e.target.value)}
                                                placeholder="Ex: Aporte PETR4, Tesouro IPCA+, CDB Nubank..."
                                                className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-blue-500' : 'bg-white/5 border-white/5 text-white focus:border-blue-500'
                                                }`}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Valor do Aporte (R$)</label>
                                            <input
                                                type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)}
                                                placeholder="0.00"
                                                className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-blue-500' : 'bg-white/5 border-white/5 text-white focus:border-blue-500'
                                                }`}
                                            />
                                        </div>

                                        <button
                                            type="submit" disabled={isSaving}
                                            className="w-full py-3 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-black text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {isSaving ? 'Registrando...' : 'Confirmar Aporte'}
                                        </button>
                                    </form>
                                )}
                            </div>
                        )}

                        {/* STEP: SUCCESS */}
                        {step === 'success' && (
                            <div className="py-8 text-center space-y-8 animate-in zoom-in-95 duration-500">
                                <div className="relative mx-auto w-24 h-24">
                                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping opacity-20"></div>
                                    <div className="relative w-full h-full bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30">
                                        <TrendingDown className="w-10 h-10" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h3 className={`text-2xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                        {isInstallmentSuccess ? 'Parcelamento Agendado!' : (paymentMethod === 'credito' ? 'Lançado no Cartão!' : 'Lançamento efetuado!')}
                                    </h3>
                                    <p className={`text-sm font-bold ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                                        {isInstallmentSuccess
                                            ? 'Seu parcelamento foi criado. Agora, vá até a aba Cartões para dar baixa na primeira parcela e debitar do seu saldo.'
                                            : paymentMethod === 'credito'
                                            ? 'Sua despesa foi registrada no cartão de crédito. Ela aparecerá na aba Cartões e não será descontada do saldo principal agora.'
                                            : 'Sua saída foi registrada com sucesso no sistema.'}
                                    </p>
                                </div>

                                {savedToPatrimonio && (
                                    <div className={`p-4 rounded-xl border text-left ${theme === 'light' ? 'bg-blue-50 border-blue-100' : 'bg-blue-500/10 border-blue-500/20'}`}>
                                        <div className="flex items-start gap-2">
                                            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                                            <p className={`text-xs leading-relaxed ${theme === 'light' ? 'text-blue-700' : 'text-blue-300'}`}>
                                                Lembre-se: acesse o <span className="font-black">Módulo Patrimônio → Investimentos</span> para registrar o ativo correspondente a este aporte.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col gap-3">
                                    <button 
                                        onClick={() => {
                                            setDescription('');
                                            setAmount('');
                                            setStep(subTab === 'despesas' ? 'expense' : 'investment');
                                        }}
                                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                                    >
                                        Realizar outra saída
                                    </button>
                                    <button 
                                        onClick={resetForm}
                                        className={`w-full py-3 rounded-xl font-black text-sm transition-all active:scale-95 ${
                                            theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                        }`}
                                    >
                                        Sair
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP: WARNING */}
                    </div>
                </div>
            )}

            {/* Aviso de endividamento — padronizado com FixedExpensesTab e CardsTab */}
            <OverdraftWarningModal
                isOpen={!!pendingSave}
                amount={pendingSave?.amount || 0}
                balance={availableBalance}
                itemName={pendingSave?.itemName || (pendingSave?.type === 'investment' ? 'Este aporte' : 'Esta despesa')}
                onCancel={() => {
                    // Volta ao formulário (despesa ou aporte) com os dados preservados.
                    if (pendingSave) {
                        setStep(pendingSave.type === 'expense' ? 'expense' : 'investment');
                        setShowModal(true);
                    }
                    setPendingSave(null);
                }}
                onConfirm={handleConfirmWarning}
            />

            {/* Trial Limit Modal */}
            <TrialLimitModal
                isOpen={showTrialModal}
                onClose={() => setShowTrialModal(false)}
                limitMessage={`Você atingiu o limite de ${TRIAL_EXPENSE_LIMIT} lançamentos de despesa por mês do ${planLevel === 'free' ? 'Plano Gratuito' : 'período de teste'}. O limite renova no início do próximo mês.`}
            />

            {/* Delete Confirmation Modal */}
            {transactionToDelete && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[250] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className={`w-full max-w-sm rounded-2xl p-6 border text-center relative overflow-hidden animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
                    }`}>
                        <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Trash2 className="w-10 h-10 text-rose-500" />
                        </div>
                        <h3 className={`text-2xl font-black mb-2 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Excluir Lançamento?</h3>
                        <p className={`text-sm font-bold mb-8 leading-relaxed ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                            Tem certeza que deseja remover <strong className="text-rose-500">{transactionToDelete.description.replace('Investimento: ', '')}</strong>? Esta ação não pode ser desfeita.
                        </p>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setTransactionToDelete(null)}
                                className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${
                                    theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                                }`}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmDelete}
                                className="flex-1 py-4 bg-rose-500 hover:bg-rose-400 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-rose-500/20 transition-all active:scale-95"
                            >
                                Sim, Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Custom Warning Modal for Fixed Expenses */}
            {fixedExpenseWarning && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className={`w-full max-w-sm rounded-2xl p-6 border text-center animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
                    }`}>
                        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Shield className="w-8 h-8 text-blue-500" />
                        </div>
                        <h3 className={`text-xl font-black mb-2 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Ação Protegida</h3>
                        <p className="text-slate-500 text-xs font-bold leading-relaxed mb-8">
                            Este é um pagamento de <strong className="text-blue-500">Conta Fixa</strong>. Para editar valores ou estornar esse lançamento, você deve acessar a aba de Contas Fixas para não perder o histórico.
                        </p>
                        <button onClick={() => setFixedExpenseWarning(false)} className="w-full py-3 bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20 active:scale-95">
                            Entendi
                        </button>
                    </div>
                </div>
            )}

            {installmentWarning && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className={`w-full max-w-sm rounded-2xl p-6 border text-center animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
                    }`}>
                        <div className="w-16 h-16 bg-violet-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CreditCard className="w-8 h-8 text-violet-500" />
                        </div>
                        <h3 className={`text-xl font-black mb-2 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Editar Parcelamento</h3>
                        <p className="text-slate-500 text-xs font-bold leading-relaxed mb-8">
                            Parcelamentos não são editados aqui na aba <strong className="text-rose-500">Despesas</strong>. Para alterar valor, cartão, parcelas ou prioridade, acesse a aba <strong className="text-violet-500">Cartões › Parcelamentos ativos</strong> e use o botão de editar do parcelamento. Assim seu histórico não é duplicado.
                        </p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => { setInstallmentWarning(false); if (setActiveTab) setActiveTab('cartoes'); }}
                                className="w-full py-3 bg-violet-500 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-violet-500/20 active:scale-95"
                            >
                                Ir para Cartões
                            </button>
                            <button onClick={() => setInstallmentWarning(false)} className={`w-full py-2.5 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] ${theme === 'light' ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-slate-300'}`}>
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
