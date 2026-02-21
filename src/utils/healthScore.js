export const NECESSITY_CATEGORIES = ['housing', 'food', 'transport', 'health', 'education', 'taxes', 'church', 'loan'];
export const DESIRE_CATEGORIES = ['leisure', 'shopping', 'personal_care', 'subscriptions', 'pets', 'other'];
export const SAVINGS_CATEGORIES = ['investment'];

export const calculateHealthScore = (transactions, manualConfig) => {
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7);
    const monthTx = transactions.filter(t => t.date.startsWith(currentMonth));

    // 1. Month Performance (20 points)
    const income = monthTx.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = monthTx.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    // Treat investments as "savings" rather than typical expenses for performance purposes
    const savings = monthTx.filter(t => t.type === 'expense' && SAVINGS_CATEGORIES.includes(t.category)).reduce((acc, t) => acc + t.amount, 0);
    const actualExpense = expense - savings;

    const performanceScore = income > 0 ? Math.min(20, (Math.max(0, income - actualExpense) / income) * 100 * 0.2) : 0;

    // 2. Budget Allocation (30 points)
    // 50/30/20 Rule: 50% Necessities, 30% Desires, 20% Savings
    const necessities = monthTx.filter(t => t.type === 'expense' && NECESSITY_CATEGORIES.includes(t.category)).reduce((acc, t) => acc + t.amount, 0);
    const desires = monthTx.filter(t => t.type === 'expense' && DESIRE_CATEGORIES.includes(t.category)).reduce((acc, t) => acc + t.amount, 0);

    let allocationScore = 0;
    if (income > 0) {
        const necRatio = necessities / income;
        const desRatio = desires / income;
        const savRatio = (income - actualExpense) / income;

        // 50/30/20 Rule benchmarks
        if (necRatio <= 0.55) allocationScore += 10;
        else if (necRatio <= 0.65) allocationScore += 5;

        if (desRatio <= 0.35) allocationScore += 10;
        else if (desRatio <= 0.45) allocationScore += 5;

        if (savRatio >= 0.20) allocationScore += 10;
        else if (savRatio >= 0.10) allocationScore += 5;
    }

    // 3. Emergency Reserve / Fixed Expenses (50 points)
    // Ideal: 6 months of fixed expenses
    const fixedExpenses = manualConfig && manualConfig.fixedExpenses ? parseFloat(manualConfig.fixedExpenses) : 0;

    // totalBalance should include the manual invested value plus all transactions (income - expense)
    // But since investments as "expense" already decrease balance, we use the net flow
    const totalBalance = transactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);
    // Add back the manual invested to reflect total available liquidity if needed, 
    // but usually reserve is about LIQUID balance. Let's keep it as is or use a specific reserve logic.
    // For now, let's stick to the balance (money in hand/bank).

    let reserveScore = 0;
    if (fixedExpenses > 0) {
        const monthsCovered = totalBalance / fixedExpenses;
        reserveScore = Math.min(50, (monthsCovered / 6) * 50);
    } else if (totalBalance > 0) {
        reserveScore = 25; // Default if no fixed expenses defined but balance is positive
    }

    const totalScore = Math.min(100, Math.round(performanceScore + allocationScore + reserveScore));

    // Qualitative Feedback
    let feedback = "Comece a registrar seus gastos para ver seu score.";
    let color = "text-slate-400";
    let bg = "bg-slate-800";

    if (totalScore >= 90) {
        feedback = "Excelente! Você está no caminho da Independência Financeira.";
        color = "text-emerald-400";
        bg = "bg-emerald-500/10";
    } else if (totalScore >= 70) {
        feedback = "Muito bom! Sua saúde financeira está sólida.";
        color = "text-blue-400";
        bg = "bg-blue-500/10";
    } else if (totalScore >= 50) {
        feedback = "Razoável. Tente reduzir gastos supérfluos (Desejos).";
        color = "text-yellow-400";
        bg = "bg-yellow-500/10";
    } else if (totalScore > 0) {
        feedback = "Alerta! Você precisa priorizar sua Reserva de Emergência.";
        color = "text-rose-400";
        bg = "bg-rose-500/10";
    }

    return { score: totalScore, feedback, color, bg };
};
