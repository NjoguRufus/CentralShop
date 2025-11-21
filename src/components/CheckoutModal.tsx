import React, { useState, useEffect } from 'react';
import { X, CreditCard, Banknote, Smartphone, ShoppingCart, Search, User, Receipt, Clock } from 'lucide-react';
import Button from './UI/Button';
import FormInput from './UI/FormInput';
import Select from './UI/Select';
import LoadingSpinner from './UI/LoadingSpinner';
import { useCustomerLookup } from '../hooks/useCustomerLookup';
import { usePaymentSettings } from '../hooks/usePaymentSettings';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { getShopCollectionName } from '../config/shopConfig';

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentData: PaymentData) => void;
  cart: Product[];
  total: number;
  isLoading?: boolean;
}

interface PaymentData {
  paymentMethod: 'cash' | 'card' | 'mobile' | 'debt' | 'partial';
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

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  cart,
  total,
  isLoading = false
}) => {
  const { currentUser } = useAuth();
  const { lookupCustomer, isLoading: isLookingUpCustomer } = useCustomerLookup();
  const { getAvailablePaymentMethods, loading: settingsLoading } = usePaymentSettings();
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile' | 'debt' | 'partial'>('cash');
  const [debtPaymentType, setDebtPaymentType] = useState<'debt' | 'partial'>('debt'); // Sub-modal type for debt/partial
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [mpesaCode, setMpesaCode] = useState<string>('');
  const [customerFound, setCustomerFound] = useState<boolean>(false);
  const [debtAmount, setDebtAmount] = useState<string>('');
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');

  const availablePaymentMethods = getAvailablePaymentMethods();

  // Fetch customers when modal opens
  useEffect(() => {
    if (isOpen && currentUser?.shopId) {
      fetchCustomers();
    }
  }, [isOpen, currentUser?.shopId]);

  // Set default payment method when modal opens
  useEffect(() => {
    if (isOpen && availablePaymentMethods.length > 0) {
      const defaultMethod = availablePaymentMethods[0].value as 'cash' | 'card' | 'mobile' | 'debt' | 'partial';
      setPaymentMethod(defaultMethod);
    }
  }, [isOpen]); // Only depend on isOpen, not on availablePaymentMethods

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

  const change = paymentMethod === 'cash' && amountReceived 
    ? Math.max(0, parseFloat(amountReceived) - total) 
    : 0;

  const remainingAmount = (paymentMethod === 'debt' && debtPaymentType === 'partial' && partialAmount) 
    ? total - parseFloat(partialAmount)
    : 0;

  const isValidPayment = () => {
    // If no payment methods are available, payment is not valid
    if (availablePaymentMethods.length === 0) {
      return false;
    }
    
    if (paymentMethod === 'cash') {
      return amountReceived && parseFloat(amountReceived) >= total;
    }
    if (paymentMethod === 'mobile') {
      return mpesaCode.trim().length > 0;
    }
    if (paymentMethod === 'card') {
      return true; // Card payments are always valid (no additional input required)
    }
    if (paymentMethod === 'debt') {
      const hasCustomer = selectedCustomerId || (customerName.trim().length > 0 && customerPhone.trim().length > 0);
      return hasCustomer && dueDate.trim().length > 0;
    }
    if (paymentMethod === 'debt' && debtPaymentType === 'partial') {
      const hasCustomer = selectedCustomerId || (customerName.trim().length > 0 && customerPhone.trim().length > 0);
      return partialAmount && parseFloat(partialAmount) > 0 && parseFloat(partialAmount) < total 
        && hasCustomer && dueDate.trim().length > 0;
    }
    return true;
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
    
    const paymentData: PaymentData = {
      paymentMethod,
      amountReceived: paymentMethod === 'cash' ? parseFloat(amountReceived) : undefined,
      change: paymentMethod === 'cash' ? change : undefined,
      customerId: selectedCustomerId || undefined,
      customerName: finalCustomerName || undefined,
      customerEmail: finalCustomerEmail || undefined,
      customerPhone: finalCustomerPhone || undefined,
      mpesaCode: paymentMethod === 'mobile' ? mpesaCode : undefined,
      debtAmount: paymentMethod === 'debt' ? total : undefined,
      partialAmount: (paymentMethod === 'debt' && debtPaymentType === 'partial') ? parseFloat(partialAmount) : undefined,
      remainingAmount: (paymentMethod === 'debt' && debtPaymentType === 'partial') ? remainingAmount : undefined,
      dueDate: paymentMethod === 'debt' ? dueDate : undefined,
    };
    onConfirm(paymentData);
  };

  const handleCustomerPhoneChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const phone = e.target.value;
    setCustomerPhone(phone);
    
    // Lookup customer when phone number is entered
    if (phone.length >= 10) {
      const customer = await lookupCustomer(phone);
      if (customer) {
        setCustomerName(customer.name);
        setCustomerEmail(customer.email);
        setCustomerFound(true);
      } else {
        setCustomerFound(false);
      }
    } else {
      setCustomerFound(false);
    }
  };

  const handleMpesaCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Convert to uppercase
    setMpesaCode(e.target.value.toUpperCase());
  };

  const handleClose = () => {
    // Reset form
    setPaymentMethod('cash');
    setDebtPaymentType('debt');
    setAmountReceived('');
    setSelectedCustomerId('');
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setMpesaCode('');
    setCustomerFound(false);
    setDebtAmount('');
    setPartialAmount('');
    setDueDate('');
    onClose();
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPaymentMethod('cash');
      setDebtPaymentType('debt');
      setAmountReceived('');
      setSelectedCustomerId('');
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setMpesaCode('');
      setCustomerFound(false);
      setDebtAmount('');
      setPartialAmount('');
      setDueDate('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
          {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-[#4A90A4]/90 backdrop-blur-sm text-white">
            <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Checkout</h2>
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
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-0 h-full">
            {/* Order Summary - Left Column */}
            <div className="xl:col-span-1 bg-gray-50 dark:bg-gray-900/50 p-6">
              <div className="sticky top-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <div className="w-2 h-2 bg-[#4A90A4] rounded-full mr-2"></div>
                Order Summary
              </h3>
                
                <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
                {cart.map((item) => (
                    <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {item.name}
                      </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {item.quantity} × KSH {item.price.toFixed(2)}
                      </p>
                    </div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white ml-2">
                      KSH {(item.quantity * item.price).toFixed(2)}
                    </p>
                      </div>
                  </div>
                ))}
              </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                      <span className="text-gray-900 dark:text-white">KSH {(total * 0.909).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Tax (10%):</span>
                      <span className="text-gray-900 dark:text-white">KSH {(total * 0.091).toFixed(2)}</span>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">Total:</span>
                        <span className="text-xl font-bold text-[#4A90A4]">KSH {total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Customer Information */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 mt-6">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <User className="w-4 h-4 mr-2 text-[#4A90A4]" />
                    Customer Information
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Phone Number
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
                    </div>
                    
                    <FormInput
                      name="customerName"
                      type="text"
                      label="Customer Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter customer name"
                      disabled={customerFound}
                      className="text-sm"
                    />
                    <FormInput
                      name="customerEmail"
                      type="email"
                      label="Customer Email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="Enter customer email"
                      disabled={customerFound}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Form - Right Column */}
            <div className="xl:col-span-2 p-6">
              <div className="max-w-2xl mx-auto">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                  <div className="w-2 h-2 bg-[#4A90A4] rounded-full mr-2"></div>
                Payment Details
              </h3>

                {/* Payment Method Selection */}
                <div className="mb-8">
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-4">
                    Select Payment Method
                </label>
                {settingsLoading ? (
                    <div className="flex justify-center py-8">
                      <LoadingSpinner size="sm" />
                  </div>
                ) : availablePaymentMethods.length === 0 ? (
                    <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                      <X className="w-5 h-5 text-red-500" />
                        </div>
                      <div>
                          <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                          No Payment Methods Available
                        </p>
                          <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                          Please enable at least one payment method in Settings
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {availablePaymentMethods.map((method) => {
                      const IconComponent = method.icon === 'Banknote' ? Banknote : 
                                          method.icon === 'CreditCard' ? CreditCard : 
                                            method.icon === 'Smartphone' ? Smartphone :
                                            method.icon === 'Receipt' ? Receipt :
                                            method.icon === 'Clock' ? Clock :
                                          Smartphone;
                      
                      return (
                        <button
                          key={method.value}
                            onClick={() => setPaymentMethod(method.value as 'cash' | 'card' | 'mobile' | 'debt' | 'partial')}
                            className={`group relative p-4 rounded-xl border-2 transition-all duration-200 ${
                            paymentMethod === method.value
                                ? 'border-[#4A90A4] bg-[#4A90A4]/10 text-[#4A90A4] shadow-lg scale-105'
                                : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-[#4A90A4]/50 hover:bg-[#4A90A4]/5 hover:shadow-md'
                            }`}
                          >
                            <div className="flex flex-col items-center space-y-2">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                paymentMethod === method.value 
                                  ? 'bg-[#4A90A4] text-white' 
                                  : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-[#4A90A4]/10'
                              }`}>
                                <IconComponent className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-medium text-center">{method.label}</span>
                            </div>
                            {paymentMethod === method.value && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#4A90A4] rounded-full"></div>
                            )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

                {/* Payment Method Specific Fields */}
                <div className="mb-8">
              {/* Cash Payment Fields */}
              {paymentMethod === 'cash' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                          <Banknote className="w-4 h-4 text-green-600" />
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Cash Payment</h4>
                      </div>
                      <div className="space-y-4">
                  <FormInput
                    name="amountReceived"
                    type="number"
                    label="Amount Received"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                  {amountReceived && parseFloat(amountReceived) > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Due:</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          KSH {total.toFixed(2)}
                        </span>
                      </div>
                            <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Amount Received:</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          KSH {parseFloat(amountReceived).toFixed(2)}
                        </span>
                      </div>
                      {change > 0 && (
                        <div className="flex justify-between items-center pt-2 border-t border-gray-300 dark:border-gray-600">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Change:</span>
                          <span className="text-lg font-bold text-green-600">
                            KSH {change.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {change < 0 && (
                        <div className="flex justify-between items-center pt-2 border-t border-gray-300 dark:border-gray-600">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Amount Short:</span>
                          <span className="text-lg font-bold text-red-600">
                            KSH {Math.abs(change).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                      </div>
                </div>
              )}

              {/* Mobile Payment Fields */}
              {paymentMethod === 'mobile' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                          <Smartphone className="w-4 h-4 text-blue-600" />
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Mobile Payment</h4>
                      </div>
                      <div className="space-y-4">
                  <FormInput
                    name="mpesaCode"
                    type="text"
                    label="M-Pesa Code"
                    value={mpesaCode}
                    onChange={handleMpesaCodeChange}
                    placeholder="Enter M-Pesa transaction code"
                    className="uppercase"
                    required
                  />
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                    Enter the M-Pesa transaction code from the customer's phone
                  </p>
                      </div>
                </div>
              )}

                  {/* Debt/Partial Payment Fields */}
                  {paymentMethod === 'debt' && (
                    <div className={`rounded-xl p-6 border backdrop-blur-sm ${
                      debtPaymentType === 'partial' 
                        ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        : 'bg-orange-50/50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                    }`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            debtPaymentType === 'partial'
                              ? 'bg-blue-100 dark:bg-blue-900/30'
                              : 'bg-orange-100 dark:bg-orange-900/30'
                          }`}>
                            <Receipt className={`w-4 h-4 ${
                              debtPaymentType === 'partial' ? 'text-blue-600' : 'text-orange-600'
                            }`} />
                          </div>
                          <h4 className={`text-lg font-semibold ${
                            debtPaymentType === 'partial'
                              ? 'text-blue-800 dark:text-blue-200'
                              : 'text-orange-800 dark:text-orange-200'
                          }`}>
                            {debtPaymentType === 'debt' ? 'Debt Payment' : 'Partial Payment'}
                          </h4>
                        </div>
                        {/* Switch buttons */}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDebtPaymentType('debt');
                              setPartialAmount('');
                            }}
                            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                              debtPaymentType === 'debt'
                                ? 'bg-orange-600 text-white'
                                : 'bg-white dark:bg-gray-800 text-orange-600 hover:bg-orange-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            Debt Payment
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDebtPaymentType('partial');
                            }}
                            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                              debtPaymentType === 'partial'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white dark:bg-gray-800 text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            Partial Payment
                          </button>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Amount:</span>
                            <span className={`text-lg font-bold ${
                              debtPaymentType === 'partial'
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-orange-600 dark:text-orange-400'
                            }`}>
                              KSH {total.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        {/* Partial Payment Amount Input - Only show for partial */}
                        {debtPaymentType === 'partial' && (
                          <>
                        <FormInput
                          name="partialAmount"
                          type="number"
                              label="Amount to Pay Now *"
                          value={partialAmount}
                          onChange={(e) => setPartialAmount(e.target.value)}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          max={total}
                          required
                        />
                        {partialAmount && parseFloat(partialAmount) > 0 && (
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Amount Paid:</span>
                              <span className="font-semibold text-green-600 dark:text-green-400">
                                KSH {parseFloat(partialAmount).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Remaining:</span>
                              <span className={`font-semibold ${remainingAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                KSH {remainingAmount.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}
                          </>
                        )}
                        
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-4">
                          <p className={`text-sm font-semibold mb-2 ${
                            debtPaymentType === 'partial'
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-orange-700 dark:text-orange-300'
                          }`}>
                            Customer Information Required:
                          </p>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Select Customer (or fill details below)
                            </label>
                            <Select
                              value={selectedCustomerId}
                              onChange={(value) => {
                                setSelectedCustomerId(value);
                                if (!value) {
                                  setCustomerName('');
                                  setCustomerPhone('');
                                  setCustomerEmail('');
                                  setCustomerFound(false);
                                }
                              }}
                              options={[
                                { value: '', label: 'New Customer' },
                                ...customers.map(c => ({ value: c.id, label: `${c.name} - ${c.phone}` }))
                              ]}
                            />
                          </div>
                          {/* Hide customer fields when customer is selected */}
                          {!selectedCustomerId && (
                            <>
                              <FormInput
                                name="customerName"
                                type="text"
                                label="Customer Name *"
                                value={customerName}
                                onChange={(e) => {
                                  setCustomerName(e.target.value);
                                  setCustomerFound(false);
                                }}
                                placeholder="Enter customer name"
                                required
                              />
                              <FormInput
                                name="customerPhone"
                                type="tel"
                                label="Phone Number *"
                                value={customerPhone}
                                onChange={handleCustomerPhoneChange}
                                placeholder="Enter phone number"
                                required
                              />
                              <FormInput
                                name="customerEmail"
                                type="email"
                                label="Email (Optional)"
                                value={customerEmail}
                                onChange={(e) => setCustomerEmail(e.target.value)}
                                placeholder="Enter customer email"
                              />
                            </>
                          )}
                        </div>
                        <FormInput
                          name="dueDate"
                          type="date"
                          label={debtPaymentType === 'partial' ? 'Due Date for Remaining Amount *' : 'Due Date *'}
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          required
                        />
                        <div className={`rounded-lg p-3 ${
                          debtPaymentType === 'partial'
                            ? 'bg-blue-50 dark:bg-blue-900/30'
                            : 'bg-orange-50 dark:bg-orange-900/30'
                        }`}>
                          <p className={`text-sm ${
                            debtPaymentType === 'partial'
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-orange-700 dark:text-orange-300'
                          }`}>
                            An invoice will be automatically created and the customer will be saved to your customer list.
                          </p>
                        </div>
                    </div>
                  </div>
                  )}
                </div>
                

              {/* Action Buttons */}
                <div className="flex space-x-4">
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
                  disabled={!isValidPayment() || isLoading}
                    className="flex-1 py-3 text-base font-medium bg-[#4A90A4] hover:bg-[#3a7a8a] backdrop-blur-sm shadow-lg transition-colors"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Processing...</span>
                      </div>
                    ) : availablePaymentMethods.length === 0 ? (
                      'No Payment Method'
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
