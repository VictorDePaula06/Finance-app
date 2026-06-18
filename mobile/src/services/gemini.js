import { GoogleGenerativeAI } from '@google/generative-ai';
import { INCOME_CATS, EXPENSE_CATS, catMeta } from '../lib/categories.js';
import { fmt } from '../lib/finance.js';

const MODEL = 'gemini-2.5-flash';

// ── Chave Gemini (BYOK) ───────────────────────────────────────────────────────
// Mesma lógica do site: a chave é do usuário. Em produção vem do Firestore
// (users/{uid}/settings/general → apiKey), já carregada em `prefs`. Aqui guardamos
// também uma chave de sessão (memória) para permitir testar sem login.
let sessionKey = null;
export const setSessionKey = (k) => { sessionKey = (k || '').trim() || null; };
export const resolveKey = (prefs) =>
  (prefs?.apiKey || prefs?.manualConfig?.geminiKey || sessionKey || '').trim() || null;

// Normaliza valores que a IA possa mandar ("R$ 1.234,56" → "1234.56").
export const sanitizeAIValue = (val) => {
  if (!val && val !== 0) return '0';
  let s = String(val).trim().replace(/[R$\s]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  else if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length > 2 || parts[parts.length - 1].length !== 2) s = s.replace(/\./g, '');
  }
  return s;
};

// Monta o "system prompt" com os números reais do usuário (versão mobile, fiel
// à identidade da Alívia do site, focada no que o app mobile sabe fazer).
export function buildAliviaContext({ finance, transactions = [], cards = [], prefs = {} }) {
  const { balance = 0, income = 0, expense = 0, reserve = 0, invoice = {}, health = {} } = finance || {};
  const today = new Date();
  const month = today.toLocaleDateString('en-CA').slice(0, 7);

  const recent = [...transactions]
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 20)
    .map((t) => `- ${String(t.date || '').slice(0, 10)}: ${t.description || catMeta(t.category).label} (${t.type === 'income' ? '+' : '-'} R$ ${fmt(parseFloat(t.amount) || 0)}) [${t.category}]`)
    .join('\n') || '  (sem lançamentos recentes)';

  const cardsText = cards.length
    ? cards.map((c) => {
        const aberto = transactions
          .filter((t) => t.selectedCardId === c.id && t.invoiceStatus === 'unpaid')
          .reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
        return `  - ${c.name} (final ${c.last4 || '----'}): fatura aberta ≈ R$ ${fmt(aberto)} • vence dia ${c.dueDay || '?'}`;
      }).join('\n')
    : '  - Nenhum cartão cadastrado.';

  const expenseCats = EXPENSE_CATS.map((c) => `${c.id} (${c.label})`).join(', ');
  const incomeCats = INCOME_CATS.map((c) => `${c.id} (${c.label})`).join(', ');
  const healthText = health?.score != null
    ? `Nota ${health.score}/100 (${health.statusLabel}). Reserva cobre ${(health.reserveMonths || 0).toFixed(1)} meses.`
    : 'Não calculada.';

  return `
CONTEXTO FINANCEIRO DO USUÁRIO (mês ${month}):
- Saldo em carteira HOJE: R$ ${fmt(balance)}
- Ganhos reais do mês: R$ ${fmt(income)}
- Gastos reais do mês: R$ ${fmt(expense)}
- Reserva de emergência: R$ ${fmt(reserve)}
- Fatura de cartão em aberto (total): R$ ${fmt(invoice?.openTotal || 0)}
- Saúde financeira: ${healthText}

CARTÕES:
${cardsText}

ÚLTIMAS TRANSAÇÕES:
${recent}

CATEGORIAS DE DESPESA: ${expenseCats}
CATEGORIAS DE RECEITA: ${incomeCats}

IDENTIDADE:
Você é a **Alívia**, consultora financeira dentro do app Alívia (versão celular).
Tom profissional, direto, acolhedor — sem diminutivos nem termos de carinho.
Responda em português do Brasil, de forma objetiva e curta.

REGRAS SOBRE CRÉDITO: compras no cartão de crédito NÃO saem do saldo na hora —
só quando a fatura é paga. Pix/débito/dinheiro saem do saldo imediatamente.

O QUE VOCÊ PODE REGISTRAR POR AQUI:
Pelo chat do celular você só registra gastos e recebimentos avulsos do dia a dia
(ação add_transaction). Para CONTAS FIXAS, ASSINATURAS, PARCELAMENTOS ou guardar
na RESERVA, oriente o usuário a usar as abas do app (não gere JSON para isso).
NUNCA lance category "investment" ou "vault" — oriente a fazer no site.

DICA DE CATEGORIZAÇÃO: mapeie a descrição para o ID mais próximo
(Uber/99 → transport, iFood/restaurante → food, mercado → food, aluguel → housing,
farmácia → health, Netflix/Spotify → subscriptions).

REGRA DE COMANDO (JSON):
Para registrar um gasto/recebimento, escreva uma resposta curta e termine com UM
ÚNICO bloco JSON, OBRIGATORIAMENTE entre crases, como ÚLTIMA coisa da mensagem:
\`\`\`json
{ "action": "add_transaction", "data": {
  "description": "curta",
  "amount": "123.45",
  "type": "expense|income",
  "category": "ID_DA_CATEGORIA",
  "paymentMethod": "pix|debito|credito|dinheiro (opcional)",
  "cardName": "nome do cartão citado (opcional, só se paymentMethod=credito)",
  "date": "YYYY-MM-DD (opcional)"
} }
\`\`\`
- Valor SEMPRE decimal com ponto (ex.: "1234.56"), nunca "1.234,56".
- Uma ação por vez. Se faltar algo essencial (valor), pergunte antes.
- Se a pessoa só fizer uma pergunta, responda SEM bloco JSON.
`;
}

