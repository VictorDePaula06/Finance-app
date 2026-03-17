import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { auth, googleProvider, db } from '../services/firebase';
import {
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot, collection, query, where } from 'firebase/firestore';

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
            const createdAt = currentUser.metadata.creationTime ? new Date(currentUser.metadata.creationTime) : new Date();
            const now = new Date();

            // 1. Check Trial (7 days)
            const diffDaysTrial = Math.ceil((now - createdAt) / (1000 * 60 * 60 * 24));
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
                const diffDaysSub = subDate ? Math.floor((now - subDate) / (1000 * 60 * 60 * 24)) : 0;

                if (diffDaysSub <= cycleDays || diffDaysSub <= cycleDays + toleranceDays) {
                    hasValidAccess = true;
                    remaining = (diffDaysSub <= cycleDays) ? (cycleDays - diffDaysSub) : ((cycleDays + toleranceDays) - diffDaysSub);
                    isUnderTolerance = diffDaysSub > cycleDays;
                } else if (!stripeSub) {
                    // Manual safety fallback
                    hasValidAccess = true;
                    remaining = 1;
                }
            } else if (isWithinTrial && !isBlocked) {
                hasValidAccess = true;
                remaining = 7 - diffDaysTrial;
                setIsTrial(true);
            }

            // ONLY UPDATE IF LOADED OR ACCESS GRANTED
            // This prevents "flickering" to false while listeners are still firing
            if (hasValidAccess || (dataRef.current.subsLoaded && dataRef.current.prefsLoaded)) {
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
                    daysRemaining: remaining
                }
            }) : null);
        };

        const prefsRef = doc(db, 'users', currentUser.uid, 'settings', 'general');
        const userRef = doc(db, 'users', currentUser.uid);
        const subsRef = collection(db, 'customers', currentUser.uid, 'subscriptions');
        const subsQuery = query(subsRef, where('status', 'in', ['active', 'trialing']));

        const unsubPrefs = onSnapshot(prefsRef, (snap) => {
            if (snap.exists()) dataRef.current.prefs = snap.data();
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

        return () => {
            unsubPrefs();
            unsubUser();
            unsubSubs();
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

    const value = {
        currentUser,
        isPremium,
        isTrial,
        daysRemaining,
        login,
        signup,
        loginWithGoogle,
        logout,
        saveUserPreferences,
        getUserPreferences,
        saveChatHistory,
        getChatHistory
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
