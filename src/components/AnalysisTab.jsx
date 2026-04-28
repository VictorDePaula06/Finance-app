import React, { useState, useMemo } from 'react';
import ExpensesChart from './ExpensesChart';
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Sparkles, Target, AlertTriangle, ArrowUpRight, ArrowDownRight, PieChart } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { CATEGORIES } from '../constants/categories';
import MonthlyReviewModal from './MonthlyReviewModal';
import { generateMonthlyReview } from '../services/gemini';
import { Loader2 } from 'lucide-react';

const AnalysisTab = ({ transactions }) => {
  const { theme } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

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
      .filter(t => t.type === 'expense' && t.category !== 'investment' && t.category !== 'vault')
      .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

    // Group by category to find top expense
    const byCategory = filtered
      .filter(t => t.type === 'expense' && t.category !== 'investment' && t.category !== 'vault')
      .reduce((acc, t) => {
        const cat = t.category || 'other';
        acc[cat] = (acc[cat] || 0) + parseFloat(t.amount);
        return acc;
      }, {});

    const topCategory = Object.keys(byCategory).sort((a, b) => byCategory[b] - byCategory[a])[0];

    return { income, expense, balance: income - expense, topCategory, topCategoryValue: byCategory[topCategory] || 0 };
  }, [transactions, selectedMonth]);

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
      .filter(t => t.type === 'expense' && t.category !== 'investment' && t.category !== 'vault')
      .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

    return { income, expense };
  }, [transactions, selectedMonth]);

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
      
      {/* Month Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 rounded-2xl">
                <PieChart className="w-6 h-6 text-blue-500" />
            </div>
            <div>
                <h2 className={`text-xl font-black tracking-tight ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Análise de Gastos</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Acompanhe seu ritmo financeiro</p>
            </div>
        </div>

        <div className={`flex items-center gap-2 p-1.5 rounded-2xl border ${theme === 'light' ? 'bg-white border-slate-100' : 'bg-white/5 border-white/5'}`}>
          <button 
            onClick={handlePrevMonth}
            className={`p-2 rounded-xl transition-all ${theme === 'light' ? 'hover:bg-slate-50 text-slate-400' : 'hover:bg-white/5 text-slate-500'}`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className={`px-4 text-xs font-black uppercase tracking-widest min-w-[140px] text-center ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>
            {monthLabel}
          </span>
          <button 
            onClick={handleNextMonth}
            className={`p-2 rounded-xl transition-all ${theme === 'light' ? 'hover:bg-slate-50 text-slate-400' : 'hover:bg-white/5 text-slate-500'}`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Comparative Section - Spans 2 columns on large screens */}
        <div className={`lg:col-span-2 p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border ${
          theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900 border-white/5'
        }`}>
          <ExpensesChart transactions={transactions} targetMonth={selectedMonth} />
        </div>

        {/* Side Panels */}
        <div className="space-y-6">
          
          {/* Main Balance Card */}
          <div className={`p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border relative overflow-hidden group ${
            stats.balance >= 0 
            ? (theme === 'light' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-emerald-500/10 border-emerald-500/20')
            : (theme === 'light' ? 'bg-rose-50/50 border-rose-100' : 'bg-rose-500/10 border-rose-500/20')
          }`}>
            <div className="relative z-10">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Resultado do Período</p>
                <p className={`text-4xl font-black ${stats.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                R$ {stats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] mt-2 font-bold uppercase tracking-tight text-slate-400">
                {stats.balance >= 0 ? 'Mês fechando no azul' : 'Mês fechando no vermelho'}
                </p>
            </div>
            <div className={`absolute -right-4 -bottom-4 w-24 h-24 blur-3xl opacity-20 ${stats.balance >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 gap-4">
            <div className={`p-6 rounded-3xl border flex items-center justify-between ${
                theme === 'light' ? 'bg-white border-slate-100' : 'bg-white/5 border-white/5'
            }`}>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-2xl">
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Ganhos</p>
                        <p className={`text-lg font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                            R$ {stats.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
                {prevStats.income > 0 && (
                    <div className={`flex items-center gap-1 text-[10px] font-bold ${stats.income >= prevStats.income ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {stats.income >= prevStats.income ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {Math.abs(((stats.income - prevStats.income) / prevStats.income) * 100).toFixed(0)}%
                    </div>
                )}
            </div>

            <div className={`p-6 rounded-3xl border flex items-center justify-between ${
                theme === 'light' ? 'bg-white border-slate-100' : 'bg-white/5 border-white/5'
            }`}>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-rose-500/10 rounded-2xl">
                        <TrendingDown className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Gastos</p>
                        <p className={`text-lg font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                            R$ {stats.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
                {prevStats.expense > 0 && (
                    <div className={`flex items-center gap-1 text-[10px] font-bold ${stats.expense <= prevStats.expense ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {stats.expense <= prevStats.expense ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {Math.abs(((stats.expense - prevStats.expense) / prevStats.expense) * 100).toFixed(0)}%
                    </div>
                )}
            </div>
          </div>

          {/* Category Highlight */}
          {stats.topCategory && (
            <div className={`p-6 rounded-3xl border ${theme === 'light' ? 'bg-white border-slate-100' : 'bg-white/5 border-white/5'}`}>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">Vilão do Mês</p>
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
                            <p className={`text-sm font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                {CATEGORIES.expense.find(c => c.id === stats.topCategory)?.label || 'Outro'}
                            </p>
                            <p className="text-[10px] text-slate-500 font-medium">
                                {((stats.topCategoryValue / stats.expense) * 100).toFixed(0)}% do total gasto
                            </p>
                        </div>
                    </div>
                    <p className={`text-sm font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                        R$ {stats.topCategoryValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>
          )}

          {/* AI Analysis Button */}
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
                <p className="text-xs font-black uppercase tracking-widest">{isAnalyzing ? 'Analisando...' : 'Resumo da Alívia'}</p>
                <p className="text-[9px] font-medium opacity-60">Analisar tendências deste mês</p>
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
