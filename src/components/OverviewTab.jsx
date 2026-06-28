import React, { useMemo, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Eye, EyeOff, CreditCard, ChevronRight, TrendingUp, TrendingDown, ShieldCheck, ArrowUpRight, ArrowDownRight, Wallet, X } from 'lucide-react';
import FinancialHealthIndex from './FinancialHealthIndex';

const CAT_COLORS = { housing: '#FB7185', food: '#FB923C', fast_food: '#F59E0B', transport: '#FACC15', health: '#F87171', education: '#60A5FA', pets: '#B45309', personal_care: '#F9A8D4', subscriptions: '#C084FC', credit_card: '#8B5CF6', church: '#93C5FD', taxes: '#64748B', leisure: '#818CF8', shopping: '#F472B6', credit_card_bill: '#8B5CF6', conta_fixa: '#6366F1', loan: '#FB7185', other: '#94A3B8' };
const CAT_LABELS = { housing: 'Moradia', food: 'Alimentação', fast_food: 'Fast Food', transport: 'Transporte', health: 'Saúde', education: 'Educação', pets: 'Pets', personal_care: 'Cuidados', subscriptions: 'Assinaturas', credit_card: 'Cartão', church: 'Igreja', taxes: 'Taxas', leisure: 'Lazer', shopping: 'Compras', credit_card_bill: 'Fatura', conta_fixa: 'Conta Fixa', loan: 'Empréstimo', other: 'Outros' };

