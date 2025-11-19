import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface ShopData {
  id: string;
  name: string;
  description?: string;
  address: string;
  phone: string;
  email: string;
  mainAdminId: string;
  mainAdminName: string;
  mainAdminEmail: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  createdAt: Date;
  updatedAt: Date;
  settings: {
    currency: string;
    taxRate: number;
    timezone: string;
    theme: {
      primary: string;
      secondary: string;
    };
  };
}

export const createShopCollections = async (shopId: string, shopData: ShopData) => {
  try {
    // Create shop document
    await setDoc(doc(db, 'shops', shopId), shopData);

    // Create shop-specific collections
    const shopCollections = [
      'products',
      'customers', 
      'orders',
      'employees',
      'inventory',
      'reports',
      'settings'
    ];

    // Initialize each collection with a placeholder document
    for (const collectionName of shopCollections) {
      await addDoc(collection(db, `shops/${shopId}/${collectionName}`), {
        _initialized: true,
        createdAt: new Date(),
        shopId: shopId
      });
    }

    console.log(`Shop collections created for shop: ${shopData.name}`);
    return true;
  } catch (error) {
    console.error('Error creating shop collections:', error);
    throw error;
  }
};

export const getShopCollectionPath = (shopId: string, collectionName: string) => {
  return `shops/${shopId}/${collectionName}`;
};



