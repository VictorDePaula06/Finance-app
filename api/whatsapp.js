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
import { jsPDF } from 'jspdf';
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

// Rótulos pt-BR (espelha src/constants/categories.js) p/ a lista interativa do WhatsApp.
const CAT_LABELS = {
  housing: 'Casa', food: 'Alimentação', fast_food: 'Fast Food', transport: 'Transporte',
  health: 'Saúde', education: 'Educação', pets: 'Pets', personal_care: 'Cuidados',
  subscriptions: 'Assinaturas', credit_card: 'Cartão', church: 'Igreja', taxes: 'Taxas',
  leisure: 'Lazer', shopping: 'Compras', conta_fixa: 'Conta Fixa', other: 'Outro',
};
// Ordem preferida na lista (WhatsApp permite no máx. 10 linhas por lista).
const CAT_ORDER = ['food', 'fast_food', 'transport', 'health', 'shopping', 'leisure', 'subscriptions', 'housing', 'personal_care', 'education', 'pets', 'conta_fixa', 'church', 'taxes', 'other'];
const PRIO_LABELS = { essential: 'Essencial', comfort: 'Conforto', superfluous: 'Supérfluo' };

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

// Envia uma mensagem INTERATIVA (lista ou botões) pelo WhatsApp.
async function sendInteractive(to, interactive) {
  const pid = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  try {
    const resp = await fetch(`${GRAPH}/${pid}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'interactive', interactive }),
    });
    const t = await resp.text().catch(() => '');
    console.log(`WA interactive -> to=${to} status=${resp.status} resp=${t.slice(0, 200)}`);
  } catch (e) { console.error('Erro interactive WA:', e?.message || e); }
}

// Monta até 10 linhas de categoria, começando pela sugerida pela IA.
function catRows(suggested) {
  const ids = [];
  if (suggested && CAT_LABELS[suggested]) ids.push(suggested);
  for (const id of CAT_ORDER) { if (ids.length >= 10) break; if (!ids.includes(id)) ids.push(id); }
  if (!ids.includes('other')) ids[ids.length - 1] = 'other'; // garante "Outro"
  return ids.slice(0, 10).map(id => ({ id: `cat_${id}`, title: CAT_LABELS[id].slice(0, 24) }));
}

// Lista de categorias pra tocar.
async function sendCatList(to, bodyText, suggested) {
  await sendInteractive(to, {
    type: 'list',
    body: { text: bodyText.slice(0, 1024) },
    action: { button: 'Escolher categoria', sections: [{ title: 'Categorias', rows: catRows(suggested) }] },
  });
}

// Botões de prioridade (máx. 3 — cabe certinho).
async function sendPrioButtons(to, bodyText) {
  await sendInteractive(to, {
    type: 'button',
    body: { text: bodyText.slice(0, 1024) },
    action: { buttons: [
      { type: 'reply', reply: { id: 'prio_essential', title: 'Essencial' } },
      { type: 'reply', reply: { id: 'prio_comfort', title: 'Conforto' } },
      { type: 'reply', reply: { id: 'prio_superfluous', title: 'Supérfluo' } },
    ] },
  });
}

// Interpreta a categoria escolhida (id do toque OU texto digitado).
function pickCat(selId, text) {
  if (selId && selId.startsWith('cat_')) { const id = selId.slice(4); return CAT_LABELS[id] ? id : null; }
  const q = String(text || '').toLowerCase().trim();
  if (!q) return null;
  for (const [id, label] of Object.entries(CAT_LABELS)) {
    const l = label.toLowerCase();
    if (l === q || l.includes(q) || q.includes(l)) return id;
  }
  return null;
}

// Interpreta a prioridade escolhida (id do toque OU texto digitado).
function pickPrio(selId, text) {
  if (selId && selId.startsWith('prio_')) { const id = selId.slice(5); return PRIO_LABELS[id] ? id : null; }
  const q = String(text || '').toLowerCase();
  if (/essenc/.test(q)) return 'essential';
  if (/confort/.test(q)) return 'comfort';
  if (/sup[eé]rfl|superfl/.test(q)) return 'superfluous';
  return null;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const monthLabel = (mk) => { const [y, m] = mk.split('-').map(Number); return `${MESES[m - 1]}/${y}`; };
// Categorias que NÃO contam como gasto de consumo no relatório (espelha o app).
const NON_CONSUMO = ['investment', 'vault', 'credit_card_bill'];

// Gera um RELATÓRIO com valores REAIS (o app pode citar números aqui — é o pedido).
// type: category | priority | overview ; period: this_month | last_month
async function buildReport(db, uid, type = 'overview', period = 'this_month') {
  const now = new Date();
  const mk = period === 'last_month'
    ? new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7)
    : now.toISOString().slice(0, 7);
  const num = (v) => parseFloat(v) || 0;
  const snap = await db.collection('transactions').where('userId', '==', uid).get();
  const txs = snap.docs.map(d => d.data()).filter(t => (t.month || String(t.date || '').slice(0, 7)) === mk);

  const gastos = txs.filter(t => t.type === 'expense' && !NON_CONSUMO.includes(t.category) && !t.reserveInternal);
  const totalGasto = gastos.reduce((a, t) => a + num(t.amount), 0);
  const pct = (v) => totalGasto > 0 ? Math.round((v / totalGasto) * 100) : 0;
  const label = monthLabel(mk);

  if (type === 'category') {
    if (!gastos.length) return `📊 *Gastos por categoria — ${label}*\n\nAinda não há gastos registrados neste mês. 🙂`;
    const byCat = {};
    gastos.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + num(t.amount); });
    const lines = Object.entries(byCat).sort((a, b) => b[1] - a[1])
      .map(([c, v]) => `• ${CAT_LABELS[c] || c}: *R$ ${money(v)}* (${pct(v)}%)`);
    return `📊 *Gastos por categoria — ${label}*\n\n${lines.join('\n')}\n——\nTotal: *R$ ${money(totalGasto)}*`;
  }

  if (type === 'priority') {
    if (!gastos.length) return `📊 *Gastos por prioridade — ${label}*\n\nAinda não há gastos registrados neste mês. 🙂`;
    const P = { essential: 0, comfort: 0, superfluous: 0 };
    gastos.forEach(t => { P[t.priority] = (P[t.priority] || 0) + num(t.amount); });
    const emoji = { essential: '🟢', comfort: '🟡', superfluous: '🔴' };
    const lines = ['essential', 'comfort', 'superfluous']
      .map(k => `${emoji[k]} ${PRIO_LABELS[k]}: *R$ ${money(P[k])}* (${pct(P[k])}%)`);
    return `📊 *Gastos por prioridade — ${label}*\n\n${lines.join('\n')}\n——\nTotal: *R$ ${money(totalGasto)}*`;
  }

  if (type === 'installments') {
    const subSnap = await db.collection('subscriptions').where('userId', '==', uid).get();
    const inst = subSnap.docs.map(d => d.data())
      .filter(s => s.isInstallment || s.type === 'installment')
      .map(s => {
        const parcela = num(s.value);
        const total = s.totalInstallments || 1;
        const paga = Math.max(0, (s.currentInstallment || 1) - 1);
        const restam = Math.max(0, total - paga);
        return { name: s.name || 'Parcelamento', parcela, total, paga, restam, restanteValor: parcela * restam };
      })
      .sort((a, b) => b.restanteValor - a.restanteValor);
    if (!inst.length) return '💳 Você não tem parcelamentos ativos no cartão. 🙂';
    const mensal = inst.reduce((a, p) => a + p.parcela, 0);
    const restante = inst.reduce((a, p) => a + p.restanteValor, 0);
    const lines = inst.map(p => `• ${p.name} (${p.paga}/${p.total}): R$ ${money(p.parcela)}/mês · faltam ${p.restam}x = R$ ${money(p.restanteValor)}`);
    return [
      `💳 *Parcelamentos no cartão*`,
      ``,
      `📅 Comprometido por mês: *R$ ${money(mensal)}*`,
      `💰 Total ainda a pagar (tudo somado): *R$ ${money(restante)}*`,
      ``,
      ...lines,
    ].join('\n');
  }

  // overview (resumo geral)
  const entradas = txs.filter(t => t.type === 'income' && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category))
    .reduce((a, t) => a + num(t.amount), 0);
  const saldo = entradas - totalGasto;
  const byCat = {};
  gastos.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + num(t.amount); });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([c, v]) => `• ${CAT_LABELS[c] || c}: R$ ${money(v)}`);
  let reserva = 0;
  try { const js = await db.collection('savings_jars').where('userId', '==', uid).get(); reserva = js.docs.reduce((a, d) => a + num(d.data().balance), 0); } catch { /* ignore */ }
  return [
    `📊 *Resumo de ${label}*`,
    ``,
    `💚 Entradas: *R$ ${money(entradas)}*`,
    `💸 Saídas: *R$ ${money(totalGasto)}*`,
    `${saldo >= 0 ? '💰' : '⚠️'} Saldo do mês: *R$ ${money(saldo)}*`,
    ...(top.length ? [``, `Maiores gastos:`, ...top] : []),
    ``,
    `🏦 Reserva: *R$ ${money(reserva)}*`,
  ].join('\n');
}

// Mês da fatura de uma compra (igual ao app: o dia do fechamento ainda pertence à fatura).
function invoiceMonthOf(dateStr, closingDay) {
  const d = new Date(dateStr); const day = d.getDate();
  let m = d.getMonth(), y = d.getFullYear();
  if (day > closingDay) { m += 1; if (m > 11) { m = 0; y += 1; } }
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

// ── SALDO EM CARTEIRA (espelha buildWalletLedger do app) ──────────────────
const isResetTx = (t) => t?.category === 'initial_balance' || t?.category === 'carryover';
const isPatrimonioReserveTx = (t) => t?.source === 'patrimonio' || /^(Criação de Reserva|Aporte Reserva|Resgate|Ajuste Reserva):/.test(t?.description || '');
const isDebtPaymentTx = (t) => t?.source === 'debt' || /^Pagamento de dívida:/.test(t?.description || '');
// Afeta o caixa real? Compra no crédito NÃO (só ao pagar a fatura); reserva de
// Patrimônio e pagamento de dívida também NÃO descontam da carteira.
const walletAffecting = (t) => {
  if (!t) return false;
  if (t.paymentMethod === 'credito') return false;
  if (isPatrimonioReserveTx(t)) return false;
  if (isDebtPaymentTx(t)) return false;
  return t.type === 'income' || t.type === 'expense';
};
function walletBalance(transactions) {
  const getMonth = (t) => t.month || (t.date ? String(t.date).slice(0, 7) : '');
  const all = transactions.filter(t => getMonth(t) !== '').sort((a, b) => {
    const dayA = (a.date || '').slice(0, 10), dayB = (b.date || '').slice(0, 10);
    if (dayA !== dayB) return dayA < dayB ? -1 : 1;
    const cA = a.createdAt || new Date(a.date).getTime() || 0;
    const cB = b.createdAt || new Date(b.date).getTime() || 0;
    return cA - cB;
  });
  let running = 0;
  for (const t of all) {
    const val = parseFloat(t.amount) || 0;
    if (isResetTx(t)) { running = t.type === 'expense' ? -val : val; continue; }
    if (walletAffecting(t)) running += (t.type === 'income' ? val : -val);
  }
  return running;
}

// Resposta: saldo em carteira + próximo compromisso (fatura de cartão a vencer).
async function buildWalletAnswer(db, uid) {
  const num = (v) => parseFloat(v) || 0;
  const R = (v) => `R$ ${money(v)}`;
  const [txSnap, cardSnap, subSnap] = await Promise.all([
    db.collection('transactions').where('userId', '==', uid).get(),
    db.collection('cards').where('userId', '==', uid).get(),
    db.collection('subscriptions').where('userId', '==', uid).get(),
  ]);
  const txs = txSnap.docs.map(d => d.data());
  const saldo = walletBalance(txs);
  const cards = cardSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const subs = subSnap.docs.map(d => d.data());
  const unpaid = txs.filter(t => t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid');
  const now = new Date();
  const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = null;
  cards.forEach(c => {
    if (!c.dueDay) return;
    const closingDay = c.closingDay || ((c.dueDay - 7 > 0) ? c.dueDay - 7 : 25);
    const cur = invoiceMonthOf(now.toISOString(), closingDay);
    const atual = unpaid.filter(t => t.selectedCardId === c.id && invoiceMonthOf(t.date || now.toISOString(), closingDay) === cur).reduce((a, t) => a + num(t.amount), 0)
      + subs.filter(s => s.cardId === c.id).reduce((a, s) => a + num(s.value), 0);
    if (atual <= 0.005) return;
    let due = new Date(now.getFullYear(), now.getMonth(), c.dueDay);
    if (due < hoje) due = new Date(now.getFullYear(), now.getMonth() + 1, c.dueDay);
    if (!next || due < next.due) next = { name: c.name || c.bank || 'Cartão', due, amount: atual };
  });
  const lines = [`💰 Seu saldo em carteira é *${R(saldo)}*${saldo < 0 ? ' (está negativo ⚠️)' : ''}.`];
  if (next) {
    const dd = `${String(next.due.getDate()).padStart(2, '0')}/${String(next.due.getMonth() + 1).padStart(2, '0')}`;
    const dias = Math.round((next.due - hoje) / 86400000);
    lines.push('', `📅 Próximo compromisso: fatura do *${next.name}*, vence em *${dd}*${dias >= 0 ? ` (em ${dias} dia${dias === 1 ? '' : 's'})` : ''} — *${R(next.amount)}*.`);
  } else {
    lines.push('', 'Você não tem fatura de cartão em aberto no momento. 👍');
  }
  return lines.join('\n');
}

// Resposta DETERMINÍSTICA sobre dívidas. Dívida = (1) cadastrada em "debts" ou
// nos recorrentes (categoria dívida), ou (2) fatura de cartão VENCIDA (meses
// anteriores não pagos). Parcelamento em dia e fatura atual NÃO são dívida.
async function buildDebtsAnswer(db, uid) {
  const num = (v) => parseFloat(v) || 0;
  const [debtSnap, fixSnap, txSnap, cardSnap] = await Promise.all([
    db.collection('debts').where('userId', '==', uid).get(),
    db.collection('fixed_expenses').where('userId', '==', uid).get(),
    db.collection('transactions').where('userId', '==', uid).get(),
    db.collection('cards').where('userId', '==', uid).get(),
  ]);
  // 1. Dívidas cadastradas (módulo Dívidas)
  const debts = debtSnap.docs.map(d => d.data()).filter(d => !d.paidOff && num(d.remainingAmount) > 0.005);
  const debtsTotal = debts.reduce((a, d) => a + num(d.remainingAmount), 0);
  // 1b. Dívidas cadastradas como recorrente (categoria "divida")
  const recDiv = fixSnap.docs.map(d => d.data()).filter(f => f.category === 'divida');
  // 2. Faturas de cartão VENCIDAS (fatura de mês anterior ainda não paga)
  const txUnpaid = txSnap.docs.map(d => d.data()).filter(t => t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid');
  let overdueTotal = 0; const overdueCards = [];
  cardSnap.docs.forEach(cd => {
    const c = cd.data();
    const closingDay = c.closingDay || ((c.dueDay - 7 > 0) ? c.dueDay - 7 : 25);
    const cur = invoiceMonthOf(new Date().toISOString(), closingDay);
    const over = txUnpaid.filter(t => t.selectedCardId === cd.id && invoiceMonthOf(t.date || new Date().toISOString(), closingDay) < cur);
    const tot = over.reduce((a, t) => a + num(t.amount), 0);
    if (tot > 0.005) { overdueTotal += tot; overdueCards.push({ name: c.name || c.bank || 'Cartão', total: tot }); }
  });

  const explicacao = 'O que conta como dívida:\n• O que você cadastrou como dívida (empréstimo, financiamento, etc.)\n• Fatura de cartão *vencida* (não paga no prazo)\n\n_Parcelamento em dia e a fatura atual do cartão (ainda no prazo) não são dívida — são compras que você ainda vai pagar normalmente._';

  const has = debtsTotal > 0.005 || recDiv.length > 0 || overdueTotal > 0.005;
  if (!has) {
    return `Não, você *não tem dívidas* registradas. 🙌\n\n${explicacao}`;
  }
  const parts = ['Sim, você tem dívidas registradas:', ''];
  if (debtsTotal > 0.005) { parts.push(`💳 Dívidas cadastradas: *R$ ${money(debtsTotal)}*`); debts.forEach(d => parts.push(`• ${d.name || 'Dívida'}: R$ ${money(d.remainingAmount)}`)); parts.push(''); }
  if (recDiv.length) { parts.push('📌 Dívidas nos recorrentes:'); recDiv.forEach(f => parts.push(`• ${f.name || 'Dívida'}: R$ ${money(f.value)}/mês`)); parts.push(''); }
  if (overdueTotal > 0.005) { parts.push(`⚠️ Fatura(s) de cartão *vencida(s)*: *R$ ${money(overdueTotal)}*`); overdueCards.forEach(c => parts.push(`• ${c.name}: R$ ${money(c.total)}`)); parts.push(''); }
  parts.push('_Obs.: parcelamento em dia e a fatura atual (ainda no prazo) não entram como dívida._');
  return parts.join('\n');
}

// Monta um RESUMO FINANCEIRO REAL (com valores) para a Alívia responder direto.
async function buildUserContext(db, uid) {
  const mk = new Date().toISOString().slice(0, 7);
  const num = (v) => parseFloat(v) || 0;
  const R = (v) => `R$ ${money(v)}`;
  try {
    const [txSnap, jarSnap, subSnap, fixSnap, goalSnap] = await Promise.all([
      db.collection('transactions').where('userId', '==', uid).get(),
      db.collection('savings_jars').where('userId', '==', uid).get(),
      db.collection('subscriptions').where('userId', '==', uid).get(),
      db.collection('fixed_expenses').where('userId', '==', uid).get(),
      db.collection('expense_goals').where('userId', '==', uid).get(),
    ]);
    const txAll = txSnap.docs.map(d => d.data());
    const txMk = (t) => t.month || String(t.date || '').slice(0, 7);
    const consumo = (t) => t.type === 'expense' && !['credit_card_bill', 'vault', 'investment'].includes(t.category) && !t.reserveInternal;
    const realInc = (t) => t.type === 'income' && !['vault_redemption', 'initial_balance', 'carryover'].includes(t.category);

    const txM = txAll.filter(t => txMk(t) === mk);
    const entradas = txM.filter(realInc).reduce((a, t) => a + num(t.amount), 0);
    const gastos = txM.filter(consumo);
    const saidas = gastos.reduce((a, t) => a + num(t.amount), 0);
    const essential = gastos.filter(t => t.priority === 'essential').reduce((a, t) => a + num(t.amount), 0);
    const superf = gastos.filter(t => t.priority === 'superfluous').reduce((a, t) => a + num(t.amount), 0);

    const byCat = {}; gastos.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + num(t.amount); });
    const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, v]) => `${CAT_LABELS[c] || c} ${R(v)}`);

    const reserva = jarSnap.docs.reduce((a, d) => a + num(d.data().balance), 0);

    const subs = subSnap.docs.map(d => d.data());
    const recorr = fixSnap.docs.reduce((a, d) => a + num(d.data().value), 0);
    const assinaturas = subs.filter(s => !(s.isInstallment || s.type === 'installment')).reduce((a, s) => a + num(s.value), 0);
    const parcelaMes = subs.filter(s => s.isInstallment || s.type === 'installment').reduce((a, s) => a + num(s.value), 0);
    const custoFixo = recorr + assinaturas + parcelaMes;
    // Total ainda a pagar em parcelamentos (parcela × parcelas restantes).
    const parcelasRestante = subs.filter(s => s.isInstallment || s.type === 'installment').reduce((a, s) => {
      const total = s.totalInstallments || 1; const paga = Math.max(0, (s.currentInstallment || 1) - 1);
      return a + num(s.value) * Math.max(0, total - paga);
    }, 0);
    const faturaAberta = txAll.filter(t => t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid').reduce((a, t) => a + num(t.amount), 0)
      + subs.filter(s => s.cardId).reduce((a, s) => a + num(s.value), 0);

    const goals = goalSnap.docs.map(d => d.data()).map(g => g.name || 'meta');
    const saldoMes = entradas - saidas;
    const saldoCarteira = walletBalance(txAll);

    return [
      `RESUMO FINANCEIRO REAL — mês ${monthLabel(mk)} (use SOMENTE estes números; nunca invente outros):`,
      `- Saldo em carteira (dinheiro disponível hoje, acumulado): ${R(saldoCarteira)}`,
      `- Entradas do mês: ${R(entradas)}`,
      `- Saídas (gastos) do mês: ${R(saidas)}  | essenciais ${R(essential)}, supérfluos ${R(superf)}`,
      `- Saldo do mês: ${R(saldoMes)} (${saldoMes >= 0 ? 'positivo' : 'negativo'})`,
      `- Maiores gastos: ${topCats.length ? topCats.join(', ') : 'nenhum ainda'}`,
      `- Reserva de emergência: ${R(reserva)}`,
      `- Custo fixo mensal: ${R(custoFixo)} (recorrentes ${R(recorr)}, assinaturas ${R(assinaturas)}, parcelas ${R(parcelaMes)}/mês)`,
      `- Parcelamentos no cartão: comprometido POR MÊS ${R(parcelaMes)}; TOTAL ainda a pagar somando todas as parcelas restantes ${R(parcelasRestante)} (são coisas DIFERENTES — informe os dois)`,
      `- Fatura do cartão em aberto: ${R(faturaAberta)}`,
      `- Metas cadastradas: ${goals.length ? goals.join(', ') : 'nenhuma'}`,
    ].join('\n');
  } catch (e) {
    console.error('Erro no contexto:', e);
    return 'Sem dados suficientes para análise detalhada no momento.';
  }
}

// ── RELATÓRIOS EM PDF (espelha a aba "Análises" do app) ───────────────────
// Lista de relatórios visuais disponíveis (mesmos nomes/ordem da aba Análises).
const ANALYSES = [
  { id: 'categorias', label: 'Gastos por categoria', grupo: 'Análises' },
  { id: 'evolucao', label: 'Evolução mensal', grupo: 'Análises' },
  { id: 'custo_fixo', label: 'Custo fixo mensal', grupo: 'Análises' },
  { id: 'prioridade', label: 'Essencial × Supérfluo', grupo: 'Análises' },
  { id: 'pagamento', label: 'Formas de pagamento', grupo: 'Análises' },
  { id: 'comparativo', label: 'Comparativo de meses', grupo: 'Análises' },
  { id: 'cartao_categoria', label: 'Fatura por categoria', grupo: 'Cartão de crédito' },
  { id: 'cartao_limite', label: 'Uso do limite', grupo: 'Cartão de crédito' },
  { id: 'cartao_parcelas', label: 'Parcelas & comprometimento', grupo: 'Cartão de crédito' },
];
const ANALYSIS_LABEL = Object.fromEntries(ANALYSES.map(a => [a.id, a.label]));
const PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#ec4899', '#84cc16', '#a855f7', '#f97316', '#14b8a6', '#eab308'];
const PRIO_HEX = { essential: '#10b981', comfort: '#f59e0b', superfluous: '#f43f5e' };
const PAG_LABELS = { pix: 'PIX', debito: 'Débito', credito: 'Crédito', dinheiro: 'Dinheiro', boleto: 'Boleto' };
const PAG_HEX = { pix: '#10b981', debito: '#3b82f6', credito: '#8b5cf6', dinheiro: '#f59e0b', boleto: '#06b6d4' };
const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const hexRgb = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

// Puxa de uma vez tudo que os relatórios precisam.
async function fetchAll(db, uid) {
  const [txS, cardS, subS, fixS] = await Promise.all([
    db.collection('transactions').where('userId', '==', uid).get(),
    db.collection('cards').where('userId', '==', uid).get(),
    db.collection('subscriptions').where('userId', '==', uid).get(),
    db.collection('fixed_expenses').where('userId', '==', uid).get(),
  ]);
  return {
    tx: txS.docs.map(d => ({ id: d.id, ...d.data() })),
    cards: cardS.docs.map(d => ({ id: d.id, ...d.data() })),
    subs: subS.docs.map(d => ({ id: d.id, ...d.data() })),
    fix: fixS.docs.map(d => d.data()),
  };
}

// Monta a "especificação" do relatório (título + itens de barra) a partir dos dados.
function buildReportSpec(id, data) {
  const num = (v) => parseFloat(v) || 0;
  const now = new Date();
  const mk = now.toISOString().slice(0, 7);
  const txMk = (t) => t.month || String(t.date || '').slice(0, 7);
  const consumo = (t) => t.type === 'expense' && !['credit_card_bill', 'vault', 'investment'].includes(t.category) && !t.reserveInternal;
  const realInc = (t) => t.type === 'income' && !['vault_redemption', 'initial_balance', 'carryover'].includes(t.category);
  const txM = data.tx.filter(t => txMk(t) === mk);
  const base = { filename: `Alivia-${id}`, title: ANALYSIS_LABEL[id] || 'Relatório', subtitle: monthLabel(mk) };
  const pctOf = (v, tot) => tot > 0 ? Math.round(v / tot * 100) : 0;

  if (id === 'categorias') {
    const g = {}; txM.filter(consumo).forEach(t => { g[t.category] = (g[t.category] || 0) + num(t.amount); });
    const tot = Object.values(g).reduce((a, b) => a + b, 0);
    if (!tot) return { empty: `📊 Ainda não há gastos em ${monthLabel(mk)} pra montar esse relatório. 🙂` };
    const items = Object.entries(g).sort((a, b) => b[1] - a[1]).map(([c, v], i) => ({ label: CAT_LABELS[c] || c, value: v, color: PALETTE[i % PALETTE.length], pct: pctOf(v, tot) }));
    return { ...base, items, total: tot };
  }

  if (id === 'prioridade') {
    const P = { essential: 0, comfort: 0, superfluous: 0 }; txM.filter(consumo).forEach(t => { P[t.priority] = (P[t.priority] || 0) + num(t.amount); });
    const tot = P.essential + P.comfort + P.superfluous;
    if (!tot) return { empty: `📊 Ainda não há gastos em ${monthLabel(mk)} pra montar esse relatório. 🙂` };
    const items = ['essential', 'comfort', 'superfluous'].map(k => ({ label: PRIO_LABELS[k], value: P[k], color: PRIO_HEX[k], pct: pctOf(P[k], tot) }));
    return { ...base, items, total: tot };
  }

  if (id === 'pagamento') {
    const m = {}; txM.filter(t => t.type === 'expense' && t.category !== 'credit_card_bill').forEach(t => { const p = t.paymentMethod || 'pix'; m[p] = (m[p] || 0) + num(t.amount); });
    const tot = Object.values(m).reduce((a, b) => a + b, 0);
    if (!tot) return { empty: `📊 Ainda não há gastos em ${monthLabel(mk)} pra montar esse relatório. 🙂` };
    const items = Object.entries(m).sort((a, b) => b[1] - a[1]).map(([p, v]) => ({ label: PAG_LABELS[p] || p, value: v, color: PAG_HEX[p] || '#64748b', pct: pctOf(v, tot) }));
    return { ...base, items, total: tot };
  }

  if (id === 'evolucao') {
    const items = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const inc = data.tx.filter(t => txMk(t) === key && realInc(t)).reduce((a, t) => a + num(t.amount), 0);
      const exp = data.tx.filter(t => txMk(t) === key && consumo(t)).reduce((a, t) => a + num(t.amount), 0);
      const ml = MESES_ABREV[d.getMonth()];
      items.push({ label: `${ml} · Entradas`, value: inc, color: '#10b981' });
      items.push({ label: `${ml} · Saídas`, value: exp, color: '#f43f5e' });
    }
    return { ...base, subtitle: 'Últimos 6 meses', items };
  }

  if (id === 'comparativo') {
    const pd = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const pk = pd.toISOString().slice(0, 7);
    const calc = (key) => ({
      inc: data.tx.filter(t => txMk(t) === key && realInc(t)).reduce((a, t) => a + num(t.amount), 0),
      exp: data.tx.filter(t => txMk(t) === key && consumo(t)).reduce((a, t) => a + num(t.amount), 0),
    });
    const cur = calc(mk), prev = calc(pk);
    const items = [
      { label: `${monthLabel(pk)} · Entradas`, value: prev.inc, color: '#10b981' },
      { label: `${monthLabel(pk)} · Saídas`, value: prev.exp, color: '#f43f5e' },
      { label: `${monthLabel(mk)} · Entradas`, value: cur.inc, color: '#10b981' },
      { label: `${monthLabel(mk)} · Saídas`, value: cur.exp, color: '#f43f5e' },
    ];
    return { ...base, subtitle: `${monthLabel(mk)} vs ${monthLabel(pk)}`, items };
  }

  if (id === 'custo_fixo') {
    const rec = data.fix.reduce((a, f) => a + num(f.value), 0);
    const ass = data.subs.filter(s => !(s.isInstallment || s.type === 'installment')).reduce((a, s) => a + num(s.value), 0);
    const parc = data.subs.filter(s => s.isInstallment || s.type === 'installment').reduce((a, s) => a + num(s.value), 0);
    const tot = rec + ass + parc;
    if (!tot) return { empty: '📊 Você ainda não tem contas fixas, assinaturas ou parcelas cadastradas. 🙂' };
    const items = [
      { label: 'Recorrentes', value: rec, color: '#f59e0b', pct: pctOf(rec, tot) },
      { label: 'Assinaturas', value: ass, color: '#8b5cf6', pct: pctOf(ass, tot) },
      { label: 'Parcelas', value: parc, color: '#3b82f6', pct: pctOf(parc, tot) },
    ];
    return { ...base, subtitle: 'Comprometimento mensal', items, total: tot };
  }

  // ── Cartão ──
  const creditoAberto = data.tx.filter(t => t.paymentMethod === 'credito' && t.invoiceStatus === 'unpaid');
  const subsCartao = data.subs.filter(s => s.cardId);

  if (id === 'cartao_categoria') {
    const m = {};
    creditoAberto.forEach(t => { const c = t.category || 'other'; m[c] = (m[c] || 0) + num(t.amount); });
    subsCartao.forEach(s => { const isInst = s.isInstallment || s.type === 'installment'; const c = s.category || (isInst ? 'shopping' : 'subscriptions'); m[c] = (m[c] || 0) + num(s.value); });
    const tot = Object.values(m).reduce((a, b) => a + b, 0);
    if (!tot) return { empty: '📊 Não há fatura de cartão em aberto pra montar esse relatório. 🙂' };
    const items = Object.entries(m).sort((a, b) => b[1] - a[1]).map(([c, v], i) => ({ label: CAT_LABELS[c] || c, value: v, color: PALETTE[i % PALETTE.length], pct: pctOf(v, tot) }));
    return { ...base, subtitle: 'Fatura em aberto', items, total: tot };
  }

  if (id === 'cartao_limite') {
    if (!data.cards.length) return { empty: '📊 Você ainda não tem cartões cadastrados. 🙂' };
    const items = data.cards.map(c => {
      const usado = creditoAberto.filter(t => t.selectedCardId === c.id).reduce((a, t) => a + num(t.amount), 0)
        + subsCartao.filter(s => s.cardId === c.id).reduce((a, s) => a + num(s.value), 0);
      const limite = num(c.limit);
      const pct = limite ? Math.min(100, Math.round(usado / limite * 100)) : 0;
      const color = pct >= 80 ? '#f43f5e' : pct >= 50 ? '#f59e0b' : '#10b981';
      return { label: c.name || c.bank || 'Cartão', value: pct, color, valueText: `R$ ${money(usado)} / ${money(limite)} (${pct}%)` };
    }).sort((a, b) => b.value - a.value);
    return { ...base, subtitle: 'Uso do limite por cartão', items, scaleMax: 100 };
  }

  if (id === 'cartao_parcelas') {
    const list = data.subs.filter(s => (s.isInstallment || s.type === 'installment') && s.cardId).map(s => {
      const total = s.totalInstallments || 1;
      const paga = Math.max(0, (s.currentInstallment || 1) - 1);
      const restam = Math.max(0, total - paga);
      const parcela = num(s.value);
      return { label: s.name || 'Parcelamento', value: parcela * restam, color: '#3b82f6', valueText: `R$ ${money(parcela)}/mês · restam ${restam}x` };
    }).sort((a, b) => b.value - a.value);
    if (!list.length) return { empty: '📊 Você não tem parcelamentos ativos no cartão. 🙂' };
    const mensal = data.subs.filter(s => s.isInstallment || s.type === 'installment').reduce((a, s) => a + num(s.value), 0);
    return { ...base, subtitle: `R$ ${money(mensal)}/mês em parcelas`, items: list };
  }

  return { empty: 'Relatório não reconhecido.' };
}

// Desenha o PDF (barras horizontais) e devolve um Buffer.
function renderReportPdf(spec) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = 595, M = 40;
  doc.setFillColor(16, 185, 129); doc.rect(0, 0, W, 68, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text('Alívia', M, 30);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(13); doc.text(spec.title, M, 50);
  doc.setTextColor(130, 130, 130); doc.setFontSize(9);
  doc.text(`${spec.subtitle || ''}   ·   Gerado em ${new Date().toLocaleString('pt-BR')}`, M, 86);

  const labelW = 160, barX = M + labelW, barMaxW = W - M - barX - 130;
  const scaleMax = spec.scaleMax || Math.max(...spec.items.map(i => i.value), 1);
  let y = 110;
  for (const it of spec.items) {
    if (y > 800) { doc.addPage(); y = 50; }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(50, 50, 50);
    const lbl = it.label.length > 26 ? it.label.slice(0, 25) + '…' : it.label;
    doc.text(lbl, M, y + 10);
    const w = Math.max(2, (it.value / scaleMax) * barMaxW);
    const [r, g, b] = hexRgb(it.color); doc.setFillColor(r, g, b); doc.roundedRect(barX, y, w, 13, 2, 2, 'F');
    doc.setTextColor(90, 90, 90); doc.setFontSize(9);
    const vt = it.valueText || (`R$ ${money(it.value)}` + (it.pct != null ? `  (${it.pct}%)` : ''));
    doc.text(vt, barX + w + 6, y + 10);
    y += 24;
  }
  if (spec.total != null) {
    y += 6; doc.setDrawColor(220, 220, 220); doc.line(M, y, W - M, y); y += 18;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 30, 30);
    doc.text(`Total: R$ ${money(spec.total)}`, M, y);
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(170, 170, 170);
  doc.text('Gerado pela Alívia · soualivia.com.br', M, 828);
  return Buffer.from(doc.output('arraybuffer'));
}

// Faz upload do PDF pra Meta e envia como documento no WhatsApp.
async function sendPdf(to, buffer, filename, caption) {
  const pid = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  try {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'application/pdf');
    form.append('file', new Blob([buffer], { type: 'application/pdf' }), filename);
    const up = await fetch(`${GRAPH}/${pid}/media`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    const uj = await up.json().catch(() => ({}));
    if (!uj.id) { console.error('WA media upload falhou:', JSON.stringify(uj).slice(0, 300)); return false; }
    const resp = await fetch(`${GRAPH}/${pid}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'document', document: { id: uj.id, filename, caption: (caption || '').slice(0, 900) } }),
    });
    const t = await resp.text().catch(() => '');
    console.log(`WA pdf -> to=${to} status=${resp.status} resp=${t.slice(0, 200)}`);
    return resp.ok;
  } catch (e) { console.error('WA sendPdf erro:', e?.message || e); return false; }
}

