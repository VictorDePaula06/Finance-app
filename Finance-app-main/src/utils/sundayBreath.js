
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
            ? `Esta semana você aportou R$ ${totalSaved.toFixed(2)} em seus investimentos. Excelente progresso na construção do seu patrimônio.`
            : weekTxs.length > 0 
                ? "Sua gestão financeira permaneceu sob controle esta semana, mantendo a estabilidade planejada."
                : "Nenhuma movimentação de reserva detectada na última semana. Considere realizar um aporte no próximo período."
    };
};
