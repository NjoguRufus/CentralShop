// src/pages/Orders.tsx
import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, query, orderBy, deleteDoc, getDoc, where } from 'firebase/firestore';
import Select from '../components/UI/Select';
import Dropdown from '../components/UI/Dropdown';
import DateInput from '../components/UI/DateInput';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getShopCollectionName } from '../config/shopConfig';
import { useNotifications } from '../contexts/NotificationContext';
import Card from '../components/UI/Card';
import FormInput from '../components/UI/FormInput';
import Table from '../components/UI/Table';
import Modal from '../components/Modal';
import Button from '../components/UI/Button';
import { Download, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id?: string;
  customerId: string;
  date: string;
  total: number;
  status: 'pending' | 'completed' | 'refunded' | 'cancelled';
  products?: Product[];
  items?: Array<{
    productId: string;
    quantity: number;
    price: number;
    name?: string;
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
  debtIssuedBy?: string;
  debtIssuedById?: string;
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
  
  // State hooks
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showSecondConfirmation, setShowSecondConfirmation] = useState<boolean>(false);
  
  // Check if user can edit orders (not Cashier)
  const canEditOrders = currentUser?.role !== 'Cashier';
  // Check if user is Main Admin
  const isMainAdmin = currentUser?.role === 'mainAdmin' || currentUser?.role === 'Admin';

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchOrders = async (): Promise<void> => {
    try {
      setLoading(true);
      
      if (!currentUser?.shopId) {
        console.error('No shop ID found for current user');
        toast.error('No shop assigned to your account');
        return;
      }

      const ordersCollectionName = getShopCollectionName('orders');
      
      // If user is a cashier, only fetch their own orders
      let querySnapshot;
      if (currentUser?.role === 'Cashier' && currentUser?.uid) {
        // For cashiers, filter by employeeId and then sort in memory
        const q = query(
          collection(db, ordersCollectionName),
          where('employeeId', '==', currentUser.uid)
        );
        querySnapshot = await getDocs(q);
      } else {
        // For admins, fetch all orders with orderBy
      const q = query(collection(db, ordersCollectionName), orderBy('createdAt', 'desc'));
        querySnapshot = await getDocs(q);
      }
      
      const ordersData: Order[] = [];
      
      querySnapshot.forEach((orderDoc) => {
        const orderData = { id: orderDoc.id, ...orderDoc.data() } as Order;
        
        // Auto-determine category if not set
        if (!orderData.category) {
          const autoCategory = determineOrderCategory(orderData);
          orderData.category = autoCategory;
          
          // Update order in database with auto-determined category
          updateDoc(doc(db, ordersCollectionName, orderDoc.id), { category: autoCategory }).catch(err => {
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

      const querySnapshot = await getDocs(collection(db, getShopCollectionName('customers')));
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
      if (!currentUser?.shopId) return;
      const productsQuery = query(collection(db, getShopCollectionName('products')));
      const productsSnapshot = await getDocs(productsQuery);
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching products:', error);
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
  const determineOrderCategory = (order: Order): string => {
    if (!order.items || order.items.length === 0) {
      return 'multiple';
    }

    const productCategories: string[] = [];
    
    order.items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product && product.category) {
        productCategories.push(product.category);
    }
    });

    if (productCategories.length === 0) {
      return 'multiple';
    }

    // Check if all products have the same category
    const uniqueCategories = [...new Set(productCategories)];
    if (uniqueCategories.length === 1) {
      return uniqueCategories[0];
    }

    return 'multiple';
  };

  const getCustomerName = (order: Order): string => {
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

  const handleStatusUpdate = async (orderId: string, newStatus: Order['status']): Promise<void> => {
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
    
    const matchesDate = !dateFilter || order.date === dateFilter;
    const orderCategory = order.category || determineOrderCategory(order);
    const matchesCategory = categoryFilter === 'all' || orderCategory.toLowerCase() === categoryFilter.toLowerCase();
    
    return matchesSearch && matchesStatus && matchesDate && matchesCategory;
  });

  const viewOrderDetails = (order: Order): void => {
    setSelectedOrder(order);
    setIsDetailModalOpen(true);
  };

  const handleDeleteOrder = (order: Order): void => {
    setOrderToDelete(order);
    setAdminPassword('');
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteOrder = async (): Promise<void> => {
    if (!orderToDelete || !adminPassword.trim()) {
      toast.error('Please enter the admin password');
      return;
    }

    // First confirmation - check password
    if (!showSecondConfirmation) {
      try {
        if (!currentUser?.shopId) {
          toast.error('No shop assigned to your account');
          return;
        }

        // Get admin password from settings
        const settingsDoc = await getDoc(doc(db, 'shops', currentUser.shopId, 'settings', 'general'));
        if (!settingsDoc.exists()) {
          toast.error('Settings not found');
          return;
        }

        const settings = settingsDoc.data();
        const storedPassword = settings.adminPassword;

        if (!storedPassword) {
          toast.error('Admin password not set. Please set it in Settings first.');
          return;
        }

        if (adminPassword !== storedPassword) {
          toast.error('Incorrect admin password');
          return;
        }

        // Password is correct, show second confirmation
        setShowSecondConfirmation(true);
        return;
      } catch (error) {
        console.error('Error verifying password:', error);
        toast.error('Error verifying password');
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

  const downloadReceipt = async (order: Order): Promise<void> => {
    const formatCurrency = (amount: number) => `KSH ${amount.toLocaleString()}`;
    
    // Get order date
    const orderDate = order.createdAt?.toDate 
      ? order.createdAt.toDate() 
      : (order.date ? new Date(order.date) : new Date());
    
    const formatDate = (date: Date) => date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // Get products from either products array or items array
    const getOrderItems = (): Array<{name: string, quantity: number, price: number}> => {
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
    
    // Calculate subtotal and tax
    const subtotal = order.subtotal || (order.total / 1.1);
    const tax = order.tax || (order.total - subtotal);

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${order.id}</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            margin: 0;
            padding: 10px;
            width: 300px;
          }
          .header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }
          .shop-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .order-info {
            font-size: 10px;
            margin-bottom: 10px;
          }
          .items {
            margin-bottom: 10px;
          }
          .item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
          }
          .item-name {
            flex: 1;
          }
          .item-qty {
            margin: 0 10px;
          }
          .item-price {
            text-align: right;
            min-width: 60px;
          }
          .totals {
            border-top: 1px dashed #000;
            padding-top: 10px;
            margin-top: 10px;
          }
          .total-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
          }
          .total-final {
            font-weight: bold;
            font-size: 14px;
            border-top: 1px solid #000;
            padding-top: 5px;
            margin-top: 5px;
          }
          .payment-info {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px dashed #000;
          }
          .customer-info {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px dashed #000;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 10px;
          }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="margin-bottom: 10px; text-align: center;">
            <img src="/icons/CentalLightmode.png" alt="CENTRAL SHOP Logo" style="max-width: 60px; max-height: 60px; object-fit: contain; margin: 0 auto;" />
          </div>
          <div class="shop-name">CENTRAL SHOP</div>
          <div class="order-info">
            Order: ${order.id || 'N/A'}<br>
            Date: ${formatDate(orderDate)}<br>
            Status: ${order.status.toUpperCase()}
          </div>
        </div>

        <div class="items">
          ${orderItems.length > 0 ? orderItems.map(item => `
            <div class="item">
              <div class="item-name">${item.name}</div>
              <div class="item-qty">${item.quantity}x</div>
              <div class="item-price">${formatCurrency(item.price * item.quantity)}</div>
            </div>
          `).join('') : '<div class="item">No items found</div>'}
        </div>

        <div class="totals">
          <div class="total-line">
            <span>Subtotal:</span>
            <span>${formatCurrency(subtotal)}</span>
          </div>
          <div class="total-line">
            <span>Tax (${order.tax ? ((order.tax / subtotal) * 100).toFixed(0) : '10'}%):</span>
            <span>${formatCurrency(tax)}</span>
          </div>
          <div class="total-line total-final">
            <span>TOTAL:</span>
            <span>${formatCurrency(order.total)}</span>
          </div>
        </div>

        <div class="payment-info">
          <div><strong>Payment Method:</strong> ${order.paymentMethod?.toUpperCase() || 'N/A'}</div>
          ${order.amountReceived ? `<div><strong>Amount Received:</strong> ${formatCurrency(order.amountReceived)}</div>` : ''}
          ${order.change ? `<div><strong>Change:</strong> ${formatCurrency(order.change)}</div>` : ''}
          ${order.mpesaCode ? `<div><strong>M-Pesa Code:</strong> ${order.mpesaCode}</div>` : ''}
        </div>

        <div class="customer-info">
          <div><strong>Customer Details:</strong></div>
          <div>Name: ${order.customerName || 'Walk In Customer'}</div>
          ${order.customerPhone ? `<div>Phone: ${order.customerPhone}</div>` : ''}
        </div>

        <div class="footer">
          Thank you for your business!<br>
          Please keep this receipt for your records.
        </div>
      </body>
      </html>
    `;

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
        margin: [5, 5, 5, 5],
        filename: `Receipt-${order.id || 'Order'}-${new Date().getTime()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          logging: false,
          windowWidth: element.scrollWidth,
          windowHeight: element.scrollHeight
        },
        jsPDF: { unit: 'mm', format: [80, 200], orientation: 'portrait' } // Receipt format
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
        {!canEditOrders && (
          <div className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm font-medium">
            View Only
          </div>
        )}
      </div>

      <Card className="p-3 md:p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
            <DateInput value={dateFilter} onChange={setDateFilter} />
          </div>
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
                render: (row: Order) => getCustomerName(row)
              },
              { header: 'Date', accessor: 'date', render: (row: Order) => {
                  const d = row.createdAt?.toDate ? row.createdAt.toDate() : (row.date ? new Date(row.date) : null);
                  return d ? d.toLocaleDateString() : (row.date || '-');
                }
              },
              { header: 'Total', accessor: 'total', render: (row: Order) => `KSH ${row.total.toLocaleString()}` },
              { header: 'Category', accessor: 'category', render: (row: Order) => {
                  const category = row.category || determineOrderCategory(row);
                  return <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">{category}</span>;
                }
              },
              { 
                header: 'Sold By', 
                accessor: 'employeeName',
                render: (row: Order) => row.employeeName || 'N/A'
              },
              { 
                header: 'Debt Issued By', 
                accessor: 'debtIssuedBy',
                render: (row: Order) => {
                  if (row.paymentMethod === 'debt' || row.paymentMethod === 'partial') {
                    return row.debtIssuedBy || row.employeeName || 'N/A';
                  }
                  return '-';
                }
              },
              { 
                header: 'Status', 
                accessor: 'status',
                render: (row: Order) => (
                  <span className={`px-2 py-1 rounded-full text-xs ${statusColors[row.status]} badge-text-dark`}>
                    {row.status}
                  </span>
                )
              },
              {
                header: 'Actions',
                accessor: 'actions',
                render: (row: Order) => (
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
                        onChange={(value) => handleStatusUpdate(row.id!, value as Order['status'])}
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
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">No items found</td>
                        </tr>
                      );
                    })()}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <td colSpan={4} className="px-2 md:px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300 text-sm md:text-base">Total:</td>
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
                  label="Admin Password"
                  name="adminPassword"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter admin password to confirm deletion"
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
    </div>
  );
};

export default Orders;