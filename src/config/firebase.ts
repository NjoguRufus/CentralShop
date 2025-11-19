import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyC5XAvCl_p0SgbRDJiphL8JjD5pK-D1nXI",
  authDomain: "ai-pos-16420.firebaseapp.com",
  projectId: "ai-pos-16420",
  storageBucket: "ai-pos-16420.firebasestorage.app",
  messagingSenderId: "937569218744",
  appId: "1:937569218744:web:ed50d37c824d4a63c2c44d",
  measurementId: "G-8QHVE1JT92"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export default app;