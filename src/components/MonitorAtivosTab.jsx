import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Plus,
  Trash2,
  X,
  RefreshCw,
  Activity,
  Globe,
  Landmark,
  Bitcoin,
  Building2,
  Search,
  AlertCircle,
  LineChart,
  BarChart3
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useUsdRate } from '../utils/marketRates';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';

// Grupos de ativos. Cada um define a fonte de cotação, a moeda nativa e exemplos.
const GROUPS = [
  { id: 'indices',   label: 'Índices',              icon: Activity,   native: 'USD', accent: '#6366f1', placeholder: 'ex: IBOV, SPX500, NASDAQ' },
  { id: 'acoes_int', label: 'Ações Internacionais', icon: Globe,      native: 'USD', accent: '#3b82f6', placeholder: 'ex: NVDA, AMZN, AAPL' },
  { id: 'acoes_br',  label: 'Ações Brasileiras',    icon: Landmark,   native: 'BRL', accent: '#10b981', placeholder: 'ex: PETR4, VALE3, ITUB4' },
  { id: 'cripto',    label: 'Criptomoedas',         icon: Bitcoin,    native: 'USD', accent: '#f59e0b', placeholder: 'ex: BTC, ETH, SOL' },
  { id: 'fiis',      label: 'Fundos Imobiliários',  icon: Building2,  native: 'BRL', accent: '#a855f7', placeholder: 'ex: MXRF11, HGLG11' },
];
const GROUP_BY_ID = Object.fromEntries(GROUPS.map(g => [g.id, g]));

// Apelidos de índices → símbolo Yahoo (cotação) e → símbolo TradingView (gráfico).
const INDEX_ALIASES = {
  IBOV: '^BVSP', IBOVESPA: '^BVSP', BVSP: '^BVSP', IBX: '^BVSP',
  SPX: '^GSPC', SPX500: '^GSPC', SP500: '^GSPC', GSPC: '^GSPC', 'S&P500': '^GSPC',
  NASDAQ: '^IXIC', IXIC: '^IXIC', NASDAQ100: '^NDX', NDX: '^NDX',
  DOW: '^DJI', DJI: '^DJI', DJIA: '^DJI',
  RUSSELL: '^RUT', RUT: '^RUT', VIX: '^VIX',
  FTSE: '^FTSE', DAX: '^GDAXI', CAC: '^FCHI', NIKKEI: '^N225', N225: '^N225', HANGSENG: '^HSI', HSI: '^HSI',
};
const TV_INDEX = {
  IBOV: 'INDEX:IBOV', IBOVESPA: 'INDEX:IBOV', BVSP: 'INDEX:IBOV',
  SPX: 'SP:SPX', SPX500: 'SP:SPX', SP500: 'SP:SPX', GSPC: 'SP:SPX',
  NASDAQ: 'NASDAQ:IXIC', IXIC: 'NASDAQ:IXIC', NASDAQ100: 'NASDAQ:NDX', NDX: 'NASDAQ:NDX',
  DOW: 'DJ:DJI', DJI: 'DJ:DJI', DJIA: 'DJ:DJI',
  VIX: 'CBOE:VIX', RUSSELL: 'TVC:RUT', RUT: 'TVC:RUT',
  FTSE: 'TVC:UKX', DAX: 'XETR:DAX', NIKKEI: 'TVC:NI225', N225: 'TVC:NI225', HANGSENG: 'TVC:HSI', HSI: 'TVC:HSI',
};

// Símbolo qualificado do TradingView (só para o gráfico em modal).
function tvSymbol(ticker, group) {
  const t = (ticker || '').toUpperCase();
  if (t.includes(':')) return t;
  if (group === 'cripto') return `BINANCE:${t}USDT`;
  if (group === 'acoes_br' || group === 'fiis') return `BMFBOVESPA:${t}`;
  if (group === 'indices') return TV_INDEX[t] || (t.startsWith('^') ? t.replace('^', 'INDEX:') : t);
  return t;
}

