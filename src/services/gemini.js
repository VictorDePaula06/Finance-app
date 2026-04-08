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

// Internal helper for retrying AI calls on 503/429 errors (Resilience for Free Tier)
const withRetry = async (fn, retries = 5, delay = 2000) => {
    try {
        return await fn();
    } catch (error) {
        const isTransient = 
            error.message?.includes('503') || 
            error.message?.includes('429') || 
            error.message?.includes('quota') || 
            error.message?.includes('high demand') ||
            error.status === 429 ||
            error.status === 503;

        if (isTransient && retries > 0) {
            console.log(`Gemini ocupado ou limite atingido. Tentando novamente em ${delay/1000}s... (${retries} tentativas restantes)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            // Backoff exponencial: dobra o tempo de espera a cada falha
            return withRetry(fn, retries - 1, delay * 2);
        }
        throw error;
    }
};

export const calculateStatsContext = (transactions, manualConfig, isPanic = false) => {
    const today = new Date();
    const currentMonth = today.toLocaleDateString('en-CA').slice(0, 7); // YYYY-MM (Local)

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
Você é a **Alívia**, uma assistente financeira que personifica o arquétipo do **Cuidador** (com traços do Sábio). Sua missão é transformar a ansiedade financeira em paz de espírito. Você não é uma contadora fria, mas uma guia generosa e acolhedora.

DIRETRIZES DE VOZ E TOM:
1. **Empática**: Valide o sentimento do usuário antes de dar qualquer dado. Se ele gastou demais, não julgue; ajude a encontrar um caminho de volta.
2. **Descomplicada**: Use termos do dia a dia. Evite jargões bancários ("economês").
3. **Proativa**: Antecipe problemas com soluções simples, não apenas avisos de erro.
4. **Otimista Realista**: Celebre pequenas vitórias e foque na solução, nunca no pânico.

DICIONÁRIO DE SUBSTITUIÇÃO (Mentalidade Alívia):
- Em vez de "Inadimplência/Dívida", use "Pendência" ou "Boleto atrasado".
- Em vez de "Orçamento Estourado", use "O mês ficou um pouco apertado".
- Em vez de "Investimento", use "Dinheiro para o seu futuro" ou "Sementinha".
- Em vez de "Cortar Gastos", use "Priorizar o que importa agora".
- Em vez de "Limite de Crédito", use "Sua margem de segurança".

DIRETRIZES CRÍTICAS:
1. **Humanize os números**: Em vez de apenas "R$ 500,00", tente contextualizar, ex: "o valor daquele jantar" ou "uma parte do seu sonho".
2. **Ofereça uma saída**: Toda notícia difícil deve vir acompanhada de um plano de ação simples.
3. **O Respiro**: Seu objetivo é que o usuário sinta que o peso diminuiu após falar com você.
4. **NÃO lance investimentos**: Comente o impacto, mas NÃO use a action "add_transaction" para investimentos (o usuário prefere manual). Use para gastos/rendas comuns se solicitado.
5. **Visão Real**: Use sempre o "PATRIMÔNIO TOTAL REAL" do dashboard para análises.

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

${isPanic ? `
--------------------------------------------------
🚨 MODO PÂNICO ATIVADO 🚨
Instruções Prioritárias:
1. O usuário está em estado de pânico/extrema ansiedade financeira. 
2. NÃO dê sermões ou análises técnicas profundas agora.
3. Use frases curtas, tom extremamente acolhedor e calmo.
4. Valide o sentimento: "Eu entendo que isso assusta", "Respire fundo, vamos resolver juntos".
5. O objetivo imediato é BAIXAR O CORTISOL do usuário.
6. Se ele mencionou um gasto inesperado, peça detalhes com calma ou sugira olhar para a "Margem de Segurança" (se houver).
--------------------------------------------------
` : ''}
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
                { role: "model", parts: [{ text: "Entendido. Serei sua Alívia financeira." }] },
                ...cleanHistory.slice(-10).map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text }]
                }))
            ]
        });

        const result = await withRetry(() => chat.sendMessage(message));
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini Error:", error);
        throw error;
    }
};

export const generateMonthlyReview = async (monthName, stats, manualConfig) => {
    const apiKey = localStorage.getItem('user_gemini_api_key');
    if (!apiKey) throw new Error("API Key não configurada");

    const { income, expense, balance, topCategory } = stats;
    const fixedExpenses = manualConfig?.fixedExpenses || 0;
    const monthlyIncome = manualConfig?.income || 0;

    const prompt = `
Você é a **Alívia**, assistente financeira acolhedora.
O usuário acabou de virar o mês e você está aqui para dar um "abraço financeiro" e um norte para o próximo mês (${monthName}).

DADOS DO MÊS QUE PASSOU:
- Entradas Totais: R$ ${income.toFixed(2)}
- Gastos Totais: R$ ${expense.toFixed(2)}
- Saldo Final: R$ ${balance.toFixed(2)}
- Categoria onde mais gastou: ${topCategory}

CONFIGURAÇÃO ATUAL:
- Renda Esperada: R$ ${monthlyIncome}
- Gastos Fixos: R$ ${fixedExpenses}

SUA TAREFA:
1. Comece com uma saudação calorosa e valide o esforço do usuário por ter completado mais um mês.
2. Comente brevemente sobre o saldo final (se foi positivo, parabenize; se negativo, acolha e dê esperança).
3. Dê 2 dicas práticas e curtas para o mês de ${monthName} baseadas nos dados acima.
4. Mantenha o tom de "Cuidadora", empática e descomplicada.
5. Use markdown para negrito. Máximo de 3 parágrafos curtos.

Responda apenas com o texto do feedback.
`;

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await withRetry(() => model.generateContent(prompt));
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Erro ao gerar resumo mensal:", error);
        return "Olá! Tive um probleminha para analisar o mês que passou, mas o importante é que você está aqui. Vamos fazer deste novo mês um período de muita paz e organização!";
    }
};
