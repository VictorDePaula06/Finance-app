import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Target, Plus, Pencil, Trash2, X, CreditCard, PieChart, TrendingDown,
  Wallet, PiggyBank, CheckCircle2, Calendar, AlertCircle,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { CATEGORIES } from '../constants/categories';
import ConfirmSaveDialog from './ConfirmSaveDialog';
import { goalProgress, currentMonthExpenses } from '../utils/goalsProgress';

/**
 * Cadastros › Objetivos e Metas.
 *
 * É um CADASTRO (não relatório): a pessoa registra metas de tipos diferentes e o
 * app acompanha o progresso. Tipos com progresso AUTOMÁTICO leem as transações do
 * mês; os de longo prazo (dívida/economia) têm progresso atualizado pelo usuário.
 */

const GOAL_TYPES = [
  {
    id: 'categoria',
    label: 'Gasto por categoria',
    short: 'Categoria',
    desc: 'Teto mensal para uma categoria. Ex.: até R$ 800 em alimentação.',
    icon: PieChart,
    tint: 'emerald',
    auto: true,
  },
  {
    id: 'cartao',
    label: 'Gasto no cartão',
    short: 'Cartão',
    desc: 'Teto mensal de compras em um cartão de crédito específico.',
    icon: CreditCard,
    tint: 'violet',
    auto: true,
  },
  {
    id: 'teto_mensal',
    label: 'Teto de gastos do mês',
    short: 'Teto mensal',
    desc: 'Limite total de despesas no mês, somando tudo.',
    icon: Wallet,
    tint: 'amber',
    auto: true,
  },
  {
    id: 'divida',
    label: 'Quitar uma dívida',
    short: 'Dívida',
    desc: 'Acompanhe o abatimento de uma dívida até zerar.',
    icon: TrendingDown,
    tint: 'rose',
    auto: false,
  },
  {
    id: 'economia',
    label: 'Economizar / juntar',
    short: 'Economia',
    desc: 'Junte um valor até uma data. Ex.: R$ 5.000 para a viagem.',
    icon: PiggyBank,
    tint: 'blue',
    auto: false,
  },
];
const typeMeta = (id) => GOAL_TYPES.find(t => t.id === id) || GOAL_TYPES[0];

const TINTS = {
  emerald: { text: 'text-emerald-500', bar: '#10b981', softDark: 'bg-emerald-500/15', softLight: 'bg-emerald-50' },
  violet:  { text: 'text-violet-500',  bar: '#8b5cf6', softDark: 'bg-violet-500/15',  softLight: 'bg-violet-50' },
  amber:   { text: 'text-amber-500',   bar: '#f59e0b', softDark: 'bg-amber-500/15',   softLight: 'bg-amber-50' },
  rose:    { text: 'text-rose-500',    bar: '#f43f5e', softDark: 'bg-rose-500/15',    softLight: 'bg-rose-50' },
  blue:    { text: 'text-blue-500',    bar: '#3b82f6', softDark: 'bg-blue-500/15',    softLight: 'bg-blue-50' },
};

// Metas de gasto usam só as categorias de DESPESA.
const EXPENSE_CATEGORIES = CATEGORIES?.expense || [];

const fmt = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseBR = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;

