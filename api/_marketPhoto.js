/**
 * Leitura do cupom por foto. Não é uma função por si: entra em
 * /api/market-import, que despacha POST para cá.
 *
 * Lê UMA foto de cupom de mercado e devolve os produtos estruturados.
 *
 * Uma foto por chamada de propósito: compra grande não cabe num quadro, e a
 * pessoa fotografa em pedaços. Chamadas separadas mantêm o corpo pequeno,
 * dão progresso ("lendo 2 de 4") e deixam a junção dos pedaços no cliente,
 * onde ela é testável (src/utils/receiptMerge.js).
 *
 * POST { image: "<base64 sem prefixo>", mime: "image/jpeg" | "application/pdf" }
 * Resposta: { store, date, total, items: [{ name, qty, unit, unitPrice, total }] }
 *
 * Exige ID token do Firebase: a chamada gasta cota do Gemini, e endpoint de
 * IA aberto é convite para a conta de outra pessoa pagar a conta.
 */

import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { rateLimit } from './_rateLimit.js';

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-1.5-flash'];
const geminiUrl = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

// A foto chega comprimida do cliente (1600px, qualidade 0.82) e pesa poucos
// KB. O PDF vai como está, e aí o teto é outro: a Vercel corta corpo de
// requisição em ~4,5 MB e base64 infla 33%, então 3 MB de PDF é o que cabe
// com folga. Acima disso a requisição morreria sem mensagem útil.
const MAX_BYTES = 6 * 1024 * 1024;
const MAX_BYTES_PDF = 3 * 1024 * 1024;
const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const ehPdf = (mime) => mime === 'application/pdf';

/**
 * O que pode subir: tipo aceito e tamanho que cabe na requisição.
 *
 * Exportada para ter teste: dentro do handler ela só rodaria depois da
 * chave do Gemini e do Firebase, que não existem fora de produção.
 */
export function validarEntrada(image, mime) {
    if (!image || typeof image !== 'string') return 'missing_image';
    if (!MIMES.has(String(mime))) return 'bad_mime';
    const teto = ehPdf(mime) ? MAX_BYTES_PDF : MAX_BYTES;
    // base64 carrega 4 caracteres por 3 bytes: 0.75 desfaz a inflação.
    if (image.length * 0.75 > teto) return ehPdf(mime) ? 'pdf_too_large' : 'image_too_large';
    return null;
}

const PROMPT = `Você recebe a FOTO de um pedaço de um cupom fiscal de supermercado brasileiro.

Extraia SOMENTE o que estiver legível nesta foto. Responda APENAS com JSON, sem texto fora dele, neste formato:

{
  "store": "nome do mercado ou null",
  "date": "AAAA-MM-DD ou null",
  "total": 0,
  "items": [
    { "name": "produto", "qty": 1, "unit": "un", "unitPrice": 0, "total": 0 }
  ]
}

Regras:
- Mantenha os produtos NA MESMA ORDEM em que aparecem no papel. A ordem é usada para juntar as fotos.
- "qty" e os valores são NÚMEROS com ponto decimal (1.235, não "1,235").
- "unit" é a unidade impressa em minúsculas: un, kg, g, l, ml, pct, cx, dz.
- "unitPrice" é o preço de UMA unidade; "total" é o da linha.
- Se só houver o total da linha, calcule o unitário dividindo pela quantidade.
- "total" (fora de items) é o TOTAL impresso do cupom. Se não aparecer nesta foto, use 0.
- "store" e "date" só se estiverem visíveis nesta foto; senão null.
- NÃO invente produto, preço ou quantidade. Se uma linha estiver ilegível, omita.
- Ignore descontos, tributos, troco e formas de pagamento: só produtos.`;

// O PDF é o cupom inteiro. A diferença não é cosmética: pedir "o que estiver
// legível nesta foto" a um documento completo faz o modelo parar cedo e
// devolver meia compra. Aqui ele é instruído ao contrário — ir até o fim, e
// conferir o próprio trabalho contra o total impresso.
const PROMPT_PDF = `Você recebe o PDF COMPLETO de um cupom fiscal de supermercado brasileiro (pode ter mais de uma página).

Leia o documento INTEIRO e extraia TODOS os produtos, do primeiro ao último. Responda APENAS com JSON, sem texto fora dele, neste formato:

{
  "store": "nome do mercado ou null",
  "date": "AAAA-MM-DD ou null",
  "total": 0,
  "items": [
    { "name": "produto", "qty": 1, "unit": "un", "unitPrice": 0, "total": 0 }
  ]
}

Regras:
- NÃO resuma, NÃO agrupe e NÃO pule linhas. Um cupom de 60 itens devolve 60 itens.
- Se as páginas continuarem a lista, siga até o fim do documento.
- Se o MESMO produto aparecer em linhas separadas, mantenha as linhas separadas.
- Mantenha os produtos NA MESMA ORDEM em que aparecem no documento.
- "qty" e os valores são NÚMEROS com ponto decimal (1.235, não "1,235").
- "unit" é a unidade impressa em minúsculas: un, kg, g, l, ml, pct, cx, dz.
- "unitPrice" é o preço de UMA unidade; "total" é o da linha.
- Se só houver o total da linha, calcule o unitário dividindo pela quantidade.
- "total" (fora de items) é o TOTAL impresso do cupom.
- Antes de responder, CONFIRA: a soma dos "total" das linhas deve bater com o total impresso. Se não bater, releia o documento procurando a linha que faltou.
- NÃO invente produto, preço ou quantidade. Se uma linha estiver ilegível, omita.
- Ignore descontos, tributos, troco e formas de pagamento: só produtos.`;

