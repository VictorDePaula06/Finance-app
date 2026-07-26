import React, { useState, useEffect, useMemo } from 'react';
import { ArrowUpCircle, Plus, Trash2, Pencil, CheckCircle2, Calendar, X, Wallet, AlertCircle, Loader2, Home, Gift, CircleDollarSign } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import ConfirmSaveDialog from './ConfirmSaveDialog';

// Categorias de entrada recorrente (espelha o conceito das contas fixas, do lado da receita).
const INCOME_CATEGORIES = [
  { id: 'salary', label: 'Salário' },
  { id: 'rent', label: 'Aluguel Recebido' },
  { id: 'benefit', label: 'Benefício' },
  { id: 'other', label: 'Outros' },
];
const catLabel = (id) => {
  const found = INCOME_CATEGORIES.find(c => c.id === id);
  if (found) return found.label;
  // Compatibilidade com categorias antigas (freelance, investment, ...)
  return INCOME_CATEGORIES[INCOME_CATEGORIES.length - 1].label;
};

// Painéis de exibição no Cadastro. Categorias legadas caem no grupo "Outros".
const INCOME_GROUPS = [
  { id: 'salary', title: 'Meus Salários', icon: Wallet, match: ['salary', 'freelance'] },
  { id: 'rent', title: 'Meus Aluguéis Recebidos', icon: Home, match: ['rent'] },
  { id: 'benefit', title: 'Meus Benefícios', icon: Gift, match: ['benefit'] },
  { id: 'other', title: 'Outros Recebimentos', icon: CircleDollarSign, match: ['other', 'investment'] },
];
const groupOf = (cat) => (INCOME_GROUPS.find(g => g.match.includes(cat)) || INCOME_GROUPS[INCOME_GROUPS.length - 1]).id;

/**
 * Entradas recorrentes (salário, aluguel...). O componente tem DOIS modos, para
 * respeitar a separação do módulo:
 *   mode="cadastro"   → Cadastros › Recebimentos Fixos. Só cadastra/edita/exclui.
 *   mode="lancamento" → Lançamentos › Recebimentos. Só CONFIRMA o recebimento do mês
 *                       (lança a entrada). Não permite cadastrar nada.
 */
