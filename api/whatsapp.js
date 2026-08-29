/**
 * Vercel Serverless Function: /api/whatsapp
 *
 * Webhook da Alívia no WhatsApp (Meta Cloud API).
 *  - GET  : verificação do webhook (hub.challenge).
 *  - POST : recebe mensagens do usuário e responde.
 *
 * Fluxo:
 *  1. Número não vinculado → espera o CÓDIGO DE VÍNCULO gerado no app.
 *  2. Vinculado → conversa com a Alívia (Gemini). Sem citar valores; fala das metas.
 *  3. Detecção de gasto → pede CONFIRMAÇÃO ("responda SIM") antes de lançar.
 *
 * Variáveis de ambiente (Vercel):
 *  - WHATSAPP_VERIFY_TOKEN      (string que VOCÊ escolhe; usada só na verificação)
 *  - WHATSAPP_TOKEN            (token de acesso da Meta — SECRETO)
 *  - WHATSAPP_PHONE_NUMBER_ID  (ex.: 1233457129856835)
 *  - GEMINI_API_KEY           (chave do Gemini do servidor — SECRETA)
 *  - FIREBASE_SERVICE_ACCOUNT_KEY  (JSON do service account — já usado no send-push)
 *
 * Coleções Firestore:
 *  - wa_links/{codigo}    { uid, createdAt }           → código de vínculo (uso único)
 *  - wa_users/{telefone}  { uid, linkedAt }            → telefone (E.164 só dígitos) → uid
 *  - wa_sessions/{telefone} { pending, history, uid }  → estado da conversa
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

// Precisamos do corpo CRU (bytes) para validar a assinatura da Meta (HMAC).
export const config = { api: { bodyParser: false } };

// Lê o corpo cru da requisição como Buffer.
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

// Valida a assinatura X-Hub-Signature-256 (HMAC-SHA256 com o App Secret da Meta).
// Só EXIGE quando WHATSAPP_APP_SECRET está configurado — assim não quebra o fluxo
// atual; ao definir o segredo, o webhook passa a rejeitar POSTs forjados.
function verifySignature(req, rawBody) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // não configurado ainda → não bloqueia (só recomendado)
  const header = req.headers['x-hub-signature-256'] || '';
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

const GRAPH = 'https://graph.facebook.com/v20.0';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Categorias de despesa válidas (espelha src/constants/categories.js).
const EXPENSE_CATS = ['housing', 'food', 'fast_food', 'transport', 'health', 'education', 'pets', 'personal_care', 'subscriptions', 'credit_card', 'church', 'taxes', 'leisure', 'shopping', 'conta_fixa', 'other'];
const PRIORITIES = ['essential', 'comfort', 'superfluous'];

function initAdmin() {
  if (!getApps().length) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    initializeApp({ credential: cert(sa) });
  }
  return getFirestore();
}

// Envia uma mensagem de texto de volta pelo WhatsApp.
async function sendText(to, body) {
  const pid = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  try {
    const resp = await fetch(`${GRAPH}/${pid}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: body.slice(0, 4000) } }),
    });
    const respText = await resp.text().catch(() => '');
    console.log(`WA send -> to=${to} status=${resp.status} resp=${respText.slice(0, 300)}`);
  } catch (e) {
    console.error('Erro ao enviar WhatsApp:', e?.message || e);
  }
}

// Monta um contexto QUALITATIVO do usuário (sem valores) para a Alívia.
async function buildUserContext(db, uid) {
  const monthKey = new Date().toISOString().slice(0, 7);
  const num = (v) => parseFloat(v) || 0;
  try {
    const [txSnap, goalSnap, jarSnap] = await Promise.all([
      db.collection('transactions').where('userId', '==', uid).get(),
      db.collection('expense_goals').where('userId', '==', uid).get(),
      db.collection('savings_jars').where('userId', '==', uid).get(),
    ]);
    let income = 0, expense = 0, essential = 0, superf = 0;
    txSnap.forEach(d => {
      const t = d.data();
      const m = t.month || String(t.date || '').slice(0, 7);
      if (m !== monthKey) return;
      if (t.type === 'income' && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category)) income += num(t.amount);
      if (t.type === 'expense' && !['investment', 'vault', 'credit_card_bill'].includes(t.category)) {
        expense += num(t.amount);
        if (t.priority === 'essential') essential += num(t.amount); else if (t.priority === 'superfluous') superf += num(t.amount);
      }
    });
    const reserve = jarSnap.docs.reduce((a, d) => a + num(d.data().balance), 0);
    const goals = goalSnap.docs.map(d => d.data()).map(g => `${g.name || 'meta'} (${g.type || 'meta'})`);
    const supHigh = expense > 0 && (superf / expense) > 0.3;
    return [
      `Situação do mês (use como base, NÃO cite números):`,
      `- Saldo do mês: ${income - expense >= 0 ? 'positivo (ganhou mais do que gastou)' : 'negativo (gastou mais do que ganhou)'}.`,
      `- Gastos supérfluos: ${supHigh ? 'ALTOS (acima do ideal)' : 'sob controle'}.`,
      `- Reserva de emergência: ${reserve > 0 ? 'existe (comente se parece baixa ou boa)' : 'ainda NÃO tem'}.`,
      `- Metas cadastradas: ${goals.length ? goals.join(', ') : 'nenhuma'}.`,
    ].join('\n');
  } catch (e) {
    console.error('Erro no contexto:', e);
    return 'Sem dados suficientes para análise detalhada.';
  }
}

const SYSTEM = `Você é a **Alívia**, assistente financeira acolhedora, respondendo pelo WhatsApp.
REGRAS:
- NÃO cite valores monetários específicos (nada de "R$ X"). Faça análise geral e qualitativa.
- Comente também sobre as metas/objetivos do usuário quando fizer sentido.
- Seja breve (WhatsApp), clara e simpática. Pode usar emojis com moderação.

AÇÕES — quando o usuário quiser AGIR, responda SOMENTE com o JSON da ação (nada de texto junto).
Categorias de despesa (category) ∈ [${EXPENSE_CATS.join(', ')}]; prioridade (priority) ∈ [${PRIORITIES.join(', ')}].
1) Gasto avulso (dinheiro/pix/débito) — ex.: "gastei 50 no mercado", "uber 23":
   {"action":"add_expense","description":"<texto>","amount":<número>,"category":"<id>","priority":"<id>"}
2) Gasto no CARTÃO de crédito — ex.: "passei 200 no cartão", "comprei 80 no crédito do Nubank":
   {"action":"add_card_expense","description":"<texto>","amount":<número>,"category":"<id>","priority":"<id>","cardName":"<nome do cartão se citado, senão vazio>"}
3) Entrada avulsa (recebi/ganhei/entrou) — ex.: "recebi 300 de freela", "caiu 100":
   {"action":"add_income","description":"<texto>","amount":<número>}
4) Guardar na RESERVA — ex.: "guarda 50 na reserva", "poupar 100":
   {"action":"add_to_reserve","amount":<número>}
5) META da reserva — ex.: "meta de 20000", "quero juntar 20 mil":
   {"action":"set_reserve_goal","target":<número>}
6) Nova DESPESA recorrente (conta fixa todo mês) — ex.: "cadastra aluguel 1500 dia 10", "internet 100 todo dia 5":
   {"action":"add_fixed_expense","name":"<nome>","value":<número>,"day":<1-31>,"category":"<id>"}
7) Nova ENTRADA recorrente (salário todo mês) — ex.: "meu salário é 4000 dia 5":
   {"action":"add_fixed_income","name":"<nome>","value":<número>,"day":<1-31>}
8) Dar BAIXA numa recorrente (pagar despesa fixa OU confirmar recebimento do mês) —
   ex.: "paguei a Netflix", "dei baixa no aluguel", "recebi meu salário" (se já é recorrente):
   {"action":"baixa_recorrente","kind":"<expense|income>","name":"<nome da conta/entrada>"}

⚠️ NUNCA diga em texto que cadastrou/guardou/criou/pagou/registrou algo. Para AGIR, responda SÓ com o JSON — o app grava e confirma de verdade.
Se não for nenhuma ação, responda normalmente em texto (sem inventar que fez algo).`;

async function askGemini(history, contextText, userMsg) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { console.error('WA Gemini: GEMINI_API_KEY AUSENTE na Vercel.'); return 'Desculpe, não consegui responder agora. 😅'; }
  const contents = [
    ...(history || []).slice(-6).map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: userMsg }] },
  ];
  const body = {
    system_instruction: { parts: [{ text: `${SYSTEM}\n\n${contextText}` }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
  };
  try {
    const r = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      console.error(`WA Gemini falhou: HTTP ${r.status} resp=${JSON.stringify(j).slice(0, 500)}`);
      return 'Desculpe, não consegui responder agora. 😅';
    }
    return text;
  } catch (e) {
    console.error('WA Gemini erro de rede:', e?.message || e);
    return 'Desculpe, não consegui responder agora. 😅';
  }
}

// Extrai QUALQUER bloco de ação JSON da resposta da IA.
function parseAction(text) {
  const m = text.match(/\{[\s\S]*?"action"[\s\S]*?\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// Acha a reserva do usuário (emergência) ou a 1ª; cria se não existir.
async function findOrCreateReserve(db, uid, seed = {}) {
  const snap = await db.collection('savings_jars').where('userId', '==', uid).get();
  const doc = snap.docs.find(d => /emerg|reserva/i.test(d.data().name || '')) || snap.docs[0];
  if (doc) return { ref: doc.ref, data: doc.data(), name: doc.data().name || 'Reserva de emergência' };
  const now = Date.now();
  const base = { name: 'Reserva de emergência', balance: 0, invested: 0, cdiPercent: 100, type: 'reserva', lastYieldAt: now, userId: uid, createdAt: now, ...seed };
  const ref = await db.collection('savings_jars').add(base);
  return { ref, data: base, name: base.name };
}

// Aporta um valor na reserva (grava de verdade). Retorna o nome da reserva.
async function doAddToReserve(db, uid, amount) {
  const { ref, data, name } = await findOrCreateReserve(db, uid);
  const now = Date.now();
  await ref.set({
    balance: (parseFloat(data.balance) || 0) + amount,
    invested: (parseFloat(data.invested ?? data.balance) || 0) + amount,
    lastYieldAt: now,
  }, { merge: true });
  const iso = new Date().toISOString();
  await db.collection('transactions').add({
    description: `Aporte reserva: ${name}`, amount, type: 'expense', category: 'vault',
    date: iso, month: iso.slice(0, 7), userId: uid, createdAt: now,
    paymentMethod: 'pix', source: 'whatsapp', jarId: ref.id, isTransfer: true, reserveInternal: true,
  });
  return name;
}

// Define a meta (target) da reserva. Retorna o nome.
async function doSetReserveGoal(db, uid, target) {
  const { ref, name } = await findOrCreateReserve(db, uid);
  await ref.set({ target }, { merge: true });
  return name;
}

// Padroniza a descrição: 1ª letra maiúscula, resto minúsculo (igual ao app).
const normName = (s) => { const t = String(s || '').trim().replace(/\s+/g, ' '); return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t; };
const mkNow = () => new Date().toISOString().slice(0, 7);

// Entrada avulsa (recebi/ganhei) — grava direto no saldo em conta.
async function doAddIncome(db, uid, { description, amount }) {
  const v = Math.abs(parseFloat(amount) || 0);
  if (v <= 0) return { ok: false };
  const iso = new Date().toISOString();
  await db.collection('transactions').add({
    description: normName(description || 'Entrada'), amount: v, type: 'income',
    category: 'other', date: iso, month: iso.slice(0, 7),
    userId: uid, createdAt: Date.now(), source: 'whatsapp',
  });
  return { ok: true, amount: v };
}

// Cria uma recorrente (despesa ou entrada) no formato do app.
async function doAddFixed(db, uid, kind, { name, value, day, category }) {
  const income = kind === 'income';
  const coll = income ? 'fixed_incomes' : 'fixed_expenses';
  const v = Math.abs(parseFloat(value) || 0);
  if (v <= 0 || !name) return { ok: false };
  const data = {
    name: normName(name), value: v,
    category: category || (income ? 'salary' : 'conta_fixa'),
    day: Math.min(31, Math.max(1, parseInt(day) || 5)), isVariable: false,
    userId: uid, createdAt: Date.now(),
  };
  if (!income) { data.priority = 'essential'; data.paymentMethod = 'pix'; data.cardId = ''; }
  await db.collection(coll).add(data);
  return { ok: true, name: data.name, income };
}

// Dá baixa numa recorrente do MÊS ATUAL — atômico (ID único impede baixa dupla),
// espelhando exatamente o fluxo do app (Recorrentes.jsx › BaixaDialog).
async function doBaixaRecorrente(db, uid, kind, name) {
  const income = kind === 'income';
  const coll = income ? 'fixed_incomes' : 'fixed_expenses';
  const occPrefix = income ? 'inc_' : '';
  const defaultCat = income ? 'salary' : 'conta_fixa';
  const snap = await db.collection(coll).where('userId', '==', uid).get();
  if (snap.empty) return { ok: false, reason: 'notfound', income };
  const q = String(name || '').toLowerCase().trim();
  let doc = q ? snap.docs.find(d => {
    const n = String(d.data().name || '').toLowerCase();
    return n.includes(q) || q.includes(n);
  }) : null;
  if (!doc && snap.docs.length === 1) doc = snap.docs[0]; // só existe uma → assume essa
  if (!doc) return { ok: false, reason: 'notfound', income };
  const rec = { id: doc.id, ...doc.data() };
  const val = Math.abs(parseFloat(rec.value) || 0);
  if (val <= 0) return { ok: false, reason: 'invalid', name: rec.name, income };
  const mk = mkNow();
  const occRef = db.collection('users').doc(uid).collection('recorrentes_baixas').doc(`${occPrefix}${rec.id}_${mk}`);
  const txRef = db.collection('transactions').doc();
  try {
    await db.runTransaction(async (tx) => {
      const occ = await tx.get(occRef);
      if (occ.exists) throw new Error('ALREADY_PAID');
      const now = new Date();
      const txData = {
        description: rec.name, amount: val, type: income ? 'income' : 'expense',
        category: rec.category || defaultCat, date: now.toISOString(), month: mk,
        userId: uid, createdAt: Date.now(), isFixed: true, source: 'recorrente_baixa', recorrenteId: rec.id,
      };
      if (!income) {
        txData.paymentMethod = rec.paymentMethod || 'pix';
        txData.priority = rec.priority || 'essential';
        txData.selectedCardId = rec.paymentMethod === 'credito' ? (rec.cardId || null) : null;
      }
      tx.set(txRef, txData);
      tx.set(occRef, { kind, recorrenteId: rec.id, monthKey: mk, amount: val, txId: txRef.id, description: rec.name, at: FieldValue.serverTimestamp() });
      tx.update(db.collection(coll).doc(rec.id), { lastPaidMonth: mk });
    });
    return { ok: true, name: rec.name, amount: val, income };
  } catch (e) {
    if (e?.message === 'ALREADY_PAID') return { ok: false, reason: 'already', name: rec.name, income };
    throw e;
  }
}

// Resolve qual cartão usar (por nome citado, senão o 1º). Retorna null se não houver.
async function resolveCard(db, uid, cardName) {
  const snap = await db.collection('cards').where('userId', '==', uid).get();
  if (snap.empty) return null;
  const q = String(cardName || '').toLowerCase().trim();
  let doc = q ? snap.docs.find(d => {
    const c = d.data();
    return `${c.name || ''} ${c.bank || ''} ${c.brand || ''}`.toLowerCase().includes(q);
  }) : null;
  if (!doc) doc = snap.docs[0];
  return { id: doc.id, name: doc.data().name || doc.data().bank || 'cartão' };
}

function parseExpense(text) {
  const m = text.match(/\{[\s\S]*"action"\s*:\s*"add_expense"[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const amount = parseFloat(j.amount) || 0;
    if (amount <= 0 || !j.description) return null;
    return {
      description: String(j.description).slice(0, 120),
      amount,
      category: EXPENSE_CATS.includes(j.category) ? j.category : 'other',
      priority: PRIORITIES.includes(j.priority) ? j.priority : 'comfort',
    };
  } catch { return null; }
}

const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const yes = (t) => /^(sim|confirmar|isso|ok|pode|s)\b/i.test(t.trim());
const no = (t) => /^(n[aã]o|cancelar|nao|n)\b/i.test(t.trim());

export default async function handler(req, res) {
  // ── Verificação do webhook (GET) ──
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Corpo cru + validação de assinatura (rejeita POSTs forjados quando o
  // WHATSAPP_APP_SECRET estiver configurado na Vercel).
  const rawBody = await readRawBody(req);
  if (!verifySignature(req, rawBody)) {
    console.warn('WA webhook: assinatura inválida — POST rejeitado');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // IMPORTANTE (Vercel): processa TUDO antes de responder 200 — se responder
  // antes, a função é congelada e a resposta da Alívia não chega a ser enviada.
  try {
    const body = JSON.parse(rawBody.toString('utf8') || '{}');
    const value = body?.entry?.[0]?.changes?.[0]?.value;

    // Avisos de ENTREGA da Meta (sent/delivered/read/failed) — logamos p/ diagnosticar
    // por que uma resposta com status 200 pode não chegar (erro, janela 24h, etc.).
    const statuses = value?.statuses;
    if (Array.isArray(statuses) && statuses.length) {
        for (const s of statuses) {
            console.log(`WA status -> to=${s.recipient_id} status=${s.status}${s.errors ? ' errors=' + JSON.stringify(s.errors) : ''}`);
        }
        return res.status(200).json({ ok: true });
    }

    const msg = value?.messages?.[0];
    if (!msg || msg.type !== 'text') return res.status(200).json({ ok: true }); // ignora não-texto

    const from = msg.from; // telefone E.164 só dígitos
    const text = msg.text?.body || '';
    console.log(`WA in <- from=${from} text="${text.slice(0, 80)}"`);
    const db = initAdmin();

    // 1. Vínculo do número
    const userDoc = await db.collection('wa_users').doc(from).get();
    if (!userDoc.exists) {
      const code = text.trim().toUpperCase().replace(/\s+/g, '');
      const linkRef = db.collection('wa_links').doc(code);
      const linkSnap = await linkRef.get();
      if (linkSnap.exists) {
        await db.collection('wa_users').doc(from).set({ uid: linkSnap.data().uid, linkedAt: Date.now() });
        await linkRef.delete();
        await sendText(from, 'Pronto, seu WhatsApp foi vinculado à sua conta Alívia! ✅\n\nPode me perguntar sobre suas finanças ou registrar um gasto (ex.: "mercado 120").');
      } else {
        await sendText(from, 'Oi! Sou a Alívia 💚\nPara conectar, abra o app em *Ajustes › Conectar WhatsApp*, gere seu código e me envie ele aqui.');
      }
      return res.status(200).json({ ok: true });
    }

    const uid = userDoc.data().uid;
    const sessRef = db.collection('wa_sessions').doc(from);
    const sess = (await sessRef.get()).data() || {};
    const history = sess.history || [];

    // 2. Confirmação de gasto pendente (avulso em conta OU no cartão)
    if (sess.pending?.type === 'expense' || sess.pending?.type === 'card') {
      const isCard = sess.pending.type === 'card';
      if (yes(text)) {
        const p = sess.pending.data;
        const now = new Date();
        const txData = {
          description: p.description, amount: p.amount, type: 'expense',
          category: p.category, priority: p.priority,
          date: now.toISOString(), month: now.toISOString().slice(0, 7),
          userId: uid, createdAt: Date.now(), isFixed: false, source: 'whatsapp',
        };
        if (isCard) { txData.paymentMethod = 'credito'; txData.selectedCardId = p.cardId; txData.invoiceStatus = 'unpaid'; }
        else { txData.paymentMethod = 'pix'; }
        await db.collection('transactions').add(txData);
        await sessRef.set({ uid, history, pending: null }, { merge: true });
        await sendText(from, isCard
          ? `Lançado! ✅ *${p.description}* entrou na fatura do *${p.cardName}*.`
          : `Lançado! ✅ *${p.description}* foi registrado nas suas despesas.`);
        return res.status(200).json({ ok: true });
      }
      if (no(text)) {
        await sessRef.set({ uid, history, pending: null }, { merge: true });
        await sendText(from, 'Sem problema, cancelei. 👍');
        return res.status(200).json({ ok: true });
      }
      // Se não confirmou nem cancelou, segue como conversa normal (limpa pendência).
      await sessRef.set({ uid, pending: null }, { merge: true });
    }

    // 3. Conversa com a Alívia
    const ctx = await buildUserContext(db, uid);
    const reply = await askGemini(history, ctx, text);
    const action = parseAction(reply);

    // 3a. Aporte na reserva — grava de verdade e confirma só se der certo.
    if (action?.action === 'add_to_reserve') {
      const amount = Math.abs(parseFloat(action.amount) || 0);
      if (amount <= 0) { await sendText(from, 'Não entendi o valor para guardar na reserva. Ex.: "guarda 100 na reserva". 🙏'); return res.status(200).json({ ok: true }); }
      try {
        const nm = await doAddToReserve(db, uid, amount);
        await sessRef.set({ uid, history, pending: null }, { merge: true });
        await sendText(from, `Pronto! Guardei *R$ ${money(amount)}* na sua *${nm}*. ✅`);
      } catch (e) { console.error('WA add_to_reserve:', e); await sendText(from, 'Não consegui guardar na reserva agora. Tenta de novo. 🙏'); }
      return res.status(200).json({ ok: true });
    }

    // 3b. Meta da reserva — grava de verdade.
    if (action?.action === 'set_reserve_goal') {
      const target = Math.abs(parseFloat(action.target) || 0);
      if (target <= 0) { await sendText(from, 'Não entendi o valor da meta. Ex.: "meta de 20 mil na reserva". 🙏'); return res.status(200).json({ ok: true }); }
      try {
        const nm = await doSetReserveGoal(db, uid, target);
        await sessRef.set({ uid, history, pending: null }, { merge: true });
        await sendText(from, `Feito! Defini a meta da sua *${nm}* em *R$ ${money(target)}*. 🎯`);
      } catch (e) { console.error('WA set_reserve_goal:', e); await sendText(from, 'Não consegui definir a meta agora. Tenta de novo. 🙏'); }
      return res.status(200).json({ ok: true });
    }

    // 3c. Entrada avulsa — grava direto (dinheiro que entrou).
    if (action?.action === 'add_income') {
      const amount = Math.abs(parseFloat(action.amount) || 0);
      if (amount <= 0) { await sendText(from, 'Não entendi o valor que entrou. Ex.: "recebi 300 de freela". 🙏'); return res.status(200).json({ ok: true }); }
      try {
        await doAddIncome(db, uid, { description: action.description, amount });
        await sessRef.set({ uid, history, pending: null }, { merge: true });
        await sendText(from, `Boa! 💚 Registrei a entrada de *R$ ${money(amount)}*${action.description ? ` (${normName(action.description)})` : ''}.`);
      } catch (e) { console.error('WA add_income:', e); await sendText(from, 'Não consegui registrar a entrada agora. Tenta de novo. 🙏'); }
      return res.status(200).json({ ok: true });
    }

    // 3d. Nova recorrente (despesa ou entrada) — grava direto.
    if (action?.action === 'add_fixed_expense' || action?.action === 'add_fixed_income') {
      const kind = action.action === 'add_fixed_income' ? 'income' : 'expense';
      const value = Math.abs(parseFloat(action.value) || 0);
      if (value <= 0 || !action.name) { await sendText(from, 'Preciso do nome e do valor pra cadastrar. Ex.: "cadastra aluguel 1500 dia 10". 🙏'); return res.status(200).json({ ok: true }); }
      try {
        const cat = EXPENSE_CATS.includes(action.category) ? action.category : undefined;
        const r = await doAddFixed(db, uid, kind, { name: action.name, value, day: action.day, category: kind === 'expense' ? cat : undefined });
        await sessRef.set({ uid, history, pending: null }, { merge: true });
        await sendText(from, r.ok
          ? `Cadastrado! ✅ *${r.name}* virou uma ${kind === 'income' ? 'entrada' : 'despesa'} recorrente de *R$ ${money(value)}* (dia ${Math.min(31, Math.max(1, parseInt(action.day) || 5))}).`
          : 'Não consegui cadastrar agora. Tenta de novo. 🙏');
      } catch (e) { console.error('WA add_fixed:', e); await sendText(from, 'Não consegui cadastrar a recorrente agora. Tenta de novo. 🙏'); }
      return res.status(200).json({ ok: true });
    }

    // 3e. Baixa de recorrente do mês (pagar despesa fixa / confirmar recebimento).
    if (action?.action === 'baixa_recorrente') {
      const kind = action.kind === 'income' ? 'income' : 'expense';
      try {
        const r = await doBaixaRecorrente(db, uid, kind, action.name);
        await sessRef.set({ uid, history, pending: null }, { merge: true });
        if (r.ok) {
          await sendText(from, r.income
            ? `Recebimento confirmado! ✅ *${r.name}* (R$ ${money(r.amount)}) entrou no seu saldo.`
            : `Baixa registrada! ✅ Paguei *${r.name}* (R$ ${money(r.amount)}) — debitado do saldo.`);
        } else if (r.reason === 'already') {
          await sendText(from, r.income ? `A entrada *${r.name}* já foi confirmada neste mês. 👍` : `A conta *${r.name}* já foi baixada neste mês. 👍`);
        } else if (r.reason === 'notfound') {
          await sendText(from, `Não achei essa ${kind === 'income' ? 'entrada' : 'despesa'} recorrente cadastrada. Confere o nome ou cadastra primeiro. 🙏`);
        } else {
          await sendText(from, 'Não consegui dar baixa agora. Tenta de novo. 🙏');
        }
      } catch (e) { console.error('WA baixa_recorrente:', e); await sendText(from, 'Não consegui dar baixa agora. Tenta de novo. 🙏'); }
      return res.status(200).json({ ok: true });
    }

    // 3f. Gasto no CARTÃO — resolve o cartão e pede confirmação (SIM/NÃO).
    if (action?.action === 'add_card_expense') {
      const amount = Math.abs(parseFloat(action.amount) || 0);
      if (amount <= 0 || !action.description) { await sendText(from, 'Não entendi a compra no cartão. Ex.: "passei 200 no cartão do Nubank". 🙏'); return res.status(200).json({ ok: true }); }
      const card = await resolveCard(db, uid, action.cardName);
      if (!card) { await sendText(from, 'Você ainda não tem cartão cadastrado. Cadastre em *Cartões* no app e tente de novo. 🙏'); return res.status(200).json({ ok: true }); }
      const data = {
        description: String(action.description).slice(0, 120), amount,
        category: EXPENSE_CATS.includes(action.category) ? action.category : 'shopping',
        priority: PRIORITIES.includes(action.priority) ? action.priority : 'comfort',
        cardId: card.id, cardName: card.name,
      };
      await sessRef.set({ uid, history, pending: { type: 'card', data } }, { merge: true });
      await sendText(from, `Quer que eu lance esta compra no cartão *${card.name}*?\n\n• *${normName(data.description)}*\n• Valor: R$ ${money(amount)}\n\nResponda *SIM* para confirmar ou *NÃO* para cancelar.`);
      return res.status(200).json({ ok: true });
    }

    // 3g. Gasto avulso — pede confirmação (SIM/NÃO) antes de lançar.
    const expense = parseExpense(reply);
    if (expense) {
      await sessRef.set({ uid, history, pending: { type: 'expense', data: expense } }, { merge: true });
      await sendText(from, `Quer que eu registre este gasto?\n\n• *${expense.description}*\n• Valor: R$ ${money(expense.amount)}\n\nResponda *SIM* para confirmar ou *NÃO* para cancelar.`);
    } else {
      const newHistory = [...history, { role: 'user', text }, { role: 'model', text: reply }].slice(-12);
      await sessRef.set({ uid, history: newHistory, pending: null }, { merge: true });
      await sendText(from, reply);
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Erro no webhook WhatsApp:', e);
    // Responde 200 mesmo com erro para a Meta não ficar reenviando em loop.
    return res.status(200).json({ ok: false });
  }
}
