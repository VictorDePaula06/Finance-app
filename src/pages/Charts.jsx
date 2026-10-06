import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/LanguageContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import CandleChart from '../components/charts/CandleChart';
import DrawToolbar from '../components/charts/DrawToolbar';
import SymbolPanel from '../components/charts/SymbolPanel';
import SymbolSearch from '../components/charts/SymbolSearch';
import SymbolLogo from '../components/charts/SymbolLogo';
import MaSettings from '../components/charts/MaSettings';
import {
    GROUPS, RANGES, fetchCandles, fetchCryptoQuotes, performance, seasonality,
    readSignal, fmtPrice, fmtPct, pairLabel, exchangeOf,
    viewSpanMs as rangeSpanMs, INTERVALS, INTERVAL_BY_ID, autoIntervalFor, sessionOf,
} from '../utils/marketSeries';
import { openTradeStream } from '../utils/marketStream';
import logo from '../assets/logo.png';
import { usePageApp } from '../utils/pageApp';
import {
    Plus, X, ChevronDown, ArrowLeft, RefreshCw, Loader2, PanelRight, Sun, Moon, Search, Radio,
} from 'lucide-react';

// ── /charts ─────────────────────────────────────────────────────────
// Sala de gráficos no formato do TradingView, montada sobre o que o app já
// tem: a watchlist do usuário (Patrimônio › Monitor de Ativos), /api/quotes e
// /api/history. Tela cheia, sem a sidebar do app.
//
// Colunas: ferramentas · gráfico (cabeçalho + velas + janelas) · lista e
// painel do ativo.

// Referência estável para "sem candles": evita recalcular os derivados a
// cada renderização enquanto a série do ativo novo não chega.
const NO_CANDLES = [];

