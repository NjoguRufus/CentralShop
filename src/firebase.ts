// src/firebase.ts
// Firebase modular SDK init
// TODO: move config to .env and never commit secrets to repo.

import { initializeApp, type FirebaseApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getAnalytics, type Analytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDcdFOP2eLJ3ATP3QhEJW5pwhIlrIW5XSU",
  authDomain: "central-shop-34d1b.firebaseapp.com",
  projectId: "central-shop-34d1b",
  storageBucket: "central-shop-34d1b.firebasestorage.app",
  messagingSenderId: "21423536006",
  appId: "1:21423536006:web:e1620c819f24efcdf49e07",
  measurementId: "G-0KNVRM3E1L"
};

const app: FirebaseApp = initializeApp(firebaseConfig);

// Initialize Firestore with offline persistence
export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const auth: Auth = getAuth(app);

// Initialize Analytics (only in browser environment)
export const analytics: Analytics | null = typeof window !== 'undefined' ? getAnalytics(app) : null;

export default app;
