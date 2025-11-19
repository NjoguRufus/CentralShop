import React, { useState } from 'react';
import { setupFirstAdmin } from '../utils/setupFirstAdmin';
import { setupAstraronix } from '../utils/setupAstraronix';
import Card from '../components/UI/Card';
import FormInput from '../components/UI/FormInput';
import Button from '../components/UI/Button';
import { toast } from 'react-toastify';

const Setup: React.FC = () => {
  const [accountType, setAccountType] = useState<'astraronix' | 'admin'>('astraronix');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    shopName: ''
  });
  const [loading, setLoading] = useState(false);

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
        toast.success('Astraronix account created successfully! You can now access the Developer Dashboard.');
      } else {
        if (!formData.shopName.trim()) {
          toast.error('Shop name is required for admin accounts');
          return;
        }
        await setupFirstAdmin(formData.email, formData.password, formData.name, formData.shopName);
        toast.success('Admin user and shop created successfully! You can now login.');
      }
      // Redirect to login or dashboard
      window.location.href = '/';
    } catch (error: any) {
      console.error('Setup error:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Email is already in use');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password should be at least 6 characters');
      } else {
        toast.error('Failed to create admin user');
      }
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
              <FormInput
                label="Shop Name"
                name="shopName"
                type="text"
                value={formData.shopName}
                onChange={handleInputChange}
                required={accountType === 'admin'}
                placeholder="Enter your shop name"
              />
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
