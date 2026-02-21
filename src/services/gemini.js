import { GoogleGenerativeAI } from "@google/generative-ai";
import { CATEGORIES } from '../constants/categories';
import { calculateFutureProjections } from '../utils/financialLogic';

export const isGeminiConfigured = () => {
    return !!localStorage.getItem('user_gemini_api_key');
};

export const validateApiKey = async (apiKey) => {
    if (!apiKey) return false;
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        // Minimal token count request to validate key without generating content
        await model.countTokens("Test");
        return true;
    } catch (error) {
        console.error("API Key validation failed:", error);
        return false;
    }
};

export const calculateStatsContext = (transactions, manualConfig) => {
    // Basic stats calculation similar to financialLogic but formatted for text prompt
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7);

    // Current Month Data
    const currentTransactions = transactions.filter(t => t.date.startsWith(currentMonth));
    const currentIncome = currentTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const currentExpense = currentTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const currentBalance = currentIncome - currentExpense;

    // Fixed Expenses
    // Either from manual config OR from transactions marked as fixed
    let fixedExpenses = 0;
    if (manualConfig && manualConfig.fixedExpenses) {
        fixedExpenses = parseFloat(manualConfig.fixedExpenses);
    } else {
        // Estimate from recent recurring/fixed transactions (simplified for now)
    }

    // Configured Income
    let monthlyIncome = manualConfig && manualConfig.income ? parseFloat(manualConfig.income) : 'Não informado (use a média histórica)';

    // Recent Transactions (last 50)
    const recentTx = transactions.slice(0, 50).map(t =>
        `- ${t.date}: ${t.description} (${t.type === 'income' ? '+' : '-'} R$ ${t.amount}) [${t.category}]`
    ).join('\n');

    // Future Projections (Next 3 months)
    const futureProjections = calculateFutureProjections(transactions, manualConfig, 3);
    const projectionsText = futureProjections.map(p =>
        `- ${p.date}: Saldo Previsto R$ ${p.balance.toFixed(2)} (Renda: ${p.income} - Comprometido: ${p.committed.toFixed(2)})`
    ).join('\n');

    // Expense Breakdown by Category
    const expensesByCategory = {};
    currentTransactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
            expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
        });



    // ...

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
  - Data de Hoje: ${today.toISOString().split('T')[0]}
  - Entradas: R$ ${currentIncome.toFixed(2)}
  - Saídas: R$ ${currentExpense.toFixed(2)}
  - Saldo do Mês: R$ ${currentBalance.toFixed(2)}

- Gastos por Categoria (Mês Atual):
${categoryStats || "Nenhum gasto registrado ainda."}

- Configuração Manual:
  - Renda Mensal Declarada: R$ ${monthlyIncome}
  - Gastos Fixos Declarados: R$ ${fixedExpenses.toFixed(2)}

- PROJEÇÃO FUTURA (Próximos 3 meses):
  (Considerando Renda Fixa - Gastos Fixos - Parcelas já assumidas)
${projectionsText}

- Últimas 50 Transações (Histórico Recente para Análise e Exclusão):
${recentTx}

INSTRUÇÕES DE IDENTIDADE E METODOLOGIA:
Você é um **Analista Financeiro Sênior** que utiliza os princípios de inteligência financeira (baseados na metodologia de Gustavo Cerbasi).

Sua missão é transformar os dados do usuário em um diagnóstico de "Inteligência Financeira", agindo como um mentor crítico, direto e educativo, sem precisar citar o nome do autor constantemente.

DIRETRIZES METODOLÓGICAS:
1. **Diferenciação Crítica (Necessidades vs. Desejos)**: Para cada gasto que o usuário registrar ou questionar, avalie se é uma necessidade básica ou um "desejo de consumo". Se for desejo e o saldo estiver apertado, questione a prioridade de forma construtiva.
2. **Diagnóstico de Patrimônio**:
   - **PMS (Patrimônio Mínimo de Sobrevivência)**: Ajude o usuário a entender que ele precisa ter guardado o suficiente para cobrir seus gastos fixos por pelo menos 3 a 6 meses.
   - **PNIF (Independência Financeira)**: Se o usuário tiver investimentos, mencione o caminho para que a renda passiva cubra o custo de vida.
