import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { auth, db, googleProvider, firebaseReady } from './services/firebase.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

// Coleções do usuário que o app mobile escuta (mesmo banco do site).
const COLLECTIONS = ['transactions', 'savings_jars', 'cards', 'subscriptions'];

export function StoreProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState({ transactions: [], savings_jars: [], cards: [], subscriptions: [] });
  const [prefs, setPrefs] = useState({});

  // Autenticação (mesma do site — Firebase Auth, login Google).
  useEffect(() => {
    if (!firebaseReady) { setAuthReady(true); return; }
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthReady(true); });
    return () => unsub();
  }, []);

  // Escuta em tempo real os dados do usuário logado.
  useEffect(() => {
    if (!firebaseReady || !user) {
      setData({ transactions: [], savings_jars: [], cards: [], subscriptions: [] });
      setPrefs({});
      return;
    }
    const unsubs = COLLECTIONS.map(col => {
      const q = query(collection(db, col), where('userId', '==', user.uid));
      return onSnapshot(q, (snap) => {
        setData(prev => ({ ...prev, [col]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      }, () => {});
    });
    // Preferências (users/{uid}/settings/general) — renda base e regime de apuração.
    const unsubPrefs = onSnapshot(
      doc(db, 'users', user.uid, 'settings', 'general'),
      (snap) => { if (snap.exists()) setPrefs(snap.data()); },
      () => {}
    );
    return () => { unsubs.forEach(u => u()); unsubPrefs(); };
  }, [user]);

  const login = () => firebaseReady && signInWithPopup(auth, googleProvider);
  const logout = () => firebaseReady && signOut(auth);

  return (
    <Ctx.Provider value={{ user, authReady, firebaseReady, login, logout, ...data, prefs }}>
      {children}
    </Ctx.Provider>
  );
}
