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

    // Add recurring subscriptions (card base) to estimated expenses
    // In current month health, we only count subscriptions that haven't reached their limit
    const recurringTotal = (manualConfig?.recurringSubs || []).reduce((acc, s) => {
        const amount = parseFloat(s.amount) || 0;
        const isExpired = s.totalInstallments > 0 && s.currentInstallment > s.totalInstallments;
        return isExpired ? acc : acc + amount;
    }, 0);
    totalEstimatedExpenses += recurringTotal;

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

export const calculateCumulativeBalance = (transactions, targetMonth) => {
    const getRobustMonth = (t) => {
        if (t.month) return t.month;
        if (!t.date) return "";
        return t.date.slice(0, 7);
    };

    const allPrev = [...(transactions || [])]
        .filter(t => getRobustMonth(t) <= targetMonth)
        .sort((a, b) => {
            const dateDiff = new Date(a.date) - new Date(b.date);
            if (dateDiff !== 0) return dateDiff;
            const aIsReset = a.category === 'initial_balance' || a.category === 'carryover';
            const bIsReset = b.category === 'initial_balance' || b.category === 'carryover';
            if (aIsReset && !bIsReset) return -1;
            if (!aIsReset && bIsReset) return 1;
            return 0;
        });

    if (allPrev.length === 0) return 0;

    let startIndex = 0;
    for (let i = allPrev.length - 1; i >= 0; i--) {
        if (allPrev[i].category === 'initial_balance' || allPrev[i].category === 'carryover') {
            startIndex = i;
            break;
        }
    }

    return allPrev.slice(startIndex).reduce((acc, t) => {
        const val = parseFloat(t.amount) || 0;
        return t.type === 'income' ? acc + val : acc - val;
    }, 0);
};

export const calculateFutureProjections = (transactions, manualConfig, months = 6) => {
    const today = new Date();
    const currentMonthKey = today.toLocaleDateString('en-CA').slice(0, 7);
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const monthProgress = dayOfMonth / daysInMonth;
    const remainingFraction = 1 - monthProgress;

    const projections = [];

    // Base Values
    let monthlyIncome = manualConfig?.income ? parseFloat(manualConfig.income) : 0;
    if (monthlyIncome === 0) {
        const health = calculateFinancialHealth(transactions, null);
        monthlyIncome = health.averageIncome || 0;
    }

    const fixedExpenses = manualConfig?.fixedExpenses ? parseFloat(manualConfig.fixedExpenses) : 0;
    const variableExpenses = manualConfig?.variableEstimate ? parseFloat(manualConfig.variableEstimate) : 0;
    
    // helper to calculate recurring total for a specific month offset
    const getRecurringTotalForMonth = (offset) => {
        return (manualConfig?.recurringSubs || []).reduce((acc, s) => {
            const amount = parseFloat(s.amount) || 0;
            // If it's a "forever" sub or hasn't expired yet
            const isForever = !s.totalInstallments || s.totalInstallments === 0;
            const isNotYetExpired = !isForever && (s.currentInstallment + offset <= s.totalInstallments);
            
            return (isForever || isNotYetExpired) ? acc + amount : acc;
        }, 0);
    };

    // Start from current real balance
    let rollingBalance = calculateCumulativeBalance(transactions, currentMonthKey);

    for (let i = 0; i < months; i++) {
        const targetDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const monthKey = targetDate.toLocaleDateString('en-CA').slice(0, 7);

        // Fetch installments/transactions specifically launched for this future month
        const monthTransactions = transactions.filter(t => t.month === monthKey && t.type === 'expense');
        const monthInstallmentsTotal = monthTransactions.reduce((acc, t) => acc + parseFloat(t.amount), 0);

        let currentMonthRecurring = 0;
        let monthlyDelta = 0;

        if (i === 0) {
            // Current Month
            const totalPlannedExpenses = fixedExpenses + variableExpenses;
            const remainingBudget = totalPlannedExpenses * remainingFraction;
            const remainingIncome = monthlyIncome * remainingFraction;
            
            // For i=0, we use remaining projections
            monthlyDelta = remainingIncome - remainingBudget;
            currentMonthRecurring = getRecurringTotalForMonth(0);
        } else {
            // Future Months
            currentMonthRecurring = getRecurringTotalForMonth(i);
            const totalCommitted = fixedExpenses + monthInstallmentsTotal + variableExpenses + currentMonthRecurring;
            monthlyDelta = monthlyIncome - totalCommitted;
        }

        rollingBalance += monthlyDelta;

        projections.push({
            date: monthKey,
            balance: rollingBalance,
            monthlyDelta: monthlyDelta,
            income: monthlyIncome,
            committed: fixedExpenses + monthInstallmentsTotal + variableExpenses + currentMonthRecurring,
            installments: monthInstallmentsTotal,
            variableEstimated: variableExpenses,
            fixed: fixedExpenses,
            recurring: currentMonthRecurring
        });
    }

    return projections;
};

export const calculateSpendingPace = (transactions, manualConfig) => {
    if (!manualConfig || !manualConfig.categoryBudgets) return [];

    const budgets = manualConfig.categoryBudgets;
    const categoryIds = Object.keys(budgets).filter(id => budgets[id] > 0);
    if (categoryIds.length === 0) return [];

    const today = new Date();
    const currentMonth = today.toLocaleDateString('en-CA').slice(0, 7); // YYYY-MM (Local)
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const monthProgress = dayOfMonth / daysInMonth;

    const alerts = [];

    categoryIds.forEach(catId => {
        const limit = parseFloat(budgets[catId]);
        const spent = transactions
            .filter(t => {
                const txMonth = t.month || (t.date ? t.date.slice(0, 7) : '');
                return txMonth === currentMonth && t.category === catId && t.type === 'expense';
            })
            .reduce((acc, t) => acc + parseFloat(t.amount), 0);

        if (spent === 0) return;

        const budgetUsage = spent / limit;

        // Alerta se o gasto estiver à frente do tempo (zero de tolerância para ser proativo)
        // Ou se o mês ficou um pouco apertado (usage >= 1)
        if (budgetUsage >= 1) {
            alerts.push({
                categoryId: catId,
                spent,
                limit,
                usage: budgetUsage,
                type: 'danger',
                message: `O mês ficou um pouco apertado! Você já usou R$ ${spent.toFixed(2)} da sua margem de R$ ${limit.toFixed(2)}.`
            });
        } else if (budgetUsage > monthProgress) {
            alerts.push({
                categoryId: catId,
                spent,
                limit,
                usage: budgetUsage,
                type: 'warning',
                message: `Ritmo acelerado! Você já usou ${(budgetUsage * 100).toFixed(0)}% da sua margem em ${(monthProgress * 100).toFixed(0)}% do mês.`
            });
        }
    });

    return alerts;
};