export default function OverviewTab({
    transactions,
    walletStats,
    investmentStats = {},
    healthIndex,
    manualConfig,
    onUpdateConfig,
    theme,
    hideBalance,
    toggleHideBalance,
    onSetInitialBalance,
    cards = [],
    subscriptions = [],
    savingsJars = [],
    setActiveTab,
    setActiveModule
}) {
    const [showReserve, setShowReserve] = useState(false);

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
            // O dia de fechamento ainda é da fatura que fecha; vira só no dia seguinte.
            if (d.getDate() > closingDay) { month += 1; if (month > 11) { month = 0; year += 1; } }
            return `${year}-${String(month + 1).padStart(2, '0')}`;
        };
        // Mesma regra da aba Cartões: assinatura/parcela entra na fatura se a cobrança do
        // mês atual OU do mês anterior cai nesse ciclo (o ciclo pode começar no mês anterior).
        const isSubInInvoice = (subDay, invoiceMonth, closingDay) => {
            const [iy, im] = invoiceMonth.split('-').map(Number);
            const prevM = im === 1 ? 12 : im - 1;
            const prevY = im === 1 ? iy - 1 : iy;
            const chargeCurr = new Date(iy, im - 1, subDay, 12, 0, 0);
            const chargePrev = new Date(prevY, prevM - 1, subDay, 12, 0, 0);
            return getInvoiceMonth(chargeCurr.toISOString(), closingDay) === invoiceMonth ||
                   getInvoiceMonth(chargePrev.toISOString(), closingDay) === invoiceMonth;
        };
        const now = new Date();
        const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let total = 0; const pending = []; let hasFutureInvoice = false;
        // Fatura ATUAL (aberta): soma de tudo em aberto (vencendo agora OU no próximo
        // ciclo) e o vencimento mais próximo — usado pelo card da Visão Geral.
        let openTotal = 0; const allDues = [];
        (cards || []).forEach(card => {
            const closingDay = card.closingDay || ((card.dueDay - 7 > 0) ? card.dueDay - 7 : 25);
            const dueDay = card.dueDay || 10;
            const currInv = getInvoiceMonth(now.toISOString(), closingDay);
            const unpaid = transactions.filter(t => t.selectedCardId === card.id && t.invoiceStatus === 'unpaid');
            const subs = (subscriptions || []).filter(s => s.cardId === card.id).filter(s => {
                if (s.lastPaidMonth === currInv) return false;
                const subDay = parseInt(s.day) || 1;
                return isSubInInvoice(subDay, currInv, closingDay);
            });
            const sum = unpaid.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0) + subs.reduce((a, s) => a + (parseFloat(s.value) || 0), 0);
            if (sum > 0.005) {
                // Vencimento pelo CICLO da fatura das compras não pagas (e não pelo mês atual).
                // Cada compra pertence a uma fatura (invoiceMonth); a próxima a vencer é a
                // mais antiga ainda em aberto. Assinaturas entram na fatura corrente.
                const invMonths = unpaid
                    .map(t => getInvoiceMonth(t.date || now.toISOString(), closingDay))
                    .filter(Boolean);
                if (subs.length > 0) invMonths.push(currInv);
                invMonths.sort();
                const invMonth = invMonths[0] || currInv;
                const [iy, im] = invMonth.split('-').map(Number);
                const due = new Date(iy, im - 1, dueDay);
                // Só conta como fatura pendente se vence no MÊS ATUAL ou está vencida.
                // Faturas que só vencem no próximo mês (ex.: parcelas futuras já lançadas)
                // ficam ocultas até o mês virar — aí o card mostra "cartões em dia".
                const isCurrentOrOverdue = due.getFullYear() < now.getFullYear()
                    || (due.getFullYear() === now.getFullYear() && due.getMonth() <= now.getMonth());
                openTotal += sum;
                allDues.push(due);
                if (isCurrentOrOverdue) {
                    pending.push({ card, sum, due });
                    total += sum;
                } else {
                    hasFutureInvoice = true;
                }
            }
        });
        pending.sort((a, b) => a.due - b.due);
        const nearest = pending[0];
        const daysUntil = nearest ? Math.max(0, Math.ceil((nearest.due - t0) / 86400000)) : 0;
        const label = pending.length === 0 ? '' : pending.length === 1
            ? [nearest.card.name, nearest.card.brand].filter(Boolean).join(' · ')
            : `${pending.length} cartões`;
        const hasCards = (cards || []).length > 0;
        // "Em dia": tem cartão, nada vencendo agora, mas há fatura futura (paga o ciclo atual).
        const upToDate = hasCards && total <= 0.005 && hasFutureInvoice;
        allDues.sort((a, b) => a - b);
        const openDue = allDues[0] || null;
        return { total, daysUntil, dueDate: nearest?.due || null, label, hasCards, hasFutureInvoice, upToDate, openTotal, openDue };
    }, [cards, subscriptions, transactions]);

    // Variação do saldo no mês (entradas - saídas do mês vs base anterior).
    const monthDelta = (walletStats.income || 0) - (walletStats.expense || 0);
    const monthBase = (walletStats.balance || 0) - monthDelta;
    const pctMonth = monthBase > 0 ? (monthDelta / monthBase) * 100 : null;

    // Reserva de emergência (a análise da Alívia do mês fica no card próprio do App).
    const reserveAmount = investmentStats.totalGuarded || 0;
    const reserveMonths = healthIndex?.pillars?.reserve?.months || 0;

    const textColor = theme === 'light' ? 'text-slate-800' : 'text-white';
    const subTextColor = theme === 'light' ? 'text-slate-500' : 'text-slate-400';

    // ── Dados extras p/ o layout (categorias, % vs mês anterior, sparklines, meta reserva) ──
    const monthKey = new Date().toISOString().slice(0, 7);
    const prevMonthKey = (() => { const [y, m] = monthKey.split('-').map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
    const mkOf = (t) => (t.date && t.date.slice ? t.date.slice(0, 7) : t.month);

    // Gastos do mês por categoria (donut). Inclui o crédito (compras em aberto na
    // fatura), distribuído pela categoria REAL — e NÃO mostra "Fatura"
    // (credit_card_bill é o pagamento da fatura, não um gasto por categoria).
    const categoryData = useMemo(() => {
        const grouped = {};
        transactions.forEach(t => {
            if (t.type !== 'expense' || ['investment', 'vault', 'credit_card_bill'].includes(t.category)) return;
            if (mkOf(t) !== monthKey) return;
            const c = t.category || 'other';
            grouped[c] = (grouped[c] || 0) + (parseFloat(t.amount) || 0);
        });
        const total = Object.values(grouped).reduce((a, b) => a + b, 0);
        let rows = Object.entries(grouped)
            .map(([id, value]) => ({ id, value, label: CAT_LABELS[id] || 'Outros', color: CAT_COLORS[id] || CAT_COLORS.other, pct: total > 0 ? (value / total) * 100 : 0 }))
            .sort((a, b) => b.value - a.value);
        if (rows.length > 6) {
            const tail = rows.slice(5);
            const tailSum = tail.reduce((a, r) => a + r.value, 0);
            rows = [...rows.slice(0, 5), { id: 'other', value: tailSum, label: 'Outros', color: CAT_COLORS.other, pct: total > 0 ? (tailSum / total) * 100 : 0 }];
        }
        return { rows, total };
    }, [transactions, monthKey]);

    // Ganhos/Gastos do mês atual vs anterior (para a variação %).
    const monthlyAgg = useMemo(() => {
        const inc = (mk) => transactions.filter(t => t.type === 'income' && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category) && mkOf(t) === mk).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
        const exp = (mk) => transactions.filter(t => t.type === 'expense' && !['investment', 'vault'].includes(t.category) && t.paymentMethod !== 'credito' && mkOf(t) === mk).reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
        return { incPrev: inc(prevMonthKey), expPrev: exp(prevMonthKey) };
    }, [transactions, prevMonthKey]);
    const mIncomeVal = walletStats.income || 0;
    const mExpenseVal = walletStats.expense || 0;
    const pctIncome = monthlyAgg.incPrev > 0 ? ((mIncomeVal - monthlyAgg.incPrev) / monthlyAgg.incPrev) * 100 : null;
    const pctExpense = monthlyAgg.expPrev > 0 ? ((mExpenseVal - monthlyAgg.expPrev) / monthlyAgg.expPrev) * 100 : null;

    // Sparklines (acumulado diário do mês) p/ ganhos e gastos.
    const sparks = useMemo(() => {
        const [y, m] = monthKey.split('-').map(Number);
        const days = new Date(y, m, 0).getDate();
        const incPer = new Array(days).fill(0);
        const expPer = new Array(days).fill(0);
        transactions.forEach(t => {
            if (mkOf(t) !== monthKey) return;
            const d = new Date(t.date); if (isNaN(d.getTime())) return;
            const day = Math.min(days, Math.max(1, d.getDate())) - 1;
            const v = parseFloat(t.amount) || 0;
            if (t.type === 'income' && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category)) incPer[day] += v;
            else if (t.type === 'expense' && !['investment', 'vault'].includes(t.category) && t.paymentMethod !== 'credito') expPer[day] += v;
        });
        let ai = 0, ae = 0;
        return {
            income: incPer.map((v, i) => ({ name: i + 1, value: (ai += v) })),
            expense: expPer.map((v, i) => ({ name: i + 1, value: (ae += v) })),
        };
    }, [transactions, monthKey]);

    // Reserva: meta de 6 meses, falta e progresso.
    const monthlyExpForReserve = reserveMonths > 0 ? reserveAmount / reserveMonths : (mExpenseVal || parseFloat(manualConfig?.fixedExpenses) || 0);
    const reserveTarget = monthlyExpForReserve * 6;
    const reserveFalta = Math.max(0, reserveTarget - reserveAmount);
    const reservePct = reserveTarget > 0 ? Math.min(100, (reserveAmount / reserveTarget) * 100) : 0;

    // Últimos aportes da reserva (depósitos para a reserva/cofre).
    const reserveAportes = useMemo(() => transactions
        .filter(t => t.type === 'expense' && (t.category === 'vault' || (t.category === 'investment' && (t.source === 'patrimonio' || /reserva/i.test(t.description || ''))) || /reserva de emerg/i.test(t.description || '')))
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .slice(0, 6), [transactions]);

    // ===== LAYOUT da Visão Geral (saldo + Ganhos/Gastos/Reserva + Índice completo) =====
    const useNewLayout = true;
    if (useNewLayout) {
        const isDark = theme !== 'light';
        const card = 'pat-card';
        const mIncome = walletStats.income || 0;
        const mExpense = walletStats.expense || 0;
        // Quando não houve recebimento LANÇADO no mês, o Índice de Saúde usa a renda
        // BASE configurada — deixamos isso explícito no card de Ganhos para não confundir.
        const baseIncomeForIndex = healthIndex?.incomeSource === 'base' ? (healthIndex?.income || 0) : 0;
        const showBaseIncomeHint = mIncome <= 0 && baseIncomeForIndex > 0;
        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-4">
                {/* Linha 1: Ganhos / Gastos / Saldo disponível */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Ganhos no mês */}
                    <div className={`p-5 rounded-2xl border ${card}`}>
                        <span className="flex items-center gap-2 text-[12px] font-bold text-slate-400"><span className={`p-1.5 rounded-lg ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}><TrendingUp className="w-4 h-4 text-emerald-500" /></span> Ganhos no mês</span>
                        <p className={`text-2xl font-black tracking-tight tabular-nums mt-2 ${hideBalance ? 'blur-md select-none' : textColor}`}>{hideBalance ? 'R$ ••••' : formatCurrency(mIncome)}</p>
                        <div className="mt-1 min-h-[16px]">
                            {pctIncome != null && isFinite(pctIncome)
                                ? <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${pctIncome >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{pctIncome >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}{pctIncome >= 0 ? '+' : ''}{pctIncome.toFixed(1)}% vs mês anterior</span>
                                : <span className="text-[11px] text-slate-400">{showBaseIncomeHint ? `usa renda base ${formatCurrency(baseIncomeForIndex)}` : 'este mês'}</span>}
                        </div>
                        <div className="h-12 -mx-1 mt-2">
                            <ResponsiveContainer width="100%" height="100%"><AreaChart data={sparks.income}><defs><linearGradient id="spkInc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity={0.35} /><stop offset="100%" stopColor="#10B981" stopOpacity={0} /></linearGradient></defs><Area type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} fill="url(#spkInc)" /></AreaChart></ResponsiveContainer>
                        </div>
                    </div>

                    {/* Gastos no mês */}
                    <div className={`p-5 rounded-2xl border ${card}`}>
                        <span className="flex items-center gap-2 text-[12px] font-bold text-slate-400"><span className={`p-1.5 rounded-lg ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}><TrendingDown className="w-4 h-4 text-rose-500" /></span> Gastos no mês</span>
                        <p className={`text-2xl font-black tracking-tight tabular-nums mt-2 ${hideBalance ? 'blur-md select-none' : textColor}`}>{hideBalance ? 'R$ ••••' : formatCurrency(mExpense)}</p>
                        <div className="mt-1 min-h-[16px]">
                            {pctExpense != null && isFinite(pctExpense)
                                ? <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${pctExpense <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{pctExpense <= 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}{pctExpense >= 0 ? '+' : ''}{pctExpense.toFixed(1)}% vs mês anterior</span>
                                : <span className="text-[11px] text-slate-400">este mês</span>}
                        </div>
                        <div className="h-12 -mx-1 mt-2">
                            <ResponsiveContainer width="100%" height="100%"><AreaChart data={sparks.expense}><defs><linearGradient id="spkExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FB7185" stopOpacity={0.35} /><stop offset="100%" stopColor="#FB7185" stopOpacity={0} /></linearGradient></defs><Area type="monotone" dataKey="value" stroke="#FB7185" strokeWidth={2} fill="url(#spkExp)" /></AreaChart></ResponsiveContainer>
                        </div>
                    </div>

                    {/* Saldo disponível */}
                    <div className={`p-5 rounded-2xl border ${card}`}>
                        <span className="flex items-center justify-between text-[12px] font-bold text-slate-400">
                            <span className="flex items-center gap-2"><span className={`p-1.5 rounded-lg ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}><Wallet className="w-4 h-4 text-violet-500" /></span> Saldo disponível</span>
                            <button onClick={toggleHideBalance} className="text-slate-400 hover:text-blue-500 transition-colors">{hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                        </span>
                        <p className={`text-2xl md:text-3xl font-black tracking-tight tabular-nums mt-2 ${hideBalance ? 'blur-md select-none' : 'text-blue-400'}`}>{hideBalance ? 'R$ ••••' : formatCurrency(walletStats.balance)}</p>
                        <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 mt-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Saldo atual disponível em conta</p>
                    </div>
                </div>

                {/* Linha 2: Gastos por categoria (donut) / Reserva de emergência */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className={`p-5 rounded-2xl border flex flex-col ${card}`}>
                        <h3 className={`text-sm font-black ${textColor} mb-3`}>Gastos por categoria</h3>
                        {categoryData.rows.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-12 flex-1">Nenhum gasto neste mês ainda.</p>
                        ) : (
                            <div className="flex items-center gap-4 flex-1">
                                <div className="relative w-32 h-32 shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={categoryData.rows} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={60} paddingAngle={3} stroke="none">
                                                {categoryData.rows.map(r => <Cell key={r.id} fill={r.color} />)}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-[8px] text-slate-400 uppercase font-black tracking-wider">Total</span>
                                        <span className={`text-[12px] font-black ${hideBalance ? 'blur-sm' : textColor}`}>{hideBalance ? '•••' : formatCurrency(categoryData.total)}</span>
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0 space-y-1.5">
                                    {categoryData.rows.map(r => (
                                        <div key={r.id} className="flex items-center gap-2 text-[12px]">
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                                            <span className={`flex-1 min-w-0 truncate ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>{r.label} <span className="text-slate-400 font-medium">{r.pct.toFixed(0)}%</span></span>
                                            <span className={`font-bold tabular-nums shrink-0 ${hideBalance ? 'blur-sm' : textColor}`}>{hideBalance ? '•••' : formatCurrency(r.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <button onClick={() => setActiveTab && setActiveTab('analise')} className={`mt-4 w-full py-2 rounded-xl text-[11px] font-bold transition-colors ${isDark ? 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>Ver todas as categorias →</button>
                    </div>

                    <div className={`p-5 rounded-2xl border flex flex-col ${card}`}>
                        <h3 className={`flex items-center gap-2 text-sm font-black ${textColor} mb-3`}><ShieldCheck className="w-4 h-4 text-emerald-500" /> Reserva de emergência</h3>
                        <div className="flex-1">
                            <p className={`text-2xl md:text-3xl font-black tracking-tight tabular-nums ${hideBalance ? 'blur-md select-none' : 'text-emerald-500'}`}>{hideBalance ? 'R$ ••••' : formatCurrency(reserveAmount)}</p>
                            <p className="text-[12px] font-bold text-emerald-400 mt-1">{reserveMonths.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {reserveMonths === 1 ? 'mês' : 'meses'} de cobertura</p>
                            <div className={`w-full h-2.5 rounded-full overflow-hidden mt-4 ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700" style={{ width: `${Math.max(3, reservePct)}%` }} /></div>
                            <div className="flex items-center justify-between mt-2 text-[11px]">
                                <span className="text-slate-400">Meta: <span className="font-bold text-slate-300">6 meses de gastos</span></span>
                                {reserveFalta > 0.005
                                    ? <span className="font-bold text-slate-400">Falta: <span className="text-amber-500">{formatCurrency(reserveFalta)}</span></span>
                                    : <span className="font-bold text-emerald-500">Meta atingida 🎉</span>}
                            </div>
                        </div>
                        <button onClick={() => setShowReserve(true)} className={`mt-4 w-full py-2 rounded-xl text-[11px] font-bold transition-colors ${isDark ? 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>Ver detalhes →</button>
                    </div>
                </div>

                {/* Índice de Saúde Financeira (score) — no lugar de "Insights para você" */}
                <FinancialHealthIndex data={healthIndex} config={manualConfig} onUpdateConfig={onUpdateConfig} invoiceInfo={invoiceInfo} />

                {/* Detalhes da Reserva — janela dentro do Controle de Gastos (só leitura). */}
                {showReserve && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowReserve(false)}>
                        <div className={`w-full max-w-md rounded-2xl border p-5 relative animate-in zoom-in-95 duration-200 max-h-[88vh] overflow-y-auto custom-scrollbar shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`} onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => setShowReserve(false)} className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}><X className="w-4 h-4" /></button>
                            <h3 className={`flex items-center gap-2 text-base font-black ${textColor}`}><ShieldCheck className="w-5 h-5 text-emerald-500" /> Reserva de emergência</h3>
                            <p className={`text-3xl font-black tabular-nums mt-3 ${hideBalance ? 'blur-md select-none' : 'text-emerald-500'}`}>{hideBalance ? 'R$ ••••' : formatCurrency(reserveAmount)}</p>
                            <p className="text-[12px] font-bold text-emerald-400">{reserveMonths.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {reserveMonths === 1 ? 'mês' : 'meses'} de cobertura</p>
                            <div className={`w-full h-2 rounded-full overflow-hidden mt-3 ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(3, reservePct)}%` }} /></div>
                            <div className="flex justify-between mt-1.5 text-[11px]"><span className="text-slate-400">Meta: 6 meses de gastos</span>{reserveFalta > 0.005 ? <span className="text-slate-400">Falta <span className="text-amber-500 font-bold">{formatCurrency(reserveFalta)}</span></span> : <span className="text-emerald-500 font-bold">Meta atingida 🎉</span>}</div>

                            {savingsJars.length > 0 && (
                                <div className="mt-5">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Suas reservas</p>
                                    <div className="space-y-2">
                                        {savingsJars.map(j => (
                                            <div key={j.id} className={`flex items-center justify-between p-2.5 rounded-xl ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
                                                <div className="min-w-0"><p className={`text-[13px] font-bold truncate ${textColor}`}>{j.name || 'Reserva'}</p><p className="text-[10px] text-slate-400">{j.cdiPercent || 100}% do CDI</p></div>
                                                <span className={`text-[13px] font-black tabular-nums shrink-0 ${hideBalance ? 'blur-sm' : 'text-emerald-500'}`}>{hideBalance ? '•••' : formatCurrency(parseFloat(j.balance) || 0)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Últimos aportes</p>
                                {reserveAportes.length === 0 ? (
                                    <p className="text-[12px] text-slate-400">Nenhum aporte registrado ainda.</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {reserveAportes.map(t => (
                                            <div key={t.id} className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
                                                <div className="min-w-0"><p className={`text-[12px] font-semibold truncate ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>{t.description || 'Aporte'}</p><p className="text-[10px] text-slate-400">{t.date ? new Date(t.date).toLocaleDateString('pt-BR') : ''}</p></div>
                                                <span className="text-[12px] font-bold tabular-nums text-emerald-500 shrink-0">{hideBalance ? '•••' : `+ ${formatCurrency(parseFloat(t.amount) || 0)}`}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className={`mt-5 p-3 rounded-xl border text-[11px] leading-relaxed ${isDark ? 'bg-violet-500/[0.06] border-violet-500/15 text-slate-300' : 'bg-violet-50 border-violet-100 text-slate-600'}`}>
                                Para <strong>adicionar, resgatar ou gerenciar</strong> a reserva, use o módulo <strong>Construção de Patrimônio</strong>.
                            </div>
                            <button onClick={() => { setShowReserve(false); setActiveModule && setActiveModule('patrimonio'); }} className="mt-3 w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[12px] uppercase tracking-wider transition-colors">Ir para Construção de Patrimônio →</button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* ROW 1: Hero do Saldo Total em Carteira */}
            <div className={`rounded-3xl border overflow-hidden ${theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-[#1e2330] border-slate-700/50'}`}>
                <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="shrink-0 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">Saldo Total em Carteira</span>
                                <button onClick={toggleHideBalance} className="text-slate-400 hover:text-blue-500 transition-colors">
                                    {hideBalance ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                            <div className={`text-3xl md:text-4xl font-black tracking-tight tabular-nums ${hideBalance ? 'blur-md select-none' : 'text-blue-400'}`}>
                                {hideBalance ? 'R$ 0.000,00' : formatCurrency(walletStats.balance)}
                            </div>
                            <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 mt-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Saldo atual disponível em conta
                            </p>
                        </div>

                        {/* Centro: Reserva de emergência. (A análise da Alívia fica no
                            card "Alívia · análise do mês", ao lado — sem duplicar.) */}
                        <div className="hidden lg:flex items-stretch gap-3 flex-1 min-w-0">
                            <div className={`shrink-0 w-44 rounded-2xl border px-4 py-3 flex flex-col justify-center ${theme === 'light' ? 'bg-emerald-50/70 border-emerald-200' : 'bg-emerald-500/[0.07] border-emerald-500/25'}`}>
                                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                                    <ShieldCheck className="w-3.5 h-3.5" /> Reserva de emergência
                                </span>
                                <div className={`text-xl font-black tabular-nums mt-1 ${hideBalance ? 'blur-md select-none' : 'text-emerald-400'}`}>
                                    {hideBalance ? 'R$ 0,00' : formatCurrency(reserveAmount)}
                                </div>
                                <span className="text-[10px] text-slate-400">
                                    {reserveMonths.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {reserveMonths === 1 ? 'mês' : 'meses'} de cobertura
                                </span>
                            </div>
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
                invoiceInfo={invoiceInfo}
            />

        </div>
    );
}
