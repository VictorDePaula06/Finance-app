import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { categoryHex } from '../constants/categories';
import { toast } from './ui/Toaster';
import { ceilingsFrom, ceilingRows, NEAR_RATIO } from '../utils/categoryCeilings';
import { Target, Pencil, Trash2, Check, X, Loader2, ChevronDown, MessageCircle, LayoutDashboard } from 'lucide-react';

// ── Teto de gasto por categoria (dentro de Cadastros) ───────────────
// Lista todas as categorias de gasto; a pessoa define um teto mensal em cada
// uma. Recolhido, mostra só os 3 maiores tetos; "Ver todas" expande.
// Salva em manualConfig.categoryBudgets (mesmo campo de Análises/Metas).

const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numBR = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
const monthKeyNow = () => new Date().toISOString().slice(0, 7);
const PREVIEW = 3;

const LEVEL = {
    ok: { bar: 'bg-emerald-500', text: 'text-emerald-500', label: 'No limite' },
    near: { bar: 'bg-amber-500', text: 'text-amber-500', label: 'Perto do teto' },
    over: { bar: 'bg-rose-500', text: 'text-rose-500', label: 'Passou do teto' },
};

export default function CategoryCeilings({ isDark }) {
    const { currentUser, userPrefs, saveUserPreferences } = useAuth();
    const uid = currentUser?.uid;
    const mk = monthKeyNow();

    const [tx, setTx] = useState([]);
    const [expanded, setExpanded] = useState(false);
    const [editing, setEditing] = useState(null); // catId em edição
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!uid) return;
        return onSnapshot(query(collection(db, 'transactions'), where('userId', '==', uid)),
            (s) => setTx(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    }, [uid]);

    const ceilings = useMemo(() => ceilingsFrom(userPrefs), [userPrefs]);
    const rows = useMemo(() => ceilingRows(tx, ceilings, mk), [tx, ceilings, mk]);
    const defined = rows.filter(r => r.ceiling > 0);

    // Recolhido: os 3 MAIORES tetos. Expandido: todas (com teto primeiro, maior → menor).
    const sorted = useMemo(() => [...rows].sort((a, b) => (b.ceiling - a.ceiling) || a.label.localeCompare(b.label)), [rows]);
    const shown = expanded ? sorted : sorted.slice(0, PREVIEW).filter(r => r.ceiling > 0);
    const hidden = rows.length - shown.length;

    const startEdit = (r) => { setEditing(r.id); setDraft(r.ceiling > 0 ? String(r.ceiling).replace('.', ',') : ''); };
    const cancel = () => { setEditing(null); setDraft(''); };

    const persist = async (catId, value) => {
        setSaving(true);
        try {
            const budgets = { ...(userPrefs?.manualConfig?.categoryBudgets || {}) };
            if (value > 0) budgets[catId] = value; else delete budgets[catId];
            await saveUserPreferences({ manualConfig: { ...(userPrefs?.manualConfig || {}), categoryBudgets: budgets } });
            toast.success(value > 0 ? 'Teto salvo!' : 'Teto removido.');
            cancel();
        } catch (e) { console.error(e); toast.error('Não foi possível salvar o teto.'); }
        setSaving(false);
    };
    const save = (catId) => persist(catId, numBR(draft));

    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';
    const th = `px-4 py-2.5 text-left text-[11px] font-black uppercase tracking-wider whitespace-nowrap ${muted}`;
    const inputCls = `w-28 px-3 py-1.5 rounded-lg border text-[13px] font-bold tabular-nums outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;

    return (
        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]'}`}>
            {/* Cabeçalho */}
            <div className={`flex items-center justify-between gap-3 flex-wrap px-4 sm:px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                <div className="min-w-0">
                    <h2 className={`text-[15px] font-black tracking-tight flex items-center gap-2.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        <span className="w-7 h-7 rounded-lg bg-emerald-500/12 text-emerald-500 flex items-center justify-center shrink-0"><Target className="w-4 h-4" /></span>
                        Teto por categoria
                    </h2>
                    <p className={`text-[12px] mt-1 ${muted}`}>Quanto, no máximo, você quer gastar por mês em cada categoria. Ex.: até R$ 1.000 em Alimentação.</p>
                </div>
                <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                    {defined.length} de {rows.length} com teto
                </span>
            </div>

            {/* Onde a Alívia avisa */}
            <div className={`px-4 sm:px-5 py-2.5 border-b flex items-center gap-x-4 gap-y-1 flex-wrap text-[11.5px] ${isDark ? 'border-white/[0.06] text-slate-400' : 'border-slate-100 text-slate-500'}`}>
                <span className="inline-flex items-center gap-1.5"><LayoutDashboard className="w-3.5 h-3.5 text-emerald-500" /> Alívia avisa no <b>Dashboard</b></span>
                <span className="inline-flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5 text-emerald-500" /> e no <b>WhatsApp</b> a cada gasto</span>
                <span className={`inline-flex items-center gap-1.5 ${muted}`}>· a partir de {Math.round(NEAR_RATIO * 100)}% do teto</span>
            </div>

            {shown.length === 0 && !expanded ? (
                <div className="py-10 text-center px-4">
                    <Target className={`w-7 h-7 mx-auto mb-2.5 ${muted}`} />
                    <p className={`text-sm font-bold ${cell}`}>Nenhum teto definido ainda</p>
                    <p className={`text-xs mt-1 ${muted}`}>Defina um limite mensal e a Alívia te avisa antes de estourar.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className={isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}>
                                <th className={th}>Categoria</th>
                                <th className={`${th} hidden sm:table-cell`}>Gasto no mês</th>
                                <th className={th}>Teto mensal</th>
                                <th className={`${th} hidden md:table-cell w-[26%]`}>Uso</th>
                                <th className={`${th} text-right`}>Ações</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                            {shown.map(r => {
                                const hex = categoryHex(r);
                                const Icon = r.icon;
                                const lv = LEVEL[r.level];
                                const isEd = editing === r.id;
                                return (
                                    <tr key={r.id} className={`transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/70'}`}>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${hex}1f`, color: hex }}>{Icon && <Icon className="w-4 h-4" />}</span>
                                                <div className="min-w-0">
                                                    <p className={`font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.label}</p>
                                                    <p className={`text-[11px] sm:hidden ${muted}`}>Gasto: R$ {money(r.spent)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={`px-4 py-2.5 hidden sm:table-cell tabular-nums whitespace-nowrap ${cell}`}>R$ {money(r.spent)}</td>
                                        <td className="px-4 py-2.5 whitespace-nowrap">
                                            {isEd ? (
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`text-[12px] font-bold ${muted}`}>R$</span>
                                                    <input autoFocus inputMode="decimal" value={draft} placeholder="0,00" className={inputCls}
                                                        onChange={e => setDraft(e.target.value.replace(/[^0-9.,]/g, ''))}
                                                        onKeyDown={e => { if (e.key === 'Enter') save(r.id); if (e.key === 'Escape') cancel(); }} />
                                                </div>
                                            ) : r.ceiling > 0 ? (
                                                <span className={`font-black tabular-nums ${isDark ? 'text-white' : 'text-slate-800'}`}>R$ {money(r.ceiling)}</span>
                                            ) : (
                                                <button onClick={() => startEdit(r)} className={`text-[12px] font-bold underline-offset-2 hover:underline ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Definir teto</button>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 hidden md:table-cell">
                                            {r.ceiling > 0 ? (
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                                                        <div className={`h-full rounded-full transition-all duration-500 ${lv.bar}`} style={{ width: `${Math.min(100, r.pct)}%` }} />
                                                    </div>
                                                    <span className={`text-[11px] font-black tabular-nums w-10 text-right ${lv.text}`}>{r.pct}%</span>
                                                </div>
                                            ) : <span className={`text-[11px] ${muted}`}>—</span>}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-end gap-0.5">
                                                {isEd ? (
                                                    <>
                                                        <button onClick={() => save(r.id)} disabled={saving} title="Salvar" className="p-2 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={3} />}</button>
                                                        <button onClick={cancel} disabled={saving} title="Cancelar" className={`p-2 rounded-lg transition ${muted} ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}><X className="w-4 h-4" /></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => startEdit(r)} title={r.ceiling > 0 ? 'Editar teto' : 'Definir teto'}
                                                            className={`p-2 rounded-lg transition ${muted} ${isDark ? 'hover:bg-white/5 hover:text-emerald-400' : 'hover:bg-slate-100 hover:text-emerald-600'}`}><Pencil className="w-4 h-4" /></button>
                                                        <button onClick={() => persist(r.id, 0)} disabled={!(r.ceiling > 0) || saving} title="Remover teto"
                                                            className={`p-2 rounded-lg transition disabled:opacity-30 disabled:pointer-events-none ${muted} ${isDark ? 'hover:bg-white/5 hover:text-rose-500' : 'hover:bg-slate-100 hover:text-rose-500'}`}><Trash2 className="w-4 h-4" /></button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Expandir / recolher */}
            <button onClick={() => { setExpanded(v => !v); cancel(); }}
                className={`w-full flex items-center justify-center gap-1.5 px-4 py-3 border-t text-[12.5px] font-bold transition ${isDark ? 'border-white/[0.06] text-slate-300 hover:bg-white/[0.03]' : 'border-slate-100 text-slate-600 hover:bg-slate-50'}`}>
                {expanded ? 'Mostrar só os maiores' : `Ver todas as categorias${hidden > 0 ? ` (${hidden} a mais)` : ''}`}
                <ChevronDown className={`w-4 h-4 text-emerald-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
        </div>
    );
}