// Cotações de toda a lista numa chamada. Devolve null quando não deu — aí a
// tela usa o preço derivado dos próprios candles.
async function fetchQuotes(list) {
    if (!list?.length) return null;
    const cripto = list.filter(i => i.group === 'cripto');
    const resto = list.filter(i => i.group !== 'cripto');

    const viaApi = async () => {
        if (!resto.length) return {};
        try {
            const symbols = resto.map(i => i.ticker).join(',');
            const groups = resto.map(i => i.group).join(',');
            const r = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols)}&groups=${encodeURIComponent(groups)}`);
            if (!r.ok) return {};
            const d = await r.json();
            return d.quotes || {};
        } catch {
            return {};
        }
    };

    const [a, b] = await Promise.all([fetchCryptoQuotes(cripto), viaApi()]);
    const merged = { ...a, ...b };
    return Object.keys(merged).length ? merged : null;
}

// Configuração da média móvel: preferência de quem olha, igual para todos os
// ativos, guardada no navegador.
const MA_KEY = 'alivia-charts-ma';
const MA_DEFAULT = { type: 'SMA', period: 60, color: '#2962ff', visible: true };
const loadMa = () => {
    try {
        const raw = JSON.parse(localStorage.getItem(MA_KEY) || 'null');
        return raw ? { ...MA_DEFAULT, ...raw } : MA_DEFAULT;
    } catch {
        return MA_DEFAULT;
    }
};

const drawKey = (ticker) => `alivia-charts-draw:${ticker}`;
const loadDrawings = (ticker) => {
    try { return JSON.parse(localStorage.getItem(drawKey(ticker)) || '[]'); } catch { return []; }
};

export default function Charts() {
    const { currentUser } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { t, locale } = useI18n();
    const navigate = useNavigate();
    const isDark = theme !== 'light';
    const uid = currentUser?.uid;

    // Ícone de velas na aba e manifesto próprio: assim o navegador oferece
    // instalar ESTA tela como um app separado, com atalho e janela próprios.
    usePageApp({
        icon: '/charts-favicon-64.png',
        manifest: '/charts.webmanifest',
        title: 'Gráficos · Alívia Finanças',
    });

    const [items, setItems] = useState([]);
    const [pickedId, setPickedId] = useState(null);
    const [quotes, setQuotes] = useState({});
    const [range, setRange] = useState('1M');
    // 'auto' = segue o padrão da faixa. Escolher no cabeçalho fixa um intervalo.
    const [interval, setInterval_] = useState('auto');
    const [ivOpen, setIvOpen] = useState(false);
    const [live, setLive] = useState({});        // ticker → último negócio
    const [ma, setMa] = useState(loadMa);
    const [maOpen, setMaOpen] = useState(false);
    // As séries guardam a chave do que carregaram: o que está na tela é sempre
    // derivado dela, então nunca aparece o gráfico de um ativo sob o nome de
    // outro enquanto a próxima busca não volta.
    const [series, setSeries] = useState({ key: null, data: [] });
    const [tool, setTool] = useState('cursor');
    const [drawStore, setDrawStore] = useState({});   // ticker → anotações
    const [showDrawings, setShowDrawings] = useState(true);
    const [hover, setHover] = useState(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [groupFilter, setGroupFilter] = useState('all');
    const [filterOpen, setFilterOpen] = useState(false);
    const [extra, setExtra] = useState({ key: null, perf: null, season: null });
    const [clock, setClock] = useState(() => new Date());
    const [panelOpen, setPanelOpen] = useState(false);   // painel direito no celular
    const extraCache = useRef({});
    const liveRef = useRef({});

    const bg = isDark ? 'bg-[#0b0f16]' : 'bg-white';
    const panelBg = isDark ? 'bg-[#0d1117]' : 'bg-slate-50';
    const line = isDark ? 'border-white/[0.07]' : 'border-slate-200';
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const ink = isDark ? 'text-white' : 'text-slate-800';

    // ── Watchlist ───────────────────────────────────────────────────
    useEffect(() => {
        if (!uid) return;
        const q = query(collection(db, 'watchlist'), where('userId', '==', uid));
        return onSnapshot(q, (s) => {
            const list = s.docs.map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => a.ticker.localeCompare(b.ticker));
            setItems(list);
        }, () => { });
    }, [uid]);

    const visible = useMemo(
        () => (groupFilter === 'all' ? items : items.filter(i => i.group === groupFilter)),
        [items, groupFilter]);

    // Seleção derivada: se o escolhido sumiu do filtro, cai no primeiro da
    // lista — sem efeito, sem renderização intermediária com nada marcado.
    const selId = useMemo(
        () => (visible.some(i => i.id === pickedId) ? pickedId : visible[0]?.id ?? null),
        [visible, pickedId]);
    const selected = useMemo(() => visible.find(i => i.id === selId) || null, [visible, selId]);

    // ── Preço ao vivo: cripto pelo WebSocket da Binance ─────────────
    // Chega um evento por negócio fechado. Guardamos num ref e publicamos no
    // máximo dez vezes por segundo: a tela acompanha cada centavo sem repintar
    // a cada mensagem quando o mercado acelera.
    //
    // O despejo é por temporizador, e não por quadro de vídeo: aba em segundo
    // plano (ou qualquer contexto que não pinte) congelaria o preço.
    const cryptoKey = useMemo(
        () => items.filter(i => i.group === 'cripto').map(i => i.ticker).sort().join(','),
        [items]);

    useEffect(() => {
        if (!cryptoKey) return;
        let pendente = false;
        const stop = openTradeStream(cryptoKey.split(','), (tick) => {
            liveRef.current = { ...liveRef.current, [tick.ticker]: tick };
            pendente = true;
        });
        const id = window.setInterval(() => {
            if (!pendente) return;
            pendente = false;
            setLive(liveRef.current);
        }, 100);
        return () => { stop(); window.clearInterval(id); };
    }, [cryptoKey]);

    // ── Cotações do que não tem stream ──────────────────────────────
    // Ação, índice e commodity não têm fluxo público, então consultamos de
    // novo. A cadência sai da SESSÃO informada pelo provedor — pré e pós
    // mercado contam como ativos, senão o preço estendido ficaria parado.
    const anyActive = useMemo(
        () => items.some(i => i.group !== 'cripto' && sessionOf(i.group, quotes[i.ticker]) !== 'closed'),
        [items, quotes]);

    useEffect(() => {
        if (!items.length) return;
        let alive = true;
        const run = () => fetchQuotes(items).then(q => { if (alive && q) setQuotes(q); });
        run();
        const id = window.setInterval(run, anyActive ? 5000 : 60000);
        return () => { alive = false; window.clearInterval(id); };
    }, [items, anyActive]);

    const refreshQuotes = useCallback(() => {
        fetchQuotes(items).then(q => { if (q) setQuotes(q); });
    }, [items]);

    // Aplica o último negócio recebido sobre a cotação. A variação do dia é
    // recalculada a partir da abertura (preço menos variação já embutida).
    const withLive = useCallback((ticker, q) => {
        const tick = live[ticker];
        if (!tick) return q;
        if (!q) return { price: tick.price, change: null, changePercent: null };
        const open = q.price - (q.change ?? 0);
        if (!open || !isFinite(open)) return { ...q, price: tick.price };
        return {
            ...q,
            price: tick.price,
            change: tick.price - open,
            changePercent: ((tick.price - open) / open) * 100,
        };
    }, [live]);

    // ── Candles do ativo selecionado ────────────────────────────────
    const intervalId = interval === 'auto' ? autoIntervalFor(range) : interval;
    const ivCfg = INTERVAL_BY_ID[intervalId];
    const seriesKey = selected ? `${selected.group}:${selected.ticker}:${intervalId}` : null;
    const candles = series.key === seriesKey ? series.data : NO_CANDLES;
    const loading = !!seriesKey && series.key !== seriesKey;

    useEffect(() => {
        if (!seriesKey || !selected) return;
        let alive = true;
        fetchCandles(selected.ticker, selected.group, intervalId).then(c => {
            if (alive) setSeries({ key: seriesKey, data: c });
        });
        return () => { alive = false; };
    }, [seriesKey, selected, intervalId]);

    // Séries auxiliares do painel: diária (desempenho) e mensal (sazonalidade).
    // Buscadas uma vez por ativo e guardadas em cache na sessão.
    const extraKey = selected ? `${selected.group}:${selected.ticker}` : null;
    const perf = extra.key === extraKey ? extra.perf : null;
    const season = extra.key === extraKey ? extra.season : null;

    useEffect(() => {
        if (!extraKey || !selected) return;
        let alive = true;
        const cached = extraCache.current[extraKey];
        const run = cached
            ? Promise.resolve(cached)
            : Promise.all([
                fetchCandles(selected.ticker, selected.group, '1D'),
                fetchCandles(selected.ticker, selected.group, '1M'),
            ]).then(([daily, monthly]) => {
                const data = { perf: performance(daily), season: seasonality(monthly) };
                extraCache.current[extraKey] = data;
                return data;
            });
        run.then(d => { if (alive) setExtra({ key: extraKey, ...d }); });
        return () => { alive = false; };
    }, [extraKey, selected]);

    // ── Anotações por ativo ─────────────────────────────────────────
    // Ficam no localStorage: são do desenho da pessoa naquele navegador, não
    // dado de conta. O mapa em memória evita reler a cada renderização.
    const drawings = useMemo(
        () => (selected ? (drawStore[selected.ticker] ?? loadDrawings(selected.ticker)) : []),
        [selected, drawStore]);

    const saveMa = (next) => {
        setMa(next);
        try { localStorage.setItem(MA_KEY, JSON.stringify(next)); } catch { /* cota cheia */ }
    };

    const saveDrawings = (next) => {
        if (!selected) return;
        setDrawStore(prev => ({ ...prev, [selected.ticker]: next }));
        try { localStorage.setItem(drawKey(selected.ticker), JSON.stringify(next)); } catch { /* cota cheia */ }
    };

    useEffect(() => {
        const id = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    // ── Derivados ───────────────────────────────────────────────────
    // O último negócio também move a vela em formação: fecha, máxima e mínima.
    const liveCandles = useMemo(() => {
        const tick = selected && live[selected.ticker];
        if (!tick || !candles.length || !ivCfg) return candles;
        const last = candles[candles.length - 1];
        if (tick.t < last.t || tick.t >= last.t + ivCfg.ms) return candles;
        return [
            ...candles.slice(0, -1),
            { ...last, c: tick.price, h: Math.max(last.h, tick.price), l: Math.min(last.l, tick.price) },
        ];
    }, [candles, live, selected, ivCfg]);

    const signal = useMemo(() => readSignal(liveCandles), [liveCandles]);
    const legend = hover || (liveCandles.length ? liveCandles[liveCandles.length - 1] : null);
    const legendPrev = useMemo(() => {
        if (!legend || !candles.length) return null;
        const i = candles.findIndex(k => k.t === legend.t);
        return i > 0 ? candles[i - 1] : null;
    }, [legend, candles]);

    const quoteOf = (item) => withLive(item.ticker, quotes[item.ticker] || null);

    // Preço/variação da linha da lista: cotação quando houver, senão o último
    // candle do ativo selecionado (os demais ficam sem número, e a tela diz).
    const rowData = (item) => {
        const q = quoteOf(item);
        if (q) return { price: q.price, change: q.change, pct: q.changePercent };
        if (selected?.id === item.id && candles.length >= 2) {
            const a = candles[candles.length - 2].c;
            const b = candles[candles.length - 1].c;
            return { price: b, change: b - a, pct: a ? ((b - a) / a) * 100 : null };
        }
        return { price: null, change: null, pct: null };
    };

    const selQuote = selected ? (quoteOf(selected) || (() => {
        const d = rowData(selected);
        return d.price == null ? null : { price: d.price, change: d.change, changePercent: d.pct };
    })()) : null;

    // Escolher na pesquisa abre o ativo no gráfico. Se ele ainda não está na
    // lista, entra — é o que a pessoa espera de "selecionei esse".
    const pickSymbol = async (r) => {
        setSearchOpen(false);
        // Já está na lista: é só abrir (o filtro sai do caminho para o ativo
        // escolhido aparecer mesmo que seja de outro grupo).
        const found = items.find(i => i.ticker === r.ticker && i.group === r.group);
        if (found) { setGroupFilter('all'); setPickedId(found.id); return; }
        if (!uid) return;
        try {
            const ref = await addDoc(collection(db, 'watchlist'), {
                ticker: r.ticker, group: r.group, userId: uid, createdAt: Date.now(),
            });
            setGroupFilter('all');
            setPickedId(ref.id);
        } catch (err) { console.error('Erro ao adicionar ativo:', err); }
    };
    const removeSymbol = async (id) => {
        try { await deleteDoc(doc(db, 'watchlist', id)); } catch (e) { console.error(e); }
    };

    const isLive = !!(selected && live[selected.ticker]);
    const tzLabel = useMemo(() => {
        const off = -new Date().getTimezoneOffset() / 60;
        return `UTC${off >= 0 ? '+' : ''}${off}`;
    }, []);

    return (
        <div className={`h-[100dvh] w-full flex flex-col overflow-hidden ${bg}`}>
            <div className="flex-1 flex min-h-0">
                <DrawToolbar
                    isDark={isDark} tool={tool} onTool={setTool}
                    showDrawings={showDrawings} onToggleDrawings={() => setShowDrawings(v => !v)}
                    onClear={() => saveDrawings([])} hasDrawings={drawings.length > 0}
                />

                {/* Coluna do gráfico */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Cabeçalho: ativo · período · OHLC da vela sob o cursor */}
                    <div className={`border-b ${line} px-3 py-2`}>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => navigate('/app/patrimonio')} title={t('charts.backToApp')}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.07]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                                <ArrowLeft className="w-4 h-4" strokeWidth={2.2} />
                            </button>
                            {/* Abaixo de lg o painel vira uma gaveta. */}
                            <button onClick={() => setPanelOpen(true)} title={t('charts.list')}
                                className={`lg:hidden w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.07]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                                <PanelRight className="w-4 h-4" strokeWidth={2.2} />
                            </button>
                            <button onClick={toggleTheme} title={t(isDark ? 'charts.themeLight' : 'charts.themeDark')}
                                aria-label={t(isDark ? 'charts.themeLight' : 'charts.themeDark')}
                                className={`order-last ml-auto w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${isDark ? 'text-slate-400 hover:text-amber-300 hover:bg-white/[0.07]' : 'text-slate-500 hover:text-amber-600 hover:bg-slate-100'}`}>
                                {isDark ? <Sun className="w-4 h-4" strokeWidth={2.2} /> : <Moon className="w-4 h-4" strokeWidth={2.2} />}
                            </button>
                            {selected && (
                                <>
                                    {/* Clicar no nome abre a pesquisa de símbolo. */}
                                    <button onClick={() => setSearchOpen(true)} title={t('charts.searchTitle')}
                                        className={`group inline-flex items-center gap-2 rounded-lg px-1.5 py-0.5 -ml-1 transition ${isDark ? 'hover:bg-white/[0.07]' : 'hover:bg-slate-100'}`}>
                                        <SymbolLogo ticker={selected.ticker} group={selected.group} src={quotes[selected.ticker]?.logo} size={18} />
                                        <span className={`text-[13px] font-bold ${ink}`}>
                                            {pairLabel(selected.ticker, selected.group, quotes[selected.ticker]?.name)}
                                        </span>
                                        <Search className={`w-3 h-3 opacity-0 group-hover:opacity-100 transition ${muted}`} strokeWidth={2.6} />
                                    </button>
                                    <span className={`text-[13px] ${muted}`}>·</span>
                                    {/* Intervalo da vela — escolha independente da faixa. */}
                                    <span className="relative">
                                        <button onClick={() => setIvOpen(v => !v)} title={t('charts.interval')}
                                            className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[13px] font-bold transition ${interval === 'auto'
                                                ? (isDark ? 'text-slate-400 hover:bg-white/[0.07]' : 'text-slate-500 hover:bg-slate-100')
                                                : 'text-emerald-500 bg-emerald-500/10'}`}>
                                            {ivCfg?.label}
                                            <ChevronDown className={`w-3 h-3 transition-transform ${ivOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        {ivOpen && (
                                            <>
                                                <span className="fixed inset-0 z-10" onClick={() => setIvOpen(false)} />
                                                <span className={`absolute z-20 top-full left-0 mt-1 w-28 rounded-xl border shadow-2xl overflow-hidden flex flex-col ${isDark ? 'bg-[#161b26] border-white/10' : 'bg-white border-slate-200'}`}>
                                                    {INTERVALS.map(iv => (
                                                        <button key={iv.id}
                                                            onClick={() => { setInterval_(iv.id); setIvOpen(false); }}
                                                            className={`px-3 py-1.5 text-left text-[12px] font-bold transition ${iv.id === intervalId
                                                                ? 'bg-emerald-500 text-white'
                                                                : (isDark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-slate-600 hover:bg-slate-100')}`}>
                                                            {iv.label}
                                                        </button>
                                                    ))}
                                                </span>
                                            </>
                                        )}
                                    </span>
                                    <span className={`text-[13px] ${muted}`}>·</span>
                                    <span className={`text-[13px] font-bold ${muted}`}>{exchangeOf(selected.group)}</span>
                                    {selQuote?.preMarket && (
                                        <span className={`text-[10px] font-black uppercase tracking-wider ${muted}`}>
                                            {t(selQuote.preMarket.label === 'pre' ? 'charts.preMarket' : 'charts.postMarket')}
                                            <span className={`ml-1 ${(selQuote.preMarket.changePercent ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {`${fmtPrice(selQuote.preMarket.price, locale)} ${fmtPct(selQuote.preMarket.changePercent, locale)}`}
                                            </span>
                                        </span>
                                    )}
                                    {isLive && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-500"
                                            title={t('charts.liveDesc')}>
                                            <Radio className="w-3 h-3 animate-pulse" strokeWidth={2.6} /> {t('charts.live')}
                                        </span>
                                    )}
                                </>
                            )}

                            {legend && (
                                <div className="flex items-center gap-2 text-[11.5px] tabular-nums ml-1 flex-wrap">
                                    {[
                                        [t('charts.open'), legend.o],
                                        [t('charts.high'), legend.h],
                                        [t('charts.low'), legend.l],
                                        [t('charts.close'), legend.c],
                                    ].map(([k, val]) => (
                                        <span key={k} className={muted}>
                                            {k}<span className={`ml-1 font-bold ${legend.c >= legend.o ? 'text-emerald-500' : 'text-rose-500'}`}>{fmtPrice(val, locale)}</span>
                                        </span>
                                    ))}
                                    {ma.visible && (
                                        <button onDoubleClick={() => setMaOpen(true)} onClick={() => setMaOpen(true)}
                                            title={t('charts.maHint')}
                                            className="font-bold rounded px-1 transition hover:opacity-80"
                                            style={{ color: ma.color }}>
                                            {`${ma.type} ${ma.period}`}
                                        </button>
                                    )}
                                    {legendPrev && (
                                        <span className={`font-bold ${legend.c >= legendPrev.c ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {`${legend.c >= legendPrev.c ? '+' : ''}${fmtPrice(legend.c - legendPrev.c, locale)} (${fmtPct(((legend.c - legendPrev.c) / (legendPrev.c || 1)) * 100, locale)})`}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Máxima e mínima da janela visível + atualização */}
                        {signal && (
                            <div className="flex items-center gap-2 mt-2">
                                <span className={`px-2.5 py-1 rounded-md border text-left leading-tight ${isDark ? 'border-emerald-500/25 bg-emerald-500/[0.08]' : 'border-emerald-200 bg-emerald-50'}`}>
                                    <span className="block text-[12px] font-black text-emerald-500 tabular-nums">{fmtPrice(signal.max, locale)}</span>
                                    <span className={`block text-[8.5px] font-black uppercase tracking-wider ${muted}`}>{t('charts.high')}</span>
                                </span>
                                <span className={`px-2.5 py-1 rounded-md border text-left leading-tight ${isDark ? 'border-rose-500/25 bg-rose-500/[0.08]' : 'border-rose-200 bg-rose-50'}`}>
                                    <span className="block text-[12px] font-black text-rose-500 tabular-nums">{fmtPrice(signal.min, locale)}</span>
                                    <span className={`block text-[8.5px] font-black uppercase tracking-wider ${muted}`}>{t('charts.low')}</span>
                                </span>
                                <button onClick={refreshQuotes} title={t('charts.refresh')}
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${isDark ? 'text-slate-400 hover:text-emerald-400 hover:bg-white/[0.07]' : 'text-slate-500 hover:text-emerald-600 hover:bg-slate-100'}`}>
                                    <RefreshCw className="w-3.5 h-3.5" strokeWidth={2.4} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Velas */}
                    <div className="flex-1 min-h-0 relative">
                        <CandleChart
                            candles={liveCandles} isDark={isDark} locale={locale}
                            ma={ma} onMaOpen={() => setMaOpen(true)}
                            tool={tool} drawings={drawings} onDrawingsChange={saveDrawings}
                            showDrawings={showDrawings} onHover={setHover}
                            intervalMs={ivCfg?.ms || 0}
                            viewSpanMs={rangeSpanMs(range)}
                            symbol={selected?.ticker} loading={loading}
                            empty={
                                <div className="text-center px-6">
                                    <p className={`text-[13px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        {items.length ? t('charts.noData') : t('charts.emptyList')}
                                    </p>
                                    <p className={`text-[11.5px] mt-1 ${muted}`}>
                                        {items.length ? t('charts.noDataDesc') : t('charts.emptyListDesc')}
                                    </p>
                                </div>
                            }
                        />
                        {/* Marca d'água */}
                        <div className="absolute left-4 bottom-8 flex items-center gap-2 opacity-25 pointer-events-none">
                            <img src={logo} alt="" className="w-5 h-5 object-contain" />
                            <span className={`text-[13px] font-black tracking-tight ${ink}`}>Alívia Finanças</span>
                        </div>
                    </div>

                    {/* Janelas + relógio */}
                    <div className={`border-t ${line} px-3 py-1.5 flex items-center gap-1 flex-wrap`}>
                        {RANGES.map(r => {
                            const on = range === r.id;
                            return (
                                <button key={r.id} onClick={() => { setRange(r.id); setInterval_('auto'); }}
                                    className={`px-2.5 py-1 rounded-md text-[11.5px] font-bold transition ${on
                                        ? 'bg-emerald-500 text-white'
                                        : (isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.07]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100')}`}>
                                    {r.label}
                                </button>
                            );
                        })}
                        <span className={`ml-auto text-[11.5px] tabular-nums ${muted}`}>
                            {clock.toLocaleTimeString(locale)} {tzLabel}
                        </span>
                    </div>
                </div>

                {/* Lista + painel do ativo */}
                {/* Fundo escurecido da gaveta (só no celular). */}
                {panelOpen && (
                    <div className="lg:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px]"
                        onClick={() => setPanelOpen(false)} aria-hidden="true" />
                )}

                <aside className={`${panelOpen ? 'fixed z-40 inset-y-0 right-0 w-[88%] max-w-[380px] shadow-2xl flex' : 'hidden'} lg:static lg:z-auto lg:flex lg:w-[340px] xl:w-[380px] shrink-0 flex-col border-l ${line} ${panelBg}`}>
                    <button onClick={() => setPanelOpen(false)}
                        className={`lg:hidden absolute top-2 left-2 w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.07]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                        <X className="w-4 h-4" strokeWidth={2.4} />
                    </button>
                    {/* Cabeçalho da lista */}
                    <div className={`px-3 pt-3 pb-2 border-b ${line} ${panelOpen ? 'pl-11 lg:pl-3' : ''}`}>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setFilterOpen(v => !v)}
                                className={`inline-flex items-center gap-1 text-[13px] font-black tracking-tight ${ink}`}>
                                {t('charts.list')}
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filterOpen ? 'rotate-180' : ''} ${muted}`} />
                            </button>
                            <button onClick={() => setSearchOpen(true)} title={t('charts.addSymbol')}
                                className={`ml-auto w-7 h-7 rounded-lg flex items-center justify-center transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.07]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                                <Plus className="w-4 h-4" strokeWidth={2.4} />
                            </button>
                        </div>

                        {filterOpen && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {[['all', t('charts.list')], ...Object.entries(GROUPS).map(([id, g]) => [id, g.label])].map(([id, label]) => (
                                    <button key={id} onClick={() => { setGroupFilter(id); setFilterOpen(false); }}
                                        className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold transition ${groupFilter === id
                                            ? 'bg-emerald-500 text-white'
                                            : (isDark ? 'bg-white/[0.06] text-slate-400 hover:text-white' : 'bg-slate-200 text-slate-500 hover:text-slate-700')}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Cabeçalho das colunas */}
                        <div className={`grid grid-cols-[1fr_auto_auto_auto] gap-3 mt-2.5 text-[10.5px] font-bold ${muted}`}>
                            <span>{t('charts.symbol')}</span>
                            <span className="text-right w-[68px] xl:w-20">{t('charts.price')}</span>
                            <span className="text-right w-[54px] xl:w-16">{t('charts.var')}</span>
                            <span className="text-right w-[50px] xl:w-14">{t('charts.varPct')}</span>
                        </div>
                    </div>

                    {/* Linhas */}
                    <div className="max-h-[42%] overflow-y-auto">
                        {visible.length === 0 ? (
                            <p className={`px-3 py-6 text-center text-[12px] ${muted}`}>{t('charts.emptyListDesc')}</p>
                        ) : visible.map(item => {
                            const d = rowData(item);
                            const on = item.id === selId;
                            const up = (d.pct ?? 0) >= 0;
                            const tone = d.pct == null ? muted : up ? 'text-emerald-500' : 'text-rose-500';
                            return (
                                <div key={item.id} onClick={() => setPickedId(item.id)} role="button" tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter') setPickedId(item.id); }}
                                    className={`group grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-3 py-[7px] cursor-pointer border-l-2 transition ${on
                                        ? (isDark ? 'bg-white/[0.06] border-l-emerald-500' : 'bg-emerald-50 border-l-emerald-500')
                                        : `border-l-transparent ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-100'}`}`}>
                                    <span className="flex items-center gap-2 min-w-0">
                                        <SymbolLogo ticker={item.ticker} group={item.group} src={quotes[item.ticker]?.logo} size={16} />
                                        <span className={`text-[12px] font-bold truncate ${ink}`}>{item.ticker}</span>
                                        <button onClick={(e) => { e.stopPropagation(); removeSymbol(item.id); }}
                                            title={t('charts.remove')}
                                            className={`opacity-0 group-hover:opacity-100 transition shrink-0 ${muted} hover:text-rose-500`}>
                                            <X className="w-3 h-3" strokeWidth={3} />
                                        </button>
                                    </span>
                                    <span className={`text-[12px] font-bold tabular-nums text-right w-[68px] xl:w-20 ${tone}`}>{fmtPrice(d.price, locale)}</span>
                                    <span className={`text-[12px] tabular-nums text-right w-[54px] xl:w-16 ${tone}`}>{d.change == null ? '—' : fmtPrice(d.change, locale)}</span>
                                    <span className={`text-[12px] tabular-nums text-right w-[50px] xl:w-14 ${tone}`}>{fmtPct(d.pct, locale, 2, false)}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Painel do ativo */}
                    <div className={`border-t ${line} flex-1 min-h-0 flex flex-col`}>
                        {selected
                            ? <SymbolPanel isDark={isDark} item={selected} quote={selQuote} candles={liveCandles}
                                perf={perf} season={season} signal={signal}
                                currency={quotes[selected.ticker]?.currency} />
                            : <div className="flex-1 flex items-center justify-center">
                                <Loader2 className={`w-4 h-4 animate-spin ${muted}`} />
                            </div>}
                    </div>
                </aside>
            </div>

            {maOpen && (
                <MaSettings isDark={isDark} value={ma} onChange={saveMa} onClose={() => setMaOpen(false)} />
            )}

            {searchOpen && (
                <SymbolSearch isDark={isDark} current={selected}
                    onPick={pickSymbol} onClose={() => setSearchOpen(false)} />
            )}
        </div>
    );
}
