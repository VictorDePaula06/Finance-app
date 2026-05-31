import React, { useMemo, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Eye, EyeOff, Pencil, Check, X, CreditCard, AlertTriangle, ChevronRight, TrendingUp } from 'lucide-react';
import FinancialHealthIndex from './FinancialHealthIndex';

export default function OverviewTab({
    transactions,
    walletStats,
    healthIndex,
    manualConfig,
    onUpdateConfig,
    theme,
    hideBalance,
    toggleHideBalance,
    onSetInitialBalance,
    cards = [],
    subscriptions = [],
    setActiveTab
}) {
    const [editingWallet, setEditingWallet] = useState(false);
    const [walletInput, setWalletInput] = useState('');

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    // Prepare data for "Ativos e Saldos" small chart (last 7 days balance evolution)
    // Calcula o saldo retroativo real a partir das transações (não mais mock data).
    const balanceHistoryData = useMemo(() => {
        const data = [];
        const today = new Date();
        const currentBalance = walletStats.balance || 0;

        // Soma o impacto de cada dia futuro a partir do passado (income +, expense não-credito -)
        // Para reconstituir o saldo de N dias atrás: começamos do balance atual e
        // desfazemos as transações posteriores.
        const isAffecting = (t) => {
            if (t.paymentMethod === 'credito') return false;
            return t.type === 'income' || t.type === 'expense';
        };

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setHours(0, 0, 0, 0);
            d.setDate(today.getDate() - i);
            const labelDate = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

            // Soma das transações entre (d, hoje]
            let delta = 0;
            transactions.forEach(t => {
                if (!isAffecting(t)) return;
                const txDate = new Date(t.date);
                if (isNaN(txDate.getTime())) return;
                if (txDate > d && txDate <= today) {
                    const val = parseFloat(t.amount) || 0;
                    delta += (t.type === 'income' ? val : -val);
                }
            });
            const balanceOnThatDay = currentBalance - delta;
            data.push({ name: labelDate, value: balanceOnThatDay });
        }
        return data;
    }, [walletStats.balance, transactions]);

    // Fatura(s) de cartão em aberto — mesma lógica da aba Cartões.
    const invoiceInfo = useMemo(() => {
        const getInvoiceMonth = (dateStr, closingDay) => {
            const d = new Date(dateStr); if (isNaN(d.getTime())) return '';
            let month = d.getMonth(), year = d.getFullYear();
            if (d.getDate() >= closingDay) { month += 1; if (month > 11) { month = 0; year += 1; } }
            return `${year}-${String(month + 1).padStart(2, '0')}`;
        };
        const now = new Date();
        const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let total = 0; const pending = [];
        (cards || []).forEach(card => {
            const closingDay = card.closingDay || ((card.dueDay - 7 > 0) ? card.dueDay - 7 : 25);
            const currInv = getInvoiceMonth(now.toISOString(), closingDay);
            const unpaid = transactions.filter(t => t.selectedCardId === card.id && t.invoiceStatus === 'unpaid');
            const subs = (subscriptions || []).filter(s => s.cardId === card.id).filter(s => {
                if (s.lastPaidMonth === currInv) return false;
                const subDay = parseInt(s.day) || 1;
                const chargeDate = new Date(now.getFullYear(), now.getMonth(), subDay, 12, 0, 0);
                return getInvoiceMonth(chargeDate.toISOString(), closingDay) <= currInv;
            });
            const sum = unpaid.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0) + subs.reduce((a, s) => a + (parseFloat(s.value) || 0), 0);
            if (sum > 0.005) {
                let due = new Date(now.getFullYear(), now.getMonth(), card.dueDay || 10);
                if (due < t0) due = new Date(now.getFullYear(), now.getMonth() + 1, card.dueDay || 10);
                pending.push({ card, sum, due });
                total += sum;
            }
        });
        pending.sort((a, b) => a.due - b.due);
        const nearest = pending[0];
        const daysUntil = nearest ? Math.max(0, Math.ceil((nearest.due - t0) / 86400000)) : 0;
        const label = pending.length === 0 ? '' : pending.length === 1
            ? [nearest.card.name, nearest.card.brand].filter(Boolean).join(' · ')
            : `${pending.length} cartões`;
        return { total, daysUntil, dueDate: nearest?.due || null, label };
    }, [cards, subscriptions, transactions]);

    // Variação do saldo no mês (entradas - saídas do mês vs base anterior).
    const monthDelta = (walletStats.income || 0) - (walletStats.expense || 0);
    const monthBase = (walletStats.balance || 0) - monthDelta;
    const pctMonth = monthBase > 0 ? (monthDelta / monthBase) * 100 : null;

    const textColor = theme === 'light' ? 'text-slate-800' : 'text-white';
    const subTextColor = theme === 'light' ? 'text-slate-500' : 'text-slate-400';

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* ROW 1: Hero do Saldo Total em Carteira */}
            <div className={`rounded-3xl border overflow-hidden ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-[#1e2330] border-slate-700/50'}`}>
                <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">Saldo Total em Carteira</span>
                                <button onClick={toggleHideBalance} className="text-slate-400 hover:text-blue-500 transition-colors">
                                    {hideBalance ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                                {!editingWallet && (
                                    <button
                                        onClick={() => { setWalletInput((Number(walletStats?.balance) || 0).toFixed(2).replace('.', ',')); setEditingWallet(true); }}
                                        title="Ajustar saldo atual"
                                        className="text-slate-400 hover:text-emerald-400 transition-colors"
                                    >
                                        <Pencil size={13} />
                                    </button>
                                )}
                            </div>
                            {editingWallet ? (
                                <div className="flex items-center gap-1 mt-1">
                                    <span className={`text-lg font-bold ${subTextColor}`}>R$</span>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={walletInput}
                                        onChange={e => setWalletInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                const val = parseFloat(walletInput.replace(',', '.'));
                                                if (!isNaN(val) && onSetInitialBalance) { onSetInitialBalance(val); }
                                                setEditingWallet(false);
                                            }
                                            if (e.key === 'Escape') setEditingWallet(false);
                                        }}
                                        className={`w-40 text-3xl font-bold bg-transparent border-b-2 border-emerald-500 focus:outline-none ${textColor}`}
                                    />
                                    <button
                                        onClick={() => {
                                            const val = parseFloat(walletInput.replace(',', '.'));
                                            if (!isNaN(val) && onSetInitialBalance) { onSetInitialBalance(val); }
                                            setEditingWallet(false);
                                        }}
                                        className="text-emerald-400 hover:text-emerald-300 transition-colors ml-1"
                                    ><Check size={18} /></button>
                                    <button onClick={() => setEditingWallet(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div className={`text-3xl md:text-4xl font-black tracking-tight tabular-nums ${hideBalance ? 'blur-md select-none' : 'text-blue-400'}`}>
                                    {hideBalance ? 'R$ 0.000,00' : formatCurrency(walletStats.balance)}
                                </div>
                            )}
                            <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 mt-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Saldo atual disponível em conta
                            </p>
                        </div>

                        <div className="flex flex-col items-end gap-3 shrink-0">
                            {pctMonth != null && isFinite(pctMonth) && (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${pctMonth >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                    <TrendingUp className={`w-3.5 h-3.5 ${pctMonth < 0 ? 'rotate-180' : ''}`} />
                                    {pctMonth >= 0 ? '+' : ''}{pctMonth.toFixed(0)}% este mês
                                </span>
                            )}
                            <div className="w-28 h-12 hidden sm:block">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={balanceHistoryData}>
                                        <defs>
                                            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <Area type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorBalance)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Banner de fatura pendente */}
                    {invoiceInfo.total > 0.005 && (
                        <button
                            onClick={() => setActiveTab && setActiveTab('cartoes')}
                            className={`mt-4 w-full text-left flex items-center gap-4 p-3 rounded-2xl border transition-all hover:scale-[1.005] active:scale-[0.997] ${theme === 'light' ? 'bg-amber-50 border-amber-200' : 'bg-amber-500/[0.07] border-amber-500/30'}`}
                        >
                            <span className={`hidden sm:flex w-11 h-9 rounded-lg items-center justify-center shrink-0 ${theme === 'light' ? 'bg-amber-100' : 'bg-amber-500/15'}`}>
                                <CreditCard className="w-5 h-5 text-amber-500" />
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-500">
                                        <AlertTriangle className="w-3 h-3" /> Fatura Pendente
                                    </span>
                                    <span className={`text-[11px] font-medium ${subTextColor}`}>{invoiceInfo.label}</span>
                                </div>
                                <p className={`text-xs md:text-[13px] mt-0.5 ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                                    Você lançou <span className="font-bold text-amber-500">{formatCurrency(invoiceInfo.total)}</span> no crédito — esse valor ainda não saiu da sua conta.
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <div className={`text-base md:text-lg font-black tabular-nums ${hideBalance ? 'blur-md select-none' : 'text-amber-500'}`}>{hideBalance ? 'R$ 0,00' : formatCurrency(invoiceInfo.total)}</div>
                                {invoiceInfo.dueDate && (
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                        Vence em <span className="font-bold text-amber-500">{invoiceInfo.daysUntil} {invoiceInfo.daysUntil === 1 ? 'dia' : 'dias'}</span> · {invoiceInfo.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                    </div>
                                )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
                        </button>
                    )}
                </div>

                {/* Rodapé: Saldo atual · Fatura a vencer · Saldo após fatura */}
                {invoiceInfo.total > 0.005 && (
                    <div className={`grid grid-cols-3 divide-x border-t ${theme === 'light' ? 'border-slate-100 divide-slate-100 bg-slate-50/50' : 'border-white/5 divide-white/5 bg-black/10'}`}>
                        <div className="px-4 py-2.5 md:px-5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Saldo atual</span>
                            <div className={`text-sm md:text-base font-black tabular-nums ${hideBalance ? 'blur-md select-none' : textColor}`}>{hideBalance ? 'R$ 0,00' : formatCurrency(walletStats.balance)}</div>
                            <span className="text-[9px] text-slate-400">disponível agora</span>
                        </div>
                        <div className="px-4 py-2.5 md:px-5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500">Fatura a vencer</span>
                            <div className={`text-sm md:text-base font-black tabular-nums text-amber-500 ${hideBalance ? 'blur-md select-none' : ''}`}>{hideBalance ? 'R$ 0,00' : `- ${formatCurrency(invoiceInfo.total)}`}</div>
                            <span className="text-[9px] text-slate-400">{invoiceInfo.daysUntil > 0 ? `vence em ${invoiceInfo.daysUntil} ${invoiceInfo.daysUntil === 1 ? 'dia' : 'dias'}` : 'vence hoje'}</span>
                        </div>
                        <div className="px-4 py-2.5 md:px-5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500">Saldo após fatura</span>
                            <div className={`text-sm md:text-base font-black tabular-nums ${hideBalance ? 'blur-md select-none' : (walletStats.balance - invoiceInfo.total >= 0 ? 'text-emerald-500' : 'text-rose-500')}`}>{hideBalance ? 'R$ 0,00' : formatCurrency(walletStats.balance - invoiceInfo.total)}</div>
                            <span className="text-[9px] text-slate-400">estimativa pós-pagamento</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ROW 2: Índice de Saúde Financeira */}
            <FinancialHealthIndex
                data={healthIndex}
                config={manualConfig}
                onUpdateConfig={onUpdateConfig}
            />

        </div>
    );
}
