import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  LineChart,
  Settings2,
  BarChart3
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';

// Grupos de ativos (estilo TradingView).
const GROUPS = [
  { id: 'indices',   label: 'Índices',              icon: Activity,  accent: '#6366f1', placeholder: 'ex: IBOV, SPX500, NASDAQ' },
  { id: 'acoes_int', label: 'Ações Internacionais', icon: Globe,     accent: '#3b82f6', placeholder: 'ex: NVDA, AMZN, AAPL' },
  { id: 'acoes_br',  label: 'Ações Brasileiras',    icon: Landmark,  accent: '#10b981', placeholder: 'ex: PETR4, VALE3, ITUB4' },
  { id: 'cripto',    label: 'Criptomoedas',         icon: Bitcoin,   accent: '#f59e0b', placeholder: 'ex: BTC, ETH, SOL' },
  { id: 'fiis',      label: 'Fundos Imobiliários',  icon: Building2, accent: '#a855f7', placeholder: 'ex: MXRF11, HGLG11' },
];
const GROUP_BY_ID = Object.fromEntries(GROUPS.map(g => [g.id, g]));

// Apelidos de índices → símbolo do TradingView.
const TV_INDEX = {
  IBOV: 'INDEX:IBOV', IBOVESPA: 'INDEX:IBOV', BVSP: 'INDEX:IBOV',
  SPX: 'SP:SPX', SPX500: 'SP:SPX', SP500: 'SP:SPX', GSPC: 'SP:SPX',
  NASDAQ: 'NASDAQ:IXIC', IXIC: 'NASDAQ:IXIC', NASDAQ100: 'NASDAQ:NDX', NDX: 'NASDAQ:NDX',
  DOW: 'DJ:DJI', DJI: 'DJ:DJI', DJIA: 'DJ:DJI',
  VIX: 'CBOE:VIX', RUSSELL: 'TVC:RUT', RUT: 'TVC:RUT',
  FTSE: 'TVC:UKX', DAX: 'XETR:DAX', NIKKEI: 'TVC:NI225', N225: 'TVC:NI225', HANGSENG: 'TVC:HSI', HSI: 'TVC:HSI',
};

// Converte (ticker, grupo) no símbolo qualificado do TradingView.
function tvSymbol(ticker, group) {
  const t = (ticker || '').toUpperCase();
  if (t.includes(':')) return t; // usuário já passou EXCHANGE:TICKER
  if (group === 'cripto') return `BINANCE:${t}USDT`;
  if (group === 'acoes_br' || group === 'fiis') return `BMFBOVESPA:${t}`;
  if (group === 'indices') return TV_INDEX[t] || (t.startsWith('^') ? t.replace('^', 'INDEX:') : t);
  return t; // ações internacionais: a TradingView resolve o ticker
}

// Componente genérico que injeta um widget de embed do TradingView.
function TradingViewWidget({ scriptSrc, config, className, style }) {
  const ref = useRef(null);
  const cfgKey = JSON.stringify(config);
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
    script.src = scriptSrc;
    script.async = true;
    script.innerHTML = cfgKey;
    host.appendChild(script);
    return () => { host.innerHTML = ''; };
  }, [scriptSrc, cfgKey]);
  return <div className={`tradingview-widget-container ${className || ''}`} ref={ref} style={style} />;
}

