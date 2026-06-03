import { db, functions, auth } from './firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export async function createCheckoutSession(uid, priceId, onFinish) {
    // IMPORTANTE: A extensão oficial do Stripe geralmente olha para a coleção 'customers'
    const checkoutSessionsRef = collection(db, 'customers', uid, 'checkout_sessions');

    try {
        const docRef = await addDoc(checkoutSessionsRef, {
            price: priceId,
            success_url: window.location.origin,
            cancel_url: window.location.origin,
        });

        console.log("Sessão de checkout criada no Firestore, aguardando extensão...");

        // 2. Aguarda a extensão criar a URL da sessão
        const unsubscribe = onSnapshot(docRef, async (snap) => {
            const data = snap.data();
            if (!data) return;

            const { url, error } = data;

            if (error) {
                const errMsg = error.message || 'Erro desconhecido';
                console.error(`Stripe Extension Error: ${errMsg}`);

                // Trata erro específico de cliente inexistente (geralmente troca de ambiente Teste/Live)
                if (errMsg.toLowerCase().includes('no such customer')) {
                    try {
                        await deleteDoc(doc(db, 'customers', uid));
                        alert("Ocorreu um erro de sincronização com o Stripe. Limpamos seu perfil de pagamento antigo. Por favor, tente clicar em 'Ativar Minha Conta' novamente.");
                    } catch (delErr) {
                        console.error("Erro ao limpar perfil Stripe:", delErr);
                        alert(`Erro do Stripe: ${errMsg}`);
                    }
                } else {
                    alert(`Erro do Stripe: ${errMsg}`);
                }

                if (onFinish) onFinish();
                unsubscribe();
            }

            if (url) {
                console.log("Redirecionando para o Stripe Checkout...");
                window.location.assign(url);
                // Não cancelamos o listener aqui pois o redirecionamento vai recarregar a página
            }
        });
    } catch (err) {
        console.error("Error adding checkout session info:", err);
        if (onFinish) onFinish();
        throw err;
    }
}

/**
 * Faz upgrade/downgrade da assinatura EXISTENTE (troca o preço com proração),
 * via função serverless segura — sem criar uma segunda assinatura. Funciona mesmo
 * que Standard e Premium sejam preços do mesmo produto no Stripe.
 *
 * @param {string} priceId Preço alvo (Standard/Premium, mensal/anual).
 * @returns {Promise<object>} { success: true } em caso de sucesso.
 */
export async function upgradeSubscription(priceId) {
    const user = auth.currentUser;
    if (!user) throw new Error('Você precisa estar logado.');
    const idToken = await user.getIdToken();

    const resp = await fetch('/api/upgrade-subscription', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ priceId }),
    });

    let data = {};
    try { data = await resp.json(); } catch { /* ignore */ }
    if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível alterar o plano. Tente novamente.');
    }
    return data;
}

// Link estático do portal (fallback) — exige login por e-mail.
const PORTAL_LOGIN_LINK = "https://billing.stripe.com/p/login/00waEY8WW5ZK0V95TJ7kc00";

/**
 * Abre o Portal de Faturamento do Stripe já autenticado para o cliente logado,
 * usando a callable da extensão oficial "Run Payments with Stripe".
 *
 * @param {object} [opts]
 * @param {string} [opts.subscriptionId] ID da assinatura (p/ cancel ou update direto).
 * @param {boolean} [opts.cancel] Quando true, leva direto à tela de cancelamento.
 * @param {boolean} [opts.update] Quando true, leva direto à troca de plano (upgrade/downgrade)
 *                                da assinatura EXISTENTE — com proração, sem criar outra.
 * @param {Function} [opts.onFinish] Callback ao terminar (sucesso ou erro).
 */
export async function createPortalSession(opts = {}) {
    const { subscriptionId, cancel = false, update = false, onFinish } = opts;

    try {
        const createPortalLink = httpsCallable(
            functions,
            'ext-firestore-stripe-payments-createPortalLink'
        );

        const payload = {
            returnUrl: window.location.origin,
            // alguns ambientes esperam "return_url"
            return_url: window.location.origin,
        };

        // Leva direto à tela de cancelamento, se solicitado e possível.
        if (cancel && subscriptionId) {
            payload.flow_data = {
                type: 'subscription_cancel',
                subscription_cancel: { subscription: subscriptionId },
            };
        } else if (update && subscriptionId) {
            // Troca de plano na assinatura EXISTENTE (upgrade real, com proração).
            payload.flow_data = {
                type: 'subscription_update',
                subscription_update: { subscription: subscriptionId },
            };
        }

        const { data } = await createPortalLink(payload);
        const url = data?.url;
        if (!url) throw new Error('Portal sem URL retornada.');

        window.location.assign(url);
        if (onFinish) onFinish();
        return;
    } catch (err) {
        console.error('Erro ao criar sessão do portal Stripe (callable):', err);
        // Fallback: link estático do portal (login por e-mail).
        try {
            window.location.assign(PORTAL_LOGIN_LINK);
        } catch (e) {
            console.error('Erro no fallback do portal:', e);
            alert('Não foi possível abrir o portal de faturamento. Tente novamente.');
        }
        if (onFinish) onFinish();
    }
}
