import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, ArrowUpCircle, ArrowDownCircle, Trash2, Pencil, Calendar, Search, Wallet, TrendingUp, TrendingDown, FileText, X, Download, Home, Utensils, Car, Heart, Gamepad2, ShoppingBag, Briefcase, Laptop, Circle } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// New Card Component
function Card({ title, value, icon: Icon, color, highlight }) {
    return (
        <div className={`p-5 rounded-2xl border ${highlight ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
            <div className="flex justify-between items-start mb-2">
                <span className="text-slate-400 text-sm font-medium">{title}</span>
                <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="text-2xl font-bold text-slate-100">
                R$ {value.toLocaleString()}
            </div>
        </div>
    );
}

const CATEGORIES = {
    income: [
        { id: 'salary', label: 'Salário', icon: Briefcase, color: 'text-emerald-400' },
        { id: 'freelance', label: 'Freelance', icon: Laptop, color: 'text-blue-400' },
        { id: 'investment', label: 'Investim.', icon: TrendingUp, color: 'text-purple-400' },
        { id: 'gift', label: 'Presente', icon: Wallet, color: 'text-yellow-400' },
        { id: 'other', label: 'Outro', icon: Circle, color: 'text-slate-400' }
    ],
    expense: [
        { id: 'housing', label: 'Casa', icon: Home, color: 'text-rose-400' },
        { id: 'food', label: 'Alimentação', icon: Utensils, color: 'text-orange-400' },
        { id: 'transport', label: 'Transporte', icon: Car, color: 'text-yellow-400' },
        { id: 'health', label: 'Saúde', icon: Heart, color: 'text-red-400' },
        { id: 'leisure', label: 'Lazer', icon: Gamepad2, color: 'text-indigo-400' },
        { id: 'shopping', label: 'Compras', icon: ShoppingBag, color: 'text-pink-400' },
        { id: 'other', label: 'Outro', icon: Circle, color: 'text-slate-400' }
    ]
};

export default function TransactionSection() {
    const [transactions, setTransactions] = useState([]);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(() => {
        const now = new Date();
        return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    });
    const [type, setType] = useState('expense');
    const [category, setCategory] = useState({ id: 'other', label: 'Outro', icon: Circle, color: 'text-slate-400' });
    const [editingId, setEditingId] = useState(null);
    const { currentUser } = useAuth();
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [showReport, setShowReport] = useState(false);

    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, 'transactions'),
            where('userId', '==', currentUser.uid),
            orderBy('date', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTransactions(docs);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount || !description || !currentUser) return;

        const val = parseFloat(amount);
        // Create date object (noon local time) to avoid timezone shifts
        const [year, month, day] = date.split('-').map(Number);
        const transactionDate = new Date(year, month - 1, day, 12, 0, 0);

        const transactionData = {
            description,
            amount: val,
            description,
            amount: val,
            type,
            category: category.id, // Store category ID for simplicity
            date: transactionDate.toISOString(),
            userId: currentUser.uid,
            month: transactionDate.toISOString().slice(0, 7) // Store month for easier filtering
        };

        try {
            if (editingId) {
                await updateDoc(doc(db, 'transactions', editingId), transactionData);
                setEditingId(null);
            } else {
                await addDoc(collection(db, 'transactions'), transactionData);
            }
            setAmount('');
            // Reset to defaults
            const now = new Date();
            setDate(now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'));
            setType('expense');
            setCategory({ id: 'other', label: 'Outro', icon: Circle, color: 'text-slate-400' });
        } catch (error) {
            console.error("Error saving transaction:", error);
        }
    };

    const handleEdit = (t) => {
        setAmount(t.amount);
        setDescription(t.description);
        setType(t.type);
        // Find category explicitly
        const catList = t.type === 'income' ? CATEGORIES.income : CATEGORIES.expense;
        const foundCat = catList.find(c => c.id === t.category) || catList.find(c => c.id === 'other');
        setCategory(foundCat);

        // Convert ISO date back to YYYY-MM-DD local
        const d = new Date(t.date);
        const formattedDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        setDate(formattedDate);
        setEditingId(t.id);
    };

    const handleDelete = async (id) => {
        if (confirm('Tem certeza que deseja excluir?')) {
            await deleteDoc(doc(db, 'transactions', id));
        }
    };

    const filteredTransactions = transactions.filter(t => t.date.startsWith(selectedMonth));

    const income = filteredTransactions
        .filter(t => t.type === 'income')
        .reduce((acc, t) => acc + t.amount, 0);

    const expense = filteredTransactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => acc + t.amount, 0);

    const balance = income - expense;

    const monthlyReport = useMemo(() => {
        const report = {};
        transactions.forEach(t => {
            const monthKey = t.date.slice(0, 7);
            if (!report[monthKey]) {
                report[monthKey] = { income: 0, expense: 0, balance: 0, date: monthKey };
            }
            if (t.type === 'income') {
                report[monthKey].income += t.amount;
                report[monthKey].balance += t.amount;
            } else {
                report[monthKey].expense += t.amount;
                report[monthKey].balance -= t.amount;
            }
        });
        return Object.values(report).sort((a, b) => b.date.localeCompare(a.date));
    }, [transactions]);

    const exportToPDF = () => {
        const doc = new jsPDF();

        // Title
        doc.setFontSize(20);
        doc.setTextColor(30, 41, 59); // Slate 800
        doc.text("Relatório Financeiro", 14, 22);

        // Subtitle (Month/Year)
        doc.setFontSize(11);
        doc.setTextColor(100, 116, 139); // Slate 500
        const monthName = new Date(selectedMonth + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        doc.text(`Período: ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`, 14, 30);

        // Summary Box Background
        doc.setDrawColor(226, 232, 240); // Slate 200
        doc.setFillColor(248, 250, 252); // Slate 50
        doc.roundedRect(14, 38, 182, 28, 3, 3, 'FD');

        // Income Summary
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105); // Slate 600
        doc.text("Entradas", 24, 48);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(22, 163, 74); // Emerald 600
        doc.text(`+ R$ ${income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 24, 58);

        // Expense Summary
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text("Saídas", 85, 48);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(225, 29, 72); // Rose 600
        doc.text(`- R$ ${expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 85, 58);

        // Balance Summary
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text("Saldo", 146, 48);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        if (balance >= 0) {
            doc.setTextColor(37, 99, 235); // Blue 600
        } else {
            doc.setTextColor(225, 29, 72); // Rose 600
        }
        doc.text(`R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 146, 58);

        // Table Data Preparation
        // Table Data Preparation
        const tableColumn = ["Data", "Descrição", "Categoria", "Tipo", "Valor (R$)"];
        const tableRows = filteredTransactions.map(t => {
            const catList = t.type === 'income' ? CATEGORIES.income : CATEGORIES.expense;
            const foundCat = catList.find(c => c.id === t.category) || catList.find(c => c.id === 'other');
            return [
                new Date(t.date).toLocaleDateString('pt-BR'),
                t.description,
                foundCat ? foundCat.label : 'Geral',
                t.type === 'income' ? 'Entrada' : 'Saída',
                t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
            ];
        });

        // Generate Table
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 75,
            theme: 'grid',
            headStyles: {
                fillColor: [30, 41, 59], // Slate 800
                textColor: [255, 255, 255],
                halign: 'center',
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 10,
                cellPadding: 4,
                textColor: [51, 65, 85], // Slate 700
                valign: 'middle'
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 25 }, // Date
                1: { title: 'Descrição' }, // Description (auto width)
                2: { halign: 'center', cellWidth: 25 }, // Category
                3: { halign: 'center', cellWidth: 25 }, // Type
                4: { halign: 'right', cellWidth: 35, fontStyle: 'bold' } // Value
            },
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 4) {
                    const rowIndex = data.row.index;
                    const isIncome = filteredTransactions[rowIndex].type === 'income';
                    if (isIncome) {
                        data.cell.styles.textColor = [22, 163, 74]; // Emerald 600
                    } else {
                        data.cell.styles.textColor = [225, 29, 72]; // Rose 600
                    }
                }
            }
        });

        // Footer with Page Numbers
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184); // Slate 400
            doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
        }

        doc.save(`relatorio_${selectedMonth}.pdf`);
    };

    return (
        <div className="space-y-6 relative">
            {/* Report Modal */}
            {showReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-400" />
                                Relatório Mensal
                            </h3>
                            <button onClick={() => setShowReport(false)} className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="overflow-y-auto p-6 space-y-4">
                            {monthlyReport.length === 0 ? (
                                <p className="text-center text-slate-500 py-8">Nenhum histórico encontrado.</p>
                            ) : (
                                monthlyReport.map((month) => (
                                    <div
                                        key={month.date}
                                        onClick={() => {
                                            setSelectedMonth(month.date);
                                            setShowReport(false);
                                        }}
                                        className="bg-slate-800/30 border border-slate-700 p-4 rounded-xl hover:bg-slate-700/30 hover:border-blue-500/30 transition-all cursor-pointer group"
                                    >
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-bold text-lg text-slate-200 capitalize">
                                                {new Date(month.date + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                            </h4>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${month.balance >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                {month.balance >= 0 ? 'Positivo' : 'Negativo'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <p className="text-xs text-slate-500 mb-1">Entradas</p>
                                                <p className="text-emerald-400 font-medium">+ R$ {month.income.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 mb-1">Saídas</p>
                                                <p className="text-rose-400 font-medium">- R$ {month.expense.toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-slate-500 mb-1">Saldo</p>
                                                <p className={`font-bold ${month.balance >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                                                    R$ {month.balance.toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Cards Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card
                    title="Saldo Total"
                    value={balance}
                    icon={Wallet}
                    color="text-blue-400"
                    highlight={true}
                />
                <Card
                    title="Entradas"
                    value={income}
                    icon={TrendingUp}
                    color="text-emerald-400"
                />
                <Card
                    title="Saídas"
                    value={expense}
                    icon={TrendingDown}
                    color="text-rose-400"
                />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl border border-slate-700 shadow-xl">
                <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                    {editingId ? <Pencil className="w-5 h-5 text-blue-400" /> : <LayoutDashboard className="w-5 h-5 text-emerald-400" />}
                    {editingId ? 'Editar Transação' : 'Nova Transação'}
                </h3>

                <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">Descrição</label>
                    <input
                        type="text"
                        placeholder="Descrição"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">Data</label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 [color-scheme:dark]"
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">Valor</label>
                    <input
                        type="number"
                        placeholder="R$ 0,00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                </div>
                <div className="md:col-span-5">
                    <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">Categoria</label>
                    <div className="flex gap-2 p-1 bg-slate-900/50 rounded-xl border border-slate-700 overflow-x-auto">
                        {(type === 'income' ? CATEGORIES.income : CATEGORIES.expense).map(cat => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setCategory(cat)}
                                className={`p-2 rounded-lg flex flex-col items-center gap-1 min-w-[60px] transition-all ${category.id === cat.id ? 'bg-slate-700 ring-1 ring-slate-500' : 'hover:bg-slate-800'}`}
                                title={cat.label}
                            >
                                <cat.icon className={`w-5 h-5 ${cat.color}`} />
                                <span className="text-[10px] text-slate-400 truncate w-full text-center">{cat.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="md:col-span-12 flex flex-col md:flex-row gap-4">
                    <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-700 w-full md:w-auto">
                        <button
                            type="button"
                            onClick={() => { setType('income'); setCategory(CATEGORIES.income[CATEGORIES.income.length - 1]); }}
                            className={`flex-1 px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${type === 'income'
                                ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            <ArrowUpCircle className="w-4 h-4" /> Entrada
                        </button>
                        <button
                            type="button"
                            onClick={() => { setType('expense'); setCategory(CATEGORIES.expense[CATEGORIES.expense.length - 1]); }}
                            className={`flex-1 px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${type === 'expense'
                                ? 'bg-rose-500/20 text-rose-400 shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            <ArrowDownCircle className="w-4 h-4" /> Saída
                        </button>
                    </div>
                    <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 md:py-2 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 w-full md:w-auto">
                        {editingId ? 'Salvar Alterações' : 'Adicionar Transação'}
                    </button>
                </div>
            </form>

            {/* List Header & Filter */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-xl font-bold text-slate-100">Transações</h3>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={exportToPDF}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors text-sm font-medium"
                            title="Baixar Relatório em PDF"
                        >
                            <Download className="w-4 h-4" />
                            PDF
                        </button>
                        <button
                            onClick={() => setShowReport(true)}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors text-sm font-medium"
                        >
                            <FileText className="w-4 h-4" />
                            Relatórios
                        </button>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-2 rounded-xl border border-slate-700 w-full md:w-auto">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent text-slate-300 text-sm focus:outline-none w-full"
                        />
                    </div>
                </div>
            </div >

            {/* Transactions List */}
            < div className="space-y-3" >
                {
                    filteredTransactions.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 bg-slate-800/30 rounded-2xl border border-slate-800 border-dashed">
                            Nenhuma transação neste mês.
                        </div>
                    ) : (
                        filteredTransactions.map((t) => (
                            <div key={t.id} className="group bg-slate-800/50 backdrop-blur-sm p-4 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <div className={`p-3 rounded-xl bg-slate-900/50 border border-slate-700`}>
                                        {(() => {
                                            // Resolve Icon
                                            const catList = t.type === 'income' ? CATEGORIES.income : CATEGORIES.expense;
                                            const foundCat = catList.find(c => c.id === t.category) || catList.find(c => c.id === 'other') || { icon: Circle, color: 'text-slate-400' };
                                            const IconComponent = foundCat.icon;
                                            return <IconComponent className={`w-6 h-6 ${foundCat.color}`} />;
                                        })()}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-200">{t.description}</h4>
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            {new Date(t.date).toLocaleDateString()}
                                            <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                                            {(() => {
                                                const catList = t.type === 'income' ? CATEGORIES.income : CATEGORIES.expense;
                                                const foundCat = catList.find(c => c.id === t.category);
                                                return foundCat ? foundCat.label : 'Geral';
                                            })()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between w-full md:w-auto gap-6 mt-2 md:mt-0 md:pl-0">
                                    <span className={`font-bold text-lg ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString()}
                                    </span>
                                    <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEdit(t)} className="p-2 bg-slate-700/50 hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 rounded-lg transition-colors">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(t.id)} className="p-2 bg-slate-700/50 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )
                }
            </div >
        </div >
    );
}
