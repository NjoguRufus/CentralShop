export interface User {
  id: string;
  email: string;
  role: 'admin' | 'employee';
  name: string;
  createdAt: Date;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  image?: string;
  category: string;
  barcode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  loyaltyPoints: number;
  createdAt: Date;
}

export interface OrderItem {
  productId: string;
  product: Product;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  customerId?: string;
  customer?: Customer;
  items: OrderItem[];
  total: number;
  subtotal: number;
  tax: number;
  status: 'pending' | 'completed' | 'refunded';
  paymentMethod: 'cash' | 'card' | 'digital';
  createdAt: Date;
  employeeId: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'astraronix' | 'mainAdmin' | 'Admin' | 'Cashier' | 'Stock Manager';
  status: 'Active' | 'Inactive';
  avatar?: string;
  uid: string;
  shopId?: string;
  shopName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Shop {
  id: string;
  name: string;
  description?: string;
  address: string;
  phone: string;
  email: string;
  mainAdminId: string;
  mainAdminName: string;
  mainAdminEmail: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  createdAt: Date;
  updatedAt: Date;
  settings: {
    currency: string;
    taxRate: number;
    timezone: string;
    theme: {
      primary: string;
      secondary: string;
    };
  };
}

export interface BusinessSettings {
  name: string;
  logo?: string;
  address: string;
  phone: string;
  email: string;
  taxRate: number;
  currency: string;
  theme: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration?: number; // in minutes
  category?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId?: string;
  customer?: Customer;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  dueDate: Date;
  paidDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  type: 'product' | 'service';
  productId?: string;
  serviceId?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: Date;
  category: ExpenseCategory;
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'mobile_money';
  status: 'pending' | 'approved' | 'rejected';
  supplierId?: string;
  supplierName?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  color: string;
  isActive: boolean;
  createdAt: Date;
}

export interface PaymentSettings {
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