import { GoogleGenerativeAI } from "@google/generative-ai";
import { CATEGORIES } from '../constants/categories.js';
import { calculateFutureProjections } from '../utils/financialLogic.js';

export const isGeminiConfigured = () => {
    return !!localStorage.getItem('user_gemini_api_key');
};

export const validateApiKey = async (apiKey) => {
    if (!apiKey) return false;
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        await model.countTokens("Test");
        return true;
    } catch (error) {
        console.error("API Key validation failed:", error);
        return false;
    }
};

export const calculateStatsContext = (transactions, manualConfig) => {
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7);

    const currentTransactions = transactions.filter(t => t.date.startsWith(currentMonth));
    const currentIncome = currentTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const currentExpense = currentTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const currentBalance = currentIncome - currentExpense;

    let fixedExpenses = manualConfig && manualConfig.fixedExpenses ? parseFloat(manualConfig.fixedExpenses) : 0;
    let monthlyIncome = manualConfig && manualConfig.income ? parseFloat(manualConfig.income) : 'Não informado';
    let manualBaseInvested = manualConfig && manualConfig.invested ? parseFloat(manualConfig.invested) : 0;

    // Calculate total from transactions (investments)
    const totalFromTransactions = transactions
        .filter(t => t.type === 'expense' && t.category === 'investment')
        .reduce((acc, t) => acc + parseFloat(t.amount), 0);

    const totalPatrimonioReal = manualBaseInvested + totalFromTransactions;

    const recentTx = transactions.slice(0, 50).map(t =>
        `- ${t.date}: ${t.description} (${t.type === 'income' ? '+' : '-'} R$ ${t.amount}) [${t.category}]`
    ).join('\n');

    const futureProjections = calculateFutureProjections(transactions, manualConfig, 3);
    const projectionsText = futureProjections.map(p =>
        `- ${p.date}: Saldo Previsto R$ ${p.balance.toFixed(2)} (Renda: ${p.income} - Comprometido: ${p.committed.toFixed(2)})`
    ).join('\n');

    const expensesByCategory = {};
    currentTransactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
            expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
        });

    const categoryStats = Object.entries(expensesByCategory)
        .map(([catId, amount]) => {
            const percentage = currentExpense > 0 ? ((amount / currentExpense) * 100).toFixed(1) : 0;
            const categoryLabel = CATEGORIES.expense.find(c => c.id === catId)?.label || catId;
            return `- ${categoryLabel}: R$ ${amount.toFixed(2)} (${percentage}%)`;
        })
        .join('\n');

    return `
CONTEXTO FINANCEIRO DO USUÁRIO:
- Mês Atual (${currentMonth}):
  - Data: ${today.toLocaleDateString('pt-BR')}
  - Entradas: R$ ${currentIncome.toFixed(2)}
  - Saídas: R$ ${currentExpense.toFixed(2)}
  - Saldo: R$ ${currentBalance.toFixed(2)}

- SITUAÇÃO DE PATRIMÔNIO (DASHBOARD):
  - Patrimônio Investido (Manual): R$ ${manualBaseInvested.toFixed(2)}
  - Aportes registrados via chat/transações: R$ ${totalFromTransactions.toFixed(2)}
  - VALOR EXIBIDO NO CARD: R$ ${totalPatrimonioReal.toFixed(2)}

- Configuração das Metas/Mensais:
  - Renda Mensal: R$ ${monthlyIncome}
  - Gastos Fixos: R$ ${fixedExpenses.toFixed(2)}

- Gastos por Categoria:
${categoryStats || "Nenhum gasto registrado ainda."}

- PROJEÇÃO FUTURA (Próximos 3 meses):
${projectionsText}

- Últimas Transações (Histórico):
${recentTx}

INSTRUÇÕES DE IDENTIDADE:
Você é o **Mêntore**, analista de finanças de elite. Baseie-se na metodologia de Gustavo Cerbasi. Use conceitos como **PMS** (Patrimônio Mínimo de Sobrevivência) e **PNIF** (Patrimônio para Independência Financeira).

DIRETRIZES CRÍTICAS:
1. **Ver visão real**: O usuário vê o "PATRIMÔNIO TOTAL REAL" no dashboard. SEMPRE use esse valor para análise, conselhos e cálculos de independência.
2. **Sincronização com a UI**: Se o usuário mudar o "Patrimônio Base" na UI, esse valor mudará aqui. Ignore históricos de chat se o valor base informado no prompt for diferente.
3. **NÃO lance investimentos**: Se o usuário disser "investi X", comente sobre isso (analise o impacto), mas NÃO use a action "add_transaction". O usuário prefere lançar investimentos manualmente. Só use "add_transaction" para rendas ou gastos comuns (comida, lazer, aluguel) se solicitado.
4. **Tom de Voz**: Profissional, direto e motivador.

REGRAS DE COMANDO (JSON):
Se precisar realizar uma ação no sistema, use UM ÚNICO bloco JSON no final da resposta.

1. **Lançar Gasto/Renda (NÃO INVESTIMENTO)**: Para despesas ou ganhos do dia a dia:
\`\`\`json
{ 
  "action": "add_transaction", 
  "data": { 
    "description": "Descrição curta", 
    "amount": "123.45", 
    "type": "expense|income", 
    "category": "..." 
  } 
}
\`\`\`

2. **Ajustar Configurações (Patrimônio/Renda/Gastos)**: Se o usuário pedir para corrigir valores configurados (Ex: "meu saldo inicial é X", "minha renda é X", "meus gastos fixos são X"):
\`\`\`json
{ 
  "action": "update_manual_config", 
  "data": { 
    "invested": "VALOR_ABSOLUTO (opcional)",
    "income": "VALOR_ABSOLUTO (opcional)",
    "fixedExpenses": "VALOR_ABSOLUTO (opcional)"
  } 
}
\`\`\`

REGRAS TÉCNICAS:
- **Formato do Valor**: Use somente números decimais (Ex: "4500.00"). NUNCA use pontos de milhar (Ex: NUNCA use "4.500,00").
- **Isolamento**: O bloco JSON deve estar OBRIGATORIAMENTE entre crases ( \`\`\`json ... \`\`\` ) e ser a ÚLTIMA coisa na mensagem.
`;
};

export const sendMessageToGemini = async (history, message, context) => {
    const apiKey = localStorage.getItem('user_gemini_api_key');
    if (!apiKey) throw new Error("API Key não configurada");

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const cleanHistory = history.filter(msg => !msg.text.includes('{"action":'));

        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: "System Prompt: " + context }] },
                { role: "model", parts: [{ text: "Entendido. Serei seu Mêntore financeiro." }] },
                ...cleanHistory.slice(-10).map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text }]
                }))
            ]
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini Error:", error);
        throw error;
    }
};
