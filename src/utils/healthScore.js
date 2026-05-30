export const NECESSITY_CATEGORIES = ['housing', 'food', 'transport', 'health', 'education', 'taxes', 'church', 'loan'];
export const DESIRE_CATEGORIES = ['leisure', 'shopping', 'personal_care', 'subscriptions', 'pets', 'other'];
export const SAVINGS_CATEGORIES = ['investment', 'vault'];

export const calculateHealthScore = (transactions, manualConfig, savingsJars = []) => {
    const today = new Date();
    const currentMonth = today.toLocaleDateString('en-CA').slice(0, 7); // YYYY-MM (Local)

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

    const monthTx = transactions.filter(t => getRobustMonth(t) === currentMonth);

    // 1. Month Performance (20 points)
    // Filter logic aligned with App.jsx display logic
    const incomeFromTx = monthTx
        .filter(t => t.type === 'income' && t.category !== 'initial_balance' && t.category !== 'carryover' && t.category !== 'vault_redemption')
        .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

    // Use transaction income if available, otherwise fall back to manual base income
    const baseIncome = manualConfig && manualConfig.income ? parseFloat(manualConfig.income) : 0;
    const income = incomeFromTx > 0 ? incomeFromTx : baseIncome;

    const expense = monthTx
        .filter(t => t.type === 'expense' && t.paymentMethod !== 'credito')
        .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    // Treat investments as "savings" rather than typical expenses for performance purposes
    const savings = monthTx.filter(t => t.type === 'expense' && SAVINGS_CATEGORIES.includes(t.category)).reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    const actualExpense = expense - savings;

    const performanceScore = income > 0 ? Math.min(20, (Math.max(0, income - actualExpense) / income) * 100 * 0.2) : 0;

    // 2. Budget Allocation (30 points)
    // 50/30/20 Rule: 50% Necessities, 30% Desires, 20% Savings
    // Uses manual priority when available, falls back to category-based classification
    const classifyExpense = (t) => {
        if (t.priority === 'essential') return 'necessity';
        if (t.priority === 'superfluous') return 'desire';
        if (t.priority === 'comfort') return 'desire';
        // Fallback: classify by category (for older transactions without priority)
        if (SAVINGS_CATEGORIES.includes(t.category)) return 'savings';
        if (NECESSITY_CATEGORIES.includes(t.category)) return 'necessity';
        return 'desire';
    };
    const necessities = monthTx.filter(t => t.type === 'expense' && t.paymentMethod !== 'credito' && classifyExpense(t) === 'necessity').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    const desires = monthTx.filter(t => t.type === 'expense' && t.paymentMethod !== 'credito' && classifyExpense(t) === 'desire').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

    let allocationScore = 0;
    if (income > 0) {
        const necRatio = necessities / income;
        const desRatio = desires / income;
        const savRatio = savings / income;

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
    const investedManual = manualConfig && manualConfig.invested ? parseFloat(manualConfig.invested) : 0;

    // Saldo Operacional do mês (Entradas - Despesas típicas, SEM contar investimentos/cofrinhos como 'gasto')
    const operatingSurplus = income - actualExpense;
    
    // Fluxo de Caixa Líquido (Entradas - Saídas totais, incluindo investimentos)
    const netCashFlow = income - expense;

    // Total de investimentos via transações (histórico completo)
    const investmentTransactionsSum = transactions
        .reduce((acc, t) => {
            const val = parseFloat(t.amount) || 0;
            if (t.type === 'expense' && (t.category === 'investment' || t.category === 'vault')) {
                return acc + val;
            }
            if (t.type === 'income' && t.category === 'vault_redemption') {
                return acc - val;
            }
            return acc;
        }, 0);

    const jarsSum = savingsJars.reduce((acc, jar) => acc + (parseFloat(jar.dynamicBalance || jar.balance) || 0), 0);
    
    // Se temos cofrinhos/reservas, usamos a soma deles. Caso contrário, usamos a soma das transações.
    const reserveTotal = jarsSum > 0 ? jarsSum : investmentTransactionsSum;

    const totalPatrimonio = investedManual + reserveTotal;

    // Liquidez Total = Fluxo de Caixa Líquido + Patrimônio Total
    const totalLiquidity = netCashFlow + totalPatrimonio;

    let reserveScore = 0;
    if (fixedExpenses > 0) {
        const monthsCovered = totalLiquidity / fixedExpenses;
        reserveScore = Math.min(50, (monthsCovered / 6) * 50);
    } else if (totalLiquidity > 0) {
        reserveScore = 25; // Default if no fixed expenses defined but balance is positive
    }

    // Ensure scores are never NaN
    const safePerf = isNaN(performanceScore) ? 0 : performanceScore;
    const safeAlloc = isNaN(allocationScore) ? 0 : allocationScore;
    const safeReserve = isNaN(reserveScore) ? 0 : reserveScore;

    const totalScore = Math.min(100, Math.round(safePerf + safeAlloc + safeReserve));

    // Qualitative Feedback
    let feedback = "Comece a registrar seus gastos para ver seu score.";
    let color = "text-slate-400";
    let bg = "bg-slate-400/10";

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

    // Quantos pilares ainda estão abaixo de 90% do seu máximo (áreas a melhorar).
    const improvements = [
        performanceScore < 20 * 0.9,
        allocationScore < 30 * 0.9,
        reserveScore < 50 * 0.9,
    ].filter(Boolean).length;

    return {
        score: totalScore,
        feedback,
        color,
        bg,
        improvements,
        breakdown: {
            performance: Math.round(performanceScore),
            allocation: allocationScore,
            reserve: Math.round(reserveScore),
            data: {
                monthlyIncome: income,
                incomeSource: incomeFromTx > 0 ? 'transactions' : 'base',
                actualExpense,
                necessitiesAmount: necessities,
                desiresAmount: desires,
                savingsAmount: savings,
                monthlyBalance: operatingSurplus,
                netCashFlow,
                totalLiquidity,
                totalPatrimonio,
                reserveTotal: jarsSum,
                fixedExpenses,
                monthsCovered: fixedExpenses > 0 ? (totalLiquidity / fixedExpenses).toFixed(1) : "0.0",
                necRatio: income > 0 ? (necessities / income * 100).toFixed(0) : "0",
                desRatio: income > 0 ? (desires / income * 100).toFixed(0) : "0",
                savRatio: income > 0 ? (savings / income * 100).toFixed(0) : "0"
            }
        }
    };
};

/**
 * ÍNDICE DE SAÚDE FINANCEIRA (Gastos) — versão reformulada e configurável.
 *
 * Três pilares claros e amigáveis (total 100 pts), com metas ajustáveis:
 *   1. Sobra no mês          (30 pts) — quanto sobrou da renda (meta: surplusTargetPct%).
 *   2. Reserva de emergência (40 pts) — meses cobertos (meta: reserveTargetMonths).
 *   3. Gastos supérfluos     (30 pts) — % da renda em supérfluos (meta: até superfluousCap%).
 *
 * Estados: Excelente (≥80) · Bom (≥60) · Atenção (≥40) · Crítico (<40).
 *
 * @param {Array}  transactions  Lançamentos.
 * @param {Object} config        { income, fixedExpenses, healthConfig:{...} }.
 * @param {number} reserveTotal  Total guardado em reservas (R$).
 */
export const DEFAULT_HEALTH_CONFIG = {
    // Sobra mensal — meta em % da renda OU em R$
    surplusUnit: 'percent',      // 'percent' | 'amount'
    surplusTargetPct: 20,
    surplusTargetAmount: 0,
    // Reserva de emergência — meta em meses de despesa OU em R$ total
    reserveUnit: 'months',       // 'months' | 'amount'
    reserveTargetMonths: 6,
    reserveTargetAmount: 0,
    // Gastos supérfluos — teto em % da renda OU em R$
    superfluousUnit: 'percent',  // 'percent' | 'amount'
    superfluousCap: 30,
    superfluousCapAmount: 0,
};

export const calculateHealthIndex = (transactions = [], config = {}, reserveTotal = 0) => {
    const today = new Date();
    const currentMonth = today.toLocaleDateString('en-CA').slice(0, 7);
    const hc = { ...DEFAULT_HEALTH_CONFIG, ...(config.healthConfig || {}) };
    const fmtMoney = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const getRobustMonth = (t) => {
        if (t.month) return t.month;
        if (!t.date) return "";
        try {
            if (typeof t.date === 'string') return t.date.slice(0, 7);
            if (t.date.toDate) return t.date.toDate().toISOString().slice(0, 7);
            if (t.date.seconds) return new Date(t.date.seconds * 1000).toISOString().slice(0, 7);
        } catch { return ""; }
        return "";
    };
    const monthTx = transactions.filter(t => getRobustMonth(t) === currentMonth);

    // Renda: prioriza o que foi LANÇADO no mês; se não houver, usa a renda base configurada.
    const incomeFromTx = monthTx
        .filter(t => t.type === 'income' && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category))
        .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    const baseIncome = config?.income ? parseFloat(config.income) : 0;
    const income = incomeFromTx > 0 ? incomeFromTx : baseIncome;
    const incomeSource = incomeFromTx > 0 ? 'launched' : 'base';

    // Sem renda definida → não dá pra calcular nada de forma honesta.
    if (income <= 0) {
        const zero = (max) => ({ value: 0, months: 0, pct: 0, score: 0, max, status: 'bad', message: '', targetLabel: '' });
        return {
            score: 0, state: 'semdados', statusLabel: 'Sem dados',
            color: 'text-slate-400', accent: 'slate',
            badge: 'Configure sua renda base',
            heading: 'Vamos começar? 👋',
            description: 'Informe sua renda base (ou lance seus recebimentos) para calcular sua saúde financeira.',
            improvements: 3, income: 0, incomeSource,
            pillars: {
                surplus: { ...zero(30), targetLabel: 'Meta: sobrar todo mês' },
                reserve: { ...zero(40), targetLabel: 'Meta: montar reserva' },
                superfluous: { ...zero(30), targetLabel: 'Meta: controlar supérfluos', breakdown: { essential: 0, comfort: 0, superfluous: 0 } },
            },
            config: hc, feedback: '', updatedAt: today,
        };
    }

    // Classifica despesas (exclui crédito e aportes/investimentos).
    const classify = (t) => {
        if (t.priority === 'essential') return 'essential';
        if (t.priority === 'comfort') return 'comfort';
        if (t.priority === 'superfluous') return 'superfluous';
        if (NECESSITY_CATEGORIES.includes(t.category)) return 'essential';
        return 'superfluous';
    };
    const realExpenses = monthTx.filter(t =>
        t.type === 'expense' && t.paymentMethod !== 'credito' && !SAVINGS_CATEGORIES.includes(t.category)
    );
    let essential = 0, comfort = 0, superfluous = 0;
    realExpenses.forEach(t => {
        const v = parseFloat(t.amount) || 0;
        const c = classify(t);
        if (c === 'essential') essential += v;
        else if (c === 'comfort') comfort += v;
        else superfluous += v;
    });
    const totalSpent = essential + comfort + superfluous;
    const surplus = income - totalSpent;

    const pct = (v) => income > 0 ? (v / income) * 100 : 0;
    const clamp01 = (n) => Math.max(0, Math.min(1, n));

    // ── Pilar 1: Sobra no mês (30 pts) — meta em % da renda ou em R$ ──
    const surplusTarget = hc.surplusUnit === 'amount'
        ? (parseFloat(hc.surplusTargetAmount) || 0)
        : income * ((parseFloat(hc.surplusTargetPct) || 0) / 100);
    let surplusScore, surplusStatus;
    if (surplus <= 0) {
        surplusScore = 0; surplusStatus = 'bad';
    } else if (surplusTarget <= 0) {
        surplusScore = 30; surplusStatus = 'good';
    } else {
        surplusScore = clamp01(surplus / surplusTarget) * 30;
        surplusStatus = surplus >= surplusTarget ? 'good' : (surplus >= surplusTarget * 0.5 ? 'warn' : 'bad');
    }
    const surplusTargetLabel = surplusTarget <= 0
        ? 'Meta: sobrar todo mês'
        : (hc.surplusUnit === 'amount'
            ? `Meta: sobrar R$ ${fmtMoney(surplusTarget)}`
            : `Meta: sobrar ${hc.surplusTargetPct}% (≈ R$ ${fmtMoney(surplusTarget)})`);

    // ── Pilar 2: Reserva de emergência (40 pts) — meta em meses ou em R$ ──
    // Custo mensal de referência = gastos fixos cadastrados (autoFixedExpenses) ou,
    // na falta, o que foi gasto no mês; por último, 70% da renda.
    const monthlyExpenses = config?.fixedExpenses ? parseFloat(config.fixedExpenses)
        : (totalSpent > 0 ? totalSpent : income * 0.7);
    const reserveMonths = monthlyExpenses > 0 ? reserveTotal / monthlyExpenses : 0;
    let reserveScore, reserveStatus, reservePct, reserveTargetLabel;
    if (hc.reserveUnit === 'amount') {
        const targetAmt = parseFloat(hc.reserveTargetAmount) || 0;
        const ratio = targetAmt > 0 ? clamp01(reserveTotal / targetAmt) : 1;
        reserveScore = ratio * 40;
        reservePct = ratio * 100;
        reserveStatus = targetAmt <= 0 ? 'good'
            : (reserveTotal >= targetAmt ? 'good' : (reserveTotal >= targetAmt * 0.5 ? 'warn' : 'bad'));
        reserveTargetLabel = `Meta: R$ ${fmtMoney(targetAmt)} guardados`;
    } else {
        const targetM = parseFloat(hc.reserveTargetMonths) || 6;
        const ratio = clamp01(reserveMonths / targetM);
        reserveScore = ratio * 40;
        reservePct = ratio * 100;
        reserveStatus = reserveMonths >= targetM ? 'good'
            : (reserveMonths >= targetM * 0.5 ? 'warn' : 'bad');
        reserveTargetLabel = `Meta: mínimo ${targetM} meses`;
    }

    // ── Pilar 3: Gastos supérfluos (30 pts) — teto em % da renda ou em R$ ──
    const superfluousPct = pct(superfluous);
    const capValue = hc.superfluousUnit === 'amount'
        ? (parseFloat(hc.superfluousCapAmount) || 0)
        : income * ((parseFloat(hc.superfluousCap) || 0) / 100);
    const capDisplay = hc.superfluousUnit === 'amount' ? `R$ ${fmtMoney(capValue)}` : `${hc.superfluousCap}%`;
    let superfluousScore, superfluousStatus;
    if (capValue <= 0) {
        superfluousScore = superfluous <= 0 ? 30 : 0;
        superfluousStatus = superfluous <= 0 ? 'good' : 'bad';
    } else {
        const lo = capValue * 0.8, hi = capValue * 1.5;
        superfluousScore = clamp01((hi - superfluous) / (hi - lo)) * 30;
        superfluousStatus = superfluous <= lo ? 'good' : (superfluous <= capValue ? 'warn' : 'bad');
    }
    const superfluousTargetLabel = hc.superfluousUnit === 'amount'
        ? `Meta: até R$ ${fmtMoney(capValue)}`
        : `Meta: até ${hc.superfluousCap}% da renda`;

    const totalScore = Math.min(100, Math.round(surplusScore + reserveScore + superfluousScore));

    // ── Estado geral ──
    let state, statusLabel, color, accent, badge;
    if (totalScore >= 80) { state = 'excelente'; statusLabel = 'Excelente'; color = 'text-emerald-400'; accent = 'emerald'; badge = 'Sua saúde financeira está excelente'; }
    else if (totalScore >= 60) { state = 'bom'; statusLabel = 'Bom'; color = 'text-yellow-400'; accent = 'yellow'; badge = 'Sua saúde financeira está boa'; }
    else if (totalScore >= 40) { state = 'atencao'; statusLabel = 'Atenção'; color = 'text-orange-400'; accent = 'orange'; badge = 'Sua saúde financeira pede atenção'; }
    else { state = 'critico'; statusLabel = 'Crítico'; color = 'text-rose-400'; accent = 'rose'; badge = 'Sua saúde financeira está crítica'; }

    // Pilar mais fraco (para a mensagem principal).
    const pillarsRank = [
        { key: 'surplus', ratio: surplusScore / 30, name: 'sua sobra mensal' },
        { key: 'reserve', ratio: reserveScore / 40, name: 'sua reserva de emergência' },
        { key: 'superfluous', ratio: superfluousScore / 30, name: 'seus gastos supérfluos' },
    ].sort((a, b) => a.ratio - b.ratio);
    const weakest = pillarsRank[0];

    const fmtMonths = (m) => m.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    let heading, description;
    if (state === 'excelente') {
        heading = 'Mandou bem! Sua saúde financeira está excelente. 🎉';
        description = 'Você está no controle: gasta com equilíbrio, guarda e ainda sobra. Continue assim.';
    } else if (state === 'bom') {
        heading = 'Quase lá! Tem uma coisa que vale ajustar. 📌';
        description = `No geral você está bem. Mas ${weakest.name} ainda não chegou no ideal — vale focar nisso.`;
    } else if (state === 'atencao') {
        heading = 'Atenção! Alguns pontos precisam de cuidado. ⚠️';
        description = `Sua saúde financeira pede ajustes, principalmente em ${weakest.name}. Vamos organizar isso.`;
    } else {
        heading = 'Hora de agir. Sua saúde financeira está crítica. 🚨';
        description = `Vários pontos precisam de atenção urgente, começando por ${weakest.name}.`;
    }

    // Mensagens por pilar.
    const surplusMsg = surplusStatus === 'good'
        ? 'Ótimo! Você fechou o mês no positivo. Esse valor pode reforçar sua reserva.'
        : surplusStatus === 'warn'
            ? 'Sua sobra está apertada. Tente economizar um pouco mais neste mês.'
            : 'Cuidado. Você gastou mais do que ganhou neste mês.';
    const reserveMsg = reserveStatus === 'good'
        ? `Excelente! Sua reserva está no alvo (${fmtMonths(reserveMonths)} meses guardados) — tranquilidade garantida.`
        : reserveStatus === 'warn'
            ? `Quase lá. Sua reserva cobre ${fmtMonths(reserveMonths)} meses. ${reserveTargetLabel.replace('Meta: ', 'O ideal é ')}.`
            : `Atenção. Sua reserva cobre só ${fmtMonths(reserveMonths)} meses. Priorize construí-la (${reserveTargetLabel.replace('Meta: ', '')}).`;
    const superfluousMsg = superfluousStatus === 'good'
        ? `Ótimo! Seus supérfluos (${Math.round(superfluousPct)}% da renda) estão dentro do limite de ${capDisplay}.`
        : superfluousStatus === 'warn'
            ? `Atenção. Você gastou R$ ${fmtMoney(superfluous)} (${Math.round(superfluousPct)}%) em supérfluos — quase no limite de ${capDisplay}. Vale revisar.`
            : `Cuidado. R$ ${fmtMoney(superfluous)} (${Math.round(superfluousPct)}%) em supérfluos, acima do limite de ${capDisplay}. Hora de cortar.`;

    const improvements = [surplusStatus, reserveStatus, superfluousStatus].filter(s => s !== 'good').length;

    return {
        score: totalScore,
        state, statusLabel, color, accent, badge, heading, description, improvements,
        income, incomeSource,
        pillars: {
            surplus: {
                value: surplus, score: Math.round(surplusScore), max: 30, status: surplusStatus,
                message: surplusMsg, targetLabel: surplusTargetLabel,
            },
            reserve: {
                months: reserveMonths, pct: reservePct,
                score: Math.round(reserveScore), max: 40, status: reserveStatus,
                message: reserveMsg, targetLabel: reserveTargetLabel,
            },
            superfluous: {
                pct: superfluousPct, amount: superfluous, score: Math.round(superfluousScore), max: 30, status: superfluousStatus,
                message: superfluousMsg, targetLabel: superfluousTargetLabel,
                breakdown: {
                    essential: pct(essential),
                    comfort: pct(comfort),
                    superfluous: superfluousPct,
                },
            },
        },
        config: hc,
        // Compat com o card antigo da sidebar (cor + improvements já existem acima).
        feedback: description,
        updatedAt: today,
    };
};

