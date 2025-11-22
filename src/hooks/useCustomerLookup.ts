import { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getShopCollectionName } from '../config/shopConfig';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
}

export const useCustomerLookup = () => {
  const { currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupCustomer = async (phoneNumber: string): Promise<Customer | null> => {
    if (!currentUser?.shopId) {
      setError('No shop assigned to your account');
      return null;
    }

    if (!phoneNumber.trim()) {
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Clean phone number (remove spaces, dashes, etc.)
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      // Get all customers and filter by phone (to handle different formats)
      const customersRef = collection(db, getShopCollectionName('customers'));
      const querySnapshot = await getDocs(customersRef);
      
      // Try to find a match with different phone formats
      for (const doc of querySnapshot.docs) {
        const customerData = doc.data();
        const storedPhone = customerData.phone || '';
        const cleanStoredPhone = storedPhone.replace(/\D/g, '');
        
        // Match if cleaned phones are the same, or if one ends with the other (handles country codes)
        if (cleanStoredPhone === cleanPhone || 
            cleanStoredPhone.endsWith(cleanPhone) || 
            cleanPhone.endsWith(cleanStoredPhone)) {
      return {
            id: doc.id,
            ...customerData
      } as Customer;
        }
      }
      
      return null;
    } catch (err) {
      console.error('Error looking up customer:', err);
      setError('Failed to lookup customer');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    lookupCustomer,
    isLoading,
    error
  };
};



