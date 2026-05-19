import React, { useState, useMemo, useEffect } from 'react';
import ExpensesChart from './ExpensesChart';
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Sparkles, Target, AlertTriangle, ArrowUpRight, ArrowDownRight, PieChart, CreditCard, RefreshCw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { CATEGORIES } from '../constants/categories';
import MonthlyReviewModal from './MonthlyReviewModal';
import { generateMonthlyReview } from '../services/gemini';
import { Loader2 } from 'lucide-react';
import aliviaFinal from '../assets/alivia/alivia-final.png';

const AnalysisTab = ({ transactions, cards = [], subscriptions = [] }) => {
  const { theme } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [includeCredit, setIncludeCredit] = useState(false);
  const [chartMode, setChartMode] = useState('gastos'); // 'gastos' | 'cartoes'
  const [selectedCard, setSelectedCard] = useState('all');

  // Navigation Logic
  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prev = new Date(year, month - 2, 1);
    setSelectedMonth(prev.toISOString().slice(0, 7));
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const next = new Date(year, month, 1);
    setSelectedMonth(next.toISOString().slice(0, 7));
  };

  // Stats Calculation
  const stats = useMemo(() => {
    const filtered = transactions.filter(t => (t.date?.slice(0, 7) || t.month) === selectedMonth);
    
    const income = filtered
      .filter(t => t.type === 'income' && t.category !== 'initial_balance' && t.category !== 'carryover' && t.category !== 'vault_redemption')
      .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    
    const expense = filtered
      .filter(t => t.type === 'expense' && t.category !== 'investment' && t.category !== 'vault' && (includeCredit || t.paymentMethod !== 'credito'))
      .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

    // Group by category to find top expense
    const byCategory = filtered
      .filter(t => t.type === 'expense' && t.category !== 'investment' && t.category !== 'vault' && (includeCredit || t.paymentMethod !== 'credito'))
      .reduce((acc, t) => {
        const cat = t.category || 'other';
        acc[cat] = (acc[cat] || 0) + parseFloat(t.amount);
        return acc;
      }, {});

    const topCategory = Object.keys(byCategory).sort((a, b) => byCategory[b] - byCategory[a])[0];

    // Group by priority
    const byPriority = filtered
      .filter(t => t.type === 'expense' && t.category !== 'investment' && t.category !== 'vault' && (includeCredit || t.paymentMethod !== 'credito'))
      .reduce((acc, t) => {
        const priority = t.priority || 'other';
        acc[priority] = (acc[priority] || 0) + parseFloat(t.amount);
        return acc;
      }, {});

    return { income, expense, balance: income - expense, topCategory, topCategoryValue: byCategory[topCategory] || 0, byPriority };
  }, [transactions, selectedMonth, includeCredit]);

  // Previous Month Comparison
  const prevStats = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonthKey = prevDate.toISOString().slice(0, 7);

    const filtered = transactions.filter(t => (t.date?.slice(0, 7) || t.month) === prevMonthKey);
    
    const income = filtered
      .filter(t => t.type === 'income' && t.category !== 'initial_balance' && t.category !== 'carryover' && t.category !== 'vault_redemption')
      .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    
    const expense = filtered
      .filter(t => t.type === 'expense' && t.category !== 'investment' && t.category !== 'vault' && (includeCredit || t.paymentMethod !== 'credito'))
      .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

    return { income, expense };
  }, [transactions, selectedMonth, includeCredit]);

  // Credit Card Stats
  const cardStats = useMemo(() => {
    const filtered = transactions.filter(t => (t.date?.slice(0, 7) || t.month) === selectedMonth);
    
    let cardExpenses = filtered.filter(t => 
      t.type === 'expense' && t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid'
    );
    
    const [selYear, selMonthNum] = selectedMonth.split('-').map(Number);
    const selTotalMonths = selYear * 12 + selMonthNum;

    let cardSubs = subscriptions.filter(s => {
        if (!s.cardId) return false;
        if (!s.createdAt) return true; // Legacy fallback

        const createdDate = new Date(s.createdAt);
        if (isNaN(createdDate.getTime())) return true;

        const createdTotalMonths = createdDate.getFullYear() * 12 + (createdDate.getMonth() + 1);
        const monthsPassed = selTotalMonths - createdTotalMonths;

        if (monthsPassed < 0) return false; // Was created in the future

        if (s.type === 'installment') {
            if (monthsPassed >= (s.totalInstallments || 1)) {
                return false; // Finished before this month
            }
        }
        return true;
    });

    if (selectedCard !== 'all') {
      cardExpenses = cardExpenses.filter(t => t.selectedCardId === selectedCard);
      cardSubs = cardSubs.filter(s => s.cardId === selectedCard);
    }
    
    const expensesTotal = cardExpenses.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    const subsTotal = cardSubs.reduce((acc, s) => acc + (parseFloat(s.value) || 0), 0);
    const total = expensesTotal + subsTotal;
    
    const byCategory = cardExpenses.reduce((acc, t) => {
      const cat = t.category || 'other';
      acc[cat] = (acc[cat] || 0) + parseFloat(t.amount);
      return acc;
    }, {});
    
    // Process subs (installments to their category, recurring to subscriptions)
    if (cardSubs.length > 0) {
        cardSubs.forEach(s => {
            if (s.type === 'installment') {
                const cat = s.category || 'other';
                byCategory[cat] = (byCategory[cat] || 0) + parseFloat(s.value || 0);
            } else {
                byCategory['subscriptions'] = (byCategory['subscriptions'] || 0) + parseFloat(s.value || 0);
            }
        });
    }
    
    const topCategory = Object.keys(byCategory).length > 0 
        ? Object.keys(byCategory).sort((a, b) => byCategory[b] - byCategory[a])[0] 
        : null;
    const count = cardExpenses.length + cardSubs.length;
    
    return { total, byCategory, topCategory, topCategoryValue: topCategory ? byCategory[topCategory] : 0, count };
  }, [transactions, selectedMonth, selectedCard, subscriptions]);

  const monthLabel = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  // AI Analysis Logic
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiReviewText, setAiReviewText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
        const review = await generateMonthlyReview(monthLabel, stats, {}); // Fixed parameters
        setAiReviewText(review);
        setIsAIModalOpen(true);
    } catch (error) {
        console.error("AI Analysis failed:", error);
    } finally {
        setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-full overflow-x-hidden px-5 md:px-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      
      {/* Header */}
      <div className="flex items-center justify-center pt-8 pb-4">
          <h2 className={`text-xl font-medium tracking-wide uppercase ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Análise de Gastos</h2>
      </div>

      {/* Navigation Row */}
      <div className="flex flex-col items-center gap-4 mb-8">
          {/* Tabs on top */}
          <div className="flex gap-6 border-b border-slate-700/50">
              <button 
                  onClick={() => { setChartMode('gastos'); setSelectedCard('all'); }}
                  className={`pb-3 px-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                      chartMode === 'gastos' 
                      ? 'border-rose-400 text-rose-400' 
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
              >
                  Gastos
              </button>
              <button 
                  onClick={() => setChartMode('cartoes')}
                  className={`pb-3 px-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                      chartMode === 'cartoes' 
                      ? 'border-violet-400 text-violet-400' 
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
              >
                  Cartões
              </button>
          </div>

          {/* Month Selector and Filters below */}
          <div className="flex flex-wrap items-center justify-center gap-4">
              <div className={`flex items-center rounded-lg border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#1e2330] border-slate-700/50'}`}>
                  <button onClick={handlePrevMonth} className="p-2 text-slate-400 hover:text-white transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className={`px-4 text-[10px] font-bold uppercase min-w-[140px] text-center ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
                      {monthLabel}
                  </span>
                  <button onClick={handleNextMonth} className="p-2 text-slate-400 hover:text-white transition-colors">
                      <ChevronRight className="w-4 h-4" />
                  </button>
              </div>

              {chartMode === 'gastos' && (
                  <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-[#1e2330] border-slate-700/50'}`}>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer select-none">
                          Incluir Cartão
                      </label>
                      <label className="inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={includeCredit} onChange={(e) => setIncludeCredit(e.target.checked)} />
                          <div className="relative w-7 h-4 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                  </div>
              )}

              {chartMode === 'cartoes' && cards.length > 0 && (
                  <div className="flex gap-2">
                      <select
                          value={selectedCard}
                          onChange={(e) => setSelectedCard(e.target.value)}
                          className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border outline-none appearance-none cursor-pointer ${
                              theme === 'light' ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#1e2330] border-slate-700/50 text-white'
                          }`}
                      >
                          <option value="all">Todos os Cartões</option>
                          {cards.map(c => (
                              <option key={c.id} value={c.id}>{c.name || c.brand} {c.last4}</option>
                          ))}
                      </select>
                  </div>
              )}
          </div>
      </div>

      {/* Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mb-8">
          {chartMode === 'gastos' ? (
              <>
                  {/* Ganhos */}
                  <div className={`p-5 rounded-xl flex flex-col justify-center gap-3 ${theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]'}`}>
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                              <div className="text-emerald-500">
                                  <TrendingUp className="w-4 h-4" />
                              </div>
                              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Ganhos</span>
                          </div>
                          {prevStats.income > 0 && (
                              <div className={`flex items-center gap-1 text-[10px] font-bold ${stats.income >= prevStats.income ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {stats.income >= prevStats.income ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                  {Math.abs(((stats.income - prevStats.income) / prevStats.income) * 100).toFixed(0)}%
                              </div>
                          )}
                      </div>
                      <div className={`text-2xl font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                          R$ {stats.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                  </div>

                  {/* Gastos */}
                  <div className={`p-5 rounded-xl flex flex-col justify-center gap-3 ${theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]'}`}>
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                              <div className="text-rose-500">
                                  <TrendingDown className="w-4 h-4" />
                              </div>
                              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Gastos</span>
                          </div>
                          {prevStats.expense > 0 && (
                              <div className={`flex items-center gap-1 text-[10px] font-bold ${stats.expense <= prevStats.expense ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {stats.expense <= prevStats.expense ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                                  {Math.abs(((stats.expense - prevStats.expense) / prevStats.expense) * 100).toFixed(0)}%
                              </div>
                          )}
                      </div>
                      <div className={`text-2xl font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                          R$ {stats.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                  </div>

                  {/* Resultado do Período */}
                  <div className={`p-5 rounded-xl flex flex-col justify-center gap-3 ${theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]'}`}>
                      <div className="flex items-center gap-2">
                          <div className={stats.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                              <Target className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Resultado do Período</span>
                      </div>
                      <div className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          R$ {stats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                  </div>
              </>
          ) : (
              <>
                  {/* Fatura em Aberto */}
                  <div className={`p-5 rounded-xl flex flex-col justify-center gap-3 ${theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]'}`}>
                      <div className="flex items-center gap-2">
                          <div className="text-violet-500">
                              <CreditCard className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Fatura em Aberto</span>
                      </div>
                      <div className="text-2xl font-bold text-violet-500">
                          R$ {cardStats.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                  </div>

                  {/* Lançamentos no Cartão */}
                  <div className={`p-5 rounded-xl flex flex-col justify-center gap-3 ${theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]'}`}>
                      <div className="flex items-center gap-2">
                          <div className="text-blue-500">
                              <PieChart className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Lançamentos</span>
                      </div>
                      <div className={`text-2xl font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                          {cardStats.count} <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">itens</span>
                      </div>
                  </div>

                  {/* Vilão do Cartão */}
                  <div className={`p-5 rounded-xl flex flex-col justify-center gap-3 ${theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]'}`}>
                      <div className="flex items-center gap-2">
                          <div className="text-rose-500">
                              <AlertTriangle className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Vilão do Cartão</span>
                      </div>
                      {cardStats.topCategory ? (
                          <div className="flex items-end justify-between">
                              <div className={`text-xl font-bold uppercase tracking-wider truncate mr-2 ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                  {CATEGORIES.expense.find(c => c.id === cardStats.topCategory)?.label || 'Outro'}
                              </div>
                              <div className="text-[10px] font-bold text-rose-500 mb-1">
                                  {cardStats.total > 0 ? ((cardStats.topCategoryValue / cardStats.total) * 100).toFixed(0) : 0}%
                              </div>
                          </div>
                      ) : (
                          <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                              Nenhum
                          </div>
                      )}
                  </div>
              </>
          )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Comparative Section - Spans 2 columns on large screens */}
        <div className={`lg:col-span-2 p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border ${
          theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-[#1e2330] border-slate-700/50'
        }`}>
          <ExpensesChart transactions={transactions} targetMonth={selectedMonth} mode={chartMode} selectedCard={selectedCard} subscriptions={subscriptions} includeCredit={includeCredit} />
        </div>

        {/* Side Panels */}
        <div className="space-y-6">
          
          {chartMode === 'gastos' ? (
            <>
              {/* Category Highlight */}
              {stats.topCategory && (
                <div className={`p-6 rounded-3xl border flex flex-col gap-3 ${theme === 'light' ? 'bg-white border-slate-100' : 'bg-white/5 border-white/5'}`}>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Vilão do Mês</p>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-2xl ${theme === 'light' ? 'bg-slate-50' : 'bg-white/5'}`}>
                                {(() => {
                                    const category = CATEGORIES.expense.find(c => c.id === stats.topCategory);
                                    const Icon = category?.icon || AlertTriangle;
                                    const color = category?.color || 'text-slate-400';
                                    return <Icon className={`w-5 h-5 ${color}`} />;
                                })()}
                            </div>
                            <div>
                                <p className={`text-sm font-bold uppercase tracking-wider ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                    {CATEGORIES.expense.find(c => c.id === stats.topCategory)?.label || 'Outro'}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium">
                                    {((stats.topCategoryValue / stats.expense) * 100).toFixed(0)}% do total gasto
                                </p>
                            </div>
                        </div>
                        <p className={`text-2xl font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                            R$ {stats.topCategoryValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Card breakdown by category */}
              <div className={`p-6 rounded-3xl border flex flex-col gap-3 ${theme === 'light' ? 'bg-white border-slate-100' : 'bg-white/5 border-white/5'}`}>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Detalhamento</p>
                  <div className="space-y-3">
                      {Object.entries(cardStats.byCategory).sort(([,a],[,b]) => b - a).map(([catId, value]) => {
                          const catDef = CATEGORIES.expense.find(c => c.id === catId) || { label: 'Outro', icon: AlertTriangle, color: 'text-slate-400' };
                          const CatIcon = catDef.icon;
                          const pct = cardStats.total > 0 ? ((value / cardStats.total) * 100).toFixed(0) : 0;
                          return (
                              <div key={catId} className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                      <CatIcon className={`w-4 h-4 ${catDef.color}`} />
                                      <span className={`text-xs font-medium uppercase tracking-wider ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>{catDef.label}</span>
                                  </div>
                                  <div className="text-right">
                                      <span className={`text-sm font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                          R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </span>
                                      <span className="text-[9px] font-bold text-slate-400 ml-2">{pct}%</span>
                                  </div>
                              </div>
                          );
                      })}
                      {Object.keys(cardStats.byCategory).length === 0 && (
                          <p className="text-sm font-bold text-slate-400 text-center py-4">Nenhum lançamento no cartão este mês.</p>
                      )}
                  </div>
              </div>
            </>
          )}

          {/* Alívia Insight Card */}
          {(() => {
            // Build detailed insight for the selected month
            const filtered = transactions.filter(t => (t.date?.slice(0, 7) || t.month) === selectedMonth);
            const incomeTxs = filtered.filter(t => t.type === 'income' && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category));
            const expenseTxs = filtered.filter(t => t.type === 'expense' && t.category !== 'investment' && t.category !== 'vault' && (includeCredit || t.paymentMethod !== 'credito'));
            const investmentTxs = filtered.filter(t => t.type === 'expense' && t.category === 'investment');

            const totalIncome = incomeTxs.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
            const totalExpense = expenseTxs.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
            const totalInvestment = investmentTxs.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
            const balance = totalIncome - totalExpense;

            const superfluous = expenseTxs.filter(t => t.priority === 'superfluous').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
            const essential = expenseTxs.filter(t => t.priority === 'essential').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

            // Top category
            const byCategory = expenseTxs.reduce((acc, t) => {
              const cat = t.category || 'other';
              acc[cat] = (acc[cat] || 0) + (parseFloat(t.amount) || 0);
              return acc;
            }, {});
            const topCatId = Object.keys(byCategory).sort((a, b) => byCategory[b] - byCategory[a])[0];
            const topCatLabel = CATEGORIES.expense.find(c => c.id === topCatId)?.label || 'Outros';
            const topCatValue = byCategory[topCatId] || 0;

            // Top individual expense
            const topExpense = [...expenseTxs].sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0))[0];

            let insightStatus = 'neutral';
            let insightMessage = 'Analisando seu mês...';

            if (totalIncome === 0 && totalExpense === 0) {
              insightStatus = 'neutral';
              insightMessage = 'Ainda não há movimentações suficientes neste mês para uma análise.';
            } else if (totalExpense > totalIncome && totalIncome > 0) {
              insightStatus = 'negative';
              insightMessage = `Atenção: Seus gastos (R$ ${totalExpense.toLocaleString('pt-BR')}) superaram suas entradas (R$ ${totalIncome.toLocaleString('pt-BR')}).`;
              if (topCatId) insightMessage += ` Maior gasto foi em ${topCatLabel} (R$ ${topCatValue.toLocaleString('pt-BR')}).`;
              if (superfluous > essential) insightMessage += ' Gastos supérfluos superaram os essenciais — reveja suas prioridades.';
            } else {
              if (totalExpense < totalIncome * 0.5 && totalInvestment > 0) {
                insightStatus = 'positive';
                insightMessage = `Excelente! Você gastou menos da metade das entradas e investiu R$ ${totalInvestment.toLocaleString('pt-BR')}.`;
              } else if (totalInvestment === 0 && totalIncome > 0) {
                insightStatus = 'warning';
                insightMessage = `Gastos controlados, mas você não separou nada para reservas neste mês.`;
              } else {
                insightStatus = 'positive';
                insightMessage = `Mês positivo! Sobrou R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`;
              }
              if (superfluous > essential && essential > 0) {
                insightStatus = insightStatus === 'positive' ? 'warning' : insightStatus;
                insightMessage += ` Porém, os gastos supérfluos (R$ ${superfluous.toLocaleString('pt-BR')}) superaram os essenciais (R$ ${essential.toLocaleString('pt-BR')}).`;
              }
              if (topExpense) {
                insightMessage += ` Maior gasto individual: "${topExpense.description || 'Sem descrição'}" (R$ ${parseFloat(topExpense.amount).toLocaleString('pt-BR')}).`;
              }
            }

            const bgColors = {
              positive: theme === 'light' ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/20',
              negative: theme === 'light' ? 'bg-rose-50 border-rose-200' : 'bg-rose-500/10 border-rose-500/20',
              warning: theme === 'light' ? 'bg-amber-50 border-amber-200' : 'bg-amber-500/10 border-amber-500/20',
              neutral: theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-500/10 border-slate-500/20',
            };
            const textColors = {
              positive: theme === 'light' ? 'text-emerald-700' : 'text-emerald-400',
              negative: theme === 'light' ? 'text-rose-700' : 'text-rose-400',
              warning: theme === 'light' ? 'text-amber-700' : 'text-amber-400',
              neutral: theme === 'light' ? 'text-slate-700' : 'text-slate-400',
            };
            const icons = {
              positive: <TrendingUp className="w-3.5 h-3.5" />,
              negative: <TrendingDown className="w-3.5 h-3.5" />,
              warning: <Sparkles className="w-3.5 h-3.5" />,
              neutral: <Sparkles className="w-3.5 h-3.5" />,
            };

            return (
              <div className={`flex items-start gap-3 p-4 rounded-2xl border ${bgColors[insightStatus]} transition-all duration-300 shadow-inner`}>
                <div className="relative shrink-0 mt-0.5">
                  <img src={aliviaFinal} alt="Alívia" className="w-10 h-10 object-cover rounded-full border-2 border-white/20 shadow-md" />
                  <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full ${theme === 'light' ? 'bg-white' : 'bg-[#131621]'} border border-white/10 ${textColors[insightStatus]}`}>
                    {icons[insightStatus]}
                  </div>
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${textColors[insightStatus]} opacity-90`}>Alívia</span>
                  <span className={`text-[12px] font-medium leading-relaxed ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                    {insightMessage}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* AI Deep Analysis Button */}
          <button 
            onClick={handleAIAnalysis}
            disabled={isAnalyzing}
            className={`w-full p-4 rounded-2xl border-2 border-dashed transition-all flex items-center justify-center gap-3 group ${
            theme === 'light' 
            ? 'border-blue-200 text-blue-500 hover:bg-blue-50 hover:border-blue-400' 
            : 'border-white/10 text-blue-400 hover:bg-blue-500/5 hover:border-blue-500/50'
          } ${isAnalyzing ? 'opacity-70 cursor-not-allowed' : ''}`}>
            <div className="p-2 bg-blue-500/10 rounded-xl group-hover:scale-110 transition-transform">
                {isAnalyzing ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin" /> : <Sparkles className="w-5 h-5 text-blue-500" />}
            </div>
            <div className="text-left">
                <p className="text-xs font-black uppercase tracking-widest">{isAnalyzing ? 'Analisando...' : 'Análise Profunda com IA'}</p>
                <p className="text-[9px] font-medium opacity-60">Gerar relatório detalhado com a Alívia</p>
            </div>
          </button>

        </div>
      </div>

      <MonthlyReviewModal 
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        reviewText={aiReviewText}
        monthName={monthLabel}
        stats={stats}
        theme={theme}
      />
    </div>
  );
};

export default AnalysisTab;
