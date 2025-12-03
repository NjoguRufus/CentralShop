// src/firebase.ts
// Firebase modular SDK init
// TODO: move config to .env and never commit secrets to repo.

import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getAnalytics, type Analytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB4o2QE0gvbm2thNlAzf3DPDgNE3iC78dE",
  authDomain: "centralbackup-a7dc0.firebaseapp.com",
  projectId: "centralbackup-a7dc0",
  storageBucket: "centralbackup-a7dc0.firebasestorage.app",
  messagingSenderId: "852031117658",
  appId: "1:852031117658:web:8e9ab7181c194aa6d8bb63",
  measurementId: "G-XZPYC5ZTDV"
};

// Initialize Firebase app only if it doesn't already exist (prevents duplicate app error)
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with offline persistence
// Try to initialize with persistence, fall back to getFirestore if already initialized
let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (error: any) {
  // If Firestore is already initialized, just get the existing instance
  if (error.code === 'failed-precondition' || error.message?.includes('already been initialized')) {
    db = getFirestore(app);
  } else {
    // Re-throw other errors
    throw error;
  }
}
export { db };

export const auth: Auth = getAuth(app);

// Initialize Analytics (only in browser environment)
export const analytics: Analytics | null = typeof window !== 'undefined' ? getAnalytics(app) : null;

export default app;
