import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, updateProfile } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, firebaseReady } from './services/firebase.js';
import { DEMO } from './data/sample.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const COLLECTIONS = ['transactions', 'savings_jars', 'cards', 'subscriptions'];
const EMPTY = { transactions: [], savings_jars: [], cards: [], subscriptions: [] };

export function StoreProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState(EMPTY);
  const [prefs, setPrefs] = useState({});
  const [demo, setDemo] = useState(false);

  // Autenticação real (mesma do site — Firebase Auth, login Google).
  useEffect(() => {
    if (demo) return;
    if (!firebaseReady) { setAuthReady(true); return; }
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthReady(true); });
    return () => unsub();
  }, [demo]);

  // Escuta em tempo real os dados do usuário logado.
  useEffect(() => {
    if (demo || !firebaseReady || !user) { setData(EMPTY); setPrefs({}); return; }
    const unsubs = COLLECTIONS.map(col => {
      const q = query(collection(db, col), where('userId', '==', user.uid));
      return onSnapshot(q, (snap) => {
        setData(prev => ({ ...prev, [col]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      }, () => {});
    });
    const unsubPrefs = onSnapshot(
      doc(db, 'users', user.uid, 'settings', 'general'),
      (snap) => { if (snap.exists()) setPrefs(snap.data()); },
      () => {}
    );
    return () => { unsubs.forEach(u => u()); unsubPrefs(); };
  }, [user, demo]);

  const login = () => firebaseReady && signInWithPopup(auth, googleProvider);
  const enterDemo = () => setDemo(true);
  const logout = () => { if (demo) { setDemo(false); return; } if (firebaseReady) signOut(auth); };

  // Salva preferências em users/{uid}/settings/general (merge). No demo, atualiza local.
  const [demoPrefs, setDemoPrefs] = useState(null);
  const savePref = async (partial) => {
    if (demo) { setDemoPrefs(prev => ({ ...(prev || DEMO.prefs), ...partial })); return; }
    if (!firebaseReady || !user) return;
    try { await setDoc(doc(db, 'users', user.uid, 'settings', 'general'), partial, { merge: true }); } catch (e) { console.error(e); }
  };
  const updateName = async (name) => {
    if (demo || !firebaseReady || !auth?.currentUser) return;
    try { await updateProfile(auth.currentUser, { displayName: name }); setUser({ ...auth.currentUser }); } catch (e) { console.error(e); }
  };

  // No modo demonstração, servimos os dados de exemplo (sem Firebase).
  const value = demo
    ? { user: DEMO.user, authReady: true, firebaseReady, demo: true, login, enterDemo, logout, savePref, updateName, ...DEMO, prefs: demoPrefs || DEMO.prefs }
    : { user, authReady, firebaseReady, demo: false, login, enterDemo, logout, savePref, updateName, ...data, prefs };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
