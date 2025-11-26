import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { getUserCollectionName, BRANCHES } from '../config/shopConfig';
import Dropdown from '../components/UI/Dropdown';

// Role color mapping with glassmorphism
const roleColors: Record<string, string> = {
  astraronix: "bg-rose-600/80 backdrop-blur-xl border-rose-500/30",
  mainAdmin: "bg-purple-600/80 backdrop-blur-xl border-purple-500/30",
  Admin: "bg-blue-600/80 backdrop-blur-xl border-blue-500/30",
  Cashier: "bg-green-600/80 backdrop-blur-xl border-green-500/30",
  "Stock Manager": "bg-yellow-600/80 backdrop-blur-xl border-yellow-500/30",
};

const Login: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    selectedShop: BRANCHES.CENTRAL
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detectedRole, setDetectedRole] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Handle email lookup to detect role (called immediately on email input)
  const handleEmailLookup = async (email: string, shop?: string) => {
    if (!email || !email.includes("@")) {
      setDetectedRole(null);
      return;
    }

    setIsLookingUp(true);
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const shopToCheck = shop || formData.selectedShop;
      
      // Try both shops if no specific shop is selected
      const shopsToCheck = shopToCheck === BRANCHES.CENTRAL 
        ? [BRANCHES.CENTRAL, BRANCHES.KAMWENE] 
        : [shopToCheck];
      
      for (const shopName of shopsToCheck) {
        // Try dynamic user collection first (e.g., CentralShopUsers, KamweneShopUsers)
        const userCollectionName = getUserCollectionName(undefined, shopName);
        
        const dynamicUsersQuery = query(
          collection(db, userCollectionName),
          where('email', '==', normalizedEmail)
        );
        const dynamicUsersSnapshot = await getDocs(dynamicUsersQuery);
        
        if (!dynamicUsersSnapshot.empty) {
          const userData = dynamicUsersSnapshot.docs[0].data();
          if (userData.role) {
            setDetectedRole(userData.role);
            setIsLookingUp(false);
            return;
          }
        }

        // Try employees collection as fallback
        const employeesCollectionName = `${shopName}Employees`;
        const employeesQuery = query(
          collection(db, employeesCollectionName),
          where('email', '==', normalizedEmail)
        );
        const employeesSnapshot = await getDocs(employeesQuery);
        
        if (!employeesSnapshot.empty) {
          const userData = employeesSnapshot.docs[0].data();
          if (userData.role) {
            setDetectedRole(userData.role);
            setIsLookingUp(false);
            return;
          }
        }
      }

      // Try old users collection for backward compatibility
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', normalizedEmail)
      );
      const usersSnapshot = await getDocs(usersQuery);
      
      if (!usersSnapshot.empty) {
        const userData = usersSnapshot.docs[0].data();
        if (userData.role) {
          setDetectedRole(userData.role);
          setIsLookingUp(false);
          return;
        }
      }

      setDetectedRole(null);
    } catch (error: any) {
      console.error('Error looking up user role:', error);
      setDetectedRole(null);
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Immediately lookup role when email is typed
    if (name === 'email') {
      if (!value || !value.includes("@")) {
        setDetectedRole(null);
      } else {
        // Lookup immediately
        handleEmailLookup(value, formData.selectedShop);
      }
    }
    
    // Re-lookup when shop changes
    if (name === 'selectedShop' && formData.email && formData.email.includes("@")) {
      handleEmailLookup(formData.email, value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(formData.email, formData.password, formData.selectedShop);
      // After successful login, redirect to home
      // RoleBasedRedirect will handle routing to the correct page once currentUser is loaded
      navigate('/', { replace: true });
    } catch (error) {
      // Error is handled in the login function
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-12
                    bg-gray-900 dark:bg-black">
      
      {/* GLASS CARD */}
      <div className="w-full max-w-md p-8 rounded-2xl
                      backdrop-blur-xl bg-white/10 
                      border border-white/10 
                      shadow-[0_0_30px_rgba(0,0,0,0.45)]">

        {/* LOGO */}
        <div className="flex justify-center mb-6">
          <img
            src="/icons/CentalDarkmode.png"
            alt="Central POS Logo"
            className="h-20 md:h-24 w-auto opacity-90"
          />
        </div>

        {/* ROLE RIBBON - Glassmorphism, sized to content */}
        {detectedRole && (
          <div className="flex justify-center mb-4 animate-fadeIn">
            <div
              className={`${roleColors[detectedRole] || "bg-gray-700/20 border-gray-500/30"} 
                          backdrop-blur-sm border
                          text-white text-sm font-medium px-4 py-2 rounded-full
                          shadow-md inline-block
                          animate-fadeIn`}
            >
              {detectedRole}
            </div>
          </div>
        )}
        
        {/* Apple-style loading indicator while looking up */}
        {isLookingUp && !detectedRole && formData.email.includes("@") && (
          <div className="flex flex-col items-center justify-center mb-4">
            <div className="w-12 h-12 mb-3 flex items-center justify-center">
              <img
                src="/icons/CentalDarkmode.png"
                alt="Loading"
                className="w-8 h-8 opacity-70 animate-pulse"
              />
            </div>
            <div className="w-32 h-1 apple-loading-bar rounded-full"></div>
          </div>
        )}

        {/* TITLE */}
        <h2 className="text-white text-center text-2xl font-semibold mb-1">
          Welcome Back
        </h2>
        <p className="text-gray-300 text-center text-sm mb-8">
          Sign in to continue
        </p>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* SHOP SELECTION */}
          <div>
            <label className="block text-gray-200 text-sm font-medium mb-1">
              Shop
            </label>
            <Dropdown
              value={formData.selectedShop}
              onChange={(value) => setFormData({ ...formData, selectedShop: value })}
              options={[
                { value: BRANCHES.CENTRAL, label: 'Central Shop' },
                { value: BRANCHES.KAMWENE, label: 'Kamwene Shop' }
              ]}
              placeholder="Select Shop"
            />
          </div>

          {/* EMAIL */}
          <div>
            <label className="block text-gray-200 text-sm font-medium mb-1">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleInputChange}
              placeholder="name@example.com"
              className="w-full px-3 py-2 rounded-lg
                         bg-white/5 border border-white/20 
                         text-white placeholder-gray-400
                         focus:ring-2 focus:ring-blue-500 focus:outline-none
                         transition-colors"
            />
          </div>

          {/* PASSWORD */}
          <div>
            <label className="block text-gray-200 text-sm font-medium mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                required
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                className="w-full px-3 py-2 pr-10 rounded-lg
                           bg-white/5 border border-white/20 
                           text-white placeholder-gray-400
                           focus:ring-2 focus:ring-blue-500 focus:outline-none
                           transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 
                           text-gray-300 hover:text-white 
                           transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* SIGN IN BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700
                       text-white py-2.5 rounded-lg font-semibold
                       transition-colors disabled:opacity-50
                       disabled:cursor-not-allowed shadow-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>

    </div>
  );
};

export default Login;
