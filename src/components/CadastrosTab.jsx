import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { CATEGORIES, categoryHex } from '../constants/categories';
import ConfirmActionModal from './ConfirmActionModal';
import CategoryCeilings from './CategoryCeilings';
import CardsRegistry from './CardsRegistry';
import { toast } from './ui/Toaster';
import {
    Plus, Pencil, Trash2, X, Check, Loader2, TrendingUp, TrendingDown, ClipboardList,
} from 'lucide-react';

// ── Cadastros: entradas e despesas recorrentes ─────────────────────
// Lista única (tabela) com tudo que se repete todo mês. Aqui a pessoa só
// CADASTRA / EDITA / EXCLUI; a baixa mensal continua em "Recorrentes".
// Grava nas mesmas coleções (fixed_incomes / fixed_expenses) — o que é
// cadastrado aqui aparece imediatamente em Recorrentes e no Dashboard.

const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numBR = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
// Padroniza a descrição: 1ª letra maiúscula, resto minúsculo (ex.: "ALUGUEL" → "Aluguel").
const normalizeName = (s) => {
    const t = String(s || '').trim().replace(/\s+/g, ' ');
    return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t;
};
const PAY_LABEL = { pix: 'PIX', boleto: 'Boleto', credito: 'Cartão de crédito' };

const KIND = {
    income: { collection: 'fixed_incomes', cats: CATEGORIES.income, defaultCat: 'salary', label: 'Entrada', icon: TrendingUp },
    expense: { collection: 'fixed_expenses', cats: CATEGORIES.expense, defaultCat: 'conta_fixa', label: 'Despesa', icon: TrendingDown },
};
const catMetaOf = (kind, id) => KIND[kind].cats.find(c => c.id === id) || { label: 'Outro', color: 'text-slate-400', icon: null };

