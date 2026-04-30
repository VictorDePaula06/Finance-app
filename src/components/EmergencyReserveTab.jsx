import React, { useState, useEffect } from 'react';
import { 
    PiggyBank, 
    Landmark, 
    TrendingUp, 
    Plus, 
    Trash2, 
    Edit2,
    ShieldCheck
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

const RESERVE_TYPES = {
    tesouro: { label: 'Tesouro Selic', icon: Landmark, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    cofrinho: { label: 'Cofrinho', icon: PiggyBank, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    cdb: { label: 'CDB Liquidez Diária', icon: TrendingUp, color: 'text-purple-500', bg: 'bg-purple-500/10' }
};

export default function EmergencyReserveTab() {
    const { theme } = useTheme();
    const { currentUser } = useAuth();
    const [reserves, setReserves] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [isEditing, setIsEditing] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [cdiRate, setCdiRate] = useState(10.65); // Taxa Selic/CDI base atual
    
    const [formData, setFormData] = useState({
        type: 'tesouro',
        name: '',
        balance: '',
        cdiPercent: '100'
    });

    useEffect(() => {
        // Fetch approximate CDI rate
        fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json')
            .then(res => res.json())
            .then(data => {
                if (data && data[0] && data[0].valor) {
                    setCdiRate(parseFloat(data[0].valor) * 365); // Basic annualized
                }
            })
            .catch(err => console.warn("Erro ao buscar CDI:", err));
    }, []);

    useEffect(() => {
        if (!currentUser) return;
        const q = query(collection(db, 'savings_jars'), where('userId', '==', currentUser.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setReserves(items);
        });
        return () => unsubscribe();
    }, [currentUser]);

    const parseNumber = (val) => {
        if (!val) return 0;
        let s = val.toString().trim();
        if (s.includes(',') && s.includes('.')) {
            return parseFloat(s.replace(/\./g, '').replace(',', '.'));
        } else if (s.includes(',')) {
            return parseFloat(s.replace(',', '.'));
        }
        return parseFloat(s);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const balance = parseNumber(formData.balance);
            const cdiPercent = parseNumber(formData.cdiPercent);

            const dataToSave = {
                type: formData.type,
                name: formData.name,
                balance,
                cdiPercent,
                color: 'emerald', // retrocompatibility
                updatedAt: new Date().toISOString(),
                userId: currentUser.uid
            };

            if (isEditing) {
                // Sincronizar com transações
                const oldReserve = reserves.find(r => r.id === isEditing);
                const oldBalance = oldReserve?.balance || 0;
                const diff = balance - oldBalance;

                if (diff !== 0) {
                    await addDoc(collection(db, 'transactions'), {
                        description: diff > 0 ? `Aporte Reserva: ${formData.name}` : `Resgate/Ajuste Reserva: ${formData.name}`,
                        amount: Math.abs(diff),
                        type: diff > 0 ? 'expense' : 'income',
                        category: diff > 0 ? 'investment' : 'vault_redemption',
                        date: new Date().toISOString(),
                        userId: currentUser.uid,
                        month: new Date().toISOString().slice(0, 7),
                        createdAt: Date.now()
                    });
                }
                
                await updateDoc(doc(db, 'savings_jars', isEditing), dataToSave);
            } else {
                // Nova reserva - Registrar saída da carteira
                if (balance > 0) {
                    await addDoc(collection(db, 'transactions'), {
                        description: `Criação de Reserva: ${formData.name}`,
                        amount: balance,
                        type: 'expense',
                        category: 'investment',
                        date: new Date().toISOString(),
                        userId: currentUser.uid,
                        month: new Date().toISOString().slice(0, 7),
                        createdAt: Date.now()
                    });
                }

                await addDoc(collection(db, 'savings_jars'), {
                    ...dataToSave,
                    createdAt: new Date().toISOString(),
                });
            }

            setIsAdding(false);
            setIsEditing(null);
            setFormData({ type: 'tesouro', name: '', balance: '', cdiPercent: '100' });
        } catch (error) {
            console.error("Erro ao salvar reserva:", error);
        }
    };

    const handleDelete = async (id) => {
        await deleteDoc(doc(db, 'savings_jars', id));
        setDeleteConfirm(null);
    };

    const totalReserve = reserves.reduce((acc, curr) => acc + (curr.balance || 0), 0);
    const totalDailyYield = reserves.reduce((acc, curr) => {
        const cdiAnual = cdiRate / 100;
        const percent = (curr.cdiPercent || 100) / 100;
        const dailyRate = Math.pow(1 + (cdiAnual * percent), 1 / 365) - 1;
        return acc + (curr.balance * dailyRate);
    }, 0);

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className={`text-3xl font-black tracking-tight flex items-center gap-3 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                        <ShieldCheck className="w-8 h-8 text-emerald-500" /> Reserva para Emergências
                    </h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 ml-11">
                        Sua segurança financeira em primeiro lugar
                    </p>
                </div>
                <button 
                    onClick={() => {
                        setIsEditing(null);
                        setFormData({ type: 'tesouro', name: '', balance: '', cdiPercent: '100' });
                        setIsAdding(true);
                    }}
                    className="px-6 py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 transition-all active:scale-95"
                >
                    <Plus className="w-5 h-5" /> Adicionar à Reserva
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`p-6 md:p-8 rounded-[2.5rem] border ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                        <PiggyBank className="w-3 h-3" /> Total da Reserva
                    </p>
                    <p className={`text-3xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                        R$ {totalReserve.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>

                <div className={`p-6 md:p-8 rounded-[2.5rem] border ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                        <TrendingUp className="w-3 h-3" /> Rendimento Projetado
                    </p>
                    <p className="text-3xl font-black text-emerald-500">
                        + R$ {totalDailyYield.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-bold opacity-70">/dia útil</span>
                    </p>
                </div>
            </div>

            {/* List */}
            {reserves.length === 0 ? (
                <div className={`p-16 rounded-[3rem] border border-dashed text-center space-y-4 ${theme === 'light' ? 'border-slate-200' : 'border-white/5'}`}>
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto">
                        <ShieldCheck className="w-10 h-10 text-emerald-500" />
                    </div>
                    <p className="text-sm font-bold text-slate-500">Nenhuma reserva cadastrada.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {reserves.map(reserve => {
                        const typeConfig = RESERVE_TYPES[reserve.type] || RESERVE_TYPES.cofrinho;
                        const cdiAnual = cdiRate / 100;
                        const percent = (reserve.cdiPercent || 100) / 100;
                        const dailyRate = Math.pow(1 + (cdiAnual * percent), 1 / 365) - 1;
                        
                        // Cálculo do Saldo Dinâmico (Saldo Base + Rendimento Acumulado)
                        const lastUpdate = reserve.updatedAt ? new Date(reserve.updatedAt) : (reserve.createdAt ? new Date(reserve.createdAt) : new Date());
                        const now = new Date();
                        const diffTime = Math.max(0, now - lastUpdate);
                        const diffDays = diffTime / (1000 * 60 * 60 * 24);
                        
                        // Juros compostos simples para o período
                        const dynamicBalance = reserve.balance * Math.pow(1 + dailyRate, diffDays);
                        const dailyYield = reserve.balance * dailyRate;

                        return (
                            <div key={reserve.id} className={`p-8 rounded-[2.5rem] border transition-all hover:shadow-2xl ${
                                theme === 'light' ? 'bg-white border-slate-100 hover:border-emerald-200 shadow-sm' : 'bg-slate-900 border-white/5 hover:bg-white/10'
                            }`}>
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`p-4 rounded-2xl ${typeConfig.bg} shadow-inner`}>
                                        <typeConfig.icon className={`w-7 h-7 ${typeConfig.color}`} />
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => {
                                                setFormData({
                                                    type: reserve.type || 'cofrinho',
                                                    name: reserve.name,
                                                    balance: reserve.balance.toString(),
                                                    cdiPercent: reserve.cdiPercent.toString()
                                                });
                                                setIsEditing(reserve.id);
                                                setIsAdding(true);
                                            }}
                                            className="p-2 text-slate-400 hover:text-emerald-500 transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => setDeleteConfirm(reserve)}
                                            className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                
                                <div>
                                    <h4 className={`text-sm font-black uppercase tracking-widest ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                        {reserve.name}
                                    </h4>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                                        {typeConfig.label} • {reserve.cdiPercent}% do CDI
                                    </p>
                                </div>

                                <div className="mt-6 pt-6 border-t border-white/5 flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Saldo Atualizado</p>
                                        <p className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                            R$ {dynamicBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/70 mb-1">Proj. Dia</p>
                                        <p className="text-sm font-black text-emerald-500">
                                            +R$ {dailyYield.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>

                                {/* Modal Delete */}
                                {deleteConfirm?.id === reserve.id && (
                                    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-[2.5rem] flex flex-col items-center justify-center p-6 text-center z-50 animate-in fade-in duration-300">
                                        <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Trash2 className="w-8 h-8 text-rose-500" />
                                        </div>
                                        <p className="text-white font-black text-lg mb-2">Excluir Reserva?</p>
                                        <p className="text-white/50 text-[10px] mb-8 leading-relaxed">Esta ação removerá permanentemente o registro de <span className="text-white font-bold">{reserve.name}</span>.</p>
                                        <div className="flex gap-3 w-full">
                                            <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-4 rounded-2xl bg-white/10 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-colors">Cancelar</button>
                                            <button onClick={() => handleDelete(reserve.id)} className="flex-1 py-4 rounded-2xl bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-colors">Excluir</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal Add/Edit */}
            {isAdding && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className={`w-full max-w-md rounded-[3rem] p-8 md:p-10 border animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
                    }`}>
                        <h3 className={`text-2xl font-black mb-1 text-center ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                            {isEditing ? 'Editar Reserva' : 'Nova Reserva'}
                        </h3>
                        <p className="text-slate-500 text-xs font-bold text-center mb-8 uppercase tracking-widest">
                            Guarde com liquidez e segurança
                        </p>

                        <form onSubmit={handleSave} className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Tipo</label>
                                <select 
                                    value={formData.type}
                                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                                    className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all appearance-none ${
                                        theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-800 border-white/10 text-white'
                                    }`}
                                >
                                    {Object.entries(RESERVE_TYPES).map(([key, config]) => (
                                        <option key={key} value={key} className={theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}>
                                            {config.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Nome de Identificação</label>
                                <input 
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                        theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                    }`}
                                    placeholder={
                                        formData.type === 'cofrinho' ? 'Ex: Nubank, Inter, PicPay...' : 
                                        formData.type === 'tesouro' ? 'Ex: Tesouro Selic 2029' : 'Ex: CDB Itaú, CDB Sofisa...'
                                    }
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Saldo Atual (R$)</label>
                                    <input 
                                        type="text"
                                        inputMode="decimal"
                                        required
                                        value={formData.balance}
                                        onChange={(e) => setFormData({...formData, balance: e.target.value})}
                                        className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                            theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                        }`}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">% do CDI</label>
                                    <input 
                                        type="text"
                                        inputMode="decimal"
                                        required
                                        value={formData.cdiPercent}
                                        onChange={(e) => setFormData({...formData, cdiPercent: e.target.value})}
                                        className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                            theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                        }`}
                                        placeholder="Ex: 100"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setIsAdding(false);
                                        setIsEditing(null);
                                    }}
                                    className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all ${
                                        theme === 'light' ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
                                >
                                    {isEditing ? 'Atualizar' : 'Salvar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
