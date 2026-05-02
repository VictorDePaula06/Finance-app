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



export default function InvestmentsTab() {
    const { theme } = useTheme();
    const { currentUser } = useAuth();
    const [investments, setInvestments] = useState([]);
    const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, type, title }
    const [isAdding, setIsAdding] = useState(false);
    const [isEditing, setIsEditing] = useState(null);
    const [isAporting, setIsAporting] = useState(null);
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);
    const [prices, setPrices] = useState({ USD: 5.0, CDI: 0.10 });
    const [tesouroData, setTesouroData] = useState([]);
    const [filter, setFilter] = useState('all');
    const [showUSDAsBRL, setShowUSDAsBRL] = useState(false);
    
    const [newAsset, setNewAsset] = useState({
        type: 'renda_fixa',
        name: '',
        symbol: '',
        quantity: '',
        purchasePrice: '',
        manualCurrentPrice: '',
        isUSD: false,
        cdiPercent: '',
        aporteAmount: '',
        aporteQuantity: ''
    });

    // Asset Types Config
    const ASSET_TYPES = {
        renda_fixa: { label: 'Renda Fixa', icon: Landmark, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        acoes: { label: 'Ações', icon: Activity, color: 'text-purple-500', bg: 'bg-purple-500/10' },
        etfs: { label: 'ETFs', icon: PieChart, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
        fiis: { label: 'Fundos Imobiliários', icon: LineChart, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        crypto: { label: 'Criptomoedas', icon: Bitcoin, color: 'text-orange-500', bg: 'bg-orange-500/10' },
        imoveis: { label: 'Imóveis', icon: PiggyBank, color: 'text-amber-500', bg: 'bg-amber-500/10' }
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



    const fetchLivePrices = async () => {
        setIsLoadingPrices(true);
        try {
            const newPrices = { ...prices };

            // Fetch USD-BRL from AwesomeAPI
            try {
                const usdRes = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
                const usdData = await usdRes.json();
                newPrices.USD = parseFloat(usdData.USDBRL.bid);
            } catch (e) {
                console.warn("Could not fetch USD rate");
            }

            // Fetch Crypto from Binance (Covers almost all pairs in USD and BRL)
            const cryptoTickers = [...new Set(investments.filter(a => a.type === 'crypto' && a.symbol).map(a => a.symbol.toUpperCase()))];
            if (cryptoTickers.length > 0) {
                try {
                    const binanceRes = await fetch('https://api.binance.com/api/v3/ticker/price');
                    const binanceData = await binanceRes.json();
                    
                    cryptoTickers.forEach(ticker => {
                        const usdtPair = binanceData.find(p => p.symbol === `${ticker}USDT`);
                        const brlPair = binanceData.find(p => p.symbol === `${ticker}BRL`);
                        
                        if (usdtPair) newPrices[`${ticker}_USD`] = parseFloat(usdtPair.price);
                        if (brlPair) newPrices[`${ticker}_BRL`] = parseFloat(brlPair.price);
                    });
                } catch (e) {
                    console.warn("Could not fetch Binance prices");
                }
            }

            // Fetch Stocks, ETFs, FIIs
            const stockTickers = [...new Set(investments.filter(a => ['acoes', 'etfs', 'fiis'].includes(a.type) && a.symbol).map(a => a.symbol.toUpperCase()))];
            if (stockTickers.length > 0) {
                await Promise.all(stockTickers.map(async (ticker) => {
                    // 1. Try Brapi (Best for BR stocks)
                    try {
                        const brapiRes = await fetch(`https://brapi.dev/api/quote/${ticker}`);
                        if (brapiRes.ok) {
                            const brapiData = await brapiRes.json();
                            if (brapiData.results && brapiData.results[0] && brapiData.results[0].regularMarketPrice) {
                                newPrices[ticker] = parseFloat(brapiData.results[0].regularMarketPrice);
                                return;
                            }
                        }
                    } catch (e) {}

                    // 2. Try Yahoo Finance via Proxy (Handles US and BR fallbacks)
                    try {
                        const isProbablyBR = /\d/.test(ticker) || (ticker.length >= 5 && !ticker.includes('.'));
                        const yahooTicker = isProbablyBR ? `${ticker}.SA` : ticker;
                        
                        // Try both v7/quote and v8/chart for maximum compatibility
                        const urls = [
                            `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooTicker}`,
                            `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}`
                        ];

                        for (const url of urls) {
                            try {
                                // Try primary proxy
                                const res = await fetch(`https://corsproxy.io/?${url}`);
                                if (res.ok) {
                                    const data = await res.json();
                                    const result = data.quoteResponse?.result?.[0] || data.chart?.result?.[0]?.meta;
                                    const price = result?.regularMarketPrice || result?.previousClose || result?.chartPreviousClose;
                                    
                                    if (price) {
                                        newPrices[ticker] = parseFloat(price);
                                        return;
                                    }
                                }
                            } catch (e) {
                                // Try secondary proxy if first fails
                                try {
                                    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
                                    if (res.ok) {
                                        const json = await res.json();
                                        const data = JSON.parse(json.contents);
                                        const result = data.quoteResponse?.result?.[0] || data.chart?.result?.[0]?.meta;
                                        const price = result?.regularMarketPrice || result?.previousClose || result?.chartPreviousClose;
                                        
                                        if (price) {
                                            newPrices[ticker] = parseFloat(price);
                                            return;
                                        }
                                    }
                                } catch (e2) {}
                            }
                        }
                    } catch (e) {
                        console.warn(`Could not fetch price for ${ticker}`, e);
                    }
                }));
            }

            // Fetch CDI from BCB
            try {
                const cdiRes = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json');
                const cdiData = await cdiRes.json();
                newPrices.CDI = parseFloat(cdiData[0].valor) / 100;
            } catch (e) {
                console.warn("Could not fetch CDI");
            }

            // Fetch Tesouro Direto logic moved to separate useEffect
            setPrices(newPrices);
        } catch (error) {
            console.error("Price fetch failed:", error);
        } finally {
            setIsLoadingPrices(false);
        }
    };

    useEffect(() => {
        const FALLBACK_BONDS = [
            { nm: 'Tesouro Selic 2027', anulRentPrcnt: 10.65, untrPric: 14500.00 },
            { nm: 'Tesouro Selic 2029', anulRentPrcnt: 10.65, untrPric: 14800.00 },
            { nm: 'Tesouro IPCA+ 2029', anulRentPrcnt: 6.32, untrPric: 4200.00 },
            { nm: 'Tesouro IPCA+ 2035', anulRentPrcnt: 6.48, untrPric: 3800.00 },
            { nm: 'Tesouro IPCA+ 2045', anulRentPrcnt: 6.51, untrPric: 1950.00 },
            { nm: 'Tesouro IPCA+ 2055', anulRentPrcnt: 6.54, untrPric: 1100.00 },
            { nm: 'Tesouro Renda+ 2030', anulRentPrcnt: 6.40, untrPric: 1050.00 },
            { nm: 'Tesouro Renda+ 2035', anulRentPrcnt: 6.44, untrPric: 950.00 },
            { nm: 'Tesouro Renda+ 2040', anulRentPrcnt: 6.47, untrPric: 850.00 },
            { nm: 'Tesouro Renda+ 2045', anulRentPrcnt: 6.50, untrPric: 760.00 },
            { nm: 'Tesouro Renda+ 2050', anulRentPrcnt: 6.52, untrPric: 680.00 },
            { nm: 'Tesouro Renda+ 2055', anulRentPrcnt: 6.53, untrPric: 600.00 },
            { nm: 'Tesouro Renda+ 2060', anulRentPrcnt: 6.55, untrPric: 540.00 },
            { nm: 'Tesouro Renda+ 2065', anulRentPrcnt: 6.57, untrPric: 480.00 },
            { nm: 'Tesouro Prefixado 2027', anulRentPrcnt: 13.50, untrPric: 820.00 },
            { nm: 'Tesouro Prefixado 2029', anulRentPrcnt: 13.62, untrPric: 680.00 },
            { nm: 'Tesouro Prefixado 2031', anulRentPrcnt: 13.70, untrPric: 560.00 },
        ];

        const fetchTesouro = async () => {
            const tesouroUrl = 'https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/service/api/treasurybondpriceandsavings.json';
            const proxies = [
                `https://api.allorigins.win/get?url=${encodeURIComponent(tesouroUrl)}`,
                `https://corsproxy.io/?${encodeURIComponent(tesouroUrl)}`,
            ];

            for (const proxyUrl of proxies) {
                try {
                    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(6000) });
                    if (!res.ok) continue;
                    const json = await res.json();
                    // allorigins wraps the content in { contents: "..." }
                    const raw = json.contents ?? json;
                    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    if (data?.response?.TrsrBondPricLogList) {
                        const list = data.response.TrsrBondPricLogList.map(item => item.TrsrBond);
                        setTesouroData(list);
                        return; // success
                    }
                } catch (e) {
                    console.warn(`Tesouro proxy failed (${proxyUrl}):`, e.message);
                }
            }

            // All proxies failed — use fallback list so the dropdown is never empty
            console.warn('Tesouro API unavailable — using fallback list');
            setTesouroData(FALLBACK_BONDS);
        };

        fetchTesouro();
    }, []);

    useEffect(() => {
        fetchLivePrices();
        // Update every 2 minutes
        const interval = setInterval(fetchLivePrices, 60000 * 2); 
        return () => clearInterval(interval);
    }, [investments.length]);

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
            const quantity = parseBrazilianNumber(newAsset.quantity) || 1;
            const purchasePrice = parseBrazilianNumber(newAsset.purchasePrice);
            const manualPrice = newAsset.manualCurrentPrice ? parseBrazilianNumber(newAsset.manualCurrentPrice) : null;
            const cdiPercent = newAsset.type === 'renda_fixa' ? parseBrazilianNumber(newAsset.cdiPercent) : null;
            const totalApplied = newAsset.type === 'renda_fixa' ? parseBrazilianNumber(newAsset.totalApplied || newAsset.purchasePrice) : null;

            const assetData = {
                ...newAsset,
                quantity,
                purchasePrice,
                manualCurrentPrice: manualPrice,
                cdiPercent,
                totalApplied,
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
            setNewAsset({ type: 'renda_fixa', name: '', symbol: '', quantity: '', purchasePrice: '', manualCurrentPrice: '', isUSD: false, cdiPercent: '', aporteAmount: '', aporteQuantity: '' });
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
            setNewAsset({ type: 'renda_fixa', name: '', symbol: '', quantity: '', purchasePrice: '', manualCurrentPrice: '', isUSD: false, cdiPercent: '', aporteAmount: '', aporteQuantity: '' });
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
            const usdMultiplier = asset.isUSD ? (prices.USD || 5.0) : 1;

            // Renda Fixa: use totalApplied vs manualCurrentPrice (total value)
            if (asset.type === 'renda_fixa') {
                const applied = asset.totalApplied || (asset.quantity * asset.purchasePrice) || 0;
                const current = asset.manualCurrentPrice || applied;
                totalInvested += applied;
                currentValue += current;
                return;
            }

            const invested = asset.quantity * asset.purchasePrice * usdMultiplier;
            totalInvested += invested;

            let currentPrice = asset.manualCurrentPrice || asset.purchasePrice;
            if (asset.type === 'crypto' && asset.symbol) {
                const sym = asset.symbol.toUpperCase();
                if (asset.isUSD && prices[`${sym}_USD`]) currentPrice = prices[`${sym}_USD`];
                else if (!asset.isUSD && prices[`${sym}_BRL`]) currentPrice = prices[`${sym}_BRL`];
                else if (!asset.isUSD && prices[`${sym}_USD`] && prices.USD) currentPrice = prices[`${sym}_USD`] * prices.USD;
            } else if (['acoes', 'etfs', 'fiis'].includes(asset.type) && asset.symbol) {
                const sym = asset.symbol.toUpperCase();
                if (prices[sym]) currentPrice = prices[sym];
            }
            currentValue += (asset.quantity * currentPrice * usdMultiplier);
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
                        onClick={() => setShowUSDAsBRL(!showUSDAsBRL)}
                        className={`px-4 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${
                            showUSDAsBRL 
                            ? (theme === 'light' ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400') 
                            : (theme === 'light' ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')
                        }`}
                        title="Converter valores estrangeiros para BRL na visualização"
                    >
                        {showUSDAsBRL ? 'Mostrando em R$' : 'Mostrar em R$'}
                    </button>
                    <button  
                        onClick={() => {
                            setIsEditing(null);
                            setNewAsset({ type: 'crypto', name: 'Bitcoin', symbol: 'BTC', quantity: '', purchasePrice: '', manualCurrentPrice: '', isUSD: false });
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
                            const usdMultiplier = a.isUSD ? (prices.USD || 5.0) : 1;
                            let price = a.manualCurrentPrice || a.purchasePrice;
                            
                            if (a.type === 'crypto' && a.symbol) {
                                const sym = a.symbol.toUpperCase();
                                if (a.isUSD && prices[`${sym}_USD`]) price = prices[`${sym}_USD`];
                                else if (!a.isUSD && prices[`${sym}_BRL`]) price = prices[`${sym}_BRL`];
                                else if (!a.isUSD && prices[`${sym}_USD`] && prices.USD) price = prices[`${sym}_USD`] * prices.USD;
                            } else if (['acoes', 'etfs', 'fiis'].includes(a.type) && a.symbol) {
                                const sym = a.symbol.toUpperCase();
                                if (prices[sym]) price = prices[sym];
                            }
                            
                            if (!a.manualCurrentPrice && (a.type === 'tesouro' || a.type === 'cdb')) price = a.purchasePrice * 1.05;
                            return sum + (a.quantity * price * usdMultiplier);
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
                                        // For Renda Fixa: total applied vs total current value
                                        const isFixedIncome = asset.type === 'renda_fixa';
                                        const trueInvested = isFixedIncome
                                            ? (asset.totalApplied || asset.quantity * asset.purchasePrice)
                                            : (asset.quantity * asset.purchasePrice * (asset.isUSD ? prices.USD : 1));
                                        let currentPrice = asset.manualCurrentPrice || asset.purchasePrice;
                                        if (!isFixedIncome) {
                                            if (asset.type === 'crypto' && asset.symbol) {
                                                const sym = asset.symbol.toUpperCase();
                                                if (asset.isUSD && prices[`${sym}_USD`]) currentPrice = prices[`${sym}_USD`];
                                                else if (!asset.isUSD && prices[`${sym}_BRL`]) currentPrice = prices[`${sym}_BRL`];
                                                else if (!asset.isUSD && prices[`${sym}_USD`] && prices.USD) currentPrice = prices[`${sym}_USD`] * prices.USD;
                                            } else if (['acoes', 'etfs', 'fiis'].includes(asset.type) && asset.symbol) {
                                                const sym = asset.symbol.toUpperCase();
                                                if (prices[sym]) currentPrice = prices[sym];
                                            }
                                        }
                                        const trueCurrent = isFixedIncome
                                            ? (asset.manualCurrentPrice || trueInvested)
                                            : (asset.quantity * currentPrice * (asset.isUSD ? prices.USD : 1));
                                        const profitPct = trueInvested > 0 ? ((trueCurrent - trueInvested) / trueInvested) * 100 : 0;
                                        const profitVal = trueCurrent - trueInvested;
                                        
                                        // Visual display
                                        const displayCurrency = asset.isUSD && !showUSDAsBRL ? '$' : 'R$';
                                        const displayMultiplier = asset.isUSD && showUSDAsBRL ? (prices.USD || 5.0) : 1;
                                        const displayCurrentVal = isFixedIncome ? trueCurrent : (asset.quantity * currentPrice * displayMultiplier);
                                        const displayPurchaseVal = isFixedIncome ? trueInvested : (asset.quantity * asset.purchasePrice * displayMultiplier);
                                        const displayCurrentPrice = isFixedIncome ? null : (currentPrice * displayMultiplier);
                                        const displayPurchasePrice = isFixedIncome ? null : (asset.purchasePrice * displayMultiplier);

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
                                                            <p className="text-[11px] uppercase font-black text-slate-500 opacity-60 tracking-tighter">
                                                                {isFixedIncome ? 'Aplicado / Atual' : 'Médio / Atual'}
                                                            </p>
                                                            <div className="text-right">
                                                                {isFixedIncome ? (
                                                                    <>
                                                                        <p className={`text-sm font-bold ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>R$ {displayPurchaseVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                                        <p className={`text-base font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>R$ {displayCurrentVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                                        {asset.fixedRate && <p className="text-[10px] text-blue-400 font-bold mt-0.5">{asset.yieldType === 'ipca' ? `IPCA+ ${asset.fixedRate}%` : asset.yieldType === 'cdi' ? `${asset.cdiPercent}% CDI` : `${asset.fixedRate}% a.a.`}</p>}
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <p className={`text-sm font-bold ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>{displayCurrency} {displayPurchasePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                                        <p className={`text-base font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{displayCurrency} {displayCurrentPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex justify-between items-end">
                                                            <div>
                                                                <p className="text-[11px] uppercase font-black text-slate-500 opacity-60 tracking-tighter">Patrimônio</p>
                                                                <p className={`text-2xl font-black ${profitVal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                    R$ {displayCurrentVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className={`text-[11px] font-black px-3 py-1.5 rounded-xl ${profitPct >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                                    {profitPct >= 0 ? '+' : ''}{profitPct.toFixed(2)}%
                                                                </p>
                                                                <p className={`text-xs font-bold mt-1 ${profitVal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                    {profitVal >= 0 ? '+' : ''}R$ {Math.abs(profitVal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                                <div className="grid grid-cols-3 gap-2">
                                    {Object.entries(ASSET_TYPES).map(([key, config]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setNewAsset({
                                                type: key,
                                                name: '',
                                                symbol: '',
                                                quantity: key === 'imoveis' || key === 'renda_fixa' ? '1' : '',
                                                purchasePrice: '',
                                                manualCurrentPrice: '',
                                                isUSD: false,
                                                yield: '',
                                                expiryDate: ''
                                            })}
                                            className={`p-3 rounded-2xl border flex flex-col items-center gap-1 transition-all ${
                                                newAsset.type === key
                                                ? (theme === 'light' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20')
                                                : (theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100' : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10')
                                            }`}
                                        >
                                            <config.icon className="w-5 h-5" />
                                            <span className="text-[8px] font-black uppercase tracking-widest">{config.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Common Name Field */}
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">
                                    {newAsset.type === 'imoveis' ? 'Nome do Imóvel' : (newAsset.type === 'renda_fixa' ? 'Nome do Título' : 'Nome do Ativo')}
                                </label>
                                {newAsset.type === 'renda_fixa' && newAsset.subType === 'Tesouro' && tesouroData.length > 0 ? (
                                    <select
                                        value={newAsset.name}
                                        onChange={(e) => {
                                            const selected = tesouroData.find(b => b.nm === e.target.value);
                                            if (selected) {
                                                const isIPCA = selected.nm.includes('IPCA') || selected.nm.includes('Renda+');
                                                setNewAsset({
                                                    ...newAsset,
                                                    name: selected.nm,
                                                    symbol: selected.nm,
                                                    yieldType: isIPCA ? 'ipca' : 'pre',
                                                    fixedRate: String(selected.anulRentPrcnt),
                                                    manualCurrentPrice: String(selected.untrPric)
                                                });
                                            }
                                        }}
                                        className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                            theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-slate-800 border-white/10 text-white focus:border-emerald-500'
                                        }`}
                                    >
                                        <option value="">Selecione um título...</option>
                                        {tesouroData.map(bond => (
                                            <option key={bond.nm} value={bond.nm}>{bond.nm}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input 
                                        type="text"
                                        required
                                        value={newAsset.name}
                                        onChange={(e) => setNewAsset({...newAsset, name: e.target.value})}
                                        className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                            theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                        }`}
                                        placeholder={newAsset.type === 'imoveis' ? 'Ex: Apartamento Centro' : (newAsset.type === 'renda_fixa' ? 'Ex: Tesouro Selic 2029' : 'Ex: Vale ON, Bitcoin...')}
                                    />
                                )}
                            </div>

                            {/* Dynamic Fields Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                {['acoes', 'etfs', 'fiis', 'crypto'].includes(newAsset.type) ? (
                                    <>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Símbolo/Ticker</label>
                                            <input 
                                                type="text"
                                                required={newAsset.type !== 'imoveis'}
                                                value={newAsset.symbol}
                                                onChange={(e) => setNewAsset({...newAsset, symbol: e.target.value.toUpperCase()})}
                                                className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                                }`}
                                                placeholder="Ex: NVDA, BTC, BBAS3"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Quantidade</label>
                                            <input 
                                                type="text"
                                                inputMode="decimal"
                                                required
                                                value={newAsset.quantity}
                                                onChange={(e) => setNewAsset({...newAsset, quantity: e.target.value})}
                                                className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                                }`}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </>
                                ) : newAsset.type === 'renda_fixa' ? (
                                    <>
                                        {/* 1. Subtype Selection FIRST */}
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">1. Qual o tipo de Renda Fixa?</label>
                                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                                {['CDB', 'Tesouro', 'LCI/LCA', 'Debêntures', 'Outros'].map(st => (
                                                    <button
                                                        key={st}
                                                        type="button"
                                                        onClick={() => setNewAsset({...newAsset, subType: st, name: '', yieldType: 'cdi', fixedRate: '', cdiPercent: ''})}
                                                        className={`p-3 rounded-2xl border text-[10px] font-black transition-all flex flex-col items-center gap-1 ${
                                                            newAsset.subType === st
                                                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg scale-[1.02]'
                                                            : (theme === 'light' ? 'bg-white border-slate-200 text-slate-500 hover:border-emerald-200' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10')
                                                        }`}
                                                    >
                                                        <span className="truncate w-full text-center">{st}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 2. Specific Selection for Tesouro OR Name for others */}
                                        <div className="col-span-2 space-y-4">
                                            {newAsset.subType === 'Tesouro' ? (
                                                <div className="p-5 rounded-[2rem] bg-blue-500/5 border border-blue-500/10 animate-in zoom-in-95 duration-300">
                                                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3 block">Selecione o Título Oficial</label>
                                                    <select
                                                        value={newAsset.name}
                                                        onChange={(e) => {
                                                            const selected = tesouroData.find(b => b.nm === e.target.value);
                                                            if (selected) {
                                                                const isIPCA = selected.nm.includes('IPCA') || selected.nm.includes('Renda+');
                                                                setNewAsset({
                                                                    ...newAsset,
                                                                    name: selected.nm,
                                                                    symbol: selected.nm,
                                                                    yieldType: isIPCA ? 'ipca' : (selected.nm.includes('Selic') ? 'cdi' : 'pre'),
                                                                    fixedRate: String(selected.anulRentPrcnt),
                                                                    cdiPercent: selected.nm.includes('Selic') ? '100' : '',
                                                                    manualCurrentPrice: String(selected.untrPric)
                                                                });
                                                            }
                                                        }}
                                                        className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                            theme === 'light' ? 'bg-white border-slate-200 text-slate-800 focus:border-blue-500' : 'bg-slate-900 border-white/10 text-white focus:border-blue-500'
                                                        }`}
                                                    >
                                                        <option value="">{tesouroData.length > 0 ? '--- Lista de Títulos Disponíveis ---' : 'Carregando títulos...'}</option>
                                                        {tesouroData.map(bond => (
                                                            <option key={bond.nm} value={bond.nm}>{bond.nm}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ) : (
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Nome do Título</label>
                                                    <input 
                                                        type="text"
                                                        required
                                                        value={newAsset.name}
                                                        onChange={(e) => setNewAsset({...newAsset, name: e.target.value})}
                                                        className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                            theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                                        }`}
                                                        placeholder="Ex: CDB Banco X, LCI 90 dias..."
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* 3. Yield Configuration */}
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Tipo de Rendimento</label>
                                            <div className="flex gap-2">
                                                {[
                                                    { id: 'cdi', label: 'Pós (CDI)' },
                                                    { id: 'ipca', label: 'Híbrido (IPCA+)' },
                                                    { id: 'pre', label: 'Pré-fixado' }
                                                ].map(yt => (
                                                    <button
                                                        key={yt.id}
                                                        type="button"
                                                        onClick={() => setNewAsset({...newAsset, yieldType: yt.id})}
                                                        className={`flex-1 p-3 rounded-2xl border text-[10px] font-black transition-all ${
                                                            newAsset.yieldType === yt.id
                                                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-md'
                                                            : (theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-500' : 'bg-white/5 border-white/5 text-slate-400')
                                                        }`}
                                                    >
                                                        {yt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {newAsset.yieldType === 'cdi' && (
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">% do CDI</label>
                                                <div className="relative">
                                                    <input 
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={newAsset.cdiPercent}
                                                        onChange={(e) => setNewAsset({...newAsset, cdiPercent: e.target.value})}
                                                        className={`w-full p-4 pr-10 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                            theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                                        }`}
                                                        placeholder="Ex: 100"
                                                    />
                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">%</span>
                                                </div>
                                            </div>
                                        )}

                                        {newAsset.yieldType === 'ipca' && (
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">IPCA + % ao ano</label>
                                                <div className="relative">
                                                    <input 
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={newAsset.fixedRate}
                                                        onChange={(e) => setNewAsset({...newAsset, fixedRate: e.target.value})}
                                                        className={`w-full p-4 pr-10 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                            theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                                        }`}
                                                        placeholder="Ex: 6.5"
                                                    />
                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">%</span>
                                                </div>
                                            </div>
                                        )}

                                        {newAsset.yieldType === 'pre' && (
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">% Fixa ao Ano</label>
                                                <div className="relative">
                                                    <input 
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={newAsset.fixedRate}
                                                        onChange={(e) => setNewAsset({...newAsset, fixedRate: e.target.value})}
                                                        className={`w-full p-4 pr-10 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                            theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                                        }`}
                                                        placeholder="Ex: 12.5"
                                                    />
                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">%</span>
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Vencimento</label>
                                            <input 
                                                type="text"
                                                value={newAsset.expiryDate}
                                                onChange={(e) => setNewAsset({...newAsset, expiryDate: e.target.value})}
                                                className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                                }`}
                                                placeholder="Ex: 2029"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Localização / Detalhes</label>
                                            <input 
                                                type="text"
                                                value={newAsset.symbol}
                                                onChange={(e) => setNewAsset({...newAsset, symbol: e.target.value})}
                                                className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                    theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                                }`}
                                                placeholder="Ex: Centro, Ed. Solar, 2 quartos..."
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">
                                        {newAsset.type === 'renda_fixa' ? 'Valor Total Aplicado (R$)' : (newAsset.type === 'imoveis' ? 'Valor de Compra' : `Preço Médio (${newAsset.isUSD ? 'USD' : 'R$'})`)}
                                    </label>
                                    <div className="relative">
                                        <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black opacity-50 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>R$</span>
                                        <input 
                                            type="text"
                                            inputMode="decimal"
                                            required
                                            value={newAsset.type === 'renda_fixa' ? (newAsset.totalApplied || '') : newAsset.purchasePrice}
                                            onChange={(e) => setNewAsset(newAsset.type === 'renda_fixa' ? {...newAsset, totalApplied: e.target.value, purchasePrice: e.target.value, quantity: '1'} : {...newAsset, purchasePrice: e.target.value})}
                                            className={`w-full p-4 pl-12 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                            }`}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    {newAsset.type === 'renda_fixa' && <p className="text-[9px] text-slate-400 mt-1.5 font-medium">Quanto você investiu no total</p>}
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">
                                        {newAsset.type === 'renda_fixa' ? 'Valor Atual Total (R$)' : (newAsset.type === 'imoveis' ? 'Valor Atual' : `Preço Atual (${newAsset.isUSD ? 'USD' : 'R$'})`)}
                                    </label>
                                    <div className="relative">
                                        <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black opacity-50 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>R$</span>
                                        <input 
                                            type="text"
                                            inputMode="decimal"
                                            value={newAsset.manualCurrentPrice || ''}
                                            onChange={(e) => setNewAsset({...newAsset, manualCurrentPrice: e.target.value})}
                                            className={`w-full p-4 pl-12 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                            }`}
                                            placeholder={newAsset.type === 'renda_fixa' ? 'Consultar na corretora' : 'Opcional'}
                                        />
                                    </div>
                                    {newAsset.type === 'renda_fixa' && <p className="text-[9px] text-slate-400 mt-1.5 font-medium">Saldo atual na corretora</p>}
                                </div>
                            </div>

                            {['acoes', 'etfs', 'fiis', 'crypto'].includes(newAsset.type) && (
                                <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 animate-in slide-in-from-top-2">
                                    <p className="text-[9px] font-bold text-emerald-600/70 italic">
                                        * Se o "Preço Atual" ficar vazio, a Alívia tentará buscar o valor de mercado automaticamente via ticker.
                                    </p>
                                </div>
                            )}

                            {['acoes', 'etfs', 'fiis', 'crypto'].includes(newAsset.type) && (
                                <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-500/5 border border-slate-500/10">
                                    <input 
                                        type="checkbox"
                                        id="isUSD-add"
                                        checked={newAsset.isUSD}
                                        onChange={(e) => setNewAsset({...newAsset, isUSD: e.target.checked})}
                                        className="w-5 h-5 rounded-lg border-slate-300 text-emerald-500 focus:ring-emerald-500/40 cursor-pointer"
                                    />
                                    <label htmlFor="isUSD-add" className={`text-xs font-bold cursor-pointer ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                                        Ativo dolarizado (Preço em USD)
                                    </label>
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
                                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Custo Total ({newAsset.isUSD ? 'USD' : 'R$'})</p>
                                            <div className="relative">
                                                <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black opacity-50 ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                                                    {newAsset.isUSD ? '$' : 'R$'}
                                                </span>
                                                <input 
                                                    type="text"
                                                    inputMode="decimal"
                                                    required
                                                    value={newAsset.aporteAmount}
                                                    onChange={(e) => setNewAsset({...newAsset, aporteAmount: e.target.value})}
                                                    className={`w-full p-4 pl-12 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                        theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500' : 'bg-white/5 border-white/10 text-white focus:border-blue-500'
                                                    }`}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 mt-4 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                                        <input 
                                            type="checkbox"
                                            id="isUSD-aporte"
                                            checked={newAsset.isUSD}
                                            onChange={(e) => setNewAsset({...newAsset, isUSD: e.target.checked})}
                                            className="w-5 h-5 rounded-lg border-slate-300 text-blue-500 focus:ring-blue-500/40 cursor-pointer"
                                        />
                                        <label htmlFor="isUSD-aporte" className={`text-xs font-bold cursor-pointer ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                                            Este aporte foi feito em Dólar (USD)
                                        </label>
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
