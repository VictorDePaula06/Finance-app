import React, { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { useTheme } from '../contexts/ThemeContext';

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

export default function ExpensesChart({ transactions, targetMonth, mode = 'gastos', selectedCard = 'all', subscriptions = [] }) {
    const { theme } = useTheme();
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

        const monthToFilter = targetMonth || new Date().toISOString().slice(0, 7);
        let expenses;
        let subsToInclude = [];
        if (mode === 'cartoes') {
            expenses = transactions.filter(t =>
                t.type === 'expense' &&
                t.paymentMethod === 'credito' &&
                t.invoiceStatus === 'unpaid' &&
                (t.date?.slice(0, 7) === monthToFilter || t.month === monthToFilter) &&
                (selectedCard === 'all' || t.selectedCardId === selectedCard)
            );
            subsToInclude = subscriptions.filter(s => 
                s.cardId && (selectedCard === 'all' || s.cardId === selectedCard)
            );
        } else {
            expenses = transactions.filter(t =>
                t.type === 'expense' &&
                t.category !== 'investment' &&
                t.category !== 'vault' &&
                !(t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid') &&
                (t.date?.slice(0, 7) === monthToFilter || t.month === monthToFilter)
            );
        }
        const grouped = expenses.reduce((acc, curr) => {
            const cat = curr.category || 'other';
            if (!acc[cat]) {
                acc[cat] = 0;
            }
            acc[cat] += (parseFloat(curr.amount) || 0);
            return acc;
        }, {});

        subsToInclude.forEach(sub => {
            grouped['subscriptions'] = (grouped['subscriptions'] || 0) + (parseFloat(sub.value) || 0);
        });

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
    }, [transactions, targetMonth, mode, selectedCard, subscriptions]);

    if (data.length === 0) {
        return (
            <div className="bg-verde-respira/5 p-6 rounded-2xl border border-verde-respira/20 border-dashed flex flex-col items-center justify-center min-h-[400px]">
                <span className="text-slate-400 text-sm">Nenhuma despesa para exibir</span>
            </div>
        );
    }

    const totalExpense = data.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);

    return (
        <div key="chart-container" className="p-2 flex flex-col min-h-[440px]">
            <h3 key="chart-title" className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 px-2">{mode === 'cartoes' ? 'Fatura por Categoria' : 'Despesas por Categoria'}</h3>
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
                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#e2e8f0', borderRadius: '12px', color: '#1e293b', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                            itemStyle={{ color: '#1e293b', fontWeight: 'bold' }}
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
                            formatter={(value) => <span key={`legend-${value}`} className="text-slate-500 text-[10px] font-semibold">{value}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            <div key="total-wrapper" className={`mt-auto flex flex-col items-center justify-center p-6 rounded-3xl border shadow-sm transition-all ${
                theme === 'light' 
                ? 'bg-verde-respira/5 border-verde-respira/10 hover:bg-verde-respira/10' 
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}>
                <span key="total-label" className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{mode === 'cartoes' ? 'Total na Fatura' : 'Gasto Total no Período'}</span>
                <span key="total-value" className={`text-4xl font-black ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                    {`R$ ${totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </span>
            </div>
        </div>
    );
}
