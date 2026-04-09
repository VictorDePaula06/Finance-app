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
        `- ${p.date}: Saldo Previsto R$ ${p.balance.toFixed(2)} (Renda: ${p.income} - Comprometido: ${p.committed.toFixed(2)})`
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

    const getRobustMonth = (t) => {
        if (t.month) return t.month;
        if (!t.date) return "";
        return t.date.slice(0, 7); // Simplest, most consistent with Dashboard
    };

    const calculateCumulativeBalance = (targetMonth) => {
        const allPrev = [...transactions]
            .filter(t => getRobustMonth(t) <= targetMonth)
            .sort((a, b) => {
                const dateDiff = new Date(a.date) - new Date(b.date);
                if (dateDiff !== 0) return dateDiff;
                // Tie-breaker: Resets ('initial_balance' or 'carryover') MUST come first on the same day
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

    // Correct Previous Balance for detailed explanation
    const previousMonthStr = (() => {
        const [year, month] = currentMonth.split('-').map(Number);
        const d = new Date(year, month - 2, 1);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    })();
    const previousBalance = calculateCumulativeBalance(previousMonthStr);

    const cumulativeBalance = calculateCumulativeBalance(currentMonth);

    return `
CONTEXTO FINANCEIRO DO USUÁRIO (Mês: ${currentMonth}):
- DADOS DO DASHBOARD (A VERDADE ABSOLUTA):
  - SALDO EM CARTEIRA (TOTAL ACUMULADO): R$ ${cumulativeBalance.toFixed(2)}
  - Composição do Saldo: R$ ${previousBalance.toFixed(2)} (Sobra Anterior) + R$ ${currentBalance.toFixed(2)} (Ganhos/Gastos de Abril)
  
  - Ganhos Reais do Mês: R$ ${realIncome.toFixed(2)}
  - Gastos Reais do Mês: R$ ${realExpense.toFixed(2)}
  - Aportes/Investimentos (Cofre/Sementinha): R$ ${investmentAmount.toFixed(2)}

- ATENÇÃO CRÍTICA (NÃO CONFUNDA NÚMEROS):
  - O Saldo em Carteira é R$ ${cumulativeBalance.toFixed(2)}. 
  - O Total Gasto em Transporte é R$ ${expensesByCategory['transport']?.toFixed(2) || '0.00'}.
  - NUNCA diga que o Saldo em Carteira é um gasto de categoria, mesmo que os números sejam parecidos.
  - Se o usuário perguntar o saldo, use APENAS o valor: R$ ${cumulativeBalance.toFixed(2)}.

- SITUAÇÃO DE PATRIMÔNIO (FORA DA CARTEIRA):
  - Patrimônio Investido Total: R$ ${totalPatrimonioReal.toFixed(2)}
  - Aportes via chat (incluídos no total): R$ ${totalFromTransactions.toFixed(2)}

- CONFIGURAÇÃO MENSAL:
  - Renda Configurada: R$ ${monthlyIncome}
  - Gastos Fixos Configurados: R$ ${fixedExpenses.toFixed(2)}

- DETALHES DE GASTOS (Consumo):
${categoryStats || "Nenhum gasto de consumo registrado ainda."}

- PROJEÇÃO FUTURA (Próximos 3 meses):
${projectionsText}

- ÚLTIMAS TRANSAÇÕES:
${recentTx}

INSTRUÇÕES DE IDENTIDADE:
Você é a **Alívia**, uma guia financeira pessoal focada em **Inteligência Financeira e Objetividade**. Sua missão é transformar a ansiedade financeira em clareza técnica e controle. Você é profissional, direta e eficiente, mas mantém um tom amigável e encorajador.

DIRETRIZES DE VOZ E TOM:
1. **Objetiva e Direta**: Vá direto ao ponto. Use dados para embasar suas respostas. Evite introduções longas ou rodeios.
2. **Profissional**: NÃO use termos de carinho como "meu anjo", "meu amor", "querido(a)", "linda", ou qualquer variação maternal/romântica. Trate o usuário pelo nome ou de forma profissional.
3. **Descomplicada**: Use termos claros, mas mantenha a precisão técnica necessária para a educação financeira.
4. **Focada em Soluções**: Toda análise deve vir acompanhada de um próximo passo claro e prático.

DICIONÁRIO DE CONDUTA:
- Em vez de "Sementinha", use "Investimento" ou "Reserva para o Futuro".
- Em vez de "Abraço financeiro", use "Análise completa" ou "Plano de ação".
- NÃO use eufemismos que diminuam a importância da seriedade financeira.

DIRETRIZES CRÍTICAS:
1. **Priorize Dados**: Sempre que houver uma dúvida sobre valores, apresente os números primeiro.
2. **Execute Ações**: Se o usuário descrever um gasto ou ganho, processe-o imediatamente via JSON e confirme de forma curta.
3. **NÃO lance investimentos**: Comente o impacto, mas NÃO use a action "add_transaction" para investimentos (o usuário prefere manual). Use para gastos/rendas comuns se solicitado.
4. **Visão Real**: Use sempre o "PATRIMÔNIO TOTAL REAL" do dashboard para análises.
5. **Comunicação Enxuta**: Se a resposta puder ser dada em um parágrafo, não use três.

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
