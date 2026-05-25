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
    Check,
    ChevronDown,
    ChevronUp,
    ArrowRight
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Tooltip as ReTooltip } from 'recharts';
import { BarChart3, Layers, List, Sparkles } from 'lucide-react';
import aliviaFinal from '../assets/alivia/alivia-final.png';

export default function InvestmentsTab() {
    const { theme } = useTheme();
    const { currentUser } = useAuth();
    const [investments, setInvestments] = useState([]);
    const [reserves, setReserves] = useState([]);
    const [cdiRate, setCdiRate] = useState(10.65);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, type, title }
    const [isAdding, setIsAdding] = useState(false);
    const [isEditing, setIsEditing] = useState(null);
    const [isAporting, setIsAporting] = useState(null);
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);
    const [prices, setPrices] = useState({ USD: 5.0, CDI: 0.10 });
    const [tesouroData, setTesouroData] = useState([]);
    const [filter, setFilter] = useState('renda_fixa');
    const [viewInUSD, setViewInUSD] = useState(false);
    const [chartViewMode, setChartViewMode] = useState('category');
    const [expandedCategories, setExpandedCategories] = useState({});
    const [hoveredSlice, setHoveredSlice] = useState(null);
    const [selectedCategoryModal, setSelectedCategoryModal] = useState(null);
    
    const [newAsset, setNewAsset] = useState({
        type: 'renda_fixa',
        name: '',
        symbol: '',
        quantity: '',
        purchasePrice: '',
        manualCurrentPrice: '',
        isUSD: false,
        cdiPercent: '',
        purchaseRate: '',
        fixedRate: '',
        yieldType: 'cdi',
        subType: '',
        aporteAmount: '',
        aporteQuantity: '',
        purchaseDate: new Date().toISOString().split('T')[0]
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

        const qReserves = query(collection(db, 'savings_jars'), where('userId', '==', currentUser.uid));
        const unsubReserves = onSnapshot(qReserves, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setReserves(items);
        });

        fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json')
            .then(res => res.json())
            .then(data => {
                if (data && data[0] && data[0].valor) setCdiRate(parseFloat(data[0].valor) * 365);
            })
            .catch(err => console.warn("Erro ao buscar CDI:", err));

        return () => { unsubscribe(); unsubReserves(); };
    }, [currentUser]);

    const fetchLivePrices = async () => {
        setIsLoadingPrices(true);
        try {
            const newPrices = { ...prices };
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

            // Fetch Crypto from Binance (no CORS issues anywhere)
            const cryptoTickers = [...new Set(investments.filter(a => a.type === 'crypto' && a.symbol).map(a => a.symbol.toUpperCase()))];
            if (cryptoTickers.length > 0) {
                try {
                    const binanceRes = await fetch('https://api.binance.com/api/v3/ticker/price');
                    const binanceData = await binanceRes.json();
                    cryptoTickers.forEach(ticker => {
                        const usdtPair = binanceData.find(p => p.symbol === `${ticker}USDT`);
                        const brlPair  = binanceData.find(p => p.symbol === `${ticker}BRL`);
                        if (usdtPair) newPrices[`${ticker}_USD`] = parseFloat(usdtPair.price);
                        if (brlPair)  newPrices[`${ticker}_BRL`] = parseFloat(brlPair.price);
                    });
                } catch (e) { console.warn('Binance fetch failed', e); }
            }

            // Fetch Stocks, ETFs, FIIs
            const stockTickers = [...new Set(investments.filter(a => ['acoes', 'etfs', 'fiis'].includes(a.type) && a.symbol).map(a => a.symbol.toUpperCase()))];
            const stockTypes   = stockTickers.map(t => {
                const asset = investments.find(a => a.symbol?.toUpperCase() === t);
                return asset?.type || 'acoes';
            });

            if (stockTickers.length > 0) {
                // In production: use Vercel serverless function (no CORS)
                if (!isLocalhost) {
                    try {
                        const apiUrl = `/api/prices?tickers=${stockTickers.join(',')}&types=${stockTypes.join(',')}`;
                        const res = await fetch(apiUrl);
                        if (res.ok) {
                            const data = await res.json();
                            Object.assign(newPrices, data.prices);
                            console.log('[Prices] Loaded via /api/prices:', Object.keys(data.prices));
                        } else {
                            console.warn('[Prices] /api/prices returned', res.status);
                        }
                    } catch (e) {
                        console.warn('[Prices] Serverless fetch failed', e);
                    }
                } else {
                    // On localhost: direct calls (CORS not an issue in dev)
                    await Promise.all(stockTickers.map(async (ticker) => {
                        // 1. Try Brapi
                        try {
                            const brapiRes = await fetch(`https://brapi.dev/api/quote/${ticker}`);
                            if (brapiRes.ok) {
                                const brapiData = await brapiRes.json();
                                const price = brapiData?.results?.[0]?.regularMarketPrice;
                                if (price) { newPrices[ticker] = parseFloat(price); return; }
                            }
                        } catch (e) {}

                        // 2. Yahoo via proxy
                        try {
                            const isProbablyBR = /\d/.test(ticker) || (ticker.length >= 5 && !ticker.includes('.'));
                            const yahooTicker = isProbablyBR ? `${ticker}.SA` : ticker;
                            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}`;
                            const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
                            if (res.ok) {
                                const data = await res.json();
                                const meta  = data?.chart?.result?.[0]?.meta;
                                const price = meta?.regularMarketPrice || meta?.previousClose;
                                if (price) { newPrices[ticker] = parseFloat(price); return; }
                            }
                        } catch (e) {}
                    }));
                }
            }

            // Fetch USD/BRL
            try {
                const usdRes = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
                const usdData = await usdRes.json();
                newPrices.USD = parseFloat(usdData.USDBRL.bid);
            } catch (e) {
                if (!newPrices.USD) newPrices.USD = 5.0;
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

    const fetchTesouro = async () => {
        // Strategy 1: Use our Vercel serverless function (production)
        {
            try {
                const res = await fetch('/api/tesouro', { signal: AbortSignal.timeout(10000) });
                if (res.ok) {
                    const data = await res.json();
                    if (data.bonds && data.bonds.length > 0) {
                        console.log(`[Tesouro] Loaded ${data.bonds.length} bonds via /api/tesouro (${data.source})`);
                        setTesouroData(data.bonds);
                        return;
                    }
                }
            } catch (e) {
                console.warn('[Tesouro] /api/tesouro failed:', e.message);
            }
        }

        // Strategy 2: Client-side proxies (localhost fallback)
        const tesouroUrl = 'https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/service/api/treasurybondpriceandsavings.json';
        const proxies = [
            `https://api.allorigins.win/get?url=${encodeURIComponent(tesouroUrl)}`,
            `https://corsproxy.io/?${encodeURIComponent(tesouroUrl)}`,
        ];

        for (const proxyUrl of proxies) {
            try {
                const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
                if (!res.ok) continue;
                const json = await res.json();
                const raw = json.contents ?? json;
                const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (data?.response?.TrsrBondPricLogList) {
                    const list = data.response.TrsrBondPricLogList.map(item => item.TrsrBond);
                    if (list.length > 0) {
                        console.log(`[Tesouro] Loaded ${list.length} bonds via proxy`);
                        setTesouroData(list);
                        return;
                    }
                }
            } catch (e) {
                console.warn(`[Tesouro] Proxy failed: ${proxyUrl}`, e.message);
            }
        }

        // Strategy 3: Fallback with official names
        console.warn('[Tesouro] All sources failed — using fallback data');
        setTesouroData(FALLBACK_TESOURO_BONDS);
    };

    // Fallback bonds with official names from tesourodireto.com.br
    const FALLBACK_TESOURO_BONDS = [
  {
    "nm": "Tesouro Selic 2029",
    "anulRentPrcnt": 0.05,
    "untrPric": 18892.85
  },
  {
    "nm": "Tesouro Selic 2028",
    "anulRentPrcnt": 0.02,
    "untrPric": 18910.93
  },
  {
    "nm": "Tesouro Selic 2027",
    "anulRentPrcnt": 0,
    "untrPric": 18916.44
  },
  {
    "nm": "Tesouro Selic 2031",
    "anulRentPrcnt": 0.08,
    "untrPric": 18842.4
  },
  {
    "nm": "Tesouro Prefixado 2031",
    "anulRentPrcnt": 13.78,
    "untrPric": 549.71
  },
  {
    "nm": "Tesouro Prefixado 2029",
    "anulRentPrcnt": 13.74,
    "untrPric": 711.22
  },
  {
    "nm": "Tesouro Prefixado 2032",
    "anulRentPrcnt": 13.84,
    "untrPric": 481.7
  },
  {
    "nm": "Tesouro Prefixado 2028",
    "anulRentPrcnt": 13.74,
    "untrPric": 807.29
  },
  {
    "nm": "Tesouro Prefixado 2027",
    "anulRentPrcnt": 13.88,
    "untrPric": 916.99
  },
  {
    "nm": "Tesouro IPCA+ com Juros Semestrais 2035",
    "anulRentPrcnt": 7.47,
    "untrPric": 4399.98
  },
  {
    "nm": "Tesouro IPCA+ com Juros Semestrais 2030",
    "anulRentPrcnt": 7.82,
    "untrPric": 4463.94
  },
  {
    "nm": "Tesouro IPCA+ com Juros Semestrais 2040",
    "anulRentPrcnt": 7.23,
    "untrPric": 4270.2
  },
  {
    "nm": "Tesouro IPCA+ com Juros Semestrais 2050",
    "anulRentPrcnt": 7.1,
    "untrPric": 4190.97
  },
  {
    "nm": "Tesouro IPCA+ com Juros Semestrais 2026",
    "anulRentPrcnt": 9.09,
    "untrPric": 4709.91
  },
  {
    "nm": "Tesouro IPCA+ com Juros Semestrais 2060",
    "anulRentPrcnt": 7.1,
    "untrPric": 4125.43
  },
  {
    "nm": "Tesouro IPCA+ com Juros Semestrais 2045",
    "anulRentPrcnt": 7.14,
    "untrPric": 4300.99
  },
  {
    "nm": "Tesouro IPCA+ com Juros Semestrais 2055",
    "anulRentPrcnt": 7.09,
    "untrPric": 4230.13
  },
  {
    "nm": "Tesouro IPCA+ com Juros Semestrais 2037",
    "anulRentPrcnt": 7.39,
    "untrPric": 4363.11
  },
  {
    "nm": "Tesouro IPCA+ com Juros Semestrais 2032",
    "anulRentPrcnt": 7.67,
    "untrPric": 4386.28
  },
  {
    "nm": "Tesouro IPCA+ 2029",
    "anulRentPrcnt": 7.81,
    "untrPric": 3742.99
  },
  {
    "nm": "Tesouro IPCA+ 2035",
    "anulRentPrcnt": 7.4,
    "untrPric": 2472.6
  },
  {
    "nm": "Tesouro IPCA+ 2026",
    "anulRentPrcnt": 9.09,
    "untrPric": 4574.67
  },
  {
    "nm": "Tesouro IPCA+ 2050",
    "anulRentPrcnt": 6.93,
    "untrPric": 931.15
  },
  {
    "nm": "Tesouro IPCA+ 2032",
    "anulRentPrcnt": 7.64,
    "untrPric": 2961.37
  },
  {
    "nm": "Tesouro IPCA+ 2040",
    "anulRentPrcnt": 7.09,
    "untrPric": 1773.01
  },
  {
    "nm": "Tesouro IPCA+ 2045",
    "anulRentPrcnt": 6.98,
    "untrPric": 1309.27
  },
  {
    "nm": "Tesouro IGPM+ com Juros Semestrais 2031",
    "anulRentPrcnt": 8,
    "untrPric": 7889.75
  },
  {
    "nm": "Tesouro Prefixado com Juros Semestrais 2035",
    "anulRentPrcnt": 13.89,
    "untrPric": 851
  },
  {
    "nm": "Tesouro Prefixado com Juros Semestrais 2031",
    "anulRentPrcnt": 13.87,
    "untrPric": 911.3
  },
  {
    "nm": "Tesouro Prefixado com Juros Semestrais 2029",
    "anulRentPrcnt": 13.75,
    "untrPric": 956.79
  },
  {
    "nm": "Tesouro Prefixado com Juros Semestrais 2033",
    "anulRentPrcnt": 13.91,
    "untrPric": 875.78
  },
  {
    "nm": "Tesouro Prefixado com Juros Semestrais 2027",
    "anulRentPrcnt": 13.95,
    "untrPric": 1009.14
  },
  {
    "nm": "Tesouro Prefixado com Juros Semestrais 2037",
    "anulRentPrcnt": 13.89,
    "untrPric": 830.91
  },
  {
    "nm": "Tesouro RendA+ 2035",
    "anulRentPrcnt": 7.05,
    "untrPric": 1429.94
  },
  {
    "nm": "Tesouro RendA+ 2060",
    "anulRentPrcnt": 6.97,
    "untrPric": 271.33
  },
  {
    "nm": "Tesouro RendA+ 2045",
    "anulRentPrcnt": 6.95,
    "untrPric": 744.67
  },
  {
    "nm": "Tesouro RendA+ 2050",
    "anulRentPrcnt": 6.95,
    "untrPric": 533.27
  },
  {
    "nm": "Tesouro RendA+ 2055",
    "anulRentPrcnt": 6.96,
    "untrPric": 380.57
  },
  {
    "nm": "Tesouro RendA+ 2030",
    "anulRentPrcnt": 7.2,
    "untrPric": 1974.41
  },
  {
    "nm": "Tesouro RendA+ 2040",
    "anulRentPrcnt": 6.97,
    "untrPric": 1035.59
  },
  {
    "nm": "Tesouro RendA+ 2065",
    "anulRentPrcnt": 6.97,
    "untrPric": 194.12
  },
  {
    "nm": "Tesouro Educa+ 2030",
    "anulRentPrcnt": 7.88,
    "untrPric": 3694.18
  },
  {
    "nm": "Tesouro Educa+ 2033",
    "anulRentPrcnt": 7.7,
    "untrPric": 3226.16
  },
  {
    "nm": "Tesouro Educa+ 2047",
    "anulRentPrcnt": 6.98,
    "untrPric": 1303.99
  },
  {
    "nm": "Tesouro Educa+ 2037",
    "anulRentPrcnt": 7.42,
    "untrPric": 2457.91
  },
  {
    "nm": "Tesouro Educa+ 2040",
    "anulRentPrcnt": 7.22,
    "untrPric": 2030.78
  },
  {
    "nm": "Tesouro Educa+ 2036",
    "anulRentPrcnt": 7.49,
    "untrPric": 2625.46
  },
  {
    "nm": "Tesouro Educa+ 2039",
    "anulRentPrcnt": 7.28,
    "untrPric": 2163.33
  },
  {
    "nm": "Tesouro Educa+ 2041",
    "anulRentPrcnt": 7.16,
    "untrPric": 1908.41
  },
  {
    "nm": "Tesouro Educa+ 2042",
    "anulRentPrcnt": 7.11,
    "untrPric": 1793.11
  },
  {
    "nm": "Tesouro Educa+ 2045",
    "anulRentPrcnt": 7.02,
    "untrPric": 1481.53
  },
  {
    "nm": "Tesouro Educa+ 2048",
    "anulRentPrcnt": 6.97,
    "untrPric": 1221.83
  },
  {
    "nm": "Tesouro Educa+ 2032",
    "anulRentPrcnt": 7.76,
    "untrPric": 3465.32
  },
  {
    "nm": "Tesouro Educa+ 2038",
    "anulRentPrcnt": 7.34,
    "untrPric": 2306.58
  },
  {
    "nm": "Tesouro Educa+ 2031",
    "anulRentPrcnt": 7.82,
    "untrPric": 3726.42
  },
  {
    "nm": "Tesouro Educa+ 2043",
    "anulRentPrcnt": 7.07,
    "untrPric": 1683.86
  },
  {
    "nm": "Tesouro Educa+ 2034",
    "anulRentPrcnt": 7.64,
    "untrPric": 3006.28
  },
  {
    "nm": "Tesouro Educa+ 2044",
    "anulRentPrcnt": 7.04,
    "untrPric": 1580.2
  },
  {
    "nm": "Tesouro Educa+ 2046",
    "anulRentPrcnt": 7,
    "untrPric": 1389.61
  },
  {
    "nm": "Tesouro Educa+ 2035",
    "anulRentPrcnt": 7.56,
    "untrPric": 2808.27
  }
];

    useEffect(() => {
        fetchTesouro();
    }, []);

    useEffect(() => {
        fetchLivePrices();
        fetchTesouro(); // Also refresh Tesouro data
        // Update every 2 minutes
        const interval = setInterval(() => {
            fetchLivePrices();
            fetchTesouro(); // Keep Tesouro prices fresh
        }, 60000 * 2); 
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
                purchaseDate: newAsset.purchaseDate || new Date().toISOString().split('T')[0],
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
            setNewAsset({ type: 'renda_fixa', name: '', symbol: '', quantity: '', purchasePrice: '', manualCurrentPrice: '', isUSD: false, cdiPercent: '', aporteAmount: '', aporteQuantity: '', purchaseDate: new Date().toISOString().split('T')[0] });
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
            setNewAsset({ type: 'renda_fixa', name: '', symbol: '', quantity: '', purchasePrice: '', manualCurrentPrice: '', isUSD: false, cdiPercent: '', aporteAmount: '', aporteQuantity: '', purchaseDate: new Date().toISOString().split('T')[0] });
        } catch (error) {
            console.error("Error processing aporte:", error);
        }
    };

    const handleDeleteAsset = async (id) => {
        await deleteDoc(doc(db, 'investments', id));
        setDeleteConfirm(null);
    };

    // Helper: get live Tesouro rate for a bond name
    const getLiveTesouroRate = (bondName) => {
        if (!bondName || tesouroData.length === 0) return null;
        const normalizedName = bondName.trim().toLowerCase();
        const match = tesouroData.find(b => b.nm && b.nm.trim().toLowerCase() === normalizedName);
        if (match) return { rate: parseFloat(match.anulRentPrcnt), unitPrice: parseFloat(match.untrPric) };
        // Fuzzy match: try finding by partial name match
        const fuzzy = tesouroData.find(b => b.nm && (
            normalizedName.includes(b.nm.trim().toLowerCase()) || 
            b.nm.trim().toLowerCase().includes(normalizedName)
        ));
        if (fuzzy) return { rate: parseFloat(fuzzy.anulRentPrcnt), unitPrice: parseFloat(fuzzy.untrPric) };
        return null;
    };

    const getGroup = (type) => {
        if (type === 'renda_fixa') return 'renda_fixa';
        if (type === 'acoes' || type === 'etfs') return 'acoes_etfs';
        if (type === 'crypto') return 'crypto';
        if (type === 'fiis' || type === 'imoveis') return 'fundos_imoveis';
        return 'renda_fixa';
    };

    const GROUP_LABELS = {
        renda_fixa: 'Renda Fixa',
        acoes_etfs: 'Ações/ETF\'s',
        crypto: 'Criptoativos',
        fundos_imoveis: 'Fundos/Imóveis'
    };

    const GROUP_COLORS = {
        renda_fixa: '#6366f1',
        acoes_etfs: '#f59e0b',
        crypto: '#10b981',
        fundos_imoveis: '#3b82f6'
    };
    
    const GROUP_ICONS = {
        renda_fixa: <PieChart className="w-5 h-5 text-[#6366f1]" />,
        acoes_etfs: <Activity className="w-5 h-5 text-[#f59e0b]" />,
        crypto: <Bitcoin className="w-5 h-5 text-[#10b981]" />,
        fundos_imoveis: <Landmark className="w-5 h-5 text-[#3b82f6]" />
    };

    const items = investments.map(inv => {
        const isFixedIncome = inv.type === 'renda_fixa';
        const usdMultiplier = inv.isUSD ? (prices.USD || 5.0) : 1;
        
        let currentPrice = inv.manualCurrentPrice || inv.purchasePrice;
        if (!isFixedIncome) {
            if (inv.type === 'crypto' && inv.symbol) {
                const sym = inv.symbol.toUpperCase();
                if (inv.isUSD && prices[`${sym}_USD`]) currentPrice = prices[`${sym}_USD`];
                else if (!inv.isUSD && prices[`${sym}_BRL`]) currentPrice = prices[`${sym}_BRL`];
                else if (!inv.isUSD && prices[`${sym}_USD`] && prices.USD) currentPrice = prices[`${sym}_USD`] * prices.USD;
            } else if (['acoes', 'etfs', 'fiis'].includes(inv.type) && inv.symbol) {
                const sym = inv.symbol.toUpperCase();
                if (prices[sym]) currentPrice = prices[sym];
            }
        }
        
        const trueInvested = isFixedIncome ? (inv.totalApplied || inv.quantity * inv.purchasePrice) : (inv.quantity * inv.purchasePrice * usdMultiplier);
        let trueCurrent = isFixedIncome ? (inv.manualCurrentPrice || trueInvested) : (inv.quantity * currentPrice * usdMultiplier);
        
        if (isFixedIncome) {
            const liveData = getLiveTesouroRate(inv.name);
            const pRate = parseFloat(inv.purchaseRate || inv.fixedRate || 0);
            let cRate = liveData ? liveData.rate : parseFloat(inv.currentMarketRate || inv.fixedRate || 0);
            if (pRate > 0 && cRate > 0 && pRate !== cRate && !inv.manualCurrentPrice) {
                trueCurrent = trueInvested * (pRate / cRate);
            }
        }
        
        return { 
            ...inv,
            category: getGroup(inv.type), 
            value: trueCurrent,
            invested: trueInvested,
            currentPrice
        };
    }).filter(i => i.value > 0);

    const totalInvestments = items.reduce((a, i) => a + i.value, 0);
    const totalInvested = items.reduce((a, i) => a + i.invested, 0);
    const totalProfitabilityPct = totalInvested > 0 ? ((totalInvestments - totalInvested) / totalInvested) * 100 : 0;
    
    const totalReserve = reserves.reduce((acc, curr) => {
        const cdiAnual = cdiRate / 100;
        const percent = (curr.cdiPercent || 100) / 100;
        const dailyRate = Math.pow(1 + (cdiAnual * percent), 1 / 365) - 1;
        const lastUpdate = curr.updatedAt ? new Date(curr.updatedAt) : (curr.createdAt ? new Date(curr.createdAt) : new Date());
        const diffDays = Math.max(0, (new Date() - lastUpdate) / (1000 * 60 * 60 * 24));
        return acc + (curr.balance || 0) * Math.pow(1 + dailyRate, diffDays);
    }, 0);

    const totalPatrimonio = totalInvestments + totalReserve;

    const catMap = { renda_fixa: 0, acoes_etfs: 0, crypto: 0, fundos_imoveis: 0 };
    items.forEach(it => { catMap[it.category] += it.value; });
    const chartItems = Object.entries(catMap).map(([name, value]) => ({ name, value, color: GROUP_COLORS[name] })).filter(i => i.value > 0);

    const handlePieEnter = (_, index) => setHoveredSlice(index);
    const handlePieLeave = () => setHoveredSlice(null);
    
    const filteredItemsForList = items.filter(it => it.category === filter && (searchQuery === '' || (it.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (it.symbol || '').toLowerCase().includes(searchQuery.toLowerCase())));

    const displayMultiplier = viewInUSD ? (1 / (prices.USD || 5.0)) : 1;


    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className={`text-2xl md:text-3xl font-black tracking-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Investimentos{currentUser?.displayName ? ` - ${currentUser.displayName.split(' ')[0]}` : ''}</h2>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">Visão Geral e Ativos Detalhados</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-500">Atualizado recentemente</span>
                </div>
            </div>

            {/* Top Pill Dashboard */}
            <div className={`flex flex-wrap items-center justify-between gap-6 p-5 rounded-2xl border ${theme === 'light' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-[#151822] border-white/5 text-white'}`}>
                {/* Metrics */}
                <div className="flex flex-wrap items-center gap-6 md:gap-10">
                    <div className="flex flex-col">
                        <span className="text-[11px] font-medium text-slate-400 mb-1">Total de investimentos:</span>
                        <span className="text-xl font-black">
                            {viewInUSD ? '$' : 'R$'} {(totalInvestments * displayMultiplier).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[11px] font-medium text-slate-400 mb-1">Rentabilidade (%):</span>
                        <span className={`text-xl font-black flex items-center gap-1 ${totalProfitabilityPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {totalProfitabilityPct >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                            {totalProfitabilityPct >= 0 ? '+' : ''}{totalProfitabilityPct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[11px] font-medium text-slate-400 mb-1">Lucro / Perda:</span>
                        <span className={`text-xl font-black flex items-center gap-1 ${totalInvestments - totalInvested >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {totalInvestments - totalInvested >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                            {totalInvestments - totalInvested >= 0 ? '+' : '-'} {viewInUSD ? '$' : 'R$'} {Math.abs((totalInvestments - totalInvested) * displayMultiplier).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>

                {/* Analysis and Action Buttons */}
                <div className="flex flex-wrap items-center gap-4 md:ml-auto">
                    {/* Análise da Alívia */}
                    {investments.length > 0 && (
                        <div className="flex items-center gap-3 max-w-xs md:max-w-sm p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm transition-all hover:bg-white/10">
                            <div className="relative shrink-0">
                                <img src={aliviaFinal} alt="Alívia" className="w-8 h-8 object-cover rounded-full border border-indigo-500/30" />
                                <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-[#131621] text-indigo-400"><Sparkles className="w-2.5 h-2.5" /></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Análise da Alívia</span>
                                <p className="text-[10px] font-medium leading-snug text-slate-300">
                                    {
                                        (catMap['acoes_etfs'] > 0) 
                                        ? 'Sua carteira está exposta a ações/ETFs, buscando crescimento em inovação e tecnologia a longo prazo.' 
                                        : catMap['crypto'] > 0 
                                        ? 'Sua alocação em cripto indica foco em disrupção e tecnologia de alto risco.' 
                                        : 'A carteira tem um perfil sólido focado em rentabilidade previsível e preservação.'
                                    }
                                </p>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-3">
                         <button 
                            onClick={() => setViewInUSD(!viewInUSD)}
                            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
                                viewInUSD ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 hover:bg-white/20 text-slate-300'
                            }`}
                        >
                            Moeda ({viewInUSD ? '$' : 'R$'})
                        </button>
                        <button  
                            onClick={() => {
                                setIsEditing(null);
                                setNewAsset({ type: 'crypto', name: 'Bitcoin', symbol: 'BTC', quantity: '', purchasePrice: '', manualCurrentPrice: '', isUSD: false });
                                setIsAdding(true);
                            }}
                            className="px-4 py-2 bg-[#20B2AA] hover:bg-[#1C9C95] text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-[#20B2AA]/20 flex items-center gap-2 transition-all active:scale-95"
                        >
                            <Plus className="w-3.5 h-3.5" /> Adicionar
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Cards Dashboard */}
            <div className={`p-6 rounded-2xl border ${theme === 'light' ? 'bg-slate-900 border-slate-800' : 'bg-[#151822] border-white/5'}`}>
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={fetchLivePrices} className="text-slate-400 hover:text-white transition-colors" title="Atualizar Preços">
                        <RefreshCw className={`w-4 h-4 ${isLoadingPrices ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                
                <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
                    {/* Left: Chart and Legend */}
                    <div className="flex items-center gap-8 w-full md:w-1/2">
                        <div className="relative w-[200px] h-[200px] flex-shrink-0">
                            {totalInvestments > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsPieChart>
                                        <Pie 
                                            data={chartItems} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={2} dataKey="value" stroke="none" 
                                            onMouseEnter={handlePieEnter} onMouseLeave={handlePieLeave} activeIndex={hoveredSlice}
                                        >
                                            {chartItems.map((entry, idx) => (
                                                <Cell key={idx} fill={entry.color} className="outline-none cursor-pointer" style={{ opacity: hoveredSlice !== null && hoveredSlice !== idx ? 0.4 : 1, transition: 'opacity 0.3s ease' }} />
                                            ))}
                                        </Pie>
                                    </RechartsPieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="w-full h-full rounded-full border-4 border-slate-800 flex items-center justify-center">
                                    <p className="text-[10px] font-bold text-slate-600">Sem dados</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            {chartItems.map((item, idx) => {
                                const pct = totalInvestments > 0 ? (item.value / totalInvestments) * 100 : 0;
                                return (
                                    <div key={idx} className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-bold text-slate-300" style={{ color: item.color }}>{pct.toFixed(2)}%</span>
                                            <span className="text-[10px] text-slate-400">{GROUP_LABELS[item.name]}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: 4 Cards Grid */}
                    <div className="grid grid-cols-2 gap-4 w-full md:w-1/2">
                        {Object.keys(GROUP_LABELS).map((groupKey) => {
                            const groupValue = catMap[groupKey] || 0;
                            return (
                                <div key={groupKey} className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-medium text-slate-300">{GROUP_LABELS[groupKey]}</span>
                                        {GROUP_ICONS[groupKey]}
                                    </div>
                                    <span className="text-lg font-black text-white">
                                        {viewInUSD ? '$' : 'R$'} {(groupValue * displayMultiplier).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>

            {/* Bottom Tabs & Content */}
            <div className="pt-4">
                <div className={`flex border-b overflow-x-auto scrollbar-hide ${theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
                    {Object.keys(GROUP_LABELS).map((groupKey) => (
                        <button
                            key={groupKey}
                            onClick={() => setFilter(groupKey)}
                            className={`whitespace-nowrap px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
                                filter === groupKey
                                ? (theme === 'light' ? 'border-indigo-500 text-indigo-600' : 'border-indigo-400 text-indigo-400')
                                : (theme === 'light' ? 'border-transparent text-slate-400 hover:text-slate-600' : 'border-transparent text-slate-500 hover:text-slate-300')
                            }`}
                        >
                            {GROUP_LABELS[groupKey]}
                        </button>
                    ))}
                </div>

                <div className="mt-6 flex flex-col md:flex-row gap-6 items-start">
                    {/* Left: Search and List */}
                    <div className="flex-1 w-full space-y-4">
                        <div className="flex items-center gap-3">
                            <div className={`flex-1 flex items-center px-4 py-3 rounded-xl border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#151822] border-white/5'}`}>
                                <Search className="w-4 h-4 text-slate-500 mr-2" />
                                <input 
                                    type="text" 
                                    placeholder={`PESQUISAR ${GROUP_LABELS[filter].toUpperCase()} [NOME]`}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-transparent border-none outline-none w-full text-xs font-bold text-slate-800 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600"
                                />
                            </div>
                            <button className={`px-4 py-3 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all ${theme === 'light' ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-[#151822] border-white/5 text-slate-400 hover:bg-white/5'}`}>
                                FILTROS <span className="ml-1 opacity-50">≡</span>
                            </button>
                        </div>

                        {/* List */}
                        <div className="space-y-3">
                            {filteredItemsForList.length === 0 ? (
                                <div className="text-center py-10">
                                    <p className="text-slate-500 text-xs font-bold">Nenhum ativo encontrado nesta categoria.</p>
                                </div>
                            ) : (
                                filteredItemsForList.map(asset => {
                                    const dCur = viewInUSD ? '$' : 'R$';
                                    const pp = asset.invested > 0 ? ((asset.value - asset.invested) / asset.invested) * 100 : 0;
                                    const MC = ASSET_TYPES[asset.type] || ASSET_TYPES.crypto;
                                    
                                    return (
                                        <div key={asset.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${theme === 'light' ? 'bg-white border-slate-100' : 'bg-[#151822] border-white/5'}`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${MC.bg} overflow-hidden relative`}>
                                                    {asset.symbol || asset.name ? (
                                                        <>
                                                            <img
                                                                src={asset.type === 'crypto' ? `https://assets.coincap.io/assets/icons/${(asset.symbol || 'btc').toLowerCase()}@2x.png` : `https://financialmodelingprep.com/image-stock/${(asset.symbol || '').toUpperCase()}.png`}
                                                                className="w-full h-full object-contain bg-white p-1 z-10"
                                                                onError={(e) => { e.target.style.display = 'none'; if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'block'; }}
                                                            />
                                                            <MC.icon className={`w-4 h-4 ${MC.color} absolute z-0`} style={{ display: 'none' }} />
                                                        </>
                                                    ) : (
                                                        <MC.icon className={`w-4 h-4 ${MC.color}`} />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex flex-col">
                                                        <span className={`text-sm font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{asset.symbol ? asset.symbol.toUpperCase() : asset.name}</span>
                                                        {asset.symbol && asset.name && asset.symbol.toUpperCase() !== asset.name.toUpperCase() && (
                                                            <span className="text-[10px] text-slate-500 font-medium">{asset.name}</span>
                                                        )}
                                                    </div>
                                                    {/* Preço/Taxa ao lado do ticker */}
                                                    {asset.type !== 'imoveis' && (
                                                        <div className={`hidden md:flex flex-col pl-3 border-l ${theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
                                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                                                {asset.type === 'renda_fixa' ? 'Taxa' : 'Preço'}
                                                            </span>
                                                            {asset.type === 'renda_fixa' ? (
                                                                <span className="text-xs font-black text-emerald-500">
                                                                    {asset.yieldType === 'cdi'
                                                                        ? `${asset.cdiPercent || 100}% CDI`
                                                                        : asset.yieldType === 'ipca'
                                                                        ? `IPCA +${parseFloat(asset.purchaseRate || asset.fixedRate || 0).toFixed(2)}%`
                                                                        : asset.yieldType === 'pre'
                                                                        ? `${parseFloat(asset.purchaseRate || asset.fixedRate || 0).toFixed(2)}% a.a.`
                                                                        : '—'
                                                                    }
                                                                </span>
                                                            ) : isLoadingPrices ? (
                                                                <span className="text-slate-500 text-xs animate-pulse font-black">•••</span>
                                                            ) : (
                                                                <span className={`text-sm font-black ${theme === 'light' ? 'text-slate-700' : 'text-slate-100'}`}>
                                                                    {(() => {
                                                                        const priceInBRL = asset.isUSD
                                                                            ? asset.currentPrice * (prices.USD || 5.0)
                                                                            : asset.currentPrice;
                                                                        const dp = priceInBRL * displayMultiplier;
                                                                        return `${dCur} ${dp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: dp < 1 ? 6 : 2 })}`;
                                                                    })()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 md:gap-6 lg:gap-10">

                                                <div className="hidden md:flex flex-col items-end">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Valor Atual</span>
                                                    <span className={`text-sm font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                                        {dCur} {(asset.value * displayMultiplier).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                                    </span>
                                                </div>
                                                <div className="hidden md:flex flex-col items-end w-20">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rent.</span>
                                                    <span className={`inline-flex items-center gap-0.5 text-xs font-black ${pp >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {pp >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                        {pp >= 0 ? '+' : ''}{pp.toFixed(2)}%
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1.5 ml-2">
                                                    <button onClick={() => {setNewAsset({...asset,aporteQuantity:'',aporteAmount:''});setIsAporting(asset.id);}} className={`p-2 rounded-xl transition-all ${theme==='light'?'bg-blue-50 text-blue-500 hover:bg-blue-100':'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'}`} title="Aporte"><Plus className="w-4 h-4" /></button>
                                                    <button onClick={() => {setNewAsset({...asset});setIsEditing(asset.id);setIsAdding(true);}} className={`p-2 rounded-xl transition-all ${theme==='light'?'bg-slate-100 text-slate-500 hover:bg-slate-200':'bg-white/5 text-slate-400 hover:bg-white/10'}`} title="Editar"><Edit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => {setDeleteConfirm({id:asset.id,type:'asset',title:asset.name});}} className={`p-2 rounded-xl transition-all ${theme==='light'?'bg-rose-50 text-rose-400 hover:bg-rose-100':'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'}`} title="Excluir"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* Modal: Adicionar/Editar Ativo */}

            {/* Modal: Adicionar/Editar Ativo */}
            {isAdding && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className={`w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-hide rounded-[3rem] p-8 md:p-12 border relative animate-in zoom-in-95 duration-300 ${
                        theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
                    }`}>
                        <button 
                            onClick={() => { setIsAdding(false); setIsEditing(null); }}
                            className={`absolute top-6 right-6 p-2 rounded-xl transition-colors z-[10] ${
                                theme === 'light' ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/10 text-slate-500'
                            }`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-3 mb-6">
                            <button type="button" onClick={() => { setIsAdding(false); setIsEditing(null); }} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors">
                                <ArrowRight className="w-4 h-4 rotate-180" />
                            </button>
                            <h3 className={`text-xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                {isEditing ? 'Editar Ativo' : 'Novo Ativo'}
                            </h3>
                        </div>

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
                            {newAsset.type !== 'renda_fixa' && (
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">
                                        {newAsset.type === 'imoveis' ? 'Nome do Imóvel' : 'Nome do Ativo'}
                                    </label>
                                    <input 
                                        type="text"
                                        required
                                        value={newAsset.name}
                                        onChange={(e) => setNewAsset({...newAsset, name: e.target.value})}
                                        className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                            theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                        }`}
                                        placeholder={newAsset.type === 'imoveis' ? 'Ex: Apartamento Centro' : 'Ex: Vale ON, Bitcoin...'}
                                    />
                                </div>
                            )}

                            {/* Dynamic Fields Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                {['acoes', 'etfs', 'fiis', 'crypto'].includes(newAsset.type) ? (
                                    <>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Símbolo/Ticker</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text"
                                                    required={newAsset.type !== 'imoveis'}
                                                    value={newAsset.symbol}
                                                    onChange={(e) => setNewAsset({...newAsset, symbol: e.target.value.toUpperCase()})}
                                                    className={`flex-1 w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                        theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                                    }`}
                                                    placeholder="Ex: NVDA, BTC, BBAS3"
                                                />
                                                <label className={`flex items-center justify-center px-4 rounded-2xl border cursor-pointer transition-all ${newAsset.isUSD ? (theme === 'light' ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/30') : (theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5')}`} title="Ativo Dolarizado">
                                                    <input type="checkbox" checked={newAsset.isUSD} onChange={(e) => setNewAsset({...newAsset, isUSD: e.target.checked})} className="sr-only" />
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${newAsset.isUSD ? 'text-emerald-500' : 'text-slate-400'}`}>USD</span>
                                                </label>
                                            </div>
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
                                                                    fixedRate: String(selected.anulRentPrcnt), // current market rate from API
                                                                    currentMarketRate: String(selected.anulRentPrcnt),
                                                                    purchaseRate: '', // user fills this
                                                                    cdiPercent: selected.nm.includes('Selic') ? '100' : '',
                                                                    manualCurrentPrice: '',
                                                                    expiryDate: '' // already in title name
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
                                        
                                        {/* Tesouro: show current rate badge + ask purchase rate only */}
                                        {newAsset.subType === 'Tesouro' && newAsset.name && (
                                            <div className="col-span-2">
                                                {/* Current rate info badge */}
                                                {newAsset.fixedRate && (
                                                    <div className="mb-4 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
                                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Taxa atual de mercado</span>
                                                        <span className="text-sm font-black text-emerald-500">
                                                            {newAsset.yieldType === 'ipca' ? `IPCA+ ${newAsset.fixedRate}%` : newAsset.yieldType === 'pre' ? `${newAsset.fixedRate}% a.a.` : `${newAsset.fixedRate}% CDI`}
                                                        </span>
                                                    </div>
                                                )}
                                                {/* Purchase rate input */}
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">
                                                    {newAsset.yieldType === 'ipca' ? 'Taxa na sua compra (IPCA+ %)' : newAsset.yieldType === 'pre' ? 'Taxa na sua compra (% a.a.)' : 'Taxa na sua compra (% CDI)'}
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        required
                                                        value={newAsset.purchaseRate}
                                                        onChange={(e) => setNewAsset({...newAsset, purchaseRate: e.target.value})}
                                                        className={`w-full p-4 pr-10 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                                            theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                                        }`}
                                                        placeholder="Ex: 7.12"
                                                    />
                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">%</span>
                                                </div>
                                                <p className="text-[9px] text-slate-400 mt-1.5">Taxa que estava quando você comprou o título</p>
                                            </div>
                                        )}

                                        {/* Non-Tesouro yield config */}
                                        {newAsset.subType !== 'Tesouro' && (
                                            <>
                                                <div className="col-span-2">
                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Tipo de Rendimento</label>
                                                    <div className="flex gap-2">
                                                        {[{id:'cdi',label:'Pós (CDI)'},{id:'ipca',label:'Híbrido (IPCA+)'},{id:'pre',label:'Pré-fixado'}].map(yt => (
                                                            <button key={yt.id} type="button" onClick={() => setNewAsset({...newAsset, yieldType: yt.id})}
                                                                className={`flex-1 p-3 rounded-2xl border text-[10px] font-black transition-all ${
                                                                    newAsset.yieldType === yt.id ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' : (theme === 'light' ? 'bg-slate-50 border-slate-100 text-slate-500' : 'bg-white/5 border-white/5 text-slate-400')
                                                                }`}>{yt.label}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                                {newAsset.yieldType === 'cdi' && (
                                                    <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">% do CDI</label>
                                                        <div className="relative"><input type="text" inputMode="decimal" value={newAsset.cdiPercent} onChange={(e) => setNewAsset({...newAsset, cdiPercent: e.target.value})} className={`w-full p-4 pr-10 rounded-2xl border font-bold text-sm focus:outline-none ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white'}`} placeholder="Ex: 100" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">%</span></div>
                                                    </div>
                                                )}
                                                {newAsset.yieldType === 'ipca' && (
                                                    <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">IPCA + % ao ano</label>
                                                        <div className="relative"><input type="text" inputMode="decimal" value={newAsset.purchaseRate || newAsset.fixedRate} onChange={(e) => setNewAsset({...newAsset, purchaseRate: e.target.value, fixedRate: e.target.value})} className={`w-full p-4 pr-10 rounded-2xl border font-bold text-sm focus:outline-none ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white'}`} placeholder="Ex: 6.5" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">%</span></div>
                                                    </div>
                                                )}
                                                {newAsset.yieldType === 'pre' && (
                                                    <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">% Fixa ao Ano</label>
                                                        <div className="relative"><input type="text" inputMode="decimal" value={newAsset.purchaseRate || newAsset.fixedRate} onChange={(e) => setNewAsset({...newAsset, purchaseRate: e.target.value, fixedRate: e.target.value})} className={`w-full p-4 pr-10 rounded-2xl border font-bold text-sm focus:outline-none ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white'}`} placeholder="Ex: 12.5" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">%</span></div>
                                                    </div>
                                                )}
                                                <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Vencimento</label>
                                                    <input type="text" value={newAsset.expiryDate} onChange={(e) => setNewAsset({...newAsset, expiryDate: e.target.value})} className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white'}`} placeholder="Ex: 2029" />
                                                </div>
                                            </>
                                        )}
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

                            {/* Data de Compra */}
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Data da Compra</label>
                                <input 
                                    type="date"
                                    required
                                    value={newAsset.purchaseDate || ''}
                                    onChange={(e) => setNewAsset({...newAsset, purchaseDate: e.target.value})}
                                    className={`w-full p-4 rounded-2xl border font-bold text-sm focus:outline-none transition-all ${
                                        theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500' : 'bg-white/5 border-white/10 text-white focus:border-emerald-500'
                                    }`}
                                />
                                <p className={`text-[9px] mt-1.5 font-medium ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>Quando você comprou/aplicou este ativo</p>
                            </div>

                            {['acoes', 'etfs', 'fiis', 'crypto'].includes(newAsset.type) && (
                                <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 animate-in slide-in-from-top-2">
                                    <p className="text-[9px] font-bold text-emerald-600/70 italic">
                                        * Se o "Preço Atual" ficar vazio, a Alívia tentará buscar o valor de mercado automaticamente via ticker.
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


            {/* Modal: Excluir Ativo */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}>
                    <div className={`w-full max-w-sm rounded-[2rem] border animate-in zoom-in-95 duration-300 p-6 ${
                        theme === 'light' ? 'bg-white border-slate-100 shadow-2xl' : 'bg-slate-900 border-white/10 shadow-2xl'
                    }`}>
                        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                            <Trash2 className="w-8 h-8" />
                        </div>
                        <h3 className={`text-xl font-black text-center mb-2 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                            Excluir Ativo?
                        </h3>
                        <p className={`text-sm text-center font-medium leading-relaxed mb-8 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                            Tem certeza que deseja excluir o ativo <span className="font-bold text-rose-500">{deleteConfirm.title}</span>? Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setDeleteConfirm(null)}
                                className={`flex-1 py-4 rounded-xl font-bold text-sm transition-all ${
                                    theme === 'light' ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                }`}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={() => handleDeleteAsset(deleteConfirm.id)}
                                className="flex-1 py-4 bg-rose-500 hover:bg-rose-400 text-white rounded-xl font-black text-sm shadow-xl shadow-rose-500/20 transition-all active:scale-95"
                            >
                                Excluir
                            </button>
                        </div>
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
