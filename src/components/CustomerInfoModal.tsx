import React, { useState, useEffect } from 'react';
import { X, User, Search, ShoppingCart, ChevronLeft } from 'lucide-react';
import Button from './UI/Button';
import FormInput from './UI/FormInput';
import Select from './UI/Select';
import { useCustomerLookup } from '../hooks/useCustomerLookup';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { getShopCollectionName } from '../config/shopConfig';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

interface PaymentData {
  paymentMethod: 'cash' | 'mobile' | 'debt' | 'partial';
  amountReceived?: number;
  change?: number;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  mpesaCode?: string;
  debtAmount?: number;
  partialAmount?: number;
  remainingAmount?: number;
  dueDate?: string;
}

interface CustomerInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentData: PaymentData) => void;
  paymentData: Partial<PaymentData>;
  isLoading?: boolean;
}

const CustomerInfoModal: React.FC<CustomerInfoModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  paymentData,
  isLoading = false
}) => {
  const { currentUser } = useAuth();
  const { lookupCustomer, isLoading: isLookingUpCustomer } = useCustomerLookup();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerFound, setCustomerFound] = useState<boolean>(false);
  const [customerNotFound, setCustomerNotFound] = useState<boolean>(false);

  // Fetch customers when modal opens
  useEffect(() => {
    if (isOpen && currentUser?.shopId) {
      fetchCustomers();
    }
  }, [isOpen, currentUser?.shopId]);

  // Auto-fill customer details when customer is selected
  useEffect(() => {
    if (selectedCustomerId) {
      const customer = customers.find(c => c.id === selectedCustomerId);
      if (customer) {
        setCustomerName(customer.name);
        setCustomerPhone(customer.phone);
        setCustomerEmail(customer.email || '');
        setCustomerFound(true);
      }
    } else {
      setCustomerFound(false);
    }
  }, [selectedCustomerId, customers]);

  const fetchCustomers = async () => {
    try {
      if (!currentUser?.shopId) return;
      const q = query(collection(db, getShopCollectionName('customers')), orderBy('name'));
      const querySnapshot = await getDocs(q);
      const customersData: Customer[] = [];
      querySnapshot.forEach((doc) => {
        customersData.push({ id: doc.id, ...doc.data() } as Customer);
      });
      setCustomers(customersData);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleCustomerPhoneChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const phone = e.target.value;
    setCustomerPhone(phone);
    setCustomerNotFound(false);
    setCustomerFound(false);
    
    // Clear name if phone is cleared
    if (phone.length === 0) {
      setCustomerName('');
      return;
    }
    
    // Lookup customer when phone number is entered (at least 10 digits)
    if (phone.length >= 10) {
      const customer = await lookupCustomer(phone);
      if (customer) {
        setCustomerName(customer.name);
        setCustomerEmail(customer.email || '');
        setCustomerFound(true);
        setCustomerNotFound(false);
      } else {
        setCustomerFound(false);
        setCustomerNotFound(true);
        // Don't clear the name field - let user enter it manually
      }
    } else {
      setCustomerFound(false);
      setCustomerNotFound(false);
    }
  };

  const handleConfirm = () => {
    // Get customer data - use selected customer data if available, otherwise use entered data
    let finalCustomerName = customerName;
    let finalCustomerPhone = customerPhone;
    let finalCustomerEmail = customerEmail;
    
    if (selectedCustomerId) {
      const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
      if (selectedCustomer) {
        finalCustomerName = selectedCustomer.name;
        finalCustomerPhone = selectedCustomer.phone;
        finalCustomerEmail = selectedCustomer.email || '';
      }
    }
    
    const finalPaymentData: PaymentData = {
      ...paymentData,
      customerId: selectedCustomerId || undefined,
      customerName: finalCustomerName || undefined,
      customerEmail: finalCustomerEmail || undefined,
      customerPhone: finalCustomerPhone || undefined,
    } as PaymentData;
    
    onConfirm(finalPaymentData);
  };

  const handleClose = () => {
    // Reset form
    setSelectedCustomerId('');
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setCustomerFound(false);
    onClose();
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedCustomerId('');
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setCustomerFound(false);
      setCustomerNotFound(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-[#4A90A4]/90 backdrop-blur-sm text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Customer Information</h2>
              <p className="text-sm text-white/80">Complete your order</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-xl mx-auto space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone Number (Optional)
                </label>
                <div className="relative">
                  <FormInput
                    name="customerPhone"
                    type="tel"
                    value={customerPhone}
                    onChange={handleCustomerPhoneChange}
                    placeholder="Enter phone number"
                    className="pr-8 text-sm"
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    {isLookingUpCustomer ? (
                      <div className="w-3 h-3 border-2 border-[#4A90A4] border-t-transparent rounded-full animate-spin"></div>
                    ) : customerFound ? (
                      <User className="w-3 h-3 text-green-500" />
                    ) : (
                      <Search className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                </div>
                {customerFound && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center">
                    <User className="w-3 h-3 mr-1" />
                    Customer found
                  </p>
                )}
                {customerNotFound && customerPhone.length >= 10 && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center">
                    <Search className="w-3 h-3 mr-1" />
                    No customer found
                  </p>
                )}
              </div>
              
              <div className="space-y-1">
                <label className="block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">
                  Customer Name
                </label>
                <input
                  name="customerName"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  disabled={customerFound}
                  className="w-full px-2 md:px-3 py-1.5 md:py-2 text-sm rounded-lg md:rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4A90A4] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Customer email removed from display as requested */}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={handleClose}
            variant="secondary"
            disabled={isLoading}
            className="flex-1 py-3 text-base font-medium"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !customerName.trim()}
            className="flex-1 py-3 text-base font-medium bg-[#4A90A4] hover:bg-[#3a7a8a] backdrop-blur-sm shadow-lg transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Processing...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <ShoppingCart className="w-4 h-4" />
                <span>Complete Order</span>
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CustomerInfoModal;

