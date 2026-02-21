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

        const totalExpense = Object.values(grouped).reduce((a, b) => a + b, 0);
        let processedData = Object.keys(grouped).map(key => ({
            id: key,
            name: CATEGORY_LABELS[key] || 'Outro',
            value: grouped[key],
            color: COLORS[key] || COLORS.other
        })).sort((a, b) => b.value - a.value);

        // Group small expenses (< 3%) into "Outro"
        if (processedData.length > 6) {
            const threshold = totalExpense * 0.03;
            const main = processedData.filter(d => d.value >= threshold);
            const others = processedData.filter(d => d.value < threshold);

            if (others.length > 0) {
                const othersSum = others.reduce((acc, curr) => acc + curr.value, 0);
                const existingOther = main.find(m => m.id === 'other');
                if (existingOther) {
                    existingOther.value += othersSum;
                } else {
                    main.push({
                        id: 'other',
                        name: 'Outro',
                        value: othersSum,
                        color: COLORS.other
                    });
                }
                processedData = main.sort((a, b) => b.value - a.value);
            }
        }

        return processedData;
    }, [transactions]);

    if (data.length === 0) {
        return null;
    }

    const totalExpense = data.reduce((acc, curr) => acc + curr.value, 0);

    return (
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col">
            <h3 className="text-lg font-bold text-slate-100 mb-4">Despesas por Categoria</h3>
            <div className="h-72 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="45%"
                            innerRadius={60}
                            outerRadius={85}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc' }}
                            itemStyle={{ color: '#f8fafc' }}
                            formatter={(value) => `R$ ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        />
                        <Legend
                            layout="horizontal"
                            verticalAlign="bottom"
                            align="center"
                            iconType="circle"
                            wrapperStyle={{
                                paddingTop: '20px',
                                fontSize: '10px'
                            }}
                            formatter={(value) => <span className="text-slate-400 font-medium">{value}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-6 flex flex-col items-center justify-center p-4 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-sm">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Gasto Total</span>
                <span className="text-3xl font-black text-white mt-1">
                    R$ {totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            </div>
        </div>
    );
}