export default function MonitorAtivosTab() {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const { currentUser } = useAuth();
  const colorTheme = isDark ? 'dark' : 'light';

  const [watchlist, setWatchlist] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newGroup, setNewGroup] = useState('acoes_int');
  const [newTicker, setNewTicker] = useState('');
  const [adding, setAdding] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [manageOpen, setManageOpen] = useState(false);
  // Ativo aberto no modal de gráfico: { symbol, ticker } | null
  const [chartAsset, setChartAsset] = useState(null);

  // ── Watchlist (Firestore) ──
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'watchlist'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      setWatchlist(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [currentUser]);

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

  // Agrupa a watchlist por grupo, na ordem de GROUPS.
  const grouped = useMemo(() => {
    return GROUPS.map(g => ({
      ...g,
      items: watchlist.filter(w => w.group === g.id).sort((a, b) => a.ticker.localeCompare(b.ticker)),
    })).filter(g => g.items.length > 0);
  }, [watchlist]);

  // Configuração do widget de lista (Market Quotes) — uma seção por grupo.
  const symbolsGroups = useMemo(() => grouped.map(g => ({
    name: g.label,
    originalName: g.label,
    symbols: g.items.map(it => ({ name: tvSymbol(it.ticker, it.group), displayName: it.ticker })),
  })), [grouped]);

  // Altura do widget para caber todas as linhas sem scroll interno.
  const widgetHeight = useMemo(() => {
    const rows = watchlist.length;
    const groupsCount = grouped.length;
    return Math.max(220, 18 + groupsCount * 46 + rows * 46);
  }, [watchlist.length, grouped.length]);

  const widgetKey = useMemo(
    () => `${colorTheme}-${reloadKey}-${watchlist.map(w => `${w.group}:${w.ticker}`).join('|')}`,
    [colorTheme, reloadKey, watchlist]
  );

  const cardBg = isDark ? 'bg-[#1e2330] border-slate-800/60' : 'bg-white border-slate-100 shadow-sm';

  return (
    <div className="space-y-5 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Monitor de Ativos</h1>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Sua lista de ativos com cotação e variação do dia em tempo real</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {watchlist.length > 0 && (
            <button
              onClick={() => setManageOpen(o => !o)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${manageOpen ? 'bg-emerald-500/15 text-emerald-500' : (isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}`}
              title="Gerenciar lista (ver gráfico / remover)"
            >
              <Settings2 className="w-4 h-4" /> Gerenciar
            </button>
          )}
          <button
            onClick={() => setReloadKey(k => k + 1)}
            disabled={watchlist.length === 0}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            title="Recarregar"
          >
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
          <button
            onClick={() => { setIsAdding(true); setNewTicker(''); }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black transition-all active:scale-95 shadow-lg shadow-emerald-500/25"
          >
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>
      </div>

      {/* Painel Gerenciar — chips: clique abre o gráfico, X remove */}
      {manageOpen && watchlist.length > 0 && (
        <div className={`rounded-2xl border p-4 ${cardBg}`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Seus ativos · clique para ver o gráfico</p>
          <div className="flex flex-wrap gap-2">
            {grouped.flatMap(g => g.items.map(it => (
              <div key={it.id} className={`group inline-flex items-center gap-1.5 pl-2 pr-1 py-1.5 rounded-lg border transition-all ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.accent }} />
                <button
                  type="button"
                  onClick={() => setChartAsset({ symbol: tvSymbol(it.ticker, it.group), ticker: it.ticker })}
                  className={`text-xs font-bold flex items-center gap-1 ${isDark ? 'text-slate-200 hover:text-emerald-400' : 'text-slate-700 hover:text-emerald-600'}`}
                >
                  <BarChart3 className="w-3 h-3 opacity-60" /> {it.ticker}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(it.id)}
                  title="Remover"
                  className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )))}
          </div>
        </div>
      )}

      {watchlist.length === 0 ? (
        // Estado vazio
        <div className={`p-12 rounded-2xl border text-center ${cardBg}`}>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-500'}`}>
            <LineChart className="w-7 h-7" />
          </div>
          <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Sua lista está vazia</p>
          <p className="text-sm text-slate-500 mb-4 mt-1 max-w-md mx-auto">Adicione ações, índices, criptomoedas e fundos imobiliários para acompanhar o preço e a variação do dia em tempo real.</p>
          <button onClick={() => { setIsAdding(true); setNewTicker(''); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white font-black text-xs hover:bg-emerald-600"><Plus className="w-4 h-4" /> Adicionar ativo</button>
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
          <TradingViewWidget
            key={widgetKey}
            scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js"
            config={{
              width: '100%',
              height: widgetHeight,
              symbolsGroups,
              showSymbolLogo: true,
              isTransparent: true,
              colorTheme,
              locale: 'br',
              backgroundColor: isDark ? '#1e2330' : '#ffffff',
            }}
            style={{ height: widgetHeight }}
          />
        </div>
      )}

      {watchlist.length > 0 && (
        <p className="text-[10px] text-slate-500 text-center">
          Cotações fornecidas por{' '}
          <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-500 hover:underline">TradingView</a>
          {' '}· abra o painel <span className="font-bold">Gerenciar</span> para ver o gráfico de cada ativo
        </p>
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

            {/* Grupo */}
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

            {/* Ticker */}
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
            <p className="text-[10px] text-slate-500 mt-2 ml-1">Digite só o ticker. {GROUP_BY_ID[newGroup]?.placeholder}. Para uma bolsa específica, use <span className="font-bold">EXCHANGE:TICKER</span> (ex: NYSE:NU).</p>

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
              <TradingViewWidget
                key={`${chartAsset.symbol}-${colorTheme}`}
                scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
                config={{
                  symbol: chartAsset.symbol,
                  autosize: true,
                  interval: 'D',
                  timezone: 'America/Sao_Paulo',
                  theme: colorTheme,
                  style: '1',
                  locale: 'br',
                  hide_side_toolbar: false,
                  allow_symbol_change: true,
                  support_host: 'https://www.tradingview.com',
                }}
                style={{ height: '100%', width: '100%' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
