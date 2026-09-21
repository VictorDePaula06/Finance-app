import React, { useState, useMemo } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { toast } from './ui/Toaster';
import AliviaFormHint from './AliviaFormHint';
import BankLogo, { detectBank } from './ui/BankLogo';
import { CreditCard, X, Check, Loader2 } from 'lucide-react';

// ── Cartão de crédito: formulário de novo/editar ────────────────────
// Único lugar onde cartões são cadastrados/editados (Configurações e
// Cadastros → Cadastros, e o onboarding). A tela "Meu cartão" só usa.

const numBR = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
const normalizeName = (s) => { const t = String(s || '').trim().replace(/\s+/g, ' '); return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t; };

export const BRANDS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard', 'Outra'];
export const COLORS = [
    { id: 'from-purple-600 to-indigo-700', dot: 'bg-gradient-to-br from-purple-600 to-indigo-700' },
    { id: 'from-slate-700 to-slate-900', dot: 'bg-gradient-to-br from-slate-700 to-slate-900' },
    { id: 'from-emerald-600 to-teal-700', dot: 'bg-gradient-to-br from-emerald-600 to-teal-700' },
    { id: 'from-blue-600 to-cyan-700', dot: 'bg-gradient-to-br from-blue-600 to-cyan-700' },
    { id: 'from-rose-600 to-pink-700', dot: 'bg-gradient-to-br from-rose-600 to-pink-700' },
    { id: 'from-amber-500 to-orange-700', dot: 'bg-gradient-to-br from-amber-500 to-orange-700' },
];
export const gradOf = (c) => (c && c.includes('from-') ? c : 'from-slate-700 to-slate-900');

