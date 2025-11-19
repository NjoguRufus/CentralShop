import { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

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
      
      // Query customers by phone number
      const q = query(
        collection(db, `shops/${currentUser.shopId}/customers`),
        where('phone', '==', cleanPhone)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const customerDoc = querySnapshot.docs[0];
      return {
        id: customerDoc.id,
        ...customerDoc.data()
      } as Customer;
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