export default function FixedIncomesTab({ transactions = [], mode = 'cadastro' }) {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const { currentUser } = useAuth();
  const isCadastro = mode === 'cadastro';

  const [incomes, setIncomes] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', value: '', day: 5, category: 'salary' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [actualValue, setActualValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // Seletor "Recebimento": confirma um cadastrado pendente OU lança um avulso.
  const [receiveChooser, setReceiveChooser] = useState(false);
  // Recebimento avulso: entrada de uma vez só, apenas neste mês (não vira cadastro).
  const [manualOpen, setManualOpen] = useState(false);
  const [mForm, setMForm] = useState({ desc: '', value: '', date: new Date().toISOString().slice(0, 10) });
  const [mBusy, setMBusy] = useState(false);
  const [mError, setMError] = useState(null);

  const doManualIncome = async () => {
    const value = parseFloat(String(mForm.value).replace(/\./g, '').replace(',', '.')) || 0;
    if (!mForm.desc.trim() || value <= 0 || mBusy) return;
    setMBusy(true); setMError(null);
    try {
      const [y, mo, d] = (mForm.date || new Date().toISOString().slice(0, 10)).split('-').map(Number);
      const dt = new Date(y, mo - 1, d, 12, 0, 0);
      const low = mForm.desc.toLowerCase();
      const category = (low.includes('salári') || low.includes('salario')) ? 'salary' : (low.includes('freela') ? 'freelance' : 'other');
      await addDoc(collection(db, 'transactions'), {
        description: mForm.desc.trim(),
        amount: value,
        type: 'income',
        category,
        date: dt.toISOString(),
        month: dt.toISOString().slice(0, 7),
        userId: currentUser.uid,
        isFixed: false,
        createdAt: Date.now(),
      });
      setManualOpen(false);
      setMForm({ desc: '', value: '', date: new Date().toISOString().slice(0, 10) });
    } catch (err) {
      console.error('Erro ao lançar recebimento avulso:', err);
      setMError(err?.message || 'Erro inesperado. Tente novamente.');
    }
    setMBusy(false);
  };

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'fixed_incomes'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, snap => setIncomes(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [currentUser]);

  const fmt = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Recebido no mês = marcado em lastReceivedMonth OU existe transação de entrada
  // fixa com o mesmo nome lançada no mês corrente.
  const isReceived = (inc) => {
    if (inc.lastReceivedMonth === currentMonth) return true;
    const name = (inc.name || '').trim().toLowerCase();
    return transactions.some(t => t.type === 'income' && t.isFixed
      && (t.month || String(t.date || '').slice(0, 7)) === currentMonth
      && (t.description || '').trim().toLowerCase() === name);
  };

  const stats = useMemo(() => {
    const total = incomes.reduce((a, i) => a + (parseFloat(i.value) || 0), 0);
    const received = incomes.filter(isReceived).reduce((a, i) => a + (parseFloat(i.value) || 0), 0);
    return { total, received, pending: Math.max(0, total - received) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomes, transactions, currentMonth]);

  // Extrato: últimos recebimentos lançados (exclui movimentos internos).
  const incomeTx = useMemo(() =>
    [...transactions]
      .filter(t => t.type === 'income' && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  , [transactions]);
  const latestIncomes = useMemo(() => incomeTx.slice(0, 30), [incomeTx]);
  // Total já recebido no mês corrente (todas as entradas do mês).
  const monthReceived = useMemo(() =>
    incomeTx
      .filter(t => (t.month || String(t.date || '').slice(0, 7)) === currentMonth)
      .reduce((a, t) => a + (parseFloat(t.amount) || 0), 0)
  , [incomeTx, currentMonth]);

  const resetForm = () => { setForm({ name: '', value: '', day: 5, category: 'salary' }); setEditingId(null); setIsAdding(false); };

  // Submit apenas ABRE a confirmação; a gravação acontece no doSave.
  const requestSave = (e) => {
    e.preventDefault();
    if (!form.name || !form.value) return;
    setSaveError(null);
    setConfirmSave(true);
  };

  const doSave = async () => {
    if (busy) return;
    setBusy(true);
    setSaveError(null);
    try {
      const payload = {
        name: form.name.trim(),
        value: parseFloat(String(form.value).replace(/\./g, '').replace(',', '.')) || 0,
        day: Math.min(31, Math.max(1, parseInt(form.day) || 1)),
        category: form.category || 'salary',
      };
      if (editingId) await updateDoc(doc(db, 'fixed_incomes', editingId), payload);
      else await addDoc(collection(db, 'fixed_incomes'), { ...payload, userId: currentUser.uid, createdAt: Date.now() });
      setConfirmSave(false);
      resetForm();
    } catch (err) {
      console.error('Erro ao salvar recebimento fixo:', err);
      setSaveError(err?.message || 'Erro inesperado. Tente novamente.');
    }
    setBusy(false);
  };

  const openEdit = (inc) => {
    setForm({ name: inc.name || '', value: String(inc.value ?? ''), day: inc.day || 5, category: inc.category || 'salary' });
    setEditingId(inc.id);
    setIsAdding(true);
  };

  const handleDelete = async (id) => {
    try { await deleteDoc(doc(db, 'fixed_incomes', id)); } catch (err) { console.error(err); }
    setDeleteConfirm(null);
  };

  // Confirma o recebimento do mês: lança a entrada e marca o mês como recebido.
  const handleConfirm = async () => {
    if (!confirming || busy) return;
    const value = parseFloat(String(actualValue).replace(/\./g, '').replace(',', '.')) || parseFloat(confirming.value) || 0;
    if (value <= 0) return;
    setBusy(true);
    try {
      const d = new Date();
      await addDoc(collection(db, 'transactions'), {
        description: confirming.name,
        amount: value,
        type: 'income',
        category: confirming.category || 'salary',
        date: d.toISOString(),
        month: d.toISOString().slice(0, 7),
        userId: currentUser.uid,
        createdAt: Date.now(),
        isFixed: true,
        paymentMethod: 'pix',
      });
      await updateDoc(doc(db, 'fixed_incomes', confirming.id), { lastReceivedMonth: currentMonth, lastReceivedValue: value });
      setConfirming(null); setActualValue('');
    } catch (err) { console.error('Erro ao confirmar recebimento:', err); }
    setBusy(false);
  };

  const inputCls = `w-full px-4 py-3 rounded-xl border text-sm font-bold outline-none transition-colors ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;
  const labelCls = 'text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5';
  const sorted = [...incomes].sort((a, b) => (a.day || 0) - (b.day || 0));

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {isCadastro ? 'Recebimentos Fixos' : 'Recebimentos do mês'}
          </h1>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {isCadastro
              ? 'Cadastre seu salário e outras entradas recorrentes — depois é só confirmar em Lançamentos'
              : 'Confirme as entradas recorrentes que já caíram. Para cadastrar, vá em Cadastros › Recebimentos Fixos'}
          </p>
        </div>
        {isCadastro ? (
          <button
            onClick={() => { resetForm(); setIsAdding(true); }}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" /> Novo recebimento
          </button>
        ) : (
          // Um único botão "Recebimento": abre o seletor (confirmar cadastrado ou avulso).
          <button
            onClick={() => setReceiveChooser(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" /> Recebimento
          </button>
        )}
      </div>

      {isCadastro ? (
        /* ══════════ CADASTRO: registro/gestão (tabela, sem status) ══════════ */
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="pat-card p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Recebimentos cadastrados</p>
              <p className={`text-2xl font-black tabular-nums mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{incomes.length}</p>
            </div>
            <div className="pat-card p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Previsto por mês</p>
              <p className="text-2xl font-black tabular-nums mt-1 text-emerald-500">R$ {fmt(stats.total)}</p>
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="pat-card overflow-hidden">
              <div className="text-center py-12">
                <ArrowUpCircle className={`w-10 h-10 mx-auto mb-3 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
                <p className="text-sm font-bold text-slate-500">Nenhum recebimento fixo cadastrado.</p>
                <p className="text-[11px] text-slate-500 mt-1">Use <strong>“Novo recebimento”</strong> no topo para cadastrar.</p>
              </div>
            </div>
          ) : (
            /* Painéis por categoria — só aparecem os grupos que têm itens. */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {INCOME_GROUPS.map(group => {
                const items = sorted.filter(inc => groupOf(inc.category) === group.id);
                if (items.length === 0) return null;
                const subtotal = items.reduce((a, i) => a + (parseFloat(i.value) || 0), 0);
                const GIcon = group.icon;
                return (
                  <div key={group.id} className="pat-card p-4">
                    <div className={`flex items-center justify-between gap-3 pb-3 mb-1 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                          <GIcon className="w-4.5 h-4.5 text-emerald-500" />
                        </span>
                        <div className="min-w-0">
                          <p className={`text-sm font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{group.title}</p>
                          <p className="text-[10px] font-bold text-slate-500">{items.length} {items.length === 1 ? 'recebimento' : 'recebimentos'}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total/mês</p>
                        <p className="text-sm font-black tabular-nums text-emerald-500">R$ {fmt(subtotal)}</p>
                      </div>
                    </div>
                    <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-100'}`}>
                      {items.map(inc => (
                        <div key={inc.id} className={`flex items-center gap-3 py-3 -mx-1 px-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{inc.name}</p>
                            <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Todo dia {inc.day || 1}</p>
                          </div>
                          <span className="text-sm font-black tabular-nums text-emerald-500 shrink-0">R$ {fmt(inc.value)}</span>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button onClick={() => openEdit(inc)} title="Editar" className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setDeleteConfirm(inc.id)} title="Excluir" className={`p-2 rounded-lg text-rose-400 ${isDark ? 'hover:bg-rose-500/10' : 'hover:bg-rose-50'}`}><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* ══════════ LANÇAMENTO: total recebido + extrato ══════════ */
        <>
        <div className="grid grid-cols-2 gap-3">
          <div className="pat-card p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Recebido no mês</p>
            <p className="text-2xl font-black tabular-nums mt-1 text-emerald-500">R$ {fmt(monthReceived)}</p>
            <p className={`text-[11px] mt-0.5 capitalize ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{monthLabel}</p>
          </div>
          <div className="pat-card p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">A receber (cadastrados)</p>
            <p className="text-2xl font-black tabular-nums mt-1 text-amber-500">R$ {fmt(stats.pending)}</p>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ainda não confirmados</p>
          </div>
        </div>
        <div className="pat-card overflow-hidden">
          <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
            <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Últimos recebimentos</p>
            <span className="text-[10px] font-bold text-slate-500">{latestIncomes.length} lançamento{latestIncomes.length === 1 ? '' : 's'}</span>
          </div>
          {latestIncomes.length === 0 ? (
            <div className="text-center py-12">
              <ArrowUpCircle className={`w-10 h-10 mx-auto mb-3 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
              <p className="text-sm font-bold text-slate-500">Nenhum recebimento lançado ainda.</p>
              <p className="text-[11px] text-slate-500 mt-1">Use <strong>“Recebimento”</strong> no topo para confirmar um cadastrado ou lançar um avulso.</p>
            </div>
          ) : (
            <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-100'}`}>
              {latestIncomes.map(t => {
                const dt = t.date ? new Date(t.date) : null;
                return (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                        <ArrowUpCircle className="w-[18px] h-[18px] text-emerald-500" />
                      </span>
                      <div className="min-w-0">
                        <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{t.description || 'Recebimento'}</p>
                        <p className="text-[10px] font-bold text-slate-500">
                          {dt ? dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : '—'}
                          {' · '}{catLabel(t.category)}
                          {t.isFixed ? ' · fixo' : ' · avulso'}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-black tabular-nums text-emerald-500 shrink-0">+ R$ {fmt(parseFloat(t.amount) || 0)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </>
      )}

      {/* Seletor "Recebimento": confirmar um cadastrado pendente ou lançar avulso */}
      {receiveChooser && (() => {
        const pendingList = sorted.filter(inc => !isReceived(inc));
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setReceiveChooser(false)}>
            <div onClick={e => e.stopPropagation()} className={`border rounded-[2rem] w-full max-w-md p-6 relative animate-in zoom-in-95 duration-300 shadow-2xl max-h-[88vh] overflow-y-auto custom-scrollbar ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
              <button onClick={() => setReceiveChooser(false)} className={`absolute top-4 right-4 p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><X className="w-5 h-5" /></button>
              <div className="mb-4">
                <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Lançar recebimento</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 capitalize">{monthLabel}</p>
              </div>

              {/* Cadastrados pendentes: confirmar o recebimento do mês */}
              {pendingList.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-amber-500" /> A receber este mês</p>
                  <div className="space-y-2">
                    {pendingList.map(inc => (
                      <div key={inc.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${isDark ? 'border-amber-500/20 bg-amber-500/[0.05]' : 'border-amber-100 bg-amber-50/60'}`}>
                        <div className="min-w-0">
                          <p className={`text-sm font-black truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{inc.name}</p>
                          <p className="text-[10px] font-bold text-slate-500">Previsto R$ {fmt(inc.value)} · dia {inc.day || 1}</p>
                        </div>
                        <button
                          onClick={() => { setReceiveChooser(false); setConfirming(inc); setActualValue(String(inc.value ?? '')); }}
                          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-400 text-white transition-all active:scale-95"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Flag: recebimento avulso */}
              <button
                onClick={() => { setReceiveChooser(false); setMError(null); setMForm({ desc: '', value: '', date: new Date().toISOString().slice(0, 10) }); setManualOpen(true); }}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.99] ${isDark ? 'border-white/10 hover:bg-white/[0.04]' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <span className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'} text-emerald-500`}>
                  <Plus className="w-5 h-5" />
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Recebimento avulso</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5 leading-relaxed">Uma entrada só deste mês — não vira recebimento fixo.</span>
                </span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Modal: cadastrar / editar */}
      {isAdding && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <form onSubmit={requestSave} className={`border rounded-[2rem] w-full max-w-md p-6 space-y-4 relative animate-in zoom-in-95 duration-300 shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
            <button type="button" onClick={resetForm} className={`absolute top-4 right-4 p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><X className="w-5 h-5" /></button>
            <div>
              <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{editingId ? 'Editar recebimento' : 'Novo recebimento fixo'}</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-0.5">Entrada que se repete todo mês</p>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Descrição</label>
              <input autoFocus className={inputCls} placeholder="Ex: Salário" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Valor (R$)</label>
                <input className={inputCls} inputMode="decimal" placeholder="3500,00" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Dia do mês</label>
                <input className={inputCls} type="number" min="1" max="31" value={form.day} onChange={e => setForm({ ...form, day: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Tipo de recebimento</label>
              <div className="grid grid-cols-2 gap-2">
                {INCOME_CATEGORIES.map(c => (
                  <button
                    key={c.id} type="button" onClick={() => setForm({ ...form, category: c.id })}
                    className={`px-2 py-2.5 rounded-lg text-[11px] font-black transition-all border ${form.category === c.id ? 'bg-emerald-500 text-white border-emerald-500' : (isDark ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={resetForm} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest ${isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Cancelar</button>
              <button type="submit" disabled={busy || !form.name || !form.value} className="flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-50 transition-all">
                {editingId ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: confirmar recebimento do mês */}
      {confirming && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className={`border rounded-[2rem] w-full max-w-sm p-6 space-y-4 relative animate-in zoom-in-95 duration-300 shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
            <div className="text-center">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Confirmar recebimento</h3>
              <p className="text-[11px] text-slate-500 mt-1">{confirming.name} · <span className="capitalize">{monthLabel}</span></p>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Valor recebido (R$)</label>
              <input autoFocus className={inputCls} inputMode="decimal" value={actualValue} onChange={e => setActualValue(e.target.value)} />
              <p className="text-[10px] text-slate-500 mt-1.5">Ajuste se o valor do mês veio diferente do cadastrado.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setConfirming(null); setActualValue(''); }} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest ${isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Cancelar</button>
              <button onClick={handleConfirm} disabled={busy} className="flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-50 transition-all">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: recebimento avulso (só este mês) */}
      {manualOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className={`border rounded-[2rem] w-full max-w-md p-6 space-y-4 relative animate-in zoom-in-95 duration-300 shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
            <button onClick={() => setManualOpen(false)} className={`absolute top-4 right-4 p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><X className="w-5 h-5" /></button>
            <div>
              <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Recebimento avulso</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Uma entrada só deste mês — não vira recebimento fixo.</p>
            </div>
            <div>
              <label className={labelCls}>Descrição</label>
              <input autoFocus className={inputCls} placeholder="Ex: Venda, reembolso, bônus" value={mForm.desc} onChange={e => setMForm({ ...mForm, desc: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Valor (R$)</label>
                <input className={inputCls} inputMode="decimal" placeholder="0,00" value={mForm.value} onChange={e => setMForm({ ...mForm, value: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Data</label>
                <input type="date" className={inputCls} value={mForm.date} onChange={e => setMForm({ ...mForm, date: e.target.value })} />
              </div>
            </div>
            {mError && (
              <div className={`flex items-start gap-2 p-3 rounded-xl border ${isDark ? 'bg-rose-500/10 border-rose-500/25' : 'bg-rose-50 border-rose-200'}`}>
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-rose-400 leading-relaxed break-words">{mError}</p>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setManualOpen(false)} disabled={mBusy} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest disabled:opacity-50 ${isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Cancelar</button>
              <button onClick={doManualIncome} disabled={mBusy || !mForm.desc.trim() || !mForm.value} className="flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-400 text-slate-900 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {mBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> Lançando...</> : 'Lançar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de cadastro/edição */}
      <ConfirmSaveDialog
        open={confirmSave}
        title={editingId ? 'Salvar alterações?' : 'Cadastrar este recebimento?'}
        message={editingId ? 'Os valores passam a valer para as próximas confirmações.' : 'Depois é só confirmar o recebimento todo mês em Lançamentos.'}
        confirmLabel={editingId ? 'Salvar alterações' : 'Cadastrar'}
        details={[
          { label: 'Descrição', value: form.name },
          { label: 'Valor', value: form.value ? `R$ ${form.value}` : '—' },
          { label: 'Dia', value: `Dia ${form.day || 1}` },
          { label: 'Categoria', value: catLabel(form.category) },
        ]}
        busy={busy}
        error={saveError}
        onConfirm={doSave}
        onCancel={() => { setConfirmSave(false); setSaveError(null); }}
      />

      {/* Confirmação de exclusão */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className={`border rounded-[2rem] w-full max-w-sm p-6 space-y-4 text-center animate-in zoom-in-95 duration-300 shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}><Trash2 className="w-6 h-6 text-rose-500" /></div>
            <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Excluir recebimento fixo?</h3>
            <p className="text-[11px] text-slate-500">Isso remove só o cadastro. As entradas já lançadas continuam no extrato.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest ${isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest bg-rose-500 hover:bg-rose-400 text-white transition-all">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
