import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Filter, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Target, AlertTriangle, Sparkles, FileDown, Receipt } from 'lucide-react';
import { CATEGORIES } from '../constants/categories';
import MonthlyReviewModal from './MonthlyReviewModal';
import { generateMonthlyReview } from '../services/gemini';
import { Loader2 } from 'lucide-react';
import aliviaFinal from '../assets/alivia/alivia-final.png';
import { generatePDF } from '../utils/generatePDF';
import logo from '../assets/logo.png';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PALETTE = ['#f43f5e', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ec4899', '#14b8a6', '#eab308', '#64748b'];

export default function PeriodAnalysis({ transactions = [], cards = [], subscriptions = [], theme }) {
  const isDark = theme !== 'light';
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiReviewText, setAiReviewText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const prevMonth = () => { const [y, m] = selectedMonth.split('-').map(Number); setSelectedMonth(new Date(y, m - 2, 1).toISOString().slice(0, 7)); };
  const nextMonth = () => { const [y, m] = selectedMonth.split('-').map(Number); setSelectedMonth(new Date(y, m, 1).toISOString().slice(0, 7)); };
  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  // Fluxo de caixa: só o que saiu da carteira no mês — gastos à vista + pagamentos de fatura.
  // Compras no crédito NÃO entram aqui (são consumo da fatura, vistas em Movimentações Cartões);
  // o que aparece é o pagamento da fatura (credit_card_bill), que é a saída real de dinheiro.
  const expenseItems = useMemo(() => {
    const inMonth = (t) => (t.date?.slice(0, 7) || t.month) === selectedMonth;
    return transactions
      .filter(t => t.type === 'expense' && !['investment', 'vault'].includes(t.category) && t.paymentMethod !== 'credito' && inMonth(t))
      .map(t => ({
        id: t.id,
        description: t.description,
        category: t.category || 'other',
        amount: parseFloat(t.amount) || 0,
        date: t.date,
        kind: t.category === 'credit_card_bill' ? 'fatura' : 'avista',
      }));
  }, [transactions, selectedMonth]);

  const income = useMemo(() => transactions
    .filter(t => t.type === 'income' && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category) && (t.date?.slice(0, 7) || t.month) === selectedMonth)
    .reduce((a, t) => a + (parseFloat(t.amount) || 0), 0), [transactions, selectedMonth]);

  const totalExpense = expenseItems.reduce((a, t) => a + t.amount, 0);
  const balance = income - totalExpense;

  const byCategory = useMemo(() => {
    const map = {};
    expenseItems.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map).sort(([, a], [, b]) => b - a).map(([id, value], i) => ({
      id, value, label: CATEGORIES.expense.find(c => c.id === id)?.label || 'Outro', color: PALETTE[i % PALETTE.length],
    }));
  }, [expenseItems]);

  const topExpenses = useMemo(() => [...expenseItems].sort((a, b) => b.amount - a.amount).slice(0, 8), [expenseItems]);

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const incomeRows = transactions
        .filter(t => t.type === 'income' && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category) && (t.date?.slice(0, 7) || t.month) === selectedMonth)
        .map(t => ({ date: t.date, description: t.description, category: t.category, amount: parseFloat(t.amount) || 0, type: 'income' }));
      const expenseRows = expenseItems.map(t => ({ date: t.date, description: t.description, category: t.category, amount: t.amount, type: 'expense', kind: t.kind }));
      await generatePDF({
        monthKey: selectedMonth,
        monthLabel,
        income,
        expense: totalExpense,
        balance,
        byCategory,
        rows: [...incomeRows, ...expenseRows],
      }, logo);
    }
    catch (e) { console.error(e); alert('Erro ao gerar PDF.'); }
    finally { setIsExportingPDF(false); }
  };
  const handleAI = async () => {
    setIsAnalyzing(true);
    try {
      const review = await generateMonthlyReview(monthLabel, { income, expense: totalExpense, balance, topCategory: byCategory[0]?.id }, {});
      setAiReviewText(review); setIsAIModalOpen(true);
    } catch (e) { console.error(e); } finally { setIsAnalyzing(false); }
  };

  const card = isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';
  const txt = isDark ? 'text-white' : 'text-slate-800';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      {/* COLUNA DE FILTROS */}
      <div className={`p-5 rounded-2xl border h-fit space-y-4 ${card}`}>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-rose-500" />
          <h3 className={`text-sm font-bold uppercase tracking-wider ${txt}`}>Filtros do relatório</h3>
        </div>

        <div>
          <label className={`text-[10px] font-bold uppercase tracking-widest block mb-1.5 ${sub}`}>Mês</label>
          <div className={`flex items-center justify-between rounded-xl border ${isDark ? 'bg-[#161b27] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <button onClick={prevMonth} className="p-2 text-slate-400 hover:text-emerald-400"><ChevronLeft className="w-4 h-4" /></button>
            <span className={`text-[11px] font-bold uppercase capitalize ${txt}`}>{monthLabel}</span>
            <button onClick={nextMonth} className="p-2 text-slate-400 hover:text-emerald-400"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        <p className={`text-[10px] leading-snug px-1 ${sub}`}>
          Fluxo de caixa do mês: tudo que saiu da carteira — gastos à vista e pagamentos de fatura do cartão. As compras no crédito aparecem em Movimentações Cartões.
        </p>

        <div className={`pt-3 mt-1 border-t space-y-2.5 ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
          <div className="flex items-center justify-between"><span className={`text-[11px] ${sub}`}>Ganhos</span><span className="text-sm font-black text-emerald-500">R$ {fmt(income)}</span></div>
          <div className="flex items-center justify-between"><span className={`text-[11px] ${sub}`}>Gastos</span><span className="text-sm font-black text-rose-500">R$ {fmt(totalExpense)}</span></div>
          <div className="flex items-center justify-between"><span className={`text-[11px] ${sub}`}>Resultado</span><span className={`text-sm font-black ${balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>R$ {fmt(balance)}</span></div>
        </div>

        <button onClick={handleExportPDF} disabled={isExportingPDF}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-[11px] uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50">
          {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Exportar PDF
        </button>
      </div>

      {/* RELATÓRIO */}
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Kpi isDark={isDark} icon={TrendingUp} color="text-emerald-500" label="Ganhos" value={`R$ ${fmt(income)}`} />
          <Kpi isDark={isDark} icon={TrendingDown} color="text-rose-500" label="Gastos" value={`R$ ${fmt(totalExpense)}`} />
          <Kpi isDark={isDark} icon={Target} color={balance >= 0 ? 'text-emerald-500' : 'text-rose-500'} label="Resultado" value={`R$ ${fmt(balance)}`} />
        </div>

        {totalExpense === 0 ? (
          <div className={`p-12 rounded-2xl border text-center ${card}`}>
            <Receipt className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className={`font-bold ${txt}`}>Nenhum gasto neste período</p>
            <p className={`text-sm ${sub}`}>Ajuste o mês para ver o fluxo de caixa.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className={`p-5 rounded-2xl border ${card}`}>
                <h4 className={`text-sm font-bold uppercase tracking-wider mb-3 ${txt}`}>Gastos por categoria</h4>
                <div className="w-full h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={byCategory} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} stroke="none">
                        {byCategory.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `R$ ${fmt(v)}`} contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#fff', borderColor: isDark ? '#1e293b' : '#e2e8f0', borderRadius: '12px' }} labelStyle={{ color: isDark ? '#e2e8f0' : '#0f172a' }} itemStyle={{ color: isDark ? '#e2e8f0' : '#0f172a' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className={`p-5 rounded-2xl border ${card}`}>
                <h4 className={`text-sm font-bold uppercase tracking-wider mb-3 ${txt}`}>Detalhamento</h4>
                <div className="space-y-2.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {byCategory.map(c => {
                    const pct = totalExpense > 0 ? (c.value / totalExpense) * 100 : 0;
                    return (
                      <div key={c.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="flex items-center gap-2 text-xs font-bold"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} /><span className={txt}>{c.label}</span></span>
                          <span className={`text-xs font-bold ${txt}`}>R$ {fmt(c.value)} <span className="text-slate-400 font-medium">({pct.toFixed(0)}%)</span></span>
                        </div>
                        <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Maiores gastos */}
            <div className={`p-5 md:p-6 rounded-2xl border ${card}`}>
              <h4 className={`text-sm font-bold uppercase tracking-wider mb-4 ${txt}`}>Maiores gastos</h4>
              <div className="space-y-1">
                {topExpenses.map(t => {
                  const cat = CATEGORIES.expense.find(c => c.id === t.category);
                  return (
                    <div key={t.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.5fr_1fr_auto_1fr] items-center gap-2 py-2.5 text-[12px]">
                      <div className="min-w-0">
                        <p className={`font-medium truncate ${txt}`}>{t.description || 'Sem descrição'}</p>
                        <p className="text-[10px] text-slate-400">{t.date ? new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'}</p>
                      </div>
                      <span className={`hidden sm:inline text-[11px] ${sub}`}>{cat?.label || 'Outro'}</span>
                      <span className={`hidden sm:inline text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${t.kind === 'fatura' ? 'bg-violet-500/15 text-violet-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{t.kind === 'fatura' ? 'Fatura' : 'À vista'}</span>
                      <span className="text-right font-bold text-rose-400 tabular-nums">R$ {fmt(t.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Insight Alívia */}
            {(() => {
              const superfluous = expenseItems.filter(t => CATEGORIES.expense.find(c => c.id === t.category)?.defaultPriority === 'superfluous').reduce((a, t) => a + t.amount, 0);
              let status = 'neutral', msg = '';
              if (income > 0 && totalExpense > income) { status = 'negative'; msg = `Seus gastos (R$ ${fmt(totalExpense)}) superaram as entradas (R$ ${fmt(income)}).`; }
              else if (balance > 0) { status = 'positive'; msg = `Mês positivo! Sobrou R$ ${fmt(balance)}.`; }
              else { status = 'warning'; msg = 'Acompanhe seus gastos para fechar o mês no azul.'; }
              if (byCategory[0]) msg += ` Maior categoria: ${byCategory[0].label} (R$ ${fmt(byCategory[0].value)}).`;
              if (superfluous > 0) msg += ` Supérfluos somaram R$ ${fmt(superfluous)}.`;
              const bg = { positive: isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200', negative: isDark ? 'bg-rose-500/10 border-rose-500/20' : 'bg-rose-50 border-rose-200', warning: isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200', neutral: isDark ? 'bg-slate-500/10 border-slate-500/20' : 'bg-slate-50 border-slate-200' }[status];
              const tc = { positive: 'text-emerald-400', negative: 'text-rose-400', warning: 'text-amber-400', neutral: 'text-slate-400' }[status];
              return (
                <div className={`flex items-start gap-3 p-4 rounded-2xl border ${bg}`}>
                  <img src={aliviaFinal} alt="Alívia" className="w-10 h-10 object-cover rounded-full border-2 border-white/20 shadow-md shrink-0" />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${tc}`}>Alívia</span>
                    <span className={`text-[12px] font-medium leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{msg}</span>
                  </div>
                </div>
              );
            })()}

            <button onClick={handleAI} disabled={isAnalyzing}
              className={`w-full p-4 rounded-2xl border-2 border-dashed transition-all flex items-center justify-center gap-3 group ${isDark ? 'border-white/10 text-blue-400 hover:bg-blue-500/5 hover:border-blue-500/50' : 'border-blue-200 text-blue-500 hover:bg-blue-50 hover:border-blue-400'} ${isAnalyzing ? 'opacity-70 cursor-not-allowed' : ''}`}>
              <div className="p-2 bg-blue-500/10 rounded-xl group-hover:scale-110 transition-transform">{isAnalyzing ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin" /> : <Sparkles className="w-5 h-5 text-blue-500" />}</div>
              <div className="text-left">
                <p className="text-xs font-bold uppercase tracking-widest">{isAnalyzing ? 'Analisando...' : 'Análise Profunda com IA'}</p>
                <p className="text-[9px] font-medium opacity-60">Gerar relatório detalhado com a Alívia</p>
              </div>
            </button>
          </>
        )}
      </div>

      <MonthlyReviewModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} reviewText={aiReviewText} monthName={monthLabel} stats={{ income, expense: totalExpense, balance }} theme={theme} />
    </div>
  );
}

function Kpi({ isDark, icon: Icon, color, label, value }) {
  const card = isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';
  return (
    <div className={`p-4 rounded-2xl border ${card}`}>
      <div className="flex items-center gap-2 mb-1.5"><Icon className={`w-4 h-4 ${color}`} /><span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">{label}</span></div>
      <p className={`text-lg font-black tabular-nums truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}
