import React, { useState, useEffect } from 'react';
import { setupFirstAdmin } from '../utils/setupFirstAdmin';
import { setupAstraronix } from '../utils/setupAstraronix';
import Card from '../components/UI/Card';
import FormInput from '../components/UI/FormInput';
import Button from '../components/UI/Button';
import { toast } from 'react-toastify';
import { SHOP_NAME } from '../config/shopConfig';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Setup: React.FC = () => {
  const [accountType, setAccountType] = useState<'astraronix' | 'admin'>('astraronix');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const { currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && currentUser) {
      console.log('User already logged in, redirecting to dashboard');
      navigate('/', { replace: true });
    }
  }, [currentUser, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    
    try {
      if (accountType === 'astraronix') {
        await setupAstraronix(formData.email, formData.password, formData.name);
        toast.success('Astraronix account created successfully! Redirecting to dashboard...');
        
        // Give AuthContext a moment to start fetching user data
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Redirect to home - RoleBasedRedirect will route to developer dashboard
        navigate('/', { replace: true });
      } else {
        // Shop name is fixed to CentralShop (main shop)
        const fixedShopName = SHOP_NAME;
        console.log('Starting admin creation with shop:', fixedShopName);
        const result = await setupFirstAdmin(formData.email, formData.password, formData.name, fixedShopName);
        console.log('Admin creation result:', result);
        
        if (result && result.user) {
          // User is already signed in after createUserWithEmailAndPassword
          toast.success('Admin user created successfully! Redirecting to dashboard...');
          
          // Give AuthContext a moment to start fetching user data
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Redirect to home - AuthContext will automatically fetch user data
          // RoleBasedRedirect will handle routing to dashboard once user data is loaded
          navigate('/', { replace: true });
        } else {
          throw new Error('Admin creation completed but no user was returned');
        }
      }
    } catch (error: any) {
      console.error('Setup error:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      // Show detailed error message
      let errorMessage = 'Failed to create admin user';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Email is already in use';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters';
      } else if (error.code === 'permission-denied') {
        errorMessage = 'Permission denied. Check Firestore rules and browser console for details.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      console.error('Full error object:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Setup Account
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Choose your account type to get started
          </p>
        </div>
        
        <Card className="p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Account Type
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setAccountType('astraronix')}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    accountType === 'astraronix'
                      ? 'border-[#4A90A4] bg-[#4A90A4]/10 text-[#4A90A4]'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold">Astraronix</div>
                    <div className="text-sm">Developer</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('admin')}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    accountType === 'admin'
                      ? 'border-[#4A90A4] bg-[#4A90A4]/10 text-[#4A90A4]'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold">Admin</div>
                    <div className="text-sm">Shop Owner</div>
                  </div>
                </button>
              </div>
            </div>

            <FormInput
              label="Full Name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleInputChange}
              required
              placeholder="Enter your full name"
            />
            
            <FormInput
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              placeholder="Enter your email"
            />
            
            <FormInput
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              placeholder="Minimum 6 characters"
            />
            
            <FormInput
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              required
              placeholder="Confirm your password"
            />
            
            {accountType === 'admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Shop Name (Fixed)
                </label>
                <input
                  type="text"
                  value={SHOP_NAME}
                  disabled
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  CentralShop is the main shop. Kamwene is a sub-branch.
                </p>
              </div>
            )}
            
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? `Creating ${accountType === 'astraronix' ? 'Astraronix' : 'Admin'}...` : `Create ${accountType === 'astraronix' ? 'Astraronix' : 'Admin'} Account`}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Setup;
