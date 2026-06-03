import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

/**
 * Faz o UPGRADE/DOWNGRADE da assinatura EXISTENTE do usuário (troca o preço do
 * item da assinatura), com proração — em vez de criar uma segunda assinatura.
 *
 * Funciona mesmo que Standard e Premium sejam preços do MESMO produto no Stripe
 * (a limitação de "produtos diferentes" existe só no Portal do Cliente, não na API).
 *
 * Segurança: exige o ID token do Firebase no header Authorization. O preço alvo
 * é validado contra a allowlist (preços conhecidos do app). Só mexe na assinatura
 * do próprio usuário autenticado.
 *
 * Env vars necessárias na Vercel:
 *  - STRIPE_SECRET_KEY
 *  - FIREBASE_SERVICE_ACCOUNT_KEY (JSON do service account — já usado no send-push)
 *  - (opcional) VITE_STRIPE_PRICE_ID_STANDARD_MONTHLY / _STANDARD_YEARLY / _MONTHLY / _YEARLY
 */
export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        // .trim() evita falhas por espaço/quebra de linha colados junto da chave.
        const stripeSecret = (process.env.STRIPE_SECRET_KEY || '').trim();
        const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!stripeSecret || !saKey) {
            return res.status(500).json({ success: false, error: 'Faltam variáveis de ambiente (STRIPE_SECRET_KEY ou FIREBASE_SERVICE_ACCOUNT_KEY) na Vercel.' });
        }
        if (!stripeSecret.startsWith('sk_') && !stripeSecret.startsWith('rk_')) {
            return res.status(500).json({ success: false, error: 'STRIPE_SECRET_KEY invalida: deve comecar com sk_ (chave secreta) ou rk_ (chave restrita). Confira se nao colou a chave publicavel (pk_) ou o valor mascarado.' });
        }

        if (!getApps().length) {
            initializeApp({ credential: cert(JSON.parse(saKey)) });
        }
        // Retries e timeout explicitos para erros de rede transitorios.
        const stripe = new Stripe(stripeSecret, { maxNetworkRetries: 2, timeout: 20000 });
        const db = getFirestore();
        const auth = getAuth();

        // 1. Autenticação — valida o ID token do Firebase.
        const authHeader = req.headers.authorization || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!idToken) return res.status(401).json({ success: false, error: 'Não autenticado.' });

        let decoded;
        try {
            decoded = await auth.verifyIdToken(idToken);
        } catch {
            return res.status(401).json({ success: false, error: 'Sessão inválida. Faça login novamente.' });
        }
        const uid = decoded.uid;

        // 2. Preço alvo — só aceita preços conhecidos do app (allowlist).
        const { priceId } = req.body || {};
        const ALLOWED = [
            process.env.VITE_STRIPE_PRICE_ID_STANDARD_MONTHLY,
            process.env.VITE_STRIPE_PRICE_ID_STANDARD_YEARLY,
            process.env.VITE_STRIPE_PRICE_ID_MONTHLY,
            process.env.VITE_STRIPE_PRICE_ID_YEARLY,
        ].filter(Boolean);
        if (!priceId || (ALLOWED.length > 0 && !ALLOWED.includes(priceId))) {
            return res.status(400).json({ success: false, error: 'Preço inválido.' });
        }

        // 3. Encontra a assinatura ATIVA do usuário (Firestore da extensão Stripe).
        const subsRef = db.collection('customers').doc(uid).collection('subscriptions');
        const subsSnap = await subsRef.where('status', 'in', ['active', 'trialing']).get();
        if (subsSnap.empty) {
            return res.status(404).json({ success: false, error: 'Nenhuma assinatura ativa encontrada para este usuário.' });
        }
        const subId = subsSnap.docs[0].id; // doc id = ID da assinatura no Stripe

        // 4. Troca o preço do item da assinatura, com proração.
        const sub = await stripe.subscriptions.retrieve(subId);
        const itemId = sub.items.data[0].id;

        // Se já está no preço alvo, não faz nada.
        if (sub.items.data[0].price?.id === priceId) {
            return res.status(200).json({ success: true, alreadyOnPlan: true });
        }

        await stripe.subscriptions.update(subId, {
            items: [{ id: itemId, price: priceId }],
            proration_behavior: 'create_prorations',
            cancel_at_period_end: false,
        });

        return res.status(200).json({ success: true });
    } catch (e) {
        console.error('upgrade-subscription error:', e?.type, e?.message, e);
        // Mensagens mais claras por tipo de erro do Stripe.
        if (e?.type === 'StripeAuthenticationError') {
            return res.status(500).json({ success: false, error: 'Chave secreta do Stripe invalida ou sem permissao (StripeAuthenticationError). Verifique a STRIPE_SECRET_KEY na Vercel.' });
        }
        if (e?.type === 'StripeConnectionError') {
            return res.status(502).json({ success: false, error: 'Falha de conexao com o Stripe (StripeConnectionError). Geralmente e chave invalida/mascarada ou instabilidade momentanea. Tente de novo; se persistir, confira a STRIPE_SECRET_KEY.' });
        }
        return res.status(500).json({ success: false, error: e?.message || 'Erro ao atualizar a assinatura.' });
    }
}
