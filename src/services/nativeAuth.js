import { Capacitor } from '@capacitor/core';
import { signInWithPopup, signInWithCredential, reauthenticateWithCredential, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

// Login Google ciente de plataforma:
// - App nativo (Android/iOS via Capacitor): login nativo do Google — o popup web
//   NÃO funciona dentro da WebView. Conclui a sessão no Firebase JS SDK para que o
//   resto do app (onAuthStateChanged, listeners) funcione igual ao web.
// - Navegador / PWA: mantém o signInWithPopup que já funcionava.
export async function signInWithGoogle() {
    if (!auth) return;

    if (Capacitor.isNativePlatform()) {
        // Importado dinamicamente para não entrar/pesar no bundle web.
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        const result = await FirebaseAuthentication.signInWithGoogle();
        const idToken = result?.credential?.idToken;
        if (!idToken) throw new Error('Login Google nativo não retornou idToken.');
        const credential = GoogleAuthProvider.credential(idToken, result?.credential?.accessToken);
        await signInWithCredential(auth, credential);
        return;
    }

    await signInWithPopup(auth, googleProvider);
}

// Reautenticação Google ciente de plataforma (para ações sensíveis: trocar dados,
// excluir conta). No app nativo usa o login nativo; no web, o popup.
export async function reauthenticateWithGoogle(user) {
    if (Capacitor.isNativePlatform()) {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        const result = await FirebaseAuthentication.signInWithGoogle();
        const idToken = result?.credential?.idToken;
        if (!idToken) throw new Error('Reautenticação Google nativa não retornou idToken.');
        const credential = GoogleAuthProvider.credential(idToken, result?.credential?.accessToken);
        await reauthenticateWithCredential(user, credential);
        return;
    }
    await signInWithPopup(auth, googleProvider);
}

// Logout em ambas as plataformas (encerra também a sessão nativa do Google).
export async function signOutAll() {
    if (Capacitor.isNativePlatform()) {
        try {
            const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
            await FirebaseAuthentication.signOut();
        } catch { /* segue para o signOut do JS de qualquer forma */ }
    }
    if (auth) await signOut(auth);
}

// Conveniência: true quando rodando dentro do app nativo (Android/iOS).
export const isNativeApp = () => {
    try { return Capacitor.isNativePlatform(); } catch { return false; }
};