3. **Reserva de Emergência**: Este é o pilar número 1. Se o usuário não tem reserva, qualquer plano de investimento ou gasto supérfluo deve ser alertado como risco. Meta: 3 a 6 meses de gastos mensais.
4. **Orçamento Inteligente**: Não apenas liste gastos. Analise se a "estratégia de vida" dele é sustentável. Se ele gasta tudo o que ganha, ele está em desequilíbrio, independente do valor do salário.
5. **Antecipação**: Sugira que ele se prepare para gastos sazonais (IPVA, IPTU, Seguros) antes que eles ocorram.

DIRETRIZES DE RESPOSTA:
1. **Tom de voz**: Profissional, sério e direto. Use termos como "escolhas", "prioridades", "sustentabilidade" e "equilíbrio". Evite frases como "Segundo Cerbasi..." repetidamente; fale como se a metodologia fosse sua própria base de conhecimento.
2. **Formatação**: USE MARKDOWN.
   - Use **negrito** para valores e termos como **PMS**, **Reserva de Emergência**, etc.
   - Use tabelas ou listas para comparar Necessidades vs. Desejos se necessário.
3. **Análise Proativa**: Se o usuário disser "Gastei 100 no bar", não diga apenas "ok". Diga: "Isso foi registrado como **Lazer (Desejo)**. Lembre-se que sua meta de **Reserva de Emergência** ainda está em X% do ideal."

IMPORTANTE:
Se o usuário disser que "gastou", "comprou", "pagou", "recebeu" ou "ganhou" algo e parecer que ele quer registrar uma transação, OU se ele pedir para **remover**, **apagar** ou **deletar** algo:

Responda com um JSON NO FINAL.

Formatos do JSON:

1. PARA ADICIONAR:
\`\`\`json
{
    "action": "add_transaction",
    "data": {
        "description": "Descrição do item",
        "amount": 0.00,
        "type": "expense" (ou "income"),
        "category": "category_id" (use IDs: housing, food, transport, health, education, pets, personal_care, subscriptions, credit_card, church, taxes, leisure, shopping, salary, freelance, investment, gift, other),
        "date": "YYYY-MM-DD" (use a data atual se não especificada)
    }
}
\`\`\`

2. PARA REMOVER:
\`\`\`json
{
    "action": "delete_transaction",
    "data": {
        "description": "Descrição aproximada do item para busca",
        "amount": 0.00 (valor exato ou aproximado para busca),
        "type": "expense" (ou "income" - opcional, ajuda na busca)
    }
}
\`\`\`

Não coloque nada após o bloco JSON.`;
};

export const sendMessageToGemini = async (history, message, context) => {
    // Check for user-provided key only
    const effectiveKey = localStorage.getItem('user_gemini_api_key');

    if (!effectiveKey) {
        throw new Error("API Key não configurada");
    }

    try {
        // Debug Info
        console.log("Iniciando Gemini. Key carregada:", !!effectiveKey, effectiveKey ? `...${effectiveKey.slice(-4)}` : 'N/A');
        const genAI = new GoogleGenerativeAI(effectiveKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Filter out previous system prompts from history to avoid confusion/token usage
        const cleanHistory = history.filter(msg => !msg.text.startsWith("System Prompt:"));

        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: "System Prompt: " + context }],
                },
                {
                    role: "model",
                    parts: [{ text: "Entendido. Estou pronto para atuar como seu assistente financeiro pessoal com base nesses dados atualizados." }],
                },
                ...cleanHistory.map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text }]
                }))
            ],
            generationConfig: {
                maxOutputTokens: 5000,
            },
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Erro ao chamar Gemini:", error);
        throw error;
    }
};
