import React, { useMemo, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Eye, EyeOff, Settings, Pencil, Check, X } from 'lucide-react';
import FinancialHealthIndex from './FinancialHealthIndex';
import { CATEGORIES } from '../constants/categories';

export default function OverviewTab({
    transactions,
    savingsJars,
    walletStats,
    investmentStats,
    healthIndex,
    manualConfig,
    onUpdateConfig,
    theme,
    hideBalance,
    toggleHideBalance,
    onSetInitialBalance
}) {
    const [incomesPeriod, setIncomesPeriod] = useState(() => localStorage.getItem('alivia_incomes_period') || 'month');
    const [showIncomesConfig, setShowIncomesConfig] = useState(false);
    const [editingWallet, setEditingWallet] = useState(false);
    const [walletInput, setWalletInput] = useState('');

    const handleIncomesPeriodChange = (period) => {
        setIncomesPeriod(period);
        localStorage.setItem('alivia_incomes_period', period);
        setShowIncomesConfig(false);
    };

    const incomesPeriodLabel = {
        'month': '(Mês)',
        '15d': '(15d)',
        '30d': '(30d)'
    }[incomesPeriod];

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

    // Prepare data for "Lançamentos e Reservas"
    const expenseTransactions = transactions.filter(t => 
        t.type === 'expense' && 
        t.category !== 'investment' && 
        t.paymentMethod !== 'credito' &&
        (t.date?.slice(0, 7) === new Date().toISOString().slice(0, 7) || t.month === new Date().toISOString().slice(0, 7))
    );

    const reservesData = useMemo(() => {
        if (!savingsJars || savingsJars.length === 0) {
            return [{ name: 'Sem reservas', value: 1, color: '#475569', percentage: '0' }];
        }
        const colors = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6'];
        const data = savingsJars.map((jar, idx) => ({
            name: jar.name,
            value: parseFloat(jar.balance) || 0,
            color: colors[idx % colors.length]
        })).filter(j => j.value > 0);
        
        if (data.length > 0) {
            const total = data.reduce((acc, curr) => acc + curr.value, 0);
            data.forEach(r => r.percentage = total > 0 ? ((r.value / total) * 100).toFixed(0) : 0);
        } else {
            return [{ name: 'Sem reservas', value: 1, color: '#475569', percentage: '0' }];
        }
        
        return data;
    }, [savingsJars]);

    // Prepare data for "Últimos Recebimentos"
    const filteredIncomes = useMemo(() => {
        const today = new Date();
        const currentMonthStr = today.toISOString().slice(0, 7);
        
        return transactions.filter(t => {
            if (t.type !== 'income' || ['initial_balance', 'carryover', 'vault_redemption'].includes(t.category)) {
                return false;
            }
            if (incomesPeriod === 'month') {
                return (t.date?.slice(0, 7) === currentMonthStr || t.month === currentMonthStr);
            }
            const txDate = new Date(t.date);
            const diffDays = (today - txDate) / (1000 * 60 * 60 * 24);
            if (incomesPeriod === '15d') return diffDays <= 15;
            if (incomesPeriod === '30d') return diffDays <= 30;
            return true;
        });
    }, [transactions, incomesPeriod]);

    const recentIncomes = useMemo(() => {
        return [...filteredIncomes]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);
    }, [filteredIncomes]);

    const totalIncomesFiltered = useMemo(() => {
        return filteredIncomes.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    }, [filteredIncomes]);

    const getCategoryLabel = (categoryId) => {
        const cat = CATEGORIES.income.find(c => c.id === categoryId) || CATEGORIES.expense.find(c => c.id === categoryId);
        return cat ? cat.label : categoryId;
    };

    const cardBg = theme === 'light' ? 'bg-white border border-slate-100 shadow-sm' : 'bg-[#1e2330]';
    const textColor = theme === 'light' ? 'text-slate-800' : 'text-white';
    const subTextColor = theme === 'light' ? 'text-slate-500' : 'text-slate-400';

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* ROW 1: Ativos e Saldos | Lançamentos e Reservas (no topo) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Ativos e Saldos */}
                <div>
                    <h3 className={`text-base font-medium uppercase tracking-wider mb-4 ${textColor}`}>Ativos e Saldos</h3>
                    <div className={`p-6 rounded-2xl flex items-center justify-between h-40 ${cardBg}`}>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-sm font-medium ${subTextColor}`}>Saldo Total em Carteira</span>
                                <button onClick={toggleHideBalance} className="text-slate-400 hover:text-blue-500 transition-colors">
                                    {hideBalance ? <EyeOff size={16} /> : <Eye size={16} />}
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
                                    <span className={`text-sm font-bold ${subTextColor}`}>R$</span>
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
                                        className={`w-28 text-lg font-bold bg-transparent border-b-2 border-emerald-500 focus:outline-none ${textColor}`}
                                    />
                                    <button
                                        onClick={() => {
                                            const val = parseFloat(walletInput.replace(',', '.'));
                                            if (!isNaN(val) && onSetInitialBalance) { onSetInitialBalance(val); }
                                            setEditingWallet(false);
                                        }}
                                        className="text-emerald-400 hover:text-emerald-300 transition-colors ml-1"
                                    ><Check size={16} /></button>
                                    <button onClick={() => setEditingWallet(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className={`text-2xl font-bold ${hideBalance ? 'blur-md select-none' : textColor}`}>
                                    {hideBalance ? 'R$ 0.000,00' : formatCurrency(walletStats.balance)}
                                </div>
                            )}
                        </div>
                        <div className="h-full w-1/2">
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

                {/* Lançamentos e Reservas */}
                <div>
                    <h3 className={`text-base font-medium uppercase tracking-wider mb-4 ${textColor}`}>Lançamentos e Reservas</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Total Lançado */}
                        <div className={`p-6 rounded-xl flex flex-col justify-center ${cardBg}`}>
                            <span className={`text-sm font-medium mb-2 ${subTextColor}`}>Total Lançado (Mês)</span>
                            <div className={`text-2xl font-bold mb-1 ${hideBalance ? 'blur-md select-none' : textColor}`}>
                                {hideBalance ? 'R$ 0.000,00' : formatCurrency(walletStats.expense)}
                            </div>
                            <span className={`text-xs ${subTextColor}`}>{expenseTransactions.length} lançamentos</span>
                        </div>
                        
                        {/* Reservas */}
                        <div className={`p-6 rounded-xl flex flex-col justify-center relative group/reservas ${cardBg}`}>
                            <div className="flex items-center justify-between">
                                <div className="w-16 h-16 relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={reservesData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={20}
                                                outerRadius={30}
                                                paddingAngle={5}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {reservesData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-[10px] font-bold text-slate-500">
                                            {reservesData[0]?.name === 'Sem reservas' ? '0%' : '100%'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex-1 ml-4">
                                    <span className={`text-xs font-medium ${subTextColor}`}>Total Reservado:</span>
                                    <div className={`text-sm font-bold mb-2 ${hideBalance ? 'blur-md select-none' : textColor}`}>
                                        {hideBalance ? 'R$ 0,00' : formatCurrency(investmentStats.totalGuarded)}
                                    </div>
                                    <div className="space-y-1">
                                        {reservesData.slice(0,2).map((r, i) => (
                                            r.name !== 'Sem reservas' && (
                                                <div key={i} className="flex items-center justify-between text-[10px]">
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: r.color}}></div>
                                                        <span className={subTextColor}>{r.name}</span>
                                                    </div>
                                                    <span className={textColor}>{r.percentage}%</span>
                                                </div>
                                            )
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* ROW 2: Índice de Saúde Financeira */}
            <FinancialHealthIndex
                data={healthIndex}
                config={manualConfig}
                onUpdateConfig={onUpdateConfig}
            />

            {/* ROW 3: Últimos Recebimentos */}
            <div className="grid grid-cols-1 gap-6">

                {/* Últimos Recebimentos */}
                <div>
                    <h3 className={`text-base font-medium uppercase tracking-wider mb-4 ${textColor}`}>Últimos Recebimentos</h3>
                    <div className={`p-6 rounded-2xl flex flex-col justify-between ${cardBg}`} style={{ minHeight: '340px' }}>
                        <div>
                            <div className="flex items-center justify-between mb-6 relative">
                                <span className={`text-sm font-medium ${textColor}`}>Atividade de Recebimentos</span>
                                <button 
                                    onClick={() => setShowIncomesConfig(!showIncomesConfig)}
                                    className={`p-1.5 rounded-lg transition-colors ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                                >
                                    <Settings className={`w-4 h-4 ${subTextColor}`} />
                                </button>
                                
                                {showIncomesConfig && (
                                    <div className={`absolute top-full right-0 mt-2 w-48 rounded-xl border shadow-xl z-10 overflow-hidden ${theme === 'light' ? 'bg-white border-slate-100' : 'bg-[#1e2330] border-slate-700'}`}>
                                        <div className="p-2 space-y-1">
                                            {[
                                                { id: 'month', label: 'Somente este mês' },
                                                { id: '15d', label: 'Últimos 15 dias' },
                                                { id: '30d', label: 'Últimos 30 dias' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => handleIncomesPeriodChange(opt.id)}
                                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                                        incomesPeriod === opt.id 
                                                            ? 'bg-emerald-500/10 text-emerald-500' 
                                                            : (theme === 'light' ? 'text-slate-600 hover:bg-slate-50' : 'text-slate-300 hover:bg-white/5')
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-4">
                                {recentIncomes.length > 0 ? recentIncomes.map(t => (
                                    <div key={t.id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${theme === 'light' ? 'bg-slate-100' : 'bg-white/10'}`}>
                                                <span className={`text-xs font-bold ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                                                    {t.description ? t.description.charAt(0).toUpperCase() : 'R'}
                                                </span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-bold truncate ${textColor}`}>{t.description || 'Recebimento'}</p>
                                                <p className={`text-[10px] truncate ${subTextColor}`}>{getCategoryLabel(t.category) || 'Entrada'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={`text-[10px] ${subTextColor}`}>
                                                {new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                            </p>
                                            <p className="text-xs font-bold text-emerald-500">
                                                + {formatCurrency(parseFloat(t.amount))}
                                            </p>
                                        </div>
                                    </div>
                                )) : (
                                    <p className={`text-xs text-center ${subTextColor}`}>Nenhum recebimento recente.</p>
                                )}
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-500/10 text-right">
                            <span className={`text-xs font-medium ${subTextColor}`}>
                                Total Recebido {incomesPeriodLabel}: <span className={textColor}>{formatCurrency(totalIncomesFiltered)}</span>
                            </span>
                        </div>
                    </div>
                </div>

            </div>

        </div>
    );
}