export default function CardForm({ isDark, uid, editing, onClose, onSaved, hint }) {
    const [name, setName] = useState(editing?.name || '');
    const [bank, setBank] = useState(editing?.bank || '');
    const [brand, setBrand] = useState(editing?.brand || 'Visa');
    const [last4, setLast4] = useState(editing?.last4 || '');
    const [limit, setLimit] = useState(editing?.limit != null ? String(editing.limit).replace('.', ',') : '');
    const [closingDay, setClosingDay] = useState(String(editing?.closingDay || 1));
    const [dueDay, setDueDay] = useState(String(editing?.dueDay || 10));
    const [manualColor, setManualColor] = useState(gradOf(editing?.color));
    const [colorTouched, setColorTouched] = useState(!!editing);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Banco reconhecido pelo que a pessoa digita (nome do cartão ou banco).
    const detected = useMemo(() => detectBank(bank, name), [bank, name]);
    // Ao reconhecer o banco, o cartão já ganha a cor da marca — até a pessoa escolher outra.
    const color = (detected && !colorTouched) ? detected.grad : manualColor;
    // Prévia: se o nome já cita o banco ("Picpay epic"), não repete o banco na linha de baixo.
    const bankLabel = detected?.label || bank.trim();
    const nameHasBank = !!bankLabel && name.toLowerCase().includes(bankLabel.toLowerCase().split(' ')[0]);
    const previewSub = [nameHasBank ? null : bankLabel, last4 ? `•••• ${last4}` : null].filter(Boolean).join(' · ') || 'Banco';

    const inputCls = `w-full px-3.5 py-3 rounded-xl border text-sm font-semibold outline-none transition ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500'}`;
    const optStyle = { backgroundColor: isDark ? '#17181b' : '#ffffff', color: isDark ? '#e2e8f0' : '#1e293b' };

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!name.trim()) { setError('Dê um nome ao cartão.'); return; }
        setSaving(true);
        const data = {
            name: normalizeName(name), bank: bank.trim() ? (detected?.label || normalizeName(bank)) : (detected?.label || ''),
            brand, bankId: detected?.id || null,
            last4: String(last4).replace(/\D/g, '').slice(0, 4),
            limit: numBR(limit) || null,
            closingDay: Math.min(31, Math.max(1, parseInt(closingDay) || 1)),
            dueDay: Math.min(31, Math.max(1, parseInt(dueDay) || 10)),
            color,
        };
        try {
            if (editing) { await updateDoc(doc(db, 'cards', editing.id), data); onSaved?.(editing.id); }
            else { const ref = await addDoc(collection(db, 'cards'), { ...data, userId: uid, createdAt: Date.now() }); onSaved?.(ref.id); }
            toast.success(editing ? 'Cartão atualizado!' : 'Cartão adicionado!');
            onClose();
        } catch (err) { console.error(err); toast.error('Não foi possível salvar. Tente de novo.'); setError('Não foi possível salvar. Tente de novo.'); setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative w-full max-w-md rounded-3xl border shadow-2xl p-6 max-h-[92vh] overflow-y-auto ${isDark ? 'bg-[#141518] border-white/10' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/12 text-emerald-500"><CreditCard className="w-5 h-5" strokeWidth={2.4} /></span>
                        <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{editing ? 'Editar cartão' : 'Novo cartão'}</h2>
                    </div>
                    <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><X className="w-4 h-4" /></button>
                </div>

                <form onSubmit={submit} className="space-y-3.5">
                    <AliviaFormHint isDark={isDark} text={hint} />
                    {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-3 py-2.5 rounded-xl text-[12px] text-center font-bold">{error}</div>}

                    {/* Prévia do cartão — mostra o logo real assim que o banco é reconhecido */}
                    <div className={`relative rounded-2xl p-4 text-white bg-gradient-to-br ${color} overflow-hidden`}>
                        <div className="absolute -right-8 -top-10 w-32 h-32 rounded-full bg-white/10" />
                        <div className="relative flex items-center gap-3">
                            <BankLogo bank={detected} className="w-11 h-11" />
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">{brand}</p>
                                <p className="text-[15px] font-black tracking-tight truncate">{name.trim() || 'Meu cartão'}</p>
                                <p className="text-[11px] font-semibold text-white/70 truncate">{previewSub}</p>
                            </div>
                        </div>
                    </div>

                    <Field label="Nome do cartão"><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Nubank Roxinho" className={inputCls} maxLength={30} autoFocus /></Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Banco">
                            <input value={bank} onChange={e => setBank(e.target.value)} placeholder="Ex.: Nubank, PicPay, Itaú" className={inputCls} maxLength={20} list="alivia-banks" />
                            <datalist id="alivia-banks">{['Nubank', 'PicPay', 'Itaú', 'Inter', 'Bradesco', 'Santander', 'Caixa', 'Banco do Brasil', 'C6 Bank', 'XP', 'Mercado Pago', 'Neon', 'Next', 'BTG Pactual', 'Sicoob', 'Sicredi', 'Banco Pan', 'Will Bank', 'Digio', 'PagBank'].map(b => <option key={b} value={b} />)}</datalist>
                        </Field>
                        <Field label="Bandeira">
                            <select value={brand} onChange={e => setBrand(e.target.value)} className={inputCls} style={{ colorScheme: isDark ? 'dark' : 'light' }}>
                                {BRANDS.map(b => <option key={b} value={b} style={optStyle}>{b}</option>)}
                            </select>
                        </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Final (4 dígitos)"><input inputMode="numeric" value={last4} onChange={e => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" className={inputCls} /></Field>
                        <Field label="Limite (R$)"><input inputMode="decimal" value={limit} onChange={e => setLimit(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0,00" className={inputCls} /></Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Dia do fechamento"><input inputMode="numeric" value={closingDay} onChange={e => setClosingDay(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="1" className={inputCls} /></Field>
                        <Field label="Dia do vencimento"><input inputMode="numeric" value={dueDay} onChange={e => setDueDay(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="10" className={inputCls} /></Field>
                    </div>
                    <div>
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">Cor do cartão {detected && !colorTouched && <span className="normal-case tracking-normal font-bold text-emerald-500">· cor do {detected.label}</span>}</span>
                        <div className="flex gap-2 flex-wrap">
                            {detected && (
                                <button type="button" title={`Cor do ${detected.label}`} onClick={() => { setColorTouched(false); }}
                                    className={`w-9 h-9 rounded-xl bg-gradient-to-br ${detected.grad} transition ${color === detected.grad ? 'ring-2 ring-offset-2 ring-emerald-500 ' + (isDark ? 'ring-offset-slate-900' : 'ring-offset-white') : ''}`} />
                            )}
                            {COLORS.map(c => (
                                <button key={c.id} type="button" onClick={() => { setManualColor(c.id); setColorTouched(true); }}
                                    className={`w-9 h-9 rounded-xl ${c.dot} transition ${color === c.id ? 'ring-2 ring-offset-2 ring-emerald-500 ' + (isDark ? 'ring-offset-slate-900' : 'ring-offset-white') : ''}`} />
                            ))}
                        </div>
                    </div>
                    <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-70">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> {editing ? 'Salvar' : 'Cadastrar'}</>}
                    </button>
                </form>
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return <label className="block"><span className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">{label}</span>{children}</label>;
}
