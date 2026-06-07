import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Scale, SlidersHorizontal, X, Save, TrendingUp, TrendingDown, CheckCircle2, Landmark, Activity, Building2, Bitcoin, Home } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useUsdRate } from '../utils/marketRates';
import { useLivePrices } from '../hooks/useLivePrices';
import { summarizeInvestments } from '../utils/investmentValue';
import aliviaFinal from '../assets/alivia/alivia-final.png';

const fmt = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Classes de ativo para o rebalanceamento (mapeiam os tipos da carteira).
const REBAL_CLASSES = [
  { id: 'renda_fixa', label: 'Renda Fixa', desc: 'Tesouro, CDB, LCI/LCA', types: ['renda_fixa'], hex: '#3b82f6', icon: Landmark },
  { id: 'acoes', label: 'Ações e ETFs', desc: 'Ações nacionais e internacionais', types: ['acoes', 'etfs', 'stocks'], hex: '#a855f7', icon: Activity },
  { id: 'fiis', label: 'Fundos Imobiliários', desc: 'FIIs negociados em bolsa', types: ['fiis'], hex: '#10b981', icon: Building2 },
  { id: 'crypto', label: 'Criptoativos', desc: 'Bitcoin, Ethereum e outros', types: ['crypto', 'cripto'], hex: '#f59e0b', icon: Bitcoin },
  { id: 'imoveis', label: 'Imóveis', desc: 'Imóveis na carteira de investimentos', types: ['imoveis', 'imovel'], hex: '#f43f5e', icon: Home },
];

