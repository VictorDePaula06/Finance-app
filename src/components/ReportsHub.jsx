import React, { useState, useMemo } from 'react';
import {
  PieChart, TrendingUp, TrendingDown, Tags, Download, ChevronLeft,
  Wallet, Calendar, ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react';
import { CATEGORIES, categoryHex } from '../constants/categories';
import { generateTablePDF } from '../utils/generatePDF';
import logo from '../assets/logo.png';

// Relatórios disponíveis — sem Investimentos e sem Patrimônio.
const REPORTS = [
  { id: 'visao',      label: 'Visão Geral', desc: 'Panorama da sua vida financeira', icon: PieChart,     accent: 'teal' },
  { id: 'receitas',   label: 'Receitas',    desc: 'Análise das suas entradas',       icon: TrendingUp,   accent: 'emerald' },
  { id: 'despesas',   label: 'Despesas',    desc: 'Análise dos seus gastos',         icon: TrendingDown, accent: 'rose' },
  { id: 'categorias', label: 'Categorias',  desc: 'Gasto por categoria',             icon: Tags,         accent: 'violet' },
];

const ACCENT = {
  teal:    { text: 'text-teal-500',    soft: (d) => d ? 'bg-teal-500/10'    : 'bg-teal-50',    ring: '#14b8a6' },
  emerald: { text: 'text-emerald-500', soft: (d) => d ? 'bg-emerald-500/10' : 'bg-emerald-50', ring: '#10b981' },
  rose:    { text: 'text-rose-500',    soft: (d) => d ? 'bg-rose-500/10'    : 'bg-rose-50',    ring: '#f43f5e' },
  violet:  { text: 'text-violet-500',  soft: (d) => d ? 'bg-violet-500/10'  : 'bg-violet-50',  ring: '#8b5cf6' },
};

const INTERNAL_INCOME = ['initial_balance', 'carryover', 'vault_redemption'];
const INTERNAL_EXPENSE = ['investment', 'vault', 'credit_card_bill'];

const fmt = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dayISO = (d) => d.toISOString().slice(0, 10);

export default function ReportsHub({ transactions = [], theme = 'dark' }) {
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

  const incomeTx = useMemo(() => inPeriod.filter(t => t.type === 'income' && !INTERNAL_INCOME.includes(t.category)), [inPeriod]);
  const expenseTx = useMemo(() => inPeriod.filter(t => t.type === 'expense' && !INTERNAL_EXPENSE.includes(t.category)), [inPeriod]);

  const totalIncome = useMemo(() => incomeTx.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0), [incomeTx]);
  const totalExpense = useMemo(() => expenseTx.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0), [expenseTx]);
  const saldo = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (saldo / totalIncome) * 100 : 0;

  // Agrupamento por categoria.
  const byCategory = (list, group) => {
    const map = {};
    list.forEach(t => { const c = t.category || 'other'; map[c] = (map[c] || 0) + (parseFloat(t.amount) || 0); });
    return Object.entries(map)
      .map(([id, value]) => {
        const def = (CATEGORIES[group] || []).find(c => c.id === id) || { label: 'Outros', id };
        return { id, label: def.label || id, value, hex: categoryHex(def) };
      })
      .sort((a, b) => b.value - a.value);
  };
  const expenseByCat = useMemo(() => byCategory(expenseTx, 'expense'), [expenseTx]);
  const incomeByCat = useMemo(() => byCategory(incomeTx, 'income'), [incomeTx]);

  const priority = useMemo(() => {
    const p = { essential: 0, comfort: 0, superfluous: 0 };
    expenseTx.forEach(t => { p[t.priority] = (p[t.priority] || 0) + (parseFloat(t.amount) || 0); });
    return p;
  }, [expenseTx]);

  // ── Exportar PDF do relatório atual ──
  const handleExport = async () => {
    const subtitle = periodLabel;
    const meta = REPORTS.find(r => r.id === report);
    if (report === 'receitas') {
      await generateTablePDF({
        title: 'Relatório de Receitas', subtitle,
        summary: [{ label: 'Total de receitas', value: `R$ ${fmt(totalIncome)}`, color: 'green' }, { label: 'Lançamentos', value: String(incomeTx.length), color: 'neutral' }],
        columns: ['Origem', 'Valor'],
        rows: incomeByCat.map(c => [c.label, `R$ ${fmt(c.value)}`]),
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      }, logo);
    } else if (report === 'despesas' || report === 'categorias') {
      await generateTablePDF({
        title: report === 'categorias' ? 'Gastos por Categoria' : 'Relatório de Despesas', subtitle,
        summary: [{ label: 'Total de despesas', value: `R$ ${fmt(totalExpense)}`, color: 'red' }, { label: 'Categorias', value: String(expenseByCat.length), color: 'neutral' }],
        columns: ['Categoria', 'Valor', '%'],
        rows: expenseByCat.map(c => [c.label, `R$ ${fmt(c.value)}`, totalExpense > 0 ? `${((c.value / totalExpense) * 100).toFixed(1)}%` : '0%']),
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'right' } },
      }, logo);
    } else {
      await generateTablePDF({
        title: 'Visão Geral', subtitle,
        summary: [
          { label: 'Receitas', value: `R$ ${fmt(totalIncome)}`, color: 'green' },
          { label: 'Despesas', value: `R$ ${fmt(totalExpense)}`, color: 'red' },
          { label: 'Saldo', value: `R$ ${fmt(saldo)}`, color: saldo >= 0 ? 'blue' : 'amber' },
        ],
        columns: ['Categoria de gasto', 'Valor', '%'],
        rows: expenseByCat.map(c => [c.label, `R$ ${fmt(c.value)}`, totalExpense > 0 ? `${((c.value / totalExpense) * 100).toFixed(1)}%` : '0%']),
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'right' } },
      }, logo);
    }
    void meta;
  };

  const inputCls = `px-3 py-2 rounded-xl border text-xs font-bold outline-none transition-colors ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 focus:border-emerald-500'}`;

  // ── Barra de categoria ──
  const CatBars = ({ data, total, color }) => (
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

  const KPI = ({ label, value, color, icon: Icon }) => (
    <div className="pat-card p-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</span>
        {Icon && <Icon className="w-4 h-4" style={{ color }} />}
      </div>
      <p className="text-2xl font-black tabular-nums" style={{ color }}>R$ {fmt(value)}</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Cabeçalho: título + período + exportar */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {report && (
            <button onClick={() => setReport(null)} className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><ChevronLeft className="w-5 h-5" /></button>
          )}
          <div>
            <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{report ? REPORTS.find(r => r.id === report)?.label : 'Relatórios'}</h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{report ? REPORTS.find(r => r.id === report)?.desc : 'Acompanhe análises completas da sua vida financeira'}</p>
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
          {report === 'visao' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KPI label="Receitas" value={totalIncome} color="#10b981" icon={ArrowUpCircle} />
                <KPI label="Despesas" value={totalExpense} color="#f43f5e" icon={ArrowDownCircle} />
                <KPI label="Saldo" value={saldo} color={saldo >= 0 ? '#3b82f6' : '#f59e0b'} icon={Wallet} />
                <div className="pat-card p-4">
                  <div className="flex items-center justify-between mb-1.5"><span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Taxa de poupança</span><PieChart className="w-4 h-4 text-teal-500" /></div>
                  <p className="text-2xl font-black tabular-nums text-teal-500">{savingsRate.toFixed(0)}%</p>
                </div>
              </div>
              <div className="pat-card p-5">
                <p className={`text-xs font-black mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>Para onde foi o dinheiro</p>
                <CatBars data={expenseByCat} total={totalExpense} />
              </div>
            </>
          )}

          {report === 'receitas' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <KPI label="Total de receitas" value={totalIncome} color="#10b981" icon={ArrowUpCircle} />
                <div className="pat-card p-4">
                  <div className="flex items-center justify-between mb-1.5"><span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Lançamentos</span><TrendingUp className="w-4 h-4 text-emerald-500" /></div>
                  <p className={`text-2xl font-black tabular-nums ${isDark ? 'text-white' : 'text-slate-800'}`}>{incomeTx.length}</p>
                </div>
              </div>
              <div className="pat-card p-5">
                <p className={`text-xs font-black mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>Receitas por origem</p>
                <CatBars data={incomeByCat} total={totalIncome} color="#10b981" />
              </div>
            </>
          )}

          {report === 'despesas' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KPI label="Total de despesas" value={totalExpense} color="#f43f5e" icon={ArrowDownCircle} />
                <KPI label="Essenciais" value={priority.essential} color="#3b82f6" />
                <KPI label="Conforto" value={priority.comfort} color="#f59e0b" />
                <KPI label="Supérfluos" value={priority.superfluous} color="#f43f5e" />
              </div>
              <div className="pat-card p-5">
                <p className={`text-xs font-black mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>Despesas por categoria</p>
                <CatBars data={expenseByCat} total={totalExpense} />
              </div>
            </>
          )}

          {report === 'categorias' && (
            <div className="pat-card p-5">
              <div className="flex items-center justify-between mb-3">
                <p className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Gasto por categoria</p>
                <span className="text-[11px] font-black tabular-nums text-rose-500">R$ {fmt(totalExpense)}</span>
              </div>
              <CatBars data={expenseByCat} total={totalExpense} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
