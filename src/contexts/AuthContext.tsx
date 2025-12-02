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
import { getShopCollectionName, getUserCollectionName, BRANCHES, BranchName } from '../config/shopConfig';
import { cacheUserData, loadCachedUserData, clearCachedUserData, CachedUserData } from '../offline/offlineAuth';
import { initializeOfflineUsers, loadOfflineSession, tryOfflineLogin, clearOfflineSession, OfflineAuthSession } from '../offline/offlineLogin';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'astraronix' | 'mainAdmin' | 'Admin' | 'Cashier' | 'Stock Manager';
  status: 'Active' | 'Inactive';
  avatar?: string;
  uid: string;
  customId?: string; // Custom employee ID (CSH-00-001, MNG-00-001, ADM-00, etc.)
  shopId?: string; // For multi-tenant support
  shopName?: string; // For display purposes
  assignedShops?: string[]; // Shops the user can access
  createdAt: Date;
  updatedAt: Date;
  isOfflineUser?: boolean;
}

interface AuthContextType {
  user: User | null;
  currentUser: User | null; // Firebase Auth user
  loading: boolean;
  login: (email: string, password: string, selectedShop?: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (requiredRole: string) => boolean;
  ignoreAuthStateChange: (duration?: number) => void; // Temporarily ignore auth state changes
  clearIgnoreAuthStateChange: () => void; // Clear the ignore flag immediately
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
  const [ignoreAuthChanges, setIgnoreAuthChanges] = useState<boolean>(false);
  const [storedAdminUser, setStoredAdminUser] = useState<{ firebaseUser: FirebaseUser | null; currentUser: User | null } | null>(null);

  // Helper to map OfflineAuthSession to User
  const offlineSessionToUser = (session: OfflineAuthSession): User => {
    return {
      id: session.uid,
      uid: session.uid,
      name: session.displayName,
      email: session.email,
      role: session.role,
      status: 'Active',
      shopName: session.shopName as BranchName,
      createdAt: new Date(session.loggedInAt),
      updatedAt: new Date(session.loggedInAt),
      isOfflineUser: true
    };
  };

  // Separate function to fetch user data from Firestore
  const fetchUserDataFromFirestore = React.useCallback(async (firebaseUser: FirebaseUser): Promise<void> => {
    try {
      console.log('Fetching user data for UID:', firebaseUser.uid);
      
      let userDoc = null;
      let userData: User | null = null;
          
      // Prefer previously selected shop if stored
      const savedShop = (typeof window !== 'undefined'
        ? (localStorage.getItem('selectedShop') as BranchName | null)
        : null);

      const allBranches: BranchName[] = [BRANCHES.CENTRAL, BRANCHES.KAMWENE];
      const branchesToCheck: BranchName[] = savedShop
        ? Array.from(new Set<BranchName>([savedShop, ...allBranches]))
        : allBranches;

      // Try dynamic user collections for each branch (e.g., CentralShopStaff, KamweneStaff)
      for (const branch of branchesToCheck) {
        if (userData) break;

        const branchUserCollection = getUserCollectionName(undefined, branch);
        const branchUsersQuery = query(
          collection(db, branchUserCollection),
          where('uid', '==', firebaseUser.uid)
        );
        const branchUsersSnapshot = await getDocs(branchUsersQuery);
      
        if (!branchUsersSnapshot.empty) {
          userDoc = branchUsersSnapshot.docs[0];
          userData = {
            ...(userDoc.data() as User),
            // Ensure shopName is set to branch if missing
            shopName: (userDoc.data() as any).shopName || branch,
          } as User;
          break;
        }
      }

      // If still not found, try legacy users and employees collections (Central shop only)
      if (!userData) {
        // Try old users collection (for backward compatibility)
        const usersQuery = query(collection(db, 'users'), where('uid', '==', firebaseUser.uid));
        const usersSnapshot = await getDocs(usersQuery);
        console.log('User documents found in users collection:', usersSnapshot.size);
        
        if (!usersSnapshot.empty) {
          userDoc = usersSnapshot.docs[0];
          userData = userDoc.data() as User;
        } else {
          // If not found in users, try employees collection for each branch
          for (const branch of branchesToCheck) {
            if (userData) break;
            const employeesCollectionName = getShopCollectionName('employees', branch);
            const employeesQuery = query(
              collection(db, employeesCollectionName),
              where('uid', '==', firebaseUser.uid)
            );
          const employeesSnapshot = await getDocs(employeesQuery);
            console.log(
              `User documents found in ${employeesCollectionName} employees collection:`,
              employeesSnapshot.size
            );
          
          if (!employeesSnapshot.empty) {
            userDoc = employeesSnapshot.docs[0];
              userData = {
                ...(userDoc.data() as User),
                shopName: (userDoc.data() as any).shopName || branch,
              } as User;
              break;
            }
          }
        }
      }
      
      if (userData && userDoc) {
        console.log('User data found:', userData);
        const primaryShopRaw: string =
          (userData.shopName as string) ||
          (Array.isArray(userData.assignedShops) && userData.assignedShops.length > 0
            ? userData.assignedShops[0]
            : BRANCHES.CENTRAL);

        // Normalize shopName to one of the known branches, handling legacy values like "Kamwene"
        const normalizedKey = primaryShopRaw.toLowerCase().replace(/\s+/g, '');
        let normalizedShopName: BranchName;
        if (normalizedKey.includes('kamwene')) {
          normalizedShopName = BRANCHES.KAMWENE;
        } else if (normalizedKey.includes('central')) {
          normalizedShopName = BRANCHES.CENTRAL;
        } else {
          // Fallback: default to CentralShop if unknown
          normalizedShopName = BRANCHES.CENTRAL;
        }

        const user: User = {
          ...userData, 
          id: userDoc.id, 
          uid: firebaseUser.uid,
          shopName: normalizedShopName,
          createdAt: (userData as any).createdAt?.toDate?.() || new Date(),
          updatedAt: (userData as any).updatedAt?.toDate?.() || new Date(),
        };

        // Persist selected shop so all pages can default correctly
        if (typeof window !== 'undefined') {
          localStorage.setItem('selectedShop', normalizedShopName);
        }

        setCurrentUser(user);
        
        // Cache user data for offline access
        try {
          await cacheUserData({
            ...user,
            lastSynced: new Date()
          });
        } catch (cacheError) {
          console.warn('Error caching user data:', cacheError);
        }
        
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
        // If no user record exists, try to use cached data as fallback
        const cachedUser = await loadCachedUserData();
        if (cachedUser && cachedUser.uid === firebaseUser.uid) {
          console.log('Using cached user data as fallback');
          const user: User = {
            ...cachedUser,
            createdAt: cachedUser.createdAt instanceof Date ? cachedUser.createdAt : new Date(cachedUser.createdAt),
            updatedAt: cachedUser.updatedAt instanceof Date ? cachedUser.updatedAt : new Date(cachedUser.updatedAt),
          };
          setCurrentUser(user);
          if (!navigator.onLine) {
            toast.info('Using cached user data. Some features may be limited offline.');
          }
        } else {
          // If no user record exists, keep Firebase auth but set currentUser to null
          // This allows the user to see an error message instead of being logged out
          console.warn('No user record found in database for UID:', firebaseUser.uid);
          setCurrentUser(null);
          // Don't sign out - let the UI handle showing an error message
        }
      }
    } catch (error: any) {
      console.error('Error fetching user data:', error);
      
      // If offline or network error, try to use cached data
      if (!navigator.onLine || error.code === 'unavailable' || error.message?.includes('network')) {
        console.log('Network error, trying to load from cache');
        try {
          const cachedUser = await loadCachedUserData();
          if (cachedUser && cachedUser.uid === firebaseUser.uid) {
            console.log('Using cached user data due to network error');
            const user: User = {
              ...cachedUser,
              createdAt: cachedUser.createdAt instanceof Date ? cachedUser.createdAt : new Date(cachedUser.createdAt),
              updatedAt: cachedUser.updatedAt instanceof Date ? cachedUser.updatedAt : new Date(cachedUser.updatedAt),
            };
            setCurrentUser(user);
            toast.info('Using cached user data. You are offline.');
            return;
          }
        } catch (cacheError) {
          console.error('Error loading from cache:', cacheError);
        }
      }
      
      // Check if it's a permission error
      if (error.code === 'permission-denied') {
        console.error('Permission denied when fetching user data. Check Firestore rules.');
        if (navigator.onLine) {
          toast.error('Permission denied. Please contact an administrator.');
        }
      } else {
        console.error('Unexpected error fetching user data:', error);
      }
      // Don't sign out on error - keep Firebase auth active
      setCurrentUser(null);
    }
  }, [lastLoginTracked]);

  useEffect(() => {
    // Initialize offline users store on app startup
    initializeOfflineUsers().catch((error) => {
      console.error('Failed to initialize offline users:', error);
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // If we're ignoring auth state changes (during employee creation), restore the stored admin session
      if (ignoreAuthChanges && storedAdminUser) {
        console.log('Ignoring temporary auth state change, restoring admin session');
        setUser(storedAdminUser.firebaseUser);
        setCurrentUser(storedAdminUser.currentUser);
        setLoading(false);
        return;
      }
      
      if (firebaseUser) {
        setUser(firebaseUser);
        // Try to load from cache first (for offline support)
        try {
          const cachedUser = await loadCachedUserData();
          if (cachedUser && cachedUser.uid === firebaseUser.uid) {
            console.log('Loaded user data from cache for UID:', firebaseUser.uid);
            const user: User = {
              ...cachedUser,
              createdAt: cachedUser.createdAt instanceof Date ? cachedUser.createdAt : new Date(cachedUser.createdAt),
              updatedAt: cachedUser.updatedAt instanceof Date ? cachedUser.updatedAt : new Date(cachedUser.updatedAt),
            };
            setCurrentUser(user);
            setLoading(false);
            
            // If online, sync in background (don't wait)
            if (navigator.onLine) {
              fetchUserDataFromFirestore(firebaseUser).catch(console.error);
            }
            return;
          }
        } catch (cacheError) {
          console.warn('Error loading from cache, fetching from Firestore:', cacheError);
        }
        
        // Fetch user data from Firestore (or use cache if offline)
        await fetchUserDataFromFirestore(firebaseUser);
      } else {
        // No Firebase user. If we're offline, try to restore offline session.
        const offlineSession = loadOfflineSession();
        if (offlineSession && !navigator.onLine) {
          console.log('Restoring offline auth session');
          const offlineUser = offlineSessionToUser(offlineSession);
          setUser(null); // No Firebase user
          setCurrentUser(offlineUser);
          setLastLoginTracked(null);
          setLoading(false);
          return;
        }

        // Default: clear everything
        setUser(null);
        setCurrentUser(null);
        setLastLoginTracked(null);
        await clearCachedUserData();
        clearOfflineSession();
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [ignoreAuthChanges, storedAdminUser, fetchUserDataFromFirestore]);

  // Function to temporarily ignore auth state changes (for employee creation)
  const ignoreAuthStateChange = (duration: number = 5000) => {
    // Store current admin session before it gets changed
    const currentFirebaseUser = auth.currentUser;
    setStoredAdminUser({
      firebaseUser: currentFirebaseUser,
      currentUser: currentUser
    });
    
    // Set flag to ignore auth changes
    setIgnoreAuthChanges(true);
    
    // Clear the flag after duration
    setTimeout(() => {
      setIgnoreAuthChanges(false);
      setStoredAdminUser(null);
    }, duration);
  };

  // Function to clear the ignore flag immediately
  const clearIgnoreAuthStateChange = () => {
    setIgnoreAuthChanges(false);
    setStoredAdminUser(null);
  };

  const login = async (email: string, password: string, selectedShop?: string): Promise<void> => {
    const attemptOfflineLogin = async (): Promise<boolean> => {
      try {
        const session = await tryOfflineLogin(email, password);
        if (session) {
          const offlineUser = offlineSessionToUser(session);
          setCurrentUser(offlineUser);
          toast.info('Offline login successful (IndexedDB credentials).');
          return true;
        }
        return false;
      } catch (error) {
        console.error('Offline login error:', error);
        return false;
      }
    };

    // If we're offline, skip Firebase and go directly to offline login
    if (!navigator.onLine) {
      const ok = await attemptOfflineLogin();
      if (!ok) {
        toast.error('Offline login failed. No matching offline credentials found.');
      }
      return;
    }

    try {
      // Store selected shop in localStorage for use during user data fetch
      if (selectedShop) {
        localStorage.setItem('selectedShop', selectedShop);
      }
      await signInWithEmailAndPassword(auth, email, password);
      clearOfflineSession();
      toast.success('Login successful');
    } catch (error: any) {
      console.error('Login error:', error);

      // If network-related error, try offline login fallback
      if (error.code === 'auth/network-request-failed' || !navigator.onLine) {
        const ok = await attemptOfflineLogin();
        if (ok) return;
        toast.error('Network error and no offline credentials found. Please connect to the internet.');
        return;
      }

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
      // Log logout activity before signing out (only if online)
      if (currentUser && navigator.onLine) {
        try {
          const { ipAddress, userAgent } = await EmployeeActivityService.getClientInfo();
          await EmployeeActivityService.logActivity(
            currentUser.id,
            currentUser.name,
            'logout',
            currentUser.shopId || '',
            ipAddress,
            userAgent
          );
        } catch (error) {
          console.error('Error logging logout activity:', error);
          // Don't fail logout if activity logging fails
        }
      }
      
      // Clear cached user data and offline session
      await clearCachedUserData();
      clearOfflineSession();
      
      await signOut(auth);
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Clear cache even if signOut fails
      await clearCachedUserData();
      clearOfflineSession();
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
    hasPermission,
    ignoreAuthStateChange,
    clearIgnoreAuthStateChange
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
