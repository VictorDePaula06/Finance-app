import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, updateProfile, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, firebaseReady } from './services/firebase.js';
import { signInWithGoogle, signOutAll } from './services/auth.js';
import { DEMO } from './data/sample.js';
import { buildTransactionDocs, buildCardDoc, buildInvestmentDoc, buildJarDoc, buildFixedIncomeDoc, buildFixedExpenseDoc, buildSubscriptionDoc } from './lib/db.js';
import { isoForMonthDay, computeCardInvoice } from './lib/finance.js';
import { computePlanLevel, isPremiumLevel } from './lib/plan.js';
import { CURRENT_TERMS_VERSION } from './lib/terms.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

// Converte texto "1.234,56" → 1234.56 (mesma regra dos builders).
const numBR = (v) => parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;

const COLLECTIONS = ['transactions', 'savings_jars', 'cards', 'subscriptions', 'investments', 'goals', 'fixed_incomes', 'fixed_expenses'];
const EMPTY = { transactions: [], savings_jars: [], cards: [], subscriptions: [], investments: [], goals: [], fixed_incomes: [], fixed_expenses: [] };

export function StoreProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState(EMPTY);
  const [prefs, setPrefs] = useState({});
  const [demo, setDemo] = useState(false);
  // No modo demonstração os dados ficam em memória (permite criar/excluir sem Firebase).
  const [demoData, setDemoData] = useState(EMPTY);
  const [authError, setAuthError] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  // Plano do usuário (mesma fonte do site): doc users/{uid} + customers/{uid}/subscriptions.
  const [userDoc, setUserDoc] = useState(null);
  const [stripeSubs, setStripeSubs] = useState([]);

  // Autenticação real (mesma do site — Firebase Auth, login Google).
  useEffect(() => {
    if (demo) return;
    if (!firebaseReady) { setAuthReady(true); return; }
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthReady(true); });
    return () => unsub();
  }, [demo]);

  // Garante o documento users/{uid} no primeiro acesso (igual ao site). Sem ele,
  // o painel admin marca o usuário como "excluído" (userSnap.exists() === false).
  useEffect(() => {
    if (demo || !firebaseReady || !user) return;
    (async () => {
      try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        const d = snap.exists() ? snap.data() : {};
        const update = { email: user.email, uid: user.uid, lastLogin: new Date() };
        if (!d.createdAt) update.createdAt = user.metadata?.creationTime || new Date().toISOString();
        if (!d.trialStartDate) update.trialStartDate = new Date();
        await setDoc(ref, update, { merge: true });
      } catch (e) { console.error('ensureUserDoc', e); }
    })();
  }, [user, demo]);

  // Escuta em tempo real os dados do usuário logado.
  useEffect(() => {
    if (demo || !firebaseReady || !user) { setData(EMPTY); setPrefs({}); setPrefsLoaded(false); return; }
    const unsubs = COLLECTIONS.map(col => {
      const q = query(collection(db, col), where('userId', '==', user.uid));
      return onSnapshot(q, (snap) => {
        setData(prev => ({ ...prev, [col]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      }, () => {});
    });
    const unsubPrefs = onSnapshot(
      doc(db, 'users', user.uid, 'settings', 'general'),
      (snap) => { setPrefs(snap.exists() ? snap.data() : {}); setPrefsLoaded(true); },
      () => { setPrefsLoaded(true); }
    );
    // Plano: doc do usuário (subscription.status lifetime) + assinaturas Stripe.
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => setUserDoc(snap.exists() ? snap.data() : null), () => {});
    const unsubSubs = onSnapshot(collection(db, 'customers', user.uid, 'subscriptions'),
      (snap) => setStripeSubs(snap.docs.map(d => d.data())), () => setStripeSubs([]));
    return () => { unsubs.forEach(u => u()); unsubPrefs(); unsubUser(); unsubSubs(); };
  }, [user, demo]);

  const login = async () => {
    if (!firebaseReady) return;
    setAuthError(null);
    setAuthBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error('login', e);
      const code = e?.code ? `[${e.code}] ` : '';
      setAuthError(`${code}${e?.message || String(e) || 'Falha no login.'}`);
    } finally {
      setAuthBusy(false);
    }
  };
  // Login/cadastro/reset por e-mail e senha (Firebase Auth). Lançam o erro para
  // a tela de login mostrar a mensagem amigável (mapeada por código).
  const loginEmail = (email, password) => signInWithEmailAndPassword(auth, String(email).trim(), password);
  const signupEmail = (email, password) => createUserWithEmailAndPassword(auth, String(email).trim(), password);
  const resetPassword = (email) => sendPasswordResetEmail(auth, String(email).trim());

  const enterDemo = () => {
    setDemoData({
      transactions: [...(DEMO.transactions || [])],
      savings_jars: [...(DEMO.savings_jars || [])],
      cards: [...(DEMO.cards || [])],
      subscriptions: [...(DEMO.subscriptions || [])],
      investments: [...(DEMO.investments || [])],
      goals: [...(DEMO.goals || [])],
      fixed_incomes: [...(DEMO.fixed_incomes || [])],
      fixed_expenses: [...(DEMO.fixed_expenses || [])],
    });
    setDemo(true);
  };
  const logout = () => { if (demo) { setDemo(false); return; } if (firebaseReady) signOutAll(); };

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

  // ----- Recebimentos fixos, contas fixas e assinaturas (templates) -----

  const addFixedIncome = async (input) => {
    const uid = demo ? (DEMO.user?.uid || 'demo') : user?.uid;
    const docData = buildFixedIncomeDoc(input, uid);
    if (demo) { setDemoData(prev => ({ ...prev, fixed_incomes: [...prev.fixed_incomes, { id: `demo_${Date.now()}`, ...docData }] })); return true; }
    if (!firebaseReady || !user) return false;
    try { await addDoc(collection(db, 'fixed_incomes'), docData); return true; }
    catch (e) { console.error('addFixedIncome', e); return false; }
  };
  const deleteFixedIncome = async (id) => {
    if (demo) { setDemoData(prev => ({ ...prev, fixed_incomes: prev.fixed_incomes.filter(x => x.id !== id) })); return true; }
    if (!firebaseReady || !user) return false;
    try { await deleteDoc(doc(db, 'fixed_incomes', id)); return true; }
    catch (e) { console.error('deleteFixedIncome', e); return false; }
  };

  const addFixedExpense = async (input) => {
    const uid = demo ? (DEMO.user?.uid || 'demo') : user?.uid;
    const docData = buildFixedExpenseDoc(input, uid);
    if (demo) { setDemoData(prev => ({ ...prev, fixed_expenses: [...prev.fixed_expenses, { id: `demo_${Date.now()}`, ...docData }] })); return true; }
    if (!firebaseReady || !user) return false;
    try { await addDoc(collection(db, 'fixed_expenses'), docData); return true; }
    catch (e) { console.error('addFixedExpense', e); return false; }
  };
  const deleteFixedExpense = async (id) => {
    if (demo) { setDemoData(prev => ({ ...prev, fixed_expenses: prev.fixed_expenses.filter(x => x.id !== id) })); return true; }
    if (!firebaseReady || !user) return false;
    try { await deleteDoc(doc(db, 'fixed_expenses', id)); return true; }
    catch (e) { console.error('deleteFixedExpense', e); return false; }
  };

  // Confirma o recebimento de um fixo no mês: lança a entrada (isFixed) e marca
  // o mês no template (mesmo comportamento do site, FixedIncomesTab.handleConfirm).
  const confirmFixedIncome = async (inc, monthKey, value) => {
    const uid = demo ? (DEMO.user?.uid || 'demo') : user?.uid;
    const amount = (value != null && value !== '') ? numBR(value) : (parseFloat(inc.value) || 0);
    if (amount <= 0) return false;
    const date = isoForMonthDay(monthKey, inc.day);
    const tx = {
      description: String(inc.name || '').trim(), amount, type: 'income',
      category: inc.category || 'salary', date, month: monthKey,
      userId: uid, createdAt: Date.now(), isFixed: true, paymentMethod: 'pix',
    };
    if (demo) {
      setDemoData(prev => ({
        ...prev,
        transactions: [{ id: `demo_${Date.now()}`, ...tx }, ...prev.transactions],
        fixed_incomes: prev.fixed_incomes.map(f => f.id === inc.id ? { ...f, lastReceivedMonth: monthKey, lastReceivedValue: amount } : f),
      }));
      return true;
    }
    if (!firebaseReady || !user) return false;
    try {
      await addDoc(collection(db, 'transactions'), tx);
      await setDoc(doc(db, 'fixed_incomes', inc.id), { lastReceivedMonth: monthKey, lastReceivedValue: amount }, { merge: true });
      return true;
    } catch (e) { console.error('confirmFixedIncome', e); return false; }
  };

  // Confirma o pagamento de uma conta fixa no mês (FixedExpensesTab.executePayExpense).
  const confirmFixedExpense = async (exp, monthKey, value) => {
    const uid = demo ? (DEMO.user?.uid || 'demo') : user?.uid;
    const amount = (value != null && value !== '') ? numBR(value) : (parseFloat(exp.value) || 0);
    if (amount <= 0) return false;
    const date = isoForMonthDay(monthKey, exp.day);
    const tx = {
      description: String(exp.name || '').trim(), amount, type: 'expense',
      category: exp.category || 'housing', date, month: monthKey,
      userId: uid, createdAt: Date.now(), isFixed: true, paymentMethod: 'pix',
      priority: exp.priority || 'essential',
    };
    const patch = { lastPaidMonth: monthKey };
    if (exp.isVariable) { patch.lastPaidValue = amount; patch.lastPaidValueMonth = monthKey; }
    if (demo) {
      setDemoData(prev => ({
        ...prev,
        transactions: [{ id: `demo_${Date.now()}`, ...tx }, ...prev.transactions],
        fixed_expenses: prev.fixed_expenses.map(f => f.id === exp.id ? { ...f, ...patch } : f),
      }));
      return true;
    }
    if (!firebaseReady || !user) return false;
    try {
      await addDoc(collection(db, 'transactions'), tx);
      await setDoc(doc(db, 'fixed_expenses', exp.id), patch, { merge: true });
      return true;
    } catch (e) { console.error('confirmFixedExpense', e); return false; }
  };

  const addSubscription = async (input) => {
    const uid = demo ? (DEMO.user?.uid || 'demo') : user?.uid;
    const docData = buildSubscriptionDoc(input, uid, data.cards || demoData.cards || []);
    if (demo) { setDemoData(prev => ({ ...prev, subscriptions: [...prev.subscriptions, { id: `demo_${Date.now()}`, ...docData }] })); return true; }
    if (!firebaseReady || !user) return false;
    try { await addDoc(collection(db, 'subscriptions'), docData); return true; }
    catch (e) { console.error('addSubscription', e); return false; }
  };
  const deleteSubscription = async (id) => {
    if (demo) { setDemoData(prev => ({ ...prev, subscriptions: prev.subscriptions.filter(x => x.id !== id) })); return true; }
    if (!firebaseReady || !user) return false;
    try { await deleteDoc(doc(db, 'subscriptions', id)); return true; }
    catch (e) { console.error('deleteSubscription', e); return false; }
  };
  // Edita os campos de uma assinatura (nome, valor, cartão, categoria, dia).
  const updateSubscription = async (id, input) => {
    const cardsList = data.cards || demoData.cards || [];
    let day = parseInt(input.day) || 1;
    if (input.cardId) { const c = cardsList.find(x => x.id === input.cardId); if (c) day = parseInt(c.dueDay) || day; }
    const patch = {
      name: String(input.name || '').trim(),
      value: numBR(input.value),
      cardId: input.cardId || '',
      category: input.category || 'subscriptions',
      priority: input.priority || 'comfort',
      day: Math.min(31, Math.max(1, day)),
    };
    if (demo) { setDemoData(prev => ({ ...prev, subscriptions: prev.subscriptions.map(s => s.id === id ? { ...s, ...patch } : s) })); return true; }
    if (!firebaseReady || !user) return false;
    try { await setDoc(doc(db, 'subscriptions', id), patch, { merge: true }); return true; }
    catch (e) { console.error('updateSubscription', e); return false; }
  };

  // Paga a fatura do cartão (FixedExpensesTab.executePayInvoice do site):
  //  1) lança "Pagamento de Fatura" (category credit_card_bill, afeta a carteira);
  //  2) marca as compras não pagas como invoiceStatus 'paid';
  //  3) assinaturas: recorrente → lastPaidMonth; parcela → avança/encerra.
  const payCardInvoice = async (card) => {
    const uid = demo ? (DEMO.user?.uid || 'demo') : user?.uid;
    const txSource = demo ? demoData.transactions : (data.transactions || []);
    const subSource = demo ? demoData.subscriptions : (data.subscriptions || []);
    const { total, unpaid, subs, currInv } = computeCardInvoice(card, subSource, txSource);
    if (total <= 0.005) return false;
    const now = new Date();
    const billTx = {
      description: `Pagamento de Fatura - ${card.name || 'Cartão'}`,
      amount: total, type: 'expense', category: 'credit_card_bill',
      date: now.toISOString(), month: now.toISOString().slice(0, 7),
      invoiceMonthPaid: currInv, createdAt: Date.now(), paymentMethod: 'pix',
      selectedCardId: card.id, userId: uid,
    };
    const advanceSub = (s) => {
      if (s.type === 'installment') {
        const next = (s.currentInstallment || 1) + 1;
        return next > (s.totalInstallments || 1) ? null : { ...s, currentInstallment: next };
      }
      return { ...s, lastPaidMonth: currInv };
    };
    if (demo) {
      const paidIds = new Set(unpaid.map(t => t.id));
      const subIds = new Set(subs.map(s => s.id));
      setDemoData(prev => ({
        ...prev,
        transactions: [{ id: `demo_${Date.now()}`, ...billTx },
          ...prev.transactions.map(t => paidIds.has(t.id) ? { ...t, invoiceStatus: 'paid', paidInInvoice: currInv } : t)],
        subscriptions: prev.subscriptions.flatMap(s => {
          if (!subIds.has(s.id)) return [s];
          const nx = advanceSub(s);
          return nx ? [nx] : [];
        }),
      }));
      return true;
    }
    if (!firebaseReady || !user) return false;
    try {
      await addDoc(collection(db, 'transactions'), billTx);
      await Promise.all(unpaid.map(t => setDoc(doc(db, 'transactions', t.id), { invoiceStatus: 'paid', paidInInvoice: currInv }, { merge: true })));
      await Promise.all(subs.map(s => {
        const nx = advanceSub(s);
        if (!nx) return deleteDoc(doc(db, 'subscriptions', s.id));
        if (s.type === 'installment') return setDoc(doc(db, 'subscriptions', s.id), { currentInstallment: nx.currentInstallment }, { merge: true });
        return setDoc(doc(db, 'subscriptions', s.id), { lastPaidMonth: currInv }, { merge: true });
      }));
      return true;
    } catch (e) { console.error('payCardInvoice', e); return false; }
  };

  // ----- Patrimônio: investimentos e reservas -----

  const addInvestment = async (input) => {
    const uid = demo ? (DEMO.user?.uid || 'demo') : user?.uid;
    const docData = buildInvestmentDoc(input, uid);
    if (demo) { setDemoData(prev => ({ ...prev, investments: [...prev.investments, { id: `demo_${Date.now()}`, ...docData }] })); return true; }
    if (!firebaseReady || !user) return false;
    try { await addDoc(collection(db, 'investments'), docData); return true; }
    catch (e) { console.error('addInvestment', e); return false; }
  };

  const deleteInvestment = async (id) => {
    if (demo) { setDemoData(prev => ({ ...prev, investments: prev.investments.filter(i => i.id !== id) })); return true; }
    if (!firebaseReady || !user) return false;
    try { await deleteDoc(doc(db, 'investments', id)); return true; }
    catch (e) { console.error('deleteInvestment', e); return false; }
  };

  const addJar = async (input) => {
    const uid = demo ? (DEMO.user?.uid || 'demo') : user?.uid;
    const docData = buildJarDoc(input, uid);
    if (demo) { setDemoData(prev => ({ ...prev, savings_jars: [...prev.savings_jars, { id: `demo_${Date.now()}`, ...docData }] })); return true; }
    if (!firebaseReady || !user) return false;
    try { await addDoc(collection(db, 'savings_jars'), docData); return true; }
    catch (e) { console.error('addJar', e); return false; }
  };

  // Deposita (+) ou resgata (−) de um cofre, atualizando o saldo e a data.
  const adjustJar = async (id, delta) => {
    const apply = (j) => ({ ...j, balance: Math.max(0, (parseFloat(j.balance) || 0) + delta), updatedAt: new Date().toISOString() });
    if (demo) { setDemoData(prev => ({ ...prev, savings_jars: prev.savings_jars.map(j => j.id === id ? apply(j) : j) })); return true; }
    if (!firebaseReady || !user) return false;
    const jar = (data.savings_jars || []).find(j => j.id === id);
    if (!jar) return false;
    try { await setDoc(doc(db, 'savings_jars', id), { balance: Math.max(0, (parseFloat(jar.balance) || 0) + delta), updatedAt: new Date().toISOString() }, { merge: true }); return true; }
    catch (e) { console.error('adjustJar', e); return false; }
  };

  const deleteJar = async (id) => {
    if (demo) { setDemoData(prev => ({ ...prev, savings_jars: prev.savings_jars.filter(j => j.id !== id) })); return true; }
    if (!firebaseReady || !user) return false;
    try { await deleteDoc(doc(db, 'savings_jars', id)); return true; }
    catch (e) { console.error('deleteJar', e); return false; }
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

  // Registra o aceite dos Termos (mesmo formato do site): grava em settings/general
  // e loga em users/{uid}/terms_log (LGPD).
  const acceptTerms = async () => {
    const acceptedAt = new Date().toISOString();
    await savePref({ hasAcceptedTerms: true, termsVersion: CURRENT_TERMS_VERSION, termsAcceptedAt: acceptedAt });
    if (!demo && firebaseReady && user) {
      try { await addDoc(collection(db, 'users', user.uid, 'terms_log'), { termsVersion: CURRENT_TERMS_VERSION, acceptedAt }); } catch (e) { console.error('terms_log', e); }
    }
  };

  const actions = { login, loginEmail, signupEmail, resetPassword, enterDemo, logout, savePref, updateName, acceptTerms, addTransaction, addCard, deleteTransaction, deleteCard, addInvestment, deleteInvestment, addJar, adjustJar, deleteJar, addFixedIncome, deleteFixedIncome, addFixedExpense, deleteFixedExpense, confirmFixedIncome, confirmFixedExpense, addSubscription, deleteSubscription, updateSubscription, payCardInvoice, authError, authBusy };

  // Plano do usuário (free/standard/premium/lifetime) — mesma régua do site.
  const plan = demo ? (DEMO.plan || 'free') : computePlanLevel({ email: user?.email, userDoc, stripeSubs });
  const isPremium = isPremiumLevel(plan);

  // No modo demonstração, servimos os dados de exemplo (em memória, editáveis).
  const value = demo
    ? { user: DEMO.user, authReady: true, firebaseReady, demo: true, prefsLoaded: true, plan, isPremium, ...actions, ...demoData, prefs: demoPrefs || DEMO.prefs }
    : { user, authReady, firebaseReady, demo: false, prefsLoaded, plan, isPremium, ...actions, ...data, prefs };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