function initAdmin() {
    if (getApps().length) return true;
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!sa) return false;
    try {
        initializeApp({ credential: cert(JSON.parse(sa)) });
        return true;
    } catch {
        return false;
    }
}

const num = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
    return isFinite(n) && n >= 0 ? n : 0;
};

// O modelo às vezes embrulha o JSON em ``` ou escreve uma frase antes.
function extrairJson(texto) {
    const t = String(texto || '');
    const i = t.indexOf('{');
    const f = t.lastIndexOf('}');
    if (i < 0 || f <= i) return null;
    try { return JSON.parse(t.slice(i, f + 1)); } catch { return null; }
}

function normalizar(bruto) {
    const items = [];
    for (const it of Array.isArray(bruto?.items) ? bruto.items : []) {
        const name = String(it?.name || '').trim().slice(0, 120);
        if (!name) continue;
        const qty = num(it.qty) || 1;
        let unitPrice = num(it.unitPrice);
        let total = num(it.total);
        if (!unitPrice && total) unitPrice = Math.round((total / qty) * 100) / 100;
        if (!total && unitPrice) total = Math.round(qty * unitPrice * 100) / 100;
        if (!unitPrice && !total) continue;          // linha sem preço não serve
        items.push({
            name,
            qty,
            unit: String(it.unit || 'un').toLowerCase().slice(0, 6),
            unitPrice,
            total,
        });
    }
    const data = String(bruto?.date || '');
    return {
        store: bruto?.store ? String(bruto.store).trim().slice(0, 120) : null,
        date: /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null,
        total: num(bruto?.total),
        items,
    };
}

export async function lerPorFoto(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');      // cupom é dado da pessoa
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(500).json({ error: 'no_gemini_key' });

    if (!initAdmin()) return res.status(500).json({ error: 'no_admin_credentials' });
    const header = req.headers.authorization || '';
    const idToken = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: 'unauthenticated' });

    let uid;
    try {
        uid = (await getAuth().verifyIdToken(idToken)).uid;
    } catch {
        return res.status(401).json({ error: 'invalid_token' });
    }

    // Leitura de imagem é cara; segura o volume por usuário.
    const rl = await rateLimit(`mktphoto:${uid}`, { limit: 40, windowSec: 300 });
    if (!rl.ok) return res.status(429).json({ error: 'rate_limited' });

    const { image, mime } = req.body || {};
    const problema = validarEntrada(image, mime);
    if (problema) {
        // Tamanho é 413; tipo e ausência são 400. Códigos diferentes porque a
        // pessoa resolve cada um de um jeito.
        const status = problema.endsWith('_too_large') ? 413 : 400;
        return res.status(status).json({ error: problema });
    }

    const body = {
        contents: [{
            parts: [
                { text: ehPdf(mime) ? PROMPT_PDF : PROMPT },
                { inline_data: { mime_type: mime, data: image } },
            ],
        }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    };

    for (const model of GEMINI_MODELS) {
        let r, j;
        try {
            r = await fetch(`${geminiUrl(model)}?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            j = await r.json().catch(() => ({}));
        } catch {
            return res.status(502).json({ error: 'gemini_unreachable' });
        }

        // Chave sem acesso àquele modelo: tenta o próximo.
        const naoExiste = r.status === 404 || String(j?.error?.status || '').toUpperCase() === 'NOT_FOUND';
        if (naoExiste) continue;

        if (!r.ok) return res.status(502).json({ error: 'gemini_http_' + r.status });

        const texto = j?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
        const bruto = extrairJson(texto);
        if (!bruto) return res.status(422).json({ error: 'unreadable' });

        const dados = normalizar(bruto);
        if (!dados.items.length) return res.status(422).json({ error: 'no_items' });
        return res.status(200).json(dados);
    }

    return res.status(502).json({ error: 'no_model' });
}