// Lista tocável dos relatórios disponíveis (agrupada como na aba Análises).
async function sendReportList(to) {
  const grupos = [...new Set(ANALYSES.map(a => a.grupo))];
  const sections = grupos.map(gr => ({
    title: gr.slice(0, 24),
    rows: ANALYSES.filter(a => a.grupo === gr).map(a => ({ id: `rep_${a.id}`, title: a.label.slice(0, 24) })),
  }));
  await sendInteractive(to, {
    type: 'list',
    body: { text: 'Relatórios em *gráfico/PDF* são os mesmos da aba *Análises* do app Alívia 📊\n\nToque pra escolher qual você quer que eu gere em PDF:' },
    action: { button: 'Ver relatórios', sections },
  });
}

// Interpreta a escolha do relatório (toque OU texto/número).
function pickReport(selId, text) {
  if (selId && selId.startsWith('rep_')) { const id = selId.slice(4); return ANALYSIS_LABEL[id] ? id : null; }
  const q = String(text || '').toLowerCase().trim();
  if (!q) return null;
  const n = parseInt(q, 10);
  if (!isNaN(n) && n >= 1 && n <= ANALYSES.length) return ANALYSES[n - 1].id;
  const hit = ANALYSES.find(a => a.label.toLowerCase().includes(q) || q.includes(a.label.toLowerCase()));
  return hit ? hit.id : null;
}

