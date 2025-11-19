import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User } from '../types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUser({
            id: firebaseUser.uid,
            ...userDoc.data(),
          } as User);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (userDoc.exists()) {
      setUser({
        id: firebaseUser.uid,
        ...userDoc.data(),
      } as User);
    }
  };

  const signUp = async (email: string, password: string, name: string, role: 'admin' | 'employee' = 'employee') => {
    const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);
    const userData = {
      email,
      name,
      role,
      createdAt: new Date(),
    };
    await setDoc(doc(db, 'users', firebaseUser.uid), userData);
    setUser({
      id: firebaseUser.uid,
      ...userData,
    } as User);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return { user, loading, signIn, signUp, logout };
};