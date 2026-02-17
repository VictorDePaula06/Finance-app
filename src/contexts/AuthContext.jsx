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
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
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