// Conversa com a Alívia (texto). history = [{role:'user'|'model', text}].
export async function chatWithAlivia({ apiKey, context, history = [], message }) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL });
  const clean = history.filter((m) => m.text && !m.text.includes('"action"'));
  const chat = model.startChat({
    history: [
      { role: 'user', parts: [{ text: 'System Prompt: ' + context }] },
      { role: 'model', parts: [{ text: 'Entendido. Sou a Alívia, sua consultora financeira.' }] },
      ...clean.slice(-8).map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
    ],
  });
  const result = await chat.sendMessage(message);
  return (await result.response).text();
}

// Transcreve um áudio (base64) para texto, em português.
export async function transcribeAudio({ apiKey, base64, mimeType = 'audio/webm' }) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL });
  const result = await model.generateContent([
    { inlineData: { mimeType, data: base64 } },
    { text: 'Transcreva este áudio em português do Brasil. Responda APENAS com o texto falado, sem comentários.' },
  ]);
  return (await result.response).text().trim();
}

// Extrai o bloco JSON de ação (se houver) e o texto a exibir (sem o JSON).
export function parseAliviaAction(responseText) {
  let jsonString = null;
  const blocks = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/g);
  if (blocks) {
    jsonString = blocks[blocks.length - 1].replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
  } else {
    const a = responseText.indexOf('{');
    const b = responseText.lastIndexOf('}');
    if (a !== -1 && b > a) {
      const cand = responseText.substring(a, b + 1);
      if (cand.includes('"action"')) jsonString = cand;
    }
  }

  let display = responseText
    .replace(/```(?:json)?[\s\S]*?```/g, '')
    .replace(/\{"action"[\s\S]*?\}\s*$/g, '')
    .trim();

  let command = null;
  if (jsonString) {
    try { command = JSON.parse(jsonString); } catch { command = null; }
  }
  if (!display && command) display = 'Pronto!';
  return { display, command };
}