export default function GoalsTab({ transactions = [], manualConfig = {}, onUpdateConfig }) {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const { currentUser } = useAuth();

  const [goals, setGoals] = useState([]);
  const [cards, setCards] = useState([]);
  const [choosingType, setChoosingType] = useState(false);
  const [form, setForm] = useState(null);      // { type, name, value, category, cardId, deadline, progress }
  const [editingId, setEditingId] = useState(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [progressFor, setProgressFor] = useState(null); // meta manual sendo atualizada
  const [progressValue, setProgressValue] = useState('');

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const goalsLoadedRef = useRef(false);
  const migratedRef = useRef(false);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'expense_goals'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, snap => {
      setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      goalsLoadedRef.current = true;
    });
    return () => unsub();
  }, [currentUser]);

  // ── MIGRAÇÃO (não perder dados de quem já usava) ──
  // As "Metas de Gasto" antigas ficavam em manualConfig.categoryBudgets. Ao entrar
  // na nova aba de Metas, convertemos cada orçamento em uma meta de categoria — uma
  // única vez e sem duplicar (só migra o que ainda não virou meta).
  useEffect(() => {
    if (migratedRef.current || !currentUser || !goalsLoadedRef.current) return;
    const budgets = manualConfig?.categoryBudgets;
    if (!budgets) return; // manualConfig ainda não carregou
    migratedRef.current = true;
    const already = new Set(goals.filter(g => g.type === 'categoria').map(g => g.category));
    Object.entries(budgets).forEach(([cat, val]) => {
      const v = parseFloat(val) || 0;
      if (v > 0 && !already.has(cat)) {
        addDoc(collection(db, 'expense_goals'), {
          type: 'categoria',
          name: EXPENSE_CATEGORIES.find(c => c.id === cat)?.label || 'Categoria',
          targetValue: v,
          category: cat, cardId: null, deadline: null, progress: null,
          userId: currentUser.uid, createdAt: Date.now(), migratedFromBudget: true,
        }).catch(err => console.error('Falha ao migrar orçamento:', err));
      }
    });
  }, [goals, manualConfig, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'cards'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, snap => setCards(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [currentUser]);

  // ── Progresso ─────────────────────────────────────────────────────────────
  // Tipos "auto" olham as despesas do mês corrente; os manuais usam o campo
  // `progress` que o usuário atualiza.
  const monthExpenses = useMemo(() => currentMonthExpenses(transactions), [transactions]);
  const computeProgress = (g) => goalProgress(g, monthExpenses);

  const stats = useMemo(() => {
    const ceilings = goals.filter(g => typeMeta(g.type).auto);
    const over = ceilings.filter(g => computeProgress(g).over).length;
    const longTerm = goals.filter(g => !typeMeta(g.type).auto);
    const reached = longTerm.filter(g => computeProgress(g).reached).length;
    return { total: goals.length, over, reached };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, monthExpenses]);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const startNew = (type) => {
    setChoosingType(false);
    setEditingId(null);
    setForm({
      type,
      name: '',
      value: '',
      category: EXPENSE_CATEGORIES[0]?.id || 'food',
      cardId: cards[0]?.id || '',
      deadline: '',
      progress: '',
    });
  };

  const startEdit = (g) => {
    setEditingId(g.id);
    setForm({
      type: g.type,
      name: g.name || '',
      value: String(g.targetValue ?? ''),
      category: g.category || EXPENSE_CATEGORIES[0]?.id || 'food',
      cardId: g.cardId || cards[0]?.id || '',
      deadline: g.deadline || '',
      progress: String(g.progress ?? ''),
    });
  };

  const closeForm = () => { setForm(null); setEditingId(null); };

  const requestSave = (e) => {
    e?.preventDefault?.();
    if (!form) return;
    if (!form.value || parseBR(form.value) <= 0) return;
    if (form.type === 'cartao' && !form.cardId) return;
    if ((form.type === 'divida' || form.type === 'economia') && !form.name.trim()) return;
    setSaveError(null);
    setConfirmSave(true);
  };

  const autoName = (f) => {
    if (f.type === 'categoria') return EXPENSE_CATEGORIES.find(c => c.id === f.category)?.label || 'Categoria';
    if (f.type === 'cartao') return cards.find(c => c.id === f.cardId)?.name || 'Cartão';
    if (f.type === 'teto_mensal') return 'Teto de gastos do mês';
    return f.name.trim();
  };

  const doSave = async () => {
    if (saving || !form) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        type: form.type,
        name: autoName(form),
        targetValue: parseBR(form.value),
        category: form.type === 'categoria' ? form.category : null,
        cardId: form.type === 'cartao' ? form.cardId : null,
        deadline: (form.type === 'divida' || form.type === 'economia') ? (form.deadline || null) : null,
        progress: (form.type === 'divida' || form.type === 'economia') ? parseBR(form.progress) : null,
      };
      if (editingId) {
        await updateDoc(doc(db, 'expense_goals', editingId), payload);
      } else {
        await addDoc(collection(db, 'expense_goals'), { ...payload, userId: currentUser.uid, createdAt: Date.now() });
      }
      // Meta de categoria também alimenta o orçamento por categoria já usado
      // nas telas de análise — evita dois lugares com a mesma informação.
      if (form.type === 'categoria' && onUpdateConfig) {
        onUpdateConfig({
          ...manualConfig,
          categoryBudgets: { ...(manualConfig.categoryBudgets || {}), [form.category]: parseBR(form.value) },
        });
      }
      setConfirmSave(false);
      closeForm();
    } catch (err) {
      console.error('Erro ao salvar meta:', err);
      setSaveError(err?.message || 'Erro inesperado. Tente novamente.');
    }
    setSaving(false);
  };

  const doDelete = async (id) => {
    try { await deleteDoc(doc(db, 'expense_goals', id)); } catch (err) { console.error(err); }
    setDeleteConfirm(null);
  };

  const saveProgress = async () => {
    if (!progressFor) return;
    try {
      await updateDoc(doc(db, 'expense_goals', progressFor.id), { progress: parseBR(progressValue) });
    } catch (err) { console.error(err); }
    setProgressFor(null); setProgressValue('');
  };

  const inputCls = `w-full px-4 py-3 rounded-xl border text-sm font-bold outline-none transition-colors ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;
  const labelCls = 'text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5';
  // Mesmo estilo do botão da Reserva/Cofrinho (padrão dos cadastros).
  const addBtnCls = 'px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95';

  const sorted = [...goals].sort((a, b) => (a.type || '').localeCompare(b.type || '') || (b.createdAt || 0) - (a.createdAt || 0));

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Objetivos e Metas</h1>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Cadastre tetos de gasto e objetivos de longo prazo — o app acompanha o progresso
          </p>
        </div>
        <button onClick={() => setChoosingType(true)} className={addBtnCls}>
          <Plus className="w-3.5 h-3.5" /> Nova meta
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Metas cadastradas', value: stats.total, icon: Target, cls: isDark ? 'text-white' : 'text-slate-800' },
          { label: 'Tetos estourados', value: stats.over, icon: AlertCircle, cls: 'text-rose-500' },
          { label: 'Objetivos atingidos', value: stats.reached, icon: CheckCircle2, cls: 'text-emerald-500' },
        ].map((k, i) => (
          <div key={i} className="pat-card p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{k.label}</span>
              <k.icon className={`w-4 h-4 ${k.cls}`} />
            </div>
            <p className={`text-2xl font-black tabular-nums ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="pat-card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Metas cadastradas</p>
          <span className={`text-[10px] font-bold capitalize ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{monthLabel}</span>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-10">
            <Target className={`w-10 h-10 mx-auto mb-3 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
            <p className="text-sm font-bold text-slate-500">Nenhuma meta cadastrada.</p>
            <p className="text-[11px] text-slate-500 mt-1">Use <strong>“Nova meta”</strong> no topo para começar.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sorted.map(g => {
              const meta = typeMeta(g.type);
              const tint = TINTS[meta.tint];
              const p = computeProgress(g);
              const barColor = p.over ? '#f43f5e' : (p.reached ? '#10b981' : tint.bar);
              const Icon = meta.icon;
              return (
                <div key={g.id} className={`p-3.5 rounded-xl border ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? tint.softDark : tint.softLight} ${tint.text}`}>
                        <Icon className="w-4.5 h-4.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{g.name}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isDark ? tint.softDark : tint.softLight} ${tint.text}`}>
                            {meta.short}
                          </span>
                          {p.over && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-500 border border-rose-500/20">Estourou</span>
                          )}
                          {p.reached && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Atingida</span>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                          {p.isCeiling ? 'Gasto no mês' : 'Progresso'}: R$ {fmt(p.done)} de R$ {fmt(p.target)}
                          {g.deadline ? <> · <Calendar className="w-3 h-3 inline -mt-0.5" /> até {new Date(g.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}</> : null}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!meta.auto && (
                        <button
                          onClick={() => { setProgressFor(g); setProgressValue(String(g.progress ?? '')); }}
                          title="Atualizar progresso"
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                        >
                          Atualizar
                        </button>
                      )}
                      <button onClick={() => startEdit(g)} title="Editar" className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteConfirm(g.id)} title="Excluir" className={`p-2 rounded-lg text-rose-400 ${isDark ? 'hover:bg-rose-500/10' : 'hover:bg-rose-50'}`}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>

                  <div className={`w-full h-1.5 rounded-full overflow-hidden mt-2.5 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p.pct}%`, background: barColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: escolher o TIPO da meta */}
      {choosingType && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setChoosingType(false)}>
          <div onClick={e => e.stopPropagation()} className={`border rounded-[2rem] w-full max-w-lg p-6 relative animate-in zoom-in-95 duration-300 shadow-2xl max-h-[88vh] overflow-y-auto custom-scrollbar ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
            <button onClick={() => setChoosingType(false)} className={`absolute top-4 right-4 p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><X className="w-5 h-5" /></button>
            <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Que tipo de meta?</h3>
            <p className="text-[11px] text-slate-500 mt-0.5 mb-5">Cada tipo é acompanhado de um jeito diferente.</p>

            <div className="space-y-2.5">
              {GOAL_TYPES.map(t => {
                const tint = TINTS[t.tint];
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => startNew(t.id)}
                    className={`w-full flex items-start gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.99] ${isDark ? 'border-white/10 hover:bg-white/[0.04]' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <span className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? tint.softDark : tint.softLight} ${tint.text}`}>
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{t.label}</span>
                      <span className="block text-[10px] text-slate-500 mt-1 leading-relaxed">{t.desc}</span>
                      <span className={`inline-block mt-1.5 text-[9px] font-black uppercase tracking-widest ${t.auto ? 'text-emerald-500' : 'text-blue-500'}`}>
                        {t.auto ? 'Progresso automático' : 'Você atualiza o progresso'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal: formulário da meta */}
      {form && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <form onSubmit={requestSave} className={`border rounded-[2rem] w-full max-w-md p-6 space-y-4 relative animate-in zoom-in-95 duration-300 shadow-2xl max-h-[88vh] overflow-y-auto custom-scrollbar ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
            <button type="button" onClick={closeForm} className={`absolute top-4 right-4 p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><X className="w-5 h-5" /></button>

            <div>
              <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{editingId ? 'Editar meta' : typeMeta(form.type).label}</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-0.5">{typeMeta(form.type).short}</p>
            </div>

            {/* Categoria */}
            {form.type === 'categoria' && (
              <div>
                <label className={labelCls}>Categoria</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputCls}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            )}

            {/* Cartão */}
            {form.type === 'cartao' && (
              <div>
                <label className={labelCls}>Cartão</label>
                {cards.length === 0 ? (
                  <p className="text-[11px] text-amber-500">Cadastre um cartão primeiro em Cadastros › Cartão.</p>
                ) : (
                  <select value={form.cardId} onChange={e => setForm({ ...form, cardId: e.target.value })} className={inputCls}>
                    {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>
            )}

            {/* Nome (dívida / economia) */}
            {(form.type === 'divida' || form.type === 'economia') && (
              <div>
                <label className={labelCls}>{form.type === 'divida' ? 'Qual dívida?' : 'Objetivo'}</label>
                <input autoFocus className={inputCls} placeholder={form.type === 'divida' ? 'Ex: Cartão Nubank atrasado' : 'Ex: Viagem'} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  {typeMeta(form.type).auto ? 'Limite (R$)' : (form.type === 'divida' ? 'Total da dívida (R$)' : 'Quero juntar (R$)')}
                </label>
                <input className={inputCls} inputMode="decimal" placeholder="800,00" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
              </div>
              {(form.type === 'divida' || form.type === 'economia') ? (
                <div>
                  <label className={labelCls}>{form.type === 'divida' ? 'Já quitei (R$)' : 'Já juntei (R$)'}</label>
                  <input className={inputCls} inputMode="decimal" placeholder="0,00" value={form.progress} onChange={e => setForm({ ...form, progress: e.target.value })} />
                </div>
              ) : (
                <div>
                  <label className={labelCls}>Período</label>
                  <input className={`${inputCls} opacity-60`} value="Mensal" disabled />
                </div>
              )}
            </div>

            {(form.type === 'divida' || form.type === 'economia') && (
              <div>
                <label className={labelCls}>Prazo (opcional)</label>
                <input type="date" className={inputCls} value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
              </div>
            )}

            <p className="text-[10px] text-slate-500 leading-relaxed">
              {typeMeta(form.type).auto
                ? 'O progresso é calculado sozinho a partir das suas despesas do mês.'
                : 'Você atualiza o quanto já avançou pelo botão “Atualizar” na lista.'}
            </p>

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={closeForm} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest ${isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Cancelar</button>
              <button type="submit" className="flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-400 text-slate-900 transition-all">
                {editingId ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Atualizar progresso (metas manuais) */}
      {progressFor && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className={`border rounded-[2rem] w-full max-w-sm p-6 space-y-4 relative animate-in zoom-in-95 duration-300 shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
            <div className="text-center">
              <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Atualizar progresso</h3>
              <p className="text-[11px] text-slate-500 mt-1">{progressFor.name} · meta de R$ {fmt(progressFor.targetValue)}</p>
            </div>
            <div>
              <label className={labelCls}>{progressFor.type === 'divida' ? 'Total já quitado (R$)' : 'Total já juntado (R$)'}</label>
              <input autoFocus className={inputCls} inputMode="decimal" value={progressValue} onChange={e => setProgressValue(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setProgressFor(null); setProgressValue(''); }} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest ${isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Cancelar</button>
              <button onClick={saveProgress} className="flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-400 text-slate-900 transition-all">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de cadastro/edição */}
      <ConfirmSaveDialog
        open={confirmSave}
        title={editingId ? 'Salvar alterações da meta?' : 'Cadastrar esta meta?'}
        message={form && typeMeta(form.type).auto
          ? 'O acompanhamento começa a valer para o mês corrente.'
          : 'Você poderá atualizar o progresso quando quiser.'}
        confirmLabel={editingId ? 'Salvar alterações' : 'Cadastrar meta'}
        details={form ? [
          { label: 'Tipo', value: typeMeta(form.type).label },
          { label: 'Meta', value: autoName(form) },
          { label: typeMeta(form.type).auto ? 'Limite' : 'Alvo', value: form.value ? `R$ ${form.value}` : '—' },
          { label: 'Prazo', value: form.deadline ? new Date(form.deadline + 'T00:00:00').toLocaleDateString('pt-BR') : null },
        ] : []}
        busy={saving}
        error={saveError}
        onConfirm={doSave}
        onCancel={() => { setConfirmSave(false); setSaveError(null); }}
      />

      {/* Exclusão */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className={`border rounded-[2rem] w-full max-w-sm p-6 space-y-4 text-center animate-in zoom-in-95 duration-300 shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}><Trash2 className="w-6 h-6 text-rose-500" /></div>
            <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Excluir esta meta?</h3>
            <p className="text-[11px] text-slate-500">O acompanhamento é removido. Seus lançamentos não são afetados.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest ${isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Cancelar</button>
              <button onClick={() => doDelete(deleteConfirm)} className="flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest bg-rose-500 hover:bg-rose-400 text-white transition-all">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
