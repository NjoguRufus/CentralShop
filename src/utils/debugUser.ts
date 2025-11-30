// Debug utility to check and create user records
import { collection, query, where, getDocs } from 'firebase/firestore';
import { addDoc } from '../offline/firestoreWrappers';
import { db } from '../firebase';

export const checkUserExists = async (uid: string) => {
  try {
    const usersQuery = query(collection(db, 'users'), where('uid', '==', uid));
    const usersSnapshot = await getDocs(usersQuery);
    
    console.log('Users found for UID:', uid, 'Count:', usersSnapshot.size);
    
    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      const userData = userDoc.data();
      console.log('User data:', userData);
      return { exists: true, data: userData, docId: userDoc.id };
    } else {
      console.log('No user found for UID:', uid);
      return { exists: false, data: null, docId: null };
    }
  } catch (error) {
    console.error('Error checking user:', error);
    return { exists: false, data: null, docId: null, error };
  }
};

export const createDebugUser = async (uid: string, email: string, name: string) => {
  try {
    const userDocRef = await addDoc(collection(db, 'users'), {
      name: name,
      email: email,
      role: 'Admin',
      status: 'Active',
      uid: uid,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('Debug user created with ID:', userDocRef.id);
    return userDocRef.id;
  } catch (error) {
    console.error('Error creating debug user:', error);
    throw error;
  }
};

// Test function to verify user lookup
export const testUserLookup = async (uid: string) => {
  try {
    console.log('Testing user lookup for UID:', uid);
    const usersQuery = query(collection(db, 'users'), where('uid', '==', uid));
    const usersSnapshot = await getDocs(usersQuery);
    
    console.log('Query executed successfully');
    console.log('Users found:', usersSnapshot.size);
    
    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      const userData = userDoc.data();
      console.log('User data:', userData);
      return { success: true, data: userData };
    } else {
      console.log('No user found');
      return { success: true, data: null };
    }
  } catch (error) {
    console.error('Error in testUserLookup:', error);
    return { success: false, error };
  }
};

// Add this to window for debugging in browser console
if (typeof window !== 'undefined') {
  (window as any).debugUser = { checkUserExists, createDebugUser, testUserLookup };
}
