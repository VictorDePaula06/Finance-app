import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import SpendingGoals from './SpendingGoals';
import ReportsHub from './ReportsHub';

const AnalysisTab = ({ transactions = [], cards = [], subscriptions = [], manualConfig = {}, onUpdateConfig, initialView = 'relatorios' }) => {
  const { theme } = useTheme();
  // 'relatorios' = hub de relatórios (chooser: Visão Geral, Receitas, Despesas, Categorias).
  // 'metas' = Cadastros › Objetivos/Metas.
  const view = initialView;

  return (
    <div className="max-w-full overflow-x-hidden px-5 md:px-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 pt-6">
      {(view === 'relatorios' || view === 'periodo' || view === 'comparativo') && (
        <ReportsHub transactions={transactions} theme={theme} />
      )}
      {view === 'metas' && (
        <SpendingGoals transactions={transactions} cards={cards} subscriptions={subscriptions} manualConfig={manualConfig} onUpdateConfig={onUpdateConfig} theme={theme} />
      )}
    </div>
  );
};

export default AnalysisTab;
