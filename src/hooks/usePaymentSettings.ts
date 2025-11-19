import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

interface PaymentSettings {
  enableCardPayments: boolean;
  enableMobilePayments: boolean;
  enableCashPayments: boolean;
  enableDebtPayments: boolean;
  enablePartialPayments: boolean;
  cardPaymentProvider?: string;
  mobilePaymentProvider?: string;
  autoDownloadReceipt: boolean;
}

export const usePaymentSettings = () => {
  const { currentUser } = useAuth();
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    enableCardPayments: true,
    enableMobilePayments: true,
    enableCashPayments: true,
    enableDebtPayments: false,
    enablePartialPayments: false,
    cardPaymentProvider: '',
    mobilePaymentProvider: 'M-Pesa',
    autoDownloadReceipt: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('usePaymentSettings: currentUser.shopId changed:', currentUser?.shopId);
    fetchPaymentSettings();
  }, [currentUser?.shopId]);

  const fetchPaymentSettings = async () => {
    console.log('fetchPaymentSettings called with shopId:', currentUser?.shopId);
    if (!currentUser?.shopId) {
      console.log('No shopId, setting loading to false');
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching settings from Firebase...');
      const settingsDoc = await getDoc(doc(db, 'shops', currentUser.shopId, 'settings', 'general'));
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        const settings = data.paymentSettings || {
          enableCardPayments: true,
          enableMobilePayments: true,
          enableCashPayments: true,
          enableDebtPayments: false,
          enablePartialPayments: false,
          cardPaymentProvider: '',
          mobilePaymentProvider: 'M-Pesa',
          autoDownloadReceipt: false
        };
        console.log('Loaded payment settings:', settings);
        setPaymentSettings(settings);
      } else {
        console.log('No settings document found, using defaults');
      }
    } catch (error) {
      console.error('Error fetching payment settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvailablePaymentMethods = () => {
    const methods = [];
    
    if (paymentSettings.enableCashPayments) {
      methods.push({ value: 'cash', label: 'Cash', icon: 'Banknote' });
    }
    if (paymentSettings.enableMobilePayments) {
      methods.push({ value: 'mobile', label: 'Mobile', icon: 'Smartphone' });
    }
    if (paymentSettings.enableCardPayments) {
      methods.push({ value: 'card', label: 'Card', icon: 'CreditCard' });
    }
    if (paymentSettings.enableDebtPayments) {
      methods.push({ value: 'debt', label: 'Debt', icon: 'Receipt' });
    }
    if (paymentSettings.enablePartialPayments) {
      methods.push({ value: 'partial', label: 'Partial', icon: 'Clock' });
    }

    // Return empty array if no methods are enabled
    return methods;
  };

  return {
    paymentSettings,
    loading,
    getAvailablePaymentMethods
  };
};
