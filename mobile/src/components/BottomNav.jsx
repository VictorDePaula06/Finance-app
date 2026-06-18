import React from 'react';
import { LayoutDashboard, TrendingUp, TrendingDown, CreditCard, BarChart3 } from 'lucide-react';

// Ordem: Geral, Recebimentos (linha pra cima), Lançamentos (linha pra baixo),
// Cartão, Análises. Ajustes saiu da barra e virou engrenagem no topo da Geral.
export const TABS = [
  { id: 'geral',        label: 'Geral',        Icon: LayoutDashboard },
  { id: 'recebimentos', label: 'Recebimentos', Icon: TrendingUp },
  { id: 'lancamentos',  label: 'Lançamentos',  Icon: TrendingDown },
  { id: 'cartao',       label: 'Cartão',       Icon: CreditCard },
  { id: 'analises',     label: 'Análises',     Icon: BarChart3 },
];

export default function BottomNav({ tab, setTab, tabs = TABS }) {
  return (
    <nav className="absolute bottom-0 left-0 right-0 z-20 bg-ink/95 backdrop-blur-xl border-t border-fg/[0.06]">
      <div className="flex items-stretch justify-around px-1 pt-2 pb-[max(10px,env(safe-area-inset-bottom))]">
        {tabs.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex flex-col items-center gap-1 flex-1 min-w-0 py-0.5 active:scale-95 transition-transform"
            >
              <Icon
                className={active ? 'text-fg' : 'text-fg/35'}
                style={{ width: 22, height: 22 }}
                strokeWidth={active ? 2.4 : 2}
              />
              <span className={`text-[9.5px] tracking-tight truncate max-w-full ${active ? 'text-fg font-bold' : 'text-fg/35 font-medium'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
