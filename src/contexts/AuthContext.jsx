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

    const lastSubInfoRef = useRef("");

    // Stable Subscription & Prefs Listener
    useEffect(() => {
        if (!currentUser) return;

        const checkStatus = () => {
            if (expiryTimeoutRef.current) clearTimeout(expiryTimeoutRef.current);
            const createdAt = currentUser.metadata.creationTime ? new Date(currentUser.metadata.creationTime) : new Date();
            const now = new Date();

            // 1. Data Consolidation
            const currentData = { ...dataRef.current.user, ...dataRef.current.prefs };
            const currentSubs = dataRef.current.subs;

            const stripeSub = currentSubs[0];
            const manualSub = currentData.subscription || (currentData.isPremium ? { status: 'active' } : {});

            let subStatus = (stripeSub?.status === 'active' || stripeSub?.status === 'trialing')
                ? 'active'
                : (manualSub?.status || stripeSub?.status || 'free');

            const isManualActive = ['active', 'monthly', 'annual', 'pro', 'premium'].includes(subStatus?.toLowerCase());
            const isManualLifetime = subStatus === 'lifetime' || manualSub?.status === 'lifetime';
            const isBlocked = manualSub?.status === 'blocked';

            const subType = (stripeSub?.items?.[0]?.plan?.interval === 'year' || manualSub?.type === 'annual') ? 'annual' : (manualSub?.type || 'monthly');
            const subDate = stripeSub?.current_period_start ? new Date(stripeSub.current_period_start.seconds * 1000) : (manualSub?.date?.toDate ? manualSub.date.toDate() : (manualSub?.date ? new Date(manualSub.date) : null));

            const createdAtDate = new Date(currentUser.metadata.creationTime);
            const msInDay = 1000 * 60 * 60 * 24;
            const diffDaysTrial = Math.ceil((now - createdAtDate) / msInDay);
            const isWithinTrial = diffDaysTrial <= 7;

            let hasValidAccess = false;
            let remaining = 0;
            let isUnderTolerance = false;
            const toleranceDays = 5;

            if (isManualLifetime && !isBlocked) {
                hasValidAccess = true;
                remaining = 9999;
            } else if ((subStatus === 'active' || isManualActive) && !isBlocked) {
                const cycleDays = subType === 'annual' ? 365 : 30;
                const diffDaysSub = subDate ? Math.floor((now - subDate) / msInDay) : 0;

                if (diffDaysSub <= cycleDays || diffDaysSub <= cycleDays + toleranceDays) {
                    hasValidAccess = true;
                    remaining = (diffDaysSub <= cycleDays) ? (cycleDays - diffDaysSub) : ((cycleDays + toleranceDays) - diffDaysSub);
                    isUnderTolerance = diffDaysSub > cycleDays;
                }
            } else if (isWithinTrial && !isBlocked) {
                hasValidAccess = true;
                remaining = 7 - diffDaysTrial;
                setIsTrial(true);
            }

            const isExpired = !hasValidAccess && (dataRef.current.subsLoaded || dataRef.current.prefsLoaded);
            
            // New Sync State
            const newSubInfo = {
                type: subType,
                date: subDate ? subDate.getTime() : null,
                status: subStatus,
                isUnderTolerance,
                daysRemaining: Math.max(0, remaining),
                isExpired,
                hasValidAccess
            };

            const subInfoString = JSON.stringify(newSubInfo);

            // ONLY UPDATE IF LOADED OR ACCESS GRANTED OR STATE CHANGED
            if (subInfoString !== lastSubInfoRef.current) {
                lastSubInfoRef.current = subInfoString;
                
                setIsPremium(hasValidAccess);
                setDaysRemaining(Math.max(0, remaining));
                if (!hasValidAccess) setIsTrial(false);

                setCurrentUser(prev => prev ? ({
                    ...prev,
                    subscriptionInfo: {
                        ...newSubInfo,
                        date: subDate // back to Date object for UI
                    }
                }) : null);

                console.log(`[Auth Sync] User: ${currentUser.email}`, newSubInfo);
            }

            // 3. SCHEDULE NEXT CHECK (Precision Watchdog)
            // Agendamos apenas se houver uma data de expiração futura próxima (> 1 min)
            if (hasValidAccess && subDate) {
                const cycle = subType === 'annual' ? 365 : 30;
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
