import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { auth, googleProvider, db } from '../services/firebase';
import {
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    deleteUser,
    GoogleAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot, collection, query, where, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { log, maskEmail, maskUid } from '../utils/logger';
import { isAdminEmail, isLifetimeEmail } from '../constants/admins';
import { setGeminiKey, clearGeminiKey } from '../services/gemini';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

let globalMaxAccess = false;

// Logout único forçado (lançamento do billing): encerra as sessões ANTIGAS
// (login feito antes deste instante) de todos os usuários que NÃO são
// vitalícios/admins, para limpar acessos pagos antigos concedidos sem
// pagamento. Como comparamos o `lastSignInTime` com este corte:
//   • re-logins e NOVOS CADASTROS após o deploy passam (lastSignIn > corte);
//   • não há loop (ao reentrar, o lastSignIn fica > corte).
// Vitalícios/admins nunca são afetados.
const FORCE_LOGOUT_BEFORE = 1780485226320; // 2026-06-03T11:13:46Z

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isPremium, setIsPremium] = useState(false);
    const [isTrial, setIsTrial] = useState(false);
    const [isLifetime, setIsLifetime] = useState(false);
    const [subType, setSubType] = useState('monthly');
    const [daysRemaining, setDaysRemaining] = useState(0);
    const [planLevel, setPlanLevel] = useState('free'); // 'free' | 'standard' | 'premium'
    const [stripeSubId, setStripeSubId] = useState(null); // ID da assinatura Stripe ativa (p/ portal/cancelamento)
    const [userPrefs, setUserPrefs] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    // Usuário precisa escolher um plano antes de acessar o app
    // (true se nunca escolheu nada: nem free, nem standard, nem premium, nem lifetime, nem stripe).
    const [needsPlanSelection, setNeedsPlanSelection] = useState(false);
    const expiryTimeoutRef = useRef(null);

    // MODO DEV: Bypass de autenticação para localhost.
    // F-05: o bypass só vale se TODAS as condições baterem — não basta a env var.
    // Exige build de desenvolvimento (import.meta.env.DEV) E host local. Assim,
    // mesmo que VITE_USE_MOCK_AUTH vaze para um build de produção, o bypass fica inerte.
    const IS_LOCALHOST = typeof window !== 'undefined'
        && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
    const IS_DEV = import.meta.env.VITE_USE_MOCK_AUTH === 'true'
        && import.meta.env.DEV === true
        && IS_LOCALHOST;

    function signup(email, password) {
        return createUserWithEmailAndPassword(auth, email, password);
    }

    function login(email, password) {
        return signInWithEmailAndPassword(auth, email, password);
    }

    function loginWithGoogle() {
        return signInWithPopup(auth, googleProvider);
    }

    function logout() {
        if (currentUser) {
            localStorage.removeItem(`isPremium_${currentUser.uid}`);
        }
        globalMaxAccess = false;
        clearGeminiKey(); // F-08: limpa a chave Gemini da memória ao sair
        return signOut(auth);
    }

    useEffect(() => {
        if (IS_DEV) {
            console.log("[Dev Mode] Ativando bypass de autenticação...");
            const mockUser = {
                uid: 'dev-user-admin',
                email: 'financealivia@gmail.com',
                displayName: 'Admin (Dev)',
                photoURL: 'https://github.com/identicons/a.png'
            };
            setCurrentUser(mockUser);
            setIsPremium(true);
            setIsAdmin(true);
            setLoading(false);
            return;
        }

                const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (!user) {
                setIsPremium(false);
                setIsTrial(false);
                setLoading(false);
                setIsAdmin(false);
                globalMaxAccess = false;
            } else {
                // Carrega o status Premium do LocalStorage para evitar trancar a tela no F5
                const wasPremium = localStorage.getItem(`isPremium_${user.uid}`) === 'true';
                setIsPremium(wasPremium);

                // Ensure top-level user doc for Admin Panel
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                const userData = userSnap.exists() ? userSnap.data() : {};

                // ── Logout único forçado (apenas NÃO-vitalícios/NÃO-admins) ──
                // Mantém os vitalícios (admins, que já têm lançamentos) logados;
                // encerra apenas sessões cujo login foi feito ANTES do corte.
                // Novos cadastros/re-logins após o deploy têm lastSignIn > corte
                // e não são afetados (sem loop).
                const isLifetimeOrAdmin = isAdminEmail(user.email)
                    || isLifetimeEmail(user.email)
                    || userData.subscription?.status === 'lifetime';
                const lastSignIn = user.metadata?.lastSignInTime
                    ? new Date(user.metadata.lastSignInTime).getTime()
                    : 0;
                if (!isLifetimeOrAdmin && lastSignIn < FORCE_LOGOUT_BEFORE) {
                    localStorage.removeItem(`isPremium_${user.uid}`);
                    globalMaxAccess = false;
                    await signOut(auth);
                    return;
                }

                const updateData = {
                    email: user.email,
                    lastLogin: new Date(),
                    uid: user.uid
                };
                
                if (!userData.trialStartDate) {
                    updateData.trialStartDate = new Date();
                }
                if (!userData.createdAt) {
                    updateData.createdAt = user.metadata.creationTime || new Date().toISOString();
                }

                await setDoc(userRef, updateData, { merge: true });

                // Admin check — usa lista canônica em src/constants/admins.js
                setIsAdmin(isAdminEmail(user.email) || userData.isAdmin === true);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    const dataRef = useRef({ prefs: {}, user: {}, subs: [], prefsLoaded: false, userLoaded: false, subsLoaded: false, isInitialized: false });

    const lastSubInfoRef = useRef("");
    const maxAccessRef = useRef(false);

    // Stable Subscription & Prefs Listener
    useEffect(() => {
        if (!currentUser) {
            dataRef.current = { prefs: {}, user: {}, subs: [], prefsLoaded: false, userLoaded: false, subsLoaded: false, isInitialized: false };
            lastSubInfoRef.current = "";
            return;
        }

        if (IS_DEV) {
            console.log("[Dev Mode] Simulando preferências e status premium...");
            const mockPrefs = {
                hasSeenWelcome: true,
                hasSeenPatrimonyWelcome: true,
                lastMonthlyReviewSeen: new Date().toISOString().slice(0, 7),
                manualConfig: {
                    income: 7500,
                    fixedExpenses: 3200,
                    variableEstimate: 1500,
                    invested: 10000,
                    categoryBudgets: {},
                    recurringSubs: []
                }
            };
            setUserPrefs(mockPrefs);
            setIsPremium(true);
            setDaysRemaining(9999);
            setIsTrial(false);
            setLoading(false);
            setIsDataLoaded(true);
            return;
        }

        const checkStatus = () => {
            if (expiryTimeoutRef.current) clearTimeout(expiryTimeoutRef.current);
            const now = new Date();

            // 1. Data Consolidation
            const currentData = { ...dataRef.current.user, ...dataRef.current.prefs };
            const currentSubs = dataRef.current.subs;

            const stripeSub = currentSubs[0];
            const userEmail = currentUser.email?.toLowerCase();

            // ───────────────────────────────────────────────────────────────
            // REGRA DE BILLING (vendas): standard/premium SÓ com pagamento.
            //  • Vitalício (admins / e-mails fixos / status 'lifetime'):
            //    acesso total, sem depender de pagamento.
            //  • Stripe ATIVO ou TRIALING: premium/standard conforme o preço.
            //  • Qualquer outro caso → plano GRATUITO (com limites).
            // Foram REMOVIDOS os antigos atalhos manuais (flag `isPremium`,
            // campo `subscription.status` = active/premium/standard e o trial
            // de 7 dias) que liberavam plano pago sem pagamento real.
            // ───────────────────────────────────────────────────────────────
            const hasActiveStripe = stripeSub?.status === 'active' || stripeSub?.status === 'trialing';

            const isManualLifetime = isLifetimeEmail(userEmail) ||
                                     isAdminEmail(userEmail) ||
                                     dataRef.current.prefs.subscription?.status === 'lifetime' ||
                                     dataRef.current.user.subscription?.status === 'lifetime';

            // Bloqueio administrativo (abuso) — tranca o acesso. Não afeta pagos/vitalícios.
            const isBlocked = (dataRef.current.prefs.isBlocked === true || dataRef.current.user.isBlocked === true)
                && !hasActiveStripe && !isManualLifetime;

            // Guarda o ID da assinatura Stripe ativa para o portal de cancelamento.
            setStripeSubId(hasActiveStripe ? (stripeSub?.id || null) : null);

            const STANDARD_PRICES = [
                import.meta.env.VITE_STRIPE_PRICE_ID_STANDARD_MONTHLY,
                import.meta.env.VITE_STRIPE_PRICE_ID_STANDARD_YEARLY,
                'price_1TdDzSKAwb86obAGI0gTmdWL', // Hardcoded fallback
                'price_1TdE0LKAwb86obAGcpMPLgWw'
            ];

            const PREMIUM_PRICES = [
                import.meta.env.VITE_STRIPE_PRICE_ID_MONTHLY,
                import.meta.env.VITE_STRIPE_PRICE_ID_YEARLY,
                'price_1TdDwDKAwb86obAGnRhLwlIa',
                'price_1TdE1VKAwb86obAGh2h7m4o6'
            ];

            const stripePriceId = stripeSub?.items?.[0]?.plan?.id;
            let currentPlanLevel = 'free';

            if (isManualLifetime) {
                currentPlanLevel = 'lifetime';
            } else if (hasActiveStripe) {
                if (PREMIUM_PRICES.includes(stripePriceId)) {
                    currentPlanLevel = 'premium';
                } else if (STANDARD_PRICES.includes(stripePriceId)) {
                    currentPlanLevel = 'standard';
                } else {
                    // F-03: preço NÃO reconhecido (fora das allowlists) NÃO concede plano pago.
                    // Evita liberar premium via checkout_session com preço/valor manipulado.
                    currentPlanLevel = 'free';
                    console.warn('[Auth] Assinatura ativa com preço fora da allowlist — mantendo plano free.');
                }
            }
            // Qualquer outro caso permanece 'free'.

            // Tipo de assinatura e data (apenas exibição / portal). Sem Stripe = mensal.
            const resolvedSubType = (stripeSub?.items?.[0]?.plan?.interval === 'year') ? 'annual' : 'monthly';
            const subDate = stripeSub?.current_period_start ? new Date(stripeSub.current_period_start.seconds * 1000) : null;
            const msInDay = 1000 * 60 * 60 * 24;
            const toleranceDays = 0;

            // Flags de compatibilidade para o restante da função:
            const subStatus = isManualLifetime ? 'lifetime' : (hasActiveStripe ? 'active' : (isBlocked ? 'blocked' : 'free'));
            const isManualActive = hasActiveStripe;   // "ativo" agora significa Stripe pago
            const isWithinTrial = false;              // trial sem pagamento desativado

            // Acesso: todos têm ao menos o Gratuito; bloqueio administrativo tranca tudo.
            const hasValidAccess = !isBlocked;
            const remaining = 9999;
            const isUnderTolerance = false;

            const isExpired = !hasValidAccess && (dataRef.current.subsLoaded || dataRef.current.prefsLoaded);

            // Usuário precisa escolher plano se NUNCA interagiu com nenhum plano
            // (sem registro de assinatura, sem lifetime, sem stripe ativo).
            // Importante: admins via e-mail fixo são lifetime — não cairão aqui.
            const hasExistingRecord = !!(dataRef.current.prefs.subscription?.status
                || dataRef.current.user.subscription?.status
                || dataRef.current.user.isPremium === true);
            const hasChosenAnyPlan = isManualLifetime || hasActiveStripe || hasExistingRecord;
            const needsPlanSel = !hasChosenAnyPlan && !isBlocked && (dataRef.current.userLoaded || dataRef.current.prefsLoaded);
            setNeedsPlanSelection(needsPlanSel);

            // New Sync State
            const newSubInfo = {
                type: resolvedSubType,
                date: subDate ? subDate.getTime() : null,
                status: subStatus,
                isUnderTolerance,
                daysRemaining: Math.max(0, remaining),
                isExpired,
                isTrial: isWithinTrial && !stripeSub && !isManualActive && !isManualLifetime,
                hasValidAccess,
                planLevel: currentPlanLevel
            };

            const subInfoString = JSON.stringify(newSubInfo);

            // ONLY UPDATE IF LOADED OR ACCESS GRANTED OR STATE CHANGED
            if (subInfoString !== lastSubInfoRef.current || !dataRef.current.isInitialized) {
                lastSubInfoRef.current = subInfoString;
                dataRef.current.isInitialized = true;
                
                if (hasValidAccess) {
                    globalMaxAccess = true;
                    localStorage.setItem(`isPremium_${currentUser.uid}`, 'true');
                }
                setIsPremium(globalMaxAccess);
                setDaysRemaining(Math.max(0, remaining));
                setIsTrial(newSubInfo.isTrial);
                setIsLifetime(isManualLifetime);
                setSubType(resolvedSubType);
                setPlanLevel(currentPlanLevel);

                setCurrentUser(prev => prev ? ({
                    ...prev,
                    subscriptionInfo: {
                        ...newSubInfo,
                        date: subDate // back to Date object for UI
                    }
                }) : null);

                log.info(`[Auth Sync] User: ${maskEmail(currentUser.email)}`, newSubInfo);
            }

            // 3. SCHEDULE NEXT CHECK (Precision Watchdog)
            // Agendamos apenas se houver uma data de expiração futura próxima (> 1 min)
            if (hasValidAccess && subDate) {
                const cycle = resolvedSubType === 'annual' ? 365 : 30;
                const totalCycle = cycle + toleranceDays;
                
                const timeToExpire = subDate.getTime() + (totalCycle * msInDay);
                const msUntilFinish = timeToExpire - now.getTime();

                // Só agenda se o tempo for futuro mas não muito longe (ex: menor que 40 dias)
                // e maior que 5 segundos para evitar loops de curtíssimo prazo
                if (msUntilFinish > 5000 && msUntilFinish < (40 * msInDay)) {
                    expiryTimeoutRef.current = setTimeout(() => {
                        console.log("[Auth] Monitor de expiração disparado.");
                        checkStatus();
                    }, Math.min(msUntilFinish + 2000, 1000 * 60 * 60)); // Máximo 1h
                }
            }
        };

        const prefsRef = doc(db, 'users', currentUser.uid, 'settings', 'general');
        const userRef = doc(db, 'users', currentUser.uid);
        const subsRef = collection(db, 'customers', currentUser.uid, 'subscriptions');
        const subsQuery = query(subsRef); // Traz todas as assinaturas para investigar o status real

        let prefsDone = false;
        let userDone = false;
        let subsDone = false;

        // Fallback: Se em 3 segundos não vier resposta do servidor, libera com o que tiver
        const fallbackTimeout = setTimeout(() => {
            console.log("[Auth] Fallback timeout disparado - Liberando com dados locais/cache");
            prefsDone = true;
            userDone = true;
            subsDone = true;
            syncLoading();
        }, 3000);

        const syncLoading = () => {
            const currentData = { ...dataRef.current.user, ...dataRef.current.prefs };
            const isManualActive = currentData.isPremium === true || currentData.subscription?.status === 'active';

            if (prefsDone && userDone && (subsDone || isManualActive) && dataRef.current.isInitialized) {
                clearTimeout(fallbackTimeout); // Cancela o fallback se deu tudo certo antes
                // Adicionado um delay de 500ms para garantir que o estado de isPremium 
                // se propague antes de avisarmos que os dados estão carregados.
                setTimeout(() => setIsDataLoaded(true), 500);
                
                // Aumentado para 1000ms para o loading geral
                setTimeout(() => setLoading(false), 1000);
            }
        };
        const unsubPrefs = onSnapshot(prefsRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                dataRef.current.prefs = data;
                setUserPrefs(data);
                // F-08: carrega a chave Gemini do Firestore para a memória da sessão
                // (sem persistir em localStorage). Fonte de verdade = Firestore.
                // Considera os dois campos usados no app (apiKey e manualConfig.geminiKey).
                const geminiKey = data.apiKey || data.manualConfig?.geminiKey;
                if (geminiKey) setGeminiKey(geminiKey);
            }
            dataRef.current.prefsLoaded = true;
            if (!snap.metadata.fromCache) {
                prefsDone = true;
            }
            checkStatus();
            syncLoading();
        }, (err) => {
            console.error("Erro no Firebase Prefs:", err);
            dataRef.current.prefsLoaded = true;
            prefsDone = true; // Em caso de erro, liberamos para não travar o app
            checkStatus();
            syncLoading();
        });

        const unsubUser = onSnapshot(userRef, (snap) => {
            if (snap.exists()) dataRef.current.user = snap.data();
            dataRef.current.userLoaded = true;
            if (!snap.metadata.fromCache) {
                userDone = true;
            }
            checkStatus();
            syncLoading();
        }, () => {
            dataRef.current.userLoaded = true;
            userDone = true;
            checkStatus();
            syncLoading();
        });

        const unsubSubs = onSnapshot(subsQuery, (snap) => {
            dataRef.current.subs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            dataRef.current.subsLoaded = true;
            if (!snap.metadata.fromCache) {
                subsDone = true;
            }
            checkStatus();
            syncLoading();
        }, () => {
            dataRef.current.subsLoaded = true;
            subsDone = true;
            checkStatus();
            syncLoading();
        });

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log("[Auth] App em foco - Re-validando assinatura...");
                checkStatus();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        const interval = setInterval(() => {
            console.log("[Auth] Re-check periódico de expiração...");
            checkStatus();
        }, 1000 * 60 * 5); // 5 minutos — watchdog de segurança (expiryTimeoutRef já cuida da expiração precisa)

        return () => {
            unsubPrefs();
            unsubUser();
            unsubSubs();
            if (expiryTimeoutRef.current) clearTimeout(expiryTimeoutRef.current);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(interval);
        };
    }, [currentUser?.uid]);


    // Cloud Sync Functions
    async function saveUserPreferences(data) {
        if (!currentUser) return;
        
        // Atualiza o estado local imediatamente para a UI não travar
        setUserPrefs(prev => ({ ...prev, ...data }));
        
        if (IS_DEV) {
            console.log("[Dev Mode] Salvando preferências no localStorage...");
            const current = userPrefs || {};
            localStorage.setItem('dev_user_prefs', JSON.stringify({ ...current, ...data }));
            return;
        }

        try {
            const userRef = doc(db, 'users', currentUser.uid, 'settings', 'general');
            await setDoc(userRef, data, { merge: true });
        } catch(err) {
            console.error("Erro ao salvar preferências:", err);
        }
    }

    async function getUserPreferences() {
        if (!currentUser) return null;
        if (IS_DEV) {
            const saved = localStorage.getItem('dev_user_prefs');
            return saved ? JSON.parse(saved) : userPrefs;
        }
        try {
            const userRef = doc(db, 'users', currentUser.uid, 'settings', 'general');
            const docSnap = await getDoc(userRef);
            if (docSnap.exists()) return docSnap.data();
        } catch (err) {
            console.error("Erro ao buscar preferências:", err);
        }
        return null;
    }

    async function saveChatHistory(messages) {
        if (!currentUser) return;
        if (IS_DEV) {
            localStorage.setItem('dev_chat_history', JSON.stringify(messages));
            return;
        }
        const chatRef = doc(db, 'users', currentUser.uid, 'chat', 'history');
        // Firestore has a size limit for documents (1MB). For a simple chat history, this is usually fine.
        // If it grows too large, we might need a subcollection, but for now a single doc is simpler.
        await setDoc(chatRef, { messages, updatedAt: new Date() }, { merge: true });
    }

    async function getChatHistory() {
        if (!currentUser) return [];
        if (IS_DEV) {
            const saved = localStorage.getItem('dev_chat_history');
            return saved ? JSON.parse(saved) : [];
        }
        const chatRef = doc(db, 'users', currentUser.uid, 'chat', 'history');
        const docSnap = await getDoc(chatRef);
        return docSnap.exists() ? docSnap.data().messages : [];
    }

    async function deleteAccount() {
        if (!currentUser) return;
        const uid = currentUser.uid;

        try {
            // 1. Transactions
            const qT = query(collection(db, 'transactions'), where('userId', '==', uid));
            const snapT = await getDocs(qT);
            const deleteT = snapT.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deleteT);

            // 2. Goals
            const qG = query(collection(db, 'goals'), where('userId', '==', uid));
            const snapG = await getDocs(qG);
            const deleteG = snapG.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deleteG);

            // 3. Settings & Chat
            await deleteDoc(doc(db, 'users', uid, 'settings', 'general'));
            await deleteDoc(doc(db, 'users', uid, 'chat', 'history'));
            // Em vez de deletar o documento base, marcamos como excluído para o admin ver
            await updateDoc(doc(db, 'users', uid), { 
                status: 'deleted', 
                deletedAt: new Date(),
                email: currentUser.email // Guardamos o e-mail no doc base para o admin identificar quem saiu
            });

            // 4. Auth User
            const user = auth.currentUser;
            if (user) {
                try {
                    await deleteUser(user);
                } catch (err) {
                    if (err.code === 'auth/requires-recent-login') {
                        // Se for Google, tenta re-autenticar por popup
                        const provider = new GoogleAuthProvider();
                        await signInWithPopup(auth, provider);
                        await deleteUser(auth.currentUser);
                    } else {
                        throw err;
                    }
                }
            }
            return { success: true };
        } catch (error) {
            console.error("Erro ao deletar conta:", error);
            throw error;
        }
    }

    async function resetUserData(uid) {
        if (!uid) return;
        try {
            log.info(`[Admin] Resetando dados para o usuário: ${maskUid(uid)}`);
            
            // 1. Transactions
            const qT = query(collection(db, 'transactions'), where('userId', '==', uid));
            const snapT = await getDocs(qT);
            const deleteT = snapT.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deleteT);

            // 2. Goals
            const qG = query(collection(db, 'goals'), where('userId', '==', uid));
            const snapG = await getDocs(qG);
            const deleteG = snapG.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deleteG);

            // 3. Savings Jars
            const qJ = query(collection(db, 'savings_jars'), where('userId', '==', uid));
            const snapJ = await getDocs(qJ);
            const deleteJ = snapJ.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deleteJ);

            // 4. Cards
            const qC = query(collection(db, 'cards'), where('userId', '==', uid));
            const snapC = await getDocs(qC);
            const deleteC = snapC.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deleteC);

            // 5. Settings Reset
            const userPrefsRef = doc(db, 'users', uid, 'settings', 'general');
            await setDoc(userPrefsRef, {
                hasSeenWelcome: true,
                hasSeenPatrimonyWelcome: true,
                manualConfig: {
                    income: 0,
                    fixedExpenses: 0,
                    variableEstimate: 0,
                    invested: 0,
                    categoryBudgets: {},
                    recurringSubs: []
                }
            }, { merge: true });

            console.log("[Admin] Reset de dados concluído.");
            return { success: true };
        } catch (error) {
            console.error("Erro ao resetar dados:", error);
            throw error;
        }
    }

    async function resetGastosData(uid) {
        if (!uid) return;
        try {
            log.info(`[User] Resetando dados de Gastos para o usuário: ${maskUid(uid)}`);
            
            const collectionsToClear = ['transactions', 'cards', 'subscriptions', 'fixed_expenses'];
            for (const colName of collectionsToClear) {
                const qCol = query(collection(db, colName), where('userId', '==', uid));
                const snap = await getDocs(qCol);
                const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
                await Promise.all(deletePromises);
            }

            const userPrefsRef = doc(db, 'users', uid, 'settings', 'general');
            await setDoc(userPrefsRef, {
                hasSeenWelcome: false,
                manualConfig: {
                    income: 0,
                    fixedExpenses: 0,
                    variableEstimate: 0,
                    categoryBudgets: {},
                    recurringSubs: []
                }
            }, { merge: true });

            console.log("[User] Reset de dados de Gastos concluído.");
            return { success: true };
        } catch (error) {
            console.error("Erro ao resetar dados de Gastos:", error);
            throw error;
        }
    }

    async function resetPatrimonioData(uid) {
        if (!uid) return;
        try {
            log.info(`[User] Resetando dados de Patrimônio para o usuário: ${maskUid(uid)}`);
            
            const collectionsToClear = ['goals', 'savings_jars', 'investments'];
            for (const colName of collectionsToClear) {
                const qCol = query(collection(db, colName), where('userId', '==', uid));
                const snap = await getDocs(qCol);
                const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
                await Promise.all(deletePromises);
            }

            const userPrefsRef = doc(db, 'users', uid, 'settings', 'general');
            await setDoc(userPrefsRef, {
                hasSeenPatrimonyWelcome: false,
                manualConfig: {
                    invested: 0
                }
            }, { merge: true });

            console.log("[User] Reset de dados de Patrimônio concluído.");
            return { success: true };
        } catch (error) {
            console.error("Erro ao resetar dados de Patrimônio:", error);
            throw error;
        }
    }

    const value = {
        currentUser,
        isPremium,
        isTrial,
        isLifetime,
        isDataLoaded,
        needsPlanSelection,
        subType,
        daysRemaining,
        planLevel,
        stripeSubId,
        login,
        signup,
        loginWithGoogle,
        logout,
        deleteAccount,
        resetUserData,
        resetGastosData,
        resetPatrimonioData,
        saveUserPreferences,
        getUserPreferences,
        saveChatHistory,
        getChatHistory,
        userPrefs,
        isAdmin
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
