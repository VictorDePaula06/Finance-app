import React from 'react';
import { ChevronRight } from 'lucide-react';

export const fmt = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Cabeçalho de aba (título + subtítulo + ação à direita).
export const TabHeader = ({ title, subtitle, right }) => (
  <div className="px-5 pt-6 pb-2 flex items-end justify-between gap-3">
    <div className="min-w-0">
      <h1 className="text-[22px] font-extrabold tracking-tight leading-none">{title}</h1>
      {subtitle && <p className="text-[12px] text-fg/40 mt-1">{subtitle}</p>}
    </div>
    {right}
  </div>
);

// Cartão arredondado padrão. A sombra é quase invisível no escuro e dá uma
// leve elevação no claro (onde card e fundo são ambos claros).
export const Card = ({ className = '', children }) => (
  <div className={`rounded-2xl bg-card border border-fg/[0.06] shadow-sm shadow-black/5 ${className}`}>{children}</div>
);

// Pílula de filtro (estilo do modelo: ativa branca com texto preto).
export const Chip = ({ active, children, onClick }) => (
  <button
    onClick={onClick}
    className={`shrink-0 px-4 py-1.5 rounded-full text-[12px] font-semibold transition active:scale-95 ${active ? 'bg-fg text-ink' : 'bg-fg/[0.06] text-fg/55'}`}
  >
    {children}
  </button>
);

// Linha de lista (ícone + título + subtítulo + valor/chevron).
export const Row = ({ icon: Icon, iconColor, iconBg, title, subtitle, right, onClick, chevron, danger, last }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-fg/[0.03] transition ${last ? '' : 'border-b border-fg/[0.05]'}`}
  >
    {Icon && (
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg || 'rgba(255,255,255,0.06)' }}>
        <Icon className="w-[18px] h-[18px]" style={{ color: iconColor || '#cbd5e1' }} />
      </span>
    )}
    <div className="flex-1 min-w-0">
      <p className={`text-[14px] font-semibold truncate ${danger ? 'text-neg' : ''}`}>{title}</p>
      {subtitle && <p className="text-[11px] text-fg/40 truncate mt-0.5">{subtitle}</p>}
    </div>
    {right}
    {chevron && <ChevronRight className="w-4 h-4 text-fg/25 shrink-0" />}
  </button>
);

// Controle segmentado (ex.: Escuro/Claro, Competência/Caixa).
export const Segment = ({ options, value, onChange }) => (
  <div className="inline-flex rounded-lg p-0.5 bg-fg/[0.06] shrink-0">
    {options.map(o => (
      <button key={o.value} onClick={() => onChange(o.value)}
        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${value === o.value ? 'bg-fg text-ink' : 'text-fg/45'}`}>
        {o.label}
      </button>
    ))}
  </div>
);

// Interruptor liga/desliga.
export const Switch = ({ on, onClick }) => (
  <button onClick={onClick} className={`relative w-10 h-6 rounded-full transition shrink-0 ${on ? 'bg-emerald-500' : 'bg-fg/15'}`} aria-pressed={on}>
    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
  </button>
);

// Linha de ajuste com controle à direita (não é botão — evita botão aninhado).
export const SettingRow = ({ icon: Icon, iconColor, iconBg, title, subtitle, right, last }) => (
  <div className={`w-full flex items-center gap-3 px-4 py-3.5 ${last ? '' : 'border-b border-fg/[0.05]'}`}>
    {Icon && (
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg }}>
        <Icon className="w-[18px] h-[18px]" style={{ color: iconColor }} />
      </span>
    )}
    <div className="flex-1 min-w-0">
      <p className="text-[14px] font-semibold truncate">{title}</p>
      {subtitle && <p className="text-[11px] text-fg/40 truncate mt-0.5">{subtitle}</p>}
    </div>
    {right}
  </div>
);

// Rótulo de seção.
export const SectionLabel = ({ children, action }) => (
  <div className="px-5 mt-6 mb-2 flex items-center justify-between">
    <span className="text-[11px] font-black uppercase tracking-widest text-fg/35">{children}</span>
    {action}
  </div>
);

// Linha de transação (recebimento/gasto) usando a categoria.
// A cor do valor vem do sinal: "+" → verde (pos), "−" → vermelho (neg).
// Esses tokens mudam de tom por tema, garantindo contraste no claro e no escuro.
// Se onPress for passado, a linha vira tocável (abre os detalhes).
export const TxRow = ({ cat, desc, amount, date, sub, sign, last, onPress }) => {
  const Icon = cat?.Icon;
  const toneClass = sign === '+' ? 'text-pos' : 'text-neg';
  const cls = `w-full flex items-center gap-3 px-4 py-3 text-left ${last ? '' : 'border-b border-fg/[0.04]'} ${onPress ? 'active:bg-fg/[0.03] transition' : ''}`;
  const inner = (
    <>
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${cat?.color}22` }}>
        {Icon && <Icon className="w-[18px] h-[18px]" style={{ color: cat?.color }} />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold truncate">{desc}</p>
        <p className="text-[11px] text-fg/40 truncate mt-0.5">{date}{sub ? ` · ${sub}` : ''}</p>
      </div>
      <span className={`text-[14px] font-extrabold tabular-nums shrink-0 ${toneClass}`}>
        {sign} R$ {fmt(amount)}
      </span>
    </>
  );
  return onPress
    ? <button onClick={onPress} className={cls}>{inner}</button>
    : <div className={cls}>{inner}</div>;
};
