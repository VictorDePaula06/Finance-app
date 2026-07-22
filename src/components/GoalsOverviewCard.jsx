import React, { useState, useEffect, useMemo } from 'react';
import { Target, ChevronRight, AlertCircle, CheckCircle2, PieChart, CreditCard, Wallet, TrendingDown, PiggyBank } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { goalProgress, currentMonthExpenses } from '../utils/goalsProgress';

const ICON = { categoria: PieChart, cartao: CreditCard, teto_mensal: Wallet, divida: TrendingDown, economia: PiggyBank };
const fmt = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Bloco "Minhas Metas" da Visão Geral. Mostra o progresso das metas cadastradas
 * (coleção expense_goals): tetos como barras compactas e as de longo prazo com
 * o RITMO necessário. Carrega as próprias metas para não precisar passar por props.
 */
export default function GoalsOverviewCard({ transactions = [], setActiveTab }) {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const { currentUser } = useAuth();
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'expense_goals'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, snap => setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [currentUser]);

  const monthExpenses = useMemo(() => currentMonthExpenses(transactions), [transactions]);
  const rows = useMemo(
    () => goals.map(g => ({ g, p: goalProgress(g, monthExpenses) }))
      .sort((a, b) => (b.p.over - a.p.over) || (b.p.pct - a.p.pct)),
    [goals, monthExpenses]
  );

  const goToGoals = () => setActiveTab && setActiveTab('cad_metas');

  const card = isDark ? 'bg-slate-900/80 border-white/[0.06]' : 'bg-white border-slate-100 shadow-sm';
  const track = isDark ? 'bg-white/10' : 'bg-slate-200';

  return (
    <div className={`rounded-[2rem] border p-5 ${card}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}><Target className="w-4 h-4 text-emerald-500" /></div>
          <div>
            <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Minhas Metas</p>
            <p className="text-[10px] font-bold text-slate-500">Acompanhamento do mês</p>
          </div>
        </div>
        <button onClick={goToGoals} className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}>
          Gerenciar <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {goals.length === 0 ? (
        <button onClick={goToGoals} className={`w-full text-center py-8 rounded-2xl border border-dashed transition-colors ${isDark ? 'border-white/10 hover:bg-white/[0.03]' : 'border-slate-200 hover:bg-slate-50'}`}>
          <Target className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
          <p className="text-xs font-bold text-slate-500">Nenhuma meta cadastrada</p>
          <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mt-1">Cadastrar minha primeira meta →</p>
        </button>
      ) : (
        <div className="space-y-3">
          {rows.map(({ g, p }) => {
            const Icon = ICON[g.type] || Target;
            return (
              <div key={g.id}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="flex items-center gap-2 min-w-0">
                    <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: p.color }} />
                    <span className={`text-[12px] font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{g.name}</span>
                    {p.over && <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-widest text-rose-500"><AlertCircle className="w-3 h-3" /> Estourou</span>}
                    {p.near && <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-amber-500">Atenção</span>}
                    {p.reached && <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-500"><CheckCircle2 className="w-3 h-3" /> Atingida</span>}
                  </span>
                  <span className={`text-[11px] font-black tabular-nums shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    R$ {fmt(p.done)}<span className="text-slate-500"> / {fmt(p.target)}</span>
                  </span>
                </div>
                <div className={`w-full h-1.5 rounded-full overflow-hidden ${track}`}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p.pct}%`, background: p.color }} />
                </div>
                {/* Ritmo — só nas de longo prazo com prazo */}
                {!p.isCeiling && p.monthlyNeeded != null && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Faltam <b className={isDark ? 'text-slate-300' : 'text-slate-600'}>R$ {fmt(p.remaining)}</b> em {p.months} {p.months === 1 ? 'mês' : 'meses'} →
                    <b style={{ color: p.color }}> R$ {fmt(p.monthlyNeeded)}/mês</b>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
