import React from 'react';
import { LayoutDashboard, ArrowDownToLine, ArrowLeftRight, BarChart3, Settings } from 'lucide-react';

// Abas na ordem definida: Geral, Recebimentos, Lançamentos, Análises, Ajustes.
export const TABS = [
  { id: 'geral',        label: 'Geral',        Icon: LayoutDashboard },
  { id: 'recebimentos', label: 'Recebimentos', Icon: ArrowDownToLine },
  { id: 'lancamentos',  label: 'Lançamentos',  Icon: ArrowLeftRight },
  { id: 'analises',     label: 'Análises',     Icon: BarChart3 },
  { id: 'ajustes',      label: 'Ajustes',      Icon: Settings },
];

export default function BottomNav({ tab, setTab }) {
  return (
    <nav className="absolute bottom-0 left-0 right-0 z-20 bg-ink/95 backdrop-blur-xl border-t border-white/[0.06]">
      <div className="flex items-stretch justify-around px-1 pt-2 pb-[max(10px,env(safe-area-inset-bottom))]">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex flex-col items-center gap-1 flex-1 min-w-0 py-0.5 active:scale-95 transition-transform"
            >
              <Icon
                className={active ? 'text-white' : 'text-white/35'}
                style={{ width: 22, height: 22 }}
                strokeWidth={active ? 2.4 : 2}
              />
              <span className={`text-[9.5px] tracking-tight truncate max-w-full ${active ? 'text-white font-bold' : 'text-white/35 font-medium'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
