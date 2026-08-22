import React, { useState, useEffect, useMemo, useRef } from 'react';
import AliviaFormHint from '../components/AliviaFormHint';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useLivePrices } from '../hooks/useLivePrices';
import { getUsdRate } from '../utils/marketRates';
import {
    Plus, Pencil, Trash2, X, Loader2, Check, Search, Save,
    Landmark, PieChart as PieIcon, Activity, Bitcoin, TrendingUp, TrendingDown,
    ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numBR = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
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
// Valor atual em BRL = quantidade × preço unitário × câmbio.
const valueOf = (a, prices = {}) => {
    if (a.type === 'renda_fixa') return (parseFloat(a.manualCurrentPrice || a.totalApplied || a.purchasePrice || 0) || 0) * usdMult(a, prices);
    const q = parseFloat(a.quantity || 1) || 1;
    return q * currentUnit(a, prices) * usdMult(a, prices);
};
// Valor investido em BRL = quantidade × preço de compra × câmbio.
const investedOf = (a, prices = {}) => {
    if (a.type === 'renda_fixa') return (parseFloat(a.totalApplied || a.purchasePrice || 0) || 0) * usdMult(a, prices);
    const q = parseFloat(a.quantity || 1) || 1;
    return q * (parseFloat(a.purchasePrice || 0) || 0) * usdMult(a, prices);
};

export default function Patrimonio() {
    const { currentUser } = useAuth();
    const { theme } = useTheme();
    const isDark = theme !== 'light';
    const uid = currentUser?.uid;

    const [investments, setInvestments] = useState([]);
    const [form, setForm] = useState(null);
    const [cur, setCur] = useState(() => (typeof localStorage !== 'undefined' && localStorage.getItem(CUR_KEY)) || 'BRL');
    const [saved, setSaved] = useState(false);
    const [tab, setTab] = useState('renda_fixa');
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!uid) return;
        return onSnapshot(query(collection(db, 'investments'), where('userId', '==', uid)),
            (s) => setInvestments(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    }, [uid]);

    // Cotações ao vivo (cripto/ações/ETFs/FIIs + câmbio USD).
    const { livePrices } = useLivePrices(investments, true);

    const total = useMemo(() => investments.reduce((a, x) => a + valueOf(x, livePrices), 0), [investments, livePrices]);
    const totalInvestido = useMemo(() => investments.reduce((a, x) => a + investedOf(x, livePrices), 0), [investments, livePrices]);
    const lucro = total - totalInvestido;
    const rentabilidade = totalInvestido > 0 ? (lucro / totalInvestido) * 100 : 0;

    const byGroup = useMemo(() => {
        const m = {}; GROUP_IDS.forEach(g => m[g] = 0);
        investments.forEach(a => { m[getGroup(a.type)] += valueOf(a, livePrices); });
        return m;
    }, [investments, livePrices]);

    const classes = useMemo(() => GROUP_IDS
        .map(gid => ({ id: gid, ...GROUP_META[gid], value: byGroup[gid], pct: total ? byGroup[gid] / total * 100 : 0 }))
        .filter(c => c.value > 0).sort((a, b) => b.value - a.value),
        [byGroup, total]);

    const assetsInTab = useMemo(() => investments
        .filter(a => getGroup(a.type) === tab)
        .filter(a => (a.name || '').toLowerCase().includes(search.trim().toLowerCase()) || (a.symbol || '').toLowerCase().includes(search.trim().toLowerCase()))
        .sort((a, b) => valueOf(b, livePrices) - valueOf(a, livePrices)),
        [investments, tab, search, livePrices]);

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
                        <div className="overflow-x-auto">
                            {assetsInTab.map((a, i) => {
                                const color = GROUP_META[getGroup(a.type)].color;
                                const market = isMarket(a.type);
                                const inv = investedOf(a, livePrices), val = valueOf(a, livePrices);
                                const q = parseFloat(a.quantity || 1) || 1;
                                const precoBRL = market && q > 0 ? val / q : val;
                                const r = inv > 0 ? (val - inv) / inv * 100 : 0;
                                const lucro = val - inv;
                                const up = r >= 0;
                                const Arrow = up ? ArrowUpRight : ArrowDownRight;
                                const posCls = up ? 'text-emerald-500' : 'text-rose-500';
                                return (
                                    <div key={a.id} className={`group flex items-center gap-4 px-4 py-3 min-w-[680px] ${i ? `border-t ${isDark ? 'border-white/5' : 'border-slate-100'}` : ''}`}>
                                        {/* Ticker + nome */}
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-[14px]" style={{ background: `${color}1f`, color }}>
                                                {(a.symbol || a.name || '?').charAt(0).toUpperCase()}
                                            </span>
                                            <div className="min-w-0">
                                                <p className={`font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{a.symbol ? a.symbol.toUpperCase() : (a.name || 'Ativo')}</p>
                                                <p className="text-[11px] truncate" style={{ color }}>{a.symbol ? (a.name || typeMeta(a.type).label) : typeMeta(a.type).label}</p>
                                            </div>
                                        </div>
                                        {market && <Col isDark={isDark} label="Preço" value={fmt(precoBRL)} cls={isDark ? 'text-slate-200' : 'text-slate-700'} w="w-24" />}
                                        {market && <Col isDark={isDark} label="Qtd" value={String(a.quantity ?? 1)} cls={isDark ? 'text-slate-200' : 'text-slate-700'} w="w-14" />}
                                        <Col isDark={isDark} label="Valor atual" value={fmt(val)} cls={isDark ? 'text-white' : 'text-slate-800'} w="w-28" />
                                        <Col isDark={isDark} label="Rent." w="w-24" value={<span className={`inline-flex items-center gap-0.5 ${posCls}`}><Arrow className="w-3 h-3" />{up ? '+' : ''}{r.toFixed(2)}%</span>} />
                                        <Col isDark={isDark} label="Lucro/Perda" w="w-28" value={<span className={`inline-flex items-center gap-0.5 ${lucro >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}><Arrow className="w-3 h-3" />{lucro >= 0 ? '+ ' : '− '}{fmt(Math.abs(lucro))}</span>} />
                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                                            <button onClick={() => setForm({ editing: a })} title="Editar" className={`p-1.5 rounded-lg ${muted} ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}><Pencil className="w-3.5 h-3.5" /></button>
                                            <DeleteBtn isDark={isDark} onDelete={() => deleteDoc(doc(db, 'investments', a.id))} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                {(livePrices.USD) && <p className={`text-[11px] mt-2 text-right ${muted}`}>Cotações ao vivo · dólar R$ {money(rate)}</p>}
            </div>

            {form && <AtivoForm isDark={isDark} uid={uid} editing={form.editing} onClose={() => setForm(null)} />}
        </div>
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
export function AtivoForm({ isDark, uid, editing, onClose, hint, allowAddAnother = false }) {
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

    useEffect(() => { getUsdRate().then(r => { if (r) setUsdRate(r); }).catch(() => { }); }, []);

    const market = isMarket(type);
    const inputCls = `w-full px-3.5 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;
    const optStyle = { backgroundColor: isDark ? '#17181b' : '#ffffff', color: isDark ? '#e2e8f0' : '#1e293b' };

    const qty = numBR(quantity) || 0;
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
        if (!name.trim()) { setError('Informe o nome do ativo.'); return; }
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
            data = { name: normalizeName(name), type, symbol: '', quantity: 1, purchasePrice: inv, manualCurrentPrice: val, isUSD, ...(type === 'renda_fixa' ? { totalApplied: inv } : {}) };
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
                <Field label="Nome do ativo"><input value={name} onChange={e => setName(e.target.value)} placeholder={market ? 'Ex.: Petrobras, Bitcoin' : 'Ex.: Tesouro Selic 2029'} className={inputCls} maxLength={40} autoFocus /></Field>

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
                                <input value={symbol} onChange={e => { setSymbol(e.target.value.toUpperCase()); setFetchMsg(''); }} placeholder="TICKER" className={inputCls} maxLength={10} />
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
