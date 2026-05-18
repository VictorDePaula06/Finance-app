import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { useTheme } from '../contexts/ThemeContext';
import { Utensils, Circle, CreditCard } from 'lucide-react';

const COLORS = {
    housing: '#FB7185', // rose-400
    food: '#FB923C', // orange-400
    fast_food: '#F59E0B', // amber-500
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
    credit_card_bill: '#8B5CF6', // violet-500
    other: '#94A3B8' // slate-400
};

const CATEGORY_LABELS = {
    housing: 'Casa',
    food: 'Alimentação',
    fast_food: 'Fast Food',
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
    credit_card_bill: 'Fatura Cartão',
    other: 'Outro'
};

export default function ExpensesChart({ transactions, targetMonth, mode = 'gastos', selectedCard = 'all', subscriptions = [], includeCredit = false }) {
    const { theme } = useTheme();
    const [selectedPriority, setSelectedPriority] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);

    const filteredExpenses = useMemo(() => {
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
                (includeCredit || t.paymentMethod !== 'credito') &&
                (t.date?.slice(0, 7) === monthToFilter || t.month === monthToFilter)
            );
        }
        return { expenses, subsToInclude };
    }, [transactions, targetMonth, mode, selectedCard, subscriptions, includeCredit]);

    const data = useMemo(() => {
        const { expenses, subsToInclude } = filteredExpenses;
        const grouped = expenses.reduce((acc, curr) => {
            const cat = curr.category || 'other';
            if (!acc[cat]) {
                acc[cat] = 0;
            }
            acc[cat] += (parseFloat(curr.amount) || 0);
            return acc;
        }, {});

        subsToInclude.forEach(sub => {
            if (sub.type === 'installment') {
                const cat = sub.category || 'other';
                grouped[cat] = (grouped[cat] || 0) + (parseFloat(sub.value) || 0);
            } else {
                grouped['subscriptions'] = (grouped['subscriptions'] || 0) + (parseFloat(sub.value) || 0);
            }
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
    }, [filteredExpenses]);

    const byPriority = useMemo(() => {
        const { expenses } = filteredExpenses;
        return expenses.reduce((acc, curr) => {
            const priority = curr.priority || 'other';
            if (!acc[priority]) acc[priority] = 0;
            acc[priority] += (parseFloat(curr.amount) || 0);
            return acc;
        }, {});
    }, [filteredExpenses]);

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
                            onClick={(node) => setSelectedCategory(selectedCategory === node.id ? null : node.id)}
                            style={{ cursor: 'pointer' }}
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



            {Object.keys(byPriority).length > 0 && (
              <div className={`mt-6 p-5 rounded-2xl border ${theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-3">Distribuição por Prioridade</p>
                  <div className="space-y-1">
                      {Object.entries(byPriority).sort(([,a],[,b]) => b - a).map(([priorityId, value]) => {
                          const priorityLabels = {
                              essential: 'Essencial',
                              comfort: 'Conforto',
                              superfluous: 'Supérfluo',
                              other: 'Outros'
                          };
                          const label = priorityLabels[priorityId] || priorityId;
                          const pct = totalExpense > 0 ? ((value / totalExpense) * 100).toFixed(0) : 0;
                          return (
                              <button 
                                  key={priorityId} 
                                  onClick={() => setSelectedPriority(selectedPriority === priorityId ? null : priorityId)}
                                  className={`w-full flex items-center justify-between p-2 rounded-xl transition-all ${
                                      selectedPriority === priorityId 
                                      ? (theme === 'light' ? 'bg-white shadow-sm border border-slate-100' : 'bg-white/10')
                                      : 'hover:bg-black/5'
                                  }`}
                              >
                                  <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${
                                          priorityId === 'essential' ? 'bg-emerald-500' :
                                          priorityId === 'comfort' ? 'bg-blue-500' :
                                          priorityId === 'superfluous' ? 'bg-rose-500' : 'bg-slate-400'
                                      }`} />
                                      <span className={`text-xs font-bold ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{label}</span>
                                  </div>
                                  <div className="text-right">
                                      <span className={`text-xs font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                          R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </span>
                                      <span className="text-[9px] font-bold text-slate-400 ml-2">{pct}%</span>
                                  </div>
                              </button>
                          );
                      })}
                  </div>
              </div>
            )}

            {/* Drill-down Transaction List */}
            {selectedPriority && (
                <div className={`mt-4 p-4 rounded-2xl border ${theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-3">
                        Lançamentos - {selectedPriority === 'essential' ? 'Essencial' : selectedPriority === 'comfort' ? 'Conforto' : selectedPriority === 'superfluous' ? 'Supérfluo' : 'Outros'}
                    </p>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {filteredExpenses.expenses
                            .filter(t => t.priority === selectedPriority || (selectedPriority === 'other' && !t.priority))
                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                            .map(t => (
                                <div key={t.id} className={`flex items-center justify-between p-2 rounded-lg transition-colors ${theme === 'light' ? 'bg-white hover:bg-slate-100' : 'bg-white/5 hover:bg-white/10'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme === 'light' ? 'bg-slate-100' : 'bg-white/10'}`}>
                                            <Utensils className="w-4 h-4 text-slate-500" />
                                        </div>
                                        <div>
                                            <p className={`text-xs font-bold ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{t.description || 'Sem descrição'}</p>
                                            <p className="text-[10px] text-slate-500">{new Date(t.date).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                    </div>
                                    <span className={`text-xs font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                        - R$ {parseFloat(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            ))}
                        {filteredExpenses.expenses.filter(t => t.priority === selectedPriority || (selectedPriority === 'other' && !t.priority)).length === 0 && (
                            <p className="text-xs font-bold text-slate-400 text-center py-2">Nenhuma transação encontrada.</p>
                        )}
                    </div>
                </div>
            )}

            {/* Drill-down Category List for Cards */}
            {mode === 'cartoes' && selectedCategory && (
                <div className={`mt-4 p-4 rounded-2xl border ${theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-3">
                        Lançamentos - {CATEGORY_LABELS[selectedCategory] || selectedCategory}
                    </p>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {selectedCategory === 'subscriptions' ? (
                            <>
                                {/* Assinaturas fixas */}
                                {filteredExpenses.subsToInclude.filter(s => s.type !== 'installment' || s.category === 'subscriptions').map(sub => (
                                    <div key={`sub-${sub.id}`} className={`flex items-center justify-between p-2 rounded-lg transition-colors ${theme === 'light' ? 'bg-white hover:bg-slate-100' : 'bg-white/5 hover:bg-white/10'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme === 'light' ? 'bg-slate-100' : 'bg-white/10'}`}>
                                                <CreditCard className="w-4 h-4 text-slate-500" />
                                            </div>
                                            <div>
                                                <p className={`text-xs font-bold ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{sub.name || 'Sem nome'}</p>
                                                <p className="text-[10px] text-slate-500">Assinatura Mensal</p>
                                            </div>
                                        </div>
                                        <span className={`text-xs font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                            - R$ {parseFloat(sub.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                ))}
                                {/* Lançamentos manuais categorizados como assinatura */}
                                {filteredExpenses.expenses
                                    .filter(t => t.category === 'subscriptions')
                                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                                    .map(t => (
                                        <div key={t.id} className={`flex items-center justify-between p-2 rounded-lg transition-colors ${theme === 'light' ? 'bg-white hover:bg-slate-100' : 'bg-white/5 hover:bg-white/10'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme === 'light' ? 'bg-slate-100' : 'bg-white/10'}`}>
                                                    <Utensils className="w-4 h-4 text-slate-500" />
                                                </div>
                                                <div>
                                                    <p className={`text-xs font-bold ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{t.description || 'Sem descrição'}</p>
                                                    <p className="text-[10px] text-slate-500">{new Date(t.date).toLocaleDateString('pt-BR')}</p>
                                                </div>
                                            </div>
                                            <span className={`text-xs font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                                - R$ {parseFloat(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    ))}
                                {filteredExpenses.subsToInclude.length === 0 && filteredExpenses.expenses.filter(t => t.category === 'subscriptions').length === 0 && (
                                    <p className="text-xs font-bold text-slate-400 text-center py-2">Nenhuma assinatura encontrada.</p>
                                )}
                            </>
                        ) : (
                            /* Outras categorias */
                            <>
                                {filteredExpenses.subsToInclude.filter(s => s.type === 'installment' && (s.category || 'other') === selectedCategory).map(sub => (
                                    <div key={`sub-${sub.id}`} className={`flex items-center justify-between p-2 rounded-lg transition-colors ${theme === 'light' ? 'bg-white hover:bg-slate-100' : 'bg-white/5 hover:bg-white/10'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme === 'light' ? 'bg-slate-100' : 'bg-white/10'}`}>
                                                <CreditCard className="w-4 h-4 text-slate-500" />
                                            </div>
                                            <div>
                                                <p className={`text-xs font-bold ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{sub.name || 'Sem nome'}</p>
                                                <p className="text-[10px] text-slate-500">Parcelamento</p>
                                            </div>
                                        </div>
                                        <span className={`text-xs font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                            - R$ {parseFloat(sub.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                ))}
                                {filteredExpenses.expenses
                                    .filter(t => t.category === selectedCategory)
                                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                                    .map(t => (
                                        <div key={t.id} className={`flex items-center justify-between p-2 rounded-lg transition-colors ${theme === 'light' ? 'bg-white hover:bg-slate-100' : 'bg-white/5 hover:bg-white/10'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme === 'light' ? 'bg-slate-100' : 'bg-white/10'}`}>
                                                    <Utensils className="w-4 h-4 text-slate-500" />
                                                </div>
                                                <div>
                                                    <p className={`text-xs font-bold ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{t.description || 'Sem descrição'}</p>
                                                    <p className="text-[10px] text-slate-500">{new Date(t.date).toLocaleDateString('pt-BR')}</p>
                                                </div>
                                            </div>
                                            <span className={`text-xs font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                                                - R$ {parseFloat(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    ))}
                                {filteredExpenses.expenses.filter(t => t.category === selectedCategory).length === 0 && (
                                    <p className="text-xs font-bold text-slate-400 text-center py-2">Nenhuma transação encontrada.</p>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
