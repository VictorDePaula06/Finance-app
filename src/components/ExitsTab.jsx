import React, { useState, useMemo } from 'react';
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
    Flame
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { CATEGORIES } from '../constants/categories';

export default function ExitsTab({ transactions, savingsJars = [], cdiRate = 10.65, cards = [], subscriptions = [] }) {
    const { theme } = useTheme();
    const { currentUser } = useAuth();
    
    // States
    const [showModal, setShowModal] = useState(false);
    const [step, setStep] = useState('choice'); // 'choice' | 'expense' | 'investment' | 'success' | 'warning'
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [subTab, setSubTab] = useState('despesas'); // 'despesas' | 'reservas'
    const [isInstallment, setIsInstallment] = useState(false);
    const [installments, setInstallments] = useState('2');
    const [isRecurring, setIsRecurring] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('pix');
    const [selectedCardId, setSelectedCardId] = useState('');
    const [installmentMode, setInstallmentMode] = useState('total'); // 'total' | 'per_installment'

    // Form States
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [category, setCategory] = useState('other');
    const [cdiPercent, setCdiPercent] = useState('100');
    const [pendingSave, setPendingSave] = useState(null); // Para guardar o que seria salvo após o aviso
    const [selectedJarId, setSelectedJarId] = useState('');
    const [isNewReserve, setIsNewReserve] = useState(false);
    const [reserveType, setReserveType] = useState('cofrinho');
    const [isInstallmentSuccess, setIsInstallmentSuccess] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState(null);

    // Month Navigation
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
    // Category Filter
    const [selectedCategory, setSelectedCategory] = useState(null);
    // Priority
    const [priority, setPriority] = useState('comfort');

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

    const monthLabel = useMemo(() => {
        const [year, month] = selectedMonth.split('-').map(Number);
        return new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }, [selectedMonth]);

    // Filtered Transactions (Only Expenses/Exits)
    const exits = useMemo(() => {
        return transactions
            .filter(t => t.type === 'expense' && !(t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid'))
            .sort((a, b) => {
                const dateDiff = new Date(b.date) - new Date(a.date);
                if (dateDiff !== 0) return dateDiff;
                return (b.createdAt || 0) - (a.createdAt || 0);
            });
    }, [transactions]);

    // Calcular saldo total para o aviso
    const availableBalance = useMemo(() => {
        const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
        const expense = transactions
            .filter(t => t.type === 'expense' && !(t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid'))
            .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
        return income - expense;
    }, [transactions]);

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
        setDate(new Date().toLocaleDateString('en-CA'));
        setCategory('other');
        setCdiPercent('100');
        setIsInstallmentSuccess(false);
        setStep('choice');
        setShowModal(false);
        setIsSaving(false);
        setPendingSave(null);
        setSelectedJarId('');
        setIsNewReserve(false);
        setReserveType('cofrinho');
        setIsInstallment(false);
        setInstallments('2');
        setIsRecurring(false);
        setPaymentMethod('pix');
        setInstallmentMode('total');
        setPriority('comfort');
    };

    const handleSaveGasto = async (e) => {
        e.preventDefault();
        if (!description || !amount || isSaving) return;
        setIsSaving(true);

        try {
            const val = parseFloat(amount);
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

            // If it's recurring or installment, also create a subscription entry for the Cards Tab
            if (isRecurring || isInstallment) {
                const subData = {
                    name: description,
                    value: transactionValue,
                    day: new Date(date).getDate(),
                    cardId: selectedCardId || '',
                    userId: currentUser.uid,
                    isInstallment: isInstallment,
                    totalInstallments: isInstallment ? parseInt(installments) : null,
                    currentInstallment: 1,
                    type: isRecurring ? 'recurring' : 'installment',
                    createdAt: Date.now(),
                    installmentMode
                };
                await addDoc(collection(db, 'subscriptions'), subData);
            }

            // VERIFICAÇÃO DE SALDO (Apenas para novos lançamentos, não para edições)
            if (!editingId && val > availableBalance) {
                setPendingSave({ type: 'expense', data: transactionData });
                setStep('warning');
                return;
            }

            if (editingId) {
                const { createdAt, ...updateData } = transactionData;
                await updateDoc(doc(db, 'transactions', editingId), updateData);
                resetForm();
            } else {
                // Se for parcelamento, NÃO adicionamos a transação direta para evitar duplicidade com a aba Cartões
                if (!isInstallment) {
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
        setEditingId(t.id);
        setDescription(t.description.replace('Investimento: ', ''));
        setAmount(t.amount.toString());
        setDate(new Date(t.date).toLocaleDateString('en-CA'));
        setCategory(t.category);
        setIsRecurring(t.isFixed || false);
        setIsInstallment(t.isInstallment || false);
        setInstallments(t.totalInstallments?.toString() || '2');
        setPaymentMethod(t.paymentMethod || 'pix');
        setSelectedCardId(t.selectedCardId || '');
        setInstallmentMode(t.installmentMode || 'total');
        setPriority(t.priority || CATEGORIES.expense.find(c => c.id === t.category)?.defaultPriority || 'comfort');
        
        if (t.category === 'investment') {
            setStep('investment');
        } else {
            setStep('expense');
        }
        setShowModal(true);
    };

    const handleDelete = (transaction) => {
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
        
        // Se não for nova reserva, precisa ter selecionado uma
        if (!isNewReserve && !selectedJarId) {
            alert("Selecione uma reserva ou escolha 'Criar Nova'");
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

            if (selectedJarId && selectedJarId !== 'new' && !isNewReserve) {
                // UPDATE EXISTING JAR
                const jar = savingsJars.find(j => j.id === selectedJarId);
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

            // VERIFICAÇÃO DE SALDO
            if (!editingId && val > availableBalance) {
                setPendingSave({ 
                    type: 'investment', 
                    transaction: transactionData, 
                    jar: jarDataToSave,
                    jarId: existingJarId 
                });
                setIsSaving(false); // Garante que destrave caso mostre o aviso
                setStep('warning');
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
                // Salvamento duplo
                const tRef = collection(db, 'transactions');
                await addDoc(tRef, transactionData);
                
                if (existingJarId) {
                    await updateDoc(doc(db, 'savings_jars', existingJarId), jarDataToSave);
                } else {
                    await addDoc(collection(db, 'savings_jars'), jarDataToSave);
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
                // Se for parcelamento, NÃO adicionamos a transação direta para evitar duplicidade com a aba Cartões
                if (!pendingSave.data.isInstallment) {
                    await addDoc(collection(db, 'transactions'), pendingSave.data);
                } else {
                    setIsInstallmentSuccess(true);
                }
            } else if (pendingSave.type === 'investment') {
                await addDoc(collection(db, 'transactions'), pendingSave.transaction);
                if (pendingSave.jarId) {
                    await updateDoc(doc(db, 'savings_jars', pendingSave.jarId), pendingSave.jar);
                } else {
                    await addDoc(collection(db, 'savings_jars'), pendingSave.jar);
                }
            }

            setIsSaving(false);
            setStep('success');
            setPendingSave(null);
        } catch (error) {
            console.error("Erro ao confirmar aviso:", error);
            alert("Erro ao salvar lançamento.");
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20 px-2 sm:px-4 md:px-0">
            {/* Header & Internal Tabs */}
            <div className="flex flex-col items-center gap-6 py-8">
                <div className={`p-4 rounded-full ${theme === 'light' ? 'bg-rose-50' : 'bg-rose-500/10'}`}>
                    <TrendingDown className={`w-8 h-8 ${theme === 'light' ? 'text-rose-500' : 'text-rose-400'}`} />
                </div>
                <div className="text-center">
                    <h2 className={`text-2xl font-black flex items-center justify-center gap-2 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                        Histórico de Lançamentos
                        <ChevronDown className="w-4 h-4 opacity-30" />
                    </h2>
                    <p className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Gerencie seus gastos e investimentos de forma organizada.</p>
                </div>

                {/* Sub-Tabs Switcher */}
                <div className={`p-1.5 rounded-2xl flex gap-1 ${theme === 'light' ? 'bg-slate-100' : 'bg-white/5 shadow-inner'}`}>
                    <button 
                        onClick={() => setSubTab('despesas')}
                        className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                            subTab === 'despesas' 
                            ? (theme === 'light' ? 'bg-white text-rose-500 shadow-sm' : 'bg-white/10 text-rose-400 shadow-xl')
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <TrendingDown className="w-3 h-3" />
                        Despesas e Consumo
                    </button>
                    <button 
                        onClick={() => setSubTab('reservas')}
                        className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                            subTab === 'reservas' 
                            ? (theme === 'light' ? 'bg-white text-blue-500 shadow-sm' : 'bg-white/10 text-blue-400 shadow-xl')
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <PiggyBank className="w-3 h-3" />
                        Aportes em Reservas
                    </button>
                </div>

                <button 
                    onClick={() => {
                        if (subTab === 'despesas') {
                            setStep('expense');
                        } else {
                            setStep('investment');
                        }
                        setShowModal(true);
                    }}
                    className={`group flex items-center gap-3 px-8 py-4 text-white rounded-2xl font-black text-sm shadow-xl transition-all active:scale-95 hover:scale-105 ${
                        subTab === 'despesas' 
                        ? 'bg-rose-500 hover:bg-rose-400 shadow-rose-500/20' 
                        : 'bg-blue-500 hover:bg-blue-400 shadow-blue-500/20'
                    }`}
                >
                    <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
                    {subTab === 'despesas' ? 'Registrar Nova Despesa' : 'Novo Lançamento de Reserva'}
                </button>
            </div>

            {/* Month Selector */}
            <div className="flex items-center justify-center">
                <div className={`flex items-center gap-2 p-1.5 rounded-2xl border ${theme === 'light' ? 'bg-white border-slate-100' : 'bg-white/5 border-white/5'}`}>
                    <button 
                        onClick={handlePrevMonth}
                        className={`p-2 rounded-xl transition-all ${theme === 'light' ? 'hover:bg-slate-50 text-slate-400' : 'hover:bg-white/5 text-slate-500'}`}
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className={`px-4 text-xs font-black uppercase tracking-widest min-w-[160px] text-center ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>
                        {monthLabel}
                    </span>
                    <button 
                        onClick={handleNextMonth}
                        className={`p-2 rounded-xl transition-all ${theme === 'light' ? 'hover:bg-slate-50 text-slate-400' : 'hover:bg-white/5 text-slate-500'}`}
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Transactions List */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                {subTab === 'despesas' ? (
                    /* COLUNA: GASTOS */
                    <div className={`p-6 md:p-8 rounded-[2.5rem] border shadow-sm ${
                        theme === 'light' ? 'bg-white border-slate-100' : 'bg-slate-900 border-white/5'
                    }`}>
                        <div className="flex items-center gap-2 mb-4 text-rose-500 uppercase tracking-widest text-[10px] font-black">
                            <TrendingDown className="w-3 h-3" />
                            Lista de Despesas e Consumo
                        </div>

                        {/* Category Filter Chips */}
                        {availableCategories.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-6">
                                <button
                                    onClick={() => setSelectedCategory(null)}
                                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                        !selectedCategory 
                                        ? (theme === 'light' ? 'bg-rose-500 text-white shadow-sm' : 'bg-rose-500 text-white shadow-xl')
                                        : (theme === 'light' ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10')
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
                                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                                                selectedCategory === cat.id
                                                ? (theme === 'light' ? 'bg-rose-500 text-white shadow-sm' : 'bg-rose-500 text-white shadow-xl')
                                                : (theme === 'light' ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10')
                                            }`}
                                        >
                                            <CatIcon className="w-3 h-3" />
                                            {cat.label} ({cat.count})
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="space-y-3">
                            {regularExpenses.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-sm font-bold text-slate-400">{selectedCategory ? 'Nenhum gasto nesta categoria.' : 'Nenhum gasto registrado neste mês.'}</p>
                                </div>
                            ) : (
                                regularExpenses.map(t => {
                                    const cat = CATEGORIES.expense.find(c => c.id === t.category) || { icon: Circle, color: 'text-slate-400', label: 'Outros' };
                                    const Icon = cat.icon;
                                    return (
                                        <div key={t.id} className={`flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0 p-5 md:p-6 rounded-[2rem] border transition-all hover:-translate-y-1 hover:shadow-xl ${
                                            theme === 'light' ? 'bg-slate-50/50 border-slate-100 hover:bg-white' : 'bg-white/5 border-white/5 hover:bg-white/10'
                                        }`}>
                                            <div className="flex items-center gap-5 flex-1 min-w-0">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner shrink-0 ${
                                                    theme === 'light' ? 'bg-white' : 'bg-slate-900'
                                                }`}>
                                                    <Icon className={`w-7 h-7 ${cat.color}`} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className={`font-black text-base md:text-lg truncate ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{t.description}</h4>
                                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                                        <span className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest opacity-60">
                                                            {new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                                        </span>
                                                        <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-400'}`}>
                                                            {cat.label}
                                                        </span>
                                                        {t.paymentMethod && (
                                                            <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-400'}`}>
                                                                {t.paymentMethod === 'pix' ? 'PIX' : t.paymentMethod === 'debito' ? 'Débito' : t.paymentMethod === 'credito' ? 'Crédito' : 'Dinheiro'}
                                                            </span>
                                                        )}
                                                        {t.selectedCardId && (
                                                            <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                                                                cards.find(c => c.id === t.selectedCardId)?.color || 'bg-rose-500/10 text-rose-400'
                                                            } text-white shadow-sm`}>
                                                                {cards.find(c => c.id === t.selectedCardId)?.name}
                                                            </span>
                                                        )}
                                                        {t.priority && (
                                                            <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                                                                t.priority === 'essential' ? (theme === 'light' ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/20 text-emerald-400')
                                                                : t.priority === 'superfluous' ? (theme === 'light' ? 'bg-rose-100 text-rose-600' : 'bg-rose-500/20 text-rose-400')
                                                                : (theme === 'light' ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/20 text-amber-400')
                                                            }`}>
                                                                {t.priority === 'essential' ? 'Essencial' : t.priority === 'superfluous' ? 'Supérfluo' : 'Conforto'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-end gap-3 shrink-0 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-200 dark:border-white/10">
                                                <div className="text-right flex flex-col items-end justify-center mr-2">
                                                    <span className={`font-black text-rose-500 text-base md:text-xl whitespace-nowrap ${t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid' ? 'opacity-50' : ''}`}>
                                                        - R$ {parseFloat(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                    {t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid' && (
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Fatura Aberta</span>
                                                    )}
                                                </div>
                                                <button 
                                                    onClick={() => handleEdit(t)}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        theme === 'light' ? 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50' : 'text-slate-600 hover:text-emerald-400 hover:bg-emerald-500/10'
                                                    }`}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(t)}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        theme === 'light' ? 'text-slate-300 hover:text-rose-500 hover:bg-rose-50' : 'text-slate-600 hover:text-rose-400 hover:bg-rose-500/10'
                                                    }`}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                ) : (
                    /* COLUNA: RESERVAS */
                    <div className={`p-6 md:p-8 rounded-[2.5rem] border shadow-sm ${
                        theme === 'light' ? 'bg-white border-slate-100' : 'bg-slate-900 border-white/5'
                    }`}>
                        <div className="flex items-center gap-2 mb-6 text-blue-400 uppercase tracking-widest text-[10px] font-black">
                            <PiggyBank className="w-3 h-3" />
                            Histórico de Aportes em Reservas
                        </div>

                        <div className="space-y-3">
                            {investmentExits.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-sm font-bold text-slate-400">Nenhum aporte registrado.</p>
                                </div>
                            ) : (
                                investmentExits.slice(0, 15).map(t => {
                                    const cat = CATEGORIES.expense.find(c => c.id === t.category) || { icon: Circle, color: 'text-slate-400', label: 'Outros' };
                                    const Icon = cat.icon;
                                    return (
                                        <div key={t.id} className={`flex items-center justify-between p-5 md:p-6 rounded-[2rem] border transition-all hover:-translate-y-1 hover:shadow-xl ${
                                            theme === 'light' ? 'bg-slate-50/50 border-slate-100 hover:bg-white' : 'bg-white/5 border-white/5 hover:bg-white/10'
                                        }`}>
                                            <div className="flex items-center gap-5">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner shrink-0 ${
                                                    theme === 'light' ? 'bg-white' : 'bg-slate-900'
                                                }`}>
                                                    <Icon className={`w-7 h-7 ${cat.color}`} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className={`font-black text-base md:text-lg truncate ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{t.description}</h4>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <p className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest opacity-60">
                                                            {new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`font-black text-blue-400 text-base md:text-xl mr-2 whitespace-nowrap`}>
                                                    + R$ {parseFloat(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                                <button 
                                                    onClick={() => handleEdit(t)}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        theme === 'light' ? 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50' : 'text-slate-600 hover:text-emerald-400 hover:bg-emerald-500/10'
                                                    }`}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(t)}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        theme === 'light' ? 'text-slate-300 hover:text-rose-500 hover:bg-rose-50' : 'text-slate-600 hover:text-rose-400 hover:bg-rose-500/10'
                                                    }`}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Overlay */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className={`w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-hide rounded-[3rem] p-8 md:p-12 border relative animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
                    }`}>
                        {/* Close button */}
                        <button 
                            onClick={resetForm}
                            className={`absolute top-6 right-6 p-2 rounded-xl transition-colors z-[10] ${
                                theme === 'light' ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/10 text-slate-500'
                            }`}
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* STEP 1: CHOICE */}
                        {step === 'choice' && (
                            <div className="space-y-8 py-4">
                                <div className="text-center space-y-2">
                                    <h3 className={`text-2xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>O que deseja lançar?</h3>
                                    <p className="text-sm text-slate-500 font-bold uppercase tracking-widest text-[10px]">Escolha o tipo de saída para continuar</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button 
                                        onClick={() => setStep('expense')}
                                        className={`group p-6 rounded-3xl border-2 text-left transition-all hover:scale-105 active:scale-95 ${
                                            theme === 'light' 
                                            ? 'bg-rose-50 border-rose-100 hover:border-rose-400' 
                                            : 'bg-rose-500/5 border-rose-500/10 hover:border-rose-500/40'
                                        }`}
                                    >
                                        <div className="p-3 bg-rose-500 text-white rounded-2xl w-fit mb-4 shadow-lg shadow-rose-500/20">
                                            <TrendingDown className="w-6 h-6" />
                                        </div>
                                        <h4 className={`text-lg font-black mb-1 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Lançar Gasto</h4>
                                        <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                                            Registre compras, contas, lazer e despesas variáveis do dia a dia.
                                        </p>
                                    </button>

                                    <button 
                                        onClick={() => setStep('investment')}
                                        className={`group p-6 rounded-3xl border-2 text-left transition-all hover:scale-105 active:scale-95 ${
                                            theme === 'light' 
                                            ? 'bg-emerald-50 border-emerald-100 hover:border-emerald-400' 
                                            : 'bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/40'
                                        }`}
                                    >
                                        <div className="p-3 bg-emerald-500 text-white rounded-2xl w-fit mb-4 shadow-lg shadow-emerald-500/20">
                                            <PiggyBank className="w-6 h-6" />
                                        </div>
                                        <h4 className={`text-lg font-black mb-1 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Guardar / Investir</h4>
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
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Descrição</label>
                                        <input 
                                            type="text" required value={description} onChange={e => setDescription(e.target.value)}
                                            placeholder="Ex: Supermercado, Aluguel..."
                                            className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-rose-500' : 'bg-white/5 border-white/5 text-white focus:border-rose-500'
                                            }`}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Valor (R$)</label>
                                            <input 
                                                type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)}
                                                placeholder="0.00"
                                                className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-rose-500' : 'bg-white/5 border-white/5 text-white focus:border-rose-500'
                                                }`}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Data</label>
                                            <input 
                                                type="date" required value={date} onChange={e => setDate(e.target.value)}
                                                className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 [color-scheme:light]' : 'bg-white/5 border-white/5 text-white [color-scheme:dark]'
                                                }`}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Categoria</label>
                                        <select 
                                            value={category} onChange={e => {
                                                const newCat = e.target.value;
                                                setCategory(newCat);
                                                const catDef = CATEGORIES.expense.find(c => c.id === newCat);
                                                if (catDef?.defaultPriority) setPriority(catDef.defaultPriority);
                                            }}
                                            className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all appearance-none ${
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
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Prioridade do Gasto</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {PRIORITY_OPTIONS.map(opt => {
                                                const PIcon = opt.icon;
                                                const isSelected = priority === opt.id;
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        onClick={() => setPriority(priority === opt.id ? '' : opt.id)}
                                                        className={`p-3 rounded-2xl border-2 text-center transition-all ${
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
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>Essa é uma venda recorrente</span>
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
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">F. Pagamento</label>
                                            <select 
                                                value={paymentMethod} 
                                                onChange={e => setPaymentMethod(e.target.value)}
                                                className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all appearance-none ${
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
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Nº Parcelas</label>
                                                <input 
                                                    type="number" min="2" max="48"
                                                    value={installments} 
                                                    onChange={e => setInstallments(e.target.value)}
                                                    className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                        theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-rose-500' : 'bg-white/5 border-white/5 text-white focus:border-rose-500'
                                                    }`}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Select Card if Credit Card is active */}
                                    {paymentMethod === 'credito' && (
                                        <div className="animate-in slide-in-from-top-4">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Vincular ao Cartão</label>
                                            <select 
                                                value={selectedCardId} 
                                                onChange={e => setSelectedCardId(e.target.value)}
                                                className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all appearance-none ${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-slate-800 border-white/5 text-white'
                                                }`}
                                            >
                                                <option value="">Selecione um cartão</option>
                                                {cards.map(card => (
                                                    <option key={card.id} value={card.id}>{card.name} (•• {card.last4})</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <button 
                                    type="submit" disabled={isSaving}
                                    className="w-full py-4 bg-rose-500 hover:bg-rose-400 text-white rounded-2xl font-black text-sm shadow-xl shadow-rose-500/20 transition-all active:scale-95"
                                >
                                    {isSaving ? 'Salvando...' : 'Confirmar Lançamento'}
                                </button>
                            </form>
                        )}

                        {/* STEP 3: INVESTMENT FORM */}
                        {step === 'investment' && (
                            <form onSubmit={handleSaveInvestimento} className="space-y-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <button type="button" onClick={() => setStep('choice')} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors">
                                        <ArrowRight className="w-4 h-4 rotate-180" />
                                    </button>
                                    <h3 className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Guardar em Investimento</h3>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Onde guardar?</label>
                                        <select 
                                            required
                                            value={selectedJarId}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setSelectedJarId(val);
                                                if (val === 'new') {
                                                    setIsNewReserve(true);
                                                    setDescription('');
                                                    setCdiPercent('100');
                                                } else if (val !== '') {
                                                    const jar = savingsJars.find(j => j.id === val);
                                                    setIsNewReserve(false);
                                                    setDescription(jar.name);
                                                    setCdiPercent(jar.cdiPercent.toString());
                                                } else {
                                                    setIsNewReserve(false);
                                                    setDescription('');
                                                }
                                            }}
                                            className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all appearance-none ${
                                                theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-slate-800 border-white/5 text-white'
                                            }`}
                                        >
                                            <option value="">Selecione uma reserva...</option>
                                            {savingsJars?.map(jar => (
                                                <option key={jar.id} value={jar.id}>
                                                    {jar.name} (R$ {parseFloat(jar.dynamicBalance || jar.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                                </option>
                                            ))}
                                            <option value="new" className="text-emerald-500 font-bold">+ Criar Nova Reserva...</option>
                                        </select>
                                    </div>

                                    {isNewReserve && (
                                        <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Nome da Reserva</label>
                                                <input 
                                                    type="text" required value={description} onChange={e => setDescription(e.target.value)}
                                                    placeholder="Ex: Reserva Emergência, Viagem..."
                                                    className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                        theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/5 text-white focus:border-emerald-500'
                                                    }`}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Tipo de Investimento</label>
                                                <select 
                                                    value={reserveType} onChange={e => setReserveType(e.target.value)}
                                                    className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all appearance-none ${
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
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Valor (R$)</label>
                                            <input 
                                                type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)}
                                                placeholder="0.00"
                                                className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/5 text-white focus:border-emerald-500'
                                                }`}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">% do CDI</label>
                                            <input 
                                                type="number" required value={cdiPercent} onChange={e => setCdiPercent(e.target.value)}
                                                placeholder="100"
                                                className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/5 text-white focus:border-emerald-500'
                                                }`}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className={`p-4 rounded-2xl border ${
                                    theme === 'light' ? 'bg-emerald-50 border-emerald-100' : 'bg-emerald-500/5 border-emerald-500/10'
                                }`}>
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
                                                const dailyRate = Math.pow(1 + (cdiAnual * (perc/100)), 1 / 365) - 1;
                                                return `+ R$ ${(val * dailyRate).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /dia`;
                                            })()}
                                        </p>
                                    </div>
                                </div>

                                <button 
                                    type="submit" disabled={isSaving}
                                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
                                >
                                    {isSaving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Confirmar e Guardar'}
                                </button>
                            </form>
                        )}

                        {/* STEP: SUCCESS */}
                        {step === 'success' && (
                            <div className="py-8 text-center space-y-8 animate-in zoom-in-95 duration-500">
                                <div className="relative mx-auto w-24 h-24">
                                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping opacity-20"></div>
                                    <div className="relative w-full h-full bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30">
                                        <TrendingUp className="w-10 h-10" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h3 className={`text-2xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                        {isInstallmentSuccess ? 'Parcelamento Agendado!' : 'Lançamento efetuado!'}
                                    </h3>
                                    <p className={`text-sm font-bold ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                                        {isInstallmentSuccess 
                                            ? 'Seu parcelamento foi criado. Agora, vá até a aba Cartões para dar baixa na primeira parcela e debitar do seu saldo.' 
                                            : 'Sua saída foi registrada com sucesso no sistema.'}
                                    </p>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <button 
                                        onClick={() => {
                                            setDescription('');
                                            setAmount('');
                                            setStep(subTab === 'despesas' ? 'expense' : 'investment');
                                        }}
                                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
                                    >
                                        Realizar outra saída
                                    </button>
                                    <button 
                                        onClick={resetForm}
                                        className={`w-full py-4 rounded-2xl font-black text-sm transition-all active:scale-95 ${
                                            theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                        }`}
                                    >
                                        Sair
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP: WARNING */}
                        {step === 'warning' && (
                            <div className="py-8 text-center space-y-8 animate-in slide-in-from-right-4 duration-500">
                                <div className="mx-auto w-20 h-20 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center shadow-inner">
                                    <TrendingDown className="w-10 h-10" />
                                </div>

                                <div className="space-y-3">
                                    <h3 className={`text-2xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Atenção: Saldo Insuficiente!</h3>
                                    <div className={`p-4 rounded-2xl text-left border ${
                                        theme === 'light' ? 'bg-rose-50 border-rose-100' : 'bg-rose-500/5 border-rose-500/10'
                                    }`}>
                                        <p className={`text-xs font-bold leading-relaxed ${theme === 'light' ? 'text-rose-700' : 'text-rose-400'}`}>
                                            Você está prestes a lançar uma saída de <span className="font-black text-sm">R$ {parseFloat(amount).toLocaleString('pt-BR')}</span>, mas seu saldo total em carteira é de apenas <span className="font-black text-sm text-emerald-500">R$ {availableBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>.
                                            <br/><br/>
                                            Lançar este valor fará com que você gaste mais do que possui disponível, o que pode gerar <span className="underline">endividamento</span>. Deseja prosseguir mesmo assim?
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <button 
                                        onClick={handleConfirmWarning}
                                        className="w-full py-4 bg-rose-500 hover:bg-rose-400 text-white rounded-2xl font-black text-sm shadow-xl shadow-rose-500/20 transition-all active:scale-95"
                                    >
                                        Sim, prosseguir mesmo assim
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setStep(pendingSave.type === 'expense' ? 'expense' : 'investment');
                                            setPendingSave(null);
                                        }}
                                        className={`w-full py-4 rounded-2xl font-black text-sm transition-all active:scale-95 ${
                                            theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                        }`}
                                    >
                                        Não, quero revisar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {transactionToDelete && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[250] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className={`w-full max-w-sm rounded-[2.5rem] p-8 border text-center relative overflow-hidden animate-in zoom-in-95 duration-300 ${
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
                                className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
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
        </div>
    );
}
