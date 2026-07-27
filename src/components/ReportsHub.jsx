import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  BarChart3, Tags, CreditCard, PiggyBank, Download, ChevronLeft,
  Calendar, CalendarDays, CalendarRange, Banknote, Zap, Check, Minus, Info,
  X, SlidersHorizontal, Wallet, TrendingUp, Flame, Target, ChevronDown,
} from 'lucide-react';
import { CATEGORIES, categoryHex } from '../constants/categories';
import { generateTablePDF } from '../utils/generatePDF';
import logo from '../assets/logo.png';

// Relatórios disponíveis.
const REPORTS = [
  { id: 'periodo',    label: 'Gastos por período',  desc: 'Total e evolução dos gastos', icon: BarChart3,  accent: 'rose' },
  { id: 'categorias', label: 'Gastos por categoria', desc: 'Gasto por categoria',        icon: Tags,       accent: 'violet' },
  { id: 'cartao',     label: 'Gastos no cartão',     desc: 'Compras no crédito',         icon: CreditCard, accent: 'amber' },
  { id: 'reservas',   label: 'Aportes em Reservas',  desc: 'Quanto você guardou',        icon: PiggyBank,  accent: 'emerald' },
];

const ACCENT = {
  rose:    { text: 'text-rose-500',    soft: (d) => d ? 'bg-rose-500/10'    : 'bg-rose-50',    ring: '#f43f5e' },
  violet:  { text: 'text-violet-500',  soft: (d) => d ? 'bg-violet-500/10'  : 'bg-violet-50',  ring: '#8b5cf6' },
  amber:   { text: 'text-amber-500',   soft: (d) => d ? 'bg-amber-500/10'   : 'bg-amber-50',   ring: '#f59e0b' },
  emerald: { text: 'text-emerald-500', soft: (d) => d ? 'bg-emerald-500/10' : 'bg-emerald-50', ring: '#10b981' },
};

const INTERNAL_EXPENSE = ['investment', 'vault', 'credit_card_bill'];

const fmt = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dayISO = (d) => d.toISOString().slice(0, 10);
const dLabel = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-'); return d ? `${d}/${m}` : iso; };

