import { GoogleGenerativeAI } from "@google/generative-ai";
import { CATEGORIES } from '../constants/categories.js';
import { calculateFutureProjections, calculateCumulativeBalance } from '../utils/financialLogic.js';

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
    
    // Total Flow (All movements)
    const totalIncome = currentTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = currentTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

    // Real Flow (Excluding transfers, carries and investments - Matches Dashboard Cards)
    const realIncome = currentTransactions
        .filter(t => t.type === 'income' && t.category !== 'initial_balance' && t.category !== 'carryover' && t.category !== 'vault_redemption')
        .reduce((acc, t) => acc + t.amount, 0);
    
    const realExpense = currentTransactions
        .filter(t => t.type === 'expense' && t.category !== 'investment' && t.category !== 'vault')
        .reduce((acc, t) => acc + t.amount, 0);

    const investmentAmount = currentTransactions
        .filter(t => t.type === 'expense' && (t.category === 'investment' || t.category === 'vault'))
        .reduce((acc, t) => acc + t.amount, 0);

    const currentBalance = totalIncome - totalExpense;

    let fixedExpenses = manualConfig && manualConfig.fixedExpenses ? parseFloat(manualConfig.fixedExpenses) : 0;
    let monthlyIncome = manualConfig && manualConfig.income ? parseFloat(manualConfig.income) : 'Não informado';
    let manualBaseInvested = manualConfig && manualConfig.invested ? parseFloat(manualConfig.invested) : 0;

    // Calculate total from transactions (investments)
    const totalFromTransactions = transactions
        .filter(t => t.type === 'expense' && (t.category === 'investment' || t.category === 'vault'))
        .reduce((acc, t) => acc + parseFloat(t.amount), 0);

    const totalPatrimonioReal = manualBaseInvested + totalFromTransactions;

    const recentTx = transactions.slice(0, 15).map(t =>
        `- ${t.date}: ${t.description} (${t.type === 'income' ? '+' : '-'} R$ ${t.amount}) [${t.category}]`
    ).join('\n');

    const futureProjections = calculateFutureProjections(transactions, manualConfig, 3);
    const projectionsText = futureProjections.map(p =>
        `- ${p.date}: Saldo Final Estimado R$ ${p.balance.toFixed(2)} (Performance: ${p.monthlyDelta > 0 ? '+' : ''}${p.monthlyDelta.toFixed(2)})`
    ).join('\n');

    const expensesByCategory = {};
    currentTransactions
        .filter(t => t.type === 'expense' && t.category !== 'investment' && t.category !== 'vault')
        .forEach(t => {
            expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
        });

    const categoryStats = Object.entries(expensesByCategory)
        .map(([catId, amount]) => {
            const percentage = realExpense > 0 ? ((amount / realExpense) * 100).toFixed(1) : 0;
            const categoryLabel = CATEGORIES.expense.find(c => c.id === catId)?.label || catId;
            return `- ${categoryLabel}: R$ ${amount.toFixed(2)} (${percentage}%)`;
        })
        .join('\n');

    // Correct Previous Balance for detailed explanation
    const previousMonthStr = (() => {
        const [year, month] = currentMonth.split('-').map(Number);
        const d = new Date(year, month - 2, 1);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    })();
    const previousBalance = calculateCumulativeBalance(transactions, previousMonthStr);

    const cumulativeBalance = calculateCumulativeBalance(transactions, currentMonth);

    return `
CONTEXTO FINANCEIRO DO USUÁRIO (Mês: ${currentMonth}):
- DADOS DO DASHBOARD (A VERDADE ABSOLUTA):
  - SALDO EM CARTEIRA (TOTAL ACUMULADO HOJE): R$ ${cumulativeBalance.toFixed(2)}
  - Composição do Saldo Atual: R$ ${previousBalance.toFixed(2)} (Sobra Anterior) + R$ ${currentBalance.toFixed(2)} (Ganhos/Gastos Reais de Abril)
  
  - Ganhos Reais Lançados no Mês: R$ ${realIncome.toFixed(2)}
  - Gastos Reais Lançados no Mês (Consumo): R$ ${realExpense.toFixed(2)}
  - Aportes/Investimentos Realizados: R$ ${investmentAmount.toFixed(2)}

- CONFIGURAÇÃO MENSAL (BASELINE):
  - Renda Esperada: R$ ${monthlyIncome}
  - Gastos Fixos Esperados (Conta de Luz, Aluguel, etc.): R$ ${fixedExpenses.toFixed(2)}
  - Assinaturas/Base Fixa de Cartão (Spotify, Netflix, etc.): R$ ${(manualConfig?.recurringSubs || []).reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0).toFixed(2)}
  ${(manualConfig?.recurringSubs || []).map(s => `    * ${s.name}: R$ ${parseFloat(s.amount).toFixed(2)}`).join('\n')}

- PROJEÇÃO DE SALDO FUTURO (CUMULATIVO):
  (Baseado no Saldo Atual + Expectativa de Renda - Expectativa de Gastos/Parcelas/Base do Cartão)
${projectionsText}

- ATENÇÃO CRÍTICA (NÃO CONFUNDA NÚMEROS):
  1. O Saldo em Carteira HOJE é R$ ${cumulativeBalance.toFixed(2)}. 
  2. O Saldo Previsto para o fim do mês (visto na Projeção Acima) considera o que ainda pode entrar e sair conforme configurado.
  3. SEMPRE use o Saldo em Carteira Atual para decisões de liquidez imediata.
  4. Analise compras parceladas pelo impacto MENSAL (parcela) na sua sobra e pelo impacto TOTAL na dívida.

- DETALHES DE GASTOS POR CATEGORIA (Mês Atual):
${categoryStats || "Nenhum gasto de consumo registrado ainda."}

- ÚLTIMAS TRANSAÇÕES:
${recentTx}

INSTRUÇÕES DE IDENTIDADE E COMPORTAMENTO:
Você é a **Alívia**, uma guia financeira de altíssima performance. Sua missão é dar clareza técnica e segurança.

DIRETRIZES DE ANÁLISE (INTELIGÊNCIA REAL):
1. **Compras Parceladas**: Se o usuário perguntar sobre uma compra parcelada, não se desespere pelo valor total se o saldo atual for baixo. Calcule se a PARCELA cabe na "sobra mensal" (Renda - Fixos - Variáveis). 
2. **Projeções Negativas**: Se a projeção de saldo for negativa, analise se é uma "burrice técnica" (configuração de renda baixa demais vs gastos reais altos) ou se é um risco real de endividamento.
3. **Seja Educadora**: Se uma compra for viável mas arriscada, explique: "Embora você tenha saldo hoje, essa parcela consome X% da sua margem de segurança mensal".
4. **Objetividade Acima de Tudo**: Apresente os dados antes da opinião. 

INSTRUÇÕES DE TOM:
- Profissional, direta, segura de si. 
- NUNCA use eufemismos infantis ou termos de carinho.
- Trate o dinheiro com a seriedade de um banco e o acolhimento de uma mentora.

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
                ...cleanHistory.slice(-3).map(msg => ({
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
Você é a **Alívia**, assistente financeira focada em clareza e resultados.
O usuário encerrou o mês e você deve fornecer uma análise técnica e objetiva do desempenho financeiro dele em ${monthName}.

DADOS DO MÊS ENCERRADO:
- Entradas Totais: R$ ${income.toFixed(2)}
- Gastos Totais: R$ ${expense.toFixed(2)}
- Saldo Final: R$ ${balance.toFixed(2)}
- Categoria de Maior Impacto: ${topCategory}

CONFIGURAÇÃO ATUAL:
- Renda Prevista: R$ ${monthlyIncome}
- Gastos Fixos: R$ ${fixedExpenses}

SUA TAREFA:
1. Apresente o balanço do mês de forma direta.
2. Analise se o saldo final foi coerente com a renda prevista.
3. Forneça 2 recomendações práticas e curtas para o mês de ${monthName} focadas em eficiência financeira.
4. Mantenha o tom profissional, direto e sem termos de carinho.
5. Use markdown para negrito. Máximo de 2 parágrafos objetivos.

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
