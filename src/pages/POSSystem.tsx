import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Minus, Trash2, CreditCard, DollarSign, Search, ShoppingCart } from 'lucide-react';
import { collection, getDocs, query, orderBy, addDoc, updateDoc, doc, Timestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getShopCollectionName } from '../config/shopConfig';
import { usePaymentSettings } from '../hooks/usePaymentSettings';
import { useNotifications } from '../contexts/NotificationContext';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Dropdown from '../components/UI/Dropdown';
import CheckoutModal from '../components/CheckoutModal';
import ConfirmationModal from '../components/UI/ConfirmationModal';
import { ReceiptService } from '../services/ReceiptService';
import { BusinessSettingsService } from '../services/BusinessSettingsService';
import { Product, OrderItem } from '../types';
import { toast } from 'react-toastify';

interface ProductCategory {
  id: string;
  name: string;
}

const POSSystem: React.FC = () => {
  const { currentUser } = useAuth();
  const { paymentSettings, loading: settingsLoading } = usePaymentSettings();
  const { addNotification } = useNotifications();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isClearCartModalOpen, setIsClearCartModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  // Listen for barcode scanned events
  useEffect(() => {
    const handleBarcodeScanned = (event: CustomEvent) => {
      const barcode = event.detail.barcode;
      if (barcode && products.length > 0) {
        // Find product by barcode
        const product = products.find(p => p.barcode === barcode);
        if (product) {
          // Check if product is out of stock
          if (product.stock <= 0) {
            toast.error(`${product.name} is out of stock`);
            return;
          }
          
          setCart(prevCart => {
            const existingItem = prevCart.find(item => item.productId === product.id);
            if (existingItem) {
              if (existingItem.quantity >= product.stock) {
                toast.error(`Cannot add more ${product.name}. Only ${product.stock} items available`);
                return prevCart;
              }
              return prevCart.map(item => 
                item.productId === product.id 
                  ? { ...item, quantity: item.quantity + 1 }
                  : item
              );
            } else {
              return [...prevCart, {
                productId: product.id,
                product,
                quantity: 1,
                price: product.price
              }];
            }
          });
          toast.success(`Added ${product.name} to cart`);
        } else {
          toast.error(`Product with barcode ${barcode} not found`);
        }
      }
    };

    window.addEventListener('barcode-scanned', handleBarcodeScanned as EventListener);

    return () => {
      window.removeEventListener('barcode-scanned', handleBarcodeScanned as EventListener);
    };
  }, [products]);

  const fetchCategories = async (): Promise<void> => {
    try {
      if (!currentUser?.shopId) return;

      const q = query(collection(db, getShopCollectionName('productCategories')), orderBy('name'));
      const querySnapshot = await getDocs(q);
      const categoriesData: ProductCategory[] = [];
      querySnapshot.forEach((doc) => {
        categoriesData.push({
          id: doc.id,
          name: doc.data().name
        });
      });
      setCategories(categoriesData);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      // Don't show error toast for permission errors - rules need to be deployed
      if (error.code !== 'permission-denied') {
        toast.error('Failed to load categories');
      }
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const fetchProducts = async (): Promise<void> => {
    try {
      setLoading(true);
      
      if (!currentUser?.shopId) {
        console.error('No shop ID found for current user');
        toast.error('No shop assigned to your account');
        return;
      }

      const q = query(collection(db, getShopCollectionName('products')), orderBy('name'));
      const querySnapshot = await getDocs(q);
      const productsData: Product[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        productsData.push({ 
          id: doc.id, 
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as Product);
      });
      setProducts(productsData);
    } catch (error) {
      toast.error('Failed to fetch products');
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    // Check if product is out of stock
    if (product.stock <= 0) {
      toast.error(`${product.name} is out of stock and cannot be added to cart`);
      return;
    }

    const existingItem = cart.find(item => item.productId === product.id);
    
    if (existingItem) {
      // Check if adding one more would exceed stock
      if (existingItem.quantity >= product.stock) {
        toast.error(`Cannot add more ${product.name}. Only ${product.stock} items available in stock`);
        return;
      }
      
      setCart(cart.map(item => 
        item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        product,
        quantity: 1,
        price: product.price
      }]);
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    // Find the product to check stock
    const product = products.find(p => p.id === productId);
    if (product && quantity > product.stock) {
      toast.error(`Cannot add more ${product.name}. Only ${product.stock} items available in stock`);
      return;
    }
    
    setCart(cart.map(item => 
      item.productId === productId 
        ? { ...item, quantity }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const getTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTax = () => {
    return getTotal() * 0.1; // 10% tax
  };

  const getFinalTotal = () => {
    return getTotal() + getTax();
  };

  const downloadReceipt = (orderData: any) => {
    const formatCurrency = (amount: number) => `KSH ${amount.toLocaleString()}`;
    const formatDate = (date: Date) => date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${orderData.orderId}</title>
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
            <img src="/icons/central.png" alt="CENTRAL SHOP Logo" style="max-width: 60px; max-height: 60px; object-fit: contain; margin: 0 auto;" />
          </div>
          <div class="shop-name">CENTRAL SHOP</div>
          <div class="order-info">
            Order: ${orderData.orderId}<br>
            Date: ${formatDate(orderData.timestamp)}<br>
            Status: COMPLETED
          </div>
        </div>

        <div class="items">
          ${orderData.items.map((item: any) => `
            <div class="item">
              <div class="item-name">${item.name}</div>
              <div class="item-qty">${item.quantity}x</div>
              <div class="item-price">${formatCurrency(item.price * item.quantity)}</div>
            </div>
          `).join('')}
        </div>

        <div class="totals">
          <div class="total-line">
            <span>Subtotal:</span>
            <span>${formatCurrency(orderData.subtotal)}</span>
          </div>
          <div class="total-line">
            <span>Tax (10%):</span>
            <span>${formatCurrency(orderData.tax)}</span>
          </div>
          <div class="total-line total-final">
            <span>TOTAL:</span>
            <span>${formatCurrency(orderData.total)}</span>
          </div>
        </div>

        <div class="payment-info">
          <div><strong>Payment Method:</strong> ${orderData.paymentMethod?.toUpperCase() || 'N/A'}</div>
          ${orderData.amountReceived ? `<div><strong>Amount Received:</strong> ${formatCurrency(orderData.amountReceived)}</div>` : ''}
          ${orderData.change ? `<div><strong>Change:</strong> ${formatCurrency(orderData.change)}</div>` : ''}
          ${orderData.mpesaCode ? `<div><strong>M-Pesa Code:</strong> ${orderData.mpesaCode}</div>` : ''}
        </div>

        ${orderData.customerName || orderData.customerPhone ? `
          <div class="customer-info">
            <div><strong>Customer Details:</strong></div>
            ${orderData.customerName ? `<div>Name: ${orderData.customerName}</div>` : ''}
            ${orderData.customerPhone ? `<div>Phone: ${orderData.customerPhone}</div>` : ''}
          </div>
        ` : ''}

        <div class="footer">
          Thank you for your business!<br>
          Please keep this receipt for your records.
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  const handleCheckout = async (paymentData: any) => {
    try {
      setIsProcessing(true);
      
      if (!currentUser?.shopId) {
        toast.error('No shop assigned to your account');
        return;
      }

      if (cart.length === 0) {
        toast.error('Cart is empty');
        return;
      }

      // Calculate totals
      const subtotal = getTotal();
      const tax = getTax();
      const total = getFinalTotal();

      // Determine order status based on payment method
      let orderStatus = 'completed';
      if (paymentData.paymentMethod === 'debt') {
        if (paymentData.partialAmount) {
          orderStatus = 'partial';
        } else {
          orderStatus = 'pending';
        }
      }

      // Create order - filter out undefined values
      const orderData = {
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        })),
        subtotal,
        tax,
        total,
        status: orderStatus,
        paymentMethod: paymentData.paymentMethod,
        createdAt: new Date(),
        employeeId: currentUser.uid,
        employeeName: currentUser.name || 'Cashier',
        ...(paymentData.customerId && { customerId: paymentData.customerId }),
        ...(paymentData.amountReceived && { amountReceived: paymentData.amountReceived }),
        ...(paymentData.change && { change: paymentData.change }),
        ...(paymentData.customerName && { customerName: paymentData.customerName }),
        ...(paymentData.customerEmail && { customerEmail: paymentData.customerEmail }),
        ...(paymentData.customerPhone && { customerPhone: paymentData.customerPhone }),
        ...(paymentData.mpesaCode && { mpesaCode: paymentData.mpesaCode }),
        ...(paymentData.debtAmount && { debtAmount: paymentData.debtAmount }),
        ...(paymentData.partialAmount && { partialAmount: paymentData.partialAmount }),
        ...(paymentData.remainingAmount && { remainingAmount: paymentData.remainingAmount }),
        ...(paymentData.dueDate && { dueDate: paymentData.dueDate }),
        // Track who issued debt/partial payment
        ...((paymentData.paymentMethod === 'debt' || paymentData.paymentMethod === 'partial') && {
          debtIssuedBy: currentUser.name || 'Cashier',
          debtIssuedById: currentUser.uid
        })
      };

      // Save order to Firebase - use shop-specific collection
      const { getShopOrdersCollectionNameCached } = await import('../utils/orderCollectionHelper');
      const ordersCollectionName = await getShopOrdersCollectionNameCached(currentUser.shopId!);
      await addDoc(collection(db, ordersCollectionName), orderData);

      // If debt or partial payment, create invoice and save customer
      let customerId: string | null = null;
      if (paymentData.paymentMethod === 'debt' && paymentData.customerName && paymentData.customerPhone) {
        try {
          // Check if customer already exists by phone or use provided customerId
          if (paymentData.customerId) {
            customerId = paymentData.customerId;
          } else {
            const { getShopCollectionName } = await import('../config/shopConfig');
            const customersRef = collection(db, getShopCollectionName('customers'));
            const customerQuery = query(customersRef, where('phone', '==', paymentData.customerPhone));
            const customerSnapshot = await getDocs(customerQuery);
            
            if (customerSnapshot.empty) {
              // Create new customer
              const newCustomer = {
                name: paymentData.customerName,
                phone: paymentData.customerPhone,
                email: paymentData.customerEmail || '',
                createdAt: Timestamp.now(),
                totalPurchases: 0,
                totalSpent: 0
              };
              const customerDocRef = await addDoc(customersRef, newCustomer);
              customerId = customerDocRef.id;
            } else {
              // Use existing customer
              customerId = customerSnapshot.docs[0].id;
            }
          }

          // Create invoice
          const invoiceNumber = `INV-${Date.now()}`;
          const invoiceItems = cart.map(item => ({
            description: item.product.name,
            quantity: item.quantity,
            unitPrice: item.price,
            total: item.price * item.quantity,
            type: 'product'
          }));

          // Determine invoice total based on payment method
          const invoiceTotal = paymentData.partialAmount 
            ? (paymentData.remainingAmount || (total - (paymentData.partialAmount || 0)))
            : total;

          const invoiceData = {
            invoiceNumber,
            customerId: customerId,
            items: invoiceItems,
            subtotal: paymentData.partialAmount 
              ? (invoiceTotal / 1.16) 
              : subtotal,
            tax: paymentData.partialAmount 
              ? (invoiceTotal - (invoiceTotal / 1.16)) 
              : tax,
            total: invoiceTotal,
            status: 'sent' as const,
            dueDate: Timestamp.fromDate(new Date(paymentData.dueDate)),
            shopId: currentUser.shopId,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            issuedBy: currentUser.name || 'Cashier',
            issuedById: currentUser.uid,
            notes: paymentData.partialAmount 
              ? `Auto-generated from POS checkout - Partial payment. Amount paid: KSH ${paymentData.partialAmount}, Remaining: KSH ${invoiceTotal}`
              : `Auto-generated from POS checkout - Order debt`
          };

          await addDoc(collection(db, getShopCollectionName('invoices')), invoiceData);
          
          const paymentType = paymentData.partialAmount ? 'Partial payment' : 'Debt';
          toast.success(`${paymentType} invoice ${invoiceNumber} created and customer saved!`);
        } catch (error) {
          console.error('Error creating invoice/customer:', error);
          toast.error('Order created but failed to create invoice. Please create manually.');
        }
      }

      // Update product stock
      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const newStock = product.stock - item.quantity;
          await updateDoc(doc(db, getShopCollectionName('products'), item.productId), {
            stock: newStock,
            updatedAt: new Date()
          });
        }
      }

      // Prepare receipt data
      const receiptData = {
        orderId: `ORD-${Date.now()}`,
        items: cart.map(item => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity
        })),
        subtotal,
        tax,
        total,
        paymentMethod: paymentData.paymentMethod,
        amountReceived: paymentData.amountReceived,
        change: paymentData.change,
        customerName: paymentData.customerName,
        customerPhone: paymentData.customerPhone,
        mpesaCode: paymentData.mpesaCode,
        debtAmount: paymentData.debtAmount,
        partialAmount: paymentData.partialAmount,
        remainingAmount: paymentData.remainingAmount,
        dueDate: paymentData.dueDate,
        employeeName: currentUser.name || 'Cashier',
        timestamp: new Date()
      };

      // Handle receipt flow based on settings
      const businessInfo = await BusinessSettingsService.getBusinessInfo(currentUser.shopId!);

      const receiptResult = await ReceiptService.handleReceiptFlow(
        receiptData,
        paymentSettings,
        businessInfo
      );

      if (receiptResult.success) {
        toast.success(receiptResult.message);
      } else {
        toast.error(receiptResult.message);
      }
      
      // Add notification for new order
      await addNotification({
        title: 'New Order Completed',
        message: `Order ${receiptData.orderId} has been completed for KSH ${total.toLocaleString()}`,
        type: 'success'
      });

      // Show appropriate success message based on payment method
      if (paymentData.paymentMethod === 'debt') {
        toast.success('Debt order created successfully! Customer will be charged on the due date.');
      } else if (paymentData.paymentMethod === 'partial') {
        toast.success('Partial payment order created! Customer owes remaining amount on due date.');
      } else {
        toast.success('Order processed successfully!');
      }
      setCart([]);
      setIsCheckoutOpen(false);
      fetchProducts(); // Refresh products to get updated stock
    } catch (error) {
      toast.error('Failed to process order');
      console.error('Error processing order:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearCart = () => {
    setCart([]);
    setIsClearCartModalOpen(false);
    toast.success('Cart cleared');
  };

  const testDownloadReceipt = () => {
    const testData = {
      orderId: 'TEST-123',
      items: [
        { name: 'Test Product', quantity: 1, price: 10.00 }
      ],
      subtotal: 10.00,
      tax: 1.00,
      total: 11.00,
      paymentMethod: 'cash',
      timestamp: new Date()
    };
    downloadReceipt(testData);
  };

  const openCheckout = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    setIsCheckoutOpen(true);
  };


  return (
    <div className="space-y-3 md:space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Point of Sale</h1>
        <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300">Process customer orders and payments</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Products Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Category Dropdown and Search Bar */}
          <Card className="p-3 md:p-4 relative z-50">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Category Dropdown */}
              <div className="w-full sm:w-48 flex-shrink-0 relative z-50">
                <Dropdown
                  value={selectedCategory}
                  onChange={(value) => setSelectedCategory(value)}
                  options={[
                    { value: 'All', label: 'All Categories' },
                    ...categories.map(cat => ({ value: cat.name, label: cat.name }))
                  ]}
                  placeholder="All Categories"
                  className="w-full"
                />
              </div>

              {/* Search Bar */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#4A90A4] focus:border-transparent"
                />
              </div>
            </div>
          </Card>

          {/* Products Grid */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 md:gap-3">
              {[...Array(10)].map((_, i) => (
                <Card key={i} className="p-2 md:p-3">
                  <div className="aspect-square rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse mb-4"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 md:gap-3">
              {filteredProducts.map(product => {
                const isOutOfStock = product.stock <= 0;
                return (
                  <Card 
                    key={product.id} 
                    className={`p-2 md:p-3 transition-all duration-300 ${
                      isOutOfStock 
                        ? 'opacity-60 cursor-not-allowed' 
                        : 'hover:shadow-lg cursor-pointer'
                    }`}
                  >
                    <div onClick={() => !isOutOfStock && addToCart(product)}>
                      <div className="aspect-square rounded-xl overflow-hidden mb-4 relative">
                        <img 
                          src={product.image} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                            <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                              OUT OF STOCK
                            </span>
                          </div>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{product.name}</h3>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-[#4A90A4]">KSH {product.price.toLocaleString()}</span>
                        <span className={`text-sm ${isOutOfStock ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                          {isOutOfStock ? 'Out of Stock' : `Stock: ${product.stock}`}
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart Section */}
        <div className="space-y-3 md:space-y-4">
          <Card className="p-3 md:p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Current Order</h3>
            
            {cart.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Cart is empty</p>
            ) : (
              <>
                <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.productId} className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white">{item.product.name}</h4>
                        <p className="text-sm text-gray-500">KSH {item.price.toLocaleString()} each</p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900 flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-800 text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order Summary */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>KSH {getTotal().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax (10%):</span>
                    <span>KSH {getTax().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t border-gray-200 dark:border-gray-700 pt-2">
                    <span>Total:</span>
                    <span>KSH {getFinalTotal().toLocaleString()}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 mt-6">
                  <Button 
                    onClick={testDownloadReceipt} 
                    variant="outline" 
                    className="w-full flex items-center justify-center"
                  >
                    Test Receipt Download
                  </Button>
                  <Button 
                    onClick={openCheckout} 
                    variant="primary" 
                    className="w-full flex items-center justify-center"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Checkout - KSH {getFinalTotal().toLocaleString()}
                  </Button>
                  <Button 
                    onClick={() => setIsClearCartModalOpen(true)} 
                    variant="outline" 
                    className="w-full flex items-center justify-center text-red-600 hover:text-red-700 hover:border-red-300"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear Cart
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onConfirm={handleCheckout}
        cart={cart.map(item => ({
          id: item.productId,
          name: item.product.name,
          price: item.price,
          quantity: item.quantity
        }))}
        total={getFinalTotal()}
        isLoading={isProcessing}
      />

      {/* Clear Cart Confirmation Modal */}
      <ConfirmationModal
        isOpen={isClearCartModalOpen}
        onClose={() => setIsClearCartModalOpen(false)}
        onConfirm={handleClearCart}
        title="Clear Cart"
        message="Are you sure you want to clear all items from the cart? This action cannot be undone."
        type="warning"
        confirmText="Clear Cart"
        cancelText="Keep Items"
      />

    </div>
  );
};

export default POSSystem;
