import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { toast } from 'react-toastify';
import { EmployeeActivityService } from '../services/EmployeeActivityService';
import { getShopCollectionName, getUserCollectionName } from '../config/shopConfig';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'astraronix' | 'mainAdmin' | 'Admin' | 'Cashier' | 'Stock Manager';
  status: 'Active' | 'Inactive';
  avatar?: string;
  uid: string;
  shopId?: string; // For multi-tenant support
  shopName?: string; // For display purposes
  createdAt: Date;
  updatedAt: Date;
}

interface AuthContextType {
  user: User | null;
  currentUser: User | null; // Firebase Auth user
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (requiredRole: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastLoginTracked, setLastLoginTracked] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Fetch user data from users collection or employees collection by UID field
        try {
          console.log('Fetching user data for UID:', firebaseUser.uid);
          
          let userDoc = null;
          let userData: User | null = null;
          
          // Try dynamic user collection first (e.g., CentralShopUsers)
          const userCollectionName = getUserCollectionName();
          const dynamicUsersQuery = query(collection(db, userCollectionName), where('uid', '==', firebaseUser.uid));
          const dynamicUsersSnapshot = await getDocs(dynamicUsersQuery);
          console.log(`User documents found in ${userCollectionName} collection:`, dynamicUsersSnapshot.size);
          
          if (!dynamicUsersSnapshot.empty) {
            userDoc = dynamicUsersSnapshot.docs[0];
            userData = userDoc.data() as User;
          } else {
            // Try old users collection (for backward compatibility)
            const usersQuery = query(collection(db, 'users'), where('uid', '==', firebaseUser.uid));
            const usersSnapshot = await getDocs(usersQuery);
            console.log('User documents found in users collection:', usersSnapshot.size);
            
            if (!usersSnapshot.empty) {
              userDoc = usersSnapshot.docs[0];
              userData = userDoc.data() as User;
            } else {
              // If not found in users, try employees collection
              const employeesCollectionName = getShopCollectionName('employees');
              const employeesQuery = query(collection(db, employeesCollectionName), where('uid', '==', firebaseUser.uid));
              const employeesSnapshot = await getDocs(employeesQuery);
              console.log('User documents found in employees collection:', employeesSnapshot.size);
              
              if (!employeesSnapshot.empty) {
                userDoc = employeesSnapshot.docs[0];
                userData = userDoc.data() as User;
              }
            }
          }
          
          if (userData && userDoc) {
            console.log('User data found:', userData);
            const user = { 
              ...userData, 
              id: userDoc.id, 
              uid: firebaseUser.uid,
              createdAt: userData.createdAt?.toDate() || new Date(),
              updatedAt: userData.updatedAt?.toDate() || new Date()
            };
            setCurrentUser(user);
            
            // Track login activity (only once per session)
            if (lastLoginTracked !== user.id) {
              try {
                const { ipAddress, userAgent } = await EmployeeActivityService.getClientInfo();
                await EmployeeActivityService.logActivity(
                  user.id,
                  user.name,
                  'login',
                  user.shopId || '',
                  ipAddress,
                  userAgent
                );
                setLastLoginTracked(user.id);
              } catch (error) {
                console.error('Error logging login activity:', error);
                // Don't fail login if activity logging fails
              }
            }
          } else {
            // If no user record exists, keep Firebase auth but set currentUser to null
            // This allows the user to see an error message instead of being logged out
            console.warn('No user record found in database for UID:', firebaseUser.uid);
            console.warn('Searched in collections:', userCollectionName, 'users', getShopCollectionName('employees'));
            setCurrentUser(null);
            // Don't sign out - let the UI handle showing an error message
          }
        } catch (error: any) {
          console.error('Error fetching user data:', error);
          // Check if it's a permission error
          if (error.code === 'permission-denied') {
            console.error('Permission denied when fetching user data. Check Firestore rules.');
            toast.error('Permission denied. Please contact an administrator.');
          } else {
            console.error('Unexpected error fetching user data:', error);
          }
          // Don't sign out on error - keep Firebase auth active
          setCurrentUser(null);
        }
      } else {
        setUser(null);
        setCurrentUser(null);
        setLastLoginTracked(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Login successful');
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/user-not-found') {
        toast.error('No account found with this email');
      } else if (error.code === 'auth/wrong-password') {
        toast.error('Incorrect password');
      } else if (error.code === 'auth/too-many-requests') {
        toast.error('Too many failed attempts. Please try again later');
      } else {
        toast.error('Login failed');
      }
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // Log logout activity before signing out
      if (currentUser) {
        const { ipAddress, userAgent } = await EmployeeActivityService.getClientInfo();
        await EmployeeActivityService.logActivity(
          currentUser.id,
          currentUser.name,
          'logout',
          currentUser.shopId || '',
          ipAddress,
          userAgent
        );
      }
      
      await signOut(auth);
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed');
    }
  };

  const hasPermission = (requiredRole: string): boolean => {
    if (!currentUser) return false;
    
    const roleHierarchy = {
      'astraronix': 5,        // Highest level - developer access
      'mainAdmin': 4,         // Shop owner/admin
      'Admin': 3,             // Shop admin
      'Stock Manager': 2,     // Stock management
      'Cashier': 1            // Basic access
    };
    
    const userLevel = roleHierarchy[currentUser.role as keyof typeof roleHierarchy] || 0;
    const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;
    
    return userLevel >= requiredLevel;
  };

  const value: AuthContextType = {
    user,
    currentUser,
    loading,
    login,
    logout,
    hasPermission
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
