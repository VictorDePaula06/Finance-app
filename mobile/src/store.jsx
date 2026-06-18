import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, updateProfile } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, setDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, googleProvider, firebaseReady } from './services/firebase.js';
import { DEMO } from './data/sample.js';
import { buildTransactionDocs, buildCardDoc } from './lib/db.js';

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
  // No modo demonstração os dados ficam em memória (permite criar/excluir sem Firebase).
  const [demoData, setDemoData] = useState(EMPTY);

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
  const enterDemo = () => {
    setDemoData({
      transactions: [...(DEMO.transactions || [])],
      savings_jars: [...(DEMO.savings_jars || [])],
      cards: [...(DEMO.cards || [])],
      subscriptions: [...(DEMO.subscriptions || [])],
    });
    setDemo(true);
  };
  const logout = () => { if (demo) { setDemo(false); return; } if (firebaseReady) signOut(auth); };

  // ----- Escrita (mesmo banco do site) -----

  // Cria uma transação (receita/despesa, inclusive compra no crédito).
  // Pode gerar vários documentos: parcelamento (N meses) ou despesa fixa (12 meses).
  const addTransaction = async (input) => {
    const uid = demo ? (DEMO.user?.uid || 'demo') : user?.uid;
    if (!uid && !demo) return false;
    const docs = buildTransactionDocs(input, uid);
    if (demo) {
      const withIds = docs.map((d, i) => ({ id: `demo_${Date.now()}_${i}`, ...d }));
      setDemoData(prev => ({ ...prev, transactions: [...withIds, ...prev.transactions] }));
      return true;
    }
    if (!firebaseReady || !user) return false;
    try { await Promise.all(docs.map(d => addDoc(collection(db, 'transactions'), d))); return true; }
    catch (e) { console.error('addTransaction', e); return false; }
  };

  // Cria um cartão.
  const addCard = async (input) => {
    const uid = demo ? (DEMO.user?.uid || 'demo') : user?.uid;
    const docData = buildCardDoc(input, uid);
    if (demo) {
      setDemoData(prev => ({ ...prev, cards: [...prev.cards, { id: `demo_${Date.now()}`, ...docData }] }));
      return true;
    }
    if (!firebaseReady || !user) return false;
    try { await addDoc(collection(db, 'cards'), docData); return true; }
    catch (e) { console.error('addCard', e); return false; }
  };

  // Exclui uma transação.
  const deleteTransaction = async (id) => {
    if (demo) { setDemoData(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) })); return true; }
    if (!firebaseReady || !user) return false;
    try { await deleteDoc(doc(db, 'transactions', id)); return true; }
    catch (e) { console.error('deleteTransaction', e); return false; }
  };

  // Exclui um cartão.
  const deleteCard = async (id) => {
    if (demo) { setDemoData(prev => ({ ...prev, cards: prev.cards.filter(c => c.id !== id) })); return true; }
    if (!firebaseReady || !user) return false;
    try { await deleteDoc(doc(db, 'cards', id)); return true; }
    catch (e) { console.error('deleteCard', e); return false; }
  };

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

  const actions = { login, enterDemo, logout, savePref, updateName, addTransaction, addCard, deleteTransaction, deleteCard };

  // No modo demonstração, servimos os dados de exemplo (em memória, editáveis).
  const value = demo
    ? { user: DEMO.user, authReady: true, firebaseReady, demo: true, ...actions, ...demoData, prefs: demoPrefs || DEMO.prefs }
    : { user, authReady, firebaseReady, demo: false, ...actions, ...data, prefs };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