// Gera o relatório escolhido e envia (PDF, ou texto amigável se não houver dados).
async function generateAndSendPdf(db, from, uid, id) {
  try {
    await sendText(from, `Gerando *${ANALYSIS_LABEL[id] || 'relatório'}* em PDF... 📄`);
    const data = await fetchAll(db, uid);
    const spec = buildReportSpec(id, data);
    if (spec.empty) { await sendText(from, spec.empty); return; }
    const buf = renderReportPdf(spec);
    const ok = await sendPdf(from, buf, `${spec.filename}.pdf`, `📊 ${spec.title} — ${spec.subtitle}`);
    if (!ok) await sendText(from, 'Consegui montar o relatório, mas falhou ao enviar o PDF. Tenta de novo em instantes. 🙏');
  } catch (e) { console.error('WA generatePdf:', e); await sendText(from, 'Não consegui gerar o PDF agora. Tenta de novo. 🙏'); }
}

const SYSTEM = `Você é a **Alívia**, assistente financeira acolhedora, respondendo pelo WhatsApp.
REGRAS:
- RESPONDA A PERGUNTA DE FORMA DIRETA E CURTA (1 a 3 frases). Nada de textão.
- Pode e DEVE citar os valores do "RESUMO FINANCEIRO REAL" abaixo quando a pergunta for sobre dados (ex.: "quanto tenho preso em parcelamento?" → responda com o valor de "total ainda a pagar").
- NUNCA invente números que não estejam no resumo. Se o dado exato não estiver lá, diga em UMA frase que pode gerar um relatório detalhado (aba Análises) e ofereça — não enrole.
- NÃO puxe assunto de reserva/metas a menos que a pessoa pergunte. Sem sermão, sem "vamos juntas nessa".
- Simpática e objetiva. Emojis com muita moderação (no máximo 1).

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
9) EXCLUIR/estornar um lançamento — ex.: "exclui esse pix", "apaga o último gasto",
   "remove a compra do mercado", "cancela aquele lançamento":
   {"action":"delete_transaction","description":"<nome do lançamento, ou vazio p/ o último>"}
10) RELATÓRIO/resumo com valores (em TEXTO) — ex.: "me gera um relatório dos gastos por categoria",
   "quanto gastei esse mês", "resumo do mês", "gastos por prioridade", "relatório do mês passado":
   {"action":"report","type":"<category|priority|overview|installments>","period":"<this_month|last_month>"}
   Use type=category p/ "por categoria", type=priority p/ "essencial/conforto/supérfluo",
   type=overview p/ resumo geral (entradas/saídas/saldo), type=installments p/ QUALQUER pergunta
   sobre PARCELAMENTO/PARCELAS do cartão (quanto por mês e o total ainda a pagar).
   period=last_month só se pedir mês passado.
11) RELATÓRIO em GRÁFICO / BARRAS / PDF / visual — ex.: "quero em pdf", "manda em gráfico",
   "relatório de barras", "gera um gráfico dos meus gastos":
   {"action":"report_pdf"}
   (O app vai listar os relatórios da aba Análises pra pessoa escolher e mandar o PDF.)
12) LISTAR recorrentes cadastradas — ex.: "liste minhas despesas recorrentes", "quais minhas
   contas fixas", "minhas entradas recorrentes", "o que eu tenho de recorrente":
   {"action":"list_recurring","kind":"<expense|income>"}
   (kind=expense p/ despesas/contas fixas; kind=income p/ entradas/salário recorrente.)
13) DÍVIDAS — ex.: "eu tenho dívidas?", "quanto eu devo?", "estou endividado?", "tenho fatura vencida?":
   {"action":"debts_check"}
   ⚠️ SEMPRE use esta ação para QUALQUER pergunta sobre dívida. NUNCA deduza dívida de saldo
   negativo, de parcelamento ou de fatura em aberto — isso NÃO é dívida. Só é dívida o que está
   cadastrado como dívida ou uma fatura de cartão VENCIDA.
14) DETALHAR/LISTAR os lançamentos um a um — ex.: "descreve cada uma", "quais foram esses gastos",
   "detalha os gastos de alimentação", "me lista os lançamentos de transporte", "mostra cada gasto":
   {"action":"list_transactions","category":"<categoria citada, ou vazio p/ todos>","period":"<this_month|last_month>","type":"<expense|income>"}
   Use quando a pessoa quer VER cada lançamento (não o total). Preencha "category" com a categoria
   do contexto — ex.: se acabou de perguntar dos gastos de "alimentação" e disse "descreve cada uma",
   use category "alimentação". type=income só se forem entradas.
15) SALDO / CARTEIRA / próximo vencimento — ex.: "quanto tenho na carteira?", "qual meu saldo?",
   "quanto tenho disponível?", "quando vence minha fatura?", "qual meu próximo compromisso?":
   {"action":"wallet_check"}

⚠️ NUNCA diga em texto que cadastrou/guardou/criou/pagou/registrou/excluiu algo. Para AGIR, responda SÓ com o JSON — o app grava e confirma de verdade.
Se não for nenhuma ação, responda normalmente em texto (sem inventar que fez algo).`;

