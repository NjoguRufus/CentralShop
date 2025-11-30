import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { collection } from 'firebase/firestore';
import { addDoc } from '../offline/firestoreWrappers';
import { auth, db } from '../firebase';
import { getUserCollectionName } from '../config/shopConfig';

export const setupFirstAdmin = async (email: string, password: string, name: string, shopName?: string) => {
  try {
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update the user's display name
    await updateProfile(userCredential.user, {
      displayName: name
    });

    let shopId = null;
    let shopNameForUser = null;

    // If shop name is provided, create a shop for this admin
    if (shopName) {
      const shopDoc = await addDoc(collection(db, 'shops'), {
        name: shopName,
        description: `${shopName} - Main Shop`,
        address: 'To be updated',
        phone: 'To be updated',
        email: email,
        mainAdminId: userCredential.user.uid,
        mainAdminName: name,
        mainAdminEmail: email,
        status: 'Active',
        createdAt: new Date(),
        updatedAt: new Date(),
        settings: {
          currency: 'USD',
          taxRate: 0.1,
          timezone: 'UTC',
          theme: {
            primary: '#4A90A4',
            secondary: '#9DC3E6'
          }
        }
      });
      shopId = shopDoc.id;
      shopNameForUser = shopName;
    }

    // Get the dynamic user collection name based on shop name
    const userCollectionName = getUserCollectionName(shopId, shopName || undefined);
    
    // Save admin user data to dynamic users collection (e.g., CentralShopUsers)
    const userDocRef = await addDoc(collection(db, userCollectionName), {
      name: name,
      email: email,
      role: 'mainAdmin', // First admin is mainAdmin
      status: 'Active',
      uid: userCredential.user.uid,
      shopId: shopId,
      shopName: shopNameForUser,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('User document created with ID:', userDocRef.id);
    
    console.log('First admin user created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Role: Admin');
    if (shopId) {
      console.log('Shop ID:', shopId);
      console.log('Shop Name:', shopName);
    }
    
    return { user: userCredential.user, shopId };
  } catch (error) {
    console.error('Error creating first admin user:', error);
    throw error;
  }
};

// Example usage:
// setupFirstAdmin('admin@yourcompany.com', 'admin123456', 'Admin User');
