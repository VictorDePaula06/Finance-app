import React from 'react';

// Primitivos de formulário com o visual do app (tokens temáticos).

export const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="text-[11px] font-bold uppercase tracking-widest text-fg/45">{label}</span>
    <div className="mt-1.5">{children}</div>
    {hint && <span className="block text-[11px] text-fg/35 mt-1">{hint}</span>}
  </label>
);

const baseInput =
  'w-full rounded-xl bg-fg/[0.05] border border-fg/[0.08] px-3.5 py-3 text-[15px] text-fg ' +
  'placeholder:text-fg/30 outline-none focus:border-fg/25 transition';

export const TextInput = (props) => <input {...props} className={`${baseInput} ${props.className || ''}`} />;

// Campo de valor em reais (aceita vírgula ou ponto).
export const MoneyInput = ({ value, onChange, autoFocus }) => (
  <div className="flex items-center gap-2 rounded-2xl bg-fg/[0.05] border border-fg/[0.08] px-4 py-3.5 focus-within:border-fg/25 transition">
    <span className="text-[20px] font-bold text-fg/40">R$</span>
    <input
      inputMode="decimal"
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ''))}
      placeholder="0,00"
      className="flex-1 bg-transparent outline-none text-[26px] font-extrabold tracking-tight text-fg placeholder:text-fg/25"
    />
  </div>
);

export const DateInput = (props) => (
  <input type="date" {...props} className={`${baseInput} appearance-none ${props.className || ''}`} />
);

export const Select = ({ children, ...props }) => (
  <select {...props} className={`${baseInput} appearance-none pr-9 bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat`}>
    {children}
  </select>
);

// Botão principal do formulário.
export const SubmitBtn = ({ disabled, children, tone = 'pos' }) => {
  const bg = tone === 'neg' ? 'bg-rose-500' : tone === 'info' ? 'bg-violet-600' : 'bg-emerald-500';
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`w-full py-3.5 rounded-2xl ${bg} text-white font-extrabold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-40 disabled:active:scale-100`}
    >
      {children}
    </button>
  );
};

// Grade de categorias selecionáveis (ícone + rótulo).
export const CategoryGrid = ({ cats, value, onChange }) => (
  <div className="grid grid-cols-4 gap-2">
    {cats.map((c) => {
      const Icon = c.Icon;
      const active = value === c.id;
      return (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition active:scale-95 ${
            active ? 'border-fg/30 bg-fg/[0.08]' : 'border-transparent bg-fg/[0.03]'
          }`}
        >
          <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${c.color}22` }}>
            <Icon className="w-[18px] h-[18px]" style={{ color: c.color }} />
          </span>
          <span className={`text-[10px] font-semibold leading-tight text-center px-0.5 ${active ? 'text-fg' : 'text-fg/55'}`}>
            {c.label}
          </span>
        </button>
      );
    })}
  </div>
);