// Mensagem quando o usuário ainda não configurou a própria chave do Gemini.
const MSG_NO_KEY = '⚙️ Pra eu conversar, configure sua *chave do Gemini* no app: *Configurações › WhatsApp*. É grátis e leva 1 minuto. 🙏';

// Lê a chave do Gemini DO PRÓPRIO usuário. Procura em users/{uid}.geminiKey e,
// como fallback, em users/{uid}/settings/general.geminiKey.
async function getUserGeminiKey(db, uid) {
  try {
    const [uSnap, sSnap] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('users').doc(uid).collection('settings').doc('general').get(),
    ]);
    const pick = (v) => (typeof v === 'string' && v.trim()) ? v.trim() : null;
    const fromUser = pick(uSnap.data()?.geminiKey);
    const fromSettings = pick(sSnap.data()?.geminiKey);
    const k = fromUser || fromSettings;
    console.log(`WA geminiKey uid=${uid} found=${!!k} (users=${!!fromUser} settings=${!!fromSettings})`);
    return k;
  } catch (e) { console.error('WA getUserGeminiKey:', e); return null; }
}

// ── LIMITE DO PLANO GRATUITO NO WHATSAPP ──────────────────────────────────
// No Gratuito a Alívia responde no WhatsApp, mas com um teto mensal de interações
// (mensagens NOVAS; continuações de um fluxo em andamento não contam).
const FREE_WA_MONTHLY_LIMIT = 10;

