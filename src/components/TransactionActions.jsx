import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';

// Editar/excluir um lançamento (transação de receita ou despesa) direto do extrato.
// Reutilizado em Lançamentos › Recebimentos, Despesas e Cartão.

const parseBR = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;

// ── Modal de edição ──
export function EditTxModal({ tx, categories = [], onClose }) {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const [form, setForm] = useState({ description: '', value: '', date: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tx) return;
    setForm({
      description: tx.description || '',
      value: tx.amount != null ? String(tx.amount) : '',
      date: String(tx.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      category: tx.category || (categories[0]?.id || 'other'),
    });
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx]);

  if (!tx) return null;
  const isIncome = tx.type === 'income';
  const inputCls = `w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold outline-none transition-colors ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-600 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;
  const lbl = 'text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5';

  const save = async () => {
    const value = parseBR(form.value);
    if (!form.description.trim() || value <= 0 || busy) return;
    setBusy(true); setError(null);
    try {
      const ds = form.date || new Date().toISOString().slice(0, 10);
      const [y, m, d] = ds.split('-').map(Number);
      const dt = new Date(y, m - 1, d, 12, 0, 0);
      await updateDoc(doc(db, 'transactions', tx.id), {
        description: form.description.trim(),
        amount: value,
        date: dt.toISOString(),
        month: dt.toISOString().slice(0, 7),
        ...(form.category ? { category: form.category } : {}),
      });
      onClose?.();
    } catch (err) {
      console.error('Erro ao editar lançamento:', err);
      setError(err?.message || 'Erro inesperado. Tente novamente.');
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className={`border rounded-[2rem] w-full max-w-md p-6 space-y-4 relative animate-in zoom-in-95 duration-300 shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
        <button onClick={onClose} className={`absolute top-4 right-4 p-2 rounded-lg ${isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}><X className="w-5 h-5" /></button>
        <div>
          <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Editar {isIncome ? 'recebimento' : 'lançamento'}</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Corrija os dados deste lançamento.</p>
        </div>
        <div>
          <label className={lbl}>Descrição</label>
          <input autoFocus className={inputCls} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Valor (R$)</label>
            <input className={inputCls} inputMode="decimal" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>Data</label>
            <input type="date" className={inputCls} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
        </div>
        {categories.length > 0 && (
          <div>
            <label className={lbl}>Categoria</label>
            <select className={inputCls} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {categories.map(c => <option key={c.id} value={c.id} className={isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'}>{c.label}</option>)}
            </select>
          </div>
        )}
        {error && (
          <div className={`flex items-start gap-2 p-3 rounded-xl border ${isDark ? 'bg-rose-500/10 border-rose-500/25' : 'bg-rose-50 border-rose-200'}`}>
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-rose-400 leading-relaxed break-words">{error}</p>
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} disabled={busy} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest disabled:opacity-50 ${isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Cancelar</button>
          <button onClick={save} disabled={busy || !form.description.trim() || !form.value} className="flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal de confirmação de exclusão ──
export function DeleteTxDialog({ tx, onClose }) {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (!tx) return null;

  const remove = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await deleteDoc(doc(db, 'transactions', tx.id));
      onClose?.();
    } catch (err) {
      console.error('Erro ao excluir lançamento:', err);
      setError(err?.message || 'Erro inesperado. Tente novamente.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className={`border rounded-[2rem] w-full max-w-sm p-6 space-y-4 text-center animate-in zoom-in-95 duration-300 shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}><Trash2 className="w-6 h-6 text-rose-500" /></div>
        <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Excluir este lançamento?</h3>
        <p className="text-[11px] text-slate-500">
          <span className="font-bold">{tx.description || 'Lançamento'}</span> será removido do seu extrato. Essa ação não pode ser desfeita.
        </p>
        {error && <p className="text-[10px] text-rose-400">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} disabled={busy} className={`flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest disabled:opacity-50 ${isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Cancelar</button>
          <button onClick={remove} disabled={busy} className="flex-1 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest bg-rose-500 hover:bg-rose-400 text-white disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Excluindo...</> : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}
