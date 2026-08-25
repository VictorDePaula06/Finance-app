import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Cria o checkout do plano ANUAL como PAGAMENTO ÚNICO (mode: 'payment'), com
 * PARCELAMENTO em até 12x habilitado (payment_method_options.card.installments).
 *
 * A extensão do Firebase só cria checkout de assinatura e não repassa a opção de
 * parcelamento — por isso o anual passa por aqui. O pagamento avulso bem-sucedido
 * é gravado pela extensão em customers/{uid}/payments (via webhook), e o app libera
 * o Pro por 365 dias a partir da compra (ver AuthContext).
 *
 * IMPORTANTE: NÃO usamos firebase-admin/auth (verifyIdToken) porque ele puxa
 * jwks-rsa → jose via require(), que quebra fora do Node 22.12+ (ERR_REQUIRE_ESM).
 * Verificamos o ID token direto com jose (import ESM), usando as chaves públicas
 * do Firebase — sem depender da versão do Node.
 *
 * Env vars (Vercel): STRIPE_SECRET_KEY, FIREBASE_SERVICE_ACCOUNT_KEY,
 *   (opcional) VITE_STRIPE_PRICE_ID_ANNUAL_ONETIME.
 */

// JWKS público do Firebase (formato JWK) — usado p/ validar o ID token.
const FIREBASE_JWKS = createRemoteJWKSet(
    new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

async function verifyFirebaseToken(idToken, projectId) {
    const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
    });
    if (!payload.sub) throw new Error('Token sem sub');
    return payload; // uid = payload.sub, email = payload.email
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const stripeSecret = (process.env.STRIPE_SECRET_KEY || '').trim();
        const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!stripeSecret || !saKey) {
            return res.status(500).json({ success: false, error: 'Faltam variáveis de ambiente (STRIPE_SECRET_KEY ou FIREBASE_SERVICE_ACCOUNT_KEY) na Vercel.' });
        }
        if (!stripeSecret.startsWith('sk_') && !stripeSecret.startsWith('rk_')) {
            return res.status(500).json({ success: false, error: 'STRIPE_SECRET_KEY inválida: deve começar com sk_ ou rk_.' });
        }

        const saParsed = JSON.parse(saKey);
        if (!getApps().length) initializeApp({ credential: cert(saParsed) });
        const stripe = new Stripe(stripeSecret, { maxNetworkRetries: 2, timeout: 20000 });
        const db = getFirestore();
        const projectId = saParsed.project_id;

        // 1. Autenticação — valida o ID token do Firebase (via jose, sem jwks-rsa).
        const authHeader = req.headers.authorization || '';
        const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!idToken) return res.status(401).json({ success: false, error: 'Não autenticado.' });
        let decoded;
        try { decoded = await verifyFirebaseToken(idToken, projectId); }
        catch (e) { console.error('token verify falhou:', e?.message); return res.status(401).json({ success: false, error: 'Sessão inválida. Faça login novamente.' }); }
        const uid = decoded.sub;
        const email = decoded.email;

        const ANNUAL_PRICE = (process.env.VITE_STRIPE_PRICE_ID_ANNUAL_ONETIME || 'price_1U8IWWKAwb86obAGMUt1Jn4Q').trim();

        // 2. Cliente Stripe do usuário (mesmo que a extensão usa, p/ o pagamento
        //    ser mapeado de volta pra customers/{uid}/payments).
        const custRef = db.collection('customers').doc(uid);
        const custDoc = await custRef.get();
        let customerId = custDoc.exists ? (custDoc.data().stripeId || null) : null;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: email || undefined,
                metadata: { firebaseUID: uid },
            });
            customerId = customer.id;
            await custRef.set({ stripeId: customerId }, { merge: true });
        }

        // 3. URLs de retorno (origem do site).
        const origin = (req.body?.origin || req.headers.origin || 'https://soualivia.com.br').replace(/\/$/, '');

        const baseParams = {
            mode: 'payment',
            customer: customerId,
            client_reference_id: uid,
            line_items: [{ price: ANNUAL_PRICE, quantity: 1 }],
            payment_method_types: ['card'],
            success_url: `${origin}/assinatura?checkout=success`,
            cancel_url: `${origin}/assinatura?checkout=cancel`,
            metadata: { firebaseUID: uid, plan: 'pro_annual_onetime' },
            payment_intent_data: { metadata: { firebaseUID: uid, plan: 'pro_annual_onetime' } },
        };

        // 4. Cria a sessão COM parcelamento; se a conta ainda não for elegível a
        //    installments, cai pro checkout à vista (não quebra a venda).
        let session;
        try {
            session = await stripe.checkout.sessions.create({
                ...baseParams,
                payment_method_options: { card: { installments: { enabled: true } } },
            });
        } catch (err) {
            if (/installment/i.test(err?.message || '')) {
                console.warn('[annual-checkout] Parcelamento indisponível na conta — criando à vista.', err?.message);
                session = await stripe.checkout.sessions.create(baseParams);
            } else {
                throw err;
            }
        }

        return res.status(200).json({ success: true, url: session.url });
    } catch (e) {
        console.error('create-annual-checkout error:', e?.type, e?.message, e);
        if (e?.type === 'StripeAuthenticationError') {
            return res.status(500).json({ success: false, error: 'Chave secreta do Stripe inválida (verifique STRIPE_SECRET_KEY na Vercel).' });
        }
        return res.status(500).json({ success: false, error: e?.message || 'Erro ao iniciar o pagamento anual.' });
    }
}