export default function ReportsHub({ transactions = [], cards = [], theme = 'dark' }) {
  const isDark = theme !== 'light';
  const [report, setReport] = useState(null);
  // Config do relatório "Gastos por período".
  const [periodoCfgOpen, setPeriodoCfgOpen] = useState(false);
  const [periodoCfg, setPeriodoCfg] = useState({ bucket: 'dia', dinheiro: true, pix: true, cartao: true, includeInvoice: true });
  // Config do relatório "Gastos por categoria".
  const [catCfgOpen, setCatCfgOpen] = useState(false);
  const [catCfg, setCatCfg] = useState({ dinheiro: true, pix: true, cartao: true, includeInvoice: true });

  // Período padrão: mês corrente.
  const now = new Date();
  const [start, setStart] = useState(dayISO(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [end, setEnd] = useState(dayISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)));

  const periodLabel = useMemo(() => {
    const f = (s) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
    return `${f(start)} — ${f(end)}`;
  }, [start, end]);

  const inPeriod = useMemo(() => transactions.filter(t => {
    const d = String(t.date || '').slice(0, 10) || (t.month ? `${t.month}-15` : '');
    return d && d >= start && d <= end;
  }), [transactions, start, end]);

  // Despesas "de consumo" (exclui aportes e pagamento de fatura).
  const expenseTx = useMemo(() =>
    inPeriod.filter(t => t.type === 'expense' && !INTERNAL_EXPENSE.includes(t.category))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  , [inPeriod]);
  const totalExpense = useMemo(() => expenseTx.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0), [expenseTx]);

  // ── Relatório "por período": filtra por forma de pagamento e agrupa por dia/semana/mês ──
  const paySet = useMemo(() => {
    const s = new Set();
    if (periodoCfg.dinheiro) s.add('dinheiro');
    if (periodoCfg.pix) s.add('pix');
    if (periodoCfg.cartao) s.add('credito');
    return s;
  }, [periodoCfg.dinheiro, periodoCfg.pix, periodoCfg.cartao]);

  const periodoExpenses = useMemo(() => expenseTx.filter(t => {
    const pm = t.paymentMethod || 'dinheiro';
    if (!paySet.has(pm)) return false;
    // Cartão sem "incluir fatura em aberto": exclui compras no crédito ainda não pagas.
    if (pm === 'credito' && !periodoCfg.includeInvoice && t.invoiceStatus === 'unpaid') return false;
    return true;
  }), [expenseTx, paySet, periodoCfg.includeInvoice]);
  const periodoTotal = useMemo(() => periodoExpenses.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0), [periodoExpenses]);

  const periodoBuckets = useMemo(() => {
    // Chave do bucket a partir de uma data (YYYY-MM-DD).
    const keyOf = (ds) => {
      if (periodoCfg.bucket === 'mes') return ds.slice(0, 7);
      if (periodoCfg.bucket === 'semana') {
        const d = new Date(ds + 'T12:00:00');
        const day = d.getDay();
        const diff = (day === 0 ? -6 : 1) - day; // segunda-feira da semana
        const mon = new Date(d); mon.setDate(d.getDate() + diff);
        return dayISO(mon);
      }
      return ds.slice(0, 10);
    };
    // Soma os gastos por bucket.
    const sums = {};
    periodoExpenses.forEach(t => {
      const ds = String(t.date || '').slice(0, 10) || (t.month ? `${t.month}-15` : '');
      if (!ds) return;
      const k = keyOf(ds);
      sums[k] = (sums[k] || 0) + (parseFloat(t.amount) || 0);
    });
    // Gera a faixa CONTÍNUA (inclui buckets sem gasto = 0).
    const out = [];
    const s = new Date(start + 'T12:00:00');
    const e = new Date(end + 'T12:00:00');
    if (isNaN(s) || isNaN(e) || s > e) return out;
    if (periodoCfg.bucket === 'mes') {
      let y = s.getFullYear(), m = s.getMonth();
      const ey = e.getFullYear(), em = e.getMonth();
      while (y < ey || (y === ey && m <= em)) {
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        out.push({ id: key, label: new Date(key + '-15').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', ''), value: sums[key] || 0 });
        m++; if (m > 11) { m = 0; y++; }
      }
    } else if (periodoCfg.bucket === 'semana') {
      const cur = new Date(s);
      const day = cur.getDay(); const diff = (day === 0 ? -6 : 1) - day;
      cur.setDate(cur.getDate() + diff);
      while (cur <= e) { const key = dayISO(cur); out.push({ id: key, label: dLabel(key), value: sums[key] || 0 }); cur.setDate(cur.getDate() + 7); }
    } else {
      const cur = new Date(s);
      while (cur <= e) { const key = dayISO(cur); out.push({ id: key, label: dLabel(key), value: sums[key] || 0 }); cur.setDate(cur.getDate() + 1); }
    }
    return out;
  }, [periodoExpenses, periodoCfg.bucket, start, end]);

  const bucketLabel = { dia: 'dia', semana: 'semana', mes: 'mês' }[periodoCfg.bucket];
  const bucketPlural = { dia: 'dias', semana: 'semanas', mes: 'meses' }[periodoCfg.bucket];

  // Gastos no cartão (crédito).
  const cardTx = useMemo(() => expenseTx.filter(t => t.paymentMethod === 'credito'), [expenseTx]);
  const totalCard = useMemo(() => cardTx.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0), [cardTx]);

  // Aportes em reservas.
  const reservaTx = useMemo(() =>
    inPeriod.filter(t => t.type === 'expense' && (t.category === 'investment' || t.category === 'vault'))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  , [inPeriod]);
  const totalReserva = useMemo(() => reservaTx.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0), [reservaTx]);

  // Agrupamento por categoria de despesa (todas as despesas do período).
  const groupByCat = (list) => {
    const map = {};
    list.forEach(t => { const c = t.category || 'other'; map[c] = (map[c] || 0) + (parseFloat(t.amount) || 0); });
    return Object.entries(map)
      .map(([id, value]) => {
        const def = (CATEGORIES.expense || []).find(c => c.id === id) || { label: 'Outros', id };
        return { id, label: def.label || id, value, hex: categoryHex(def) };
      })
      .sort((a, b) => b.value - a.value);
  };
  // ── Relatório "por categoria": filtra por forma de pagamento (config própria) ──
  const catPaySet = useMemo(() => {
    const s = new Set();
    if (catCfg.dinheiro) s.add('dinheiro');
    if (catCfg.pix) s.add('pix');
    if (catCfg.cartao) s.add('credito');
    return s;
  }, [catCfg.dinheiro, catCfg.pix, catCfg.cartao]);
  const catExpenses = useMemo(() => expenseTx.filter(t => {
    const pm = t.paymentMethod || 'dinheiro';
    if (!catPaySet.has(pm)) return false;
    if (pm === 'credito' && !catCfg.includeInvoice && t.invoiceStatus === 'unpaid') return false;
    return true;
  }), [expenseTx, catPaySet, catCfg.includeInvoice]);
  const catTotal = useMemo(() => catExpenses.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0), [catExpenses]);
  const catByCat = useMemo(() => groupByCat(catExpenses), [catExpenses]);

  // Gastos por cartão.
  const cardName = (id) => cards.find(c => c.id === id)?.name || 'Sem cartão';
  const byCard = useMemo(() => {
    const map = {};
    cardTx.forEach(t => { const id = t.selectedCardId || 'none'; map[id] = (map[id] || 0) + (parseFloat(t.amount) || 0); });
    return Object.entries(map).map(([id, value]) => ({ id, label: cardName(id === 'none' ? null : id), value })).sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardTx, cards]);

  // ── Exportar PDF do relatório atual ──
  const handleExport = async () => {
    const subtitle = periodLabel;
    if (report === 'categorias') {
      const pays = [catCfg.dinheiro && 'Dinheiro', catCfg.pix && 'Pix', catCfg.cartao && 'Cartão'].filter(Boolean).join(', ') || '—';
      await generateTablePDF({
        title: 'Gastos por Categoria', subtitle,
        note: `Formas: ${pays}${catCfg.cartao ? (catCfg.includeInvoice ? ' (incluindo fatura em aberto)' : ' (sem fatura em aberto)') : ''}`,
        summary: [{ label: 'Total de despesas', value: `R$ ${fmt(catTotal)}`, color: 'red' }, { label: 'Categorias', value: String(catByCat.length), color: 'neutral' }],
        columns: ['Categoria', 'Valor', '%'],
        rows: catByCat.map(c => [c.label, `R$ ${fmt(c.value)}`, catTotal > 0 ? `${((c.value / catTotal) * 100).toFixed(1)}%` : '0%']),
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'right' } },
      }, logo);
    } else if (report === 'cartao') {
      await generateTablePDF({
        title: 'Gastos no Cartão', subtitle,
        summary: [{ label: 'Total no crédito', value: `R$ ${fmt(totalCard)}`, color: 'amber' }, { label: 'Compras', value: String(cardTx.length), color: 'neutral' }],
        columns: ['Descrição', 'Cartão', 'Valor'],
        rows: cardTx.map(t => [t.description || 'Compra', cardName(t.selectedCardId), `R$ ${fmt(parseFloat(t.amount) || 0)}`]),
        columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
      }, logo);
    } else if (report === 'reservas') {
      await generateTablePDF({
        title: 'Aportes em Reservas', subtitle,
        summary: [{ label: 'Total aportado', value: `R$ ${fmt(totalReserva)}`, color: 'green' }, { label: 'Aportes', value: String(reservaTx.length), color: 'neutral' }],
        columns: ['Descrição', 'Data', 'Valor'],
        rows: reservaTx.map(t => [t.description || 'Aporte', t.date ? new Date(t.date).toLocaleDateString('pt-BR') : '—', `R$ ${fmt(parseFloat(t.amount) || 0)}`]),
        columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
      }, logo);
    } else {
      const pays = [periodoCfg.dinheiro && 'Dinheiro', periodoCfg.pix && 'Pix', periodoCfg.cartao && 'Cartão'].filter(Boolean).join(', ') || '—';
      await generateTablePDF({
        title: 'Gastos por Período', subtitle,
        note: `Agrupado por ${bucketLabel} · Formas: ${pays}${periodoCfg.cartao ? (periodoCfg.includeInvoice ? ' (incluindo fatura em aberto)' : ' (sem fatura em aberto)') : ''}`,
        summary: [
          { label: 'Total gasto', value: `R$ ${fmt(periodoTotal)}`, color: 'red' },
          { label: 'Lançamentos', value: String(periodoExpenses.length), color: 'neutral' },
          { label: `Média/${bucketLabel}`, value: `R$ ${fmt(periodoBuckets.length ? periodoTotal / periodoBuckets.length : 0)}`, color: 'amber' },
        ],
        columns: [`Período (${bucketLabel})`, 'Valor gasto'],
        rows: periodoBuckets.map(b => [b.label, `R$ ${fmt(b.value)}`]),
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      }, logo);
    }
  };

  // ── Barras genéricas (categoria / dia / cartão) ──
  const Bars = ({ data, total, color }) => (
    <div className="space-y-2.5">
      {data.length === 0 ? (
        <p className="text-center text-xs text-slate-500 py-8">Nada no período selecionado.</p>
      ) : data.map(c => {
        const pct = total > 0 ? (c.value / total) * 100 : 0;
        return (
          <div key={c.id}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[13px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{c.label}</span>
              <span className="text-[13px] font-black tabular-nums shrink-0 ml-2" style={{ color: color || c.hex }}>R$ {fmt(c.value)} <span className="text-[10px] text-slate-500">· {pct.toFixed(0)}%</span></span>
            </div>
            <div className={`h-2 w-full rounded-full overflow-hidden ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color || c.hex }} />
            </div>
          </div>
        );
      })}
    </div>
  );

  // Arredonda pra um teto "bonito" (usado na escala do eixo Y).
  const niceCeil = (v) => {
    if (v <= 0) return 100;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return m * p;
  };
  const fmtInt = (v) => Math.round(v).toLocaleString('pt-BR');

  // ── Mini-gráfico (sparkline) para os cartões de KPI ──
  const Sparkline = ({ values, color }) => {
    const vals = (values || []).map(v => v || 0);
    if (vals.length < 2) return null;
    const w = 120, h = 40, mx = Math.max(...vals, 1);
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - (v / mx) * (h - 4) - 2}`);
    return (
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute bottom-0 right-0 w-3/5 h-10 opacity-60 pointer-events-none">
        <path d={`M0,${h} L ${pts.join(' L ')} L ${w},${h} Z`} fill={color} opacity="0.15" />
        <path d={`M ${pts.join(' L ')}`} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  };

  // ── Gráfico de barras com eixo Y, valores e rótulos ──
  const PeriodChart = ({ data }) => {
    const scrollRef = useRef(null);
    const scroll = data.length > 14;
    useEffect(() => { if (scroll && scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth; }, [scroll, data.length]);
    if (data.length === 0) return <p className="text-center text-xs text-slate-500 py-10">Nada no período/filtros selecionados.</p>;
    const rawMax = Math.max(...data.map(d => d.value), 0);
    const stepY = niceCeil((rawMax || 100) / 4);
    const niceMax = stepY * 4 || 100;
    const ticks = [4, 3, 2, 1, 0].map(n => n * stepY); // de cima pra baixo
    const H = 280;
    const slot = 56;
    const stepX = data.length > 24 ? 4 : (data.length > 14 ? 2 : 1);
    return (
      <div className="flex gap-2">
        {/* Eixo Y */}
        <div className="flex flex-col justify-between shrink-0 text-right" style={{ height: H, width: 44 }}>
          {ticks.map((t, i) => <span key={i} className="text-[10px] font-bold text-slate-500 tabular-nums leading-none">{fmtInt(t)}</span>)}
        </div>
        {/* Área do gráfico */}
        <div ref={scrollRef} className={`flex-1 min-w-0 ${scroll ? 'overflow-x-auto custom-scrollbar pb-1' : ''}`}>
          <div style={{ width: scroll ? data.length * slot : '100%' }}>
            {/* plot com gridlines + barras */}
            <div className="relative" style={{ height: H }}>
              {ticks.map((t, i) => (
                <div key={i} className={`absolute left-0 right-0 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`} style={{ top: `${(i / 4) * H}px` }} />
              ))}
              <div className="absolute inset-0 flex items-end gap-2">
                {data.map((d) => (
                  <div key={d.id} className={`flex flex-col items-center justify-end h-full ${scroll ? 'shrink-0' : 'flex-1 min-w-0'}`} style={scroll ? { width: slot } : undefined} title={`${d.label}: R$ ${fmt(d.value)}`}>
                    {d.value > 0 && <span className="text-[10px] font-black tabular-nums text-indigo-400 mb-1 whitespace-nowrap">{fmt(d.value)}</span>}
                    <div className={`w-5 rounded-t-md transition-all ${d.value > 0 ? 'bg-indigo-500 hover:bg-indigo-400' : (isDark ? 'bg-white/5' : 'bg-slate-100')}`} style={{ height: `${d.value > 0 ? Math.max(4, (d.value / niceMax) * H) : 3}px` }} />
                  </div>
                ))}
              </div>
            </div>
            {/* rótulos X */}
            <div className="flex gap-2 mt-2">
              {data.map((d, i) => (
                <div key={d.id} className={`text-center ${scroll ? 'shrink-0' : 'flex-1 min-w-0'}`} style={scroll ? { width: slot } : undefined}>
                  <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">{i % stepX === 0 ? d.label : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Gráfico de pizza (donut) por categoria, interativo ──
  const PieDonut = ({ data, total }) => {
    const [active, setActive] = useState(null);
    if (!data.length || total <= 0) return <p className="text-center text-xs text-slate-500 py-10">Nada no período/filtros selecionados.</p>;
    const size = 220, r = 78, cx = size / 2, cy = size / 2, sw = 30;
    const circ = 2 * Math.PI * r;
    // Junta categorias muito pequenas (<2%) numa fatia "Demais" (não colide com a categoria real "Outros").
    const big = data.filter(d => d.value / total >= 0.02);
    const restVal = total - big.reduce((a, d) => a + d.value, 0);
    const slices = restVal > 0.005 ? [...big, { id: '__demais', label: 'Demais categorias', value: restVal, hex: '#64748b' }] : big;
    let acc = 0;
    const segs = slices.map((d) => {
      const frac = d.value / total;
      const seg = { ...d, frac, offset: acc };
      acc += frac;
      return seg;
    });
    const sel = active != null ? segs[active] : null;
    return (
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90">
            <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={sw} stroke={isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'} />
            {segs.map((d, i) => {
              const on = active === i;
              const dim = active != null && !on;
              const gap = segs.length > 1 ? 0.006 * circ : 0; // respiro entre fatias
              const dash = Math.max(0, d.frac * circ - gap);
              return (
                <circle key={d.id} cx={cx} cy={cy} r={r} fill="none"
                  strokeWidth={on ? sw + 8 : sw}
                  stroke={d.hex}
                  strokeDasharray={`${dash} ${circ - dash}`}
                  strokeDashoffset={-d.offset * circ}
                  style={{ opacity: dim ? 0.3 : 1, transition: 'opacity .2s, stroke-width .2s', cursor: 'pointer' }}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
            {sel ? (
              <>
                <span className="text-[10px] font-black uppercase tracking-widest truncate max-w-full" style={{ color: sel.hex }}>{sel.label}</span>
                <span className={`text-lg font-black tabular-nums ${isDark ? 'text-white' : 'text-slate-800'}`}>R$ {fmt(sel.value)}</span>
                <span className="text-[11px] font-bold text-slate-500">{(sel.frac * 100).toFixed(1)}%</span>
              </>
            ) : (
              <>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total</span>
                <span className={`text-xl font-black tabular-nums ${isDark ? 'text-white' : 'text-slate-800'}`}>R$ {fmt(total)}</span>
              </>
            )}
          </div>
        </div>
        {/* Legenda (hover sincronizado com a pizza) */}
        <div className="flex-1 min-w-0 w-full space-y-0.5 max-h-[240px] overflow-y-auto custom-scrollbar pr-1">
          {segs.map((d, i) => {
            const on = active === i;
            return (
              <div key={d.id}
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-default transition-colors ${on ? (isDark ? 'bg-white/5' : 'bg-slate-100') : ''}`}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.hex }} />
                <span className={`text-[13px] font-bold truncate flex-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{d.label}</span>
                <span className="text-[12px] font-black tabular-nums shrink-0" style={{ color: d.hex }}>R$ {fmt(d.value)}</span>
                <span className="text-[10px] font-bold text-slate-500 tabular-nums shrink-0 w-10 text-right">{(d.frac * 100).toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Lista de lançamentos ──
  const TxList = ({ list, color = '#f43f5e', prefix = '−' }) => (
    list.length === 0 ? (
      <p className="text-center text-xs text-slate-500 py-8">Nenhum lançamento no período.</p>
    ) : (
      <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-100'}`}>
        {list.map(t => {
          const cat = CATEGORIES.expense.find(c => c.id === t.category);
          const hex = categoryHex(cat || {});
          return (
            <div key={t.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: hex }} />
                <div className="min-w-0">
                  <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{t.description || 'Lançamento'}</p>
                  <p className="text-[10px] font-bold text-slate-500">
                    {t.date ? new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : '—'}
                    {t.selectedCardId ? ` · ${cardName(t.selectedCardId)}` : (cat ? ` · ${cat.label}` : '')}
                  </p>
                </div>
              </div>
              <span className="text-sm font-black tabular-nums shrink-0" style={{ color }}>{prefix} R$ {fmt(parseFloat(t.amount) || 0)}</span>
            </div>
          );
        })}
      </div>
    )
  );

  const KPI = ({ label, value, color, sub }) => (
    <div className="pat-card p-4">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="text-2xl font-black tabular-nums mt-1" style={{ color }}>R$ {fmt(value)}</p>
      {sub && <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{sub}</p>}
    </div>
  );

  const meta = report ? REPORTS.find(r => r.id === report) : null;

  return (
    <div className="space-y-5">
      {/* Cabeçalho: título + período + exportar */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {report && (
            <button onClick={() => setReport(null)} className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><ChevronLeft className="w-5 h-5" /></button>
          )}
          <div>
            <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{meta ? meta.label : 'Relatórios'}</h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{meta ? meta.desc : 'Acompanhe análises completas da sua vida financeira'}</p>
          </div>
        </div>
        {report && (
          <div className="flex items-center gap-2 flex-wrap">
            {report !== 'periodo' && report !== 'categorias' && (
              <div className={`flex items-center gap-1.5 px-2 rounded-xl border ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input type="date" value={start} max={end} onChange={e => setStart(e.target.value)} className={`bg-transparent text-xs font-bold py-2 outline-none ${isDark ? 'text-white' : 'text-slate-800'}`} />
                <span className="text-slate-500 text-xs">–</span>
                <input type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} className={`bg-transparent text-xs font-bold py-2 outline-none ${isDark ? 'text-white' : 'text-slate-800'}`} />
              </div>
            )}
            <button onClick={handleExport} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95">
              <Download className="w-3.5 h-3.5" /> Exportar
            </button>
          </div>
        )}
      </div>

      {!report ? (
        /* ── Chooser: escolha o relatório ── */
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Escolha o relatório</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {REPORTS.map(r => {
              const a = ACCENT[r.accent];
              const Icon = r.icon;
              return (
                <button key={r.id} onClick={() => r.id === 'periodo' ? setPeriodoCfgOpen(true) : r.id === 'categorias' ? setCatCfgOpen(true) : setReport(r.id)} className="pat-card p-5 text-left transition-all hover:scale-[1.02] active:scale-95">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${a.soft(isDark)} ${a.text}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{r.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── Relatório selecionado ── */
        <div className="space-y-4">
          {report === 'periodo' && (() => {
            const avg = periodoBuckets.length ? periodoTotal / periodoBuckets.length : 0;
            const sparkVals = periodoBuckets.map(b => b.value);
            const maxBucket = periodoBuckets.reduce((a, b) => (b.value > (a?.value || 0) ? b : a), null);
            const aboveAvg = periodoBuckets.filter(b => b.value > avg && b.value > 0).length;
            const maxPhrase = maxBucket ? ({ dia: `no dia ${maxBucket.label}`, semana: `na semana de ${maxBucket.label}`, mes: `em ${maxBucket.label}` }[periodoCfg.bucket]) : '';
            return (
            <>
              {/* KPIs com ícone + mini-gráfico */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="pat-card p-4 relative overflow-hidden">
                  <Sparkline values={sparkVals} color="#6366f1" />
                  <div className="relative flex items-center gap-3">
                    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}><Wallet className="w-5 h-5 text-indigo-400" /></span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total gasto</p>
                      <p className="text-2xl font-black tabular-nums text-indigo-400 leading-tight">R$ {fmt(periodoTotal)}</p>
                      <p className="text-[11px] text-slate-500">{periodoExpenses.length} lançamento{periodoExpenses.length === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                </div>
                <div className="pat-card p-4 relative overflow-hidden">
                  <Sparkline values={sparkVals} color="#f59e0b" />
                  <div className="relative flex items-center gap-3">
                    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}><TrendingUp className="w-5 h-5 text-amber-500" /></span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Média por {bucketLabel}</p>
                      <p className="text-2xl font-black tabular-nums text-amber-500 leading-tight">R$ {fmt(avg)}</p>
                      <p className="text-[11px] text-slate-500">{periodoBuckets.length} {periodoBuckets.length === 1 ? bucketLabel : bucketPlural}</p>
                    </div>
                  </div>
                </div>
                <button onClick={() => setPeriodoCfgOpen(true)} className="pat-card p-4 text-left transition-all hover:scale-[1.01]">
                  <div className="flex items-center gap-3">
                    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDark ? 'bg-teal-500/10' : 'bg-teal-50'}`}><SlidersHorizontal className="w-5 h-5 text-teal-500" /></span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filtros aplicados</p>
                      <p className={`text-lg font-black capitalize leading-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Por {bucketLabel}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {[periodoCfg.dinheiro && 'Dinheiro', periodoCfg.pix && 'Pix', periodoCfg.cartao && 'Cartão'].filter(Boolean).join(', ') || 'nenhuma forma'}
                        {periodoCfg.cartao ? (periodoCfg.includeInvoice ? ' · c/ fatura' : ' · s/ fatura') : ''}
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Gráfico */}
              <div className="pat-card p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Gasto por {bucketLabel}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Valor em reais gasto por {bucketLabel}, conforme os filtros.</p>
                  </div>
                  <div className="relative shrink-0">
                    <select value={periodoCfg.bucket} onChange={e => setPeriodoCfg({ ...periodoCfg, bucket: e.target.value })}
                      className={`appearance-none pl-3 pr-8 py-2 rounded-xl border text-xs font-bold outline-none cursor-pointer ${isDark ? 'bg-[#161b27] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                      <option value="dia" className={isDark ? 'bg-slate-800 text-white' : ''}>Por Dia</option>
                      <option value="semana" className={isDark ? 'bg-slate-800 text-white' : ''}>Por Semana</option>
                      <option value="mes" className={isDark ? 'bg-slate-800 text-white' : ''}>Por Mês</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                  </div>
                </div>
                <PeriodChart data={periodoBuckets} />
              </div>

              {/* Insights do período */}
              <div className="pat-card p-5">
                <p className={`text-sm font-black mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>Insights do período</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-start gap-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}><BarChart3 className="w-4 h-4 text-emerald-500" /></span>
                    <p className={`text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {maxBucket && maxBucket.value > 0
                        ? <>Seu maior gasto {bucketLabel === 'mês' ? 'mensal' : bucketLabel === 'semana' ? 'semanal' : 'diário'} foi de <span className="font-black text-emerald-500">R$ {fmt(maxBucket.value)}</span> {maxPhrase}.</>
                        : 'Ainda não há gastos no período selecionado.'}
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}><Flame className="w-4 h-4 text-amber-500" /></span>
                    <p className={`text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      Você teve <span className="font-black text-amber-500">{aboveAvg}</span> {aboveAvg === 1 ? (bucketLabel === 'mês' ? 'mês' : bucketLabel) : bucketPlural} com gastos acima da média de <span className="font-black">R$ {fmt(avg)}</span>.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}><Target className="w-4 h-4 text-violet-500" /></span>
                    <p className={`flex-1 text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      Que tal definir um limite {bucketLabel === 'mês' ? 'mensal' : bucketLabel === 'semana' ? 'semanal' : 'diário'} de gastos para manter o controle?
                    </p>
                    <button onClick={() => setPeriodoCfgOpen(true)} className={`shrink-0 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${isDark ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>Definir limite</button>
                  </div>
                </div>
              </div>
            </>
            );
          })()}

          {report === 'categorias' && (() => {
            const top = catByCat[0];
            const top3 = catByCat.slice(0, 3).reduce((a, c) => a + c.value, 0);
            return (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="pat-card p-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}><Wallet className="w-5 h-5 text-rose-500" /></span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total gasto</p>
                      <p className="text-2xl font-black tabular-nums text-rose-500 leading-tight">R$ {fmt(catTotal)}</p>
                      <p className="text-[11px] text-slate-500">{catExpenses.length} lançamento{catExpenses.length === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                </div>
                <div className="pat-card p-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}><Tags className="w-5 h-5 text-violet-500" /></span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Categorias</p>
                      <p className={`text-2xl font-black tabular-nums leading-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{catByCat.length}</p>
                      <p className="text-[11px] text-slate-500">com gasto no período</p>
                    </div>
                  </div>
                </div>
                <button onClick={() => setCatCfgOpen(true)} className="pat-card p-4 text-left transition-all hover:scale-[1.01]">
                  <div className="flex items-center gap-3">
                    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDark ? 'bg-teal-500/10' : 'bg-teal-50'}`}><SlidersHorizontal className="w-5 h-5 text-teal-500" /></span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filtros aplicados</p>
                      <p className={`text-lg font-black leading-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Por categoria</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {[catCfg.dinheiro && 'Dinheiro', catCfg.pix && 'Pix', catCfg.cartao && 'Cartão'].filter(Boolean).join(', ') || 'nenhuma forma'}
                        {catCfg.cartao ? (catCfg.includeInvoice ? ' · c/ fatura' : ' · s/ fatura') : ''}
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Pizza */}
              <div className="pat-card p-5">
                <p className={`text-sm font-black mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>Gasto por categoria</p>
                <p className="text-[10px] text-slate-500 mb-4">Distribuição dos gastos por categoria, conforme os filtros.</p>
                <PieDonut data={catByCat} total={catTotal} />
              </div>

              {/* Insights */}
              <div className="pat-card p-5">
                <p className={`text-sm font-black mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>Insights do período</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-start gap-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}><Flame className="w-4 h-4 text-rose-500" /></span>
                    <p className={`text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {top && top.value > 0
                        ? <>Sua maior categoria é <span className="font-black" style={{ color: top.hex }}>{top.label}</span>, com <span className="font-black">R$ {fmt(top.value)}</span> ({((top.value / catTotal) * 100).toFixed(0)}% do total).</>
                        : 'Ainda não há gastos no período selecionado.'}
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}><BarChart3 className="w-4 h-4 text-amber-500" /></span>
                    <p className={`text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      As <span className="font-black text-amber-500">3 maiores</span> categorias somam <span className="font-black">R$ {fmt(top3)}</span>{catTotal > 0 ? <> ({((top3 / catTotal) * 100).toFixed(0)}% do total)</> : ''}.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}><Target className="w-4 h-4 text-violet-500" /></span>
                    <p className={`flex-1 text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {top ? <>Que tal definir um teto de gastos para <span className="font-black">{top.label}</span>?</> : 'Defina tetos de gasto por categoria para manter o controle.'}
                    </p>
                    <button onClick={() => setCatCfgOpen(true)} className={`shrink-0 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${isDark ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>Definir teto</button>
                  </div>
                </div>
              </div>
            </>
            );
          })()}

          {report === 'cartao' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <KPI label="Total no cartão" value={totalCard} color="#f59e0b" sub={`${cardTx.length} compra${cardTx.length === 1 ? '' : 's'} no crédito`} />
                <div className="pat-card p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Cartões usados</p>
                  <p className={`text-2xl font-black tabular-nums mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{byCard.length}</p>
                </div>
              </div>
              {byCard.length > 0 && (
                <div className="pat-card p-5">
                  <p className={`text-xs font-black mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>Por cartão</p>
                  <Bars data={byCard} total={totalCard} color="#f59e0b" />
                </div>
              )}
              <div className="pat-card p-5">
                <p className={`text-xs font-black mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Compras no crédito</p>
                <TxList list={cardTx} color="#f59e0b" />
              </div>
            </>
          )}

          {report === 'reservas' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <KPI label="Total aportado" value={totalReserva} color="#10b981" sub={`${reservaTx.length} aporte${reservaTx.length === 1 ? '' : 's'} no período`} />
                <div className="pat-card p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Média por aporte</p>
                  <p className="text-2xl font-black tabular-nums mt-1 text-emerald-500">R$ {fmt(reservaTx.length ? totalReserva / reservaTx.length : 0)}</p>
                </div>
              </div>
              <div className="pat-card p-5">
                <p className={`text-xs font-black mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Aportes do período</p>
                <TxList list={reservaTx} color="#10b981" prefix="+" />
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal: configurar o relatório "Gastos por período" */}
      {periodoCfgOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setPeriodoCfgOpen(false)}>
          <div onClick={e => e.stopPropagation()} className={`border rounded-[2rem] w-full max-w-xl p-7 relative animate-in zoom-in-95 duration-300 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
            {/* Cabeçalho — título centralizado + X, no padrão "Novo Ativo" */}
            <div className="relative text-center mb-6">
              <button onClick={() => setPeriodoCfgOpen(false)} className={`absolute top-0 right-0 p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><X className="w-5 h-5" /></button>
              <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Gastos por período</h3>
              <p className="text-[12px] text-slate-500 mt-1">Configure o relatório antes de gerar.</p>
            </div>

            {/* Período */}
            <div className="mb-5">
              <p className={`text-[13px] font-black mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Período</p>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">De</label>
                  <div className={`flex items-center gap-2 px-3 rounded-xl border ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <input type="date" value={start} max={end} onChange={e => setStart(e.target.value)} className={`w-full bg-transparent text-sm font-bold py-2.5 outline-none ${isDark ? 'text-white' : 'text-slate-800'}`} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Até</label>
                  <div className={`flex items-center gap-2 px-3 rounded-xl border ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <input type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} className={`w-full bg-transparent text-sm font-bold py-2.5 outline-none ${isDark ? 'text-white' : 'text-slate-800'}`} />
                  </div>
                </div>
              </div>
            </div>

            {/* Agrupar por — cards com ícone */}
            <div className="mb-5">
              <p className={`text-[13px] font-black mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Agrupar por</p>
              <div className="grid grid-cols-3 gap-2.5">
                {[['dia', 'Dia', CalendarDays], ['semana', 'Semana', CalendarRange], ['mes', 'Mês', Calendar]].map(([id, label, Icon]) => {
                  const sel = periodoCfg.bucket === id;
                  return (
                    <button key={id} type="button" onClick={() => setPeriodoCfg({ ...periodoCfg, bucket: id })}
                      className={`rounded-xl border p-3.5 flex flex-col items-center justify-center gap-1.5 transition-all ${sel ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : (isDark ? 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300')}`}>
                      <Icon className="w-5 h-5" strokeWidth={1.75} />
                      <span className="text-[12px] font-bold">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Formas de pagamento — cards com ícone */}
            <div className="mb-5">
              <p className={`text-[13px] font-black mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Formas de pagamento</p>
              <div className="grid grid-cols-3 gap-2.5">
                {[['dinheiro', 'Dinheiro', Banknote], ['pix', 'Pix', Zap], ['cartao', 'Cartão', CreditCard]].map(([id, label, Icon]) => {
                  const on = periodoCfg[id];
                  return (
                    <button key={id} type="button" onClick={() => setPeriodoCfg({ ...periodoCfg, [id]: !on })}
                      className={`rounded-xl border p-3.5 flex flex-col items-center justify-center gap-1.5 transition-all ${on ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : (isDark ? 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300')}`}>
                      <Icon className="w-5 h-5" strokeWidth={1.75} />
                      <span className="text-[12px] font-bold">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cartão: incluir fatura em aberto? — cards Sim/Não */}
            {periodoCfg.cartao && (
              <div className="mb-5">
                <p className={`text-[13px] font-black mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Compras no cartão: considerar a fatura em aberto?</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {[[true, 'Sim, incluir', Check], [false, 'Não', Minus]].map(([val, label, Icon]) => {
                    const sel = periodoCfg.includeInvoice === val;
                    return (
                      <button key={String(val)} type="button" onClick={() => setPeriodoCfg({ ...periodoCfg, includeInvoice: val })}
                        className={`rounded-xl border p-3 flex items-center justify-center gap-2 transition-all ${sel ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : (isDark ? 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300')}`}>
                        <Icon className="w-4 h-4" strokeWidth={2} />
                        <span className="text-[12px] font-bold">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Caixa de info — padrão emerald da tela "Novo Ativo" */}
            <div className={`flex items-start gap-3 rounded-2xl border p-4 mb-6 ${isDark ? 'bg-emerald-500/[0.06] border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5"><Info className="w-3.5 h-3.5 text-emerald-500" /></span>
              <p className={`text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                O relatório será gerado em <span className="font-black text-emerald-500">barras</span>, mostrando o valor em reais gasto por {bucketLabel}
                {periodoCfg.cartao ? (periodoCfg.includeInvoice ? ', incluindo a fatura em aberto.' : ', sem a fatura em aberto.') : '.'}
              </p>
            </div>

            {/* Rodapé — Cancelar + Gerar (padrão "Salvar Ativo") */}
            <div className="flex gap-3">
              <button onClick={() => setPeriodoCfgOpen(false)} className={`flex-1 py-3.5 rounded-xl text-[13px] font-bold transition-colors ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Cancelar</button>
              <button
                onClick={() => { setReport('periodo'); setPeriodoCfgOpen(false); }}
                disabled={!periodoCfg.dinheiro && !periodoCfg.pix && !periodoCfg.cartao}
                className="flex-1 py-3.5 rounded-xl text-[13px] font-bold bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <BarChart3 className="w-4 h-4" /> Gerar relatório
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: configurar o relatório "Gastos por categoria" */}
      {catCfgOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setCatCfgOpen(false)}>
          <div onClick={e => e.stopPropagation()} className={`border rounded-[2rem] w-full max-w-xl p-7 relative animate-in zoom-in-95 duration-300 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
            <div className="relative text-center mb-6">
              <button onClick={() => setCatCfgOpen(false)} className={`absolute top-0 right-0 p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><X className="w-5 h-5" /></button>
              <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Gastos por categoria</h3>
              <p className="text-[12px] text-slate-500 mt-1">Configure o relatório antes de gerar.</p>
            </div>

            {/* Período */}
            <div className="mb-5">
              <p className={`text-[13px] font-black mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Período</p>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">De</label>
                  <div className={`flex items-center gap-2 px-3 rounded-xl border ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <input type="date" value={start} max={end} onChange={e => setStart(e.target.value)} className={`w-full bg-transparent text-sm font-bold py-2.5 outline-none ${isDark ? 'text-white' : 'text-slate-800'}`} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Até</label>
                  <div className={`flex items-center gap-2 px-3 rounded-xl border ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <input type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} className={`w-full bg-transparent text-sm font-bold py-2.5 outline-none ${isDark ? 'text-white' : 'text-slate-800'}`} />
                  </div>
                </div>
              </div>
            </div>

            {/* Formas de pagamento */}
            <div className="mb-5">
              <p className={`text-[13px] font-black mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Formas de pagamento</p>
              <div className="grid grid-cols-3 gap-2.5">
                {[['dinheiro', 'Dinheiro', Banknote], ['pix', 'Pix', Zap], ['cartao', 'Cartão', CreditCard]].map(([id, label, Icon]) => {
                  const on = catCfg[id];
                  return (
                    <button key={id} type="button" onClick={() => setCatCfg({ ...catCfg, [id]: !on })}
                      className={`rounded-xl border p-3.5 flex flex-col items-center justify-center gap-1.5 transition-all ${on ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : (isDark ? 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300')}`}>
                      <Icon className="w-5 h-5" strokeWidth={1.75} />
                      <span className="text-[12px] font-bold">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cartão: incluir fatura em aberto? */}
            {catCfg.cartao && (
              <div className="mb-5">
                <p className={`text-[13px] font-black mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Compras no cartão: considerar a fatura em aberto?</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {[[true, 'Sim, incluir', Check], [false, 'Não', Minus]].map(([val, label, Icon]) => {
                    const sel = catCfg.includeInvoice === val;
                    return (
                      <button key={String(val)} type="button" onClick={() => setCatCfg({ ...catCfg, includeInvoice: val })}
                        className={`rounded-xl border p-3 flex items-center justify-center gap-2 transition-all ${sel ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : (isDark ? 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300')}`}>
                        <Icon className="w-4 h-4" strokeWidth={2} />
                        <span className="text-[12px] font-bold">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Caixa de info */}
            <div className={`flex items-start gap-3 rounded-2xl border p-4 mb-6 ${isDark ? 'bg-emerald-500/[0.06] border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5"><Info className="w-3.5 h-3.5 text-emerald-500" /></span>
              <p className={`text-[12px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                O relatório será gerado em <span className="font-black text-emerald-500">pizza</span>, mostrando a distribuição dos gastos por categoria
                {catCfg.cartao ? (catCfg.includeInvoice ? ', incluindo a fatura em aberto.' : ', sem a fatura em aberto.') : '.'}
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setCatCfgOpen(false)} className={`flex-1 py-3.5 rounded-xl text-[13px] font-bold transition-colors ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Cancelar</button>
              <button
                onClick={() => { setReport('categorias'); setCatCfgOpen(false); }}
                disabled={!catCfg.dinheiro && !catCfg.pix && !catCfg.cartao}
                className="flex-1 py-3.5 rounded-xl text-[13px] font-bold bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Tags className="w-4 h-4" /> Gerar relatório
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
