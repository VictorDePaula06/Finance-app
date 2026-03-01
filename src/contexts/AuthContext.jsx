import React, { createContext, useContext, useEffect, useState } from 'react';
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
        let unsubscribePrefs = null;
        let unsubscribeSubs = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);

            if (user) {
                // Ensure email is synced to Firestore for Admin Panel
                const userPrefsRef = doc(db, 'users', user.uid, 'settings', 'general');
                getDoc(userPrefsRef).then(snap => {
                    if (!snap.exists() || !snap.data().email) {
                        setDoc(userPrefsRef, { email: user.email }, { merge: true });
                    }
                });

                // 1. Listen to Extension Sync (Top Level User Doc)
                const userRef = doc(db, 'users', user.uid);
                // 2. Listen to App Settings
                const prefsRef = doc(db, 'users', user.uid, 'settings', 'general');
                // 3. Listen to Subscriptions Collection (The Source of Truth)
                const subsRef = collection(db, 'customers', user.uid, 'subscriptions');
                const subsQuery = query(subsRef, where('status', 'in', ['active', 'trialing']));

                const checkStatus = (userData, activeSubs = []) => {
                    const createdAt = user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date();
                    const now = new Date();

                    // 1. Check Trial (7 days)
                    const diffDaysTrial = Math.ceil((now - createdAt) / (1000 * 60 * 60 * 24));
                    const isWithinTrial = diffDaysTrial <= 7;

                    // 2. Check Subscription Data
                    const stripeSub = activeSubs[0];
                    const manualSub = userData.subscription || {};

                    // PRIORITY: Stripe "active" or "trialing" status overrides manual blocks.
                    let subStatus = (stripeSub?.status === 'active' || stripeSub?.status === 'trialing')
                        ? 'active'
                        : (manualSub?.status === 'expired' ? 'expired' : (stripeSub?.status || manualSub?.status));

                    const subType = stripeSub?.items?.[0]?.plan?.nickname?.toLowerCase().includes('anual') ? 'annual' : (manualSub?.type || 'monthly');
                    const subDate = stripeSub?.current_period_start ? new Date(stripeSub.current_period_start.seconds * 1000) : (manualSub?.date?.toDate ? manualSub.date.toDate() : (manualSub?.date ? new Date(manualSub.date) : null));

                    let hasValidAccess = false;
                    let remaining = 0;
                    let isUnderTolerance = false;
                    let isTrialState = false;

                    if (subStatus === 'lifetime') {
                        hasValidAccess = true;
                        remaining = 9999;
                        setIsTrial(false);
                    } else if (subStatus === 'active') {
                        const cycleDays = subType === 'annual' ? 365 : 30;
                        const toleranceDays = 5;
                        const diffDaysSub = Math.floor((now - subDate) / (1000 * 60 * 60 * 24));

                        if (diffDaysSub <= cycleDays) {
                            hasValidAccess = true;
                            remaining = cycleDays - diffDaysSub;
                        } else if (diffDaysSub <= cycleDays + toleranceDays) {
                            hasValidAccess = true;
                            isUnderTolerance = true;
                            remaining = (cycleDays + toleranceDays) - diffDaysSub;
                        } else {
                            hasValidAccess = false;
                            remaining = 0;
                        }
                        setIsTrial(false);
                    } else if (subStatus === 'expired' || (manualSub?.status && manualSub.status !== 'active' && manualSub.status !== 'lifetime')) {
                        // EXPLICIT BLOCK: If there's a manual status and it's not active/lifetime, block EVERYTHING.
                        hasValidAccess = false;
                        remaining = 0;
                        setIsTrial(false);
                    } else if (isWithinTrial) {
                        hasValidAccess = true;
                        remaining = 7 - diffDaysTrial;
                        isTrialState = true;
                        setIsTrial(true);
                    } else {
                        hasValidAccess = false;
                        remaining = 0;
                        setIsTrial(false);
                    }

                    setIsPremium(hasValidAccess);
                    setDaysRemaining(Math.max(0, remaining));

                    // Export extra info for AdminPanel
                    setCurrentUser(prev => ({
                        ...prev,
                        subscriptionInfo: {
                            type: subType,
                            date: subDate,
                            status: subStatus,
                            isUnderTolerance,
                            daysRemaining: remaining
                        }
                    }));
                };

                // Shared data state
                let currentData = {};
                let currentSubs = [];

                unsubscribePrefs = onSnapshot(prefsRef, (snap) => {
                    currentData = { ...currentData, ...(snap.exists() ? snap.data() : {}) };
                    checkStatus(currentData, currentSubs);
                    setLoading(false);
                });

                onSnapshot(userRef, (snap) => {
                    currentData = { ...currentData, ...(snap.exists() ? snap.data() : {}) };
                    checkStatus(currentData, currentSubs);
                });

                unsubscribeSubs = onSnapshot(subsQuery, (snap) => {
                    currentSubs = snap.docs.map(d => d.data());
                    checkStatus(currentData, currentSubs);
                });

            } else {
                setIsPremium(false);
                setIsTrial(false);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribePrefs) unsubscribePrefs();
            if (unsubscribeSubs) unsubscribeSubs();
        };
    }, []);


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
