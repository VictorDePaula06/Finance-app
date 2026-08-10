import React, { useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { TabHeader, Card, SectionLabel } from '../components/ui.jsx';
import Sheet from '../components/Sheet.jsx';
import { useFinance } from '../hooks/useFinance.js';
import { fmt, monthLabel, monthKeyNow } from '../lib/finance.js';
import { catMeta } from '../lib/categories.js';

// Despesas "internas" que não entram no consumo por categoria (igual ao web).
const INTERNAL_EXPENSE = ['investment', 'vault', 'credit_card_bill'];

const dayISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Presets de período (padrão: mês atual).
const PERIODS = [
  { id: 'month', label: 'Este mês' },
  { id: 'lastMonth', label: 'Mês passado' },
  { id: 'last3', label: 'Últimos 3 meses' },
  { id: 'year', label: 'Este ano' },
  { id: 'all', label: 'Tudo' },
];

function periodRange(period) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  if (period === 'lastMonth') return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0) };
  if (period === 'last3') return { start: new Date(y, m - 2, 1), end: new Date(y, m + 1, 0) };
  if (period === 'year') return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) };
  if (period === 'all') return { start: null, end: null };
  return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) }; // month (padrão)
}

function periodLabelOf(period) {
  const now = new Date();
  if (period === 'lastMonth') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return monthLabel(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  if (period === 'last3') return 'Últimos 3 meses';
  if (period === 'year') return `Ano de ${now.getFullYear()}`;
  if (period === 'all') return 'Todo o período';
  return monthLabel(monthKeyNow());
}

// Alterna forma de pagamento / opção (chip).
const Toggle = ({ active, onClick, children }) => (
  <button onClick={onClick}
    className={`px-3.5 py-2 rounded-xl text-[12px] font-bold border transition active:scale-95 ${active ? 'border-fg/30 bg-fg/[0.08] text-fg' : 'border-transparent bg-fg/[0.03] text-fg/45'}`}>
    {children}
  </button>
);

// Donut interativo por categoria (mesma ideia do web: fatias <2% viram "Demais").
function CategoryDonut({ data, total }) {
  const [active, setActive] = useState(null);
  if (!data.length || total <= 0) return <p className="text-center text-[13px] text-fg/40 py-10">Nada no período/filtros selecionados.</p>;
  const size = 200, r = 72, cx = size / 2, cy = size / 2, sw = 26;
  const circ = 2 * Math.PI * r;
  const big = data.filter(d => d.value / total >= 0.02);
  const restVal = total - big.reduce((a, d) => a + d.value, 0);
  const slices = restVal > 0.005 ? [...big, { id: '__demais', label: 'Demais categorias', value: restVal, hex: '#64748b' }] : big;
  let acc = 0;
  const segs = slices.map((d) => { const frac = d.value / total; const seg = { ...d, frac, offset: acc }; acc += frac; return seg; });
  const sel = active != null ? segs[active] : null;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={sw} stroke="rgba(148,163,184,0.15)" />
          {segs.map((d, i) => {
            const on = active === i, dim = active != null && !on;
            const gap = segs.length > 1 ? 0.006 * circ : 0;
            const dash = Math.max(0, d.frac * circ - gap);
            return (
              <circle key={d.id} cx={cx} cy={cy} r={r} fill="none"
                strokeWidth={on ? sw + 7 : sw} stroke={d.hex}
                strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-d.offset * circ}
                style={{ opacity: dim ? 0.3 : 1, transition: 'opacity .2s, stroke-width .2s', cursor: 'pointer' }}
                onClick={() => setActive(on ? null : i)} />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
          {sel ? (
            <>
              <span className="text-[10px] font-black uppercase tracking-widest truncate max-w-full" style={{ color: sel.hex }}>{sel.label}</span>
              <span className="text-[17px] font-extrabold tabular-nums">R$ {fmt(sel.value)}</span>
              <span className="text-[11px] font-bold text-fg/45">{(sel.frac * 100).toFixed(1)}%</span>
            </>
          ) : (
            <>
              <span className="text-[9px] font-black uppercase tracking-widest text-fg/40">Total</span>
              <span className="text-[19px] font-extrabold tabular-nums">R$ {fmt(total)}</span>
            </>
          )}
        </div>
      </div>
      {/* Legenda (toque sincroniza com a fatia) */}
      <div className="w-full space-y-0.5">
        {segs.map((d, i) => {
          const on = active === i;
          return (
            <button key={d.id} onClick={() => setActive(on ? null : i)}
              className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors ${on ? 'bg-fg/[0.06]' : ''}`}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.hex }} />
              <span className="text-[13px] font-bold truncate flex-1 text-left">{d.label}</span>
              <span className="text-[12px] font-black tabular-nums shrink-0" style={{ color: d.hex }}>R$ {fmt(d.value)}</span>
              <span className="text-[10px] font-bold text-fg/45 tabular-nums shrink-0 w-9 text-right">{(d.frac * 100).toFixed(0)}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AnalisesTab() {
  const { transactions } = useFinance();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ period: 'month', dinheiro: true, pix: true, cartao: true, includeInvoice: true });

  const setF = (patch) => setFilters(f => ({ ...f, ...patch }));

  // Gastos por categoria (filtrado por período + forma de pagamento + fatura).
  const { cats, total } = useMemo(() => {
    const { start, end } = periodRange(filters.period);
    const s = start ? dayISO(start) : null;
    const e = end ? dayISO(end) : null;
    const map = {};
    transactions.forEach(t => {
      if (t.type !== 'expense' || INTERNAL_EXPENSE.includes(t.category)) return;
      const ds = String(t.date || '').slice(0, 10) || (t.month ? `${t.month}-15` : '');
      if (!ds) return;
      if (s && ds < s) return;
      if (e && ds > e) return;
      // Formas: Pix, Cartão (crédito) e "Dinheiro/outros" (dinheiro, débito, boleto…).
      const pm = t.paymentMethod || 'dinheiro';
      const isPix = pm === 'pix', isCard = pm === 'credito';
      if (isPix && !filters.pix) return;
      if (isCard && !filters.cartao) return;
      if (!isPix && !isCard && !filters.dinheiro) return;
      if (isCard && !filters.includeInvoice && t.invoiceStatus === 'unpaid') return;
      const cat = t.category || 'other';
      map[cat] = (map[cat] || 0) + (parseFloat(t.amount) || 0);
    });
    const cats = Object.entries(map)
      .map(([id, value]) => ({ id, label: catMeta(id).label, hex: catMeta(id).color, value }))
      .sort((a, b) => b.value - a.value);
    return { cats, total: cats.reduce((a, c) => a + c.value, 0) };
  }, [transactions, filters]);

  const filtersChanged = filters.period !== 'month' || !filters.dinheiro || !filters.pix || !filters.cartao || !filters.includeInvoice;

  return (
    <div className="pb-6">
      <TabHeader title="Análises" subtitle="Para onde seu dinheiro vai" />

      {/* Gastos por categoria + filtros */}
      <div className="flex items-center justify-between px-5 mt-4 mb-2 gap-3">
        <div className="min-w-0">
          <span className="block text-[11px] font-black uppercase tracking-widest text-fg/35">Gastos por categoria</span>
          <span className="block text-[11px] text-fg/40 truncate first-letter:uppercase">{periodLabelOf(filters.period)}</span>
        </div>
        <button onClick={() => setFiltersOpen(true)}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold border transition active:scale-95 ${filtersChanged ? 'bg-info/15 text-info border-info/25' : 'bg-fg/[0.06] text-fg/60 border-transparent'}`}>
          <SlidersHorizontal className="w-3.5 h-3.5" /> Filtros
        </button>
      </div>
      <div className="px-5">
        <Card className="p-4">
          <CategoryDonut data={cats} total={total} />
        </Card>
      </div>

      {filtersOpen && (
        <Sheet title="Filtros" subtitle="Gastos por categoria" onClose={() => setFiltersOpen(false)}>
          <div className="space-y-5">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-fg/45 mb-2">Período</p>
              <div className="flex flex-wrap gap-2">
                {PERIODS.map(p => <Toggle key={p.id} active={filters.period === p.id} onClick={() => setF({ period: p.id })}>{p.label}</Toggle>)}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-fg/45 mb-2">Formas de pagamento</p>
              <div className="flex flex-wrap gap-2">
                <Toggle active={filters.dinheiro} onClick={() => setF({ dinheiro: !filters.dinheiro })}>Dinheiro/Débito</Toggle>
                <Toggle active={filters.pix} onClick={() => setF({ pix: !filters.pix })}>Pix</Toggle>
                <Toggle active={filters.cartao} onClick={() => setF({ cartao: !filters.cartao })}>Cartão</Toggle>
              </div>
            </div>

            {filters.cartao && (
              <button onClick={() => setF({ includeInvoice: !filters.includeInvoice })}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl bg-fg/[0.03] border border-fg/[0.06] active:scale-[0.99] transition">
                <span className="text-[13px] font-semibold text-left">Incluir fatura em aberto<span className="block text-[11px] text-fg/40 font-normal">Compras no crédito ainda não pagas.</span></span>
                <span className={`relative w-10 h-6 rounded-full transition shrink-0 ${filters.includeInvoice ? 'bg-emerald-500' : 'bg-fg/15'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${filters.includeInvoice ? 'left-[18px]' : 'left-0.5'}`} />
                </span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button onClick={() => setFilters({ period: 'month', dinheiro: true, pix: true, cartao: true, includeInvoice: true })}
                className="py-3.5 rounded-2xl bg-fg/[0.06] text-fg/70 font-bold text-[14px] active:scale-95 transition">Limpar</button>
              <button onClick={() => setFiltersOpen(false)}
                className="py-3.5 rounded-2xl bg-emerald-500 text-white font-extrabold text-[14px] active:scale-95 transition">Aplicar</button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}