/**
 * Saúde Patrimonial — score específico do módulo Construção de Patrimônio.
 * Diferente do score de Gastos (que mede o fôlego mensal), aqui medimos a
 * solidez do patrimônio em três pilares (total 100 pts):
 *
 *   1. Reserva de Emergência (40 pts) — meses de despesa cobertos (meta: 6 meses).
 *   2. Aportes / Acúmulo      (30 pts) — taxa de poupança do mês (meta: 20% da renda).
 *   3. Metas                  (30 pts) — progresso médio das metas ativas.
 *
 * @param {Array}  transactions   Lançamentos do usuário.
 * @param {Object} manualConfig   Config financeira (income, fixedExpenses...).
 * @param {Object} investmentStats { totalGuarded } — patrimônio líquido em reservas/investimentos.
 * @param {Array}  goals          Metas ({ target, current, status }).
 */
export const calculatePatrimonyHealthScore = (transactions = [], manualConfig = {}, investmentStats = {}, goals = []) => {
    const today = new Date();
    const currentMonth = today.toLocaleDateString('en-CA').slice(0, 7);

    const getRobustMonth = (t) => {
        if (t.month) return t.month;
        if (!t.date) return "";
        try {
            if (typeof t.date === 'string') return t.date.slice(0, 7);
            if (t.date.toDate) return t.date.toDate().toISOString().slice(0, 7);
            if (t.date.seconds) return new Date(t.date.seconds * 1000).toISOString().slice(0, 7);
        } catch { return ""; }
        return "";
    };

    const monthTx = transactions.filter(t => getRobustMonth(t) === currentMonth);

    const income = manualConfig?.income ? parseFloat(manualConfig.income) : 0;
    const monthlyExpenses = manualConfig?.fixedExpenses
        ? parseFloat(manualConfig.fixedExpenses)
        : (income > 0 ? income * 0.7 : 0); // fallback: estima 70% da renda

    const reserveTotal = parseFloat(investmentStats?.totalGuarded) || 0;

    // 1. Reserva de Emergência (40 pts) — meta: 6 meses de despesas cobertos
    let reserveScore = 0;
    let monthsCovered = 0;
    if (monthlyExpenses > 0) {
        monthsCovered = reserveTotal / monthlyExpenses;
        reserveScore = Math.min(40, (monthsCovered / 6) * 40);
    }

    // 2. Aportes / Acúmulo (30 pts) — meta: poupar/investir 20% da renda no mês
    const investedThisMonth = monthTx
        .filter(t => t.type === 'expense' && SAVINGS_CATEGORIES.includes(t.category))
        .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    let savingsRate = 0;
    let savingsScore = 0;
    if (income > 0) {
        savingsRate = investedThisMonth / income;
        savingsScore = Math.min(30, (savingsRate / 0.20) * 30);
    }

    // 3. Metas (30 pts) — progresso médio das metas ativas
    const activeGoals = goals.filter(g => g && g.status !== 'completed' && (parseFloat(g.target) || 0) > 0);
    let goalsScore = 0;
    let avgGoalProgress = 0;
    if (activeGoals.length > 0) {
        const sumProgress = activeGoals.reduce((acc, g) => {
            const target = parseFloat(g.target) || 0;
            const current = parseFloat(g.current) || 0;
            return acc + (target > 0 ? Math.min(1, current / target) : 0);
        }, 0);
        avgGoalProgress = sumProgress / activeGoals.length;
        goalsScore = avgGoalProgress * 30;
    }

    const totalScore = Math.min(100, Math.round(reserveScore + savingsScore + goalsScore));

    // Feedback qualitativo (mesma escala de cores do score de Gastos)
    let feedback = "Cadastre suas reservas e metas para ver sua saúde patrimonial.";
    let color = "text-slate-400";
    let bg = "bg-slate-400/10";
    let statusLabel = "Sem dados";

    if (totalScore >= 90) {
        feedback = "Patrimônio sólido! Sua independência financeira está bem encaminhada.";
        color = "text-emerald-400";
        bg = "bg-emerald-500/10";
        statusLabel = "Excelente";
    } else if (totalScore >= 70) {
        feedback = "Bom! Seu patrimônio está crescendo de forma saudável.";
        color = "text-blue-400";
        bg = "bg-blue-500/10";
        statusLabel = "Bom";
    } else if (totalScore >= 50) {
        feedback = "Razoável. Reforce sua reserva e mantenha os aportes constantes.";
        color = "text-yellow-400";
        bg = "bg-yellow-500/10";
        statusLabel = "Razoável";
    } else if (totalScore > 0) {
        feedback = "Atenção! Priorize construir sua reserva de emergência.";
        color = "text-rose-400";
        bg = "bg-rose-500/10";
        statusLabel = "Atenção";
    }

    // Pilares abaixo de 90% do máximo = áreas a melhorar.
    const improvements = [
        reserveScore < 40 * 0.9,
        savingsScore < 30 * 0.9,
        goalsScore < 30 * 0.9,
    ].filter(Boolean).length;

    return {
        score: totalScore,
        feedback,
        color,
        bg,
        statusLabel,
        improvements,
        breakdown: {
            reserve: Math.round(reserveScore),
            savings: Math.round(savingsScore),
            goals: Math.round(goalsScore),
            data: {
                reserveTotal,
                monthlyExpenses,
                monthsCovered: monthlyExpenses > 0 ? monthsCovered.toFixed(1) : "0.0",
                investedThisMonth,
                savingsRate: income > 0 ? (savingsRate * 100).toFixed(0) : "0",
                activeGoals: activeGoals.length,
                avgGoalProgress: (avgGoalProgress * 100).toFixed(0),
            }
        }
    };
};