// Plano do usuário (server-side): 'pro' (ilimitado) ou 'free' (limitado).
// PRO = admin/vitalício OU assinatura ativa no Stripe OU compra anual válida.
async function getUserPlan(db, uid) {
  try {
    const [uSnap, subsSnap, paySnap] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('customers').doc(uid).collection('subscriptions').get().catch(() => ({ docs: [] })),
      db.collection('customers').doc(uid).collection('payments').get().catch(() => ({ docs: [] })),
    ]);
    const u = uSnap.data() || {};
    if (u.isAdmin === true) return 'pro';
    if (u.subscription?.status === 'lifetime') return 'pro';
    const hasActive = (subsSnap.docs || []).some(d => ['active', 'trialing'].includes(d.data()?.status));
    if (hasActive) return 'pro';
    const now = Date.now();
    const hasAnnual = (paySnap.docs || []).some(d => {
      const p = d.data() || {}; if (p.status !== 'succeeded') return false;
      const created = (p.created || 0) * 1000;
      return created > 0 && (now - created) < 366 * 86400000;
    });
    if (hasAnnual) return 'pro';
    return 'free';
  } catch (e) { console.error('WA getUserPlan:', e); return 'free'; }
}

// Conta +1 no uso mensal do Gratuito de forma atômica. Retorna se ainda pode usar.
async function bumpFreeUsage(db, uid) {
  const ref = db.collection('users').doc(uid);
  const mk = new Date().toISOString().slice(0, 7);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const wu = snap.data()?.waUsage || {};
      let count = (wu.month === mk) ? (parseInt(wu.count) || 0) : 0;
      if (count >= FREE_WA_MONTHLY_LIMIT) return { allowed: false, count, limit: FREE_WA_MONTHLY_LIMIT };
      count += 1;
      tx.set(ref, { waUsage: { month: mk, count } }, { merge: true });
      return { allowed: true, count, limit: FREE_WA_MONTHLY_LIMIT };
    });
  } catch (e) { console.error('WA bumpFreeUsage:', e); return { allowed: true, count: 0, limit: FREE_WA_MONTHLY_LIMIT }; } // falha → não bloqueia
}

// Mensagem de upgrade (marketing) quando o Gratuito estoura o limite.
const waUpgradeMessage = (limit) =>
  `✨ *Você aproveitou bastante a Alívia este mês!*\n\n`
  + `No plano *Gratuito* você tem ${limit} conversas por mês no WhatsApp — e elas acabaram por agora.\n\n`
  + `Com o *Alívia PRO* isso vira *ilimitado*: registre gastos, dê baixa em contas, peça relatórios e até importe extratos pelo WhatsApp, sem parar. 🚀\n\n`
  + `💚 Menos de *R$ 0,66 por dia* pra assumir o controle das suas finanças.\n`
  + `👉 Assine em *soualivia.com.br* e desbloqueie tudo.\n\n`
  + `_Seu limite renova no início do próximo mês._`;

// Traduz uma falha do Gemini num motivo específico e profissional pro usuário —
// pra ele (e a gente) saber exatamente o que aconteceu, em vez de "não posso responder".
function geminiErrorMessage(httpStatus, j) {
  const err = j?.error || {};
  const code = err.code || httpStatus || 0;
  const gstatus = String(err.status || '').toUpperCase();
  const msg = String(err.message || '').toLowerCase();

  // Chave inválida / mal digitada / revogada.
  if (msg.includes('api key not valid') || msg.includes('api_key_invalid') || (code === 400 && gstatus === 'INVALID_ARGUMENT' && msg.includes('api key'))) {
    return '🔑 *A sua chave do Gemini não está válida.*\n\nEla pode ter sido revogada, apagada ou digitada errada. Gere uma nova (é grátis) e salve em *Configurações › WhatsApp › Inteligência*. Assim eu volto a responder na hora.\n\n_(motivo: chave inválida · cód. IA-400)_';
  }
  // Chave expirada.
  if (msg.includes('api key expired') || msg.includes('expired')) {
    return '🔑 *A sua chave do Gemini expirou.*\n\nGere uma nova chave em *Configurações › WhatsApp › Inteligência* e salve novamente para eu voltar a funcionar.\n\n_(motivo: chave expirada · cód. IA-400)_';
  }
  // Cota / limite de uso da chave (free tier do Google).
  if (code === 429 || gstatus === 'RESOURCE_EXHAUSTED') {
    return '⏳ *A cota da sua chave do Gemini foi atingida por enquanto.*\n\nO Google limita o uso gratuito por minuto e por dia. Aguarde alguns minutos e me chame de novo — ou ative o faturamento da chave no Google AI Studio para ampliar o limite.\n\n_(motivo: cota excedida · cód. IA-429)_';
  }
  // Sem permissão / API não habilitada / chave restrita.
  if (code === 403 || gstatus === 'PERMISSION_DENIED') {
    return '🚫 *A sua chave do Gemini está sem permissão para responder.*\n\nNo Google AI Studio, confirme se a *Generative Language API* está habilitada e se a chave não está restrita por site/IP. Depois salve a chave novamente.\n\n_(motivo: sem permissão · cód. IA-403)_';
  }
  // Serviço do Google sobrecarregado / instável (não é problema da conta).
  if (code === 503 || gstatus === 'UNAVAILABLE' || msg.includes('overloaded')) {
    return '🛠️ *O serviço de IA do Google está sobrecarregado neste momento.*\n\nIsso é temporário e não tem a ver com a sua conta. Me chame de novo em 1 ou 2 minutinhos, por favor. 🙏\n\n_(motivo: serviço ocupado · cód. IA-503)_';
  }
  if (code === 500 || gstatus === 'INTERNAL') {
    return '🛠️ *O serviço de IA do Google teve um erro interno agora.*\n\nÉ momentâneo. Tente de novo em instantes — se continuar, me avise para investigarmos.\n\n_(motivo: erro interno do provedor · cód. IA-500)_';
  }
  // Conteúdo bloqueado por política de segurança do provedor.
  const block = String(j?.promptFeedback?.blockReason || j?.candidates?.[0]?.finishReason || '').toUpperCase();
  if (block.includes('SAFETY') || block.includes('BLOCK')) {
    return '⚠️ *Não pude responder a essa mensagem por uma regra de segurança do provedor de IA.*\n\nSe puder reformular de outro jeito, consigo te ajudar normalmente. 🙏\n\n_(motivo: conteúdo bloqueado · cód. IA-SAFETY)_';
  }
  // Qualquer outra falha — mas com código para apuração.
  return `😕 *Não consegui responder agora por uma instabilidade no serviço de IA.*\n\nJá registramos o ocorrido para verificar. Tente novamente em instantes, por favor.\n\n_(motivo: falha inesperada · cód. IA-${code || 'ERR'})_`;
}

