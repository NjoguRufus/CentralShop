// src/firebase.ts
// Firebase modular SDK init
// TODO: move config to .env and never commit secrets to repo.

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC5XAvCl_p0SgbRDJiphL8JjD5pK-D1nXI",
  authDomain: "ai-pos-16420.firebaseapp.com",
  projectId: "ai-pos-16420",
  storageBucket: "ai-pos-16420.firebasestorage.app",
  messagingSenderId: "937569218744",
  appId: "1:937569218744:web:ed50d37c824d4a63c2c44d",
  measurementId: "G-8QHVE1JT92"
};

const app: FirebaseApp = initializeApp(firebaseConfig);

export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);
export default app;
