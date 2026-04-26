import { useState, useEffect } from 'react';
import { 
    TrendingUp, 
    TrendingDown, 
    Plus, 
    Search, 
    PieChart, 
    Activity, 
    Wallet, 
    ArrowUpRight, 
    ArrowDownRight, 
    Bitcoin, 
    Landmark, 
    LineChart,
    Trash2,
    RefreshCw,
    Edit2,
    Coins,
    AlertTriangle,
    PiggyBank,
    Pencil,
    X,
    Check
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

const JAR_COLORS = [
    { id: 'emerald', label: 'Verde', cls: 'bg-emerald-500', text: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { id: 'blue', label: 'Azul', cls: 'bg-blue-500', text: 'text-blue-500', bg: 'bg-blue-500/10' },
    { id: 'purple', label: 'Roxo', cls: 'bg-purple-500', text: 'text-purple-500', bg: 'bg-purple-500/10' },
    { id: 'amber', label: 'Âmbar', cls: 'bg-amber-500', text: 'text-amber-500', bg: 'bg-amber-500/10' },
    { id: 'rose', label: 'Rosa', cls: 'bg-rose-500', text: 'text-rose-500', bg: 'bg-rose-500/10' },
    { id: 'cyan', label: 'Ciano', cls: 'bg-cyan-500', text: 'text-cyan-500', bg: 'bg-cyan-500/10' },
];

export default function InvestmentsTab() {
    const { theme } = useTheme();
    const { currentUser } = useAuth();
    const [investments, setInvestments] = useState([]);
    const [jars, setJars] = useState([]);
    const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, type, title }
    const [isAddingJar, setIsAddingJar] = useState(false);
    const [editingJarId, setEditingJarId] = useState(null);
    const [jarForm, setJarForm] = useState({ name: '', balance: '', cdiPercent: '100', color: 'emerald' });
    const [isAdding, setIsAdding] = useState(false);
    const [isEditing, setIsEditing] = useState(null);
    const [isAporting, setIsAporting] = useState(null);
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);
    const [prices, setPrices] = useState({});
    const [filter, setFilter] = useState('all');
    
    const [newAsset, setNewAsset] = useState({
        type: 'crypto',
        name: 'Bitcoin',
        symbol: 'BTC',
        quantity: '',
        purchasePrice: '',
        manualCurrentPrice: '',
        aporteAmount: '',
        aporteQuantity: ''
    });

    // Asset Types Config
    const ASSET_TYPES = {
        crypto: { label: 'Cripto', icon: Bitcoin, color: 'text-orange-500', bg: 'bg-orange-500/10' },
        tesouro: { label: 'Tesouro', icon: Landmark, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        cdb: { label: 'CDB/LCI', icon: LineChart, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        stocks: { label: 'Ações/FIIs', icon: Activity, color: 'text-purple-500', bg: 'bg-purple-500/10' }
    };

    useEffect(() => {
        if (!currentUser) return;
        const q = query(collection(db, 'investments'), where('userId', '==', currentUser.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setInvestments(items);
        });
        return () => unsubscribe();
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) return;
        const q = query(collection(db, 'savings_jars'), where('userId', '==', currentUser.uid));
        const unsub = onSnapshot(q, (snap) => {
            setJars(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [currentUser]);

    const handleSaveJar = async (e) => {
        e.preventDefault();
        const data = {
            name: jarForm.name,
            balance: parseFloat(jarForm.balance) || 0,
            cdiPercent: parseFloat(jarForm.cdiPercent) || 100,
            color: jarForm.color,
            userId: currentUser.uid,
            updatedAt: new Date().toISOString(),
        };
        if (editingJarId) {
            await updateDoc(doc(db, 'savings_jars', editingJarId), data);
        } else {
            await addDoc(collection(db, 'savings_jars'), { ...data, createdAt: new Date().toISOString() });
        }
        setIsAddingJar(false);
        setEditingJarId(null);
        setJarForm({ name: '', balance: '', cdiPercent: '100', color: 'emerald' });
    };

    const handleDeleteJar = async (id) => {
        await deleteDoc(doc(db, 'savings_jars', id));
        setDeleteConfirm(null);
    };

    // Fetch Prices (Crypto + Basic Indices)
    const fetchLivePrices = async () => {
        setIsLoadingPrices(true);
        try {
            // Fetch BTC-BRL from Mercado Bitcoin
            const btcRes = await fetch('https://api.mercadobitcoin.net/api/v4/tickers?symbols=BTC-BRL');
            const btcData = await btcRes.json();
            
            // Fetch CDI from BCB (Approximate/Monthly)
            const cdiRes = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json');
            const cdiData = await cdiRes.json();

            setPrices({
                BTC: parseFloat(btcData[0].last),
                CDI: parseFloat(cdiData[0].valor) * 365, // Simplified annualization
                // We'll use purchase price + estimated CDI for fixed income if live data is missing
            });
        } catch (error) {
            console.error("Price fetch failed:", error);
        } finally {
            setIsLoadingPrices(false);
        }
    };

    useEffect(() => {
        fetchLivePrices();
        const interval = setInterval(fetchLivePrices, 60000 * 5); // 5 min
        return () => clearInterval(interval);
    }, []);

    const parseBrazilianNumber = (val) => {
        if (!val) return 0;
        let s = val.toString().trim();
        if (s.includes(',') && s.includes('.')) {
            return parseFloat(s.replace(/\./g, '').replace(',', '.'));
        } else if (s.includes(',')) {
            return parseFloat(s.replace(',', '.'));
        }
        return parseFloat(s);
    };

    const handleSaveAsset = async (e) => {
        e.preventDefault();
        try {
            const quantity = parseBrazilianNumber(newAsset.quantity);
            const purchasePrice = parseBrazilianNumber(newAsset.purchasePrice);
            const manualPrice = newAsset.manualCurrentPrice ? parseBrazilianNumber(newAsset.manualCurrentPrice) : null;

            const assetData = {
                ...newAsset,
                quantity,
                purchasePrice,
                manualCurrentPrice: manualPrice,
                updatedAt: new Date().toISOString()
            };

            if (isEditing) {
                const { id, ...dataToUpdate } = assetData;
                await updateDoc(doc(db, 'investments', isEditing), dataToUpdate);
            } else {
                await addDoc(collection(db, 'investments'), {
                    ...assetData,
                    createdAt: new Date().toISOString(),
                    userId: currentUser.uid
                });
            }

            setIsAdding(false);
            setIsEditing(null);
            setIsAporting(null);
            setNewAsset({ type: 'crypto', name: 'Bitcoin', symbol: 'BTC', quantity: '', purchasePrice: '', manualCurrentPrice: '', aporteAmount: '', aporteQuantity: '' });
        } catch (error) {
            console.error("Error saving asset:", error);
        }
    };

    const handleAporte = async (e) => {
        e.preventDefault();
        try {
            const asset = investments.find(a => a.id === isAporting);
            if (!asset) return;

            const q_new = parseBrazilianNumber(newAsset.aporteQuantity);
            const v_new = parseBrazilianNumber(newAsset.aporteAmount);

            const q_old = asset.quantity;
            const p_old = asset.purchasePrice;

            const q_total = q_old + q_new;
            const p_avg = ((q_old * p_old) + v_new) / q_total;

            await updateDoc(doc(db, 'investments', isAporting), {
                quantity: q_total,
                purchasePrice: p_avg,
                updatedAt: new Date().toISOString()
            });

            setIsAporting(null);
            setNewAsset({ type: 'crypto', name: 'Bitcoin', symbol: 'BTC', quantity: '', purchasePrice: '', manualCurrentPrice: '', aporteAmount: '', aporteQuantity: '' });
        } catch (error) {
            console.error("Error processing aporte:", error);
        }
    };

    const handleDeleteAsset = async (id) => {
        await deleteDoc(doc(db, 'investments', id));
        setDeleteConfirm(null);
    };

    const calculateStats = (filteredInvestments) => {
        let totalInvested = 0;
        let currentValue = 0;

        filteredInvestments.forEach(asset => {
            const invested = asset.quantity * asset.purchasePrice;
            totalInvested += invested;

            let currentPrice = asset.manualCurrentPrice || asset.purchasePrice;
            if (asset.type === 'crypto' && prices[asset.symbol]) {
                currentPrice = prices[asset.symbol];
            } else if (!asset.manualCurrentPrice && (asset.type === 'tesouro' || asset.type === 'cdb')) {
                currentPrice = asset.purchasePrice * 1.05; 
            }
            
            currentValue += (asset.quantity * currentPrice);
        });

        const profit = currentValue - totalInvested;
        const profitPct = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

        return { totalInvested, currentValue, profit, profitPct };
    };

    const activeInvestments = filter === 'all' 
        ? investments 
        : investments.filter(a => a.type === filter);

    const stats = calculateStats(activeInvestments);

    const groupedInvestments = activeInvestments.reduce((acc, asset) => {
        const type = asset.type || 'crypto';
        if (!acc[type]) acc[type] = [];
        acc[type].push(asset);
        return acc;
    }, {});

    const availableFilters = ['all', ...new Set(investments.map(a => a.type || 'crypto'))];

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className={`text-3xl font-black tracking-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Investimentos</h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                        {filter === 'all' ? 'Acompanhe seu patrimônio total' : `Visualizando: ${ASSET_TYPES[filter]?.label}`}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={fetchLivePrices}
                        className={`p-4 rounded-2xl border transition-all ${
                            theme === 'light' ? 'bg-white border-slate-100 hover:bg-slate-50 text-slate-400' : 'bg-slate-900 border-white/5 hover:bg-white/10 text-slate-500'
                        }`}
                        title="Atualizar Preços"
                    >
                        <RefreshCw className={`w-5 h-5 ${isLoadingPrices ? 'animate-spin' : ''}`} />
                    </button>
                    <button 
                        onClick={() => {
                            setIsEditing(null);
                            setNewAsset({ type: 'crypto', name: 'Bitcoin', symbol: 'BTC', quantity: '', purchasePrice: '', manualCurrentPrice: '' });
                            setIsAdding(true);
                        }}
                        className="px-6 py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/20 flex items-center gap-3 transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" /> Adicionar Ativo
                    </button>
                </div>
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap gap-2">
                {availableFilters.map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            filter === f
                            ? (theme === 'light' ? 'bg-slate-800 text-white shadow-lg' : 'bg-white text-slate-900 shadow-xl shadow-white/10')
                            : (theme === 'light' ? 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50' : 'bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10')
                        }`}
                    >
                        {f === 'all' ? 'Tudo' : (ASSET_TYPES[f]?.label || f)}
                    </button>
                ))}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`p-6 md:p-8 rounded-[2.5rem] border ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                        <Wallet className="w-3 h-3" /> Patrimônio Total
                    </p>
                    <div className="flex items-end gap-3">
                        <p className={`text-3xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                            R$ {stats.currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <div className={`mb-1 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${stats.profit >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {stats.profit >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {Math.abs(stats.profitPct).toFixed(1)}%
                        </div>
                    </div>
                </div>

                <div className={`p-6 md:p-8 rounded-[2.5rem] border ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                        <TrendingUp className="w-3 h-3" /> Total Investido
                    </p>
                    <p className={`text-3xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                        R$ {stats.totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>

                <div className={`p-6 md:p-8 rounded-[2.5rem] border ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                        <LineChart className="w-3 h-3" /> Lucro Bruto
                    </p>
                    <p className={`text-3xl font-black ${stats.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        R$ {stats.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {/* Asset Sections */}
            <div className="space-y-12">
                {investments.length === 0 ? (
                    <div className={`p-16 rounded-[3rem] border border-dashed text-center space-y-4 ${theme === 'light' ? 'border-slate-200' : 'border-white/5'}`}>
                        <div className="w-20 h-20 bg-slate-500/10 rounded-3xl flex items-center justify-center mx-auto">
                            <Search className="w-10 h-10 text-slate-500" />
                        </div>
                        <p className="text-sm font-bold text-slate-500">Nenhum investimento cadastrado ainda.</p>
                    </div>
                ) : (
                    Object.entries(groupedInvestments).map(([type, assets]) => {
                        const Config = ASSET_TYPES[type] || ASSET_TYPES.crypto;
                        const typeTotal = assets.reduce((sum, a) => {
                            let price = a.manualCurrentPrice || (prices[a.symbol] || a.purchasePrice);
                            if (!a.manualCurrentPrice && (a.type === 'tesouro' || a.type === 'cdb')) price = a.purchasePrice * 1.05;
                            return sum + (a.quantity * price);
                        }, 0);

                        return (
                            <div key={type} className="space-y-6">
                                <div className="flex items-center justify-between px-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${Config.bg}`}>
                                            <Config.icon className={`w-4 h-4 ${Config.color}`} />
                                        </div>
                                        <h3 className={`text-sm font-black uppercase tracking-widest ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                            {Config.label}
                                        </h3>
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500">
                                            {assets.length}
                                        </span>
                                    </div>
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                                        Total: R$ {typeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {assets.map(asset => {
                                        let currentPrice = asset.manualCurrentPrice || (prices[asset.symbol] || asset.purchasePrice);
                                        if (!asset.manualCurrentPrice && (asset.type === 'tesouro' || asset.type === 'cdb')) currentPrice = asset.purchasePrice * 1.05;

                                        const currentVal = asset.quantity * currentPrice;
                                        const investedVal = asset.quantity * asset.purchasePrice;
                                        const profit = currentVal - investedVal;
                                        const profitPct = (profit / investedVal) * 100;

                                        return (
                                            <div key={asset.id} className={`group relative p-8 rounded-[2.5rem] border transition-all hover:shadow-2xl ${
                                                theme === 'light' ? 'bg-white border-slate-100 hover:border-emerald-200 shadow-sm' : 'bg-slate-900 border-white/5 hover:bg-white/10'
                                            }`}>
                                                    <div className="flex items-center gap-5 mb-6">
                                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${Config.bg} shadow-inner`}>
                                                            <Config.icon className={`w-7 h-7 ${Config.color}`} />
                                                        </div>
                                                        <div>
                                                            <h4 className={`font-black text-base ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{asset.name}</h4>
                                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest opacity-80">{asset.quantity} {asset.symbol}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-6">
                                                        <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                                            <p className="text-[11px] uppercase font-black text-slate-500 opacity-60 tracking-tighter">Médio / Atual</p>
                                                            <div className="text-right">
                                                                <p className={`text-sm font-bold ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>R$ {asset.purchasePrice.toLocaleString('pt-BR')}</p>
                                                                <p className={`text-base font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>R$ {currentPrice.toLocaleString('pt-BR')}</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex justify-between items-end py-2">
                                                            <div>
                                                                <p className="text-[11px] uppercase font-black text-slate-500 opacity-60 tracking-tighter">Patrimônio</p>
                                                                <p className={`text-2xl font-black ${profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                    R$ {currentVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className={`text-[11px] font-black px-3 py-1.5 rounded-xl ${profit >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                                    {profit >= 0 ? '+' : ''}{profitPct.toFixed(1)}%
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-center gap-3 mt-6 pt-6 border-t border-white/5">
                                                            <button 
                                                                onClick={() => {
                                                                    setNewAsset({ ...asset, aporteQuantity: '', aporteAmount: '' });
                                                                    setIsAporting(asset.id);
                                                                }}
                                                                className="flex-1 flex items-center justify-center gap-2 py-4 bg-blue-500/10 text-blue-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all shadow-lg shadow-blue-500/5"
                                                            >
                                                                <Coins className="w-4 h-4" /> Aporte
                                                            </button>
                                                            <button 
                                                                onClick={() => {
                                                                    setNewAsset({ ...asset });
                                                                    setIsEditing(asset.id);
                                                                    setIsAdding(true);
                                                                }}
                                                                className="p-4 bg-slate-500/10 text-slate-500 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button 
                                                                onClick={() => setDeleteConfirm({ id: asset.id, type: 'asset', title: asset.name })}
                                                                className="p-4 bg-slate-500/10 text-slate-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Delete overlay for Asset */}
                                                    {deleteConfirm?.id === asset.id && deleteConfirm?.type === 'asset' && (
                                                        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center z-50 animate-in fade-in duration-300">
                                                            <div className="w-full">
                                                                <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                                                    <Trash2 className="w-8 h-8 text-rose-500" />
                                                                </div>
                                                                <p className="text-white font-black text-lg mb-2">Excluir Ativo?</p>
                                                                <p className="text-white/50 text-[10px] mb-8 leading-relaxed px-4">Esta ação removerá <span className="text-white font-bold">{asset.name}</span> da sua carteira.</p>
                                                                <div className="flex gap-3">
                                                                    <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-4 rounded-2xl bg-white/10 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-colors">Não</button>
                                                                    <button onClick={() => handleDeleteAsset(asset.id)} className="flex-1 py-4 rounded-2xl bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-colors">Excluir</button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Modal: Adicionar/Editar Ativo */}
            {isAdding && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className={`w-full max-w-md rounded-[3rem] p-8 md:p-10 border animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
                    }`}>
                        <h3 className={`text-2xl font-black mb-1 text-center ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                            {isEditing ? 'Editar Ativo' : 'Novo Ativo'}
                        </h3>
                        <p className="text-slate-500 text-xs font-bold text-center mb-8 uppercase tracking-widest">
                            {isEditing ? 'Ajuste os dados do seu investimento' : 'Adicione seus investimentos para acompanhar'}
                        </p>

                        <form onSubmit={handleSaveAsset} className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Tipo de Ativo</label>
                                <select 
                                    value={newAsset.type}
                                    onChange={(e) => setNewAsset({...newAsset, type: e.target.value})}
                                    className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all appearance-none ${
                                        theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-slate-800 border-white/10 text-white focus:border-emerald-500'
                                    }`}
                                >
                                    {Object.entries(ASSET_TYPES).map(([key, config]) => (
                                        <option key={key} value={key} className={theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}>
                                            {config.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Nome</label>
                                    <input 
                                        type="text"
                                        list="asset-names"
                                        value={newAsset.name}
                                        onChange={(e) => setNewAsset({...newAsset, name: e.target.value})}
                                        className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                            theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                        }`}
                                        placeholder="Ex: Selic 2029"
                                    />
                                    <datalist id="asset-names">
                                        {newAsset.type === 'crypto' && (
                                            <>
                                                <option value="Bitcoin" />
                                                <option value="Ethereum" />
                                                <option value="Solana" />
                                            </>
                                        )}
                                        {newAsset.type === 'tesouro' && (
                                            <>
                                                <option value="Tesouro Selic 2029" />
                                                <option value="Tesouro IPCA+ 2045" />
                                                <option value="Tesouro Renda+ 2065" />
                                                <option value="Tesouro Educar+ 2040" />
                                            </>
                                        )}
                                        {newAsset.type === 'cdb' && (
                                            <>
                                                <option value="CDB 100% CDI" />
                                                <option value="LCI/LCA Isento" />
                                                <option value="CDB Prefixado" />
                                            </>
                                        )}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Símbolo/Ticker</label>
                                    <input 
                                        type="text"
                                        list={newAsset.type === 'crypto' ? "crypto-symbols" : ""}
                                        value={newAsset.symbol}
                                        onChange={(e) => setNewAsset({...newAsset, symbol: e.target.value.toUpperCase()})}
                                        className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                            theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                        }`}
                                        placeholder={newAsset.type === 'crypto' ? "Ex: BTC" : "Opcional"}
                                    />
                                    {newAsset.type === 'crypto' && (
                                        <datalist id="crypto-symbols">
                                            <option value="BTC" />
                                            <option value="ETH" />
                                            <option value="SOL" />
                                            <option value="XRP" />
                                            <option value="ADA" />
                                            <option value="DOT" />
                                            <option value="DOGE" />
                                            <option value="MATIC" />
                                            <option value="LINK" />
                                            <option value="USDT" />
                                            <option value="USDC" />
                                        </datalist>
                                    )}
                                    {newAsset.type === 'crypto' && (
                                        <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tighter opacity-70">
                                            * Use o código da moeda para preço automático
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Quantidade</label>
                                    <input 
                                        type="text"
                                        inputMode="decimal"
                                        value={newAsset.quantity}
                                        onChange={(e) => setNewAsset({...newAsset, quantity: e.target.value})}
                                        className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                            theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                        }`}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Preço Médio (R$)</label>
                                    <input 
                                        type="text"
                                        inputMode="decimal"
                                        value={newAsset.purchasePrice}
                                        onChange={(e) => setNewAsset({...newAsset, purchasePrice: e.target.value})}
                                        className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                            theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                        }`}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            {(newAsset.type === 'tesouro' || newAsset.type === 'cdb') && (
                                <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 animate-in slide-in-from-top-2">
                                    <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 block">Sincronizar Preço Atual (R$)</label>
                                    <input 
                                        type="text"
                                        inputMode="decimal"
                                        value={newAsset.manualCurrentPrice || ''}
                                        onChange={(e) => setNewAsset({...newAsset, manualCurrentPrice: e.target.value})}
                                        className={`w-full p-4 rounded-xl border font-bold text-sm focus:outline-none transition-all ${
                                            theme === 'light' ? 'bg-white border-emerald-100 text-slate-800 focus:border-emerald-500' : 'bg-slate-900 border-emerald-500/20 text-white focus:border-emerald-500'
                                        }`}
                                        placeholder="Valor unitário atual (ex: 181.63)"
                                    />
                                    <p className="text-[9px] font-bold text-emerald-600/70 mt-2 italic">
                                        * Use este campo para deixar o saldo igual ao do seu banco/portal.
                                    </p>
                                </div>
                            )}

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
                                    {isEditing ? 'Salvar Alterações' : 'Salvar Ativo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Novo Aporte */}
            {isAporting && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className={`w-full max-w-md rounded-[3rem] p-8 md:p-10 border animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
                    }`}>
                        <div className="flex flex-col items-center mb-8">
                            <div className="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center mb-4">
                                <Coins className="w-8 h-8 text-blue-500" />
                            </div>
                            <h3 className={`text-2xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                Novo Aporte
                            </h3>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                                {investments.find(a => a.id === isAporting)?.name}
                            </p>
                        </div>

                        <form onSubmit={handleAporte} className="space-y-6">
                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block text-center">Quanto você comprou HOJE?</label>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Quantidade</p>
                                            <input 
                                                type="text"
                                                inputMode="decimal"
                                                required
                                                value={newAsset.aporteQuantity}
                                                onChange={(e) => setNewAsset({...newAsset, aporteQuantity: e.target.value})}
                                                className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-blue-500'
                                                }`}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Total Pago (R$)</p>
                                            <input 
                                                type="text"
                                                inputMode="decimal"
                                                required
                                                value={newAsset.aporteAmount}
                                                onChange={(e) => setNewAsset({...newAsset, aporteAmount: e.target.value})}
                                                className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-blue-500'
                                                }`}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className={`p-4 rounded-2xl border text-center ${theme === 'light' ? 'bg-blue-50 border-blue-100' : 'bg-blue-500/5 border-blue-500/10'}`}>
                                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wide">
                                    O Alívia vai recalcular seu Preço Médio automaticamente com base neste aporte.
                                </p>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsAporting(null)}
                                    className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all ${
                                        theme === 'light' ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-4 bg-blue-500 hover:bg-blue-400 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-500/20 transition-all active:scale-95"
                                >
                                    Confirmar Aporte
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}


            {/* ── COFRINHOS ─────────────────────────────────── */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${theme === 'light' ? 'bg-emerald-50' : 'bg-emerald-500/10'}`}>
                            <PiggyBank className="w-4 h-4 text-emerald-500" />
                        </div>
                        <h3 className={`text-sm font-black uppercase tracking-widest ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                            Cofrinhos
                        </h3>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500">{jars.length}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {jars.length > 0 && (
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                                Total: R$ {jars.reduce((a, j) => a + (j.balance || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        )}
                        <button
                            onClick={() => { setEditingJarId(null); setJarForm({ name: '', balance: '', cdiPercent: '100', color: 'emerald' }); setIsAddingJar(true); }}
                            className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 transition-all ${theme === 'light' ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}
                        >
                            <Plus className="w-3 h-3" /> Novo Cofrinho
                        </button>
                    </div>
                </div>

                {jars.length === 0 ? (
                    <div className={`p-10 rounded-[2.5rem] border border-dashed text-center ${theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
                        <PiggyBank className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-500">Nenhum cofrinho ainda.</p>
                        <p className="text-xs text-slate-400 mt-1">Crie um para registrar suas reservas com rendimento.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {jars.map(jar => {
                            const colorCfg = JAR_COLORS.find(c => c.id === jar.color) || JAR_COLORS[0];
                            // CDI diário estimado
                            const cdiAnual = (prices.CDI || 10.65) / 100;
                            const dailyRate = Math.pow(1 + cdiAnual * (jar.cdiPercent / 100), 1 / 365) - 1;
                            const dailyYield = jar.balance * dailyRate;
                            return (
                                <div key={jar.id} className={`group relative p-8 rounded-[2.5rem] border transition-all hover:shadow-2xl ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'}`}>
                                    <div className="flex items-start justify-between mb-6">
                                        <div className={`p-4 rounded-2xl ${colorCfg.bg} shadow-inner`}>
                                            <PiggyBank className={`w-7 h-7 ${colorCfg.text}`} />
                                        </div>
                                    </div>

                                    <h4 className={`font-black text-base mb-1 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{jar.name}</h4>
                                    <p className={`text-3xl font-black mb-4 ${colorCfg.text}`}>
                                        R$ {jar.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                    <div className="flex items-center gap-2 mb-6 flex-wrap">
                                        <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${colorCfg.bg} ${colorCfg.text}`}>
                                            {jar.cdiPercent}% do CDI
                                        </span>
                                        <span className="text-[11px] font-black text-emerald-500">
                                            +R$ {dailyYield.toFixed(2)}/dia
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-center gap-3 mt-6 pt-6 border-t border-white/5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                                        <button 
                                            onClick={() => { setJarForm({ name: jar.name, balance: String(jar.balance), cdiPercent: String(jar.cdiPercent), color: jar.color }); setEditingJarId(jar.id); setIsAddingJar(true); }}
                                            className="flex-1 flex items-center justify-center gap-2 py-4 bg-emerald-500/10 text-emerald-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-500/5"
                                        >
                                            <Pencil className="w-4 h-4" /> Ajustar
                                        </button>
                                        <button 
                                            onClick={() => setDeleteConfirm({ id: jar.id, type: 'jar', title: jar.name })}
                                            className="p-4 bg-slate-500/10 text-slate-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Delete overlay for Jar */}
                                    {deleteConfirm?.id === jar.id && deleteConfirm?.type === 'jar' && (
                                        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-[2.5rem] flex flex-col items-center justify-center p-8 text-center z-50 animate-in fade-in duration-300">
                                            <div className="max-w-[200px] w-full">
                                                <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <Trash2 className="w-8 h-8 text-rose-500" />
                                                </div>
                                                <p className="text-white font-black text-lg mb-1">Remover {jar.name}?</p>
                                                <p className="text-white/50 text-[10px] mb-8 leading-tight">O saldo será perdido.</p>
                                                <div className="flex gap-3">
                                                    <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-4 rounded-2xl bg-white/10 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-colors">Não</button>
                                                    <button onClick={() => handleDeleteJar(jar.id)} className="flex-1 py-4 rounded-2xl bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-colors">Sim</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal: Cofrinho */}
            {isAddingJar && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className={`w-full max-w-md rounded-[3rem] p-8 border animate-in zoom-in-95 duration-300 ${theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10'}`}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className={`text-2xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                    {editingJarId ? 'Editar Cofrinho' : 'Novo Cofrinho'}
                                </h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Reserva com rendimento</p>
                            </div>
                            <button onClick={() => { setIsAddingJar(false); setEditingJarId(null); }}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveJar} className="space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Nome do Cofrinho</label>
                                <input required type="text" value={jarForm.name} onChange={e => setJarForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder='Ex: "Cofrinho Nubank"'
                                    className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white'}`} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Saldo atual (R$)</label>
                                    <input required type="number" step="0.01" value={jarForm.balance} onChange={e => setJarForm(f => ({ ...f, balance: e.target.value }))}
                                        placeholder="0,00"
                                        className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white'}`} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">% do CDI</label>
                                    <input required type="number" value={jarForm.cdiPercent} onChange={e => setJarForm(f => ({ ...f, cdiPercent: e.target.value }))}
                                        placeholder="100"
                                        className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white'}`} />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Cor</label>
                                <div className="flex gap-2">
                                    {JAR_COLORS.map(c => (
                                        <button key={c.id} type="button" onClick={() => setJarForm(f => ({ ...f, color: c.id }))}
                                            className={`w-8 h-8 rounded-full transition-all ${c.cls} ${jarForm.color === c.id ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-white scale-110' : 'opacity-60 hover:opacity-100'}`} />
                                    ))}
                                </div>
                            </div>
                            <div className={`p-4 rounded-2xl ${theme === 'light' ? 'bg-emerald-50' : 'bg-emerald-500/10'}`}>
                                <p className="text-xs text-emerald-600 font-bold">
                                    💡 Rendimento estimado: R$ {((parseFloat(jarForm.balance) || 0) * (Math.pow(1 + ((prices.CDI || 10.65) / 100) * ((parseFloat(jarForm.cdiPercent) || 100) / 100), 1 / 365) - 1)).toFixed(2)}/dia
                                </p>
                            </div>
                            <div className="flex gap-4 pt-2">
                                <button type="button" onClick={() => { setIsAddingJar(false); setEditingJarId(null); }}
                                    className={`flex-1 py-4 rounded-2xl font-black text-sm ${theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-400'}`}>
                                    Cancelar
                                </button>
                                <button type="submit" className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/20 transition-all active:scale-95">
                                    {editingJarId ? 'Salvar' : 'Criar Cofrinho'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Footer Sources */}
            <div className={`mt-10 p-8 rounded-[2.5rem] border text-center space-y-4 ${
                theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'
            }`}>
                <div className="flex items-center justify-center gap-6 opacity-60 transition-all duration-500">
                    <img 
                        src="https://www.mercadobitcoin.com.br/static/media/logo.3e945c92.svg" 
                        alt="Mercado Bitcoin" 
                        className={`h-5 ${theme === 'dark' ? 'brightness-0 invert' : ''}`} 
                    />
                    <div className="w-px h-4 bg-slate-500/30"></div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                        Banco Central do Brasil
                    </p>
                </div>
                <p className="text-[10px] font-bold text-slate-500/60 uppercase tracking-[0.2em] leading-relaxed">
                    Preços de criptoativos fornecidos por Mercado Bitcoin. <br/>
                    Índices de renda fixa simulados com base na taxa CDI (BCB). <br/>
                    <span className="text-emerald-500/60 mt-2 block font-black">Alívia - Gestão Patrimonial Inteligente</span>
                </p>
            </div>
        </div>
    );
}
