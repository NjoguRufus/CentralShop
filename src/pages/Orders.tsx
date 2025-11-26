// src/pages/Orders.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, updateDoc, doc, query, orderBy, deleteDoc, where, addDoc, Timestamp } from 'firebase/firestore';
import Select from '../components/UI/Select';
import Dropdown from '../components/UI/Dropdown';
import DateInput from '../components/UI/DateInput';
import { db, auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { getShopCollectionName, BRANCHES, BranchName } from '../config/shopConfig';
import { useNotifications } from '../contexts/NotificationContext';
import Card from '../components/UI/Card';
import FormInput from '../components/UI/FormInput';
import Table from '../components/UI/Table';
import Modal from '../components/Modal';
import Button from '../components/UI/Button';
import { Download, Trash2, Archive } from 'lucide-react';
import { toast } from 'react-toastify';
import { ReceiptService, ReceiptData } from '../services/ReceiptService';
import { BusinessSettingsService } from '../services/BusinessSettingsService';

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

interface OrderRecord {
  id?: string;
  customerId: string;
  date: string;
  total: number;
  subtotal?: number;
  tax?: number;
  status: 'pending' | 'completed' | 'refunded' | 'cancelled';
  products?: Product[];
  items?: Array<{
    productId: string;
    quantity: number;
    price: number;
    name?: string;
    category?: string;
  }>;
  paymentMethod?: string;
  amountReceived?: number;
  change?: number;
  customerName?: string;
  customerPhone?: string;
  mpesaCode?: string;
  category?: string;
  createdAt?: any;
  employeeId?: string;
  employeeName?: string;
  debtAmount?: number;
  partialAmount?: number;
  remainingAmount?: number;
  dueDate?: string;
  debtIssuedBy?: string;
  debtIssuedById?: string;
  shopId?: string;
  shopName?: string;
  processedByShopName?: string;
  refundedItems?: Array<{
    productName: string;
    removedBy: string;
    removedById: string;
    removedAt: Date;
    originalItem: any;
  }>;
  lastModifiedBy?: string;
  lastModifiedById?: string;
  lastModifiedAt?: Date;
}

interface Customer {
  id: string;
  name: string;
  email: string;
}

const Orders: React.FC = () => {
  // Ensure hooks are called at the top level
  const { currentUser } = useAuth();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  
  // State hooks
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoaded, setProductsLoaded] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [selectedBranch, setSelectedBranch] = useState<string>('CentralShop');
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [orderToDelete, setOrderToDelete] = useState<OrderRecord | null>(null);
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showSecondConfirmation, setShowSecondConfirmation] = useState<boolean>(false);
  const [isProductDeleteModalOpen, setIsProductDeleteModalOpen] = useState<boolean>(false);
  const [productToDelete, setProductToDelete] = useState<{index: number, name: string} | null>(null);
  const [productDeletePassword, setProductDeletePassword] = useState<string>('');
  const [isDeletingProduct, setIsDeletingProduct] = useState<boolean>(false);

  // Determine if user can switch between shops
  const canSwitchBranches =
    (Array.isArray((currentUser as any)?.assignedShops) &&
      new Set(
        ((currentUser as any).assignedShops as string[]).map(s => s.replace(/\s+/g, '').toLowerCase())
      ).size > 1) ||
    currentUser?.role === 'mainAdmin' ||
    currentUser?.role === 'Admin' ||
    currentUser?.role === 'astraronix';

  // Auto-select the current user's shop as the active branch
  useEffect(() => {
    if (currentUser?.shopName) {
      setSelectedBranch(currentUser.shopName);
    } else if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedShop');
      if (saved) {
        setSelectedBranch(saved);
      }
    }
  }, [currentUser?.shopName]);

  const productsMap = useMemo(() => {
    const map: Record<string, any> = {};
    products.forEach((product) => {
      if (product?.id) {
        map[product.id] = product;
      }
    });
    return map;
  }, [products]);
  
  // Check if user can edit orders (not Cashier)
  const canEditOrders = currentUser?.role !== 'Cashier';
  // Check if user is Main Admin
  const isMainAdmin = currentUser?.role === 'mainAdmin' || currentUser?.role === 'Admin';
  // Check if user can delete products (Admin or Stock Manager)
  const canDeleteProducts = currentUser?.role === 'mainAdmin' || currentUser?.role === 'Admin' || currentUser?.role === 'Stock Manager';

  useEffect(() => {
    if (currentUser?.shopId) {
    fetchCustomers();
    fetchProducts();
    fetchCategories();
    }
  }, [currentUser?.shopId]);

  useEffect(() => {
    if (currentUser?.shopId && productsLoaded) {
      fetchOrders();
    }
  }, [currentUser?.shopId, productsLoaded, selectedBranch]);

  const fetchOrders = async (): Promise<void> => {
    try {
      setLoading(true);
      
      if (!currentUser?.shopId) {
        console.error('No shop ID found for current user');
        toast.error('No shop assigned to your account');
        return;
      }

      const ordersCollectionName = getShopCollectionName('orders', selectedBranch as BranchName);
      
      // If user is a cashier, only fetch their own orders
      // Managers, mainAdmin, and Admin roles see all orders
      let querySnapshot;
      if (currentUser?.role === 'Cashier' && (currentUser?.customId || currentUser?.uid)) {
        // For cashiers, filter by employeeId (using customId if available, fallback to uid) and then sort in memory
        const employeeId = currentUser.customId || currentUser.uid;
        const q = query(
          collection(db, ordersCollectionName),
          where('employeeId', '==', employeeId)
        );
        querySnapshot = await getDocs(q);
      } else {
        // For managers, admins and mainAdmin, fetch all orders with orderBy
        const q = query(collection(db, ordersCollectionName), orderBy('createdAt', 'desc'));
        querySnapshot = await getDocs(q);
      }
      
      let ordersData: OrderRecord[] = [];
      
      querySnapshot.forEach((orderDoc) => {
        const orderData = { id: orderDoc.id, ...orderDoc.data() } as OrderRecord;
        
        // Auto-determine category based on the products in the order
        const { category: computedCategory, categoriesCount } = determineOrderCategory(orderData);
        if (computedCategory) {
          orderData.category = computedCategory;
        }

        if (
          categoriesCount === 1 &&
          computedCategory &&
          computedCategory !== 'multiple' &&
          orderDoc.data().category !== computedCategory
        ) {
          updateDoc(doc(db, ordersCollectionName, orderDoc.id), { category: computedCategory }).catch(err => {
            console.error('Error updating order category:', err);
          });
        }
        
        ordersData.push(orderData);
      });
      
      // Sort cashier orders by createdAt in descending order (most recent first)
      if (currentUser?.role === 'Cashier') {
        ordersData.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.date || 0).getTime();
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.date || 0).getTime();
          return dateB - dateA;
        });
      }

      // Also filter by customId if it exists (for backward compatibility with old orders using uid)
      if (currentUser?.role === 'Cashier' && currentUser?.customId) {
        // Filter to include orders with either customId or uid (for backward compatibility)
        const employeeId = currentUser.customId;
        ordersData = ordersData.filter(order => 
          order.employeeId === employeeId || order.employeeId === currentUser.uid
        );
      }
      setOrders(ordersData);
    } catch (error) {
      toast.error('Failed to fetch orders');
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async (): Promise<void> => {
    try {
      if (!currentUser?.shopId) {
        console.error('No shop ID found for current user');
        return;
      }

      const querySnapshot = await getDocs(collection(db, getShopCollectionName('customers', selectedBranch as BranchName)));
      const customersData: Customer[] = [];
      querySnapshot.forEach((doc) => {
        customersData.push({ id: doc.id, ...doc.data() } as Customer);
      });
      setCustomers(customersData);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchProducts = async (): Promise<void> => {
    try {
      setProductsLoaded(false);
      if (!currentUser?.shopId) {
        setProductsLoaded(true);
        return;
      }
      const productsQuery = query(collection(db, getShopCollectionName('products')));
      const productsSnapshot = await getDocs(productsQuery);
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setProductsLoaded(true);
    }
  };

  const fetchCategories = async (): Promise<void> => {
    try {
      if (!currentUser?.shopId) return;
      // Fetch product categories
      const snap = await getDocs(query(collection(db, getShopCollectionName('productCategories')), orderBy('name')));
      const list: string[] = [];
      snap.forEach(d => list.push((d.data() as any).name));
      setCategories(list);
    } catch (error) {
      console.error('Error fetching product categories:', error);
    }
  };

  // Auto-determine order category based on products
  const determineOrderCategory = (order: OrderRecord): { category: string; categoriesCount: number } => {
    const categorySet = new Set<string>();
    const addCategory = (value?: string) => {
      if (value && typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          categorySet.add(trimmed);
        }
      }
    };

    (order.products || []).forEach((product: any) => {
      addCategory(product?.category || product?.productCategory);
    });

    (order.items || []).forEach((item: any) => {
      addCategory(item?.category);
      if (!item?.category && item?.productId) {
        const productRecord = productsMap[item.productId];
        addCategory(productRecord?.category);
    }
    });

    const categoriesArray = Array.from(categorySet);

    if (categoriesArray.length === 1) {
      return { category: categoriesArray[0], categoriesCount: 1 };
    }

    if (categoriesArray.length > 1) {
      return { category: 'multiple', categoriesCount: categoriesArray.length };
    }

    return { category: order.category || 'multiple', categoriesCount: 0 };
  };

  const getCustomerName = (order: OrderRecord): string => {
    // First check if customerName is directly stored on the order (from checkout)
    if (order.customerName) {
      return order.customerName;
    }
    // If no customerName, try to look up by customerId
    if (order.customerId) {
      const customer = customers.find(c => c.id === order.customerId);
      if (customer) {
        return customer.name;
      }
    }
    // Default to "Walk In Customer" if no customer information is available
    return 'Walk In Customer';
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
  };

  const handleStatusUpdate = async (orderId: string, newStatus: OrderRecord['status']): Promise<void> => {
    try {
      if (!currentUser?.shopId) {
        toast.error('No shop assigned to your account');
        return;
      }
      
      // Use getShopCollectionName directly to ensure correct collection name
      const ordersCollectionName = getShopCollectionName('orders');
      await updateDoc(doc(db, ordersCollectionName, orderId), { status: newStatus });
      toast.success('Order status updated successfully');
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update order status');
      console.error('Error updating order status:', error);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getCustomerName(order).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    // Date filter: support "today" or specific date
    let matchesDate = true;
    if (dateFilter) {
      if (dateFilter === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : (order.date ? new Date(order.date) : null);
        if (orderDate) {
          orderDate.setHours(0, 0, 0, 0);
          matchesDate = orderDate.getTime() === today.getTime();
        } else {
          matchesDate = false;
        }
      } else {
        matchesDate = order.date === dateFilter;
      }
    }
    
    const { category: derivedCategory } = determineOrderCategory(order);
    const matchesCategory = categoryFilter === 'all' || derivedCategory.toLowerCase() === categoryFilter.toLowerCase();
    
    // Payment method filter
    let matchesPaymentMethod = true;
    if (paymentMethodFilter !== 'all') {
      const orderPaymentMethod = order.paymentMethod?.toLowerCase() || '';
      if (paymentMethodFilter === 'cash') {
        matchesPaymentMethod = orderPaymentMethod === 'cash';
      } else if (paymentMethodFilter === 'mpesa') {
        matchesPaymentMethod = orderPaymentMethod === 'mpesa' || orderPaymentMethod === 'm-pesa';
      } else if (paymentMethodFilter === 'debt') {
        matchesPaymentMethod = orderPaymentMethod === 'debt' || !!order.debtAmount;
      }
    }
    
    return matchesSearch && matchesStatus && matchesDate && matchesCategory && matchesPaymentMethod;
  });

  const viewOrderDetails = (order: OrderRecord): void => {
    setSelectedOrder(order);
    setIsDetailModalOpen(true);
  };

  const handleDeleteOrder = (order: OrderRecord): void => {
    setOrderToDelete(order);
    setAdminPassword('');
    setIsDeleteModalOpen(true);
  };

  const handleDeleteProduct = async (): Promise<void> => {
    if (!productToDelete || !selectedOrder || !productDeletePassword.trim()) {
      toast.error('Please enter your login password');
      return;
    }

    try {
      if (!currentUser?.email) {
        toast.error('User email not found');
        return;
      }

      // Verify password by reauthenticating
      const currentFirebaseUser = auth.currentUser;
      if (!currentFirebaseUser) {
        toast.error('User session not found. Please log in again.');
        return;
      }

      const credential = EmailAuthProvider.credential(currentUser.email, productDeletePassword);
      await reauthenticateWithCredential(currentFirebaseUser, credential);

      setIsDeletingProduct(true);

      // Get order items
      const orderItems = selectedOrder.items || selectedOrder.products || [];
      if (productToDelete.index >= orderItems.length) {
        toast.error('Invalid product index');
        return;
      }

      // Remove the product
      const updatedItems = orderItems.filter((_: any, idx: number) => idx !== productToDelete.index);
      
      // Recalculate totals
      const newSubtotal = updatedItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      const newTax = newSubtotal * 0.1;
      const newTotal = newSubtotal + newTax;

      // Update order in Firestore
      const ordersCollectionName = getShopCollectionName('orders');
      await updateDoc(doc(db, ordersCollectionName, selectedOrder.id!), {
        items: updatedItems,
        products: updatedItems,
        subtotal: newSubtotal,
        tax: newTax,
        total: newTotal,
        refundedItems: [
          ...(selectedOrder.refundedItems || []),
          {
            productName: productToDelete.name,
            removedBy: currentUser.name || currentUser.email,
            removedById: currentUser.customId || currentUser.uid,
            removedAt: new Date(),
            originalItem: orderItems[productToDelete.index]
          }
        ],
        lastModifiedBy: currentUser.name || currentUser.email,
        lastModifiedById: currentUser.customId || currentUser.uid,
        lastModifiedAt: new Date()
      });

      // Add notification
      await addNotification({
        title: 'Product Removed from Order',
        message: `${productToDelete.name} was removed from order ${selectedOrder.id} by ${currentUser.name || currentUser.email}`,
        type: 'warning'
      });

      toast.success('Product removed successfully');
      setIsProductDeleteModalOpen(false);
      setProductToDelete(null);
      setProductDeletePassword('');
      fetchOrders();
      // Refresh selected order
      const updatedOrder = { ...selectedOrder, items: updatedItems, products: updatedItems, subtotal: newSubtotal, tax: newTax, total: newTotal };
      setSelectedOrder(updatedOrder);
    } catch (error: any) {
      console.error('Error deleting product:', error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast.error('Incorrect password. Please enter your login password.');
      } else {
        toast.error('Failed to remove product');
      }
    } finally {
      setIsDeletingProduct(false);
    }
  };

  const confirmDeleteOrder = async (): Promise<void> => {
    if (!orderToDelete || !adminPassword.trim()) {
      toast.error('Please enter your login password');
      return;
    }

    // First confirmation - verify login password
    if (!showSecondConfirmation) {
      try {
        if (!currentUser?.email) {
          toast.error('User email not found');
          return;
        }

        // Verify password by reauthenticating with the current user's credentials
        // This will throw an error if the password is incorrect
        const currentFirebaseUser = auth.currentUser;
        if (!currentFirebaseUser) {
          toast.error('User session not found. Please log in again.');
          return;
        }

        const credential = EmailAuthProvider.credential(currentUser.email, adminPassword);
        await reauthenticateWithCredential(currentFirebaseUser, credential);

        // Password is correct, show second confirmation
        setShowSecondConfirmation(true);
        return;
      } catch (error: any) {
        console.error('Error verifying password:', error);
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          toast.error('Incorrect password. Please enter your login password.');
        } else if (error.code === 'auth/user-not-found') {
          toast.error('User account not found');
        } else if (error.code === 'auth/too-many-requests') {
          toast.error('Too many failed attempts. Please try again later.');
        } else {
          toast.error('Error verifying password. Please try again.');
        }
        return;
      }
    }

    // Second confirmation - verify passwords match
    if (adminPassword !== confirmPassword) {
      toast.error('Passwords do not match. Please try again.');
      setConfirmPassword('');
      return;
    }

    try {
      setIsDeleting(true);
      
      // Delete the order
      const { getShopOrdersCollectionNameCached } = await import('../utils/orderCollectionHelper');
      const ordersCollectionName = await getShopOrdersCollectionNameCached(currentUser!.shopId!);
      await deleteDoc(doc(db, ordersCollectionName, orderToDelete.id!));
      
      // Add notification for order deletion
      await addNotification({
        title: 'Order Deleted',
        message: `Order ${orderToDelete.id} has been permanently deleted`,
        type: 'warning'
      });
      
      toast.success('Order deleted successfully');
      setIsDeleteModalOpen(false);
      setOrderToDelete(null);
      setAdminPassword('');
      setConfirmPassword('');
      setShowSecondConfirmation(false);
      fetchOrders();
    } catch (error) {
      toast.error('Failed to delete order');
      console.error('Error deleting order:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadReceipt = async (order: OrderRecord): Promise<void> => {
    let receiptHTML = '';
    try {
      const businessInfo = await BusinessSettingsService.getBusinessInfo(currentUser?.shopId || '');

    const orderDate = order.createdAt?.toDate 
      ? order.createdAt.toDate() 
      : (order.date ? new Date(order.date) : new Date());
    
      const getOrderItems = (): Array<{ name: string; quantity: number; price: number }> => {
      if (order.products && order.products.length > 0) {
        return order.products.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        }));
      } else if (order.items && order.items.length > 0) {
        return order.items.map(item => {
          const product = products.find(p => p.id === item.productId);
          return {
            name: product?.name || item.name || `Product ${item.productId}`,
          quantity: item.quantity,
          price: item.price
          };
        });
      }
      return [];
    };

    const orderItems = getOrderItems();
    const subtotal = order.subtotal || (order.total / 1.1);
    const tax = order.tax || (order.total - subtotal);

      const receiptData: ReceiptData = {
        orderId: order.id || `ORD-${Date.now()}`,
        items: orderItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity
        })),
        subtotal,
        tax,
        total: order.total,
        paymentMethod: order.paymentMethod || 'N/A',
        amountReceived: order.amountReceived,
        change: order.change,
        customerName: order.customerName || 'Walk In Customer',
        customerPhone: order.customerPhone,
        mpesaCode: order.mpesaCode,
        employeeName: order.employeeName || currentUser?.name || 'Central Shop Team',
        timestamp: orderDate,
        businessName: businessInfo.name || 'CENTRAL SHOP',
        businessAddress: businessInfo.address || '',
        businessPhone: businessInfo.phone || ''
      };

      receiptHTML = ReceiptService.buildReceiptHTML(receiptData);
    } catch (error) {
      console.error('Error preparing receipt:', error);
      toast.error('Failed to prepare receipt');
      return;
    }

    // Convert HTML to PDF and download
    try {
      toast.info('Generating PDF...');
      const { default: html2pdf } = await import('html2pdf.js');
      
      // Create iframe for proper rendering (hidden but with proper dimensions)
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '80mm'; // Receipt width
      iframe.style.height = '400mm'; // Enough height for receipt
      iframe.style.border = 'none';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('Could not access iframe document');
      }

      iframeDoc.open();
      iframeDoc.write(receiptHTML);
      iframeDoc.close();

      // Wait for images to load
      await new Promise<void>((resolve) => {
        const images = iframeDoc.getElementsByTagName('img');
        let loadedCount = 0;
        const totalImages = images.length;

        if (totalImages === 0) {
          resolve();
          return;
        }

        const checkComplete = () => {
          loadedCount++;
          if (loadedCount === totalImages) {
            setTimeout(resolve, 500);
          }
        };

        Array.from(images).forEach((img) => {
          if (img.complete) {
            checkComplete();
          } else {
            img.onload = checkComplete;
            img.onerror = checkComplete;
          }
        });
      });

      const element = iframeDoc.body;

      const opt = {
        margin: [5, 5, 5, 5] as [number, number, number, number],
        filename: `Receipt-${order.id || 'Order'}-${new Date().getTime()}.pdf`,
        image: { type: 'jpeg' as 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          logging: false,
          windowWidth: element.scrollWidth,
          windowHeight: element.scrollHeight
        },
        jsPDF: { unit: 'mm', format: [80, 200] as [number, number], orientation: 'portrait' as 'portrait' } // Receipt format
      };

      await html2pdf().set(opt).from(element).save();
      document.body.removeChild(iframe);
      toast.success('Receipt downloaded as PDF');
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Fallback to HTML download
      const blob = new Blob([receiptHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Receipt-${order.id || 'Order'}-${new Date().getTime()}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Receipt downloaded successfully');
    }
  };

  const statusColors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    refunded: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">Orders</h1>
        <div className="flex items-center gap-3">
          {canSwitchBranches && (
            <Dropdown
              value={selectedBranch}
              onChange={setSelectedBranch}
              options={[
                { value: BRANCHES.CENTRAL, label: 'Central Shop Orders' },
                { value: BRANCHES.KAMWENE, label: 'Kamwene Orders' }
              ]}
              placeholder="Select Branch"
            />
          )}
          <Button
            variant="secondary"
            onClick={() => navigate('/deleted-items')}
            className="flex items-center space-x-2"
          >
            <Archive className="w-4 h-4" />
            <span className="hidden sm:inline">Deleted Items</span>
          </Button>
          {!canEditOrders && (
            <div className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm font-medium">
              View Only
            </div>
          )}
        </div>
      </div>

      <Card className="p-3 md:p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <FormInput
            name="search"
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={handleSearch}
          />
          <Dropdown
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'pending', label: 'Pending' },
              { value: 'completed', label: 'Completed' },
              { value: 'refunded', label: 'Refunded' },
              { value: 'cancelled', label: 'Cancelled' }
            ]}
            placeholder="Filter by status"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
            <Dropdown
              value={dateFilter}
              onChange={setDateFilter}
              options={[
                { value: '', label: 'All Dates' },
                { value: 'today', label: 'Today' }
              ]}
              placeholder="Filter by date"
            />
            {dateFilter !== 'today' && (
              <DateInput 
                value={dateFilter || ''} 
                onChange={(value) => setDateFilter(value || '')} 
                className="mt-2"
              />
            )}
          </div>
          <Dropdown
            value={paymentMethodFilter}
            onChange={setPaymentMethodFilter}
            options={[
              { value: 'all', label: 'All Payment Methods' },
              { value: 'cash', label: 'Cash' },
              { value: 'mpesa', label: 'Mpesa' },
              { value: 'debt', label: 'Debt' }
            ]}
            placeholder="Filter by payment"
          />
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
            options={[
              { value: 'all', label: 'All Categories' }, 
              ...categories.map(c => ({ value: c, label: c })),
              { value: 'multiple', label: 'Multiple' }
            ]}
            placeholder="Filter by category"
          />
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
            ))}
          </div>
        ) : (
          <Table
            columns={[
              { header: 'Order ID', accessor: 'id' },
              { 
                header: 'Customer Name', 
                accessor: 'customerId',
                render: (row: OrderRecord) => getCustomerName(row)
              },
              { header: 'Date', accessor: 'date', render: (row: OrderRecord) => {
                  const d = row.createdAt?.toDate ? row.createdAt.toDate() : (row.date ? new Date(row.date) : null);
                  return d ? d.toLocaleDateString() : (row.date || '-');
                }
              },
              { header: 'Total', accessor: 'total', render: (row: OrderRecord) => `KSH ${row.total.toLocaleString()}` },
              { header: 'Category', accessor: 'category', render: (row: OrderRecord) => {
                  const { category } = determineOrderCategory(row);
                  return (
                    <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {category}
                    </span>
                  );
                }
              },
              {
                header: 'Shop',
                accessor: 'shopName',
                render: (row: OrderRecord) => {
                  const raw = (row.shopName as string) || '';
                  const key = raw.toString().toLowerCase().replace(/\s+/g, '');
                  if (key.includes('kamwene')) return 'Kamwene Shop';
                  if (key.includes('central')) return 'Central Shop';
                  // Fallback for very old orders without shopName
                  return 'Central Shop';
                }
              },
              {
                header: 'Processed By',
                accessor: 'processedByShopName',
                render: (row: OrderRecord) => {
                  const raw = (row.processedByShopName as string) || (row.shopName as string) || '';
                  const key = raw.toString().toLowerCase().replace(/\s+/g, '');
                  if (key.includes('kamwene')) return 'Kamwene Shop';
                  if (key.includes('central')) return 'Central Shop';
                  return 'Central Shop';
                }
              },
              { 
                header: 'Sold By', 
                accessor: 'employeeName',
                render: (row: OrderRecord) => row.employeeName || 'N/A'
              },
              { 
                header: 'Debt Issued By', 
                accessor: 'debtIssuedBy',
                render: (row: OrderRecord) => {
                  if (row.paymentMethod === 'debt' || row.paymentMethod === 'partial') {
                    return row.debtIssuedBy || row.employeeName || 'N/A';
                  }
                  return '-';
                }
              },
              { 
                header: 'Status', 
                accessor: 'status',
                render: (row: OrderRecord) => (
                  <span className={`px-2 py-1 rounded-full text-xs ${statusColors[row.status]} badge-text-dark`}>
                    {row.status}
                  </span>
                )
              },
              {
                header: 'Actions',
                accessor: 'actions',
                render: (row: OrderRecord) => (
                  <div className="flex space-x-2 items-center">
                    <button
                      onClick={() => viewOrderDetails(row)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      View
                    </button>
                    <button
                      onClick={() => downloadReceipt(row)}
                      className="flex items-center space-x-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                      title="Download Receipt"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-sm">Receipt</span>
                    </button>
                    {canEditOrders && (
                      <button
                        onClick={() => handleDeleteOrder(row)}
                        className="flex items-center space-x-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        title="Delete Order"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-sm">Delete</span>
                      </button>
                    )}
                    {canEditOrders ? (
                      row.status === 'completed' && !isMainAdmin ? (
                        <div className="text-xs text-gray-500 dark:text-gray-400 italic" title="Only the Main Admin Can make the Changes">
                          Only Main Admin
                        </div>
                      ) : (
                      <Dropdown
                        value={row.status}
                        onChange={(value) => handleStatusUpdate(row.id!, value as OrderRecord['status'])}
                        options={[
                          { value: 'pending', label: 'Pending' },
                          { value: 'completed', label: 'Completed' },
                          { value: 'refunded', label: 'Refunded' },
                          { value: 'cancelled', label: 'Cancelled' }
                        ]}
                        className="text-sm"
                          disabled={row.status === 'completed' && !isMainAdmin}
                      />
                      )
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[row.status]}`}>
                        {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                      </span>
                    )}
                  </div>
                ),
              },
            ]}
            data={filteredOrders}
          />
        )}
      </Card>

      <Modal
        open={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Order Details - ${selectedOrder?.id}`}
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-4 p-2 md:p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300">Customer</h3>
                <p className="text-gray-900 dark:text-white">{getCustomerName(selectedOrder)}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300">Order Date</h3>
                <p className="text-gray-900 dark:text-white">{selectedOrder.date}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300">Status</h3>
                <p className={`inline-block px-2 py-1 rounded-full text-xs ${statusColors[selectedOrder.status]}`}>
                  {selectedOrder.status}
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300">Payment Method</h3>
                <p className="text-gray-900 dark:text-white">{selectedOrder.paymentMethod || 'Credit Card'}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300">Sold By</h3>
                <p className="text-gray-900 dark:text-white">{selectedOrder.employeeName || 'N/A'}</p>
              </div>
              {(selectedOrder.paymentMethod === 'debt' || selectedOrder.paymentMethod === 'partial') && (
                <div>
                  <h3 className="font-semibold text-gray-700 dark:text-gray-300">Debt Issued By</h3>
                  <p className="text-gray-900 dark:text-white">{selectedOrder.debtIssuedBy || selectedOrder.employeeName || 'N/A'}</p>
                </div>
              )}
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Products</h3>
              <div className="border rounded-lg overflow-hidden dark:border-gray-600 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-2 md:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">Product</th>
                      <th className="px-2 md:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300 hidden md:table-cell">Category</th>
                      <th className="px-2 md:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">Qty</th>
                      <th className="px-2 md:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">Price</th>
                      <th className="px-2 md:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">Total</th>
                      {canDeleteProducts && (
                        <th className="px-2 md:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                    {(() => {
                      const getOrderItems = (): Array<{name: string, quantity: number, price: number, category?: string}> => {
                        if (selectedOrder.products && selectedOrder.products.length > 0) {
                          return selectedOrder.products.map(item => ({
                            name: item.name,
                            quantity: item.quantity,
                            price: item.price
                          }));
                        } else if (selectedOrder.items && selectedOrder.items.length > 0) {
                          return selectedOrder.items.map(item => {
                            const product = products.find(p => p.id === item.productId);
                            return {
                              name: product?.name || item.name || `Product ${item.productId}`,
                            quantity: item.quantity,
                              price: item.price,
                              category: product?.category
                            };
                          });
                        }
                        return [];
                      };
                      
                      const orderItems = getOrderItems();
                      
                      return orderItems.length > 0 ? orderItems.map((product, index) => (
                        <tr key={index}>
                          <td className="px-2 md:px-4 py-2 text-gray-900 dark:text-white font-medium text-sm md:text-base">{product.name}</td>
                          <td className="px-2 md:px-4 py-2 hidden md:table-cell">
                            {product.category ? (
                              <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {product.category}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-2 md:px-4 py-2 text-gray-900 dark:text-white text-sm md:text-base">{product.quantity}</td>
                          <td className="px-2 md:px-4 py-2 text-gray-900 dark:text-white text-sm md:text-base">KSH {product.price.toLocaleString()}</td>
                          <td className="px-2 md:px-4 py-2 text-gray-900 dark:text-white font-semibold text-sm md:text-base">KSH {(product.quantity * product.price).toLocaleString()}</td>
                          {canDeleteProducts && (
                            <td className="px-2 md:px-4 py-2">
                              <button
                                onClick={() => {
                                  setProductToDelete({ index, name: product.name });
                                  setProductDeletePassword('');
                                  setIsProductDeleteModalOpen(true);
                                }}
                                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm"
                                title="Remove product (refund)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={canDeleteProducts ? 6 : 5} className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">No items found</td>
                        </tr>
                      );
                    })()}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <td colSpan={canDeleteProducts ? 5 : 4} className="px-2 md:px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300 text-sm md:text-base">Total:</td>
                      <td className="px-2 md:px-4 py-2 font-semibold text-gray-900 dark:text-white text-sm md:text-base">KSH {selectedOrder.total.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
              <Button onClick={() => setIsDetailModalOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 text-red-500">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Delete Order
                </h3>
              </div>
              
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {showSecondConfirmation 
                  ? `Final confirmation: Are you absolutely sure you want to delete order ${orderToDelete?.id}? This action cannot be undone.`
                  : `Are you sure you want to delete order ${orderToDelete?.id}? This action cannot be undone.`
                }
              </p>

              <div className="mb-6 space-y-4">
                <FormInput
                  label="Login Password"
                  name="adminPassword"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter your login password to confirm deletion"
                  required
                />
                
                {showSecondConfirmation && (
                  <FormInput
                    label="Confirm Password"
                    name="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter admin password to confirm"
                    required
                  />
                )}
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setOrderToDelete(null);
                    setAdminPassword('');
                    setConfirmPassword('');
                    setShowSecondConfirmation(false);
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteOrder}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isDeleting ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Deleting...</span>
                    </div>
                  ) : (
                    showSecondConfirmation ? 'Confirm Deletion' : 'Verify Password'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      {isProductDeleteModalOpen && productToDelete && (
        <Modal
          open={isProductDeleteModalOpen}
          onClose={() => {
            setIsProductDeleteModalOpen(false);
            setProductToDelete(null);
            setProductDeletePassword('');
          }}
          title="Remove Product from Order"
          size="md"
        >
          <div className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                You are about to remove <strong>{productToDelete.name}</strong> from order <strong>{selectedOrder?.id}</strong>.
                This action will recalculate the order total and record your identity for audit purposes.
              </p>
            </div>

            <FormInput
              label="Login Password"
              name="productDeletePassword"
              type="password"
              value={productDeletePassword}
              onChange={(e) => setProductDeletePassword(e.target.value)}
              placeholder="Enter your login password to confirm"
              required
            />

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsProductDeleteModalOpen(false);
                  setProductToDelete(null);
                  setProductDeletePassword('');
                }}
                disabled={isDeletingProduct}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteProduct}
                disabled={isDeletingProduct || !productDeletePassword.trim()}
              >
                {isDeletingProduct ? 'Removing...' : 'Remove Product'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Orders;