export default function CadastrosTab({ isDark }) {
    const { currentUser } = useAuth();
    const uid = currentUser?.uid;

    const [incomes, setIncomes] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [cards, setCards] = useState([]);
    const [filter, setFilter] = useState('all'); // 'all' | 'income' | 'expense'
    const [form, setForm] = useState(null);      // { editing } — editing = null (novo) ou registro
    const [del, setDel] = useState(null);        // registro a excluir

    useEffect(() => {
        if (!uid) return;
        const unsubI = onSnapshot(query(collection(db, 'fixed_incomes'), where('userId', '==', uid)),
            (s) => setIncomes(s.docs.map(d => ({ id: d.id, kind: 'income', ...d.data() }))), () => {});
        const unsubE = onSnapshot(query(collection(db, 'fixed_expenses'), where('userId', '==', uid)),
            (s) => setExpenses(s.docs.map(d => ({ id: d.id, kind: 'expense', ...d.data() }))), () => {});
        const unsubC = onSnapshot(query(collection(db, 'cards'), where('userId', '==', uid)),
            (s) => setCards(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
        return () => { unsubI(); unsubE(); unsubC(); };
    }, [uid]);

    // Uma lista só: entradas primeiro, depois despesas; dentro de cada tipo, por dia.
    const rows = useMemo(() => {
        const all = [...incomes, ...expenses].filter(r => filter === 'all' || r.kind === filter);
        return all.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'income' ? -1 : 1)
            || (a.day || 0) - (b.day || 0)
            || String(a.name || '').localeCompare(String(b.name || '')));
    }, [incomes, expenses, filter]);

    const cardName = (id) => cards.find(c => c.id === id)?.name || 'Cartão';
    const muted = isDark ? 'text-slate-500' : 'text-slate-400';
    const cell = isDark ? 'text-slate-300' : 'text-slate-700';
    const th = `px-4 py-2.5 text-left text-[11px] font-black uppercase tracking-wider whitespace-nowrap ${muted}`;

    const counts = { all: incomes.length + expenses.length, income: incomes.length, expense: expenses.length };

    return (
        <div className="space-y-4">
        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]'}`}>
            {/* Cabeçalho da lista */}
            <div className={`flex items-center justify-between gap-3 flex-wrap px-4 sm:px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                <div className="min-w-0">
                    <h2 className={`text-[15px] font-black tracking-tight flex items-center gap-2.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        <span className="w-7 h-7 rounded-lg bg-emerald-500/12 text-emerald-500 flex items-center justify-center shrink-0"><ClipboardList className="w-4 h-4" /></span>
                        Entradas e despesas recorrentes
                    </h2>
                    <p className={`text-[12px] mt-1 ${muted}`}>O que entra e o que sai todo mês. Cadastre uma vez; a baixa mensal fica em Recorrentes.</p>
                </div>
                <button onClick={() => setForm({ editing: null })}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-bold shadow-md shadow-emerald-500/25 transition active:scale-95">
                    <Plus className="w-4 h-4" strokeWidth={3} /> Adicionar
                </button>
            </div>

            {/* Filtro por tipo */}
            <div className={`flex items-center gap-1 px-4 sm:px-5 py-2.5 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                {[['all', 'Todos'], ['income', 'Entradas'], ['expense', 'Despesas']].map(([id, label]) => {
                    const on = filter === id;
                    return (
                        <button key={id} onClick={() => setFilter(id)}
                            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition ${on
                                ? 'bg-emerald-500/12 text-emerald-500'
                                : (isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100')}`}>
                            {label} <span className={`ml-1 text-[10px] ${on ? 'text-emerald-500/80' : muted}`}>{counts[id]}</span>
                        </button>
                    );
                })}
            </div>

            {/* Tabela */}
            {rows.length === 0 ? (
                <div className="py-12 text-center px-4">
                    <ClipboardList className={`w-7 h-7 mx-auto mb-2.5 ${muted}`} />
                    <p className={`text-sm font-bold ${cell}`}>Nenhum cadastro ainda</p>
                    <p className={`text-xs mt-1 ${muted}`}>Clique em <b>Adicionar</b> pra cadastrar seu salário, aluguel, internet, assinaturas…</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className={isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}>
                                <th className={th}>Nome</th>
                                <th className={th}>Tipo</th>
                                <th className={`${th} hidden sm:table-cell`}>Categoria</th>
                                <th className={`${th} text-right`}>Valor</th>
                                <th className={`${th} hidden md:table-cell`}>Dia</th>
                                <th className={`${th} hidden md:table-cell`}>Pagamento</th>
                                <th className={`${th} text-right`}>Ações</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                            {rows.map(r => {
                                const income = r.kind === 'income';
                                const c = catMetaOf(r.kind, r.category);
                                const hex = categoryHex(c);
                                const CIcon = c.icon;
                                const pay = income ? '—' : (r.paymentMethod === 'credito' ? `Cartão · ${cardName(r.cardId)}` : PAY_LABEL[r.paymentMethod] || 'PIX');
                                return (
                                    <tr key={r.id} className={`transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/70'}`}>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${hex}1f`, color: hex }}>{CIcon && <CIcon className="w-4 h-4" />}</span>
                                                <div className="min-w-0">
                                                    <p className={`font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.name}</p>
                                                    <p className={`text-[11px] ${muted}`}>{r.isVariable ? 'Variável' : 'Fixa'}<span className="sm:hidden"> · {c.label}</span></p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${income ? 'bg-emerald-500/12 text-emerald-500' : 'bg-rose-500/12 text-rose-500'}`}>
                                                {income ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />} {KIND[r.kind].label}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 hidden sm:table-cell ${cell}`}>{c.label}</td>
                                        <td className={`px-4 py-3 text-right font-black tabular-nums whitespace-nowrap ${income ? 'text-emerald-500' : 'text-rose-500'}`}>{income ? '+' : '−'} R$ {money(r.value)}</td>
                                        <td className={`px-4 py-3 hidden md:table-cell whitespace-nowrap ${cell}`}>Dia {r.day || 1}</td>
                                        <td className={`px-4 py-3 hidden md:table-cell whitespace-nowrap ${cell}`}>{pay}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-0.5">
                                                <button onClick={() => setForm({ editing: r })} title="Editar"
                                                    className={`p-2 rounded-lg transition ${muted} ${isDark ? 'hover:bg-white/5 hover:text-emerald-400' : 'hover:bg-slate-100 hover:text-emerald-600'}`}><Pencil className="w-4 h-4" /></button>
                                                <button onClick={() => setDel(r)} title="Excluir"
                                                    className={`p-2 rounded-lg transition ${muted} ${isDark ? 'hover:bg-white/5 hover:text-rose-500' : 'hover:bg-slate-100 hover:text-rose-500'}`}><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {form && <CadastroForm isDark={isDark} uid={uid} editing={form.editing} cards={cards} onClose={() => setForm(null)} />}

            {del && (
                <ConfirmActionModal isDark={isDark} type="delete" name={del.name}
                    noun={del.kind === 'income' ? 'entrada recorrente' : 'despesa recorrente'}
                    warning={del.kind === 'expense' && del.paymentMethod === 'credito' && del.cardId
                        ? `Esta despesa é paga no cartão ${cardName(del.cardId)} e entra na fatura. Ao excluir, ela deixa de ser lançada nas próximas faturas.` : null}
                    onClose={() => setDel(null)}
                    onConfirm={async () => { await deleteDoc(doc(db, KIND[del.kind].collection, del.id)); toast.success('Cadastro excluído.'); }} />
            )}
        </div>

        {/* Cartões de crédito (cadastro único — Meu cartão só usa) */}
        <CardsRegistry isDark={isDark} />

        {/* Teto de gasto por categoria */}
        <CategoryCeilings isDark={isDark} />
        </div>
    );
}

// ── Formulário (novo / editar) ──────────────────────────────────────
// Pergunta o TIPO primeiro (entrada/despesa); a categoria muda conforme o tipo.
function CadastroForm({ isDark, uid, editing, cards, onClose }) {
    const [kind, setKind] = useState(editing?.kind || 'income');
    const [name, setName] = useState(editing?.name || '');
    const [value, setValue] = useState(editing?.value != null ? String(editing.value).replace('.', ',') : '');
    const [category, setCategory] = useState(editing?.category || KIND[editing?.kind || 'income'].defaultCat);
    const [day, setDay] = useState(String(editing?.day || 5));
    const [isVariable, setIsVariable] = useState(!!editing?.isVariable);
    const [payMethod, setPayMethod] = useState(editing?.paymentMethod || 'pix');
    const [cardId, setCardId] = useState(editing?.cardId || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const cfg = KIND[kind];
    const income = kind === 'income';

    // Ao trocar o tipo (só em cadastro novo), a categoria volta pro padrão daquele tipo.
    const changeKind = (k) => { setKind(k); setCategory(KIND[k].defaultCat); setError(''); };

    const inputCls = `w-full px-3.5 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;
    const optStyle = { backgroundColor: isDark ? '#17181b' : '#ffffff', color: isDark ? '#e2e8f0' : '#1e293b' };
    const selectStyle = { colorScheme: isDark ? 'dark' : 'light' };

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!name.trim() || !numBR(value)) { setError('Preencha nome e valor.'); return; }
        if (!income && payMethod === 'credito' && !cardId) { setError('Selecione o cartão de crédito.'); return; }
        setSaving(true);
        const data = {
            name: normalizeName(name), value: numBR(value), category,
            day: Math.min(31, Math.max(1, parseInt(day) || 1)), isVariable,
        };
        if (!income) {
            data.priority = catMetaOf('expense', category).defaultPriority || 'essential';
            data.paymentMethod = payMethod;
            data.cardId = payMethod === 'credito' ? cardId : '';
        }
        try {
            if (editing) { await updateDoc(doc(db, cfg.collection, editing.id), data); toast.success('Cadastro atualizado!'); }
            else { await addDoc(collection(db, cfg.collection), { ...data, userId: uid, createdAt: Date.now() }); toast.success(income ? 'Entrada cadastrada!' : 'Despesa cadastrada!'); }
            onClose();
        } catch (err) { console.error(err); setError('Não foi possível salvar. Tente de novo.'); setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative w-full max-w-md rounded-3xl border shadow-2xl p-6 max-h-[92vh] overflow-y-auto ${isDark ? 'bg-[#141518] border-white/10' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{editing ? 'Editar cadastro' : 'Novo cadastro'}</h2>
                    <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><X className="w-4 h-4" /></button>
                </div>

                <form onSubmit={submit} className="space-y-3.5">
                    {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-2.5 rounded-xl text-[12px] text-center font-bold">{error}</div>}

                    {/* Tipo — em edição não muda (a coleção é outra) */}
                    <Field label="Tipo">
                        <div className={`grid grid-cols-2 gap-1 p-1 rounded-xl border ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-100/70'}`}>
                            {['income', 'expense'].map(k => {
                                const on = kind === k;
                                const Icon = KIND[k].icon;
                                const inc = k === 'income';
                                return (
                                    <button key={k} type="button" disabled={!!editing} onClick={() => changeKind(k)}
                                        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-bold transition disabled:cursor-not-allowed ${on
                                            ? (inc ? 'bg-emerald-500 text-white shadow-sm' : 'bg-rose-500 text-white shadow-sm')
                                            : (isDark ? 'text-slate-400 hover:text-slate-200 disabled:opacity-40' : 'text-slate-500 hover:text-slate-800 disabled:opacity-40')}`}>
                                        <Icon className="w-4 h-4" /> {KIND[k].label}
                                    </button>
                                );
                            })}
                        </div>
                    </Field>

                    <Field label="Nome"><input value={name} onChange={e => setName(e.target.value)} placeholder={income ? 'Ex.: Salário, Aluguel recebido' : 'Ex.: Aluguel, Internet, Netflix'} className={inputCls} maxLength={50} autoFocus /></Field>

                    <Field label="Categoria">
                        <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls} style={selectStyle}>
                            {cfg.cats.map(c => <option key={c.id} value={c.id} style={optStyle}>{c.label}</option>)}
                        </select>
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Valor (R$)"><input inputMode="decimal" value={value} onChange={e => setValue(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0,00" className={inputCls} /></Field>
                        <Field label={income ? 'Recebe no dia' : 'Vence no dia'}><input inputMode="numeric" value={day} onChange={e => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="5" className={inputCls} /></Field>
                    </div>

                    <Field label="Fixo ou variável">
                        <div className={`grid grid-cols-2 gap-1 p-1 rounded-xl border ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-100/70'}`}>
                            {[[false, 'Fixo', 'mesmo valor todo mês'], [true, 'Variável', income ? 'ex.: comissão' : 'ex.: luz, água']].map(([v, label, hint]) => {
                                const on = isVariable === v;
                                return (
                                    <button key={label} type="button" onClick={() => setIsVariable(v)}
                                        className={`flex flex-col items-center py-1.5 rounded-lg transition ${on
                                            ? (isDark ? 'bg-white/10 text-white shadow-sm' : 'bg-white text-slate-800 shadow-[0_1px_4px_rgba(0,0,0,0.08)]')
                                            : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')}`}>
                                        <span className="text-[13px] font-bold">{label}</span>
                                        <span className={`text-[10px] ${on ? (isDark ? 'text-slate-300' : 'text-slate-500') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>{hint}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </Field>

                    {!income && (
                        <Field label="Forma de pagamento">
                            <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={inputCls} style={selectStyle}>
                                {Object.entries(PAY_LABEL).map(([id, label]) => <option key={id} value={id} style={optStyle}>{label}</option>)}
                            </select>
                        </Field>
                    )}
                    {!income && payMethod === 'credito' && (
                        <Field label="Cartão de crédito">
                            {cards.length === 0 ? (
                                <p className={`text-[12px] font-semibold px-3.5 py-3 rounded-xl border ${isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                                    Nenhum cartão cadastrado. Cadastre em <span className="text-emerald-500 font-bold">Meu cartão</span> e volte aqui.
                                </p>
                            ) : (
                                <select value={cardId} onChange={e => setCardId(e.target.value)} className={inputCls} style={selectStyle}>
                                    <option value="" style={optStyle}>Selecione o cartão…</option>
                                    {cards.map(c => <option key={c.id} value={c.id} style={optStyle}>{c.name || c.bank || 'Cartão'}</option>)}
                                </select>
                            )}
                        </Field>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-1">
                        <button type="button" onClick={onClose} className={`py-3 rounded-xl font-bold text-sm border transition ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Cancelar</button>
                        <button type="submit" disabled={saving} className="py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-70">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> {editing ? 'Salvar' : 'Cadastrar'}</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return <label className="block"><span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">{label}</span>{children}</label>;
}
