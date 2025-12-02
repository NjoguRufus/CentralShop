import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { addDoc, updateDoc } from '../offline/firestoreWrappers';
import { db } from '../firebase';

export interface EmployeeActivity {
  id: string;
  employeeId: string;
  employeeName: string;
  action: 'login' | 'logout';
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export class EmployeeActivityService {
  static async logActivity(
    employeeId: string,
    employeeName: string,
    action: 'login' | 'logout',
    shopId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    // DISABLED: Employee activities are no longer automatically created
    // This prevents automatic generation of employee_activities documents
    console.log(`Employee activity logging disabled: ${action} for ${employeeName}`);
    return;
    
    /* DISABLED CODE - Employee activities creation
    try {
      await addDoc(collection(db, `shops/${shopId}/employee_activities`), {
        employeeId,
        employeeName,
        action,
        timestamp: new Date(),
        ipAddress,
        userAgent
      });

      // Update employee's last login/logout time and active status
      // Note: employeeId is the document ID from employees collection, not users collection
      try {
        const { doc, getDoc, query, where, getDocs } = await import('firebase/firestore');
        const { getShopCollectionName } = await import('../config/shopConfig');
        
        const updateData: any = {
          updatedAt: new Date()
        };

        if (action === 'login') {
          updateData.lastLogin = new Date();
          updateData.isCurrentlyActive = true;
        } else {
          updateData.lastLogout = new Date();
          updateData.isCurrentlyActive = false;
        }

        // Try to find employee in employees collection by ID
        const employeesCollectionName = getShopCollectionName('employees');
        const employeeRef = doc(db, employeesCollectionName, employeeId);
        
        const employeeDoc = await getDoc(employeeRef);
        if (employeeDoc.exists()) {
          await updateDoc(employeeRef, updateData);
        } else {
          // If not found by ID, try to find by uid field (for dynamic user collections)
          // This is a fallback - silently skip if not found
          console.warn(`Employee document not found for ID: ${employeeId}`);
        }
      } catch (updateError) {
        // Silently fail - activity logging shouldn't break the app
        console.warn('Could not update employee status (non-critical):', updateError);
      }
    } catch (error) {
      console.error('Error logging employee activity:', error);
    }
    */
  }

  static async getEmployeeActivities(shopId: string, employeeId?: string) {
    try {
      let q = query(
        collection(db, `shops/${shopId}/employee_activities`),
        orderBy('timestamp', 'desc')
      );

      if (employeeId) {
        q = query(
          collection(db, `shops/${shopId}/employee_activities`),
          where('employeeId', '==', employeeId),
          orderBy('timestamp', 'desc')
        );
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EmployeeActivity[];
    } catch (error) {
      console.error('Error fetching employee activities:', error);
      return [];
    }
  }

  static async getClientInfo() {
    // Get IP address and user agent for tracking
    const userAgent = navigator.userAgent;
    
    // For IP address, we'll use a simple approach
    // In production, you might want to use a service like ipapi.co
    let ipAddress = 'Unknown';
    
    try {
      // This is a simple approach - in production, use a proper IP service
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      ipAddress = data.ip;
    } catch (error) {
      console.log('Could not fetch IP address');
    }

    return { ipAddress, userAgent };
  }
}

