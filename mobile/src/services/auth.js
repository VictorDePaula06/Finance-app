import { Capacitor } from '@capacitor/core';
import { signInWithPopup, signInWithCredential, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, googleProvider, firebaseReady } from './firebase.js';

// Login Google ciente de plataforma:
// - App nativo (Android/iOS via Capacitor): login nativo do Google (sem popup,
//   que não funciona dentro da WebView) e conclui a sessão no Firebase JS SDK,
//   para que o resto do app (onAuthStateChanged, listeners) funcione igual.
// - Navegador / PWA: mantém o signInWithPopup que já funcionava.
export async function signInWithGoogle() {
  if (!firebaseReady || !auth) return;

  if (Capacitor.isNativePlatform()) {
    // Importado dinamicamente para não entrar no bundle web.
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

// Logout em ambas as plataformas.
export async function signOutAll() {
  if (Capacitor.isNativePlatform()) {
    try {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      await FirebaseAuthentication.signOut();
    } catch { /* segue para o signOut do JS de qualquer forma */ }
  }
  if (auth) await signOut(auth);
}
