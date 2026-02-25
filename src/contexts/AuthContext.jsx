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
                // 1. Listen to Extension Sync (Top Level User Doc)
                const userRef = doc(db, 'users', user.uid);
                // 2. Listen to App Settings
                const prefsRef = doc(db, 'users', user.uid, 'settings', 'general');
                // 3. Listen to Subscriptions Collection (The Source of Truth)
                const subsRef = collection(db, 'customers', user.uid, 'subscriptions');
                const subsQuery = query(subsRef, where('status', 'in', ['active', 'trialing']));

                const checkStatus = (userData, activeSubs = []) => {
                    const hasActiveSub = activeSubs.length > 0 || userData.subscription?.status === 'active';
                    const createdAt = user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date();
                    const now = new Date();
                    const diffDays = Math.ceil(Math.abs(now - createdAt) / (1000 * 60 * 60 * 24));

                    setDaysRemaining(Math.max(0, 7 - diffDays));

                    if (hasActiveSub) {
                        setIsPremium(true);
                        setIsTrial(false);
                    } else if (diffDays <= 7) {
                        setIsPremium(true);
                        setIsTrial(true);
                    } else {
                        setIsPremium(false);
                        setIsTrial(false);
                    }
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
