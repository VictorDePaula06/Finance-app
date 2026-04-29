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
    Clock,
    Trash2,
    Pencil
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { CATEGORIES } from '../constants/categories';

export default function ExitsTab({ transactions }) {
    const { theme } = useTheme();
    const { currentUser } = useAuth();
    
    // States
    const [showModal, setShowModal] = useState(false);
    const [step, setStep] = useState('choice'); // 'choice' | 'expense' | 'investment' | 'success' | 'warning'
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Form States
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [category, setCategory] = useState('other');
    const [cdiPercent, setCdiPercent] = useState('100');
    const [pendingSave, setPendingSave] = useState(null); // Para guardar o que seria salvo após o aviso

    // Filtered Transactions (Only Expenses/Exits)
    const exits = useMemo(() => {
        return transactions
            .filter(t => t.type === 'expense')
            .sort((a, b) => {
                const dateDiff = new Date(b.date) - new Date(a.date);
                if (dateDiff !== 0) return dateDiff;
                return (b.createdAt || 0) - (a.createdAt || 0);
            });
    }, [transactions]);

    // Calcular saldo do mês para o aviso
    const monthlyBalance = useMemo(() => {
        const currentMonthKey = new Date().toISOString().slice(0, 7);
        const filtered = transactions.filter(t => (t.date?.slice(0, 7) || t.month) === currentMonthKey);
        const income = filtered.filter(t => t.type === 'income').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
        const expense = filtered.filter(t => t.type === 'expense').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
        return income - expense;
    }, [transactions]);

    const resetForm = () => {
        setDescription('');
        setAmount('');
        setDate(new Date().toLocaleDateString('en-CA'));
        setCategory('other');
        setCdiPercent('100');
        setStep('choice');
        setShowModal(false);
        setIsSaving(false);
        setPendingSave(null);
    };

    const handleSaveGasto = async (e) => {
        e.preventDefault();
        if (!description || !amount || isSaving) return;
        setIsSaving(true);

        try {
            const val = parseFloat(amount);
            const transactionData = {
                description,
                amount: val,
                type: 'expense',
                category,
                date: new Date(date).toISOString(),
                userId: currentUser.uid,
                month: date.slice(0, 7),
                createdAt: Date.now(),
                isFixed: false
            };

            // VERIFICAÇÃO DE SALDO (Apenas para novos lançamentos, não para edições)
            if (!editingId && val > monthlyBalance) {
                setPendingSave({ type: 'expense', data: transactionData });
                setStep('warning');
                return;
            }

            if (editingId) {
                const { createdAt, ...updateData } = transactionData;
                await updateDoc(doc(db, 'transactions', editingId), updateData);
                resetForm();
            } else {
                // Salvamento otimista: dispara o envio mas não trava a UI esperando o servidor
                addDoc(collection(db, 'transactions'), transactionData).catch(err => console.error("Erro em background:", err));
                
                // Mudança instantânea de estado
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
        
        if (t.category === 'investment') {
            setStep('investment');
        } else {
            setStep('expense');
        }
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm("Deseja remover esta saída?")) {
            await deleteDoc(doc(db, 'transactions', id));
        }
    };

    const handleSaveInvestimento = async (e) => {
        e.preventDefault();
        if (!description || !amount || isSaving) return;
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

            const jarData = {
                name: description,
                balance: val,
                cdiPercent: perc,
                type: 'cofrinho',
                color: 'emerald',
                userId: currentUser.uid,
                createdAt: now.toISOString(),
                updatedAt: now.toISOString()
            };

            // Logs para depuração local
            console.log("[Dev] Preparando salvamento de investimento:", { transactionData, jarData });

            // VERIFICAÇÃO DE SALDO (Apenas para novos aportes)
            if (!editingId && val > monthlyBalance) {
                setPendingSave({ type: 'investment', transaction: transactionData, jar: jarData });
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
                // Salvamento duplo otimista - disparar e não travar
                const tRef = collection(db, 'transactions');
                const jRef = collection(db, 'savings_jars');
                
                addDoc(tRef, transactionData).then(() => console.log("[Dev] Transação salva.")).catch(err => console.error(err));
                addDoc(jRef, jarData).then(() => console.log("[Dev] Patrimônio atualizado.")).catch(err => console.error(err));

                // Transição imediata de UI
                setIsSaving(false);
                setStep('success');
            }
        } catch (error) {
            console.error("Erro crítico ao salvar investimento:", error);
            alert('Erro ao processar lançamento.');
            setIsSaving(false);
        }
    };

    const handleConfirmWarning = () => {
        if (!pendingSave) return;
        setIsSaving(true);
        
        if (pendingSave.type === 'expense') {
            addDoc(collection(db, 'transactions'), pendingSave.data).catch(err => console.error(err));
        } else if (pendingSave.type === 'investment') {
            // Garantir salvamento duplo no patrimônio após o aviso
            addDoc(collection(db, 'transactions'), pendingSave.transaction).catch(err => console.error(err));
            addDoc(collection(db, 'savings_jars'), pendingSave.jar).catch(err => console.error(err));
        }

        setIsSaving(false);
        setStep('success');
        setPendingSave(null);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            {/* Header & Main Button */}
            <div className="flex flex-col items-center gap-6 py-8">
                <div className={`p-4 rounded-full ${theme === 'light' ? 'bg-rose-50' : 'bg-rose-500/10'}`}>
                    <TrendingDown className={`w-8 h-8 ${theme === 'light' ? 'text-rose-500' : 'text-rose-400'}`} />
                </div>
                <div className="text-center">
                    <h2 className={`text-2xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Histórico de Saídas</h2>
                    <p className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Visualize seus últimos lançamentos e registre novos gastos.</p>
                </div>
                <button 
                    onClick={() => {
                        setStep('choice');
                        setShowModal(true);
                    }}
                    className="group flex items-center gap-3 px-8 py-4 bg-rose-500 hover:bg-rose-400 text-white rounded-2xl font-black text-sm shadow-xl shadow-rose-500/20 transition-all active:scale-95 hover:scale-105"
                >
                    <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
                    Lançamento de Saída
                </button>
            </div>

            {/* Transactions List */}
            <div className={`p-6 md:p-8 rounded-[2.5rem] border shadow-sm ${
                theme === 'light' ? 'bg-white border-slate-100' : 'bg-slate-900 border-white/5'
            }`}>
                <div className="flex items-center gap-2 mb-6 text-slate-500 uppercase tracking-widest text-[10px] font-black">
                    <Clock className="w-3 h-3" />
                    Últimas Movimentações
                </div>

                <div className="space-y-3">
                    {exits.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-sm font-bold text-slate-400">Nenhuma saída registrada.</p>
                        </div>
                    ) : (
                        exits.slice(0, 15).map(t => {
                            const cat = CATEGORIES.expense.find(c => c.id === t.category) || { icon: Circle, color: 'text-slate-400', label: 'Outros' };
                            const Icon = cat.icon;
                            return (
                                <div key={t.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all hover:translate-x-1 ${
                                    theme === 'light' ? 'bg-slate-50/50 border-slate-100 hover:bg-white' : 'bg-white/5 border-white/5 hover:bg-white/10'
                                }`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${
                                            theme === 'light' ? 'bg-white' : 'bg-slate-900'
                                        }`}>
                                            <Icon className={`w-5 h-5 ${cat.color}`} />
                                        </div>
                                        <div>
                                            <h4 className={`font-bold text-sm ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>{t.description}</h4>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase opacity-60">
                                                {new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} • {cat.label}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`font-black ${t.category === 'investment' ? 'text-blue-500' : 'text-rose-500'} mr-2`}>
                                            - R$ {parseFloat(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                                            onClick={() => handleDelete(t.id)}
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

            {/* Modal Overlay */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className={`w-full max-w-lg rounded-[3rem] p-8 md:p-12 border relative overflow-hidden animate-in zoom-in-95 duration-300 ${
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
                                            value={category} onChange={e => setCategory(e.target.value)}
                                            className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all appearance-none ${
                                                theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800' : 'bg-slate-800 border-white/5 text-white'
                                            }`}
                                        >
                                            {CATEGORIES.expense.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.label}</option>
                                            ))}
                                        </select>
                                    </div>
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
                                        <input 
                                            type="text" required value={description} onChange={e => setDescription(e.target.value)}
                                            placeholder="Ex: Cofrinho, Tesouro SELIC, Reserva..."
                                            className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/5 text-white focus:border-emerald-500'
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
                                    <h3 className={`text-2xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Lançamento efetuado!</h3>
                                    <p className={`text-sm font-bold ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Sua saída foi registrada com sucesso no sistema.</p>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <button 
                                        onClick={() => {
                                            setDescription('');
                                            setAmount('');
                                            setStep('choice');
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
                                            Você está prestes a lançar uma saída de <span className="font-black text-sm">R$ {parseFloat(amount).toLocaleString('pt-BR')}</span>, mas seu saldo disponível no mês é de apenas <span className="font-black text-sm text-emerald-500">R$ {monthlyBalance.toLocaleString('pt-BR')}</span>.
                                            <br/><br/>
                                            Lançar este valor fará com que suas saídas superem suas entradas, o que pode gerar <span className="underline">endividamento</span>. Deseja prosseguir mesmo assim?
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
        </div>
    );
}
