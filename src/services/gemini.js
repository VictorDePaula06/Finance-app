import { GoogleGenerativeAI } from "@google/generative-ai";
import { CATEGORIES } from '../constants/categories.js';
import { OBJECTIVE_LABELS, RISK_LABELS } from '../constants/onboarding.js';
import { calculateFutureProjections, calculateCumulativeBalance } from '../utils/financialLogic.js';
import { calculateHealthIndex } from '../utils/healthScore.js';

// ── Chave Gemini (BYOK) — F-08 ────────────────────────────────────────────────
// A chave do usuário NÃO é mais persistida em localStorage (texto plano em
// repouso, exposto a XSS / acesso ao dispositivo). Fica só em memória durante a
// sessão; a fonte de verdade persistida é o Firestore (userPrefs.apiKey,
// legível apenas pelo dono). É carregada para a memória ao logar (AuthContext).
let sessionApiKey = null;

// Migração única: se houver chave legada no localStorage (versões antigas),
// move para a memória e REMOVE do localStorage para limpar a exposição.
try {
    const legacy = typeof localStorage !== 'undefined' && localStorage.getItem('user_gemini_api_key');
    if (legacy) {
        sessionApiKey = legacy;
        localStorage.removeItem('user_gemini_api_key');
    }
} catch { /* ambiente sem localStorage */ }

export const setGeminiKey = (key) => { sessionApiKey = (key || '').trim() || null; };
export const getGeminiKey = () => sessionApiKey;
export const clearGeminiKey = () => { sessionApiKey = null; };

export const isGeminiConfigured = () => !!sessionApiKey;

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

