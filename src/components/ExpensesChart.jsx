import React, { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const COLORS = {
    housing: '#FB7185', // rose-400
    food: '#FB923C', // orange-400
    transport: '#FACC15', // yellow-400
    health: '#F87171', // red-400
    education: '#60A5FA', // blue-400
    pets: '#B45309', // amber-700
    personal_care: '#F9A8D4', // pink-300
    subscriptions: '#C084FC', // purple-400
    credit_card: '#8B5CF6', // violet-500
    church: '#93C5FD', // blue-300
    taxes: '#64748B', // slate-500
    leisure: '#818CF8', // indigo-400
    shopping: '#F472B6', // pink-400
    other: '#94A3B8' // slate-400
};

const CATEGORY_LABELS = {
    housing: 'Casa',
    food: 'Alimentação',
    transport: 'Transporte',
    health: 'Saúde',
    education: 'Educação',
    pets: 'Pets',
    personal_care: 'Cuidados',
    subscriptions: 'Assinaturas',
    credit_card: 'Cartão',
    church: 'Igreja',
    taxes: 'Taxas',
    leisure: 'Lazer',
    shopping: 'Compras',
    other: 'Outro'
};

export default function ExpensesChart({ transactions }) {
    const data = useMemo(() => {
        const expenses = transactions.filter(t => t.type === 'expense');
        const grouped = expenses.reduce((acc, curr) => {
            const cat = curr.category || 'other';
            if (!acc[cat]) {
                acc[cat] = 0;
            }
            acc[cat] += parseFloat(curr.amount);
            return acc;
        }, {});

        return Object.keys(grouped).map(key => ({
            name: CATEGORY_LABELS[key] || 'Outro',
            value: grouped[key],
            color: COLORS[key] || COLORS.other
        })).sort((a, b) => b.value - a.value);
    }, [transactions]);

    if (data.length === 0) {
        return null;
    }

    const totalExpense = data.reduce((acc, curr) => acc + curr.value, 0);

    return (
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Despesas por Categoria</h3>
            <div className="h-64 w-full relative" style={{ minWidth: "100%", minHeight: "250px" }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                            itemStyle={{ color: '#f8fafc' }}
                            formatter={(value) => `R$ ${value.toLocaleString()}`}
                        />
                        <Legend
                            layout="vertical"
                            verticalAlign="middle"
                            align="right"
                            iconType="circle"
                            formatter={(value, entry) => <span className="text-slate-300 ml-1">{value}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-4 flex flex-col items-center justify-center p-4 bg-slate-800/80 rounded-xl border border-slate-700/50">
                <span className="text-sm text-slate-400 font-medium uppercase tracking-wide">Total Despesas</span>
                <span className="text-3xl font-bold text-slate-100 mt-1">
                    R$ {totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            </div>
        </div>
    );
}
