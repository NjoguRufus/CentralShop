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
        // Fetch user data from users collection by UID field
        try {
          console.log('Fetching user data for UID:', firebaseUser.uid);
          const usersQuery = query(collection(db, 'users'), where('uid', '==', firebaseUser.uid));
          const usersSnapshot = await getDocs(usersQuery);
          console.log('User documents found:', usersSnapshot.size);
          
          if (!usersSnapshot.empty) {
            const userDoc = usersSnapshot.docs[0];
            const userData = userDoc.data() as User;
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
              }
            }
          } else {
            // If no user record exists, set currentUser to null
            console.log('No user record found in database for UID:', firebaseUser.uid);
            setCurrentUser(null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
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
