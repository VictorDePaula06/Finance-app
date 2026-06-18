import React, { useState } from 'react';
import { LayoutDashboard, Activity, PiggyBank, TrendingUp, Scale } from 'lucide-react';
import { useStore } from '../store.jsx';
import { useLivePrices } from '../hooks/useLivePrices.js';
import BottomNav from '../components/BottomNav.jsx';
import PatHeader from '../components/PatHeader.jsx';
import PatGeral from './patrimonio/PatGeral.jsx';
import PatMonitor from './patrimonio/PatMonitor.jsx';
import PatReserva from './patrimonio/PatReserva.jsx';
import PatInvestimentos from './patrimonio/PatInvestimentos.jsx';
import PatRebalanceamento from './patrimonio/PatRebalanceamento.jsx';

const PAT_TABS = [
  { id: 'geral', label: 'Geral', Icon: LayoutDashboard },
  { id: 'monitor', label: 'Monitor', Icon: Activity },
  { id: 'reserva', label: 'Reserva', Icon: PiggyBank },
  { id: 'investimentos', label: 'Investim.', Icon: TrendingUp },
  { id: 'rebalanceamento', label: 'Rebalanc.', Icon: Scale },
];

export default function PatrimonioShell({ module, onModule, onOpenSettings }) {
  const { investments = [] } = useStore();
  const [patTab, setPatTab] = useState('geral');
  const livePrices = useLivePrices(investments, true);

  return (
    <>
      <PatHeader module={module} onModule={onModule} onOpenSettings={onOpenSettings} />
      <main className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {patTab === 'geral' && <PatGeral livePrices={livePrices} onNavigate={setPatTab} />}
        {patTab === 'monitor' && <PatMonitor livePrices={livePrices} />}
        {patTab === 'reserva' && <PatReserva />}
        {patTab === 'investimentos' && <PatInvestimentos livePrices={livePrices} />}
        {patTab === 'rebalanceamento' && <PatRebalanceamento livePrices={livePrices} />}
      </main>
      <BottomNav tab={patTab} setTab={setPatTab} tabs={PAT_TABS} />
    </>
  );
}
