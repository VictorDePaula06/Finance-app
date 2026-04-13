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

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isPremium, setIsPremium] = useState(false);
    const [isTrial, setIsTrial] = useState(false);
    const [daysRemaining, setDaysRemaining] = useState(0);
    const [userPrefs, setUserPrefs] = useState(null);
    const expiryTimeoutRef = useRef(null);

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
        return signOut(auth);
    }

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (!user) {
                setIsPremium(false);
                setIsTrial(false);
                setLoading(false);
            } else {
                // Ensure top-level user doc for Admin Panel
                const userRef = doc(db, 'users', user.uid);
                setDoc(userRef, {
                    email: user.email,
                    lastLogin: new Date(),
                    createdAt: user.metadata.creationTime,
                    uid: user.uid
                }, { merge: true });
            }
        });
        return () => unsubscribeAuth();
    }, []);

    const dataRef = useRef({ prefs: {}, user: {}, subs: [], prefsLoaded: false, userLoaded: false, subsLoaded: false });

    // Stable Subscription & Prefs Listener
    useEffect(() => {
        if (!currentUser) return;

        const checkStatus = () => {
            if (expiryTimeoutRef.current) clearTimeout(expiryTimeoutRef.current);
            const createdAt = currentUser.metadata.creationTime ? new Date(currentUser.metadata.creationTime) : new Date();
            const now = new Date();

            // 1. Check Trial (7 days)
            const msInDay = 1000 * 60 * 60 * 24;
            const diffDaysTrial = Math.ceil((now - createdAt) / msInDay);
            const isWithinTrial = diffDaysTrial <= 7;

            // 2. Data Consolidation (LATCHED)
            const currentData = { ...dataRef.current.user, ...dataRef.current.prefs };
            const currentSubs = dataRef.current.subs;

            const stripeSub = currentSubs[0];
            const manualSub = currentData.subscription || (currentData.isPremium ? { status: 'active' } : {});

            // PRIORITY: Stripe "active"/"trialing" status
            let subStatus = (stripeSub?.status === 'active' || stripeSub?.status === 'trialing')
                ? 'active'
                : (manualSub?.status || stripeSub?.status || 'free');

            const isManualActive = ['active', 'monthly', 'annual', 'pro', 'premium'].includes(subStatus?.toLowerCase());
            const isManualLifetime = subStatus === 'lifetime' || manualSub?.status === 'lifetime';
            const isBlocked = manualSub?.status === 'blocked';

            const stripePriceId = stripeSub?.items?.[0]?.price?.id;
            const annualPriceId = import.meta.env.VITE_STRIPE_PRICE_ID_YEARLY;
            const stripeInterval = stripeSub?.items?.[0]?.plan?.interval;

            const isAnnual = stripePriceId === annualPriceId ||
                stripeInterval === 'year' ||
                stripeSub?.items?.[0]?.plan?.nickname?.toLowerCase().includes('anual') ||
                manualSub?.type === 'annual';

            const subType = isAnnual ? 'annual' : (manualSub?.type || 'monthly');

            const subDate = stripeSub?.current_period_start ? new Date(stripeSub.current_period_start.seconds * 1000) : (manualSub?.date?.toDate ? manualSub.date.toDate() : (manualSub?.date ? new Date(manualSub.date) : null));

            console.log(`[Auth Debug] User: ${currentUser.email}`, {
                subStatus,
                stripe: stripeSub?.status,
                manual: manualSub?.status,
                isBlocked,
                creationTime: currentUser.metadata.creationTime,
                now: now.toISOString(),
                diffDaysTrial,
                isWithinTrial
            });

            let hasValidAccess = false;
            let remaining = 0;
            let isUnderTolerance = false;

            if (isManualLifetime && !isBlocked) {
                hasValidAccess = true;
                remaining = 9999;
            } else if ((subStatus === 'active' || isManualActive) && !isBlocked) {
                const cycleDays = subType === 'annual' ? 365 : 30;
                const toleranceDays = 5;
                const msInDay = 1000 * 60 * 60 * 24;
                const diffDaysSub = subDate ? Math.floor((now - subDate) / msInDay) : 0;

                if (diffDaysSub <= cycleDays || diffDaysSub <= cycleDays + toleranceDays) {
                    hasValidAccess = true;
                    remaining = (diffDaysSub <= cycleDays) ? (cycleDays - diffDaysSub) : ((cycleDays + toleranceDays) - diffDaysSub);
                    isUnderTolerance = diffDaysSub > cycleDays;
                } else {
                    // SE PASSOU DA TOLERÂNCIA, GARANTE QUE BLOQUEIA
                    // Removido fallback de 1 dia que permitia acesso indevido
                    hasValidAccess = false;
                    remaining = 0;
                }
            } else if (isWithinTrial && !isBlocked) {
                hasValidAccess = true;
                remaining = 7 - diffDaysTrial;
                setIsTrial(true);
            }

            const isExpired = !hasValidAccess && (dataRef.current.subsLoaded || dataRef.current.prefsLoaded);

            // ONLY UPDATE IF LOADED OR ACCESS GRANTED
            // This prevents "flickering" to false while listeners are still firing,
            // but forces false if we have load confirmation.
            if (hasValidAccess || isExpired) {
                setIsPremium(hasValidAccess);
                setDaysRemaining(Math.max(0, remaining));
                if (!hasValidAccess) setIsTrial(false);
            }

            setCurrentUser(prev => prev ? ({
                ...prev,
                subscriptionInfo: {
                    type: subType,
                    date: subDate,
                    status: subStatus,
                    isUnderTolerance,
                    daysRemaining: remaining,
                    isExpired
                }
            }) : null);

            // 3. SCHEDULE NEXT CHECK (Precision Watchdog)
            // Se tiver acesso válido, agendamos o próximo check para o momento exato da expiração
            if (hasValidAccess && subDate) {
                const cycle = subType === 'annual' ? 365 : 30;
                const tolerance = 5;
                
                const msInDay = 24 * 60 * 60 * 1000;
                const timeToExpireRegular = subDate.getTime() + (cycle * msInDay);
                const timeToExpireTolerance = subDate.getTime() + ((cycle + tolerance) * msInDay);
                
                const msUntilRegular = timeToExpireRegular - now.getTime();
                const msUntilTolerance = timeToExpireTolerance - now.getTime();

                // Pegamos o próximo evento que ainda não aconteceu
                let nextEventMs = 0;
                if (msUntilRegular > 0) nextEventMs = msUntilRegular;
                else if (msUntilTolerance > 0) nextEventMs = msUntilTolerance;

                if (nextEventMs > 0) {
                    // Adicionamos 1 segundo de margem para garantir que o 'now' do próximo check já seja após a expiração
                    expiryTimeoutRef.current = setTimeout(() => {
                        console.log("[Auth] Expirou! Gatilho de precisão executando bloqueio...");
                        checkStatus();
                    }, nextEventMs + 1000); 
                }
            }
        };

        const prefsRef = doc(db, 'users', currentUser.uid, 'settings', 'general');
        const userRef = doc(db, 'users', currentUser.uid);
        const subsRef = collection(db, 'customers', currentUser.uid, 'subscriptions');
        const subsQuery = query(subsRef, where('status', 'in', ['active', 'trialing']));

        const unsubPrefs = onSnapshot(prefsRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                dataRef.current.prefs = data;
                setUserPrefs(data);
            }
            dataRef.current.prefsLoaded = true;
            checkStatus();
            setLoading(false);
        });

        const unsubUser = onSnapshot(userRef, (snap) => {
            if (snap.exists()) dataRef.current.user = snap.data();
            dataRef.current.userLoaded = true;
            checkStatus();
        });

        const unsubSubs = onSnapshot(subsQuery, (snap) => {
            dataRef.current.subs = snap.docs.map(d => d.data());
            dataRef.current.subsLoaded = true;
            checkStatus();
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
        }, 1000 * 60 * 1); // 1 minuto (Watchdog de segurança)

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
        const userRef = doc(db, 'users', currentUser.uid, 'settings', 'general');
        await setDoc(userRef, data, { merge: true });
    }

    async function getUserPreferences() {
        if (!currentUser) return null;
        const userRef = doc(db, 'users', currentUser.uid, 'settings', 'general');
        const docSnap = await getDoc(userRef);
        return docSnap.exists() ? docSnap.data() : null;
    }

    async function saveChatHistory(messages) {
        if (!currentUser) return;
        const chatRef = doc(db, 'users', currentUser.uid, 'chat', 'history');
        // Firestore has a size limit for documents (1MB). For a simple chat history, this is usually fine.
        // If it grows too large, we might need a subcollection, but for now a single doc is simpler.
        await setDoc(chatRef, { messages, updatedAt: new Date() }, { merge: true });
    }

    async function getChatHistory() {
        if (!currentUser) return [];
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

    const value = {
        currentUser,
        isPremium,
        isTrial,
        daysRemaining,
        login,
        signup,
        loginWithGoogle,
        logout,
        deleteAccount,
        saveUserPreferences,
        getUserPreferences,
        saveChatHistory,
        getChatHistory,
        userPrefs
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
