import { db } from './firebase';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export async function createCheckoutSession(uid, priceId) {
    // IMPORTANTE: A extensão oficial do Stripe geralmente olha para a coleção 'customers'
    const checkoutSessionsRef = collection(db, 'customers', uid, 'checkout_sessions');
    const docRef = await addDoc(checkoutSessionsRef, {
        price: priceId,
        success_url: window.location.origin,
        cancel_url: window.location.origin,
    });

    console.log("Sessão de checkout criada no Firestore, aguardando extensão...");

    // 2. Aguarda a extensão criar a URL da sessão
    onSnapshot(docRef, async (snap) => {
        const data = snap.data();
        if (!data) return;

        const { url, error } = data;

        if (error) {
            console.error(`Stripe Extension Error: ${error.message}`);
            alert(`Erro do Stripe: ${error.message}`);
        }

        if (url) {
            console.log("Redirecionando para o Stripe Checkout...");
            window.location.assign(url);
        }
    });
}
