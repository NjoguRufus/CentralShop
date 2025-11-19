import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { addDoc, collection } from 'firebase/firestore';
import { auth, db } from '../firebase';

export const setupAstraronix = async (email: string, password: string, name: string) => {
  try {
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update the user's display name
    await updateProfile(userCredential.user, {
      displayName: name
    });

    // Save astraronix user data to users collection
    await addDoc(collection(db, 'users'), {
      name: name,
      email: email,
      role: 'astraronix',
      status: 'Active',
      uid: userCredential.user.uid,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('Astraronix account created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Role: astraronix (Developer)');
    console.log('You now have access to the Developer Dashboard');
    
    return userCredential.user;
  } catch (error) {
    console.error('Error creating astraronix account:', error);
    throw error;
  }
};

// Example usage:
// setupAstraronix('your-email@astraronix.com', 'your-password', 'Your Name');
