import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, db } from '../services/firebase';
import {
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isPremium, setIsPremium] = useState(true); // DEBUG: Default True
    const [isTrial, setIsTrial] = useState(true);     // DEBUG: Default True
    const [daysRemaining, setDaysRemaining] = useState(30);

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
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);

            if (user) {
                // Check Subscription & Trial Status
                try {
                    const userRef = doc(db, 'users', user.uid, 'settings', 'general');
                    const userSnap = await getDoc(userRef);
                    const userData = userSnap.exists() ? userSnap.data() : {};

                    const subscriptionStatus = userData.subscription?.status; // 'active', 'canceled', etc.
                    const createdAt = user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date();
                    const now = new Date();
                    const diffTime = Math.abs(now - createdAt);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Fixed: Defined diffDays

                    console.log("Creation Time:", user.metadata.creationTime);
                    console.log("Diff Days:", diffDays);

                    const trialDays = 3650; // 10 Years Trial for Dev
                    const remaining = Math.max(0, trialDays - diffDays);

                    setDaysRemaining(remaining);


                    // FORCING PREMIUM FOR TESTING
                    // diffDays can be NaN if creationTime is weird, failing the < trialDays check.
                    // Bypass logic completely.

                    if (subscriptionStatus === 'active') {
                        console.log("Status: Active Subscription");
                        setIsPremium(true);
                        setIsTrial(false);
                    } else {
                        // FORCE TRIAL/PREMIUM
                        console.log("Status: FORCED PREMIUM (DEBUG MODE)");
                        setIsPremium(true);
                        setIsTrial(true);
                        setDaysRemaining(999);
                    }
                    /* 
                    else if (diffDays <= trialDays) {
                        console.log("Status: Trial Active");
                        setIsPremium(true); // Trial gives premium access
                        setIsTrial(true);
                    } else {
                        console.log("Status: Expired/Free");
                        setIsPremium(false);
                        setIsTrial(false);
                    }
                    */
                } catch (error) {
                    console.error("Error checking subscription:", error);
                    // Fallback to free just in case
                    setIsPremium(false);
                }
            } else {
                setIsPremium(false);
                setIsTrial(false);
            }

            setLoading(false);
        });

        return unsubscribe;
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
