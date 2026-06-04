import React, { useState } from 'react';
import { CreditCard, Save, Check, Pencil, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { DEFAULT_HEALTH_CONFIG } from '../utils/healthScore';

const num = (v, fb) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? fb : n; };

// Campo numérico compacto com seletor de unidade.
function MetaField({ isDark, label, value, setValue, unit, setUnit, options, disabled }) {
    const isMoney = unit === 'amount';
    const suffix = options.find(o => o.id === unit)?.suffix;
    return (
        <div>
            <div className="flex items-center justify-between mb-1 gap-2">
                <label className="text-[10px] font-bold text-slate-500">{label}</label>
                <div className={`flex gap-0.5 rounded-md p-0.5 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                    {options.map(o => (
                        <button key={o.id} type="button" disabled={disabled} onClick={() => setUnit(o.id)}
                            className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${
                                unit === o.id ? 'bg-emerald-500 text-white' : (isDark ? 'text-slate-400' : 'text-slate-500')
                            } ${disabled ? 'cursor-default' : ''}`}>{o.short}</button>
                    ))}
                </div>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} ${disabled ? 'opacity-70' : ''}`}>
                {isMoney && <span className="text-xs font-bold text-slate-500">R$</span>}
                <input type="text" inputMode="decimal" value={value} disabled={disabled} onChange={e => setValue(e.target.value)}
                    className={`flex-1 min-w-0 bg-transparent font-bold text-sm focus:outline-none ${isDark ? 'text-white' : 'text-slate-800'}`} />
                {suffix && <span className="text-[10px] font-bold text-slate-500 shrink-0">{suffix}</span>}
            </div>
        </div>
    );
}

export default function AliviaSettings({ config = {}, onSave }) {
    const { theme } = useTheme();
    const isDark = theme !== 'light';

    const fromConfig = () => {
        const hc = { ...DEFAULT_HEALTH_CONFIG, ...(config.healthConfig || {}) };
        return {
            expenseBasis: config.expenseBasis === 'caixa' ? 'caixa' : 'competencia',
            includeInvoice: !!hc.includeInvoice,
            income: config.income ? String(config.income) : '',
            surplusUnit: hc.surplusUnit,
            surplusVal: String(hc.surplusUnit === 'amount' ? (hc.surplusTargetAmount || '') : hc.surplusTargetPct),
            reserveUnit: hc.reserveUnit,
            reserveVal: String(hc.reserveUnit === 'amount' ? (hc.reserveTargetAmount || '') : hc.reserveTargetMonths),
            superUnit: hc.superfluousUnit,
            superVal: String(hc.superfluousUnit === 'amount' ? (hc.superfluousCapAmount || '') : hc.superfluousCap),
        };
    };

    const [v, setV] = useState(fromConfig);
    const [editing, setEditing] = useState(false);
    const [justSaved, setJustSaved] = useState(false);
    const set = (k, val) => setV(prev => ({ ...prev, [k]: val }));

    const handleEdit = () => { setEditing(true); setJustSaved(false); };
    const handleCancel = () => { setV(fromConfig()); setEditing(false); };
    const handleSave = () => {
        const hc = { ...DEFAULT_HEALTH_CONFIG, ...(config.healthConfig || {}) };
        onSave?.({
            ...config,
            income: num(v.income, config.income || 0),
            expenseBasis: v.expenseBasis,
            healthConfig: {
                includeInvoice: v.includeInvoice,
                surplusUnit: v.surplusUnit,
                surplusTargetPct: v.surplusUnit === 'percent' ? Math.max(0, num(v.surplusVal, 20)) : hc.surplusTargetPct,
                surplusTargetAmount: v.surplusUnit === 'amount' ? Math.max(0, num(v.surplusVal, 0)) : hc.surplusTargetAmount,
                reserveUnit: v.reserveUnit,
                reserveTargetMonths: v.reserveUnit === 'months' ? Math.max(1, num(v.reserveVal, 6)) : hc.reserveTargetMonths,
                reserveTargetAmount: v.reserveUnit === 'amount' ? Math.max(0, num(v.reserveVal, 0)) : hc.reserveTargetAmount,
                superfluousUnit: v.superUnit,
                superfluousCap: v.superUnit === 'percent' ? Math.max(1, num(v.superVal, 30)) : hc.superfluousCap,
                superfluousCapAmount: v.superUnit === 'amount' ? Math.max(0, num(v.superVal, 0)) : hc.superfluousCapAmount,
            },
        });
        setEditing(false);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2500);
    };

    const d = !editing;
    const opt = (active) => `flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${d ? 'cursor-default' : ''} ${
        active
            ? (isDark ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-emerald-50 border-emerald-300')
            : (isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200')
    }`;

    return (
        <div className={`space-y-3.5 ${d ? 'opacity-95' : ''}`}>
            {/* Barra de ação: Editar / Salvar */}
            <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500 leading-snug">
                    Ajuste como a Alívia conta seus gastos e calcula sua saúde financeira.
                </p>
                {editing ? (
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={handleCancel} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Cancelar</button>
                        <button onClick={handleSave} className="px-3.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500 text-white hover:bg-emerald-600 flex items-center gap-1.5 shadow-sm"><Save className="w-3.5 h-3.5" /> Salvar</button>
                    </div>
                ) : (
                    <button onClick={handleEdit} className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 shrink-0 transition-all ${justSaved ? 'bg-emerald-500/15 text-emerald-500' : (isDark ? 'bg-white/5 text-slate-200 hover:bg-white/10 border border-white/10' : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200')}`}>
                        {justSaved ? <><Check className="w-3.5 h-3.5" /> Salvo</> : <><Pencil className="w-3.5 h-3.5" /> Editar</>}
                    </button>
                )}
            </div>

            {/* Como contar os gastos */}
            <div>
                <p className={`text-sm font-bold mb-0.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>Como contar seus gastos</p>
                <p className="text-[11px] text-slate-500 mb-2">Vale para a Visão Geral, Contas, Despesas, Cartões e o Índice.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button type="button" disabled={d} onClick={() => set('expenseBasis', 'competencia')} className={opt(v.expenseBasis === 'competencia')}>
                        <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 ${v.expenseBasis === 'competencia' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-400'}`} />
                        <div className="min-w-0">
                            <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Na data da compra</p>
                            <p className="text-[10px] text-slate-500 leading-snug">Conta no mês em que você comprou, incluindo o cartão. A fatura paga não conta de novo.</p>
                        </div>
                    </button>
                    <button type="button" disabled={d} onClick={() => set('expenseBasis', 'caixa')} className={opt(v.expenseBasis === 'caixa')}>
                        <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 ${v.expenseBasis === 'caixa' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-400'}`} />
                        <div className="min-w-0">
                            <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Quando você paga</p>
                            <p className="text-[10px] text-slate-500 leading-snug">Conta quando o dinheiro sai da conta. O cartão entra só quando a fatura é paga.</p>
                        </div>
                    </button>
                </div>
            </div>

            {/* Cartão e fatura */}
            <button type="button" disabled={d} onClick={() => set('includeInvoice', !v.includeInvoice)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${d ? 'cursor-default' : ''} ${
                    v.includeInvoice ? (isDark ? 'bg-violet-500/10 border-violet-500/30' : 'bg-violet-50 border-violet-200') : (isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200')
                }`}>
                <CreditCard className={`w-4 h-4 shrink-0 ${v.includeInvoice ? 'text-violet-400' : 'text-slate-400'}`} />
                <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Mostrar a fatura aberta do cartão</p>
                    <p className="text-[10px] text-slate-500 leading-snug">Exibe valor e vencimento da fatura em aberto dentro do Índice.</p>
                </div>
                <div className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-all shrink-0 ${v.includeInvoice ? 'bg-violet-500 justify-end' : (isDark ? 'bg-white/10 justify-start' : 'bg-slate-300 justify-start')}`}>
                    <div className="w-4 h-4 bg-white rounded-full shadow" />
                </div>
            </button>

            {/* Índice: renda e metas */}
            <div>
                <p className={`text-sm font-bold mb-0.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>Renda e metas do Índice</p>
                <p className="text-[11px] text-slate-500 mb-2">Sua renda base e as metas que definem a sua nota.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 mb-1 block">Renda base mensal</label>
                        <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} ${d ? 'opacity-70' : ''}`}>
                            <span className="text-xs font-bold text-slate-500">R$</span>
                            <input type="text" inputMode="decimal" value={v.income} disabled={d} onChange={e => set('income', e.target.value)} className={`flex-1 min-w-0 bg-transparent font-bold text-sm focus:outline-none ${isDark ? 'text-white' : 'text-slate-800'}`} />
                        </div>
                    </div>
                    <MetaField isDark={isDark} disabled={d} label="Meta de sobra" value={v.surplusVal} setValue={x => set('surplusVal', x)} unit={v.surplusUnit} setUnit={x => set('surplusUnit', x)}
                        options={[{ id: 'percent', short: '%', suffix: '% da renda' }, { id: 'amount', short: 'R$', suffix: null }]} />
                    <MetaField isDark={isDark} disabled={d} label="Reserva de emergência" value={v.reserveVal} setValue={x => set('reserveVal', x)} unit={v.reserveUnit} setUnit={x => set('reserveUnit', x)}
                        options={[{ id: 'months', short: 'Meses', suffix: 'meses' }, { id: 'amount', short: 'R$', suffix: null }]} />
                    <MetaField isDark={isDark} disabled={d} label="Teto de supérfluos" value={v.superVal} setValue={x => set('superVal', x)} unit={v.superUnit} setUnit={x => set('superUnit', x)}
                        options={[{ id: 'percent', short: '%', suffix: '% da renda' }, { id: 'amount', short: 'R$', suffix: null }]} />
                </div>
            </div>
        </div>
    );
}