export default function RebalanceamentoTab() {
  const { theme } = useTheme();
  const { currentUser, userPrefs, saveUserPreferences } = useAuth();
  const isDark = theme !== 'light';
  const usdRate = useUsdRate();

  const [investments, setInvestments] = useState([]);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'investments'), where('userId', '==', currentUser.uid));
    return onSnapshot(q, snap => setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser]);

  const { livePrices, getTesouroRate } = useLivePrices(investments, true);

  const targets = userPrefs?.rebalanceTargets || {};
  const hasTargets = REBAL_CLASSES.some(c => parseFloat(targets[c.id]) > 0);

  const summary = useMemo(
    () => summarizeInvestments(investments, { usdRate, livePrices, getTesouroRate }),
    [investments, usdRate, livePrices, getTesouroRate]
  );

  // Valor atual por classe + plano de rebalanceamento.
  const plan = useMemo(() => {
    const byClass = summary.byClass || {};
    const rows = REBAL_CLASSES.map(c => {
      const current = c.types.reduce((a, t) => a + (byClass[t] || 0), 0);
      return { ...c, current, target: parseFloat(targets[c.id]) || 0 };
    });
    const total = rows.reduce((a, r) => a + r.current, 0);
    const sumTargets = rows.reduce((a, r) => a + r.target, 0);
    const detailed = rows.map(r => {
      const currentPct = total > 0 ? (r.current / total) * 100 : 0;
      const targetPct = sumTargets > 0 ? (r.target / sumTargets) * 100 : 0;
      const targetValue = total * (targetPct / 100);
      const diff = targetValue - r.current; // + = aportar | - = vender
      return { ...r, currentPct, targetPct, targetValue, diff };
    });
    const tol = Math.max(total * 0.01, 0.005); // 1% de tolerância
    const maxDeviation = detailed.reduce((m, r) => Math.max(m, Math.abs(r.currentPct - r.targetPct)), 0);
    return { rows: detailed, total, sumTargets, tol, maxDeviation };
  }, [summary, targets]);

  // Mensagem da Alívia.
  const alivia = useMemo(() => {
    if (plan.total <= 0.005) return { tone: 'neutral', text: 'Cadastre seus investimentos na aba Investimentos para a Alívia analisar a alocação e sugerir o rebalanceamento.' };
    if (!hasTargets) return { tone: 'neutral', text: 'Defina a sua alocação-alvo no botão Configurar — aí eu comparo com a sua carteira e digo exatamente o que comprar ou vender para chegar lá.' };
    const sells = plan.rows.filter(r => r.diff < -plan.tol).sort((a, b) => a.diff - b.diff);
    const buys = plan.rows.filter(r => r.diff > plan.tol).sort((a, b) => b.diff - a.diff);
    if (sells.length === 0 && buys.length === 0) {
      return { tone: 'positive', text: 'Sua carteira está alinhada com a sua meta! 👏 Continue aportando de forma proporcional para manter o equilíbrio.' };
    }
    const parts = [];
    sells.forEach(r => parts.push(`venda R$ ${fmt(Math.abs(r.diff))} de ${r.label}`));
    buys.forEach(r => parts.push(`aporte R$ ${fmt(r.diff)} em ${r.label}`));
    let txt = 'Para voltar à sua meta: ' + parts.join('; ') + '.';
    const worst = plan.rows.reduce((w, r) => Math.abs(r.diff) > Math.abs(w.diff) ? r : w, plan.rows[0]);
    if (worst && Math.abs(worst.diff) > plan.tol) {
      txt += ` O maior desajuste é em ${worst.label}: você tem ${worst.currentPct.toFixed(0)}% e a meta é ${worst.targetPct.toFixed(0)}%.`;
    }
    return { tone: 'warning', text: txt };
  }, [plan, hasTargets]);

  const card = isDark ? 'bg-[#1e2330] border-slate-700/50' : 'bg-white border-slate-100 shadow-sm';
  const txt = isDark ? 'text-white' : 'text-slate-900';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';
  const aliviaTone = { positive: 'border-emerald-500/20 bg-emerald-500/[0.05]', warning: 'border-amber-500/20 bg-amber-500/[0.05]', neutral: isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50' }[alivia.tone];
  const aliviaText = { positive: 'text-emerald-400', warning: 'text-amber-400', neutral: 'text-slate-400' }[alivia.tone];

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}><Scale className="w-6 h-6 text-amber-500" /></span>
          <div>
            <h1 className={`text-2xl font-black tracking-tight ${txt}`}>Rebalanceamento</h1>
            <p className={`text-sm mt-0.5 ${sub}`}>Mantenha sua carteira alinhada à sua estratégia de alocação</p>
          </div>
        </div>
        <button
          onClick={() => setShowConfig(true)}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" /> Configurar
        </button>
      </div>

      {plan.total <= 0.005 ? (
        <div className={`p-12 rounded-2xl border text-center ${card}`}>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-500'}`}><Scale className="w-7 h-7" /></div>
          <p className={`font-bold ${txt}`}>Nenhum investimento para rebalancear</p>
          <p className="text-sm text-slate-500 mt-1">Cadastre seus ativos na aba <strong>Investimentos</strong> para acompanhar e equilibrar a sua carteira.</p>
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className={`rounded-2xl border p-4 ${card}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Carteira total</p>
              <p className={`text-2xl font-black tabular-nums mt-1 ${txt}`}><span className="text-sm font-bold text-slate-400 mr-0.5">R$</span>{fmt(plan.total)}</p>
            </div>
            <div className={`rounded-2xl border p-4 ${card}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Meta definida</p>
              <p className="text-2xl font-black tabular-nums mt-1 text-emerald-500">{hasTargets ? `${Math.round(plan.sumTargets)}%` : '—'}</p>
              <p className={`text-[10px] mt-0.5 ${sub}`}>{hasTargets ? (Math.round(plan.sumTargets) === 100 ? 'soma 100% ✓' : 'ajuste para somar 100%') : 'clique em Configurar'}</p>
            </div>
            <div className={`rounded-2xl border p-4 col-span-2 lg:col-span-1 ${card}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Maior desvio</p>
              <p className="text-2xl font-black tabular-nums mt-1" style={{ color: plan.maxDeviation >= 10 ? '#f43f5e' : plan.maxDeviation >= 5 ? '#f59e0b' : '#10b981' }}>{hasTargets ? `${plan.maxDeviation.toFixed(1)}%` : '—'}</p>
              <p className={`text-[10px] mt-0.5 ${sub}`}>distância da meta</p>
            </div>
          </div>

          {/* Alívia */}
          <div className={`rounded-2xl border p-4 flex items-start gap-3 ${aliviaTone}`}>
            <img src={aliviaFinal} alt="Alívia" className="w-11 h-11 rounded-full object-cover border-2 border-white/15 shadow-md shrink-0" />
            <div className="min-w-0">
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${aliviaText}`}>Alívia · Rebalanceamento</p>
              <p className={`text-[13px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{alivia.text}</p>
            </div>
          </div>

          {/* Plano por classe */}
          <div className={`rounded-2xl border p-5 ${card}`}>
            <h3 className={`text-sm font-bold mb-4 ${txt}`}>Alocação atual × meta</h3>
            <div className="space-y-4">
              {plan.rows.map(r => {
                const Icon = r.icon;
                const over = r.diff < -plan.tol;
                const under = r.diff > plan.tol;
                return (
                  <div key={r.id}>
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${r.hex}1f`, color: r.hex }}><Icon className="w-[18px] h-[18px]" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[13px] font-bold ${txt}`}>{r.label}</span>
                          <span className="text-[11px] font-bold tabular-nums">
                            <span style={{ color: r.hex }}>{r.currentPct.toFixed(0)}%</span>
                            <span className="text-slate-500"> / meta {hasTargets ? `${r.targetPct.toFixed(0)}%` : '—'}</span>
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">R$ {fmt(r.current)} {hasTargets && <span className="opacity-70">· meta R$ {fmt(r.targetValue)}</span>}</p>
                      </div>
                    </div>
                    {/* Barra: atual (cor da classe) + marcador da meta */}
                    <div className={`relative w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, r.currentPct)}%`, background: r.hex }} />
                      {hasTargets && (
                        <div className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-white/80 shadow" style={{ left: `${Math.min(100, r.targetPct)}%` }} title={`Meta ${r.targetPct.toFixed(0)}%`} />
                      )}
                    </div>
                    {/* Ação */}
                    {hasTargets && (
                      <div className="mt-1.5">
                        {over ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-400"><TrendingDown className="w-3.5 h-3.5" /> Vender R$ {fmt(Math.abs(r.diff))} para chegar na meta</span>
                        ) : under ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400"><TrendingUp className="w-3.5 h-3.5" /> Aportar R$ {fmt(r.diff)} para chegar na meta</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400"><CheckCircle2 className="w-3.5 h-3.5" /> Equilibrado</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className={`text-[11px] mt-4 leading-relaxed ${sub}`}>
              As sugestões são uma orientação de equilíbrio — o ideal é rebalancear preferindo <strong>novos aportes</strong> nas classes abaixo da meta, evitando vender (e gerar impostos) sempre que possível.
            </p>
          </div>
        </>
      )}

      {showConfig && createPortal(
        <ConfigModal isDark={isDark} initial={targets} onClose={() => setShowConfig(false)} onSave={(t) => { saveUserPreferences?.({ rebalanceTargets: t }); setShowConfig(false); }} />,
        document.body
      )}
    </div>
  );
}

function ConfigModal({ isDark, initial, onClose, onSave }) {
  const [draft, setDraft] = useState(() => {
    const d = {};
    REBAL_CLASSES.forEach(c => { d[c.id] = initial[c.id] != null ? String(initial[c.id]) : ''; });
    return d;
  });
  const txt = isDark ? 'text-white' : 'text-slate-800';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';

  const total = REBAL_CLASSES.reduce((a, c) => a + (parseFloat(draft[c.id]) || 0), 0);
  const totalOk = Math.round(total) === 100;

  const setVal = (id, v) => setDraft(prev => ({ ...prev, [id]: v }));
  const distributeEven = () => {
    const each = Math.round(100 / REBAL_CLASSES.length);
    const d = {};
    REBAL_CLASSES.forEach((c, i) => { d[c.id] = String(i === REBAL_CLASSES.length - 1 ? 100 - each * (REBAL_CLASSES.length - 1) : each); });
    setDraft(d);
  };
  const handleSave = () => {
    const t = {};
    REBAL_CLASSES.forEach(c => { const v = parseFloat(draft[c.id]) || 0; if (v > 0) t[c.id] = v; });
    onSave(t);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className={`w-full max-w-lg rounded-[2rem] border shadow-2xl animate-in zoom-in-95 duration-300 max-h-[92vh] overflow-y-auto custom-scrollbar ${isDark ? 'bg-[#161b27] border-white/10' : 'bg-white border-slate-200'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-6 py-5 border-b sticky top-0 z-10 ${isDark ? 'bg-[#161b27] border-white/5' : 'bg-white border-slate-100'}`}>
          <h3 className={`text-lg font-black flex items-center gap-2 ${txt}`}><Scale className="w-5 h-5 text-amber-500" /> Alocação-alvo</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-rose-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <p className={`text-[12px] leading-relaxed ${sub}`}>Defina o <strong>percentual ideal</strong> de cada classe de ativo. A Alívia compara com a sua carteira e sugere o que comprar ou vender para chegar lá.</p>

          {REBAL_CLASSES.map(c => {
            const Icon = c.icon;
            const v = parseFloat(draft[c.id]) || 0;
            return (
              <div key={c.id}>
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${c.hex}1f`, color: c.hex }}><Icon className="w-4 h-4" /></span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-bold ${txt}`}>{c.label}</p>
                    <p className="text-[10px] text-slate-500 truncate">{c.desc}</p>
                  </div>
                  <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border ${isDark ? 'bg-[#0f131c] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    <input
                      type="number" min={0} max={100} step={1}
                      value={draft[c.id]}
                      onChange={e => setVal(c.id, e.target.value)}
                      placeholder="0"
                      className={`w-12 bg-transparent text-sm font-black text-right focus:outline-none ${txt}`}
                    />
                    <span className="text-[11px] font-bold text-slate-500">%</span>
                  </div>
                </div>
                <input
                  type="range" min={0} max={100} step={1}
                  value={v}
                  onChange={e => setVal(c.id, e.target.value)}
                  className="w-full"
                  style={{ accentColor: c.hex }}
                />
              </div>
            );
          })}

          <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${totalOk ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-amber-500/30 bg-amber-500/[0.06]'}`}>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-black uppercase tracking-widest ${totalOk ? 'text-emerald-400' : 'text-amber-400'}`}>Total</span>
              <span className={`text-lg font-black tabular-nums ${totalOk ? 'text-emerald-400' : 'text-amber-400'}`}>{Math.round(total)}%</span>
            </div>
            <button onClick={distributeEven} className={`text-[11px] font-bold ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>Distribuir igualmente</button>
          </div>
          {!totalOk && <p className="text-[11px] text-amber-500 text-center">A soma ideal é 100%. (Posso salvar assim mesmo — a análise normaliza os percentuais.)</p>}
        </div>

        <div className={`flex gap-3 px-6 py-5 border-t sticky bottom-0 ${isDark ? 'bg-[#161b27] border-white/5' : 'bg-white border-slate-100'}`}>
          <button onClick={onClose} className={`flex-1 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest ${isDark ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Cancelar</button>
          <button onClick={handleSave} className="flex-1 py-3 bg-emerald-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Salvar alocação</button>
        </div>
      </div>
    </div>
  );
}
