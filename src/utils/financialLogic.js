export const calculateFinancialHealth = (transactions, manualConfig = null) => {
    // Default values
    let averageIncome = 0;
    let averageExpenses = 0;
    let fixedExpenses = 0;
    let variableEstimate = 0;
    let disposableIncome = 0;
    let hasData = false;

    // 1. Calculate from Transactions (Automatic)
    const today = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(today.getMonth() - 3);

    const recentTransactions = (transactions || []).filter(t => new Date(t.date) >= threeMonthsAgo);

    if (recentTransactions.length > 0) {
        hasData = true;
        const monthlyData = {};
        recentTransactions.forEach(t => {
            const monthKey = t.date.slice(0, 7); // YYYY-MM
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { income: 0, expense: 0 };
            }
            if (t.type === 'income') {
                monthlyData[monthKey].income += parseFloat(t.amount);
            } else {
                monthlyData[monthKey].expense += parseFloat(t.amount);
            }
        });

        const months = Object.keys(monthlyData).length || 1;
        const totalIncome = Object.values(monthlyData).reduce((acc, curr) => acc + curr.income, 0);
        const totalExpenses = Object.values(monthlyData).reduce((acc, curr) => acc + curr.expense, 0);

        averageIncome = totalIncome / months;
        averageExpenses = totalExpenses / months;
    }

    // 2. Apply Manual Overrides
    if (manualConfig) {
        if (manualConfig.income > 0) {
            averageIncome = parseFloat(manualConfig.income);
            hasData = true; // Manual input is enough to have data
        }
        if (manualConfig.fixedExpenses > 0) {
            fixedExpenses = parseFloat(manualConfig.fixedExpenses);
        }
        if (manualConfig.variableEstimate > 0) {
            variableEstimate = parseFloat(manualConfig.variableEstimate);
        }
    }

    // 3. Final Calculation
    // If we have manual expenses, use them. Otherwise fallback to average accumulated expenses.
    // If user provided Fixed + Variable, we use that sum.
    // If user provided ONLY Fixed, we might want to add average variable? 
    // For simplicity: If Manual Config exists for expenses, prefer it.

    let totalEstimatedExpenses = averageExpenses;

    if (manualConfig && (manualConfig.fixedExpenses > 0 || manualConfig.variableEstimate > 0)) {
        totalEstimatedExpenses = (parseFloat(manualConfig.fixedExpenses) || 0) + (parseFloat(manualConfig.variableEstimate) || 0);
    }

    disposableIncome = averageIncome - totalEstimatedExpenses;

    return {
        averageIncome,
        averageExpenses, // Historical average
        totalEstimatedExpenses, // Used for calculation
        disposableIncome,
        hasData,
        isManual: !!manualConfig
    };
};

export const simulatePurchase = (amount, installments, healthData) => {
    const { disposableIncome, averageIncome } = healthData;
    const monthlyCost = installments > 0 ? amount / installments : amount;

    // Scenarios
    const remainingAfterPurchase = disposableIncome - monthlyCost;
    const incomeImpactPercentage = (monthlyCost / averageIncome) * 100;

    let status = 'approved'; // approved, warning, denied
    let message = '';

    if (remainingAfterPurchase < 0) {
        status = 'denied';
        message = 'Esta compra excede seu saldo livre médio mensal. Alto risco de endividamento.';
    } else if (remainingAfterPurchase < (averageIncome * 0.1)) { // Less than 10% buffer remains
        status = 'warning';
        message = 'Aprovado, mas com cautela. Seu saldo livre ficará muito baixo (' + remainingAfterPurchase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + ').';
    } else if (incomeImpactPercentage > 30) {
        status = 'warning';
        message = 'Cuidado: Esta parcela compromete mais de 30% da sua renda média mensal.';
    } else {
        status = 'approved';
        message = 'Compra viável! Você tem saldo suficiente e manterá uma margem de segurança.';
    }

    return {
        status,
        message,
        monthlyCost,
        remainingAfterPurchase
    };
};

export const calculateFutureProjections = (transactions, manualConfig, months = 6) => {
    const today = new Date();
    const projections = [];

    // Base Values
    const monthlyIncome = manualConfig?.income ? parseFloat(manualConfig.income) : 0;
    const fixedExpenses = manualConfig?.fixedExpenses ? parseFloat(manualConfig.fixedExpenses) : 0;

    for (let i = 0; i < months; i++) {
        const targetDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const monthKey = targetDate.toISOString().slice(0, 7); // YYYY-MM

        // Calculate Installments for this specific month
        // We look for transactions that have this monthKey as their 'month' property
        // The system already creates individual transaction records for future installments with correct 'month'
        const monthTransactions = transactions.filter(t => t.month === monthKey && t.type === 'expense');
        const monthInstallmentsTotal = monthTransactions.reduce((acc, t) => acc + parseFloat(t.amount), 0);

        // Total Committed
        const totalCommitted = fixedExpenses + monthInstallmentsTotal;
        const projectedBalance = monthlyIncome - totalCommitted;

        projections.push({
            date: monthKey,
            balance: projectedBalance,
            committed: totalCommitted,
            income: monthlyIncome,
            installments: monthInstallmentsTotal
        });
    }

    return projections;
};
