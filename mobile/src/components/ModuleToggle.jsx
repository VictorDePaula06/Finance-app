import React from 'react';
import { Wallet, Landmark } from 'lucide-react';

// Alterna entre os dois módulos do app: Controle de Gastos e Patrimônio.
export default function ModuleToggle({ value, onChange }) {
  const opts = [
    { id: 'gastos', label: 'Gastos', Icon: Wallet },
    { id: 'patrimonio', label: 'Patrimônio', Icon: Landmark },
  ];
  return (
    <div className="inline-flex rounded-full p-0.5 bg-fg/[0.06] border border-fg/[0.05]">
      {opts.map((o) => {
        const active = value === o.id;
        const Icon = o.Icon;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-bold transition active:scale-95 ${
              active ? 'bg-fg text-ink shadow-sm' : 'text-fg/50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {o.label}
          </button>
        );
      })}
    </div>
  );
}