// Cripto é sempre buscada no navegador (a Binance bloqueia chamadas de servidor, HTTP 451).
async function fetchCryptoClient(items) {
  const out = {};
  await Promise.all(items.map(async ({ ticker }) => {
    try {
      const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${ticker}USDT`);
      if (r.ok) {
        const d = await r.json();
        if (d.lastPrice) out[ticker] = {
          price: +d.lastPrice, change: +d.priceChange, changePercent: +d.priceChangePercent,
          currency: 'USD', logo: `https://assets.coincap.io/assets/icons/${ticker.toLowerCase()}@2x.png`,
        };
      }
    } catch (e) { /* ignora */ }
  }));
  return out;
}

// Fallback client-side para ações/índices/FIIs (localhost ou se /api/quotes falhar).
async function fetchOtherClient(items) {
  const out = {};
  await Promise.all(items.map(async ({ ticker, group }) => {
    try {
      let ysym = ticker;
      if (group === 'indices') ysym = INDEX_ALIASES[ticker] || (ticker.startsWith('^') ? ticker : `^${ticker}`);
      else if ((group === 'acoes_br' || group === 'fiis') && !ticker.includes('.')) ysym = `${ticker}.SA`;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ysym)}?interval=1d&range=2d`;
      const r = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
      if (r.ok) {
        const d = await r.json();
        const meta = d?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice != null) {
          const price = +meta.regularMarketPrice;
          const prev = +(meta.chartPreviousClose || meta.previousClose || price);
          out[ticker] = {
            price, change: price - prev, changePercent: prev ? ((price - prev) / prev) * 100 : 0,
            currency: meta.currency || 'USD',
            logo: group === 'acoes_int' ? `https://financialmodelingprep.com/image-stock/${ticker}.png` : null,
          };
        }
      }
    } catch (e) { /* ignora */ }
  }));
  return out;
}

// Logo do ativo com fallback para um badge de letras.
function AssetLogo({ logo, ticker, accent }) {
  const [err, setErr] = useState(false);
  const letters = ticker.replace('^', '').slice(0, 2);
  if (!logo || err) {
    return (
      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: `${accent}1F`, color: accent }}>
        {letters}
      </div>
    );
  }
  return <img src={logo} alt={ticker} onError={() => setErr(true)} loading="lazy" className="w-7 h-7 rounded-lg object-contain bg-white p-0.5 shrink-0" />;
}

// Widget de gráfico do TradingView (usado só no modal).
function TradingViewChart({ symbol, colorTheme }) {
  const ref = useRef(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = '';
    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    widget.style.height = '100%';
    widget.style.width = '100%';
    host.appendChild(widget);
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol, autosize: true, interval: 'D', timezone: 'America/Sao_Paulo',
      theme: colorTheme, style: '1', locale: 'br', hide_side_toolbar: false,
      allow_symbol_change: true, support_host: 'https://www.tradingview.com',
    });
    host.appendChild(script);
    return () => { host.innerHTML = ''; };
  }, [symbol, colorTheme]);
  return <div className="tradingview-widget-container" ref={ref} style={{ height: '100%', width: '100%' }} />;
}

