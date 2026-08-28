import React, { useState, useEffect, useMemo, useRef } from 'react';
import AliviaFormHint from '../components/AliviaFormHint';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useLivePrices } from '../hooks/useLivePrices';
import { getUsdRate, getCdiRate } from '../utils/marketRates';
import {
    Plus, Minus, Pencil, Trash2, X, Loader2, Check, Search, Save, ChevronDown,
    Landmark, PieChart as PieIcon, Activity, Bitcoin, TrendingUp, TrendingDown,
    ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);
const numBR = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
// Quantidade: aceita "0,7" E "0.7" como 0,7. Se tem vírgula → pt-BR (ponto = milhar);
// se só tem ponto → ponto é decimal (evita "0.7" virar 7).
const numQty = (v) => {
    const s = String(v ?? '').trim();
    if (!s) return 0;
    return s.includes(',')
        ? (parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0)
        : (parseFloat(s) || 0);
};
const normalizeName = (s) => { const t = String(s || '').trim().replace(/\s+/g, ' '); return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t; };
const CUR_KEY = 'aliviaPatrimonioCur';

const GROUP_META = {
    renda_fixa: { label: 'Renda Fixa', color: '#6366f1', icon: PieIcon },
    acoes_etfs: { label: "Ações / ETF's", color: '#f59e0b', icon: Activity },
    crypto: { label: 'Criptoativos', color: '#10b981', icon: Bitcoin },
    fundos_imoveis: { label: 'Fundos / Imóveis', color: '#3b82f6', icon: Landmark },
};
const GROUP_IDS = Object.keys(GROUP_META);
const getGroup = (type) =>
    type === 'renda_fixa' ? 'renda_fixa'
        : (type === 'acoes' || type === 'etfs') ? 'acoes_etfs'
            : type === 'crypto' ? 'crypto'
                : (type === 'fiis' || type === 'imoveis') ? 'fundos_imoveis' : 'renda_fixa';

const ASSET_TYPES = [
    { id: 'renda_fixa', label: 'Renda Fixa', market: false },
    { id: 'acoes', label: 'Ações', market: true },
    { id: 'etfs', label: 'ETFs', market: true },
    { id: 'fiis', label: 'Fundos Imobiliários', market: true },
    { id: 'crypto', label: 'Criptomoedas', market: true },
    { id: 'imoveis', label: 'Imóveis', market: false },
];
const typeMeta = (id) => ASSET_TYPES.find(t => t.id === id) || { label: 'Outro', market: false };
const isMarket = (type) => !!typeMeta(type).market;

// Moeda do ativo acompanhado: cripto (Binance USDT) e ações AMERICANAS são em
// dólar. Ticker da B3 termina em dígito (PETR4, VALE3, IVVB11); ticker dos EUA
// é só letras (NVDA, AAPL, TSLA) → cotação em USD.
const guessUSD = (type, symbol) => {
    if (type === 'crypto') return true;
    if (type === 'acoes') return !/\d$/.test(String(symbol || '').trim());
    return false; // ETFs/FIIs da B3 são em reais
};

// Sugestões de ativos populares por classe (para o autocomplete com ícone).
const ACOES_BR = [['PETR4', 'Petrobras'], ['VALE3', 'Vale'], ['ITUB4', 'Itaú'], ['BBDC4', 'Bradesco'], ['BBAS3', 'Banco do Brasil'], ['ABEV3', 'Ambev'], ['B3SA3', 'B3'], ['WEGE3', 'WEG'], ['MGLU3', 'Magazine Luiza'], ['ITSA4', 'Itaúsa'], ['RENT3', 'Localiza'], ['SUZB3', 'Suzano'], ['RADL3', 'Raia Drogasil'], ['PRIO3', 'PetroRio']];
const ACOES_US = [['NVDA', 'NVIDIA'], ['AAPL', 'Apple'], ['TSLA', 'Tesla'], ['AMZN', 'Amazon'], ['MSFT', 'Microsoft'], ['GOOGL', 'Alphabet'], ['GOOG', 'Alphabet C'], ['META', 'Meta'], ['AMD', 'AMD'], ['KO', 'Coca-Cola'], ['DIS', 'Disney'], ['NU', 'Nubank'], ['PLTR', 'Palantir'], ['BABA', 'Alibaba'], ['NFLX', 'Netflix'], ['ORCL', 'Oracle'], ['INTC', 'Intel'], ['PYPL', 'PayPal'], ['UBER', 'Uber']];
const ASSET_SUGGESTIONS = {
    crypto: [['BTC', 'Bitcoin'], ['ETH', 'Ethereum'], ['USDT', 'Tether'], ['BNB', 'BNB'], ['SOL', 'Solana'], ['XRP', 'XRP'], ['ADA', 'Cardano'], ['DOGE', 'Dogecoin'], ['AVAX', 'Avalanche'], ['MATIC', 'Polygon'], ['DOT', 'Polkadot'], ['LINK', 'Chainlink'], ['LTC', 'Litecoin'], ['SHIB', 'Shiba Inu'], ['TRX', 'TRON'], ['UNI', 'Uniswap']],
    acoes: [...ACOES_BR, ...ACOES_US],
    acoes_br: ACOES_BR,
    acoes_us: ACOES_US,
    etfs: [['IVVB11', 'S&P 500'], ['BOVA11', 'Ibovespa'], ['SMAL11', 'Small Caps'], ['HASH11', 'Cripto (Hashdex)'], ['NASD11', 'Nasdaq 100'], ['GOLD11', 'Ouro']],
    fiis: [['MXRF11', 'Maxi Renda'], ['HGLG11', 'CSHG Logística'], ['KNRI11', 'Kinea'], ['XPML11', 'XP Malls'], ['HGRU11', 'CSHG Renda Urbana'], ['VISC11', 'Vinci Shopping'], ['KNCR11', 'Kinea CRI'], ['BTLG11', 'BTG Logística']],
};
// "Ações Globais" (acoes_us) → salva como 'acoes' em dólar; "Ações BR" (acoes_br) → 'acoes' em real.
const MONITOR_TYPE = { acoes_br: { type: 'acoes', isUSD: false }, acoes_us: { type: 'acoes', isUSD: true } };
const resolveMonitorType = (t) => MONITOR_TYPE[t] || { type: t, isUSD: undefined };

// Fontes de logo por ticker (CSP libera https:). Cripto: spothq. Ações/ETFs/FIIs
// da B3: icons.brapi.dev. Ações globais (EUA): assets.parqet.com. Tenta na ordem e,
// se todas falharem (onError), cai na inicial colorida da classe.
const assetLogoCandidates = (symbol, type, usd) => {
    const S = String(symbol || '').trim().toUpperCase();
    if (!S) return [];
    if (type === 'crypto') return [`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${S.toLowerCase()}.png`];
    if (['acoes', 'etfs', 'fiis'].includes(type)) {
        const parqet = `https://assets.parqet.com/logos/symbol/${S}`;
        const brapi = `https://icons.brapi.dev/icons/${S}.svg`;
        return usd ? [parqet, brapi] : [brapi, parqet]; // EUA → parqet 1º; B3 → brapi 1º
    }
    return [];
};

// Ícone do ativo: logo real (cripto/ações/ETFs/FIIs) com fallback pra inicial colorida.
function AssetIcon({ symbol, type, name, size = 40, isUSD }) {
    const usd = isUSD != null ? isUSD : guessUSD(type, symbol);
    const candidates = useMemo(() => assetLogoCandidates(symbol, type, usd), [symbol, type, usd]);
    const [idx, setIdx] = useState(0);
    useEffect(() => { setIdx(0); }, [symbol, type, usd]); // recomeça ao trocar de ativo
    const g = GROUP_META[getGroup(type)] || GROUP_META.renda_fixa;
    const url = candidates[idx];

    if (url) {
        // Cripto: moeda colorida em bleed. Ações/ETFs/FIIs: chip branco com o logo contido.
        if (type === 'crypto') {
            return <img src={url} alt="" onError={() => setIdx(i => i + 1)} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
        }
        return (
            <span className="rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-black/5" style={{ width: size, height: size }}>
                <img src={url} alt="" onError={() => setIdx(i => i + 1)} className="object-contain" style={{ width: Math.round(size * 0.82), height: Math.round(size * 0.82) }} />
            </span>
        );
    }
    return (
        <span className="rounded-full flex items-center justify-center font-black shrink-0" style={{ width: size, height: size, background: `${g.color}1f`, color: g.color, fontSize: Math.round(size * 0.36) }}>
            {(symbol || name || '?').charAt(0).toUpperCase()}
        </span>
    );
}

