import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);

// ── Firebase App Check (INERTE por padrão) ──────────────────────────
// Só inicializa se VITE_APPCHECK_RECAPTCHA_KEY estiver definida. Sem a chave,
// nada muda no funcionamento atual. Depois de definir a chave (reCAPTCHA v3 do
// Firebase Console) E ativar o enforcement no console, só instâncias legítimas
// do app conseguem falar com Firestore/Auth. Comece o enforcement em modo
// "monitoramento" no console antes de exigir.
const appCheckKey = import.meta.env.VITE_APPCHECK_RECAPTCHA_KEY;
if (appCheckKey) {
    try {
        // Token de debug para DEV local (defina VITE_APPCHECK_DEBUG_TOKEN e
        // registre-o no console em App Check › Apps › Depurar).
        if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG_TOKEN) {
            self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
        }
        // Provedor: reCAPTCHA Enterprise (padrão atual do Google) ou v3 clássico.
        // Defina VITE_APPCHECK_PROVIDER='enterprise' para usar o Enterprise.
        const useEnterprise = String(import.meta.env.VITE_APPCHECK_PROVIDER || '').toLowerCase() === 'enterprise';
        const provider = useEnterprise
            ? new ReCaptchaEnterpriseProvider(appCheckKey)
            : new ReCaptchaV3Provider(appCheckKey);
        initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
    } catch (e) {
        console.warn('App Check não inicializado (seguindo sem enforcement):', e?.message);
    }
}
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
// Região padrão da extensão "Run Payments with Stripe" (firestore-stripe-payments).
export const functions = getFunctions(app, 'us-central1');
