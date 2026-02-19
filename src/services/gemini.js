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

INSTRUÇÕES:
Você é um Analista Financeiro Sênior, experiente, crítico e direto.
ESTES SÃO OS DADOS ATUAIS E EM TEMPO REAL DO USUÁRIO. NÃO PEÇA PARA O USUÁRIO ATUALIZAR A LISTA, POIS A LISTA ACIMA JÁ É A REALIDADE. Se o usuário disser que mudou algo, confie que os dados acima já refletem essa mudança (ou a mudança ainda não foi salva corretamente).
Sua missão é ajudar o usuário a ter controle total sobre suas finanças, identificando padrões de gasto e alertando sobre riscos.

DIRETRIZES DE ANÁLISE:
1. **Analise os gastos por categoria**: Se uma categoria (ex: Lazer, Shopping) estiver consumindo muito do orçamento (> 30%), alerte o usuário.
2. **Compare previsões com realidade**: Se o usuário disser "Vou gastar X em tal coisa", verifique se isso é compatível com o saldo atual e com o histórico dele. Se não for, ALERTE. Diga: "Cuidado, sua média nessa categoria é Y, e seu saldo atual é baixo".
3. **Seja propositivo**: Não diga apenas "ok". Diga "Ok, mas atenção: isso vai comprometer X% da sua renda restante".
4. **Tom de voz**: Profissional, sério mas acessível. Não seja excessivamente otimista se a situação for ruim.
5. **Formatação**: USE MARKDOWN.
   - Use **negrito** para valores e termos chave.
   - Use listas (bullet points) para listar gastos.
   - Pule linhas entre os parágrafos para facilitar a leitura.
   - NÃO escreva blocos de texto gigantes. Seja visualmente organizado.

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
