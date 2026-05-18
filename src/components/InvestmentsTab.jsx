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
    const [viewInUSD, setViewInUSD] = useState(false);
    const [chartViewMode, setChartViewMode] = useState('category');
    const [expandedCategories, setExpandedCategories] = useState({});
    const [hoveredSlice, setHoveredSlice] = useState(null);
    
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
        return () => unsubscribe();
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

    const calculateStats = (filteredInvestments) => {
        let totalInvested = 0;
        let currentValue = 0;

        filteredInvestments.forEach(asset => {
            const usdMultiplier = asset.isUSD ? (prices.USD || 5.0) : 1;

            // Renda Fixa: use totalApplied vs calculated/manual current value
            if (asset.type === 'renda_fixa') {
                const applied = asset.totalApplied || (asset.quantity * asset.purchasePrice) || 0;
                let current = asset.manualCurrentPrice || applied;

                // Try to get live rate from Tesouro API for mark-to-market
                const liveData = getLiveTesouroRate(asset.name);
                const pRate = parseFloat(asset.purchaseRate || asset.fixedRate || 0);
                let cRate = liveData ? liveData.rate : parseFloat(asset.currentMarketRate || asset.fixedRate || 0);

                if (pRate > 0 && cRate > 0 && pRate !== cRate && !asset.manualCurrentPrice) {
                    current = applied * (pRate / cRate);
                }
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
    const displayMultiplier = viewInUSD ? (1 / (prices.USD || 5.0)) : 1;

    const groupedInvestments = activeInvestments.reduce((acc, asset) => {
        const type = asset.type || 'crypto';
        if (!acc[type]) acc[type] = [];
        acc[type].push(asset);
        return acc;
    }, {});

    const availableFilters = ['all', ...new Set(investments.map(a => a.type || 'crypto'))];

    // Chart logic
    const CATEGORY_COLORS = {
        'Renda Fixa': '#6366f1',
        'Ações': '#a855f7',
        'ETFs': '#3b82f6',
        'Fundos Imobiliários': '#14b8a6',
        'Criptomoedas': '#f59e0b',
        'Imóveis': '#f97316',
        'Outros': '#64748b',
    };
    const ASSET_COLORS = ['#10b981','#6366f1','#a855f7','#3b82f6','#14b8a6','#f59e0b','#f97316','#ec4899','#8b5cf6','#06b6d4','#84cc16','#ef4444','#22d3ee','#e879f9'];
    const CATEGORY_MAP = {
        renda_fixa: 'Renda Fixa',
        acoes: 'Ações',
        etfs: 'ETFs',
        fiis: 'Fundos Imobiliários',
        crypto: 'Criptomoedas',
        imoveis: 'Imóveis',
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
            name: inv.name || inv.symbol || 'Ativo', 
            category: CATEGORY_MAP[inv.type] || 'Outros', 
            value: trueCurrent 
        };
    }).filter(i => i.value > 0);

    const totalChartValue = items.reduce((a, i) => a + i.value, 0);

    let chartItems;
    if (chartViewMode === 'category') {
        const catMap = {};
        items.forEach(it => {
            if (!catMap[it.category]) catMap[it.category] = 0;
            catMap[it.category] += it.value;
        });
        chartItems = Object.entries(catMap).map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] || '#64748b' })).sort((a, b) => b.value - a.value);
    } else {
        chartItems = items.map((it, idx) => ({ name: it.name, value: it.value, color: ASSET_COLORS[idx % ASSET_COLORS.length] })).sort((a, b) => b.value - a.value);
    }

    const handlePieEnter = (_, index) => {
        setHoveredSlice(index);
    };
    const handlePieLeave = () => {
        setHoveredSlice(null);
    };

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className={`text-2xl md:text-3xl font-black tracking-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Investimentos{currentUser?.displayName ? ` - ${currentUser.displayName.split(' ')[0]}` : ''}</h2>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">Visão Geral e Ativos Detalhados</p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={fetchLivePrices}
                        className={`px-3 py-2 rounded-xl border transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
                            theme === 'light' ? 'bg-white border-slate-200 hover:bg-slate-50 text-slate-500' : 'bg-slate-800/80 border-white/10 hover:bg-white/10 text-slate-400'
                        }`}
                        title="Atualizar Preços"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPrices ? 'animate-spin' : ''}`} /> Atualizar
                    </button>
                    <button 
                        onClick={() => setViewInUSD(!viewInUSD)}
                        className={`px-3 py-2 rounded-xl border transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
                            viewInUSD 
                            ? (theme === 'light' ? 'bg-blue-100 border-blue-200 text-blue-600' : 'bg-blue-500/20 border-blue-500/30 text-blue-400') 
                            : (theme === 'light' ? 'bg-white border-slate-200 text-slate-500' : 'bg-slate-800/80 border-white/10 text-slate-400')
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
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95"
                    >
                        <Plus className="w-3.5 h-3.5" /> Adicionar Ativo
                    </button>
                </div>
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap gap-1.5">
                {availableFilters.map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                            filter === f
                            ? (theme === 'light' ? 'bg-slate-800 text-white' : 'bg-white text-slate-900')
                            : (theme === 'light' ? 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50' : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10')
                        }`}
                    >
                        {f === 'all' ? 'Tudo' : (ASSET_TYPES[f]?.label || f)}
                    </button>
                ))}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-5 rounded-2xl border ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900/80 border-white/[0.06]'}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                        <Wallet className="w-3 h-3" /> Patrimônio Total
                    </p>
                    <p className={`text-xl md:text-2xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                        {viewInUSD ? '$' : 'R$'} {(stats.currentValue * displayMultiplier).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black ${stats.profit >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                        {stats.profit >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                        {stats.profit >= 0 ? '+' : ''}{stats.profitPct.toFixed(1)}%
                    </div>
                </div>

                <div className={`p-5 rounded-2xl border ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900/80 border-white/[0.06]'}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                        <TrendingUp className="w-3 h-3" /> Desempenho Geral
                    </p>
                    <p className={`text-xl md:text-2xl font-black ${stats.profitPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {stats.profitPct >= 0 ? '+' : ''}{stats.profitPct.toFixed(1)}%
                    </p>
                    <p className="text-[9px] text-slate-500 font-medium mt-1">Desde o início</p>
                </div>

                <div className={`p-5 rounded-2xl border ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900/80 border-white/[0.06]'}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                        <LineChart className="w-3 h-3" /> Lucro Bruto
                    </p>
                    <p className={`text-xl md:text-2xl font-black ${stats.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {viewInUSD ? '$' : 'R$'} {(stats.profit * displayMultiplier).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    {stats.currentValue > 0 && (
                        <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-slate-500/10">
                            <div className={`h-full rounded-full transition-all duration-700 ${stats.profit >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(Math.abs(stats.profitPct), 100)}%` }} />
                        </div>
                    )}
                </div>
            </div>

            {/* Alocação de Patrimônio - Full Width Chart */}
            <div className={`rounded-2xl border overflow-hidden ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900/80 border-white/[0.06]'}`}>
                <div className="flex items-center justify-between p-5 pb-0">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${theme === 'light' ? 'bg-slate-50' : 'bg-white/5'}`}>
                            <BarChart3 className={`w-4 h-4 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`} />
                        </div>
                        <div>
                            <p className={`text-sm font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Alocação de Patrimônio</p>
                            <p className="text-[9px] text-slate-500 font-medium">Distribuição por {chartViewMode === 'category' ? 'categoria' : 'ativo'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`flex rounded-lg border overflow-hidden ${theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
                            <button onClick={() => setChartViewMode('category')} className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${chartViewMode === 'category' ? 'bg-emerald-500 text-white' : (theme === 'light' ? 'text-slate-500 bg-white hover:bg-slate-50' : 'text-slate-400 bg-slate-900 hover:bg-white/5')}`}>
                                <Layers className="w-3 h-3" /> Cat
                            </button>
                            <button onClick={() => setChartViewMode('asset')} className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all border-l ${theme === 'light' ? 'border-slate-200' : 'border-white/10'} ${chartViewMode === 'asset' ? 'bg-emerald-500 text-white' : (theme === 'light' ? 'text-slate-500 bg-white hover:bg-slate-50' : 'text-slate-400 bg-slate-900 hover:bg-white/5')}`}>
                                <List className="w-3 h-3" /> Ativos
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-5">
                    {totalChartValue <= 0 ? (
                        <div className="text-center py-10">
                            <p className="text-slate-500 text-xs font-bold">Nenhum valor para exibir no gráfico.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
                            {/* Donut Chart */}
                            <div className="md:col-span-2 relative mx-auto w-full max-w-[260px]">
                                <ResponsiveContainer width="100%" height={240}>
                                    <RechartsPieChart>
                                        <ReTooltip 
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const item = payload[0].payload;
                                                    const pct = totalChartValue > 0 ? (item.value / totalChartValue) * 100 : 0;
                                                    return (
                                                        <div className={`p-3 rounded-xl border shadow-xl ${theme === 'light' ? 'bg-white border-slate-100' : 'bg-slate-900 border-white/10'}`}>
                                                            <p className="text-[8px] font-black uppercase tracking-widest mb-0.5" style={{ color: item.color }}>{item.name}</p>
                                                            <p className={`text-sm font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                                                {viewInUSD ? '$' : 'R$'} {(item.value * displayMultiplier).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </p>
                                                            <p className="text-[9px] font-bold text-slate-500">{pct.toFixed(1)}%</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                            cursor={false}
                                        />
                                        <Pie data={chartItems} cx="50%" cy="50%" innerRadius={68} outerRadius={108} paddingAngle={2} dataKey="value" stroke="none" animationDuration={800} animationEasing="ease-out" onMouseEnter={handlePieEnter} onMouseLeave={handlePieLeave} activeIndex={hoveredSlice} activeShape={({ cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill }) => { const RADIAN = Math.PI / 180; const sin = Math.sin(-RADIAN * ((startAngle + endAngle) / 2)); const cos = Math.cos(-RADIAN * ((startAngle + endAngle) / 2)); return ( <g><path d={`M ${cx + (innerRadius) * cos} ${cy + (innerRadius) * sin} A ${innerRadius} ${innerRadius} 0 ${endAngle - startAngle > 180 ? 1 : 0} 0 ${cx + innerRadius * Math.cos(-RADIAN * startAngle)} ${cy + innerRadius * Math.sin(-RADIAN * startAngle)} L ${cx + (outerRadius + 6) * Math.cos(-RADIAN * startAngle)} ${cy + (outerRadius + 6) * Math.sin(-RADIAN * startAngle)} A ${outerRadius + 6} ${outerRadius + 6} 0 ${endAngle - startAngle > 180 ? 1 : 0} 1 ${cx + (outerRadius + 6) * cos} ${cy + (outerRadius + 6) * sin} Z`} fill={fill} opacity={0.95} /><path d={`M ${cx + innerRadius * Math.cos(-RADIAN * startAngle)} ${cy + innerRadius * Math.sin(-RADIAN * startAngle)} A ${innerRadius} ${innerRadius} 0 ${endAngle - startAngle > 180 ? 1 : 0} 1 ${cx + innerRadius * cos} ${cy + innerRadius * sin}`} fill="none" stroke={fill} strokeWidth={0} /></g> ); }}>
                                            {chartItems.map((entry, idx) => (<Cell key={idx} fill={entry.color} className="outline-none cursor-pointer" style={{ opacity: hoveredSlice !== null && hoveredSlice !== idx ? 0.4 : 1, transition: 'opacity 0.3s ease' }} />))}
                                        </Pie>
                                    </RechartsPieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ transition: 'all 0.2s ease' }}>
                                    <p className={`text-[8px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-slate-400' : 'text-slate-600'}`}>Total</p>
                                    <p className={`text-lg font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{viewInUSD ? '$' : 'R$'} {(totalChartValue * displayMultiplier).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="md:col-span-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {chartItems.map((item, idx) => {
                                        const pct = totalChartValue > 0 ? (item.value / totalChartValue) * 100 : 0;
                                        return (
                                            <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'}`}>
                                                <div className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" style={{ background: item.color }} />
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-xs font-black truncate ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{item.name}</p>
                                                    <p className={`text-[10px] font-bold ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                                                        {viewInUSD ? '$' : 'R$'} {(item.value * displayMultiplier).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </p>
                                                </div>
                                                <div className="flex-shrink-0 text-right">
                                                    <p className="text-sm font-black" style={{ color: item.color }}>{pct.toFixed(1)}%</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Content Layout */}
            {investments.length === 0 ? (
                <div className={`p-12 rounded-2xl border border-dashed text-center space-y-3 ${theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
                    <div className="w-16 h-16 bg-slate-500/10 rounded-2xl flex items-center justify-center mx-auto">
                        <Search className="w-8 h-8 text-slate-500" />
                    </div>
                    <p className="text-sm font-bold text-slate-500">Nenhum investimento cadastrado ainda.</p>
                </div>
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className={`text-sm font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Seus Ativos em Detalhe</h3>
                    </div>
                    <div className="space-y-3">
                        {Object.entries(groupedInvestments).map(([type, assets]) => {
                            const Config = ASSET_TYPES[type] || ASSET_TYPES.crypto;
                            const isExpanded = expandedCategories[type];

                            return (
                                <div key={type} className={`rounded-2xl border overflow-hidden ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900/80 border-white/[0.06]'}`}>
                                    {/* Category Header */}
                                    <button 
                                        onClick={() => setExpandedCategories(prev => ({ ...prev, [type]: !prev[type] }))}
                                        className={`w-full flex items-center justify-between px-5 py-3.5 transition-all ${theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-500" />}
                                            <Config.icon className={`w-4 h-4 ${Config.color}`} />
                                            <span className={`text-xs font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{Config.label}</span>
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-500/10 text-slate-500">{assets.length}</span>
                                        </div>
                                        <div className={`text-[10px] font-black text-slate-500`}>
                                        </div>
                                    </button>

                                    {/* Table Header */}
                                    {isExpanded && (
                                    <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                                        <div className={`hidden md:grid grid-cols-12 gap-2 px-5 py-2 text-[8px] font-black uppercase tracking-widest border-t ${theme === 'light' ? 'text-slate-400 border-slate-100 bg-slate-50/50' : 'text-slate-600 border-white/[0.04] bg-white/[0.02]'}`}>
                                            <div className="col-span-1"></div>
                                            <div className="col-span-2">Ativo</div>
                                            <div className="col-span-1">Categoria</div>
                                            <div className="col-span-2 text-right">Quantidade</div>
                                            <div className="col-span-2 text-right">Preço Médio</div>
                                            <div className="col-span-2 text-right">Desempenho (%)</div>
                                            <div className="col-span-2 text-right">Valor Total</div>
                                        </div>

                                        {/* Asset Rows */}
                                        {assets.map(asset => {
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
                                            let trueCurrent = isFixedIncome
                                                ? (asset.manualCurrentPrice || trueInvested)
                                                : (asset.quantity * currentPrice * (asset.isUSD ? prices.USD : 1));
                                            if (isFixedIncome) {
                                                const liveData = getLiveTesouroRate(asset.name);
                                                const pRate = parseFloat(asset.purchaseRate || asset.fixedRate || 0);
                                                let cRate = liveData ? liveData.rate : parseFloat(asset.currentMarketRate || asset.fixedRate || 0);
                                                if (pRate > 0 && cRate > 0 && pRate !== cRate && !asset.manualCurrentPrice) {
                                                    trueCurrent = trueInvested * (pRate / cRate);
                                                }
                                            }
                                            const profitPct = trueInvested > 0 ? ((trueCurrent - trueInvested) / trueInvested) * 100 : 0;
                                            const displayCurrency = viewInUSD ? '$' : 'R$';
                                            const displayCurrentVal = trueCurrent * displayMultiplier;
                                            const brlPurchasePrice = asset.isUSD ? asset.purchasePrice * (prices.USD || 5.0) : asset.purchasePrice;
                                            const displayPurchasePrice = isFixedIncome ? (trueInvested * displayMultiplier) : (brlPurchasePrice * displayMultiplier);

                                            return (
                                                <div key={asset.id} className={`group relative grid grid-cols-1 md:grid-cols-12 gap-2 items-center px-5 py-3 border-t transition-all ${theme === 'light' ? 'border-slate-100 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.03]'}`}>
                                                    {/* Actions */}
                                                    <div className="col-span-1 flex items-center gap-1">
                                                        <button 
                                                            onClick={() => { setNewAsset({ ...asset, aporteQuantity: '', aporteAmount: '' }); setIsAporting(asset.id); }}
                                                            className={`p-1 rounded-md transition-all opacity-0 group-hover:opacity-100 ${theme === 'light' ? 'hover:bg-blue-50 text-blue-500' : 'hover:bg-blue-500/10 text-blue-400'}`}
                                                            title="Aporte"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                        </button>
                                                        <button 
                                                            onClick={() => { setNewAsset({ ...asset }); setIsEditing(asset.id); setIsAdding(true); }}
                                                            className={`p-1 rounded-md transition-all opacity-0 group-hover:opacity-100 ${theme === 'light' ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/10 text-slate-500'}`}
                                                            title="Editar"
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                        </button>
                                                        <button 
                                                            onClick={() => setDeleteConfirm({ id: asset.id, type: 'asset', title: asset.name })}
                                                            className={`p-1 rounded-md transition-all opacity-0 group-hover:opacity-100 ${theme === 'light' ? 'hover:bg-rose-50 text-rose-400' : 'hover:bg-rose-500/10 text-rose-400'}`}
                                                            title="Excluir"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>

                                                    {/* Asset Name */}
                                                    <div className="col-span-2 flex items-center gap-2.5 min-w-0">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${Config.bg}`}>
                                                            <Config.icon className={`w-4 h-4 ${Config.color}`} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className={`text-xs font-black truncate ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{asset.symbol || asset.name}</p>
                                                            <p className="text-[9px] text-slate-500 font-medium truncate">{asset.name}</p>
                                                        </div>
                                                    </div>

                                                    {/* Category */}
                                                    <div className="col-span-1">
                                                        <span className="text-[9px] font-bold text-slate-500">{Config.label}</span>
                                                    </div>

                                                    {/* Quantity */}
                                                    <div className="col-span-2 text-right">
                                                        <span className={`text-xs font-bold ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>
                                                            {isFixedIncome ? '1' : asset.quantity?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>

                                                    {/* Purchase Price */}
                                                    <div className="col-span-2 text-right">
                                                        <span className={`text-xs font-bold ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>
                                                            {displayCurrency} {displayPurchasePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>

                                                    {/* Performance */}
                                                    <div className="col-span-2 text-right">
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md ${profitPct >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                            {profitPct >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                                                            {profitPct >= 0 ? '+' : ''}{profitPct.toFixed(1)}%
                                                        </span>
                                                    </div>

                                                    {/* Total Value */}
                                                    <div className="col-span-2 text-right">
                                                        <span className={`text-xs font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                                            {displayCurrency} {displayCurrentVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>

                                                    {/* Delete overlay */}
                                                    {deleteConfirm?.id === asset.id && deleteConfirm?.type === 'asset' && (
                                                        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-2xl flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
                                                            <div className="flex items-center gap-4">
                                                                <Trash2 className="w-5 h-5 text-rose-500" />
                                                                <span className="text-white font-bold text-xs">Excluir {asset.name}?</span>
                                                                <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 rounded-lg bg-white/10 text-white font-black text-[10px] hover:bg-white/20">Não</button>
                                                                <button onClick={() => handleDeleteAsset(asset.id)} className="px-3 py-1.5 rounded-lg bg-rose-500 text-white font-black text-[10px] hover:bg-rose-600">Excluir</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Column: Alivia Insight */}
                <div className="lg:col-span-1 space-y-4">
                    <div className={`p-5 rounded-3xl border ${theme === 'light' ? 'bg-indigo-50 border-indigo-100 shadow-sm' : 'bg-indigo-500/5 border-indigo-500/20'} relative overflow-hidden group transition-all duration-300`}>
                        <div className="absolute top-0 right-0 p-4 opacity-10 text-indigo-500">
                            <Sparkles className="w-20 h-20" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="relative shrink-0">
                                    <img src={aliviaFinal} alt="Alívia" className="w-10 h-10 object-cover rounded-full border border-indigo-200/50 shadow-sm" />
                                    <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-[#131621] border border-white/10 text-indigo-400">
                                        <Sparkles className="w-3 h-3" />
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-indigo-600' : 'text-indigo-400'}`}>Alívia Insight</span>
                                    <span className={`text-xs font-bold ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>Foco da Carteira</span>
                                </div>
                            </div>
                            <p className={`text-xs font-medium leading-relaxed ${theme === 'light' ? 'text-indigo-900/80' : 'text-indigo-100/70'}`}>
                                Analisando seus investimentos, noto que sua alocação está ganhando corpo. {
                                    (groupedInvestments['acoes']?.length > 0 || groupedInvestments['etfs']?.length > 0) 
                                    ? 'Com exposição ao mercado de ações/ETFs, você aposta no crescimento de grandes empresas, inovação e tecnologia no longo prazo.' 
                                    : groupedInvestments['crypto']?.length > 0 
                                    ? 'Sua exposição a criptomoedas mostra um apetite por disrupção e tecnologia.' 
                                    : 'A carteira tem um perfil sólido focado em rentabilidade previsível e preservação de patrimônio.'
                                } Continue mantendo o equilíbrio!
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            )}

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