export default function MonitorAtivosTab() {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const colorTheme = isDark ? 'dark' : 'light';
  const { currentUser } = useAuth();
  const usdHook = useUsdRate();

  const [watchlist, setWatchlist] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [serverUsd, setServerUsd] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [currency, setCurrency] = useState('USD'); // começa em dólar; pode filtrar p/ real
  const [isAdding, setIsAdding] = useState(false);
  const [newGroup, setNewGroup] = useState('acoes_int');
  const [newTicker, setNewTicker] = useState('');
  const [adding, setAdding] = useState(false);
  const [chartAsset, setChartAsset] = useState(null); // { symbol, ticker } | null

  const usdRate = serverUsd || usdHook || 5.0;

  // ── Watchlist (Firestore) ──
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'watchlist'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      setWatchlist(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [currentUser]);

  // ── Buscar cotações ──
  const refresh = useCallback(async (list) => {
    const items = list || watchlist;
    if (!items || items.length === 0) { setQuotes({}); setLastUpdated(new Date()); return; }
    setLoading(true);

    const cryptoItems = items.filter(w => w.group === 'cripto');
    const otherItems = items.filter(w => w.group !== 'cripto');

    const cryptoPromise = cryptoItems.length ? fetchCryptoClient(cryptoItems) : Promise.resolve({});

    const otherPromise = (async () => {
      if (otherItems.length === 0) return {};
      const symbols = otherItems.map(w => w.ticker).join(',');
      const groups = otherItems.map(w => w.group).join(',');
      let data = null;
      try {
        const r = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols)}&groups=${encodeURIComponent(groups)}`);
        if (r.ok) data = await r.json();
      } catch (e) { /* cai no fallback */ }
      if (data && data.quotes && Object.keys(data.quotes).length > 0) {
        if (data.usd) setServerUsd(data.usd);
        // Completa no client os que o servidor não conseguiu (ex.: cripto/edge).
        const missing = otherItems.filter(it => !data.quotes[it.ticker]);
        if (missing.length) {
          const extra = await fetchOtherClient(missing);
          return { ...data.quotes, ...extra };
        }
        return data.quotes;
      }
      return fetchOtherClient(otherItems);
    })();

    const [cryptoQ, otherQ] = await Promise.all([cryptoPromise, otherPromise]);
    setQuotes({ ...otherQ, ...cryptoQ });
    setLastUpdated(new Date());
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist]);

  // Atualiza ao montar / quando a lista muda + auto-refresh a cada 30s.
  useEffect(() => {
    refresh(watchlist);
    if (!watchlist || watchlist.length === 0) return;
    const interval = setInterval(() => refresh(watchlist), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist]);

  const handleAdd = async (e) => {
    e?.preventDefault();
    const ticker = newTicker.trim().toUpperCase();
    if (!ticker) return;
    if (watchlist.some(w => w.ticker === ticker && w.group === newGroup)) {
      setIsAdding(false); setNewTicker(''); return;
    }
    setAdding(true);
    try {
      await addDoc(collection(db, 'watchlist'), {
        ticker, group: newGroup, userId: currentUser.uid, createdAt: Date.now()
      });
      setNewTicker('');
      setIsAdding(false);
    } catch (err) {
      console.error('Erro ao adicionar ativo:', err);
    }
    setAdding(false);
  };

  const handleDelete = async (id) => {
    try { await deleteDoc(doc(db, 'watchlist', id)); } catch (e) { console.error(e); }
  };

  // Converte um valor da moeda nativa do ativo para a moeda de exibição.
  const toDisplay = (value, nativeCur) => {
    if (value == null || !isFinite(value)) return null;
    const native = nativeCur || 'USD';
    if (currency === native) return value;
    if (native === 'USD' && currency === 'BRL') return value * usdRate;
    if (native === 'BRL' && currency === 'USD') return value / usdRate;
    return value;
  };

  const sym = currency === 'BRL' ? 'R$' : 'US$';
  const fmtPrice = (v) => {
    if (v == null) return '—';
    const abs = Math.abs(v);
    const dec = abs > 0 && abs < 1 ? 4 : 2;
    return v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };
  const fmtChange = (v) => {
    if (v == null) return '—';
    return (v >= 0 ? '+' : '') + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const fmtPct = (v) => {
    if (v == null) return '—';
    return (v >= 0 ? '+' : '') + v.toFixed(2).replace('.', ',') + '%';
  };

  const grouped = useMemo(() => {
    return GROUPS.map(g => ({
      ...g,
      items: watchlist.filter(w => w.group === g.id).sort((a, b) => a.ticker.localeCompare(b.ticker)),
    })).filter(g => g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist]);

  const cardBg = isDark ? 'bg-[#1e2330] border-slate-800/60' : 'bg-white border-slate-100 shadow-sm';

  // ── Linha de um ativo (clicável → abre o gráfico) ──
  const renderRow = (item, accent) => {
    const g = GROUP_BY_ID[item.group];
    const q = quotes[item.ticker];
    const native = q?.currency || g?.native || 'USD';
    const price = q ? toDisplay(q.price, native) : null;
    const change = q ? toDisplay(q.change, native) : null;
    const pct = q ? q.changePercent : null;
    const up = (pct ?? 0) >= 0;
    const trendColor = pct == null ? 'text-slate-400' : up ? 'text-emerald-500' : 'text-rose-500';

    return (
      <div
        key={item.id}
        onClick={() => setChartAsset({ symbol: tvSymbol(item.ticker, item.group), ticker: item.ticker })}
        title={`Ver gráfico de ${item.ticker}`}
        className={`group grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'}`}
      >
        {/* Símbolo */}
        <div className="flex items-center gap-2.5 min-w-0">
          <AssetLogo logo={q?.logo} ticker={item.ticker} accent={accent} />
          <span className={`font-bold text-sm truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.ticker}</span>
          <BarChart3 className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          {!q && !loading && (
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0">s/ cotação</span>
          )}
        </div>
        {/* Preço */}
        <div className={`text-right tabular-nums text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'} min-w-[88px]`}>
          {price != null ? `${sym} ${fmtPrice(price)}` : '—'}
        </div>
        {/* Var */}
        <div className={`text-right tabular-nums text-xs font-semibold ${trendColor} min-w-[72px]`}>
          {change != null ? fmtChange(change) : '—'}
        </div>
        {/* Var% */}
        <div className="flex items-center justify-end gap-1.5 min-w-[78px]">
          <span className={`tabular-nums text-xs font-black ${trendColor}`}>{fmtPct(pct)}</span>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
            title="Remover"
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-rose-400 -mr-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Monitor de Ativos</h1>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Cotação e variação do dia em tempo real · clique no ativo para abrir o gráfico</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`inline-flex items-center rounded-xl border p-0.5 ${isDark ? 'bg-slate-900/60 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
            {['USD', 'BRL'].map(c => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
                  currency === c ? 'bg-emerald-500 text-white shadow-sm' : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}
              >
                {c === 'USD' ? 'Dólar' : 'Real'}
              </button>
            ))}
          </div>
          <button
            onClick={() => refresh(watchlist)}
            disabled={loading || watchlist.length === 0}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            title="Atualizar cotações"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
          <button
            onClick={() => { setIsAdding(true); setNewTicker(''); }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black transition-all active:scale-95 shadow-lg shadow-emerald-500/25"
          >
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>
      </div>

      {/* Barra de status */}
      <div className="flex items-center justify-between gap-3 flex-wrap -mt-1">
        <p className="text-[11px] text-slate-500">
          {lastUpdated
            ? <>Atualizado às <span className="font-bold">{lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span> · atualiza sozinho a cada 30s</>
            : 'Carregando cotações…'}
        </p>
        {currency === 'BRL' && (
          <p className="text-[11px] text-slate-500">USD/BRL: <span className="font-bold tabular-nums">R$ {usdRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
        )}
      </div>

      {watchlist.length === 0 ? (
        <div className={`p-12 rounded-2xl border text-center ${cardBg}`}>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-500'}`}>
            <LineChart className="w-7 h-7" />
          </div>
          <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Sua lista está vazia</p>
          <p className="text-sm text-slate-500 mb-4 mt-1 max-w-md mx-auto">Adicione ações, índices, criptomoedas e fundos imobiliários para acompanhar o preço em tempo real.</p>
          <button onClick={() => { setIsAdding(true); setNewTicker(''); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white font-black text-xs hover:bg-emerald-600"><Plus className="w-4 h-4" /> Adicionar ativo</button>
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
          {/* Cabeçalho das colunas */}
          <div className={`grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-2.5 border-b text-[10px] font-black uppercase tracking-widest text-slate-500 ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
            <span>Símbolo</span>
            <span className="text-right min-w-[88px]">Preço</span>
            <span className="text-right min-w-[72px]">Var</span>
            <span className="text-right min-w-[78px] pr-1">Var%</span>
          </div>

          {/* Grupos */}
          <div>
            {grouped.map((g) => {
              const GIcon = g.icon;
              return (
                <div key={g.id}>
                  <div className={`flex items-center gap-2 px-3 py-2 ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50/70'}`}>
                    <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: `${g.accent}1F`, color: g.accent }}>
                      <GIcon className="w-3 h-3" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: g.accent }}>{g.label}</span>
                    <span className="text-[10px] font-bold text-slate-500">{g.items.length}</span>
                  </div>
                  <div className="px-1 py-1">
                    {g.items.map((it) => renderRow(it, g.accent))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Aviso quando há ativos mas nenhuma cotação retornou */}
      {watchlist.length > 0 && !loading && Object.keys(quotes).length === 0 && (
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${isDark ? 'bg-amber-500/[0.07] border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className={`text-xs ${isDark ? 'text-amber-200' : 'text-amber-700'}`}>Não foi possível obter as cotações agora. Verifique os tickers ou tente atualizar em instantes.</p>
        </div>
      )}

      {/* Modal Adicionar */}
      {isAdding && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsAdding(false)}>
          <form onSubmit={handleAdd} onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-2xl p-6 border relative animate-in zoom-in-95 duration-300 shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
            <button type="button" onClick={() => setIsAdding(false)} className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}><X className="w-4 h-4" /></button>

            <div className="flex items-center gap-3 mb-5">
              <div className={`p-2 rounded-xl shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}><Plus className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} /></div>
              <div>
                <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Adicionar ativo</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Escolha o grupo e o ticker</p>
              </div>
            </div>

            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Grupo de ativos</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {GROUPS.map(g => {
                const GIcon = g.icon;
                const sel = newGroup === g.id;
                return (
                  <button
                    type="button"
                    key={g.id}
                    onClick={() => setNewGroup(g.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                      sel
                        ? (isDark ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-emerald-400 bg-emerald-50')
                        : (isDark ? 'border-white/5 bg-white/5 hover:border-white/10' : 'border-slate-100 bg-slate-50 hover:border-slate-200')
                    }`}
                  >
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${g.accent}1F`, color: g.accent }}>
                      <GIcon className="w-3.5 h-3.5" />
                    </span>
                    <span className={`text-[11px] font-bold leading-tight ${sel ? (isDark ? 'text-white' : 'text-slate-800') : (isDark ? 'text-slate-300' : 'text-slate-600')}`}>{g.label}</span>
                  </button>
                );
              })}
            </div>

            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Ticker</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                type="text"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                placeholder={GROUP_BY_ID[newGroup]?.placeholder}
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm font-bold uppercase tracking-wide focus:outline-none transition-all ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-100 text-slate-800 focus:border-emerald-500'}`}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-2 ml-1">Digite só o ticker — o preço atual é buscado automaticamente. {GROUP_BY_ID[newGroup]?.placeholder}</p>

            <div className="flex gap-3 pt-5">
              <button type="button" onClick={() => setIsAdding(false)} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Cancelar</button>
              <button type="submit" disabled={!newTicker.trim() || adding} className="flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] bg-emerald-500 hover:bg-emerald-600 transition-all text-white shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                {adding ? 'Adicionando…' : 'Adicionar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Gráfico */}
      {chartAsset && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setChartAsset(null)}>
          <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-5xl h-[80vh] rounded-2xl border overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
            <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <LineChart className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className={`font-black text-sm truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{chartAsset.ticker}</span>
                <span className="text-[11px] text-slate-500 truncate">{chartAsset.symbol}</span>
              </div>
              <button onClick={() => setChartAsset(null)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <TradingViewChart symbol={chartAsset.symbol} colorTheme={colorTheme} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
