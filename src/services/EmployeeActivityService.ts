import { collection, addDoc, query, where, orderBy, getDocs } from 'firebase/firestore';
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
      const { doc, updateDoc } = await import('firebase/firestore');
      const employeeRef = doc(db, 'users', employeeId);
      
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

      await updateDoc(employeeRef, updateData);
    } catch (error) {
      console.error('Error logging employee activity:', error);
    }
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

