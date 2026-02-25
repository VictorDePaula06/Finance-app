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
    const getRobustMonth = (t) => {
        if (t.month) return t.month;
        if (!t.date) return "";
        let dStr = "";
        try {
            if (typeof t.date === 'string') dStr = t.date;
            else if (t.date.toDate) dStr = t.date.toDate().toISOString();
            else if (t.date.seconds) dStr = new Date(t.date.seconds * 1000).toISOString();
        } catch (e) { return ""; }
        return dStr.slice(0, 7);
    };

    const data = useMemo(() => {
        // Get current selected month from context or props? 
        // ExpensesChart in repository version doesn't receive selectedMonth but usually filters by "now" or "selected"
        // Wait, repository version of ExpensesChart.jsx line 38: export default function ExpensesChart({ transactions })
        // It receives transactions. We should probably filter THEM by month if we want to be consistent with the 0 balance fix.

        const now = new Date().toISOString().slice(0, 7);
        // Better: let the parent filter. But for now, let's just make the categorical grouping robust.

        const expenses = transactions.filter(t => t.type === 'expense');
        const grouped = expenses.reduce((acc, curr) => {
            const cat = curr.category || 'other';
            if (!acc[cat]) {
                acc[cat] = 0;
            }
            acc[cat] += (parseFloat(curr.amount) || 0);
            return acc;
        }, {});

        const totalExpense = Object.values(grouped).reduce((a, b) => a + (parseFloat(b) || 0), 0);
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
        return (
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col items-center justify-center min-h-[400px]">
                <span className="text-slate-500 text-sm">Nenhuma despesa para exibir</span>
            </div>
        );
    }

    const totalExpense = data.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);

    return (
        <div key="chart-container" className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col min-h-[440px]">
            <h3 key="chart-title" className="text-lg font-bold text-slate-100 mb-4">Despesas por Categoria</h3>
            <div key="chart-wrapper" className="h-72 w-full relative min-w-[300px]">
                <ResponsiveContainer key="chart-resp" width="99%" height="100%">
                    <PieChart key="pie-root">
                        <Pie
                            key="pie-main"
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
                                <Cell key={`cell-${entry.id}-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            key="chart-tooltip"
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc' }}
                            itemStyle={{ color: '#f8fafc' }}
                            formatter={(value) => `R$ ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        />
                        <Legend
                            key="chart-legend"
                            layout="horizontal"
                            verticalAlign="bottom"
                            align="center"
                            iconType="circle"
                            wrapperStyle={{
                                paddingTop: '20px',
                                fontSize: '10px'
                            }}
                            formatter={(value) => <span key={`legend-${value}`} className="text-slate-400 font-medium">{value}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            <div key="total-wrapper" className="mt-6 flex flex-col items-center justify-center p-4 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-sm">
                <span key="total-label" className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Gasto Total</span>
                <span key="total-value" className="text-3xl font-black text-white mt-1">
                    {`R$ ${totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </span>
            </div>
        </div>
    );
}
