import { collection } from 'firebase/firestore';
import { addDoc } from '../offline/firestoreWrappers';
import { db } from '../firebase';

// Replace this with your actual email address
const CURRENT_USER_EMAIL = 'your-email@example.com'; // CHANGE THIS TO YOUR EMAIL

export const addCurrentUserAsAdmin = async () => {
  try {
    // Add current user as admin employee in Firestore
    await addDoc(collection(db, 'employees'), {
      name: 'Current User Admin',
      email: CURRENT_USER_EMAIL,
      role: 'Admin',
      status: 'Active',
      uid: 'temp-uid' // This will be updated when you login
    });
    
    console.log('Current user added as admin successfully!');
    console.log('Email:', CURRENT_USER_EMAIL);
    console.log('Role: Admin');
    console.log('You can now login and create other users');
    
    return true;
  } catch (error) {
    console.error('Error adding current user as admin:', error);
    throw error;
  }
};

// Uncomment the line below to add current user as admin
// addCurrentUserAsAdmin();



