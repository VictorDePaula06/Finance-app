import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import PeriodAnalysis from './PeriodAnalysis';
import SpendingGoals from './SpendingGoals';
import CardMovements from './CardMovements';
import MonthlyComparative from './MonthlyComparative';

const VIEW_TITLES = {
  periodo: 'Gastos por Período',
  cartoes: 'Movimentações Cartões',
  metas: 'Metas de Gasto',
  comparativo: 'Comparativo',
};

const AnalysisTab = ({ transactions = [], cards = [], subscriptions = [], manualConfig = {}, onUpdateConfig, initialView = 'periodo' }) => {
  const { theme } = useTheme();
  const view = initialView; // a sub-aba ativa vem da sidebar (grupo "Análise de Gastos")

  return (
    <div className="max-w-full overflow-x-hidden px-5 md:px-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex items-center justify-between pt-8 pb-2 flex-wrap gap-4">
        <h2 className={`text-xl font-medium tracking-wide uppercase ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
          {VIEW_TITLES[view] || 'Análise de Gastos'}
        </h2>
      </div>

      {view === 'periodo' && (
        <PeriodAnalysis transactions={transactions} cards={cards} subscriptions={subscriptions} theme={theme} />
      )}
      {view === 'cartoes' && (
        <CardMovements transactions={transactions} cards={cards} subscriptions={subscriptions} theme={theme} />
      )}
      {view === 'metas' && (
        <SpendingGoals transactions={transactions} cards={cards} subscriptions={subscriptions} manualConfig={manualConfig} onUpdateConfig={onUpdateConfig} theme={theme} />
      )}
      {view === 'comparativo' && (
        <MonthlyComparative transactions={transactions} cards={cards} subscriptions={subscriptions} theme={theme} />
      )}
    </div>
  );
};

export default AnalysisTab;
