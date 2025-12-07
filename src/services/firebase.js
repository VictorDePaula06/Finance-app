import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBtOnQ63qNpiA92onErwTkdR7qgCMgt6I8",
    authDomain: "finance-app-fe605.firebaseapp.com",
    projectId: "finance-app-fe605",
    storageBucket: "finance-app-fe605.firebasestorage.app",
    messagingSenderId: "69179787748",
    appId: "1:69179787748:web:8a03854ff1c4dc00115ff1",
    measurementId: "G-SFCY2B4NK6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