async function askGemini(history, contextText, userMsg, key) {
  if (!key) return MSG_NO_KEY;
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
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.error) {
      console.error(`WA Gemini falhou: HTTP ${r.status} resp=${JSON.stringify(j).slice(0, 500)}`);
      return geminiErrorMessage(r.status, j);
    }
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      console.error(`WA Gemini vazio: HTTP ${r.status} resp=${JSON.stringify(j).slice(0, 500)}`);
      return geminiErrorMessage(r.status, j);
    }
    return text;
  } catch (e) {
    console.error('WA Gemini erro de rede:', e?.message || e);
    return '📡 *Não consegui falar com o serviço de IA agora* — parece uma instabilidade de conexão momentânea.\n\nTente novamente em instantes, por favor. Se persistir, me avise para verificarmos.\n\n_(motivo: falha de conexão · cód. IA-NET)_';
  }
}

// Baixa um áudio do WhatsApp e transcreve com o Gemini (que entende áudio).
async function transcribeAudio(mediaId, key) {
  const token = process.env.WHATSAPP_TOKEN;
  if (!mediaId || !key) return '';
  try {
    const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
    if (!meta?.url) { console.error('WA audio: sem url', JSON.stringify(meta).slice(0, 200)); return ''; }
    const audioResp = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    const b64 = Buffer.from(await audioResp.arrayBuffer()).toString('base64');
    const mime = (meta.mime_type || 'audio/ogg').split(';')[0];
    const body = {
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: mime, data: b64 } },
          { text: 'Transcreva em português exatamente o que a pessoa disse neste áudio. Responda só com a transcrição, sem comentários.' },
        ],
      }],
    };
    const r = await fetch(`${GEMINI_URL}?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.error) {
      console.error(`WA audio falhou: HTTP ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
      return { errorMsg: geminiErrorMessage(r.status, j) };
    }
    const t = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!t) console.error('WA audio transcrição vazia:', JSON.stringify(j).slice(0, 300));
    return { text: t || '' };
  } catch (e) {
    console.error('WA transcribeAudio erro:', e?.message || e);
    return { errorMsg: '📡 *Não consegui processar seu áudio agora* — parece uma instabilidade de conexão momentânea.\n\nTente enviar de novo em instantes, por favor.\n\n_(motivo: falha de conexão · cód. IA-NET)_' };
  }
}

// Baixa um documento (PDF/CSV) do WhatsApp e extrai os lançamentos com o Gemini.
async function extractStatement(docInfo, key) {
  const token = process.env.WHATSAPP_TOKEN;
  if (!docInfo?.id || !key) return { items: [] };
  try {
    const meta = await fetch(`${GRAPH}/${docInfo.id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
    if (!meta?.url) { console.error('WA import: sem url', JSON.stringify(meta).slice(0, 200)); return { items: [] }; }
    const resp = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    const buf = Buffer.from(await resp.arrayBuffer());
    const mime = (docInfo.mime_type || meta.mime_type || '').split(';')[0].toLowerCase();
    const instruction = `Este arquivo é um extrato bancário ou fatura de cartão de crédito. Extraia TODOS os lançamentos (transações).
Responda APENAS com um JSON array puro, sem nenhum texto fora dele, no formato:
[{"description":"<texto curto>","amount":<número positivo>,"date":"<AAAA-MM-DD ou string vazia>","type":"expense|income","category":"<um destes: ${EXPENSE_CATS.join(', ')}>"}]
Regras: amount SEMPRE positivo. type=expense para gastos/compras/débitos/saídas; type=income para créditos/recebimentos/entradas. IGNORE linhas de saldo, subtotal, total da fatura, e "pagamento de fatura". Escolha a category mais provável. Se não houver lançamentos, responda [].`;
    let parts;
    if (mime.includes('pdf')) {
      parts = [{ inline_data: { mime_type: 'application/pdf', data: buf.toString('base64') } }, { text: instruction }];
    } else {
      const textCsv = buf.toString('utf8').slice(0, 25000);
      parts = [{ text: `${instruction}\n\nConteúdo do arquivo:\n${textCsv}` }];
    }
    const body = { contents: [{ role: 'user', parts }], generationConfig: { temperature: 0, maxOutputTokens: 6000 } };
    const r = await fetch(`${GEMINI_URL}?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.error) { console.error(`WA import falhou: HTTP ${r.status} ${JSON.stringify(j).slice(0, 300)}`); return { items: [], errorMsg: geminiErrorMessage(r.status, j) }; }
    const t = j?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const m = t.match(/\[[\s\S]*\]/);
    if (!m) { console.error('WA import: sem JSON na resposta', JSON.stringify(j).slice(0, 300)); return { items: [] }; }
    const arr = JSON.parse(m[0]);
    return { items: arr.map(x => ({
      description: String(x.description || 'Lançamento').slice(0, 80),
      amount: Math.abs(parseFloat(x.amount) || 0),
      date: /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : '',
      type: x.type === 'income' ? 'income' : 'expense',
      category: EXPENSE_CATS.includes(x.category) ? x.category : 'other',
    })).filter(x => x.amount > 0 && x.description) };
  } catch (e) { console.error('WA extractStatement erro:', e?.message || e); return { items: [], errorMsg: '📡 *Não consegui processar seu arquivo agora* — parece uma instabilidade de conexão momentânea.\n\nTente enviar de novo em instantes, por favor.\n\n_(motivo: falha de conexão · cód. IA-NET)_' }; }
}

