import { db } from './firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
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
                console.error(`Stripe Extension Error: ${error.message}`);

                // Trata erro específico de cliente inexistente (geralmente troca de ambiente Teste/Live)
                if (error.message.toLowerCase().includes('no such customer')) {
                    try {
                        await deleteDoc(doc(db, 'customers', uid));
                        alert("Ocorreu um erro de sincronização com o Stripe. Limpamos seu perfil de pagamento antigo. Por favor, tente clicar em 'Ativar Minha Conta' novamente.");
                    } catch (delErr) {
                        console.error("Erro ao limpar perfil Stripe:", delErr);
                        alert(`Erro do Stripe: ${error.message}`);
                    }
                } else {
                    alert(`Erro do Stripe: ${error.message}`);
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

export async function createPortalSession(uid, onFinish) {
    // Usando o link oficial do portal que você ativou no dashboard
    const PORTAL_LINK = "https://billing.stripe.com/p/login/00waEY8WW5ZK0V95TJ7kc00";
    
    console.log("Abrindo Portal do Cliente (Link Oficial)...");
    
    try {
        // Redireciona diretamente para o link do portal
        window.location.assign(PORTAL_LINK);
        if (onFinish) onFinish();
    } catch (err) {
        console.error("Erro ao abrir portal:", err);
        alert("Não foi possível abrir o portal. Verifique sua conexão.");
        if (onFinish) onFinish();
    }
}
