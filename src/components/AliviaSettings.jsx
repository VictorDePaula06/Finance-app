import React, { useState } from 'react';
import { CreditCard, Sparkles, ArrowRight, Save, CheckCircle2, Scale, Wallet, Target } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { DEFAULT_HEALTH_CONFIG } from '../utils/healthScore';

// Campo com seletor de unidade (% / R$ / meses) — usado nas metas do índice.
function UnitField({ isDark, label, hint, value, setValue, unit, setUnit, options }) {
    const isMoney = unit === 'amount';
    const suffix = options.find(o => o.id === unit)?.suffix;
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5 gap-2">
                <label className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</label>
                <div className={`flex gap-0.5 rounded-lg p-0.5 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                    {options.map(o => (
                        <button
                            key={o.id} type="button" onClick={() => setUnit(o.id)}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                                unit === o.id ? 'bg-emerald-500 text-white shadow' : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800')
                            }`}
                        >{o.short}</button>
                    ))}
                </div>
            </div>
            <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                {isMoney && <span className="text-xs font-bold text-slate-500">R$</span>}
                <input
                    type="text" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)}
                    className={`flex-1 bg-transparent font-bold text-sm focus:outline-none ${isDark ? 'text-white' : 'text-slate-800'}`}
                />
                {suffix && <span className="text-xs font-bold text-slate-500">{suffix}</span>}
            </div>
            {hint && <p className="text-[10px] text-slate-500 mt-1">{hint}</p>}
        </div>
    );
}

