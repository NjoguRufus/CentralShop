// src/pages/Settings.tsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getShopCollectionName } from '../config/shopConfig';
import { useTheme } from '../contexts/ThemeContext';
import Card from '../components/UI/Card';
import FormInput from '../components/UI/FormInput';
import Button from '../components/UI/Button';
import Dropdown from '../components/UI/Dropdown';
import InstallPWAButton from '../components/InstallPWAButton';
import { toast } from 'react-toastify';

interface BusinessInfo {
  name: string;
  address: string;
  phone: string;
  logo?: string;
}

interface ThemeSettings {
  mode: 'light' | 'dark';
  colorScheme: 'blue' | 'green' | 'purple' | 'red' | 'orange' | 'pink' | 'indigo' | 'teal';
  primaryColor: string;
  customColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}


interface PaymentSettings {
  enableCardPayments: boolean;
  enableMobilePayments: boolean;
  enableCashPayments: boolean;
  enableDebtPayments: boolean;
  enablePartialPayments: boolean;
  cardPaymentProvider?: string;
  mobilePaymentProvider?: string;
  autoDownloadReceipt: boolean;
  saveReceipt: boolean;
  receiptFormat: 'PDF' | 'TXT' | 'Image';
}

interface SettingsData {
  businessInfo: BusinessInfo;
  themeSettings: ThemeSettings;
  geminiApiKey: string;
  paymentSettings: PaymentSettings;
  adminPassword: string;
  adminPasswordHint: string;
  aiAssistant: {
    useExternalAI: boolean;
    externalAIProvider: 'chatgpt' | 'gemini';
    openaiApiKey: string;
    geminiApiKey: string;
    model: string;
  };
}

