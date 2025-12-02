import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

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

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export default app;