export const calculateStatsContext = (transactions, manualConfig, isPanic = false, jars = [], investments = [], onboarding = {}, extra = {}) => {
    // extra = { cards, fixedExpenses, goals, subscriptions, planLevel }
    const cards = extra.cards || [];
    const fixedExpensesList = extra.fixedExpenses || [];
    const goals = extra.goals || [];
    const subscriptions = extra.subscriptions || [];
    const planLevel = extra.planLevel || 'free';

    const today = new Date();
    const currentMonth = today.toLocaleDateString('en-CA').slice(0, 7); // YYYY-MM (Local)

    const currentTransactions = transactions.filter(t => t.date && t.date.startsWith && t.date.startsWith(currentMonth));
    
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

    const recentTx = transactions.slice(0, 30).map(t =>
        `- ${t.date}: ${t.description} (${t.type === 'income' ? '+' : '-'} R$ ${t.amount}) [ID: ${t.category}]`
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

    const jarsTotal = jars.reduce((a, j) => a + (parseFloat(j.balance) || 0), 0);
    const investmentsTotal = investments.reduce((acc, a) => {
        const price = parseFloat(a.manualCurrentPrice || a.purchasePrice) || 0;
        const qty = parseFloat(a.quantity) || 0;
        const usdMultiplier = a.isUSD ? 5.0 : 1; // Approx for AI context
        return acc + (qty * price * usdMultiplier);
    }, 0);
    const patrimonioTotal = jarsTotal + investmentsTotal;

    const jarsText = jars.length > 0 ? jars.map(j => `  - ${j.name || 'Reserva'}: R$ ${(j.balance || 0).toFixed(2)}`).join('\n') : '  - Nenhuma reserva cadastrada.';
    const invText = investments.length > 0 ? investments.map(i => `  - ${i.name || i.type} (${i.symbol || '-'}): ${i.quantity} ativos`).join('\n') : '  - Nenhum investimento cadastrado.';

    const expenseCategories = CATEGORIES.expense.map(c => `${c.id} (${c.label})`).join(', ');
    const incomeCategories = CATEGORIES.income.map(c => `${c.id} (${c.label})`).join(', ');

    // ── HEALTH SCORE (mesmo cálculo do painel) ──
    let healthScoreText = 'Não calculado.';
    try {
        // Mesmo cálculo do índice exibido na tela (não o score legado).
        const hi = calculateHealthIndex(transactions, manualConfig, jarsTotal);
        const p = hi.pillars || {};
        const months = p.reserve?.months ? p.reserve.months.toFixed(1) : '0.0';
        healthScoreText = `Nota ${hi.score}/100 (${hi.statusLabel}) — "${hi.description}". Pilares: Sobra do mês ${p.surplus?.score ?? 0}/${p.surplus?.max ?? 30}, Reserva ${p.reserve?.score ?? 0}/${p.reserve?.max ?? 40} (${months} meses de cobertura), Supérfluos ${p.superfluous?.score ?? 0}/${p.superfluous?.max ?? 30}.`;
    } catch { /* mantém fallback */ }

    // ── CARTÕES E FATURAS ──
    const cardsText = cards.length > 0
        ? cards.map(c => {
            const unpaid = transactions
                .filter(t => t.selectedCardId === c.id && t.invoiceStatus === 'unpaid')
                .reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
            const cardSubs = subscriptions
                .filter(s => s.cardId === c.id)
                .reduce((acc, s) => acc + (parseFloat(s.value) || 0), 0);
            const fatura = unpaid + cardSubs;
            return `  - ${c.name || c.brand} (final ${c.last4 || '----'}): fatura aberta ≈ R$ ${fatura.toFixed(2)} • vence dia ${c.dueDay || '?'}`;
        }).join('\n')
        : '  - Nenhum cartão cadastrado.';

    // ── CONTAS FIXAS ──
    const fixedText = fixedExpensesList.length > 0
        ? fixedExpensesList.map(f => {
            const pago = f.lastPaidMonth === currentMonth;
            const tipo = f.isVariable ? 'variável' : 'fixo';
            return `  - ${f.name}: R$ ${(parseFloat(f.value) || 0).toFixed(2)} (${tipo}) • vence dia ${f.day || '?'} • ${pago ? 'PAGA este mês' : 'pendente'}`;
        }).join('\n')
        : '  - Nenhuma conta fixa cadastrada.';

    // ── PARCELAMENTOS ATIVOS ──
    const installments = subscriptions.filter(s => s.type === 'installment');
    const installmentsText = installments.length > 0
        ? installments.map(s => {
            const paid = Math.max(0, (s.currentInstallment || 1) - 1);
            const total = s.totalInstallments || 1;
            const remaining = total - paid;
            return `  - ${s.name}: ${paid}/${total} parcelas pagas • faltam ${remaining} (R$ ${(remaining * (parseFloat(s.value) || 0)).toFixed(2)})`;
        }).join('\n')
        : '  - Nenhum parcelamento ativo.';

    // ── METAS ──
    const activeGoals = goals.filter(g => g.status === 'active');
    const goalsText = activeGoals.length > 0
        ? activeGoals.map(g => {
            const current = parseFloat(g.current) || 0;
            const target = parseFloat(g.target) || 0;
            const pct = target > 0 ? ((current / target) * 100).toFixed(0) : 0;
            return `  - ${g.title}: R$ ${current.toFixed(2)} de R$ ${target.toFixed(2)} (${pct}%)${g.deadline ? ` • prazo ${g.deadline}` : ''}`;
        }).join('\n')
        : '  - Nenhuma meta ativa.';

    return `
CONTEXTO FINANCEIRO DO USUÁRIO (Mês: ${currentMonth}):
- DADOS DO DASHBOARD (A VERDADE ABSOLUTA):
  - SALDO EM CARTEIRA (TOTAL ACUMULADO HOJE): R$ ${cumulativeBalance.toFixed(2)}
  - CATEGORIAS DE DESPESA DISPONÍVEIS: ${expenseCategories}
  - CATEGORIAS DE RECEITA DISPONÍVEIS: ${incomeCategories}
  - Composição do Saldo Atual: R$ ${previousBalance.toFixed(2)} (Sobra Anterior) + R$ ${currentBalance.toFixed(2)} (Ganhos/Gastos Reais de ${today.toLocaleDateString('pt-BR', { month: 'long' })})
  
  - Ganhos Reais Lançados no Mês: R$ ${realIncome.toFixed(2)}
  - Gastos Reais Lançados no Mês (Consumo): R$ ${realExpense.toFixed(2)}
  - Aportes/Investimentos Realizados: R$ ${investmentAmount.toFixed(2)}

- CONFIGURAÇÃO MENSAL (BASELINE):
  - Renda Esperada: R$ ${monthlyIncome}
  - Gastos Fixos Esperados (Conta de Luz, Aluguel, etc.): R$ ${fixedExpenses.toFixed(2)}
  - Assinaturas/Base Fixa de Cartão (Spotify, Netflix, etc.): R$ ${(manualConfig?.recurringSubs || []).reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0).toFixed(2)}
  ${(manualConfig?.recurringSubs || []).map(s => {
    let str = `    * ${s.name}: R$ ${parseFloat(s.amount).toFixed(2)}`;
    if (s.totalInstallments > 0) {
      str += ` (Parcela ${s.currentInstallment} de ${s.totalInstallments})`;
    }
    return str;
  }).join('\n')}

- PROJEÇÃO DE SALDO FUTURO (CUMULATIVO):
  (Baseado no Saldo Atual + Expectativa de Renda - Expectativa de Gastos/Parcelas/Base do Cartão)
${projectionsText}

- SAÚDE FINANCEIRA (HEALTH SCORE):
  ${healthScoreText}

- CARTÕES E FATURAS:
${cardsText}

- CONTAS FIXAS:
${fixedText}

- PARCELAMENTOS ATIVOS:
${installmentsText}

- METAS FINANCEIRAS:
${goalsText}

- CONSTRUÇÃO DE PATRIMÔNIO E RESERVAS:
  - Patrimônio Total Consolidado: R$ ${patrimonioTotal.toFixed(2)}
  - Total em Reservas: R$ ${jarsTotal.toFixed(2)}
${jarsText}
  - Total em Investimentos: R$ ${investmentsTotal.toFixed(2)} (Valor aproximado)
${invText}

- PLANO ATUAL DO USUÁRIO: ${planLevel === 'premium' ? 'Premium (acesso total)' : planLevel === 'standard' ? 'Standard (só Controle de Gastos)' : planLevel === 'lifetime' ? 'Vitalício (acesso total)' : 'Gratuito (com limites)'}

- CONFIGURAÇÃO PERSONALIZADA DA ALÍVIA (definida pelo usuário no botão "Configurar Alívia"):
  • Objetivos Financeiros: ${onboarding.objectives && onboarding.objectives.length > 0 ? onboarding.objectives.map(o => OBJECTIVE_LABELS[o] || o).join(', ') : 'Não especificado'} ${onboarding.objectives && onboarding.objectives.includes('debt') ? '(PRIORIDADE MÁXIMA: sair das dívidas vem antes de investir)' : ''}
  • Perfil de Risco do Investidor: ${onboarding.riskProfile ? (RISK_LABELS[onboarding.riskProfile] || onboarding.riskProfile) : 'Não especificado'} (use isso para validar se a alocação atual está coerente)
  • Grande Meta Financeira: ${onboarding.patrimonyGoalType ? `${onboarding.patrimonyGoalType === 'imovel' ? 'Comprar um imóvel' : 'Atingir um patrimônio total'}${onboarding.patrimonyGoalValue > 0 ? ` de R$ ${parseFloat(onboarding.patrimonyGoalValue).toFixed(2)}` : ''}` : 'Não definida'}
  • Aporte Mensal Pretendido: ${onboarding.monthlyContribution > 0 ? `R$ ${parseFloat(onboarding.monthlyContribution).toFixed(2)}/mês${typeof onboarding.investmentPercent === 'number' && onboarding.investmentPercent > 0 ? ` (~${onboarding.investmentPercent}% da renda)` : ''} (compare com a sobra real do mês para dizer se ele está conseguindo cumprir esse aporte)` : 'Não definido'}
  • % da Renda Alvo para Investir: ${typeof onboarding.investmentPercent === 'number' && onboarding.investmentPercent > 0 ? onboarding.investmentPercent + '%' : 'Não definido'} ${typeof onboarding.investmentPercent === 'number' && onboarding.investmentPercent > 0 && monthlyIncome !== 'Não informado' ? `(equivale a R$ ${(parseFloat(monthlyIncome) * onboarding.investmentPercent / 100).toFixed(2)}/mês)` : ''}
  • Margem de Segurança por Categoria (tetos definidos pelo usuário):
${manualConfig?.categoryBudgets && Object.keys(manualConfig.categoryBudgets).filter(k => manualConfig.categoryBudgets[k] && parseFloat(manualConfig.categoryBudgets[k]) > 0).length > 0
  ? Object.entries(manualConfig.categoryBudgets)
      .filter(([_, v]) => v && parseFloat(v) > 0)
      .map(([catId, v]) => {
          const catLabel = CATEGORIES.expense.find(c => c.id === catId)?.label || catId;
          const spent = expensesByCategory[catId] || 0;
          const pct = parseFloat(v) > 0 ? (spent / parseFloat(v) * 100).toFixed(0) : 0;
          return `    - ${catLabel}: teto R$ ${parseFloat(v).toFixed(2)} • gasto atual R$ ${spent.toFixed(2)} (${pct}% do teto)`;
      }).join('\n')
  : '    - Nenhum teto configurado.'}
  • Alertas ativos: ${onboarding.alerts ? Object.entries(onboarding.alerts).filter(([_, v]) => v).map(([k]) => k).join(', ') || 'Nenhum' : 'Não configurado'}

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
Você é a **Alívia**, a consultora financeira inteligente DENTRO do aplicativo Alívia. Você conhece o app por completo e ajuda o usuário tanto com análises quanto a USAR a plataforma. Sua missão é dar clareza técnica, segurança e orientar a navegação.

GUIA COMPLETO DA PLATAFORMA (use para orientar o usuário onde fazer cada coisa):
A Alívia tem 2 módulos principais, acessíveis pela tela inicial:

📊 MÓDULO "CONTROLE DE GASTOS":
  - **Visão Geral**: dashboard com saldo, fluxo de caixa, health score e últimos recebimentos.
  - **Recebimentos**: onde lançar entradas (salário, freelance). Também tem a aba "Resgates" (tirar dinheiro de reservas para a carteira).
  - **Contas Fixas**: cadastrar despesas recorrentes (aluguel, luz, internet). Tipo "valor fixo" ou "valor variável" (luz/gás/água pedem o valor real ao pagar).
  - **Lançamentos**: registrar gastos do dia a dia. Tem opção de parcelamento, recorrência e pagamento por cartão. Também tem a aba "Aportes" (guardar dinheiro).
  - **Cartões**: cadastrar cartões, assinaturas e parcelamentos. Aqui se paga a fatura.
  - **Análise de Gastos**: gráficos por categoria, comparação entre meses, exportar PDF.

🏛️ MÓDULO "CONSTRUÇÃO DE PATRIMÔNIO":
  - **Patrimônio**: visão consolidada de reservas + investimentos.
  - **Reserva de Emergência**: cofrinhos com rendimento CDI.
  - **Investimentos**: cadastrar ativos (Tesouro, CDB, ações, ETFs, FIIs, cripto) com cotação ao vivo.
  - **Metas**: criar objetivos financeiros com simulador de quanto investir/mês.
  - **Evolução Patrimonial**: gráfico de retorno vs CDI, IBOVESPA e S&P 500.

⚙️ OUTROS:
  - **Configurar Alívia**: define renda, gastos fixos, perfil de investidor, objetivos, alertas e tetos por categoria.
  - **Botão do Pânico**: ajuda emocional em momentos de ansiedade financeira.

REGRAS SOBRE CRÉDITO (IMPORTANTE): compras no cartão de crédito NÃO saem do saldo no momento do lançamento — só quando a fatura é paga (na aba Cartões). Já compras no PIX/débito saem do saldo imediatamente. Considere isso nas análises de liquidez.

QUANDO O USUÁRIO PERGUNTAR "onde faço X" ou "como faço Y": oriente-o passo a passo citando o módulo e a aba exatos do guia acima.

DIRETRIZES DE ANÁLISE (INTELIGÊNCIA REAL):
1. **Compras Parceladas**: Se o usuário perguntar sobre uma compra parcelada, não se desespere pelo valor total se o saldo atual for baixo. Calcule se a PARCELA cabe na "sobra mensal" (Renda - Fixos - Variáveis).
2. **Projeções Negativas**: Se a projeção de saldo for negativa, analise se é uma "burrice técnica" (configuração de renda baixa demais vs gastos reais altos) ou se é um risco real de endividamento.
3. **Seja Educadora**: Se uma compra for viável mas arriscada, explique: "Embora você tenha saldo hoje, essa parcela consome X% da sua margem de segurança mensal".
4. **Análise de Portfólio vs Perfil**: Se o usuário tiver especificado um 'Perfil de Risco do Investidor' (Conservador/Moderado/Arrojado), ao analisar investimentos cite EXPLICITAMENTE se a alocação atual está coerente com o perfil. Sugira ajustes quando estiver desalinhado.
5. **Use os Objetivos do Usuário**: Os Objetivos Financeiros listados acima foram escolhidos pelo próprio usuário. AMARRE suas recomendações a eles. Ex: se "Sair das Dívidas" está nos objetivos, priorize quitação antes de aporte em renda variável. Se "Viver de Renda", foque em construção de patrimônio gerador.
6. **% da Renda Alvo para Investir**: Compare o aporte real do mês (Aportes/Investimentos Realizados) com o alvo. Se ficou abaixo, mostre a diferença. Se ultrapassou, parabenize sem ser bajulador.
7. **Tetos por Categoria**: A lista "Margem de Segurança por Categoria" mostra o que o usuário definiu como limite. Se o gasto atual ultrapassou 80% do teto em qualquer categoria, sinalize PROATIVAMENTE no início da resposta. Use os valores reais já calculados acima — não recalcule.
8. **Objetividade Acima de Tudo**: Apresente os dados antes da opinião.

INSTRUÇÕES DE TOM:
- Profissional, direta, segura de si. 
- NUNCA use eufemismos infantis ou termos de carinho.
- Trate o dinheiro com a seriedade de um banco e o acolhimento de uma mentora.

DICA DE CATEGORIZAÇÃO:
Ao lançar gastos, mapeie a descrição para o ID de categoria mais próximo (Ex: Uber/99 -> transport, iFood/Restaurante -> food, Aluguel -> housing, Netflix/Spotify -> subscriptions, Farmácia -> health).

REGRAS DE COMANDO (JSON):
Se precisar realizar uma ação no sistema, use UM ÚNICO bloco JSON no final da resposta.

⚠️ ESCOLHA DA AÇÃO CERTA — LEIA COM ATENÇÃO:
A coisa MAIS importante é mandar cada lançamento para o LUGAR CORRETO do app.
NÃO use "add_transaction" para tudo. Analise o que o usuário pediu:

  • "conta fixa", "conta de internet/luz/água/aluguel/mensalidade", "todo mês" → use **add_fixed_expense**
  • "assinatura", "Netflix/Spotify/plano recorrente", "assinatura no cartão" → use **add_subscription**
  • "parcelei", "comprei em Nx", "X vezes no cartão", "parcelamento" → use **add_installment**
  • "guardar na reserva", "reserva de emergência", "guardar/poupar pra emergência" → use **add_to_reserve**
  • gasto/ganho avulso do dia a dia (mercado, uber, salário, etc.) → use **add_transaction**

⚠️ APORTES — REGRA OBRIGATÓRIA:
  • Reserva de emergência → SEMPRE use **add_to_reserve** (credita o cofrinho da reserva e debita a carteira).
  • Aportes em INVESTIMENTOS ou PATRIMÔNIO (ações, Tesouro, CDB, cripto, fundos, "aporte no patrimônio", "investir em X") NÃO podem ser lançados pelo chat. NUNCA use add_transaction com category "investment" ou "vault". Em vez disso, oriente o usuário com gentileza a fazer manualmente no **Módulo Patrimônio → Investimentos**.

Se o usuário mencionar um cartão (ex: "no nubank", "no cartão"), inclua "cardName".

1. **add_transaction** — gasto/renda avulso do dia a dia (NÃO recorrente, NÃO parcelado):
\`\`\`json
{ "action": "add_transaction", "data": {
    "description": "Descrição curta",
    "amount": "123.45",
    "type": "expense|income",
    "category": "ID_DA_CATEGORIA",
    "priority": "essential|comfort|superfluous (opcional; SÓ para expense. Use o que o usuário disser: 'essencial'/'importante'/'necessário' → essential; 'conforto'/'qualidade de vida' → comfort; 'supérfluo'/'dispensável'/'besteira' → superfluous. Respeite SEMPRE a prioridade pedida, mesmo que pareça incomum para a categoria.)",
    "paymentMethod": "pix|debito|credito|dinheiro (opcional; use 'credito' se foi no cartão)",
    "cardName": "nome do cartão citado (opcional, só se paymentMethod=credito)",
    "date": "YYYY-MM-DD (opcional)"
} }
\`\`\`

2. **add_fixed_expense** — conta fixa recorrente (vai para a aba Contas Fixas):
\`\`\`json
{ "action": "add_fixed_expense", "data": {
    "name": "Ex: Internet",
    "value": "99.90",
    "day": "dia de vencimento (1-31, opcional)",
    "category": "ID_DA_CATEGORIA",
    "isVariable": false
} }
\`\`\`
(use "isVariable": true para luz, gás, água — contas que mudam de valor todo mês)

3. **add_subscription** — assinatura recorrente (vai para a aba Cartões):
\`\`\`json
{ "action": "add_subscription", "data": {
    "name": "Ex: Netflix",
    "value": "39.90",
    "category": "subscriptions",
    "cardName": "nome do cartão (opcional)",
    "day": "dia da cobrança (opcional, se não tiver cartão)"
} }
\`\`\`

4. **add_installment** — compra parcelada (vai para a aba Cartões):
\`\`\`json
{ "action": "add_installment", "data": {
    "name": "Ex: Notebook",
    "value": "VALOR_DE_CADA_PARCELA",
    "installments": "12",
    "category": "shopping",
    "cardName": "nome do cartão (opcional)"
} }
\`\`\`
(IMPORTANTE: "value" é o valor de CADA parcela. Se o usuário disser o valor total, divida pelo nº de parcelas você mesmo.)

5. **update_manual_config** — corrigir valores configurados (renda, gastos fixos, patrimônio):
\`\`\`json
{ "action": "update_manual_config", "data": {
    "invested": "opcional", "income": "opcional", "fixedExpenses": "opcional"
} }
\`\`\`

6. **add_to_reserve** — guardar dinheiro na RESERVA DE EMERGÊNCIA (cofrinho). Use SEMPRE que o usuário pedir para guardar/aportar na reserva de emergência. Credita o cofrinho e desconta da carteira:
\`\`\`json
{ "action": "add_to_reserve", "data": {
    "amount": "500.00",
    "description": "Reserva de Emergência (opcional)"
} }
\`\`\`
(NUNCA lance reserva de emergência como add_transaction/investment — use SEMPRE add_to_reserve.)

REGRAS TÉCNICAS:
- **Formato do Valor**: Use somente números decimais (Ex: "4500.00"). NUNCA use pontos de milhar (Ex: NUNCA use "4.500,00").
- **Isolamento**: O bloco JSON deve estar OBRIGATORIAMENTE entre crases ( \`\`\`json ... \`\`\` ) e ser a ÚLTIMA coisa na mensagem.
- **Uma ação por vez**: se o usuário pedir várias coisas, faça a principal e peça pra confirmar as outras em seguida.

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
    const apiKey = sessionApiKey;
    if (!apiKey) throw new Error("API Key não configurada");

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const cleanHistory = history.filter(msg => msg.text && !msg.text.includes('{"action":'));

        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: "System Prompt: " + context }] },
                { role: "model", parts: [{ text: "Entendido. Serei sua Alívia financeira." }] },
                ...cleanHistory.slice(-8).map(msg => ({
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
    const apiKey = sessionApiKey;
    if (!apiKey) throw new Error("API Key não configurada");

    const { income, expense, balance, topCategory } = stats;
    const fixedExpenses = manualConfig?.fixedExpenses || 0;
    const monthlyIncome = manualConfig?.income || 0;

    const currentMonthLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const isCurrentMonth = monthName.toLowerCase() === currentMonthLabel.toLowerCase();

    const prompt = `
Você é a **Alívia**, assistente financeira focada em clareza e resultados.
${isCurrentMonth ? `O usuário está no meio do mês de ${monthName} e você deve fornecer uma análise PARCIAL e objetiva do desempenho atual dele.` : `O usuário encerrou o mês e você deve fornecer uma análise técnica e objetiva do desempenho financeiro dele em ${monthName}.`}

DADOS DO MÊS ${isCurrentMonth ? 'ATÉ AGORA' : 'ENCERRADO'}:
- Entradas Totais: R$ ${income.toFixed(2)}
- Gastos Totais: R$ ${expense.toFixed(2)}
- Saldo Atual: R$ ${balance.toFixed(2)}
- Categoria de Maior Impacto: ${topCategory}

CONFIGURAÇÃO ATUAL:
- Renda Prevista: R$ ${monthlyIncome}
- Gastos Fixos: R$ ${fixedExpenses}
- Assinaturas/Base do Cartão:
${(manualConfig?.recurringSubs || []).map(s => `  * ${s.name}: R$ ${parseFloat(s.amount).toFixed(2)}${s.totalInstallments > 0 ? ` (Parcela ${s.currentInstallment} de ${s.totalInstallments})` : ''}`).join('\n') || '  (Nenhuma assinatura configurada)'}

SUA TAREFA:
1. Apresente o balanço do mês de forma direta.
2. ${isCurrentMonth ? 'Avalie se o ritmo de gastos está saudável para chegar ao fim do mês com saldo.' : 'Analise se o saldo final foi coerente com a renda prevista.'}
3. Forneça 2 recomendações práticas e curtas focadas em eficiência financeira.
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

export const generatePatrimonyAnalysis = async (jarsTotal, investmentsTotal, userConfig) => {
    const apiKey = sessionApiKey;
    if (!apiKey) throw new Error("API Key não configurada");

    const patrimonioTotal = jarsTotal + investmentsTotal;
    const monthlyIncome = userConfig?.income || 'Não informado';
    const fixedExpenses = userConfig?.fixedExpenses || 'Não informado';
    const riskProfile = userConfig?.riskProfile || 'Não definido';

    const prompt = `
Você é a **Alívia**, especialista financeira.

DADOS DO PATRIMÔNIO ATUAL:
- Total em Reserva de Emergência: R$ ${jarsTotal.toFixed(2)}
- Total em Investimentos: R$ ${investmentsTotal.toFixed(2)}
- Patrimônio Total: R$ ${patrimonioTotal.toFixed(2)}

DADOS DO USUÁRIO:
- Renda Mensal: R$ ${monthlyIncome}
- Gastos Fixos: R$ ${fixedExpenses}
- Perfil de Investidor: ${riskProfile}

DADOS DE REFERÊNCIA BRASIL (IBGE/BCB 2024):
- Apenas 36% dos brasileiros conseguem poupar algum valor por mês
- Mediana de patrimônio financeiro do brasileiro: ~R$ 5.000
- Top 25% possui acima de R$ 50.000 em patrimônio
- Top 10% possui acima de R$ 250.000
- Apenas 4% dos brasileiros investem em renda variável
- 76% não possuem reserva de emergência

TAREFA (máximo 3 parágrafos curtos):
1. **Maturidade Financeira**: Classifique o nível (Iniciante / Em Construção / Intermediário / Avançado / Consolidado) com base no patrimônio, diversificação e reserva.
2. **Posição vs. Brasil**: Diga em que percentil aproximado o usuário se encontra comparado à população brasileira. Ex: "Você já está à frente de X% dos brasileiros."
3. **Saúde da Reserva**: Avalie quantos meses de gastos fixos a reserva cobre (se possível calcular).
4. Tom direto, profissional, encorajador. Use markdown para negritar pontos-chave. NUNCA use diminutivos.
5. Seja BREVE — máximo 3 parágrafos.

Responda apenas com o texto do feedback.
`;

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await withRetry(() => model.generateContent(prompt));
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Erro ao gerar análise de patrimônio:", error);
        return "Sua jornada de construção de patrimônio está em andamento. Continue alimentando suas reservas e investimentos consistentemente.";
    }
};