const Settings: React.FC = () => {
  const { currentUser } = useAuth();
  const { theme, colorScheme, primaryColor, toggleTheme, setColorScheme, setPrimaryColor } = useTheme();
  const [activeTab, setActiveTab] = useState<string>('business');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [settings, setSettings] = useState<SettingsData>({
    businessInfo: {
      name: 'CENTRAL SHOP',
      address: '',
      phone: '',
      logo: ''
    },
    themeSettings: {
      mode: 'light',
      colorScheme: 'blue',
      primaryColor: '#3b82f6'
    },
    geminiApiKey: '',
    paymentSettings: {
      enableCardPayments: true,
      enableMobilePayments: true,
      enableCashPayments: true,
      enableDebtPayments: false,
      enablePartialPayments: false,
      cardPaymentProvider: '',
      mobilePaymentProvider: 'M-Pesa',
      autoDownloadReceipt: false,
      saveReceipt: false,
      receiptFormat: 'PDF'
    },
    adminPassword: '',
    adminPasswordHint: '',
    aiAssistant: {
      useExternalAI: false,
      externalAIProvider: 'chatgpt',
      openaiApiKey: '',
      geminiApiKey: '',
      model: 'gpt-3.5-turbo'
    }
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async (): Promise<void> => {
    try {
      setLoading(true);
      
      if (!currentUser?.shopId) {
        toast.error('No shop assigned to your account');
        return;
      }
      
      const docRef = doc(db, getShopCollectionName('settings'), 'general');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as Partial<SettingsData>;
        setSettings(prev => ({
          ...prev,
          ...data,
          businessInfo: {
            ...prev.businessInfo,
            ...(data.businessInfo || {}),
            name: 'CENTRAL SHOP' // Always set to CENTRAL SHOP
          },
          themeSettings: {
            ...prev.themeSettings,
            ...(data.themeSettings || {})
          },
          paymentSettings: {
            ...prev.paymentSettings,
            ...(data.paymentSettings || {})
          },
          aiAssistant: {
            ...prev.aiAssistant,
            ...(data.aiAssistant || {})
          }
        }));
      }
    } catch (error) {
      toast.error('Failed to fetch settings');
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (): Promise<void> => {
    try {
      setSaving(true);
      
      if (!currentUser?.shopId) {
        toast.error('No shop assigned to your account');
        return;
      }
      
      const mergedSettings: SettingsData = {
        ...settings,
        businessInfo: {
          ...settings.businessInfo,
          name: 'CENTRAL SHOP' // Always save as CENTRAL SHOP
        },
        themeSettings: {
          ...settings.themeSettings,
          mode: theme,
          colorScheme,
          primaryColor
        }
      };

      console.log('Saving settings:', mergedSettings);
      await setDoc(doc(db, getShopCollectionName('settings'), 'general'), mergedSettings);
      console.log('Settings saved successfully');
      toast.success('Settings saved successfully');
      
      // Apply theme settings
      if (mergedSettings.themeSettings.mode === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
      // Apply primary color
      document.documentElement.style.setProperty('--color-primary', mergedSettings.themeSettings.primaryColor);
    } catch (error) {
      toast.error('Failed to save settings');
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handlePrimaryColorChange = (value: string): void => {
    setPrimaryColor(value);
    setSettings(prev => ({
      ...prev,
      themeSettings: {
        ...prev.themeSettings,
        primaryColor: value
      }
    }));
  };

  const handleBusinessInfoChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    // Prevent changing business name - it's always CENTRAL SHOP
    if (name === 'name') {
      return;
    }
    setSettings(prev => ({
      ...prev,
      businessInfo: {
        ...prev.businessInfo,
        [name]: value
      }
    }));
  };




  const handleAdminPasswordChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSettings(prev => ({
      ...prev,
      adminPassword: e.target.value
    }));
  };

  const handleAdminPasswordHintChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSettings(prev => ({
      ...prev,
      adminPasswordHint: e.target.value
    }));
  };

  const handleAIAssistantChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setSettings(prev => ({
      ...prev,
      aiAssistant: {
        ...prev.aiAssistant,
        [name]: type === 'checkbox' ? checked : value
      }
    }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'aipos_logos'); // Using global preset
      
      try {
        const response = await fetch(
          'https://api.cloudinary.com/v1_1/demo/image/upload', // Using global cloud name
          {
            method: 'POST',
            body: formData,
          }
        );
        const data = await response.json();
        setSettings(prev => ({
          ...prev,
          businessInfo: {
            ...prev.businessInfo,
            logo: data.secure_url
          }
        }));
        toast.success('Logo uploaded successfully');
      } catch (error) {
        toast.error('Failed to upload logo');
        console.error('Error uploading logo:', error);
      }
    }
  };

  const tabs = [
    { id: 'business', label: 'Business Info' },
    { id: 'theme', label: 'Theme Settings' },
    { id: 'payments', label: 'Payment Settings' },
    { id: 'app', label: 'App Settings' }
  ];

  const adminProtectedTabs: string[] = [];

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">Settings</h1>
        <Card className="p-6">
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">Settings</h1>

      <Card className="p-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
          <nav className="-mb-px flex space-x-8">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 text-sm font-medium whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          </div>
        </div>

        <div className="mt-6">
          {activeTab === 'business' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Logo</label>
                <input 
                  type="file" 
                  onChange={handleLogoUpload} 
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-100" 
                />
                {settings.businessInfo?.logo && (
                  <img src={settings.businessInfo.logo} alt="Business Logo" className="w-20 h-20 rounded-full mt-2 object-cover" />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Name</label>
                <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold">
                  CENTRAL SHOP
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Business name is fixed and cannot be changed</p>
              </div>
              <FormInput
                label="Address"
                name="address"
                type="text"
                value={settings.businessInfo.address}
                onChange={handleBusinessInfoChange}
              />
              <FormInput
                label="Phone"
                name="phone"
                type="tel"
                value={settings.businessInfo.phone}
                onChange={handleBusinessInfoChange}
              />
            </div>
          )}

          {activeTab === 'theme' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-white">Theme Settings</h3>
              
              {/* Theme Mode */}
            <div className="space-y-4">
              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Theme Mode</label>
                  <div className="flex space-x-4">
                    <button
                      onClick={toggleTheme}
                      className={`flex items-center space-x-2 px-4 py-3 rounded-lg border-2 transition-all ${
                        theme === 'light'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full ${theme === 'light' ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
                      <span className="font-medium">Light Mode</span>
                    </button>
                    <button
                      onClick={toggleTheme}
                      className={`flex items-center space-x-2 px-4 py-3 rounded-lg border-2 transition-all ${
                        theme === 'dark'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full ${theme === 'dark' ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
                      <span className="font-medium">Dark Mode</span>
                    </button>
                  </div>
              </div>

                {/* Color Schemes */}
              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Color Scheme</label>
                  <div className="grid grid-cols-4 gap-3">
                    {(['blue', 'green', 'purple', 'red', 'orange', 'pink', 'indigo', 'teal'] as const).map((scheme) => (
                      <button
                        key={scheme}
                        onClick={() => setColorScheme(scheme)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          colorScheme === scheme
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      >
                <div className="flex items-center space-x-2">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: `var(--color-primary)` }}
                          ></div>
                          <span className="text-sm font-medium capitalize">{scheme}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Primary Color */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Custom Primary Color</label>
                  <div className="flex items-center space-x-3">
                  <input
                    type="color"
                      value={primaryColor}
                      onChange={(e) => handlePrimaryColorChange(e.target.value)}
                      className="w-12 h-12 rounded-lg border-2 border-gray-300 dark:border-gray-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => handlePrimaryColorChange(e.target.value)}
                      placeholder="#3b82f6"
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    This color will be used throughout the application
                  </p>
                </div>

                {/* Live Preview */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Live Preview</h4>
                  <div className="flex items-center space-x-4">
                    <button 
                      className="px-4 py-2 rounded-lg text-white font-medium"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Primary Button
                    </button>
                    <div 
                      className="w-8 h-8 rounded-full"
                      style={{ backgroundColor: primaryColor }}
                    ></div>
                    <div 
                      className="w-16 h-4 rounded"
                      style={{ backgroundColor: primaryColor, opacity: 0.3 }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-white">Payment Methods</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Cash Payments</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Allow customers to pay with cash</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.paymentSettings?.enableCashPayments || false}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        paymentSettings: {
                          ...prev.paymentSettings,
                          enableCashPayments: e.target.checked
                        }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Mobile Payments (M-Pesa)</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Allow customers to pay via mobile money</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.paymentSettings?.enableMobilePayments || false}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        paymentSettings: {
                          ...prev.paymentSettings,
                          enableMobilePayments: e.target.checked
                        }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Debt Payments</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Allow customers to pay later (debt/credit). Partial payments are accessed through debt payment.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.paymentSettings?.enableDebtPayments || false}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        paymentSettings: {
                          ...prev.paymentSettings,
                          enableDebtPayments: e.target.checked
                        }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'app' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-white">App Settings</h3>
              
              <div className="space-y-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Install App</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Install Central Shop POS as a Progressive Web App for better performance and offline access
                      </p>
                    </div>
                    <InstallPWAButton />
                  </div>
                </Card>

                <Card className="p-4">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Offline Mode</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Central Shop POS works offline. Your data will sync automatically when you're back online.
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`w-2 h-2 rounded-full ${navigator.onLine ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                      <span className="text-gray-600 dark:text-gray-400">
                        {navigator.onLine ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

        </div>

        <div className="flex justify-end pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
          <Button 
            onClick={saveSettings} 
            disabled={saving}
            className="min-w-[120px]"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Settings;