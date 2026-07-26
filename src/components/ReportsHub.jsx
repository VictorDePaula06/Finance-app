import React, { useState, useMemo } from 'react';
import {
  BarChart3, Tags, CreditCard, PiggyBank, Download, ChevronLeft,
  Calendar, ArrowDownCircle,
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

  // Gastos no cartão (crédito).
  const cardTx = useMemo(() => expenseTx.filter(t => t.paymentMethod === 'credito'), [expenseTx]);
  const totalCard = useMemo(() => cardTx.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0), [cardTx]);

  // Aportes em reservas.
  const reservaTx = useMemo(() =>
    inPeriod.filter(t => t.type === 'expense' && (t.category === 'investment' || t.category === 'vault'))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  , [inPeriod]);
  const totalReserva = useMemo(() => reservaTx.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0), [reservaTx]);

  // Nº de dias no período (para média).
  const days = useMemo(() => Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000) + 1), [start, end]);

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

  // Gastos por dia (para o relatório por período).
  const byDay = useMemo(() => {
    const map = {};
    expenseTx.forEach(t => { const d = String(t.date || '').slice(0, 10); if (d) map[d] = (map[d] || 0) + (parseFloat(t.amount) || 0); });
    return Object.entries(map).map(([id, value]) => ({ id, label: dLabel(id), value })).sort((a, b) => a.id.localeCompare(b.id));
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
      await generateTablePDF({
        title: 'Gastos por Período', subtitle,
        summary: [
          { label: 'Total de despesas', value: `R$ ${fmt(totalExpense)}`, color: 'red' },
          { label: 'Lançamentos', value: String(expenseTx.length), color: 'neutral' },
          { label: 'Média/dia', value: `R$ ${fmt(totalExpense / days)}`, color: 'amber' },
        ],
        columns: ['Descrição', 'Data', 'Categoria', 'Valor'],
        rows: expenseTx.map(t => [t.description || 'Gasto', t.date ? new Date(t.date).toLocaleDateString('pt-BR') : '—', (CATEGORIES.expense.find(c => c.id === t.category)?.label || 'Outro'), `R$ ${fmt(parseFloat(t.amount) || 0)}`]),
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
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
                <button key={r.id} onClick={() => setReport(r.id)} className="pat-card p-5 text-left transition-all hover:scale-[1.02] active:scale-95">
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
                <KPI label="Total de despesas" value={totalExpense} color="#f43f5e" sub={`${expenseTx.length} lançamento${expenseTx.length === 1 ? '' : 's'}`} />
                <KPI label="Média por dia" value={totalExpense / days} color="#f59e0b" sub={`${days} dia${days === 1 ? '' : 's'} no período`} />
                <div className="pat-card p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Maior categoria</p>
                  <p className={`text-lg font-black truncate mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{expenseByCat[0]?.label || '—'}</p>
                  <p className="text-[11px] text-rose-500 font-bold mt-0.5">{expenseByCat[0] ? `R$ ${fmt(expenseByCat[0].value)}` : ''}</p>
                </div>
              </div>
              <div className="pat-card p-5">
                <p className={`text-xs font-black mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>Gastos por dia</p>
                <Bars data={byDay} total={Math.max(...byDay.map(d => d.value), 0)} color="#f43f5e" />
              </div>
              <div className="pat-card p-5">
                <p className={`text-xs font-black mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Lançamentos do período</p>
                <TxList list={expenseTx} />
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
    </div>
  );
}