// Recebe um documento, extrai os lançamentos e pede confirmação (SIM/NÃO).
async function handleDocumentImport(db, from, uid, sessRef, docInfo, key) {
  if (!key) { await sendText(from, MSG_NO_KEY); return; }
  const mime = (docInfo?.mime_type || '').toLowerCase();
  const ok = mime.includes('pdf') || mime.includes('csv') || mime.includes('text') || mime.includes('excel') || mime.includes('comma');
  if (!ok) { await sendText(from, 'Consigo ler *PDF* ou *CSV* (extrato do banco ou fatura do cartão). Esse formato eu não leio 😅. Dá pra exportar em PDF ou CSV?'); return; }
  await sendText(from, 'Recebi seu arquivo 📄 Estou lendo os lançamentos... um instante.');
  const { items, errorMsg } = await extractStatement(docInfo, key);
  if (errorMsg) { await sendText(from, errorMsg); return; }
  if (!items.length) { await sendText(from, 'Não consegui identificar lançamentos nesse arquivo 😅. Confere se é um extrato de banco/cartão em PDF ou CSV legível (não pode ser imagem/foto escaneada sem texto).'); return; }
  const capped = items.slice(0, 80);
  const totalExp = capped.filter(i => i.type === 'expense').reduce((a, i) => a + i.amount, 0);
  const totalInc = capped.filter(i => i.type === 'income').reduce((a, i) => a + i.amount, 0);
  await sessRef.set({ uid, pending: { type: 'import', data: { items: capped } } }, { merge: true });
  const preview = capped.slice(0, 8).map(i => `• ${i.type === 'income' ? '+' : '−'} R$ ${money(i.amount)} — ${i.description}`).join('\n');
  const resto = capped.length > 8 ? `\n… e mais ${capped.length - 8} lançamento(s).` : '';
  await sendText(from, `Encontrei *${capped.length} lançamento(s)*:\n\n${preview}${resto}\n\n💸 Saídas: *R$ ${money(totalExp)}*${totalInc ? `\n💚 Entradas: *R$ ${money(totalInc)}*` : ''}\n\nPosso lançar tudo de uma vez? Responda *SIM* pra confirmar ou *NÃO* pra cancelar.`);
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

// Acha o lançamento mais recente do usuário (opcional: que contenha `description`).
// Ordena em memória p/ não exigir índice composto no Firestore.
async function findRecentTx(db, uid, description) {
  const snap = await db.collection('transactions').where('userId', '==', uid).get();
  if (snap.empty) return null;
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const q = String(description || '').toLowerCase().trim();
  const match = q ? docs.find(d => String(d.description || '').toLowerCase().includes(q)) : null;
  return match || docs[0];
}

// Exclui um lançamento e DESFAZ efeitos colaterais:
//  - reserva (reserveInternal): estorna o valor do cofrinho;
//  - baixa de recorrente: apaga a ocorrência e libera nova baixa no mês.
async function doDeleteTx(db, uid, tx) {
  if (!tx || tx.userId !== uid) return false;
  const amt = parseFloat(tx.amount) || 0;
  // Estorno de aporte na reserva.
  if (tx.reserveInternal && tx.jarId) {
    const jarRef = db.collection('savings_jars').doc(tx.jarId);
    const jarSnap = await jarRef.get();
    if (jarSnap.exists) {
      const j = jarSnap.data();
      await jarRef.set({
        balance: Math.max(0, (parseFloat(j.balance) || 0) - amt),
        invested: Math.max(0, (parseFloat(j.invested ?? j.balance) || 0) - amt),
      }, { merge: true });
    }
  }
  // Reverte baixa de recorrente (remove ocorrência única + reabre o mês).
  if (tx.source === 'recorrente_baixa' && tx.recorrenteId) {
    const income = tx.type === 'income';
    const coll = income ? 'fixed_incomes' : 'fixed_expenses';
    const prefix = income ? 'inc_' : '';
    const mk = tx.month || mkNow();
    await db.collection('users').doc(uid).collection('recorrentes_baixas').doc(`${prefix}${tx.recorrenteId}_${mk}`).delete().catch(() => {});
    await db.collection(coll).doc(tx.recorrenteId).set({ lastPaidMonth: null }, { merge: true }).catch(() => {});
  }
  await db.collection('transactions').doc(tx.id).delete();
  return true;
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

// Lista as recorrentes (despesas OU entradas) em texto, ordenadas por dia.
async function doListRecurring(db, uid, kind) {
  const income = kind === 'income';
  const coll = income ? 'fixed_incomes' : 'fixed_expenses';
  const snap = await db.collection(coll).where('userId', '==', uid).get();
  const items = snap.docs.map(d => d.data());
  if (!items.length) return income ? 'Você ainda não tem *entradas recorrentes* cadastradas. 🙂' : 'Você ainda não tem *despesas recorrentes* cadastradas. 🙂';
  const sorted = items.sort((a, b) => (parseInt(a.day) || 99) - (parseInt(b.day) || 99));
  const total = items.reduce((a, i) => a + (parseFloat(i.value) || 0), 0);
  const lines = sorted.map(i => `• ${i.name || '—'} — *R$ ${money(i.value)}* (dia ${i.day || '?'})`);
  const titulo = income ? '📥 *Entradas recorrentes*' : '📤 *Despesas recorrentes*';
  return `${titulo}\n\n${lines.join('\n')}\n——\nTotal: *R$ ${money(total)}*/mês`;
}

// Resolve uma categoria por id ("food") ou rótulo ("alimentação").
function resolveCategory(raw) {
  const q = String(raw || '').toLowerCase().trim();
  if (!q) return null;
  if (CAT_LABELS[q]) return q;
  for (const [id, label] of Object.entries(CAT_LABELS)) {
    const l = label.toLowerCase();
    if (l === q || l.includes(q) || q.includes(l)) return id;
  }
  return null;
}

// Lista os LANÇAMENTOS individuais do mês (opcional: filtrando por categoria).
async function doListTransactions(db, uid, categoryRaw, period = 'this_month', typeWanted = 'expense') {
  const num = (v) => parseFloat(v) || 0;
  const now = new Date();
  const mk = period === 'last_month'
    ? new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7)
    : now.toISOString().slice(0, 7);
  const catId = resolveCategory(categoryRaw);
  const snap = await db.collection('transactions').where('userId', '==', uid).get();
  let txs = snap.docs.map(d => d.data()).filter(t => (t.month || String(t.date || '').slice(0, 7)) === mk);
  txs = txs.filter(t => typeWanted === 'income'
    ? (t.type === 'income' && !['initial_balance', 'carryover', 'vault_redemption'].includes(t.category))
    : (t.type === 'expense' && !['credit_card_bill', 'vault', 'investment'].includes(t.category) && !t.reserveInternal));
  if (catId) txs = txs.filter(t => (t.category || 'other') === catId);
  if (!txs.length) return catId ? `Não encontrei lançamentos de *${CAT_LABELS[catId]}* em ${monthLabel(mk)}. 🙂` : `Não encontrei lançamentos em ${monthLabel(mk)}. 🙂`;
  txs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const total = txs.reduce((a, t) => a + num(t.amount), 0);
  const fmtDate = (d) => { const dt = new Date(d); return isNaN(dt) ? '' : `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`; };
  const capped = txs.slice(0, 40);
  const lines = capped.map(t => `• ${fmtDate(t.date)} — ${t.description || '—'}: *R$ ${money(t.amount)}*`);
  const resto = txs.length > 40 ? `\n… e mais ${txs.length - 40} lançamento(s).` : '';
  const titulo = catId ? `🧾 *${CAT_LABELS[catId]}* — ${monthLabel(mk)}` : `🧾 Lançamentos — ${monthLabel(mk)}`;
  return `${titulo}\n\n${lines.join('\n')}${resto}\n——\nTotal: *R$ ${money(total)}*`;
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
    if (!msg || !['text', 'interactive', 'audio', 'document'].includes(msg.type)) return res.status(200).json({ ok: true }); // ignora outros tipos

    const from = msg.from; // telefone E.164 só dígitos
    // Entrada pode ser texto, um toque em lista/botão (interactive) OU áudio (voz).
    // O áudio é transcrito DEPOIS (com a chave do próprio usuário), após o vínculo.
    let text = '';
    let selId = null;
    let audioId = null;
    if (msg.type === 'text') {
      text = msg.text?.body || '';
    } else if (msg.type === 'interactive') {
      const it = msg.interactive || {};
      selId = it.list_reply?.id || it.button_reply?.id || null;
      text = it.list_reply?.title || it.button_reply?.title || '';
    } else if (msg.type === 'audio') {
      audioId = msg.audio?.id || null;
    }
    console.log(`WA in <- from=${from} type=${msg.type} text="${text.slice(0, 60)}" sel=${selId || '-'}`);
    const db = initAdmin();

    // 1. Vínculo do número
    const userDoc = await db.collection('wa_users').doc(from).get();
    if (!userDoc.exists) {
      // O código pode vir sozinho OU dentro de uma mensagem pronta (ex.: "...meu
      // código é: XZ28YK"). Extraímos os tokens de 6 chars do alfabeto de códigos
      // (sem I/O/0/1) e também o texto inteiro sem espaços (compatibilidade).
      const upper = String(text || '').toUpperCase();
      const candidates = [...(upper.match(/[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{6}/g) || [])];
      const whole = upper.replace(/\s+/g, '');
      if (whole && !candidates.includes(whole)) candidates.push(whole);
      let linkRef = null, linkSnap = null;
      for (const cand of candidates) {
        const snap = await db.collection('wa_links').doc(cand).get();
        if (snap.exists) { linkRef = db.collection('wa_links').doc(cand); linkSnap = snap; break; }
      }
      if (linkSnap) {
        await db.collection('wa_users').doc(from).set({ uid: linkSnap.data().uid, linkedAt: Date.now() });
        await linkRef.delete();
        await sendText(from, 'Pronto, seu WhatsApp foi vinculado à sua conta Alívia! ✅\n\nPode me perguntar sobre suas finanças ou registrar um gasto (ex.: "mercado 120").');
      } else {
        await sendText(from, 'Oi! Sou a Alívia 💚\nPara conectar, abra o app em *Configurações › WhatsApp*, toque em *Conversar com a Alívia* e envie a mensagem que aparecer (ela já vem com seu código).');
      }
      return res.status(200).json({ ok: true });
    }

    const uid = userDoc.data().uid;
    const sessRef = db.collection('wa_sessions').doc(from);
    const sess = (await sessRef.get()).data() || {};
    const history = sess.history || [];
    // Chave do Gemini DO PRÓPRIO usuário — a IA responde com a chave dele, não a do servidor.
    const geminiKey = await getUserGeminiKey(db, uid);

    // Limite do plano GRATUITO: conta interações NOVAS (mensagem/áudio/documento
    // sem fluxo pendente). Continuações (toques em botão, confirmações de um fluxo
    // em andamento) NÃO contam nem bloqueiam. PRO/Vitalício/Dev = ilimitado.
    if (!sess.pending && msg.type !== 'interactive') {
      const plan = await getUserPlan(db, uid);
      if (plan === 'free') {
        const usage = await bumpFreeUsage(db, uid);
        console.log(`WA free-usage uid=${uid} count=${usage.count}/${usage.limit} allowed=${usage.allowed}`);
        if (!usage.allowed) { await sendText(from, waUpgradeMessage(usage.limit)); return res.status(200).json({ ok: true }); }
      }
    }

    // Áudio: transcreve agora, com a chave do usuário.
    if (msg.type === 'audio') {
      if (!geminiKey) { await sendText(from, MSG_NO_KEY); return res.status(200).json({ ok: true }); }
      const tr = await transcribeAudio(audioId, geminiKey);
      if (tr.errorMsg) { await sendText(from, tr.errorMsg); return res.status(200).json({ ok: true }); }
      text = tr.text;
      if (!text) { await sendText(from, 'Não consegui entender o áudio 😅 — pode ter ficado baixo ou muito curto. Tente repetir ou me escrever.'); return res.status(200).json({ ok: true }); }
      console.log(`WA audio transcrito: "${text.slice(0, 60)}"`);
    }

    // 0. Documento (PDF/CSV) — extrai lançamentos e pede confirmação (importação em lote).
    if (msg.type === 'document') {
      await handleDocumentImport(db, from, uid, sessRef, msg.document, geminiKey);
      return res.status(200).json({ ok: true });
    }

    // Detecta um pedido NOVO (frase digitada) pra não ficar preso num fluxo pendente.
    const looksNewIntent = !selId && text.trim().split(/\s+/).length >= 3;

    // 2. Fluxo interativo do gasto — PASSO 1: escolher a CATEGORIA (lista tocável).
    if (sess.pending?.type === 'exp_cat') {
      if (no(text)) { await sessRef.set({ uid, history, pending: null }, { merge: true }); await sendText(from, 'Beleza, cancelei o lançamento. 👍'); return res.status(200).json({ ok: true }); }
      const catId = pickCat(selId, text);
      if (catId) {
        const data = { ...sess.pending.data, category: catId };
        await sessRef.set({ uid, history, pending: { type: 'exp_prio', data } }, { merge: true });
        await sendPrioButtons(from, `Categoria: *${CAT_LABELS[catId]}* ✅\n\nEsse gasto foi *essencial*, de *conforto* ou *supérfluo*?`);
        return res.status(200).json({ ok: true });
      }
      if (looksNewIntent) { await sessRef.set({ uid, pending: null }, { merge: true }); sess.pending = null; } // abandona o gasto e trata o novo pedido
      else { await sendCatList(from, 'Toque pra escolher a *categoria* do gasto 👇 (ou "cancelar")', sess.pending.data.suggested); return res.status(200).json({ ok: true }); }
    }

    // 2. Fluxo interativo do gasto — PASSO 2: escolher a PRIORIDADE (botões) e LANÇAR.
    if (sess.pending?.type === 'exp_prio') {
      if (no(text)) { await sessRef.set({ uid, history, pending: null }, { merge: true }); await sendText(from, 'Beleza, cancelei o lançamento. 👍'); return res.status(200).json({ ok: true }); }
      const prio = pickPrio(selId, text);
      if (!prio) {
        if (looksNewIntent) { await sessRef.set({ uid, pending: null }, { merge: true }); sess.pending = null; } // novo pedido → sai do fluxo
        else { await sendPrioButtons(from, 'Toque pra escolher a *prioridade* 👇'); return res.status(200).json({ ok: true }); }
      }
      if (prio) {
        const p = sess.pending.data;
        const now = new Date();
        const txData = {
          description: p.description, amount: p.amount, type: 'expense',
          category: p.category, priority: prio,
          date: now.toISOString(), month: now.toISOString().slice(0, 7),
          userId: uid, createdAt: Date.now(), isFixed: false, source: 'whatsapp',
        };
        if (p.isCard) { txData.paymentMethod = 'credito'; txData.selectedCardId = p.cardId; txData.invoiceStatus = 'unpaid'; }
        else { txData.paymentMethod = 'pix'; }
        await db.collection('transactions').add(txData);
        await sessRef.set({ uid, history, pending: null }, { merge: true });
        const onde = p.isCard ? ` na fatura do *${p.cardName}*` : '';
        await sendText(from, `Lançado! ✅ *${p.description}* — R$ ${money(p.amount)}${onde}\n_${CAT_LABELS[p.category]} · ${PRIO_LABELS[prio]}_`);
        return res.status(200).json({ ok: true });
      }
    }

    // 2a. Confirmação de IMPORTAÇÃO (extrato PDF/CSV) — lança tudo em lote.
    if (sess.pending?.type === 'import') {
      if (yes(text)) {
        const items = sess.pending.data?.items || [];
        let ok = 0;
        try {
          const batch = db.batch();
          const nowMs = Date.now();
          for (const it of items) {
            const iso = it.date ? new Date(it.date + 'T12:00:00').toISOString() : new Date().toISOString();
            const ref = db.collection('transactions').doc();
            const tx = {
              description: normName(it.description), amount: it.amount, type: it.type,
              category: it.category, date: iso, month: iso.slice(0, 7),
              userId: uid, createdAt: nowMs, isFixed: false, source: 'whatsapp_import',
            };
            if (it.type === 'expense') { tx.priority = 'comfort'; tx.paymentMethod = 'pix'; }
            batch.set(ref, tx); ok++;
          }
          await batch.commit();
          await sessRef.set({ uid, history, pending: null }, { merge: true });
          await sendText(from, `Pronto! ✅ Lancei *${ok}* lançamento(s) do seu extrato de uma vez. Já estão no app.`);
        } catch (e) { console.error('WA import commit:', e); await sendText(from, 'Deu um erro ao lançar em lote. Tenta enviar o arquivo de novo. 🙏'); }
        return res.status(200).json({ ok: true });
      }
      if (no(text)) {
        await sessRef.set({ uid, history, pending: null }, { merge: true });
        await sendText(from, 'Sem problema, não lancei nada. 👍');
        return res.status(200).json({ ok: true });
      }
      await sendText(from, 'Responda *SIM* pra eu lançar tudo, ou *NÃO* pra cancelar. 🙏');
      return res.status(200).json({ ok: true });
    }

    // 2b. Confirmação de EXCLUSÃO pendente.
    if (sess.pending?.type === 'delete') {
      if (yes(text)) {
        const p = sess.pending.data;
        try {
          const snap = await db.collection('transactions').doc(p.id).get();
          const ok = snap.exists && await doDeleteTx(db, uid, { id: p.id, ...snap.data() });
          await sessRef.set({ uid, history, pending: null }, { merge: true });
          await sendText(from, ok ? `Excluído! ✅ *${p.description}* (R$ ${money(p.amount)}) foi removido.` : 'Esse lançamento não está mais disponível. 🤔');
        } catch (e) { console.error('WA delete:', e); await sendText(from, 'Não consegui excluir agora. Tenta de novo. 🙏'); }
        return res.status(200).json({ ok: true });
      }
      if (no(text)) {
        await sessRef.set({ uid, history, pending: null }, { merge: true });
        await sendText(from, 'Ok, mantive o lançamento. 👍');
        return res.status(200).json({ ok: true });
      }
      await sessRef.set({ uid, pending: null }, { merge: true });
    }

    // 2c. Escolha de RELATÓRIO em PDF (após a lista tocável).
    if (sess.pending?.type === 'report_pick') {
      if (no(text)) { await sessRef.set({ uid, history, pending: null }, { merge: true }); await sendText(from, 'Beleza, cancelei. 👍'); return res.status(200).json({ ok: true }); }
      const id = pickReport(selId, text);
      if (!id) { await sendReportList(from); return res.status(200).json({ ok: true }); }
      await sessRef.set({ uid, history, pending: null }, { merge: true });
      await generateAndSendPdf(db, from, uid, id);
      return res.status(200).json({ ok: true });
    }

    // 3. Conversa com a Alívia
    const ctx = await buildUserContext(db, uid);
    const reply = await askGemini(history, ctx, text, geminiKey);
    const action = parseAction(reply);

    // 3z. Relatório com valores REAIS (calculado no servidor).
    if (action?.action === 'report') {
      const type = ['category', 'priority', 'overview', 'installments'].includes(action.type) ? action.type : 'overview';
      const period = action.period === 'last_month' ? 'last_month' : 'this_month';
      try {
        const rep = await buildReport(db, uid, type, period);
        await sessRef.set({ uid, history, pending: null }, { merge: true });
        await sendText(from, rep);
      } catch (e) { console.error('WA report:', e); await sendText(from, 'Não consegui montar o relatório agora. Tenta de novo. 🙏'); }
      return res.status(200).json({ ok: true });
    }

    // 3w2. Saldo em carteira + próximo compromisso (fatura a vencer).
    if (action?.action === 'wallet_check') {
      try {
        const txt = await buildWalletAnswer(db, uid);
        await sessRef.set({ uid, history, pending: null }, { merge: true });
        await sendText(from, txt);
      } catch (e) { console.error('WA wallet_check:', e); await sendText(from, 'Não consegui ver seu saldo agora. Tenta de novo. 🙏'); }
      return res.status(200).json({ ok: true });
    }

    // 3w. Dívidas — resposta determinística (não deduz de saldo/parcelamento/fatura em aberto).
    if (action?.action === 'debts_check') {
      try {
        const txt = await buildDebtsAnswer(db, uid);
        await sessRef.set({ uid, history, pending: null }, { merge: true });
        await sendText(from, txt);
      } catch (e) { console.error('WA debts_check:', e); await sendText(from, 'Não consegui verificar suas dívidas agora. Tenta de novo. 🙏'); }
      return res.status(200).json({ ok: true });
    }

    // 3v. Detalhar lançamentos um a um (opcional por categoria).
    if (action?.action === 'list_transactions') {
      const type = action.type === 'income' ? 'income' : 'expense';
      const period = action.period === 'last_month' ? 'last_month' : 'this_month';
      try {
        const txt = await doListTransactions(db, uid, action.category, period, type);
        await sessRef.set({ uid, history, pending: null }, { merge: true });
        await sendText(from, txt);
      } catch (e) { console.error('WA list_transactions:', e); await sendText(from, 'Não consegui detalhar agora. Tenta de novo. 🙏'); }
      return res.status(200).json({ ok: true });
    }

    // 3x. Listar recorrentes cadastradas (despesas ou entradas).
    if (action?.action === 'list_recurring') {
      const kind = action.kind === 'income' ? 'income' : 'expense';
      try {
        const txt = await doListRecurring(db, uid, kind);
        await sessRef.set({ uid, history, pending: null }, { merge: true });
        await sendText(from, txt);
      } catch (e) { console.error('WA list_recurring:', e); await sendText(from, 'Não consegui listar agora. Tenta de novo. 🙏'); }
      return res.status(200).json({ ok: true });
    }

    // 3y. Relatório em GRÁFICO/PDF — lista os relatórios da aba Análises pra escolher.
    if (action?.action === 'report_pdf') {
      const direct = pickReport(null, action.id || action.report || '');
      if (direct) {
        await sessRef.set({ uid, history, pending: null }, { merge: true });
        await generateAndSendPdf(db, from, uid, direct);
      } else {
        await sessRef.set({ uid, history, pending: { type: 'report_pick', data: {} } }, { merge: true });
        await sendReportList(from);
      }
      return res.status(200).json({ ok: true });
    }

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

    // 3f. Gasto no CARTÃO — resolve o cartão e abre o fluxo (categoria → prioridade).
    if (action?.action === 'add_card_expense') {
      const amount = Math.abs(parseFloat(action.amount) || 0);
      if (amount <= 0 || !action.description) { await sendText(from, 'Não entendi a compra no cartão. Ex.: "passei 200 no cartão do Nubank". 🙏'); return res.status(200).json({ ok: true }); }
      const card = await resolveCard(db, uid, action.cardName);
      if (!card) { await sendText(from, 'Você ainda não tem cartão cadastrado. Cadastre em *Cartões* no app e tente de novo. 🙏'); return res.status(200).json({ ok: true }); }
      const data = {
        description: normName(String(action.description).slice(0, 120)), amount,
        suggested: EXPENSE_CATS.includes(action.category) ? action.category : 'shopping',
        isCard: true, cardId: card.id, cardName: card.name,
      };
      await sessRef.set({ uid, history, pending: { type: 'exp_cat', data } }, { merge: true });
      await sendCatList(from, `Compra no cartão *${card.name}*: *${data.description}* — R$ ${money(amount)}.\nEm qual *categoria*? 👇`, data.suggested);
      return res.status(200).json({ ok: true });
    }

    // 3g. Excluir lançamento — acha o alvo e pede confirmação (SIM/NÃO).
    if (action?.action === 'delete_transaction') {
      const tx = await findRecentTx(db, uid, action.description);
      if (!tx) { await sendText(from, 'Não encontrei nenhum lançamento pra excluir. 🤔'); return res.status(200).json({ ok: true }); }
      await sessRef.set({ uid, history, pending: { type: 'delete', data: { id: tx.id, description: normName(tx.description || 'Lançamento'), amount: parseFloat(tx.amount) || 0 } } }, { merge: true });
      const tipo = tx.type === 'income' ? 'entrada' : 'despesa';
      await sendText(from, `Quer que eu exclua este lançamento?\n\n• *${normName(tx.description || 'Lançamento')}* (${tipo})\n• Valor: R$ ${money(tx.amount)}\n\nResponda *SIM* para excluir ou *NÃO* para manter.`);
      return res.status(200).json({ ok: true });
    }

    // 3h. Gasto avulso — abre o fluxo interativo (escolher categoria → prioridade).
    const expense = parseExpense(reply);
    if (expense) {
      const data = { description: normName(expense.description), amount: expense.amount, suggested: expense.category, isCard: false };
      await sessRef.set({ uid, history, pending: { type: 'exp_cat', data } }, { merge: true });
      await sendCatList(from, `Gasto: *${data.description}* — R$ ${money(expense.amount)}.\nEm qual *categoria*? 👇`, data.suggested);
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
