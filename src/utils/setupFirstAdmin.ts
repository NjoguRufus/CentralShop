import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { collection, addDoc as firestoreAddDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { getUserCollectionName, SHOP_NAME } from '../config/shopConfig';

export const setupFirstAdmin = async (email: string, password: string, name: string, shopName?: string) => {
  try {
    // Use fixed shop name (CentralShop is the main shop)
    const fixedShopName = shopName || SHOP_NAME;
    
    console.log('Creating admin user...');
    
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('✅ Auth user created, UID:', userCredential.user.uid);
    
    // Wait a moment for auth state to propagate to Firestore rules
    // Reduced delay for faster setup - 500ms should be sufficient
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Update the user's display name (non-blocking, don't wait)
    updateProfile(userCredential.user, {
      displayName: name
    }).catch(err => console.warn('Profile update warning:', err));

    // Create shop document first
    let shopId = null;
    let shopNameForUser = fixedShopName;

    console.log('Creating shop document...');
    try {
      // Create shop - use direct Firestore call for speed (not wrapped)
      const shopDoc = await firestoreAddDoc(collection(db, 'shops'), {
        name: fixedShopName,
        description: `${fixedShopName} - Main Shop`,
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
      console.log('✅ Shop document created with ID:', shopId);
    } catch (shopError: any) {
      console.error('❌ Shop creation failed:', shopError);
      console.error('Shop error code:', shopError.code);
      console.error('Shop error message:', shopError.message);
      
      // If permission denied, throw immediately - this is critical
      if (shopError.code === 'permission-denied') {
        throw new Error(`Permission denied creating shop. Check Firestore rules. Error: ${shopError.message}`);
      }
      
      // Re-throw if it's a critical error
      if (!shopError.message?.includes('already exists')) {
        throw new Error(`Failed to create shop: ${shopError.message || shopError.code || 'Unknown error'}`);
      }
      console.warn('Shop creation warning (continuing - may already exist):', shopError);
    }

    // Get the dynamic user collection name (CentralShopStaff)
    // Use fixedShopName - this will generate "CentralShopStaff" for CentralShop
    const userCollectionName = getUserCollectionName(shopId, fixedShopName);
    console.log('Creating user in collection:', userCollectionName);
    console.log('Shop name used:', fixedShopName);
    console.log('Shop ID (may be null):', shopId);
    
    // Verify collection name is correct (should be CentralShopStaff for CentralShop)
    const expectedCollectionName = `${fixedShopName}Staff`;
    if (userCollectionName !== expectedCollectionName) {
      console.error('❌ Collection name mismatch!');
      console.error('Expected:', expectedCollectionName);
      console.error('Got:', userCollectionName);
      throw new Error(`Invalid collection name: ${userCollectionName}. Expected ${expectedCollectionName}.`);
    }
    
    console.log('✅ Collection name verified:', userCollectionName);
    
    // Verify user is authenticated before creating document
    if (!auth.currentUser || auth.currentUser.uid !== userCredential.user.uid) {
      console.error('❌ Auth state mismatch!');
      console.error('Current auth user:', auth.currentUser?.uid);
      console.error('Expected UID:', userCredential.user.uid);
      throw new Error('User authentication state is not ready. Please try again.');
    }
    
    console.log('✅ User authenticated, UID:', auth.currentUser.uid);
    console.log('✅ Proceeding with document creation in:', userCollectionName);
    
    // Save admin user data - use direct Firestore call for speed (not wrapped)
    // This is CRITICAL - must succeed for admin to be usable
    try {
      const userData = {
        name: name,
        email: email,
        role: 'mainAdmin' as const, // First admin is mainAdmin
        status: 'Active' as const,
        uid: userCredential.user.uid,
        shopId: shopId || null, // Allow null if shop creation failed
        shopName: fixedShopName,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log('User data to save:', userData);
      console.log('Collection reference:', userCollectionName);
      
      const userDocRef = await firestoreAddDoc(collection(db, userCollectionName), userData);
      
      console.log('✅ Admin user document created successfully!');
      console.log('User document ID:', userDocRef.id);
      console.log('Collection:', userCollectionName);
      console.log('Email:', email);
      console.log('Shop Name:', fixedShopName);
      console.log('Shop ID:', shopId);
      
      return { user: userCredential.user, shopId };
    } catch (userError: any) {
      console.error('❌ User document creation failed:', userError);
      console.error('Collection name attempted:', userCollectionName);
      console.error('Error code:', userError.code);
      console.error('Error message:', userError.message);
      console.error('Full error:', userError);
      
      // If permission denied, provide helpful message
      if (userError.code === 'permission-denied') {
        throw new Error(`Permission denied creating user in ${userCollectionName}. Check Firestore rules allow creating documents in *Staff collections for authenticated users.`);
      }
      
      throw new Error(`Failed to create user document in ${userCollectionName}: ${userError.message || userError.code || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error creating first admin user:', error);
    throw error;
  }
};

// Example usage:
// setupFirstAdmin('admin@yourcompany.com', 'admin123456', 'Admin User');