// Cabeçalho de subseção dentro do painel de configuração.
function Group({ isDark, icon: Icon, title, desc, children }) {
    return (
        <div className={`rounded-2xl border p-4 ${isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-100 shadow-sm'}`}>
            <div className="flex items-start gap-2.5 mb-3">
                <span className={`p-1.5 rounded-lg shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}><Icon className="w-4 h-4 text-emerald-500" /></span>
                <div className="min-w-0">
                    <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{title}</p>
                    {desc && <p className="text-[10px] text-slate-500 leading-snug">{desc}</p>}
                </div>
            </div>
            <div className="space-y-3">{children}</div>
        </div>
    );
}

/**
 * Painel de configuração da Alívia (Controle de Gastos inteiro), usado na aba
 * Ajustes. Salva em manualConfig via onSave (merge completo do config).
 */
export default function AliviaSettings({ config = {}, onSave }) {
    const { theme } = useTheme();
    const isDark = theme !== 'light';

    const hc = { ...DEFAULT_HEALTH_CONFIG, ...(config.healthConfig || {}) };
    const [income, setIncome] = useState(config.income ? String(config.income) : '');
    const [surplusUnit, setSurplusUnit] = useState(hc.surplusUnit);
    const [surplusVal, setSurplusVal] = useState(String(hc.surplusUnit === 'amount' ? (hc.surplusTargetAmount || '') : hc.surplusTargetPct));
    const [reserveUnit, setReserveUnit] = useState(hc.reserveUnit);
    const [reserveVal, setReserveVal] = useState(String(hc.reserveUnit === 'amount' ? (hc.reserveTargetAmount || '') : hc.reserveTargetMonths));
    const [superUnit, setSuperUnit] = useState(hc.superfluousUnit);
    const [superVal, setSuperVal] = useState(String(hc.superfluousUnit === 'amount' ? (hc.superfluousCapAmount || '') : hc.superfluousCap));
    const [includeInvoice, setIncludeInvoice] = useState(!!hc.includeInvoice);
    const [expenseBasis, setExpenseBasis] = useState(config.expenseBasis === 'caixa' ? 'caixa' : 'competencia');
    const [saved, setSaved] = useState(false);

    const num = (v, fb) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? fb : n; };

    const handleSave = () => {
        onSave?.({
            ...config,
            income: num(income, config.income || 0),
            expenseBasis,
            healthConfig: {
                includeInvoice,
                surplusUnit,
                surplusTargetPct: surplusUnit === 'percent' ? Math.max(0, num(surplusVal, 20)) : hc.surplusTargetPct,
                surplusTargetAmount: surplusUnit === 'amount' ? Math.max(0, num(surplusVal, 0)) : hc.surplusTargetAmount,
                reserveUnit,
                reserveTargetMonths: reserveUnit === 'months' ? Math.max(1, num(reserveVal, 6)) : hc.reserveTargetMonths,
                reserveTargetAmount: reserveUnit === 'amount' ? Math.max(0, num(reserveVal, 0)) : hc.reserveTargetAmount,
                superfluousUnit: superUnit,
                superfluousCap: superUnit === 'percent' ? Math.max(1, num(superVal, 30)) : hc.superfluousCap,
                superfluousCapAmount: superUnit === 'amount' ? Math.max(0, num(superVal, 0)) : hc.superfluousCapAmount,
            },
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2200);
    };

    return (
        <div className="space-y-4">
            {/* Como contar os gastos do mês */}
            <Group isDark={isDark} icon={Scale} title="Como contar os gastos do mês"
                desc="Vale para todo o Controle de Gastos: Visão Geral, Contas, Despesas, Cartões e o Índice.">
                <div className="grid grid-cols-1 gap-2">
                    <button type="button" onClick={() => setExpenseBasis('competencia')}
                        className={`w-full flex items-start gap-3 p-3 rounded-2xl border text-left transition-all ${
                            expenseBasis === 'competencia'
                                ? (isDark ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-emerald-50 border-emerald-300')
                                : (isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')
                        }`}>
                        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 ${expenseBasis === 'competencia' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-400'}`} />
                        <div className="flex-1 min-w-0">
                            <p className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Pela data da compra (competência)</p>
                            <p className="text-[10px] text-slate-500 leading-snug">O gasto conta no mês em que você comprou — <b>inclusive no cartão</b>. O pagamento da fatura <b>não</b> conta como gasto (a compra já contou). Ideal pra saber quanto você gastou de fato no mês.</p>
                        </div>
                    </button>
                    <button type="button" onClick={() => setExpenseBasis('caixa')}
                        className={`w-full flex items-start gap-3 p-3 rounded-2xl border text-left transition-all ${
                            expenseBasis === 'caixa'
                                ? (isDark ? 'bg-blue-500/10 border-blue-500/40' : 'bg-blue-50 border-blue-300')
                                : (isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')
                        }`}>
                        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 ${expenseBasis === 'caixa' ? 'border-blue-500 bg-blue-500' : 'border-slate-400'}`} />
                        <div className="flex-1 min-w-0">
                            <p className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Quando sai da conta (caixa)</p>
                            <p className="text-[10px] text-slate-500 leading-snug">O gasto conta quando o dinheiro <b>sai da conta</b>. Compras no cartão só contam quando você <b>paga a fatura</b> — e a fatura conta no mês em que foi paga. Ideal pra acompanhar o fluxo da conta.</p>
                        </div>
                    </button>
                </div>
            </Group>

            {/* Cartão e fatura */}
            <Group isDark={isDark} icon={CreditCard} title="Cartão e fatura"
                desc="Como a fatura aparece no seu Índice de Saúde.">
                <button type="button" onClick={() => setIncludeInvoice(v => !v)}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
                        includeInvoice
                            ? (isDark ? 'bg-violet-500/10 border-violet-500/30' : 'bg-violet-50 border-violet-200')
                            : (isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')
                    }`}>
                    <CreditCard className={`w-5 h-5 shrink-0 ${includeInvoice ? 'text-violet-400' : 'text-slate-400'}`} />
                    <div className="flex-1 min-w-0">
                        <p className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Apurar fatura aberta do cartão</p>
                        <p className="text-[10px] text-slate-500 leading-snug">Mostra os dados da fatura em aberto (cartão, valor e vencimento) dentro do índice.</p>
                    </div>
                    <div className={`w-10 h-6 rounded-full flex items-center px-1 transition-all shrink-0 ${includeInvoice ? 'bg-violet-500 justify-end' : (isDark ? 'bg-white/10 justify-start' : 'bg-slate-200 justify-start')}`}>
                        <div className="w-4 h-4 bg-white rounded-full shadow" />
                    </div>
                </button>
            </Group>

            {/* Renda e metas do índice */}
            <Group isDark={isDark} icon={Target} title="Índice de Saúde — renda e metas"
                desc="Renda base e as metas que definem a sua nota de saúde financeira.">
                <div>
                    <label className={`text-[10px] font-black uppercase tracking-widest block mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Renda base mensal</label>
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="text-xs font-bold text-slate-500">R$</span>
                        <input type="text" inputMode="decimal" value={income} onChange={e => setIncome(e.target.value)} className={`flex-1 bg-transparent font-bold text-sm focus:outline-none ${isDark ? 'text-white' : 'text-slate-800'}`} />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Usada quando você ainda não lançou recebimentos no mês. Se houver renda lançada, ela tem prioridade.</p>
                </div>

                <UnitField isDark={isDark} label="Meta de sobra mensal" hint="Quanto você quer que sobre por mês." value={surplusVal} setValue={setSurplusVal}
                    unit={surplusUnit} setUnit={setSurplusUnit}
                    options={[{ id: 'percent', short: '%', suffix: '% da renda' }, { id: 'amount', short: 'R$', suffix: null }]} />

                <UnitField isDark={isDark} label="Meta de reserva de emergência" hint="O tamanho ideal da sua reserva." value={reserveVal} setValue={setReserveVal}
                    unit={reserveUnit} setUnit={setReserveUnit}
                    options={[{ id: 'months', short: 'Meses', suffix: 'meses' }, { id: 'amount', short: 'R$', suffix: null }]} />

                <UnitField isDark={isDark} label="Teto de gastos supérfluos" hint="Limite saudável de supérfluos." value={superVal} setValue={setSuperVal}
                    unit={superUnit} setUnit={setSuperUnit}
                    options={[{ id: 'percent', short: '%', suffix: '% da renda' }, { id: 'amount', short: 'R$', suffix: null }]} />
            </Group>

            {/* Objetivos e perfil */}
            <Group isDark={isDark} icon={Wallet} title="Perfil financeiro"
                desc="Objetivos, perfil de risco e renda usados pela Alívia nas recomendações.">
                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-alivia-config'))}
                    className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border text-left transition-all ${isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                        <div className="min-w-0">
                            <p className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>Objetivos e Perfil de risco</p>
                            <p className="text-[10px] text-slate-500 leading-snug">Abrir o assistente completo de objetivos e perfil da Alívia.</p>
                        </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
            </Group>

            {/* Salvar */}
            <button onClick={handleSave}
                className={`w-full py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                    saved ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20'
                }`}>
                {saved ? <><CheckCircle2 className="w-4 h-4" /> Salvo!</> : <><Save className="w-4 h-4" /> Salvar configurações</>}
            </button>
        </div>
    );
}
