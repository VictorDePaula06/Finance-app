import React, { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const COLORS = {
    housing: '#FB7185', // rose-400
    food: '#FB923C', // orange-400
    transport: '#FACC15', // yellow-400
    health: '#F87171', // red-400
    leisure: '#818CF8', // indigo-400
    shopping: '#F472B6', // pink-400
    other: '#94A3B8' // slate-400
};

const CATEGORY_LABELS = {
    housing: 'Casa',
    food: 'Alimentação',
    transport: 'Transporte',
    health: 'Saúde',
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
