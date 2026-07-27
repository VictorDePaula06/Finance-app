import React, { useState, useMemo } from 'react';
import {
  BarChart3, Tags, CreditCard, PiggyBank, Download, ChevronLeft,
  Calendar, X, SlidersHorizontal,
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
    const map = {};
    const keyOf = (ds) => {
      if (periodoCfg.bucket === 'mes') {
        const k = ds.slice(0, 7);
        return { key: k, label: new Date(k + '-15').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '') };
      }
      if (periodoCfg.bucket === 'semana') {
        const d = new Date(ds + 'T12:00:00');
        const day = d.getDay();
        const diff = (day === 0 ? -6 : 1) - day; // segunda-feira da semana
        const mon = new Date(d); mon.setDate(d.getDate() + diff);
        const k = dayISO(mon);
        return { key: k, label: dLabel(k) };
      }
      const k = ds.slice(0, 10);
      return { key: k, label: dLabel(k) };
    };
    periodoExpenses.forEach(t => {
      const ds = String(t.date || '').slice(0, 10) || (t.month ? `${t.month}-15` : '');
      if (!ds) return;
      const { key, label } = keyOf(ds);
      if (!map[key]) map[key] = { id: key, label, value: 0 };
      map[key].value += parseFloat(t.amount) || 0;
    });
    return Object.values(map).sort((a, b) => a.id.localeCompare(b.id));
  }, [periodoExpenses, periodoCfg.bucket]);

  const bucketLabel = { dia: 'dia', semana: 'semana', mes: 'mês' }[periodoCfg.bucket];

  // Gastos no cartão (crédito).
  const cardTx = useMemo(() => expenseTx.filter(t => t.paymentMethod === 'credito'), [expenseTx]);
  const totalCard = useMemo(() => cardTx.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0), [cardTx]);

  // Aportes em reservas.
  const reservaTx = useMemo(() =>
    inPeriod.filter(t => t.type === 'expense' && (t.category === 'investment' || t.category === 'vault'))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  , [inPeriod]);
  const totalReserva = useMemo(() => reservaTx.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0), [reservaTx]);

  // Agrupamento por categoria de despesa.
  const expenseByCat = useMemo(() => {
    const map = {};
    expenseTx.forEach(t => { const c = t.category || 'other'; map[c] = (map[c] || 0) + (parseFloat(t.amount) || 0); });
    return Object.entries(map)
      .map(([id, value]) => {
        const def = (CATEGORIES.expense || []).find(c => c.id === id) || { label: 'Outros', id };
        return { id, label: def.label || id, value, hex: categoryHex(def) };
      })
      .sort((a, b) => b.value - a.value);
  }, [expenseTx]);

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
      await generateTablePDF({
        title: 'Gastos por Categoria', subtitle,
        summary: [{ label: 'Total de despesas', value: `R$ ${fmt(totalExpense)}`, color: 'red' }, { label: 'Categorias', value: String(expenseByCat.length), color: 'neutral' }],
        columns: ['Categoria', 'Valor', '%'],
        rows: expenseByCat.map(c => [c.label, `R$ ${fmt(c.value)}`, totalExpense > 0 ? `${((c.value / totalExpense) * 100).toFixed(1)}%` : '0%']),
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

  // ── Gráfico de barras verticais (valor em R$ por período) ──
  const VBars = ({ data }) => {
    if (data.length === 0) return <p className="text-center text-xs text-slate-500 py-10">Nada no período/filtros selecionados.</p>;
    const max = Math.max(...data.map(d => d.value), 0) || 1;
    return (
      <div className="overflow-x-auto custom-scrollbar pb-1">
        <div className="flex items-end gap-3 h-52 pt-6" style={{ minWidth: Math.max(data.length * 52, 260) }}>
          {data.map(d => (
            <div key={d.id} className="flex-1 min-w-[40px] flex flex-col items-center justify-end gap-1.5 h-full">
              <span className="text-[9px] font-black tabular-nums text-indigo-500 whitespace-nowrap">R$ {fmt(d.value)}</span>
              <div className="w-full rounded-t-lg bg-indigo-500 hover:bg-indigo-400 transition-all" style={{ height: `${Math.max(4, (d.value / max) * 150)}px` }} title={`R$ ${fmt(d.value)}`} />
              <span className="text-[9px] font-bold text-slate-500 whitespace-nowrap">{d.label}</span>
            </div>
          ))}
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
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-1.5 px-2 rounded-xl border ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input type="date" value={start} max={end} onChange={e => setStart(e.target.value)} className={`bg-transparent text-xs font-bold py-2 outline-none ${isDark ? 'text-white' : 'text-slate-800'}`} />
            <span className="text-slate-500 text-xs">–</span>
            <input type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} className={`bg-transparent text-xs font-bold py-2 outline-none ${isDark ? 'text-white' : 'text-slate-800'}`} />
          </div>
          {report && (
            <button onClick={handleExport} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95">
              <Download className="w-3.5 h-3.5" /> Exportar
            </button>
          )}
        </div>
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
                <button key={r.id} onClick={() => r.id === 'periodo' ? setPeriodoCfgOpen(true) : setReport(r.id)} className="pat-card p-5 text-left transition-all hover:scale-[1.02] active:scale-95">
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
          {report === 'periodo' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <KPI label="Total gasto" value={periodoTotal} color="#6366f1" sub={`${periodoExpenses.length} lançamento${periodoExpenses.length === 1 ? '' : 's'}`} />
                <KPI label={`Média por ${bucketLabel}`} value={periodoBuckets.length ? periodoTotal / periodoBuckets.length : 0} color="#f59e0b" sub={`${periodoBuckets.length} ${bucketLabel}${periodoBuckets.length === 1 ? '' : 's'}`} />
                <button onClick={() => setPeriodoCfgOpen(true)} className="pat-card p-4 text-left transition-all hover:scale-[1.01]">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1"><SlidersHorizontal className="w-3 h-3" /> Filtros</p>
                  <p className={`text-sm font-black mt-1 capitalize ${isDark ? 'text-white' : 'text-slate-800'}`}>Por {bucketLabel}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                    {[periodoCfg.dinheiro && 'Dinheiro', periodoCfg.pix && 'Pix', periodoCfg.cartao && 'Cartão'].filter(Boolean).join(', ') || 'nenhuma forma'}
                    {periodoCfg.cartao ? (periodoCfg.includeInvoice ? ' · c/ fatura' : ' · s/ fatura') : ''}
                  </p>
                </button>
              </div>
              <div className="pat-card p-5">
                <p className={`text-xs font-black mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>Gasto por {bucketLabel}</p>
                <p className="text-[10px] text-slate-500 mb-2">Valor em reais gasto por {bucketLabel}, conforme os filtros.</p>
                <VBars data={periodoBuckets} />
              </div>
            </>
          )}

          {report === 'categorias' && (
            <div className="pat-card p-5">
              <div className="flex items-center justify-between mb-3">
                <p className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Gasto por categoria</p>
                <span className="text-[11px] font-black tabular-nums text-rose-500">R$ {fmt(totalExpense)}</span>
              </div>
              <Bars data={expenseByCat} total={totalExpense} />
            </div>
          )}

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
          <div onClick={e => e.stopPropagation()} className={`border rounded-[2rem] w-full max-w-lg p-7 space-y-6 relative animate-in zoom-in-95 duration-300 shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
            <button onClick={() => setPeriodoCfgOpen(false)} className={`absolute top-4 right-4 p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><X className="w-5 h-5" /></button>
            <div className="flex items-center gap-3">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}><BarChart3 className="w-5 h-5 text-indigo-500" /></span>
              <div>
                <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Gastos por período</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Configure o relatório antes de gerar</p>
              </div>
            </div>

            {/* Agrupar por */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Agrupar por</label>
              <div className="grid grid-cols-3 gap-2">
                {[['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês']].map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setPeriodoCfg({ ...periodoCfg, bucket: id })}
                    className={`py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all ${periodoCfg.bucket === id ? 'bg-emerald-500 text-white border-emerald-500' : (isDark ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Formas de pagamento */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Formas de pagamento</label>
              <div className="grid grid-cols-3 gap-2">
                {[['dinheiro', 'Dinheiro'], ['pix', 'Pix'], ['cartao', 'Cartão']].map(([id, label]) => {
                  const on = periodoCfg[id];
                  return (
                    <button key={id} type="button" onClick={() => setPeriodoCfg({ ...periodoCfg, [id]: !on })}
                      className={`py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all ${on ? 'bg-emerald-500 text-white border-emerald-500' : (isDark ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cartão: incluir fatura em aberto? */}
            {periodoCfg.cartao && (
              <div className={`rounded-2xl border p-3 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-100 bg-slate-50'}`}>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Compras no cartão — considerar a fatura em aberto?</label>
                <div className="grid grid-cols-2 gap-2">
                  {[[true, 'Sim, incluir'], [false, 'Não']].map(([val, label]) => (
                    <button key={String(val)} type="button" onClick={() => setPeriodoCfg({ ...periodoCfg, includeInvoice: val })}
                      className={`py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all ${periodoCfg.includeInvoice === val ? 'bg-amber-500 text-white border-amber-500' : (isDark ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">A fatura em aberto são as compras no crédito que ainda não foram pagas.</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setPeriodoCfgOpen(false)} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest ${isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Cancelar</button>
              <button
                onClick={() => { setReport('periodo'); setPeriodoCfgOpen(false); }}
                disabled={!periodoCfg.dinheiro && !periodoCfg.pix && !periodoCfg.cartao}
                className="flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <BarChart3 className="w-3.5 h-3.5" /> Gerar relatório
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
