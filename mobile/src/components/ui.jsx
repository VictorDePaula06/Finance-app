import React from 'react';
import { ChevronRight } from 'lucide-react';

export const fmt = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Cabeçalho de aba (título + subtítulo + ação à direita).
export const TabHeader = ({ title, subtitle, right }) => (
  <div className="px-5 pt-6 pb-2 flex items-end justify-between gap-3">
    <div className="min-w-0">
      <h1 className="text-[22px] font-extrabold tracking-tight leading-none">{title}</h1>
      {subtitle && <p className="text-[12px] text-white/40 mt-1">{subtitle}</p>}
    </div>
    {right}
  </div>
);

// Cartão arredondado padrão.
export const Card = ({ className = '', children }) => (
  <div className={`rounded-2xl bg-card border border-white/[0.05] ${className}`}>{children}</div>
);

// Pílula de filtro (estilo do modelo: ativa branca com texto preto).
export const Chip = ({ active, children, onClick }) => (
  <button
    onClick={onClick}
    className={`shrink-0 px-4 py-1.5 rounded-full text-[12px] font-semibold transition active:scale-95 ${active ? 'bg-white text-black' : 'bg-white/[0.06] text-white/55'}`}
  >
    {children}
  </button>
);

// Linha de lista (ícone + título + subtítulo + valor/chevron).
export const Row = ({ icon: Icon, iconColor, iconBg, title, subtitle, right, onClick, chevron, danger, last }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-white/[0.03] transition ${last ? '' : 'border-b border-white/[0.05]'}`}
  >
    {Icon && (
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg || 'rgba(255,255,255,0.06)' }}>
        <Icon className="w-[18px] h-[18px]" style={{ color: iconColor || '#cbd5e1' }} />
      </span>
    )}
    <div className="flex-1 min-w-0">
      <p className={`text-[14px] font-semibold truncate ${danger ? 'text-rose-400' : ''}`}>{title}</p>
      {subtitle && <p className="text-[11px] text-white/40 truncate mt-0.5">{subtitle}</p>}
    </div>
    {right}
    {chevron && <ChevronRight className="w-4 h-4 text-white/25 shrink-0" />}
  </button>
);

// Rótulo de seção.
export const SectionLabel = ({ children, action }) => (
  <div className="px-5 mt-6 mb-2 flex items-center justify-between">
    <span className="text-[11px] font-black uppercase tracking-widest text-white/35">{children}</span>
    {action}
  </div>
);

// Linha de transação (recebimento/gasto) usando a categoria.
export const TxRow = ({ cat, desc, amount, date, sub, sign, color, last }) => {
  const Icon = cat?.Icon;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${last ? '' : 'border-b border-white/[0.04]'}`}>
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${cat?.color}22` }}>
        {Icon && <Icon className="w-[18px] h-[18px]" style={{ color: cat?.color }} />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold truncate">{desc}</p>
        <p className="text-[11px] text-white/40 truncate mt-0.5">{date}{sub ? ` · ${sub}` : ''}</p>
      </div>
      <span className="text-[14px] font-extrabold tabular-nums shrink-0" style={{ color }}>
        {sign} R$ {fmt(amount)}
      </span>
    </div>
  );
};