// Multiplicador de câmbio: se o ativo é dolarizado, converte USD → BRL pela cotação atual.
const usdMult = (a, prices) => (a.isUSD ? (prices.USD || 5.4) : 1);
// Preço unitário atual, na MOEDA do ativo (USD se isUSD, senão BRL). Mesma lógica do app oficial.
const currentUnit = (a, prices = {}) => {
    const sym = (a.symbol || '').toUpperCase();
    if (a.type === 'crypto' && sym) {
        if (a.isUSD && prices[`${sym}_USD`]) return prices[`${sym}_USD`];
        if (!a.isUSD && prices[`${sym}_BRL`]) return prices[`${sym}_BRL`];
        if (!a.isUSD && prices[`${sym}_USD`] && prices.USD) return prices[`${sym}_USD`] * prices.USD;
        if (a.isUSD && prices[`${sym}_BRL`] && prices.USD) return prices[`${sym}_BRL`] / prices.USD;
    }
    if (['acoes', 'etfs', 'fiis'].includes(a.type) && sym && prices[sym]) return prices[sym];
    return parseFloat(a.manualCurrentPrice || a.purchasePrice || 0) || 0;
};
// Variação diária do ativo, na MOEDA nativa dele → { pct, abs } | null.
const changeOf = (a, changes = {}) => {
    const sym = (a.symbol || '').toUpperCase();
    if (!sym) return null;
    if (a.type === 'crypto') return changes[`${sym}_${a.isUSD ? 'USD' : 'BRL'}`] || changes[`${sym}_USD`] || changes[`${sym}_BRL`] || null;
    return changes[sym] || null;
};
// Taxa diária efetiva equivalente a render X% do CDI ao ano (dia-calendário).
const dailyCalRate = (cdiAnnualPct, cdiPct) => Math.pow(1 + (cdiAnnualPct / 100) * ((cdiPct || 100) / 100), 1 / 365) - 1;

// Interpreta a taxa de um título do Tesouro. O campo anulRentPrcnt da API é:
//  • Tesouro Selic → SPREAD sobre a Selic (ex.: +0,04%). Total ≈ Selic/CDI + spread.
//  • Tesouro IPCA+ / Renda+ / Educa+ → taxa REAL (ex.: 6,5%). Total = IPCA + real.
//  • Tesouro Prefixado → a própria taxa fixa ao ano.
const tesouroRateInfo = (bondNameOrObj, anul, cdiAnnual = 0) => {
    const nm = String(typeof bondNameOrObj === 'string' ? bondNameOrObj : (bondNameOrObj?.nm || '')).toLowerCase();
    const v = parseFloat(anul != null ? anul : bondNameOrObj?.anulRentPrcnt) || 0;
    const f = (x) => x.toFixed(2).replace('.', ',');
    if (nm.includes('selic')) return { pct: cdiAnnual + v, label: `Selic + ${f(v)}%`, chip: `${f(cdiAnnual + v)}% a.a.` };
    if (nm.includes('ipca') || nm.includes('renda') || nm.includes('educa')) return { pct: v, label: `IPCA + ${f(v)}%`, chip: `IPCA + ${f(v)}%` };
    return { pct: v, label: `${f(v)}% a.a. (prefixado)`, chip: `${f(v)}% a.a.` };
};
// Valor ATUAL (na moeda do ativo) de uma renda fixa. CDB/pós-fixado (cdiPercent)
// rende dia a dia pelo CDI desde a data do aporte. Senão, usa o valor manual.
const rfCurrent = (a, cdiAnnual = 0) => {
    const base = parseFloat(a.totalApplied ?? a.purchasePrice ?? 0) || 0;
    if (base <= 0) return 0;
    if (a.cdiPercent != null && cdiAnnual > 0) {
        const since = a.investedAt || a.createdAt || Date.now();
        const days = Math.max(0, (Date.now() - since) / 86400000);
        return base * Math.pow(1 + dailyCalRate(cdiAnnual, a.cdiPercent), days);
    }
    return parseFloat(a.manualCurrentPrice ?? base) || base;
};
// Valor atual em BRL = quantidade × preço unitário × câmbio (renda fixa: valor acumulado).
const valueOf = (a, prices = {}, cdi = 0) => {
    if (a.type === 'renda_fixa') return rfCurrent(a, cdi) * usdMult(a, prices);
    const q = parseFloat(a.quantity || 1) || 1;
    return q * currentUnit(a, prices) * usdMult(a, prices);
};
// Valor investido em BRL = quantidade × preço de compra × câmbio.
const investedOf = (a, prices = {}) => {
    if (a.type === 'renda_fixa') return (parseFloat(a.totalApplied || a.purchasePrice || 0) || 0) * usdMult(a, prices);
    const q = parseFloat(a.quantity || 1) || 1;
    return q * (parseFloat(a.purchasePrice || 0) || 0) * usdMult(a, prices);
};

// Recalcula quantidade e PREÇO DE CUSTO MÉDIO a partir dos movimentos (aportes/vendas),
// método do custo médio ponderado. Ordena por data e replica os lançamentos.
const recomputeFromMovs = (movs = []) => {
    let qty = 0, cost = 0; // cost = base de custo total
    [...movs]
        .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || (a.createdAt || 0) - (b.createdAt || 0))
        .forEach(m => {
            const mq = Math.abs(parseFloat(m.quantity) || 0);
            const mp = Math.abs(parseFloat(m.price) || 0);
            if (m.kind === 'sell') {
                const avg = qty > 0 ? cost / qty : 0;
                cost -= Math.min(mq, qty) * avg;
                qty = Math.max(0, qty - mq);
            } else {
                qty += mq; cost += mq * mp;
            }
        });
    return { quantity: qty, avgCost: qty > 0 ? cost / qty : 0 };
};

