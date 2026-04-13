
/**
 * Sunday Breath Utility
 * Generates a positive weekly summary of "what went right"
 */

export const generateSundayBreath = (transactions, manualConfig) => {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);

    const weekTxs = transactions.filter(t => new Date(t.date) >= lastWeek);
    
    // Positives to highlight
    const savingsTxs = weekTxs.filter(t => t.category === 'investment' || t.category === 'vault');
    const incomeTxs = weekTxs.filter(t => t.type === 'income');
    const totalSaved = savingsTxs.reduce((acc, t) => acc + parseFloat(t.amount), 0);
    const totalIncome = incomeTxs.reduce((acc, t) => acc + parseFloat(t.amount), 0);

    return {
        hasActivity: weekTxs.length > 0,
        savedCount: savingsTxs.length,
        totalSaved,
        totalIncome,
        message: totalSaved > 0 
            ? `Esta semana você reservou R$ ${totalSaved.toFixed(2)} para o seu futuro. Sinta esse alívio! ✨`
            : lastWeek.length > 0 
                ? "Você manteve sua vida financeira sob controle esta semana. Cada dia é um passo rumo à paz."
                : "Semana tranquila. Que tal começar a próxima fazendo um pequeno investimento?"
    };
};
