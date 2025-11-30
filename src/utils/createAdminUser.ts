import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { collection } from 'firebase/firestore';
import { addDoc } from '../offline/firestoreWrappers';
import { auth, db } from '../firebase';

export const createAdminUser = async () => {
  try {
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      'admin@aipos.com', 
      'admin123456'
    );
    
    // Update the user's display name
    await updateProfile(userCredential.user, {
      displayName: 'Admin User'
    });

    // Save employee data to Firestore
    await addDoc(collection(db, 'employees'), {
      name: 'Admin User',
      email: 'admin@aipos.com',
      role: 'Admin',
      status: 'Active',
      uid: userCredential.user.uid
    });
    
    console.log('Admin user created successfully!');
    console.log('Email: admin@aipos.com');
    console.log('Password: admin123456');
    
    return userCredential.user;
  } catch (error) {
    console.error('Error creating admin user:', error);
    throw error;
  }
};

// Uncomment the line below to create admin user when this file is imported
// createAdminUser();



