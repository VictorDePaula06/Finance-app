import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import PeriodAnalysis from './PeriodAnalysis';
import SpendingGoals from './SpendingGoals';
import MonthlyComparative from './MonthlyComparative';

const VIEW_TITLES = {
  relatorios: 'Análises e Relatórios',
  periodo: 'Gastos por Período',
  metas: 'Objetivos / Metas',
  comparativo: 'Comparativo',
};

const AnalysisTab = ({ transactions = [], cards = [], subscriptions = [], manualConfig = {}, onUpdateConfig, initialView = 'relatorios' }) => {
  const { theme } = useTheme();
  // 'relatorios' = página única (Gastos por Período + Comparativo, sem sub-abas).
  // 'metas' = Cadastros › Objetivos/Metas.
  const view = initialView;

  return (
    <div className="max-w-full overflow-x-hidden px-5 md:px-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex items-center justify-between pt-8 pb-2 flex-wrap gap-4">
        <h2 className={`text-xl font-medium tracking-wide uppercase ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
          {VIEW_TITLES[view] || 'Análise de Gastos'}
        </h2>
      </div>

      {(view === 'relatorios' || view === 'periodo') && (
        <PeriodAnalysis transactions={transactions} cards={cards} subscriptions={subscriptions} manualConfig={manualConfig} theme={theme} />
      )}
      {view === 'metas' && (
        <SpendingGoals transactions={transactions} cards={cards} subscriptions={subscriptions} manualConfig={manualConfig} onUpdateConfig={onUpdateConfig} theme={theme} />
      )}
      {(view === 'relatorios' || view === 'comparativo') && (
        <MonthlyComparative transactions={transactions} cards={cards} subscriptions={subscriptions} manualConfig={manualConfig} theme={theme} />
      )}
    </div>
  );
};

export default AnalysisTab;
