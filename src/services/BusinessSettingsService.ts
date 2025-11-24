// src/services/BusinessSettingsService.ts
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface BusinessInfo {
  name: string;
  address: string;
  phone: string;
  email?: string;
}

export class BusinessSettingsService {
  static async getBusinessInfo(shopId: string): Promise<BusinessInfo> {
    try {
      if (!shopId) {
        console.warn('No shopId provided, using default business info');
        return {
          name: 'Your Business',
          address: 'Your Business Address',
          phone: 'Your Business Phone',
          email: ''
        };
      }

      // Get from shop-specific settings document
      const settingsDoc = await getDoc(doc(db, 'shops', shopId, 'settings', 'general'));
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        const businessInfo = data.businessInfo || {};
        return {
          name: businessInfo.name || 'Your Business',
          address: businessInfo.address || 'Your Business Address',
          phone: businessInfo.phone || 'Your Business Phone',
          email: businessInfo.email || ''
        };
      }

      // Fallback to default values
      console.warn('No settings found for shopId:', shopId, 'using default business info');
      return {
        name: 'Your Business',
        address: 'Your Business Address',
        phone: 'Your Business Phone',
        email: ''
      };
    } catch (error) {
      console.error('Error fetching business info for shopId:', shopId, error);
      return {
        name: 'Your Business',
        address: 'Your Business Address',
        phone: 'Your Business Phone',
        email: ''
      };
    }
  }
}
