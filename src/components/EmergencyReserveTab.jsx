import React, { useState, useEffect } from 'react';
import {
    PiggyBank,
    Landmark,
    TrendingUp,
    Plus,
    Trash2,
    Edit2,
    ShieldCheck,
    X,
    ArrowRight,
    Save
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useCdiRate } from '../utils/marketRates';
import TrialLimitModal from './TrialLimitModal';

const RESERVE_TYPES = {
    tesouro: { label: 'Tesouro Selic', icon: Landmark, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    cofrinho: { label: 'Cofrinho', icon: PiggyBank, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    cdb: { label: 'CDB Liquidez Diária', icon: TrendingUp, color: 'text-purple-500', bg: 'bg-purple-500/10' }
};

// Títulos Selic (usados como reserva) — fallback quando a API do Tesouro está indisponível.
const SELIC_FALLBACK = [
    { nm: 'Tesouro Selic 2027', anulRentPrcnt: 0 },
    { nm: 'Tesouro Selic 2029', anulRentPrcnt: 0.05 },
    { nm: 'Tesouro Selic 2031', anulRentPrcnt: 0.08 },
];

// Busca a lista de títulos do Tesouro (mesma fonte da aba Investimentos › Renda Fixa).
async function fetchTesouroBonds() {
    try {
        const res = await fetch(`/api/tesouro?t=${Date.now()}`, { signal: AbortSignal.timeout(10000) });
        if (res.ok) { const data = await res.json(); if (data.bonds && data.bonds.length) return data.bonds; }
    } catch { /* tenta proxies */ }
    const url = 'https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/service/api/treasurybondpriceandsavings.json';
    for (const p of [`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, `https://corsproxy.io/?${encodeURIComponent(url)}`]) {
        try {
            const r = await fetch(p, { signal: AbortSignal.timeout(8000) });
            if (!r.ok) continue;
            const j = await r.json();
            const raw = j.contents ?? j;
            const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
            const list = d?.response?.TrsrBondPricLogList?.map(i => i.TrsrBond);
            if (list && list.length) return list;
        } catch { /* tenta próximo */ }
    }
    return SELIC_FALLBACK;
}

export default function EmergencyReserveTab() {
    const { theme } = useTheme();
    const { currentUser, planLevel } = useAuth();
    const isFreePlan = planLevel === 'free';
    const FREE_RESERVE_LIMIT = 1;
    const [showLimitModal, setShowLimitModal] = useState(false);
    const [reserves, setReserves] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [isEditing, setIsEditing] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const cdiRate = useCdiRate(); // Taxa Selic/CDI base — cache global
    const [reserveGoal, setReserveGoal] = useState(null);
    const [isSettingGoal, setIsSettingGoal] = useState(false);
    const [goalInput, setGoalInput] = useState('');
    const [formData, setFormData] = useState({
        type: 'tesouro',
        name: '',
        balance: '',
        cdiPercent: '100'
    });
    const [tesouroBonds, setTesouroBonds] = useState([]);

    // Carrega os títulos Selic quando o modal abre com tipo Tesouro.
    useEffect(() => {
        if (!isAdding || formData.type !== 'tesouro' || tesouroBonds.length > 0) return;
        let cancelled = false;
        fetchTesouroBonds().then(bonds => { if (!cancelled) setTesouroBonds(bonds); });
        return () => { cancelled = true; };
    }, [isAdding, formData.type, tesouroBonds.length]);

    const selicBonds = tesouroBonds.filter(b => b.nm && b.nm.toLowerCase().includes('selic'));
    const loadingTesouro = isAdding && formData.type === 'tesouro' && tesouroBonds.length === 0;

    useEffect(() => {
        if (!currentUser) return;
        const q = query(collection(db, 'savings_jars'), where('userId', '==', currentUser.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setReserves(items);
        });
        return () => unsubscribe();
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) return;
        const unsubscribe = onSnapshot(doc(db, 'users', currentUser.uid), (d) => {
            if (d.exists() && d.data().reserveGoal) {
                setReserveGoal(d.data().reserveGoal);
            } else {
                setReserveGoal(null);
            }
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
                        createdAt: Date.now(),
                        // Reserva lançada pelo módulo Patrimônio NÃO afeta o saldo em carteira.
                        source: 'patrimonio'
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
                        createdAt: Date.now(),
                        // Reserva lançada pelo módulo Patrimônio NÃO afeta o saldo em carteira.
                        source: 'patrimonio'
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

    const handleSaveGoal = async (e) => {
        e.preventDefault();
        const num = parseNumber(goalInput);
        if (num > 0) {
            await setDoc(doc(db, 'users', currentUser.uid), { reserveGoal: num }, { merge: true });
            setIsSettingGoal(false);
            setGoalInput('');
        }
    };

    const totalReserve = reserves.reduce((acc, curr) => {
        const cdiAnual = cdiRate / 100;
        const percent = (curr.cdiPercent || 100) / 100;
        const dailyRate = Math.pow(1 + (cdiAnual * percent), 1 / 365) - 1;
        const lastUpdate = curr.updatedAt ? new Date(curr.updatedAt) : (curr.createdAt ? new Date(curr.createdAt) : new Date());
        const diffDays = Math.max(0, (new Date() - lastUpdate) / (1000 * 60 * 60 * 24));
        return acc + (curr.balance || 0) * Math.pow(1 + dailyRate, diffDays);
    }, 0);
    const totalDailyYield = reserves.reduce((acc, curr) => {
        const cdiAnual = cdiRate / 100;
        const percent = (curr.cdiPercent || 100) / 100;
        const dailyRate = Math.pow(1 + (cdiAnual * percent), 1 / 365) - 1;
        return acc + (curr.balance * dailyRate);
    }, 0);

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className={`text-2xl md:text-3xl font-black tracking-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Reserva para Emergências</h2>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">Sua segurança financeira em primeiro lugar</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-500">Atualizado recentemente</span>
                </div>
            </div>

            {/* Top Pill Dashboard */}
            <div className={`flex flex-wrap items-center gap-6 md:gap-12 p-5 rounded-2xl border ${theme === 'light' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-[#151822] border-white/5 text-white'}`}>
                <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-slate-400 mb-1">Total Consolidado:</span>
                    <span className="text-xl font-black text-emerald-400">
                        R$ {totalReserve.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">Rendimento Diário <TrendingUp className="w-3 h-3" /></span>
                    <span className="text-xl font-black text-emerald-400">
                        +R$ {totalDailyYield.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
                
                <div className="flex flex-col flex-1 min-w-[200px]">
                     <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-slate-400">Status da Meta ({reserveGoal ? 'R$ ' + reserveGoal.toLocaleString('pt-BR') : 'Não definida'})</span>
                        <button onClick={() => { setGoalInput(reserveGoal ? reserveGoal.toString() : ''); setIsSettingGoal(true); }} className="text-slate-500 hover:text-emerald-400 transition-colors">
                            <Edit2 className="w-3 h-3" />
                        </button>
                    </div>
                    {reserveGoal ? (
                        <div className="w-full h-1.5 rounded-full bg-white/10 relative overflow-hidden mt-1">
                            <div className="absolute left-0 top-0 h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${Math.min((totalReserve / reserveGoal) * 100, 100)}%` }}></div>
                        </div>
                    ) : (
                        <button onClick={() => setIsSettingGoal(true)} className="text-[10px] font-bold text-emerald-500 mt-1 uppercase tracking-widest hover:underline">Configurar Meta</button>
                    )}
                </div>

                <div className="ml-auto flex items-center gap-3">
                    <button
                        onClick={() => {
                            if (isFreePlan && reserves.length >= FREE_RESERVE_LIMIT) {
                                setShowLimitModal(true);
                                return;
                            }
                            setIsEditing(null);
                            setFormData({ type: 'tesouro', name: '', balance: '', cdiPercent: '100' });
                            setIsAdding(true);
                        }}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95"
                    >
                        <Plus className="w-3.5 h-3.5" /> Adicionar
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="pt-4">
                <div className="space-y-3">
                    {reserves.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-slate-500 text-xs font-bold">Nenhuma reserva cadastrada.</p>
                        </div>
                    ) : (
                        reserves.map(reserve => {
                            const typeConfig = RESERVE_TYPES[reserve.type] || RESERVE_TYPES.cofrinho;
                            const cdiAnual = cdiRate / 100;
                            const percent = (reserve.cdiPercent || 100) / 100;
                            const dailyRate = Math.pow(1 + (cdiAnual * percent), 1 / 365) - 1;
                            
                            const lastUpdate = reserve.updatedAt ? new Date(reserve.updatedAt) : (reserve.createdAt ? new Date(reserve.createdAt) : new Date());
                            const now = new Date();
                            const diffTime = Math.max(0, now - lastUpdate);
                            const diffDays = diffTime / (1000 * 60 * 60 * 24);
                            
                            const dynamicBalance = reserve.balance * Math.pow(1 + dailyRate, diffDays);
                            const dailyYield = reserve.balance * dailyRate;

                            return (
                                <div key={reserve.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${theme === 'light' ? 'bg-white border-slate-100' : 'bg-[#151822] border-white/5'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeConfig.bg} overflow-hidden`}>
                                            <typeConfig.icon className={`w-4 h-4 ${typeConfig.color}`} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`text-sm font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{reserve.name}</span>
                                            <span className="text-[10px] text-slate-500 font-medium">{typeConfig.label} • {reserve.cdiPercent}% do CDI</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-10">
                                        <div className="hidden md:flex flex-col items-end">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                Saldo Atual <span className="text-amber-500" title="Valor estimado com base no CDI — pode não bater exatamente com o saldo no banco">~</span>
                                            </span>
                                            <span className={`text-sm font-black ${theme === 'light' ? 'text-slate-800' : 'text-emerald-400'}`}>
                                                <span className="text-amber-500 mr-0.5">≈</span>R$ {dynamicBalance.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                            </span>
                                        </div>
                                        <div className="hidden md:flex flex-col items-end w-24">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Proj. Dia</span>
                                            <span className="inline-flex items-center gap-0.5 text-xs font-black text-emerald-500">
                                                <TrendingUp className="w-3 h-3" />
                                                +R$ {dailyYield.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                            </span>
                                        </div>
                                        
                                        <div className="flex items-center gap-1.5 ml-2">
                                            <button 
                                                onClick={() => {
                                                    setFormData({
                                                        type: reserve.type || 'cofrinho',
                                                        name: reserve.name,
                                                        balance: String(reserve.balance ?? ''),
                                                        cdiPercent: reserve.cdiPercent.toString()
                                                    });
                                                    setIsEditing(reserve.id);
                                                    setIsAdding(true);
                                                }} 
                                                className={`p-2 rounded-xl transition-all ${theme==='light'?'bg-slate-100 text-slate-500 hover:bg-slate-200':'bg-white/5 text-slate-400 hover:bg-white/10'}`} 
                                                title="Editar"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => setDeleteConfirm(reserve)} 
                                                className={`p-2 rounded-xl transition-all ${theme==='light'?'bg-rose-50 text-rose-400 hover:bg-rose-100':'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'}`} 
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Modal Delete Interno para a Reserva atual */}
                                    {deleteConfirm?.id === reserve.id && (
                                        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
                                            <div className={`w-full max-w-sm rounded-[2rem] p-8 border animate-in zoom-in-95 duration-300 ${
                                                theme === 'light' ? 'bg-white border-slate-100' : 'bg-slate-900 border-white/10'
                                            }`}>
                                                <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <Trash2 className="w-8 h-8 text-rose-500" />
                                                </div>
                                                <p className={`font-black text-lg mb-2 text-center ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Excluir Reserva?</p>
                                                <p className="text-slate-500 text-[10px] mb-8 text-center leading-relaxed">Esta ação removerá permanentemente <span className="font-bold">{reserve.name}</span>.</p>
                                                <div className="flex gap-3 w-full">
                                                    <button onClick={() => setDeleteConfirm(null)} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-colors ${theme === 'light' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/10 text-white hover:bg-white/20'}`}>Cancelar</button>
                                                    <button onClick={() => handleDelete(reserve.id)} className="flex-1 py-4 rounded-2xl bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-colors">Excluir</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
                {reserves.length > 0 && (
                    <p className="text-[10px] font-medium text-amber-500/70 mt-3 flex items-center gap-1">
                        <span className="font-black">≈</span> Valor estimado com base na taxa CDI — o saldo real no banco pode ser ligeiramente diferente por causa de IOF, IR e variações diárias da taxa.
                    </p>
                )}
            </div>

            {/* Modal Setting Goal */}
            {isSettingGoal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className={`w-full max-w-sm rounded-[2rem] p-8 md:p-10 border animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
                    }`}>
                        <h3 className={`text-xl font-black mb-1 text-center ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                            Meta da Reserva
                        </h3>
                        <p className="text-slate-500 text-xs font-bold text-center mb-6 uppercase tracking-widest">
                            Defina seu alvo de segurança
                        </p>

                        <form onSubmit={handleSaveGoal} className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Valor da Meta (R$)</label>
                                <input 
                                    type="text"
                                    inputMode="decimal"
                                    required
                                    value={goalInput}
                                    onChange={(e) => setGoalInput(e.target.value)}
                                    className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                        theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                    }`}
                                    placeholder="Ex: 50000.00"
                                />
                            </div>

                            <div className="flex gap-4 pt-2">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setIsSettingGoal(false);
                                        setGoalInput('');
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
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Add/Edit */}
            {isAdding && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-3">
                    <div className={`w-full max-w-xl rounded-2xl p-6 border animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-slate-200 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
                    }`}>
                        {/* Header */}
                        <div className="flex items-center justify-between mb-1">
                            <button type="button" onClick={() => { setIsAdding(false); setIsEditing(null); }}
                                className={`p-1.5 rounded-lg transition-colors ${theme === 'light' ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100' : 'text-slate-500 hover:text-slate-300 hover:bg-white/10'}`}>
                                <ArrowRight className="w-4 h-4 rotate-180" />
                            </button>
                            <h3 className={`text-base font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                {isEditing ? 'Editar Reserva' : 'Nova Reserva'}
                            </h3>
                            <button onClick={() => { setIsAdding(false); setIsEditing(null); }}
                                className={`p-1.5 rounded-lg transition-colors ${theme === 'light' ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100' : 'text-slate-500 hover:text-slate-300 hover:bg-white/10'}`}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        {!isEditing && (
                            <p className={`text-xs font-medium mb-5 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                                Guarde com liquidez e segurança.
                            </p>
                        )}

                        <form onSubmit={handleSave} className="space-y-3">
                            <div>
                                <label className={`text-[10px] font-semibold mb-1 block ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Tipo</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                                    className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all appearance-none ${
                                        theme === 'light' ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-800 border-white/10 text-white'
                                    }`}
                                >
                                    {Object.entries(RESERVE_TYPES).map(([key, config]) => (
                                        <option key={key} value={key} className={theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}>
                                            {config.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {formData.type === 'tesouro' ? (
                                <div>
                                    <label className={`text-[10px] font-semibold mb-1 block ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Título do Tesouro Selic</label>
                                    <select
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value, cdiPercent: '100' })}
                                        className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all appearance-none ${
                                            theme === 'light' ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-800 border-white/10 text-white'
                                        }`}
                                    >
                                        <option value="" className={theme === 'dark' ? 'bg-slate-900' : 'bg-white'}>{loadingTesouro ? 'Carregando títulos...' : 'Selecione um título...'}</option>
                                        {selicBonds.map(b => (
                                            <option key={b.nm} value={b.nm} className={theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}>
                                                {b.nm}{b.anulRentPrcnt ? ` — SELIC + ${parseFloat(b.anulRentPrcnt).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% a.a.` : ' — 100% SELIC'}
                                            </option>
                                        ))}
                                    </select>
                                    <p className={`text-[10px] mt-1 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                                        Apenas títulos Tesouro Selic (ideais para reserva — liquidez diária). Rende ~100% do CDI (Selic).
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <label className={`text-[10px] font-semibold mb-1 block ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Nome de Identificação</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all ${
                                            theme === 'light' ? 'bg-white border-slate-300 text-slate-800 placeholder-slate-400' : 'bg-white/5 border-white/10 text-white placeholder-slate-500'
                                        }`}
                                        placeholder={
                                            formData.type === 'cofrinho' ? 'Ex: Nubank, Inter, PicPay...' : 'Ex: CDB Itaú, CDB Sofisa...'
                                        }
                                    />
                                </div>
                            )}

                            <div className={`grid ${formData.type === 'tesouro' ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                                <div>
                                    <label className={`text-[10px] font-semibold mb-1 block ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{formData.type === 'tesouro' ? 'Valor aplicado (R$)' : 'Saldo Atual (R$)'}</label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        required
                                        value={formData.balance}
                                        onChange={(e) => setFormData({...formData, balance: e.target.value})}
                                        className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all ${
                                            theme === 'light' ? 'bg-white border-slate-300 text-slate-800 placeholder-slate-400' : 'bg-white/5 border-white/10 text-white placeholder-slate-500'
                                        }`}
                                        placeholder="0,00"
                                    />
                                </div>
                                {formData.type !== 'tesouro' && (
                                    <div>
                                        <label className={`text-[10px] font-semibold mb-1 block ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>% do CDI</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            required
                                            value={formData.cdiPercent}
                                            onChange={(e) => setFormData({...formData, cdiPercent: e.target.value})}
                                            className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all ${
                                                theme === 'light' ? 'bg-white border-slate-300 text-slate-800 placeholder-slate-400' : 'bg-white/5 border-white/10 text-white placeholder-slate-500'
                                            }`}
                                            placeholder="Ex: 100"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setIsAdding(false); setIsEditing(null); }}
                                    className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all border ${
                                        theme === 'light' ? 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                                    }`}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-emerald-700/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    {isEditing ? 'Atualizar' : 'Salvar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <TrialLimitModal
                isOpen={showLimitModal}
                onClose={() => setShowLimitModal(false)}
                limitMessage={`Você atingiu o limite de ${FREE_RESERVE_LIMIT} cofrinho do Plano Gratuito. Faça upgrade para Premium e tenha cofrinhos ilimitados.`}
            />
        </div>
    );
}
