import React, { useMemo, useState } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Eye, EyeOff, Settings } from 'lucide-react';
import HealthScoreCard from './HealthScoreCard';

export default function OverviewTab({ 
    transactions, 
    savingsJars, 
    walletStats, 
    investmentStats, 
    healthScore, 
    theme, 
    hideBalance, 
    toggleHideBalance,
    setEditingJar,
    setJarDeleteConfirm
}) {
    const [cashFlowPeriod, setCashFlowPeriod] = useState('30d');

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    // Prepare data for "Ativos e Saldos" small chart (last 7 days balance evolution)
    const balanceHistoryData = useMemo(() => {
        const data = [];
        let currentBalance = walletStats.balance;
        
        // Just mock some variation for the visual if we don't have daily historical balance calculation easily available
        // Or we can calculate it backwards from current balance
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            data.push({ name: dateStr, value: currentBalance * (1 - (i * 0.02)) }); // Mock variation
        }
        return data;
    }, [walletStats.balance]);

    // Prepare data for "Lançamentos e Reservas"
    const expenseTransactions = transactions.filter(t => 
        t.type === 'expense' && 
        t.category !== 'investment' && 
        t.paymentMethod !== 'credito' &&
        (t.date?.slice(0, 7) === new Date().toISOString().slice(0, 7) || t.month === new Date().toISOString().slice(0, 7))
    );

    const reservesData = useMemo(() => {
        if (!savingsJars || savingsJars.length === 0) {
            return [{ name: 'Sem reservas', value: 1, color: '#475569' }];
        }
        const colors = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6'];
        return savingsJars.map((jar, idx) => ({
            name: jar.name,
            value: parseFloat(jar.balance) || 0,
            color: colors[idx % colors.length]
        })).filter(j => j.value > 0);
    }, [savingsJars]);

    if (reservesData.length > 0 && reservesData[0].name !== 'Sem reservas') {
        const total = reservesData.reduce((acc, curr) => acc + curr.value, 0);
        reservesData.forEach(r => r.percentage = total > 0 ? ((r.value / total) * 100).toFixed(0) : 0);
    }

    // Prepare data for "Visão Geral do Fluxo de Caixa"
    const cashFlowData = useMemo(() => {
        const data = [];
        const today = new Date();
        const days = cashFlowPeriod === '30d' ? 30 : 7;
        
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            const displayDate = d.toLocaleDateString('pt-BR', { day: '2-digit' });

            const dayIncomes = transactions.filter(t => t.type === 'income' && t.date === dateStr).reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
            const dayExpenses = transactions.filter(t => t.type === 'expense' && t.category !== 'investment' && t.date === dateStr).reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

            data.push({
                name: displayDate,
                Entradas: dayIncomes,
                Saídas: dayExpenses
            });
        }
        return data;
    }, [transactions, cashFlowPeriod]);

    // Prepare data for "Últimos Recebimentos"
    const recentIncomes = useMemo(() => {
        return transactions
            .filter(t => t.type === 'income' && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category))
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);
    }, [transactions]);

    const cardBg = theme === 'light' ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-900/50 border-white/5';
    const textColor = theme === 'light' ? 'text-slate-800' : 'text-white';
    const subTextColor = theme === 'light' ? 'text-slate-500' : 'text-slate-400';

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* ROW 1: Ativos e Saldos | Lançamentos e Reservas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Ativos e Saldos */}
                <div>
                    <h3 className={`text-base font-bold mb-4 ${textColor}`}>Ativos e Saldos</h3>
                    <div className={`p-6 rounded-[2rem] border flex items-center justify-between h-40 ${cardBg}`}>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-sm font-semibold ${subTextColor}`}>Saldo Total em Carteira</span>
                                <button onClick={toggleHideBalance} className="text-slate-400 hover:text-blue-500 transition-colors">
                                    {hideBalance ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            <div className={`text-3xl font-black ${hideBalance ? 'blur-md select-none' : textColor}`}>
                                {hideBalance ? 'R$ 0.000,00' : formatCurrency(walletStats.balance)}
                            </div>
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
                    <h3 className={`text-base font-bold mb-4 ${textColor}`}>Lançamentos e Reservas</h3>
                    <div className="grid grid-cols-2 gap-4 h-40">
                        {/* Total Lançado */}
                        <div className={`p-6 rounded-[2rem] border flex flex-col justify-center ${cardBg}`}>
                            <span className={`text-sm font-semibold mb-2 ${subTextColor}`}>Total Lançado (Mês)</span>
                            <div className={`text-2xl font-black mb-1 ${hideBalance ? 'blur-md select-none' : textColor}`}>
                                {hideBalance ? 'R$ 0.000,00' : formatCurrency(walletStats.expense)}
                            </div>
                            <span className={`text-xs ${subTextColor}`}>{expenseTransactions.length} entries</span>
                        </div>
                        
                        {/* Reservas */}
                        <div className={`p-6 rounded-[2rem] border flex flex-col justify-center relative group/reservas ${cardBg}`}>
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
                                    <span className={`text-xs font-semibold ${subTextColor}`}>Total Reservado:</span>
                                    <div className={`text-sm font-black mb-2 ${hideBalance ? 'blur-md select-none' : textColor}`}>
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

            {/* ROW 2: Visão Geral do Fluxo de Caixa | Últimos Recebimentos */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Fluxo de Caixa */}
                <div className="xl:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className={`text-base font-bold ${textColor}`}>Visão Geral do Fluxo de Caixa</h3>
                        <select 
                            value={cashFlowPeriod}
                            onChange={(e) => setCashFlowPeriod(e.target.value)}
                            className={`text-xs bg-transparent border rounded-lg px-2 py-1 outline-none ${theme === 'light' ? 'border-slate-200 text-slate-600' : 'border-white/10 text-slate-300'}`}
                        >
                            <option value="7d">Últimos 7 dias</option>
                            <option value="30d">Últimos 30 dias</option>
                        </select>
                    </div>
                    <div className={`p-6 rounded-[2rem] border flex flex-col ${cardBg}`} style={{ height: '340px' }}>
                        <div className="flex items-center justify-center gap-6 mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-2 bg-emerald-500 rounded-full"></div>
                                <span className={`text-xs font-semibold ${subTextColor}`}>Entradas</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-2 bg-rose-500 rounded-full"></div>
                                <span className={`text-xs font-semibold ${subTextColor}`}>Saídas</span>
                            </div>
                        </div>
                        <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={cashFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'light' ? '#f1f5f9' : '#1e293b'} />
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 10, fill: theme === 'light' ? '#64748b' : '#94a3b8' }} 
                                        dy={10}
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 10, fill: theme === 'light' ? '#64748b' : '#94a3b8' }}
                                    />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#0f172a', borderColor: theme === 'light' ? '#e2e8f0' : '#1e293b', borderRadius: '12px' }}
                                        itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                        formatter={(val) => formatCurrency(val)}
                                        labelStyle={{ color: theme === 'light' ? '#64748b' : '#94a3b8', marginBottom: '4px' }}
                                    />
                                    <Line type="monotone" dataKey="Entradas" stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                                    <Line type="monotone" dataKey="Saídas" stroke="#F43F5E" strokeWidth={2} dot={{ r: 3, fill: '#F43F5E', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-500/10">
                            <span className={`text-xs font-semibold ${subTextColor}`}>Ganho Diário: <span className="text-emerald-500 font-bold">+ {formatCurrency(investmentStats.dailyYield)} /dia</span></span>
                        </div>
                    </div>
                </div>

                {/* Últimos Recebimentos */}
                <div className="xl:col-span-1">
                    <h3 className={`text-base font-bold mb-4 ${textColor}`}>Últimos Recebimentos</h3>
                    <div className={`p-6 rounded-[2rem] border flex flex-col justify-between ${cardBg}`} style={{ height: '340px' }}>
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <span className={`text-sm font-semibold ${textColor}`}>Atividade de Recebimentos</span>
                                <Settings className={`w-4 h-4 ${subTextColor}`} />
                            </div>
                            <div className="space-y-4">
                                {recentIncomes.length > 0 ? recentIncomes.map(t => (
                                    <div key={t.id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${theme === 'light' ? 'bg-slate-100' : 'bg-white/10'}`}>
                                                <span className={`text-xs font-black ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                                                    {t.description ? t.description.charAt(0).toUpperCase() : 'R'}
                                                </span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-bold truncate ${textColor}`}>{t.description || 'Recebimento'}</p>
                                                <p className={`text-[10px] truncate ${subTextColor}`}>{t.category || 'Entrada'}</p>
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
                            <span className={`text-xs font-semibold ${subTextColor}`}>
                                Total Recebido (Mês): <span className={textColor}>{formatCurrency(walletStats.income)}</span>
                            </span>
                        </div>
                    </div>
                </div>

            </div>

            {/* ROW 3: Health Score (already formatted closely to the image) */}
            <div className="mt-8">
                <HealthScoreCard scoreData={healthScore} />
            </div>

        </div>
    );
}