export default function Patrimonio() {
    const { currentUser } = useAuth();
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const uid = currentUser?.uid;

    const [investments, setInvestments] = useState([]);
    const [watchlist, setWatchlist] = useState([]);
    const [invTxs, setInvTxs] = useState([]);      // aportes/vendas dos ativos
    const [trade, setTrade] = useState(null);      // { asset, kind: 'buy'|'sell' }
    const [openAsset, setOpenAsset] = useState(null); // id do ativo com aportes abertos
    const [cdi, setCdi] = useState(14.9);          // CDI anual (%) — taxa base do Brasil
    const [, setTick] = useState(0);                // re-render pro rendimento "andar"
    const [form, setForm] = useState(null);

    useEffect(() => {
        getCdiRate().then(raw => {
            if (!raw) return;
            const daily = raw / 365;
            const annual = (Math.pow(1 + daily / 100, 252) - 1) * 100;
            if (isFinite(annual) && annual > 0) setCdi(annual);
        }).catch(() => { });
        const t = setInterval(() => setTick(x => x + 1), 30000);
        return () => clearInterval(t);
    }, []);
    const [cur, setCur] = useState(() => (typeof localStorage !== 'undefined' && localStorage.getItem(CUR_KEY)) || 'BRL');
    const [saved, setSaved] = useState(false);
    const [tab, setTab] = useState('renda_fixa');
    const [search, setSearch] = useState('');
    const [monitorOpen, setMonitorOpen] = useState(false);

    useEffect(() => {
        if (!uid) return;
        const u1 = onSnapshot(query(collection(db, 'investments'), where('userId', '==', uid)),
            (s) => setInvestments(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { });
        const u2 = onSnapshot(query(collection(db, 'watchlist'), where('userId', '==', uid)),
            (s) => setWatchlist(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { });
        const u3 = onSnapshot(query(collection(db, 'investment_txs'), where('userId', '==', uid)),
            (s) => setInvTxs(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => { });
        return () => { u1(); u2(); u3(); };
    }, [uid]);

    // Cotações ao vivo dos ativos DA CARTEIRA + da watchlist (só acompanhar).
    const priceAssets = useMemo(() => [
        ...investments,
        ...watchlist.map(w => ({ type: w.type, symbol: w.symbol, isUSD: w.isUSD != null ? w.isUSD : guessUSD(w.type, w.symbol), quantity: 1 })),
    ], [investments, watchlist]);
    const { livePrices, priceChanges, tesouroData, getTesouroRate } = useLivePrices(priceAssets, true);

    // Watchlist: incluir / editar / excluir ativos só para acompanhar.
    const addWatch = async ({ symbol, type, name, isUSD }) => {
        const s = String(symbol || '').trim().toUpperCase();
        if (!s) return;
        await addDoc(collection(db, 'watchlist'), { symbol: s, type, name: name || '', isUSD: isUSD != null ? isUSD : guessUSD(type, s), userId: uid, createdAt: Date.now() });
    };
    const updWatch = (id, data) => updateDoc(doc(db, 'watchlist', id), data);
    const delWatch = (id) => deleteDoc(doc(db, 'watchlist', id));

    // ── Aportes / vendas de um ativo (mercado) ──────────────────────
    const movsOf = (assetId) => invTxs.filter(t => t.investmentId === assetId);

    // Cria o movimento inicial (1º aporte) a partir da posição atual do ativo,
    // caso ele ainda não tenha nenhum movimento (ativos criados antes desta feature).
    const ensureInitialMov = async (asset) => {
        if (movsOf(asset.id).length > 0) return movsOf(asset.id);
        const q0 = parseFloat(asset.quantity) || 0;
        const p0 = parseFloat(asset.purchasePrice) || 0;
        if (q0 <= 0) return [];
        const iso0 = asset.createdAt ? new Date(asset.createdAt).toISOString() : new Date().toISOString();
        const ref0 = await addDoc(collection(db, 'investment_txs'), {
            investmentId: asset.id, userId: uid, kind: 'buy', quantity: q0, price: p0, date: iso0,
            isUSD: !!asset.isUSD, createdAt: asset.createdAt || Date.now(),
        });
        return [{ id: ref0.id, investmentId: asset.id, kind: 'buy', quantity: q0, price: p0, date: iso0 }];
    };

    // Registra um aporte (buy) ou venda (sell), recalcula qtd + custo médio e salva.
    const applyTrade = async (asset, { kind, quantity, price, date }) => {
        const base = await ensureInitialMov(asset);
        const iso = new Date((date || todayISO()) + 'T12:00:00').toISOString();
        const mov = { investmentId: asset.id, userId: uid, kind, quantity: Math.abs(quantity) || 0, price: Math.abs(price) || 0, date: iso, isUSD: !!asset.isUSD, createdAt: Date.now() };
        const ref = await addDoc(collection(db, 'investment_txs'), mov);
        const merged = [...movsOf(asset.id)];
        base.forEach(b => { if (!merged.some(m => m.id === b.id)) merged.push(b); });
        merged.push({ ...mov, id: ref.id });
        const { quantity: q, avgCost } = recomputeFromMovs(merged);
        await updateDoc(doc(db, 'investments', asset.id), { quantity: q, purchasePrice: avgCost });
    };

    // Edita um movimento (qtd/preço) e recalcula a posição do ativo.
    const editMov = async (asset, movId, patch) => {
        await updateDoc(doc(db, 'investment_txs', movId), patch);
        const updated = movsOf(asset.id).map(m => m.id === movId ? { ...m, ...patch } : m);
        const { quantity: q, avgCost } = recomputeFromMovs(updated);
        await updateDoc(doc(db, 'investments', asset.id), { quantity: q, purchasePrice: avgCost });
    };

    // Exclui um movimento e recalcula a posição do ativo.
    const deleteMov = async (asset, movId) => {
        await deleteDoc(doc(db, 'investment_txs', movId));
        const remaining = movsOf(asset.id).filter(m => m.id !== movId);
        const { quantity: q, avgCost } = recomputeFromMovs(remaining);
        await updateDoc(doc(db, 'investments', asset.id), { quantity: q, purchasePrice: avgCost });
    };

    const total = useMemo(() => investments.reduce((a, x) => a + valueOf(x, livePrices, cdi), 0), [investments, livePrices, cdi]);
    const totalInvestido = useMemo(() => investments.reduce((a, x) => a + investedOf(x, livePrices), 0), [investments, livePrices]);
    const lucro = total - totalInvestido;
    const rentabilidade = totalInvestido > 0 ? (lucro / totalInvestido) * 100 : 0;

    const byGroup = useMemo(() => {
        const m = {}; GROUP_IDS.forEach(g => m[g] = 0);
        investments.forEach(a => { m[getGroup(a.type)] += valueOf(a, livePrices, cdi); });
        return m;
    }, [investments, livePrices, cdi]);

    const classes = useMemo(() => GROUP_IDS
        .map(gid => ({ id: gid, ...GROUP_META[gid], value: byGroup[gid], pct: total ? byGroup[gid] / total * 100 : 0 }))
        .filter(c => c.value > 0).sort((a, b) => b.value - a.value),
        [byGroup, total]);

    const assetsInTab = useMemo(() => investments
        .filter(a => getGroup(a.type) === tab)
        .filter(a => (a.name || '').toLowerCase().includes(search.trim().toLowerCase()) || (a.symbol || '').toLowerCase().includes(search.trim().toLowerCase()))
        .sort((a, b) => valueOf(b, livePrices, cdi) - valueOf(a, livePrices, cdi)),
        [investments, tab, search, livePrices, cdi]);

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';
    const rate = livePrices.USD || 5.4;
    const fmt = (v) => cur === 'USD' ? `US$ ${money(v / rate)}` : `R$ ${money(v)}`;

    const saveCur = () => { try { localStorage.setItem(CUR_KEY, cur); } catch { } setSaved(true); setTimeout(() => setSaved(false), 1500); };

    const inputCls = `w-full pl-10 pr-3.5 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;

    return (
        <div className="max-w-6xl mx-auto w-full">
            {/* Topo */}
            <div className="grid lg:grid-cols-[320px_1fr] gap-5 items-stretch">
                <div className={`rounded-2xl border p-6 flex flex-col items-center justify-center text-center ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                    <span className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-emerald-500/25 to-teal-600/15 ring-1 ring-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(16,185,129,0.2)]">
                        <Landmark className="w-12 h-12" strokeWidth={2.1} />
                    </span>
                    <h1 className={`text-2xl font-black tracking-tight mt-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>Patrimônio</h1>
                    <p className={`text-[11px] uppercase tracking-widest font-black mt-3 ${muted}`}>Total investido</p>
                    <p className="text-3xl font-black tabular-nums text-emerald-500 mt-0.5">{fmt(total)}</p>
                    <button onClick={() => setMonitorOpen(true)}
                        className={`mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold border transition active:scale-95 ${isDark ? 'border-white/10 text-slate-200 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                        <Activity className="w-3.5 h-3.5 text-emerald-500" /> Monitor de ativos
                    </button>
                </div>

                <div className={`rounded-2xl border p-5 flex flex-col ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                        <h2 className={`text-[13px] font-black uppercase tracking-widest ${muted}`}>Rentabilidade</h2>
                        <div className="flex items-start gap-2">
                            <div className="flex flex-col items-end gap-1">
                                <div className={`flex items-center gap-1 p-1 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                                    {['BRL', 'USD'].map(c => (
                                        <button key={c} onClick={() => setCur(c)}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition ${cur === c ? (isDark ? 'bg-white/10 text-white' : 'bg-white text-slate-800 shadow-sm') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                                            {c === 'BRL' ? 'R$' : 'US$'}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={saveCur}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition ${saved ? 'text-emerald-500' : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}`}>
                                    {saved ? <><Check className="w-3 h-3" /> salvo</> : <><Save className="w-3 h-3" /> salvar</>}
                                </button>
                            </div>
                            <button onClick={() => setForm({ editing: null })}
                                className="group flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white transition-all active:scale-95 shadow-md shadow-blue-500/30 ring-1 ring-inset ring-white/20">
                                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform"><Plus className="w-3 h-3" strokeWidth={3} /></span>
                                <span className="font-black uppercase tracking-[0.12em] text-[11px]">Novo ativo</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center mt-3">
                        <div className="flex items-center gap-2">
                            {rentabilidade >= 0 ? <TrendingUp className="w-7 h-7 text-emerald-500" /> : <TrendingDown className="w-7 h-7 text-rose-500" />}
                            <span className={`text-4xl font-black tabular-nums ${rentabilidade >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {rentabilidade >= 0 ? '+' : ''}{rentabilidade.toFixed(2)}%
                            </span>
                        </div>
                        <p className={`text-[13px] mt-2 ${muted}`}>
                            Investido <span className={`font-bold ${cell}`}>{fmt(totalInvestido)}</span>
                            {' · '}Lucro <span className={`font-bold ${lucro >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{lucro >= 0 ? '+' : ''}{fmt(lucro)}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Alocação */}
            <div className={`mt-5 rounded-2xl border p-5 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                <h2 className={`text-[15px] font-black tracking-tight flex items-center gap-2 mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    <PieIcon className="w-4 h-4 text-emerald-500" /> Alocação
                </h2>
                <div className="grid lg:grid-cols-2 gap-6 items-center">
                    {classes.length === 0 ? (
                        <div className={`flex flex-col items-center justify-center text-center py-10 ${muted}`}>
                            <PieIcon className="w-8 h-8 mb-2" />
                            <p className={`text-sm font-bold ${cell}`}>Sem alocação</p>
                            <p className="text-xs mt-1">Cadastre um ativo para ver a distribuição.</p>
                        </div>
                    ) : (
                        <div className="flex items-center gap-5 justify-center sm:justify-start">
                            <Donut classes={classes} total={total} fmt={fmt} isDark={isDark} />
                            <div className="space-y-2">
                                {classes.map(c => (
                                    <div key={c.id} className="flex flex-col">
                                        <span className="text-[13px] font-black tabular-nums" style={{ color: c.color }}>{c.pct.toFixed(2)}%</span>
                                        <span className={`text-[11px] ${muted}`}>{c.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        {GROUP_IDS.map(gid => {
                            const g = GROUP_META[gid]; const Icon = g.icon;
                            return (
                                <div key={gid} className={`rounded-2xl border p-4 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[12px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{g.label}</span>
                                        <Icon className="w-4 h-4" style={{ color: g.color }} />
                                    </div>
                                    <p className={`text-xl font-black tabular-nums mt-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>{fmt(byGroup[gid])}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Abas + busca + lista */}
            <div className="mt-8">
                <div className={`flex items-center gap-1 border-b overflow-x-auto no-scrollbar ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    {GROUP_IDS.map(gid => {
                        const on = tab === gid;
                        return (
                            <button key={gid} onClick={() => setTab(gid)}
                                className={`relative px-3.5 py-2.5 text-[12px] font-black uppercase tracking-wider whitespace-nowrap transition ${on ? '' : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}`}
                                style={on ? { color: GROUP_META[gid].color } : undefined}>
                                {GROUP_META[gid].label}
                                {on && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full" style={{ background: GROUP_META[gid].color }} />}
                            </button>
                        );
                    })}
                </div>

                <div className="relative mt-4">
                    <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${muted}`} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Pesquisar ${GROUP_META[tab].label} [nome ou ticker]`} className={inputCls} />
                </div>

                <div className={`mt-4 rounded-2xl border ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                    {assetsInTab.length === 0 ? (
                        <p className={`text-center text-sm py-12 ${muted}`}>Nenhum ativo encontrado nesta categoria.</p>
                    ) : (
                        <div className="divide-y divide-transparent">
                            {assetsInTab.map((a, i) => {
                                const color = GROUP_META[getGroup(a.type)].color;
                                const market = isMarket(a.type);
                                const inv = investedOf(a, livePrices), val = valueOf(a, livePrices, cdi);
                                const q = parseFloat(a.quantity || 1) || 1;
                                const precoBRL = market && q > 0 ? val / q : val;
                                const custoUnit = market ? (parseFloat(a.purchasePrice || 0) || 0) * (a.isUSD ? rate : 1) : 0;
                                const dayCh = market ? changeOf({ type: a.type, symbol: a.symbol, isUSD: a.isUSD }, priceChanges) : null;
                                const dayPct = dayCh ? dayCh.pct : null;
                                const dayUp = (dayPct ?? 0) >= 0;
                                const tRate = (!market && a.tesouroName) ? getTesouroRate(a.tesouroName) : null;
                                const cdbPct = (!market && a.cdiPercent != null) ? Number(a.cdiPercent) : null;
                                const r = inv > 0 ? (val - inv) / inv * 100 : 0;
                                const lucro = val - inv;
                                const up = r >= 0;
                                const Arrow = up ? ArrowUpRight : ArrowDownRight;
                                const posCls = up ? 'text-emerald-500' : 'text-rose-500';
                                const movs = movsOf(a.id);
                                const open = openAsset === a.id;
                                return (
                                    <div key={a.id} className={i ? `border-t ${isDark ? 'border-white/5' : 'border-slate-100'}` : ''}>
                                        <div className="overflow-x-auto">
                                            <div className="group flex items-center gap-4 px-4 py-3 min-w-[760px]">
                                                {/* Ticker + nome + preço atual + variação do dia */}
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                    <AssetIcon symbol={a.symbol} type={a.type} name={a.name} size={40} isUSD={a.isUSD} />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className={`font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{a.symbol ? a.symbol.toUpperCase() : (a.name || 'Ativo')}</p>
                                                            {market && <span className="text-[11px] font-black tabular-nums px-1.5 py-0.5 rounded-md whitespace-nowrap text-sky-400 bg-sky-500/12">{fmt(precoBRL)}</span>}
                                                            {tRate && <span className="text-[11px] font-black tabular-nums px-1.5 py-0.5 rounded-md whitespace-nowrap text-emerald-400 bg-emerald-500/12">{tesouroRateInfo(a.tesouroName, tRate.rate, cdi).chip}</span>}
                                                            {cdbPct != null && <span className="text-[11px] font-black tabular-nums px-1.5 py-0.5 rounded-md whitespace-nowrap text-emerald-400 bg-emerald-500/12">{cdbPct}% do CDI</span>}
                                                        </div>
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <p className="text-[11px] truncate" style={{ color }}>{a.symbol ? (a.name || typeMeta(a.type).label) : typeMeta(a.type).label}</p>
                                                            {market && dayPct != null && (
                                                                <span className={`text-[11px] font-bold tabular-nums whitespace-nowrap shrink-0 ${dayUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                    {dayUp ? '+' : ''}{dayPct.toFixed(2)}% <span className={muted}>no dia</span>
                                                                </span>
                                                            )}
                                                            {tRate && <span className="text-[11px] font-bold text-emerald-500/80 whitespace-nowrap shrink-0">taxa ao vivo</span>}
                                                            {cdbPct != null && <span className="text-[11px] font-bold text-emerald-500/80 whitespace-nowrap shrink-0">CDI {cdi.toFixed(2).replace('.', ',')}%/ano · rende sozinho</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                {market && <Col isDark={isDark} label="Qtd" value={String(a.quantity ?? 1)} cls={isDark ? 'text-slate-200' : 'text-slate-700'} w="w-16" />}
                                                {market && <Col isDark={isDark} label="Custo médio" value={fmt(custoUnit)} cls={isDark ? 'text-slate-200' : 'text-slate-700'} w="w-24" />}
                                                <Col isDark={isDark} label="Valor atual" value={fmt(val)} cls={isDark ? 'text-white' : 'text-slate-800'} w="w-28" />
                                                <Col isDark={isDark} label="Rent." w="w-24" value={<span className={`inline-flex items-center gap-0.5 ${posCls}`}><Arrow className="w-3 h-3" />{up ? '+' : ''}{r.toFixed(2)}%</span>} />
                                                <Col isDark={isDark} label="Lucro/Perda" w="w-28" value={<span className={`inline-flex items-center gap-0.5 ${lucro >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}><Arrow className="w-3 h-3" />{lucro >= 0 ? '+ ' : '− '}{fmt(Math.abs(lucro))}</span>} />
                                                {/* Ações */}
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {market && <button onClick={() => setTrade({ asset: a, kind: 'buy' })} title="Aportar" className={`px-2.5 py-1.5 rounded-lg text-[12px] font-bold ${isDark ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>Aportar</button>}
                                                    {market && <button onClick={() => setTrade({ asset: a, kind: 'sell' })} title="Vender" className={`px-2.5 py-1.5 rounded-lg text-[12px] font-bold ${isDark ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}>Vender</button>}
                                                    {/* Renda fixa não tem aportes → mantém edição direta. Ativos de mercado editam pelos aportes. */}
                                                    {!market && <button onClick={() => setForm({ editing: a })} title="Editar" className={`p-1.5 rounded-lg ${muted} ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}><Pencil className="w-3.5 h-3.5" /></button>}
                                                    <DeleteBtn isDark={isDark} onDelete={() => deleteDoc(doc(db, 'investments', a.id))} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Ver aportes */}
                                        {market && (
                                            <div className="px-4 pb-3 -mt-1">
                                                <button onClick={() => { const willOpen = !open; setOpenAsset(willOpen ? a.id : null); if (willOpen && movs.length === 0) ensureInitialMov(a); }}
                                                    className={`flex items-center gap-1.5 text-[12px] font-bold transition ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                                                    {open ? 'Ocultar' : 'Ver'} aportes{movs.length ? ` (${movs.length})` : ''}
                                                </button>
                                                {open && (
                                                    <AportesList isDark={isDark} asset={a} movs={movs} fmt={fmt} rate={rate}
                                                        onEdit={(movId, patch) => editMov(a, movId, patch)}
                                                        onDelete={(movId) => deleteMov(a, movId)} />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                {(livePrices.USD) && <p className={`text-[11px] mt-2 text-right ${muted}`}>Cotações ao vivo · dólar R$ {money(rate)}</p>}
            </div>

            {trade && <TradeModal isDark={isDark} asset={trade.asset} kind={trade.kind} rate={rate}
                onConfirm={async (data) => { await applyTrade(trade.asset, { kind: trade.kind, ...data }); setTrade(null); setOpenAsset(trade.asset.id); }}
                onClose={() => setTrade(null)} />}
            {form && <AtivoForm isDark={isDark} uid={uid} editing={form.editing} tesouroData={tesouroData} cdi={cdi} onClose={() => setForm(null)} />}
            {monitorOpen && <MonitorModal isDark={isDark} investments={investments} watchlist={watchlist} prices={livePrices} changes={priceChanges}
                defaultCur={cur} onAdd={addWatch} onUpdate={updWatch} onDelete={delWatch} onClose={() => setMonitorOpen(false)} />}
        </div>
    );
}

// ── Lista de aportes/vendas de um ativo (ver, editar, excluir) ──────
function AportesList({ isDark, asset, movs, fmt, rate, onEdit, onDelete }) {
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cur = asset.isUSD ? 'US$' : 'R$';
    const [editId, setEditId] = useState(null);
    const [eQty, setEQty] = useState('');
    const [ePrice, setEPrice] = useState('');
    const list = movs.length
        ? [...movs].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (b.createdAt || 0) - (a.createdAt || 0))
        : [{ id: '__init', kind: 'buy', quantity: asset.quantity, price: asset.purchasePrice, date: asset.createdAt ? new Date(asset.createdAt).toISOString() : null, _synthetic: true }];

    const startEdit = (m) => { setEditId(m.id); setEQty(String(Math.abs(parseFloat(m.quantity) || 0)).replace('.', ',')); setEPrice(String(Math.abs(parseFloat(m.price) || 0)).replace('.', ',')); };
    const saveEdit = (m) => { const nq = numQty(eQty), np = numBR(ePrice); if (nq <= 0 || np <= 0) { setEditId(null); return; } onEdit(m.id, { quantity: nq, price: np }); setEditId(null); };
    const inCls = `px-2 py-1.5 rounded-lg border text-[13px] font-bold outline-none w-20 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`;

    return (
        <div className={`mt-2 rounded-xl border divide-y overflow-hidden ${isDark ? 'border-white/10 divide-white/5' : 'border-slate-200 divide-slate-100'}`}>
            {list.map(m => {
                const isBuy = m.kind !== 'sell';
                const mq = Math.abs(parseFloat(m.quantity) || 0);
                const mpBRL = (Math.abs(parseFloat(m.price) || 0)) * (asset.isUSD ? rate : 1);
                const totalBRL = mq * mpBRL;
                const dateStr = m.date ? new Date(m.date).toLocaleDateString('pt-BR') : '';
                const editing = editId === m.id;
                return (
                    <div key={m.id} className={`flex items-center gap-3 px-3.5 py-2.5 text-[13px] ${isDark ? 'bg-white/[0.01]' : 'bg-white'}`}>
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isBuy ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>
                            {isBuy ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                        </span>
                        {editing ? (
                            <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                                <span className={`text-[11px] font-bold ${muted}`}>{isBuy ? 'Aporte' : 'Venda'}</span>
                                <input inputMode="decimal" value={eQty} onChange={e => setEQty(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="Qtd" className={inCls} autoFocus />
                                <span className={`text-[11px] ${muted}`}>un ×</span>
                                <input inputMode="decimal" value={ePrice} onChange={e => setEPrice(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder={cur} className={inCls} />
                                <span className={`text-[11px] ${muted}`}>{cur}</span>
                                <button onClick={() => saveEdit(m)} className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center"><Check className="w-3.5 h-3.5" /></button>
                                <button onClick={() => setEditId(null)} className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><X className="w-3.5 h-3.5" /></button>
                            </div>
                        ) : (
                            <>
                                <div className="min-w-0 flex-1">
                                    <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{isBuy ? 'Aporte' : 'Venda'} · {mq} un</p>
                                    <p className={`text-[11px] ${muted}`}>{[dateStr, `a ${fmt(mpBRL)}`].filter(Boolean).join(' · ')}</p>
                                </div>
                                <span className={`font-black tabular-nums whitespace-nowrap ${isBuy ? 'text-emerald-500' : 'text-amber-500'}`}>{isBuy ? '+' : '−'} {fmt(totalBRL)}</span>
                                {!m._synthetic && (
                                    <div className="flex items-center gap-0.5">
                                        <button onClick={() => startEdit(m)} title="Editar" className={`p-1.5 rounded-lg ${muted} ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}><Pencil className="w-3.5 h-3.5" /></button>
                                        <DeleteBtn isDark={isDark} onDelete={() => onDelete(m.id)} />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── Modal: aportar (comprar mais) ou vender ─────────────────────────
function TradeModal({ isDark, asset, kind, rate, onConfirm, onClose }) {
    const isBuy = kind === 'buy';
    const usd = !!asset.isUSD;
    const cur = usd ? 'US$' : 'R$';
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [date, setDate] = useState(todayISO());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const inputCls = `w-full px-3.5 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;

    const q = numQty(quantity), p = numBR(price);
    const totalNativo = q * p;
    const totalBRL = totalNativo * (usd ? rate : 1);
    const posAtual = parseFloat(asset.quantity || 0) || 0;
    const insufficient = !isBuy && q > posAtual + 1e-9;

    const confirmar = async () => {
        setError('');
        if (q <= 0 || p <= 0) { setError('Informe quantidade e preço.'); return; }
        if (insufficient) { setError(`Você só tem ${posAtual} unidade(s).`); return; }
        setSaving(true);
        try { await onConfirm({ quantity: q, price: p, date }); }
        catch (e) { console.error(e); setError('Não foi possível salvar. Tente de novo.'); setSaving(false); }
    };

    return (
        <Modal isDark={isDark} title={isBuy ? 'Aportar (comprar mais)' : 'Vender'} icon={isBuy ? Plus : Minus}
            iconCls={isBuy ? 'bg-emerald-500/12 text-emerald-500' : 'bg-amber-500/12 text-amber-500'} onClose={onClose}>
            <div className="space-y-3.5">
                <p className={`text-[12px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {asset.symbol ? asset.symbol.toUpperCase() : (asset.name || 'Ativo')} · você tem <span className="font-bold">{posAtual}</span> un
                </p>
                {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-2.5 rounded-xl text-[12px] text-center font-bold">{error}</div>}
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Quantidade"><input inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0" className={inputCls} autoFocus /></Field>
                    <Field label={`Preço unitário (${cur})`}><input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0,00" className={inputCls} /></Field>
                </div>
                <Field label="Data"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }} /></Field>
                <div className={`rounded-xl border px-3.5 py-3 flex items-center justify-between ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                    <span className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Total {isBuy ? 'do aporte' : 'da venda'}</span>
                    <span className={`font-black tabular-nums ${isBuy ? 'text-emerald-500' : 'text-amber-500'}`}>{cur} {money(totalNativo)}{usd ? ` · R$ ${money(totalBRL)}` : ''}</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                    <button onClick={onClose} className={`py-3 rounded-xl font-bold text-sm ${isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Cancelar</button>
                    <button onClick={confirmar} disabled={saving || insufficient} className={`py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 ${isBuy ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> {isBuy ? 'Aportar' : 'Vender'}</>}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

function Col({ isDark, label, value, cls = '', w = 'w-24' }) {
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    return (
        <div className={`text-right shrink-0 ${w}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${muted}`}>{label}</p>
            <p className={`text-[13px] font-black tabular-nums whitespace-nowrap ${cls}`}>{value}</p>
        </div>
    );
}

function Donut({ classes, total, fmt, isDark }) {
    const size = 190, sw = 26, r = (size - sw) / 2, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
    let offset = 0;
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
                <g transform={`rotate(-90 ${cx} ${cy})`}>
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'} strokeWidth={sw} />
                    {classes.map(c => {
                        const dash = (c.pct / 100) * C;
                        const el = <circle key={c.id} cx={cx} cy={cy} r={r} fill="none" stroke={c.color} strokeWidth={sw} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-offset} />;
                        offset += dash;
                        return el;
                    })}
                </g>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
                <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Total</span>
                <span className={`text-[13px] font-black tabular-nums ${isDark ? 'text-white' : 'text-slate-800'}`}>{fmt(total)}</span>
            </div>
        </div>
    );
}

function DeleteBtn({ isDark, onDelete }) {
    const [confirm, setConfirm] = useState(false);
    if (confirm) return (
        <div className="flex items-center gap-1">
            <button onClick={() => setConfirm(false)} className={`px-2 py-1 rounded text-[11px] font-bold ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>Não</button>
            <button onClick={onDelete} className="px-2 py-1 rounded text-[11px] font-bold bg-rose-500 text-white">Excluir</button>
        </div>
    );
    return <button onClick={() => setConfirm(true)} title="Excluir" className={`p-1.5 rounded-lg text-slate-400 hover:text-rose-500 ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}><Trash2 className="w-3.5 h-3.5" /></button>;
}

// Busca a cotação de um ticker NA MOEDA do ativo (USD se isUSD, senão BRL).
// Cripto via Binance; ações/ETFs/FIIs via brapi (BRL) / Yahoo (moeda nativa).
async function fetchTickerPrice(type, ticker, isUSD) {
    const sym = String(ticker || '').trim().toUpperCase();
    if (!sym) return null;
    if (type === 'crypto') {
        const res = await fetch('https://api.binance.com/api/v3/ticker/price');
        const data = await res.json();
        const usdt = data.find(p => p.symbol === `${sym}USDT`);
        const brl = data.find(p => p.symbol === `${sym}BRL`);
        if (isUSD) {
            if (usdt) return parseFloat(usdt.price);
            if (brl) { const rate = await getUsdRate(); return parseFloat(brl.price) / (rate || 5.4); }
        } else {
            if (brl) return parseFloat(brl.price);
            if (usdt) { const rate = await getUsdRate(); return parseFloat(usdt.price) * (rate || 5.4); }
        }
        return null;
    }
    // Ações / ETFs / FIIs. Sem isUSD → brapi (BRL). Com isUSD (ativo em bolsa dos EUA) → Yahoo.
    if (!isUSD) {
        try {
            const res = await fetch(`https://brapi.dev/api/quote/${sym}`);
            if (res.ok) { const d = await res.json(); const p = d?.results?.[0]?.regularMarketPrice; if (p) return parseFloat(p); }
        } catch { }
    }
    try {
        const isBR = !isUSD && (/\d/.test(sym) || (sym.length >= 5 && !sym.includes('.')));
        const yt = isBR ? `${sym}.SA` : sym;
        const r2 = await fetch(`https://corsproxy.io/?${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${yt}`)}`);
        if (r2.ok) { const d2 = await r2.json(); const m = d2?.chart?.result?.[0]?.meta; const p = m?.regularMarketPrice || m?.previousClose; if (p) return parseFloat(p); }
    } catch { }
    return null;
}

// ── Form: novo/editar ativo (com busca de cotação por ticker) ───────
export function AtivoForm({ isDark, uid, editing, onClose, hint, allowAddAnother = false, tesouroData = [], cdi = 14.9 }) {
    const againRef = useRef(false);
    const [added, setAdded] = useState(0);
    // Por padrão NÃO desconta do saldo (o ativo já existe / já foi aportado).
    const [naoDescontar, setNaoDescontar] = useState(true);
    const [name, setName] = useState(editing?.name || '');
    const [type, setType] = useState(editing?.type || 'renda_fixa');
    const [symbol, setSymbol] = useState(editing?.symbol || '');
    const [quantity, setQuantity] = useState(editing?.quantity ? String(editing.quantity).replace('.', ',') : '');
    const [buyPrice, setBuyPrice] = useState(editing?.purchasePrice != null ? String(editing.purchasePrice).replace('.', ',') : '');
    const [curPrice, setCurPrice] = useState(editing?.manualCurrentPrice != null ? String(editing.manualCurrentPrice).replace('.', ',') : '');
    const [isUSD, setIsUSD] = useState(!!editing?.isUSD);
    const [usdRate, setUsdRate] = useState(5.4);
    // renda fixa / imóveis (manual) — inicia pelos valores BRUTOS (na moeda do ativo).
    const [invested, setInvested] = useState(editing && !isMarket(editing?.type) ? String(editing.totalApplied ?? editing.purchasePrice ?? '').replace('.', ',') : '');
    const [current, setCurrent] = useState(editing && !isMarket(editing?.type) ? String(editing.manualCurrentPrice ?? '').replace('.', ',') : '');
    const [fetching, setFetching] = useState(false);
    const [fetchMsg, setFetchMsg] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showSug, setShowSug] = useState(false);
    // Renda fixa: subtipo + parâmetros (CDB/pós = % do CDI; Tesouro = título).
    const [rfKind, setRfKind] = useState(editing?.rfKind || (editing?.tesouroName ? 'tesouro' : 'cdb'));
    const [tesouroName, setTesouroName] = useState(editing?.tesouroName || '');
    const [tSearch, setTSearch] = useState('');
    const [showTList, setShowTList] = useState(false);
    const [cdiPercent, setCdiPercent] = useState(editing?.cdiPercent != null ? String(editing.cdiPercent) : '100');
    const [investedDate, setInvestedDate] = useState(editing?.investedAt ? new Date(editing.investedAt).toISOString().slice(0, 10) : todayISO());

    useEffect(() => { getUsdRate().then(r => { if (r) setUsdRate(r); }).catch(() => { }); }, []);

    const market = isMarket(type);
    const RF_KINDS = [{ id: 'cdb', label: 'CDB' }, { id: 'lci_lca', label: 'LCI/LCA' }, { id: 'tesouro', label: 'Tesouro' }, { id: 'outro', label: 'Outro' }];
    const isTesouro = type === 'renda_fixa' && rfKind === 'tesouro';
    const isCdiBased = type === 'renda_fixa' && (rfKind === 'cdb' || rfKind === 'lci_lca'); // rende % do CDI
    // Preview do rendimento (CDB): valor hoje acumulado pelo CDI desde a data.
    const cdiP = Math.max(0, parseFloat(cdiPercent) || 0);
    const rfInvested = numBR(invested);
    const rfDays = Math.max(0, (Date.now() - new Date(investedDate + 'T12:00:00').getTime()) / 86400000);
    const rfHoje = rfInvested > 0 ? rfInvested * Math.pow(1 + dailyCalRate(cdi, cdiP), rfDays) : 0;
    const rfRend = rfHoje - rfInvested;
    const rfMes = (Math.pow(1 + dailyCalRate(cdi, cdiP), 30) - 1) * 100;
    const tList = (tesouroData || []).filter(b => { const q = tSearch.trim().toLowerCase(); return !q || String(b.nm || '').toLowerCase().includes(q); }).slice(0, 40);
    const selBond = (tesouroData || []).find(b => b.nm === tesouroName);
    const selRate = selBond ? parseFloat(selBond.anulRentPrcnt) : null;
    const selUnit = selBond ? parseFloat(selBond.untrPric) : null;
    const sugList = (ASSET_SUGGESTIONS[type] || []).filter(([s, n]) => {
        const q = symbol.trim().toUpperCase();
        if (!q) return true;
        return s.startsWith(q) || s.includes(q) || n.toUpperCase().includes(q);
    }).slice(0, 8);
    const inputCls = `w-full px-3.5 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;
    const optStyle = { backgroundColor: isDark ? '#17181b' : '#ffffff', color: isDark ? '#e2e8f0' : '#1e293b' };
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';

    const qty = numQty(quantity) || 0;
    const mult = isUSD ? usdRate : 1;
    const investedMkt = qty * numBR(buyPrice) * mult;
    const currentMkt = qty * numBR(curPrice) * mult;
    const rentMkt = investedMkt > 0 ? (currentMkt - investedMkt) / investedMkt * 100 : 0;

    const buscar = async () => {
        setFetchMsg(''); setFetching(true);
        try {
            const price = await fetchTickerPrice(type, symbol, isUSD);
            if (price) { setCurPrice(String(price.toFixed(price < 1 ? 6 : 2)).replace('.', ',')); setFetchMsg('ok'); }
            else setFetchMsg('Cotação não encontrada. Confira o ticker.');
        } catch { setFetchMsg('Falha ao buscar. Tente de novo.'); }
        finally { setFetching(false); }
    };

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (isTesouro && !tesouroName) { setError('Selecione o título do Tesouro.'); return; }
        if (!isTesouro && !name.trim()) { setError('Informe o nome do ativo.'); return; }
        setSaving(true);
        let data;
        if (market) {
            if (qty <= 0 || numBR(buyPrice) <= 0) { setError('Preencha quantidade e preço de compra.'); setSaving(false); return; }
            data = {
                name: normalizeName(name), type, symbol: symbol.trim().toUpperCase(),
                quantity: qty, purchasePrice: numBR(buyPrice),
                manualCurrentPrice: numBR(curPrice) > 0 ? numBR(curPrice) : numBR(buyPrice),
                isUSD,
            };
        } else {
            const inv = numBR(invested);
            if (inv <= 0) { setError('Informe o valor investido.'); setSaving(false); return; }
            const val = numBR(current) > 0 ? numBR(current) : inv;
            const finalName = isTesouro ? tesouroName : normalizeName(name);
            const rfExtra = type === 'renda_fixa' ? {
                totalApplied: inv, rfKind, tesouroName: isTesouro ? tesouroName : '',
                ...(isCdiBased ? { cdiPercent: cdiP || 100, investedAt: new Date(investedDate + 'T12:00:00').getTime() } : { cdiPercent: null }),
            } : {};
            data = {
                name: finalName, type, symbol: '', quantity: 1, purchasePrice: inv, manualCurrentPrice: val, isUSD,
                ...rfExtra,
            };
        }
        try {
            if (editing) { await updateDoc(doc(db, 'investments', editing.id), data); onClose(); return; }
            await addDoc(collection(db, 'investments'), { ...data, userId: uid, createdAt: Date.now() });
            // Se o usuário DESMARCAR "não descontar", registra o aporte como saída da conta.
            if (!naoDescontar) {
                const cur = isUSD ? usdRate : 1;
                const brlInvested = market ? (qty * numBR(buyPrice) * cur) : (numBR(invested) * cur);
                if (brlInvested > 0) {
                    const iso = new Date().toISOString();
                    await addDoc(collection(db, 'transactions'), {
                        description: `Aporte: ${normalizeName(name)}`, amount: brlInvested, type: 'expense', category: 'investment',
                        date: iso, month: iso.slice(0, 7), userId: uid, createdAt: Date.now(), paymentMethod: 'pix', source: 'patrimonio',
                    });
                }
            }
            if (againRef.current) {
                againRef.current = false;
                setName(''); setSymbol(''); setQuantity(''); setBuyPrice(''); setCurPrice(''); setInvested(''); setCurrent('');
                setAdded(n => n + 1); setSaving(false);
            } else onClose();
        } catch (err) { console.error(err); setError('Não foi possível salvar. Tente de novo.'); setSaving(false); }
    };

    return (
        <Modal isDark={isDark} title={editing ? 'Editar ativo' : 'Novo ativo'} icon={Landmark} iconCls="bg-blue-500/12 text-blue-400" onClose={onClose}>
            <form onSubmit={submit} className="space-y-3.5">
                <AliviaFormHint isDark={isDark} text={hint} />
                {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-2.5 rounded-xl text-[12px] text-center font-bold">{error}</div>}

                <Field label="Classe">
                    <select value={type} onChange={e => { setType(e.target.value); setFetchMsg(''); }} className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
                        {ASSET_TYPES.map(t => <option key={t.id} value={t.id} style={optStyle}>{t.label}</option>)}
                    </select>
                </Field>

                {/* Renda fixa: subtipo (inclui Tesouro Direto) */}
                {type === 'renda_fixa' && (
                    <div>
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">Tipo de renda fixa</span>
                        <div className="grid grid-cols-4 gap-2">
                            {RF_KINDS.map(k => {
                                const on = rfKind === k.id;
                                return (
                                    <button key={k.id} type="button" onClick={() => { setRfKind(k.id); if (k.id !== 'tesouro') { setTesouroName(''); } }}
                                        className={`py-2 rounded-xl text-[12px] font-bold border transition active:scale-95 ${on ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : (isDark ? 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800')}`}>
                                        {k.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Tesouro Direto: escolher o título (taxa ao vivo) */}
                {isTesouro ? (
                    <div>
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">Título do Tesouro</span>
                        {(tesouroData || []).length === 0 ? (
                            <p className={`text-[12px] px-3.5 py-3 rounded-xl border ${isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>Carregando títulos do Tesouro… se demorar, os títulos aparecem ao vivo na tela de Patrimônio.</p>
                        ) : (
                            <div className="relative">
                                <input value={showTList ? tSearch : (tesouroName || tSearch)} onChange={e => { setTSearch(e.target.value); setShowTList(true); }}
                                    onFocus={() => { setShowTList(true); setTSearch(''); }} onBlur={() => setTimeout(() => setShowTList(false), 150)}
                                    placeholder="Buscar (ex.: Renda+, Selic 2029, IPCA+)" className={inputCls} />
                                {showTList && (
                                    <div className={`absolute z-20 left-0 right-0 mt-1 rounded-xl border shadow-2xl overflow-hidden max-h-60 overflow-y-auto ${isDark ? 'bg-[#141518] border-white/10' : 'bg-white border-slate-200'}`}>
                                        {tList.length === 0 ? <p className={`px-3 py-2.5 text-[12px] ${muted}`}>Nenhum título encontrado.</p> : tList.map((b) => (
                                            <button key={b.nm} type="button" onMouseDown={(e) => { e.preventDefault(); setTesouroName(b.nm); setName(b.nm); setShowTList(false); }}
                                                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                                                <span className={`text-[13px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{b.nm}</span>
                                                <span className="text-[12px] font-black text-emerald-500 tabular-nums shrink-0 whitespace-nowrap">{tesouroRateInfo(b, null, cdi).label}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {selBond && (() => {
                            const ti = tesouroRateInfo(selBond, null, cdi);
                            return (
                                <div className={`mt-2 rounded-xl border px-3.5 py-3 flex items-center justify-between ${isDark ? 'bg-emerald-500/[0.06] border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                                    <div className="min-w-0">
                                        <p className={`text-[13px] font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{tesouroName}</p>
                                        <p className={`text-[11px] ${muted}`}>Preço unit. R$ {money(selUnit)} · <span className="text-emerald-500 font-bold">{ti.label}</span> · <span className="text-emerald-500 font-bold">ao vivo</span></p>
                                    </div>
                                    <div className="text-right shrink-0 ml-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Taxa atual</p>
                                        <p className="text-lg font-black tabular-nums text-emerald-500">{ti.chip}</p>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                ) : (
                    <Field label="Nome do ativo"><input value={name} onChange={e => setName(e.target.value)} placeholder={market ? 'Ex.: Petrobras, Bitcoin' : 'Ex.: CDB Banco X, Tesouro Selic 2029'} className={inputCls} maxLength={40} autoFocus /></Field>
                )}

                {/* Moeda do ativo — vale para qualquer classe (dólar ou real) */}
                <label className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border cursor-pointer transition ${isUSD ? 'border-emerald-500/40 bg-emerald-500/10' : (isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50')}`}>
                    <input type="checkbox" checked={isUSD} onChange={e => { setIsUSD(e.target.checked); setFetchMsg(''); }} className="w-4 h-4 accent-emerald-500" />
                    <div>
                        <p className={`text-[13px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Valores em dólar (US$)</p>
                        <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Converte pelo câmbio atual · US$ 1 = R$ {money(usdRate)}</p>
                    </div>
                </label>

                {market ? (
                    <>
                        <Field label={type === 'crypto' ? 'Ticker (ex.: BTC, ETH)' : 'Ticker (ex.: PETR4, IVVB11)'}>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    {symbol.trim() && <span className="absolute left-2 top-1/2 -translate-y-1/2"><AssetIcon symbol={symbol} type={type} size={22} /></span>}
                                    <input value={symbol}
                                        onChange={e => { setSymbol(e.target.value.toUpperCase().replace(/\s/g, '')); setFetchMsg(''); setShowSug(true); }}
                                        onFocus={() => setShowSug(true)} onBlur={() => setTimeout(() => setShowSug(false), 150)}
                                        placeholder="Digite o ticker (ex.: BTC)" className={`${inputCls} ${symbol.trim() ? 'pl-9' : ''}`} maxLength={10} />
                                    {showSug && sugList.length > 0 && (
                                        <div className={`absolute z-20 left-0 right-0 mt-1 rounded-xl border shadow-2xl overflow-hidden max-h-56 overflow-y-auto ${isDark ? 'bg-[#141518] border-white/10' : 'bg-white border-slate-200'}`}>
                                            {sugList.map(([s, n]) => (
                                                <button key={s} type="button" onMouseDown={(e) => { e.preventDefault(); setSymbol(s); if (!name.trim()) setName(n); setShowSug(false); setFetchMsg(''); }}
                                                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                                                    <AssetIcon symbol={s} type={type} name={n} size={26} />
                                                    <span className={`text-[13px] font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{s}</span>
                                                    <span className={`text-[12px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{n}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button type="button" onClick={buscar} disabled={fetching || !symbol.trim()}
                                    className="shrink-0 px-3 rounded-xl bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 font-bold text-sm flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50">
                                    {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar
                                </button>
                            </div>
                            {fetchMsg && fetchMsg !== 'ok' && <p className="text-[11px] text-rose-400 mt-1 font-semibold">{fetchMsg}</p>}
                            {fetchMsg === 'ok' && <p className="text-[11px] text-emerald-400 mt-1 font-semibold">Cotação atualizada ✓</p>}
                        </Field>
                        <div className="grid grid-cols-3 gap-2">
                            <Field label="Quantidade"><input inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0" className={inputCls} /></Field>
                            <Field label={`Compra (${isUSD ? 'US$' : 'R$'})`}><input inputMode="decimal" value={buyPrice} onChange={e => setBuyPrice(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0,00" className={inputCls} /></Field>
                            <Field label={`Atual (${isUSD ? 'US$' : 'R$'})`}><input inputMode="decimal" value={curPrice} onChange={e => setCurPrice(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0,00" className={inputCls} /></Field>
                        </div>
                        <div className={`rounded-xl border p-3 flex items-center justify-between ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                            <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Valor atual</p>
                                <p className={`font-black tabular-nums ${isDark ? 'text-white' : 'text-slate-800'}`}>R$ {money(currentMkt)}</p>
                            </div>
                            <div className="text-right">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Rentab.</p>
                                <p className={`font-black tabular-nums ${rentMkt >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{rentMkt >= 0 ? '+' : ''}{rentMkt.toFixed(2)}%</p>
                            </div>
                        </div>
                    </>
                ) : isCdiBased ? (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label={`Valor investido (${isUSD ? 'US$' : 'R$'})`}><input inputMode="decimal" value={invested} onChange={e => setInvested(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0,00" className={inputCls} /></Field>
                            <Field label="Rende (% do CDI)"><input inputMode="numeric" value={cdiPercent} onChange={e => setCdiPercent(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} placeholder="100" className={inputCls} /></Field>
                        </div>
                        <Field label="Data do aporte"><input type="date" value={investedDate} onChange={e => setInvestedDate(e.target.value)} max={todayISO()} className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }} /></Field>
                        <div className={`rounded-xl border p-3.5 ${isDark ? 'bg-emerald-500/[0.06] border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                            <p className={`text-[11px] ${muted}`}>
                                Rende <span className="font-bold text-emerald-500">{cdiP}% do CDI</span> de <span className="font-bold text-emerald-500">{money(cdi)}%</span> a.a. (ao vivo) · ~<span className="font-bold text-emerald-500">{rfMes.toFixed(2)}% ao mês</span>
                            </p>
                            {rfInvested > 0 && (
                                <div className="flex items-center justify-between mt-2">
                                    <div><p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Valor hoje ({Math.floor(rfDays)} dias)</p><p className="font-black tabular-nums text-emerald-500">{isUSD ? 'US$' : 'R$'} {money(rfHoje)}</p></div>
                                    <div className="text-right"><p className={`text-[10px] font-black uppercase tracking-widest ${muted}`}>Rendimento</p><p className="font-black tabular-nums text-emerald-500">+ {isUSD ? 'US$' : 'R$'} {money(rfRend)}</p></div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label={`Valor investido (${isUSD ? 'US$' : 'R$'})`}><input inputMode="decimal" value={invested} onChange={e => setInvested(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0,00" className={inputCls} /></Field>
                            <Field label={`Valor atual (${isUSD ? 'US$' : 'R$'})`}><input inputMode="decimal" value={current} onChange={e => setCurrent(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="= investido" className={inputCls} /></Field>
                        </div>
                        {isUSD && numBR(current || invested) > 0 && (
                            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>≈ R$ {money(numBR(current || invested) * usdRate)} pelo câmbio atual</p>
                        )}
                    </>
                )}

                {!editing && (
                    <label className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border cursor-pointer transition ${naoDescontar ? 'border-emerald-500/40 bg-emerald-500/10' : (isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50')}`}>
                        <input type="checkbox" checked={naoDescontar} onChange={e => setNaoDescontar(e.target.checked)} className="w-4 h-4 accent-emerald-500 mt-0.5" />
                        <div>
                            <p className={`text-[13px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Não descontar do meu saldo em conta</p>
                            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Marque se você <b>já tem</b> esse ativo. Desmarque só se estiver aportando agora com dinheiro da conta.</p>
                        </div>
                    </label>
                )}
                {allowAddAnother && !editing ? (
                    <div className="space-y-2">
                        {added > 0 && <p className="text-[12px] text-emerald-500 font-bold text-center">{added} cadastrado(s) ✓ — adicione mais ou conclua.</p>}
                        <div className="grid grid-cols-2 gap-2">
                            <button type="submit" onClick={() => { againRef.current = true; }} disabled={saving}
                                className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition disabled:opacity-70 border ${isDark ? 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                                <Plus className="w-4 h-4" /> Adicionar outro
                            </button>
                            <button type="submit" onClick={() => { againRef.current = false; }} disabled={saving}
                                className="py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-1.5 transition disabled:opacity-70">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Concluir</>}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-70">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> {editing ? 'Salvar' : 'Cadastrar'}</>}
                    </button>
                )}
            </form>
        </Modal>
    );
}

function Field({ label, children }) {
    return <label className="block"><span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">{label}</span>{children}</label>;
}

// ── Monitor de ativos: preços ao vivo — carteira + watchlist ────────
function MonitorModal({ isDark, investments, watchlist = [], prices, changes = {}, defaultCur = 'BRL', onAdd, onUpdate, onDelete, onClose }) {
    const rate = prices.USD || 5.4;
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const [cur, setCur] = useState(defaultCur);
    const [addSym, setAddSym] = useState('');
    const [addType, setAddType] = useState('crypto');
    const [showSug, setShowSug] = useState(false);
    const [busy, setBusy] = useState(false);
    const disp = (brl) => cur === 'USD' ? brl / rate : brl;
    const sym = cur === 'USD' ? 'US$' : 'R$';
    const { type: realAddType, isUSD: realAddUSD } = resolveMonitorType(addType); // p/ ícone/moeda

    const sugList = (ASSET_SUGGESTIONS[addType] || []).filter(([s, n]) => {
        const q = addSym.trim().toUpperCase();
        if (!q) return true;
        return s.startsWith(q) || s.includes(q) || n.toUpperCase().includes(q);
    }).slice(0, 6);
    const sugName = (ASSET_SUGGESTIONS[addType] || []).find(([s]) => s === addSym.trim().toUpperCase())?.[1] || '';

    // Monta uma linha da tabela (preço + variação DIÁRIA na moeda de exibição).
    const buildRow = (type, symbol, name, id, removable, isUSDOverride) => {
        const isUSD = isUSDOverride != null ? isUSDOverride : guessUSD(type, symbol);
        const pseudo = { type, symbol, isUSD, quantity: 1 };
        const unitBRL = currentUnit(pseudo, prices) * (isUSD ? rate : 1);
        const ch = changeOf(pseudo, changes);
        const varBRL = ch ? ch.abs * (isUSD ? rate : 1) : null; // Var absoluta em BRL
        return { id, type, symbol, name, unitBRL, pct: ch ? ch.pct : null, varBRL, removable, isUSD };
    };

    const watch = watchlist
        .map(w => buildRow(w.type, w.symbol, w.name || typeMeta(w.type).label, w.id, true, w.isUSD))
        .sort((a, b) => b.unitBRL - a.unitBRL);
    const owned = investments
        .filter(a => isMarket(a.type) && a.symbol)
        .map(a => buildRow(a.type, a.symbol, a.name || typeMeta(a.type).label, a.id, false, a.isUSD))
        .sort((a, b) => b.unitBRL - a.unitBRL);

    const add = async () => {
        if (!addSym.trim()) return;
        setBusy(true);
        try { const { type, isUSD } = resolveMonitorType(addType); await onAdd({ symbol: addSym, type, name: sugName, isUSD }); setAddSym(''); } catch (e) { console.error(e); }
        setBusy(false);
    };

    const inputCls = `px-3 py-2.5 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;
    const optStyle = { backgroundColor: isDark ? '#17181b' : '#ffffff', color: isDark ? '#e2e8f0' : '#1e293b' };

    // Linha da tabela: Símbolo | Preço | Var | Var% | (remover).
    const Row = ({ r }) => {
        const has = r.pct != null;
        const up = (r.pct ?? 0) >= 0;
        const col = !has ? muted : up ? 'text-emerald-500' : 'text-rose-500';
        const arrow = up ? '+' : '−';
        return (
            <tr className={`group ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <AssetIcon symbol={r.symbol} type={r.type} name={r.name} size={32} isUSD={r.isUSD} />
                        <div className="min-w-0">
                            <p className={`font-black leading-tight truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{(r.symbol || '').toUpperCase()}</p>
                            <p className={`text-[11px] leading-tight truncate ${muted}`}>{r.name}</p>
                        </div>
                    </div>
                </td>
                <td className={`px-3 py-2.5 text-right font-black tabular-nums whitespace-nowrap ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {r.unitBRL > 0 ? `${sym} ${money(disp(r.unitBRL))}` : '—'}
                </td>
                <td className={`px-3 py-2.5 text-right font-bold tabular-nums whitespace-nowrap text-[13px] ${col}`}>
                    {r.varBRL == null ? '—' : `${arrow} ${sym} ${money(Math.abs(disp(r.varBRL)))}`}
                </td>
                <td className={`px-2 py-2.5 text-right whitespace-nowrap ${col}`}>
                    <span className="inline-block font-black tabular-nums text-[13px] px-1.5 py-0.5 rounded-md" style={has ? { backgroundColor: up ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)' } : undefined}>
                        {has ? `${up ? '+' : ''}${r.pct.toFixed(2)}%` : '—'}
                    </span>
                </td>
                <td className="pr-2 pl-0 w-8">
                    {r.removable && (
                        <button onClick={() => onDelete(r.id)} title="Remover" className={`p-1.5 rounded-lg text-slate-400 hover:text-rose-500 opacity-60 group-hover:opacity-100 transition ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}><Trash2 className="w-4 h-4" /></button>
                    )}
                </td>
            </tr>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border shadow-2xl p-6 ${isDark ? 'bg-[#141518] border-white/10' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl bg-emerald-500/12 text-emerald-500 flex items-center justify-center shrink-0"><Activity className="w-5 h-5" strokeWidth={2.4} /></span>
                        <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Monitor de ativos</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`flex items-center gap-0.5 p-0.5 rounded-lg ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                            {['BRL', 'USD'].map(c => (
                                <button key={c} onClick={() => setCur(c)} className={`px-2 py-0.5 rounded-md text-[11px] font-black transition ${cur === c ? 'bg-emerald-500 text-white' : muted}`}>{c === 'BRL' ? 'R$' : 'US$'}</button>
                            ))}
                        </div>
                        <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><X className="w-4 h-4" /></button>
                    </div>
                </div>
                <p className={`text-[12px] mb-4 flex items-center gap-1.5 ${muted}`}>
                    <span className="relative flex w-2 h-2"><span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" /><span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-500" /></span>
                    Ao vivo · atualiza a cada ~2 min · US$ 1 = R$ {money(rate)}
                </p>

                {/* Adicionar ativo pra acompanhar */}
                <div className={`rounded-2xl border p-3 mb-4 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
                    <p className={`text-[11px] font-black uppercase tracking-widest mb-2 ${muted}`}>Acompanhar novo ativo</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <select value={addType} onChange={e => { setAddType(e.target.value); setAddSym(''); }} className={`${inputCls} w-full sm:w-36 shrink-0`} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
                            <option value="crypto" style={optStyle}>Cripto</option>
                            <option value="acoes_br" style={optStyle}>Ações BR</option>
                            <option value="acoes_us" style={optStyle}>Ações Globais</option>
                            <option value="etfs" style={optStyle}>ETFs</option>
                            <option value="fiis" style={optStyle}>FIIs</option>
                        </select>
                        <div className="flex gap-2 flex-1 min-w-0">
                            <div className="relative flex-1 min-w-0">
                                {addSym.trim() && <span className="absolute left-2 top-1/2 -translate-y-1/2 z-10"><AssetIcon symbol={addSym} type={realAddType} size={20} isUSD={realAddUSD} /></span>}
                                <input value={addSym} onChange={e => { setAddSym(e.target.value.toUpperCase().replace(/\s/g, '')); setShowSug(true); }}
                                    onFocus={() => setShowSug(true)} onBlur={() => setTimeout(() => setShowSug(false), 150)}
                                    onKeyDown={e => e.key === 'Enter' && add()} placeholder="Ticker (ex.: BTC)" className={`${inputCls} w-full ${addSym.trim() ? 'pl-8' : ''}`} maxLength={10} />
                                {showSug && sugList.length > 0 && (
                                    <div className={`absolute z-20 left-0 right-0 mt-1 rounded-xl border shadow-2xl overflow-hidden max-h-48 overflow-y-auto ${isDark ? 'bg-[#141518] border-white/10' : 'bg-white border-slate-200'}`}>
                                        {sugList.map(([s, n]) => (
                                            <button key={s} type="button" onMouseDown={ev => { ev.preventDefault(); setAddSym(s); setShowSug(false); }}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                                                <AssetIcon symbol={s} type={realAddType} name={n} size={24} isUSD={realAddUSD} />
                                                <span className={`text-[13px] font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{s}</span>
                                                <span className={`text-[12px] truncate ${muted}`}>{n}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button onClick={add} disabled={busy || !addSym.trim()} className="shrink-0 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center gap-1.5 transition disabled:opacity-50">
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" strokeWidth={2.6} /> Adicionar</>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tabela (Símbolo · Preço · Var · Var%) — estilo watchlist */}
                {(watch.length > 0 || owned.length > 0) ? (
                    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className={`text-[10px] font-black uppercase tracking-wider ${muted} ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
                                        <th className="text-left font-black px-3 py-2">Símbolo</th>
                                        <th className="text-right font-black px-3 py-2">Preço</th>
                                        <th className="text-right font-black px-3 py-2">Var</th>
                                        <th className="text-right font-black px-2 py-2">Var%</th>
                                        <th className="w-8" />
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                                    {watch.length > 0 && (
                                        <tr className={isDark ? 'bg-white/[0.015]' : 'bg-slate-50/60'}>
                                            <td colSpan={5} className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${muted}`}>Acompanhando</td>
                                        </tr>
                                    )}
                                    {watch.map(r => <Row key={`w-${r.id}`} r={r} />)}
                                    {owned.length > 0 && (
                                        <tr className={isDark ? 'bg-white/[0.015]' : 'bg-slate-50/60'}>
                                            <td colSpan={5} className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${muted}`}>Meus ativos</td>
                                        </tr>
                                    )}
                                    {owned.map(r => <Row key={`o-${r.id}`} r={r} />)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <p className={`text-center text-sm py-8 ${muted}`}>Adicione ativos acima para acompanhar os preços ao vivo — mesmo sem tê-los na carteira.</p>
                )}

                <p className={`text-[11px] mt-3 ${muted}`}>Cripto via Binance; ações/ETFs/FIIs via brapi. <b>Var</b> e <b>Var%</b> são a variação do dia (24h).</p>
            </div>
        </div>
    );
}

function Modal({ isDark, title, icon: Icon, iconCls = '', onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative w-full max-w-md max-h-[88vh] overflow-y-auto rounded-3xl border shadow-2xl p-6 ${isDark ? 'bg-[#141518] border-white/10' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                        {Icon && <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconCls}`}><Icon className="w-5 h-5" strokeWidth={2.4} /></span>}
                        <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{title}</h2>
                    </div>
                    <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><X className="w-4 h-4" /></button>
                </div>
                {children}
            </div>
        </div>
    );
}
