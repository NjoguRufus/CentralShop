import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Minus, Trash2, Search, ShoppingCart, Grid3x3, List } from 'lucide-react';
import { collection, getDocs, query, orderBy, addDoc, updateDoc, doc, Timestamp, where, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getShopCollectionName, BRANCHES, BranchName } from '../config/shopConfig';
import { usePaymentSettings } from '../hooks/usePaymentSettings';
import { useNotifications } from '../contexts/NotificationContext';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Dropdown from '../components/UI/Dropdown';
import CheckoutModal from '../components/CheckoutModal';
import CustomerInfoModal from '../components/CustomerInfoModal';
import ConfirmationModal from '../components/UI/ConfirmationModal';
import ProductsGrid from '../components/Products/ProductsGrid';
import { ReceiptService } from '../services/ReceiptService';
import { BusinessSettingsService } from '../services/BusinessSettingsService';
import { Product, OrderItem } from '../types';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';
import { getUnitShortLabel, getDefaultUnit } from '../constants/productUnits';

interface ProductCategory {
  id: string;
  name: string;
}

const DEFAULT_UNIT = getDefaultUnit();

const POSSystem: React.FC = () => {
  const { currentUser } = useAuth();
  const { paymentSettings } = usePaymentSettings();
  const { addNotification } = useNotifications();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isCustomerInfoOpen, setIsCustomerInfoOpen] = useState(false);
  const [pendingPaymentData, setPendingPaymentData] = useState<any>(null);
  const [isClearCartModalOpen, setIsClearCartModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [measurementModal, setMeasurementModal] = useState<{ open: boolean; product: Product | null; cartItemId?: string }>({
    open: false,
    product: null,
    cartItemId: undefined
  });
  const [selectedBranch, setSelectedBranch] = useState<string>('CentralShop');
  const [measurementValue, setMeasurementValue] = useState('');
  const isMeasurementProduct = useCallback((product?: Product | null) => {
    return Boolean(product?.requireMeasurement && (product.unit === 'meters' || product.unit === 'litres'));
  }, []);
  const cartItemCount = cart.reduce((total, item) => total + (isMeasurementProduct(item.product) ? 1 : item.quantity), 0);
  const cartRef = useRef<OrderItem[]>(cart);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const getMeasurementLabel = useCallback((product?: Product | null) => {
    if (!product) return 'amount';
    if (product.measurementLabel) return product.measurementLabel;
    if (product.unit === 'litres') return 'Litres';
    if (product.unit === 'meters') return 'Meters';
    return getUnitShortLabel(product.unit);
  }, []);

  const openMeasurementModal = useCallback(
    (product: Product, options?: { cartItemId?: string; initialQuantity?: number }) => {
      setMeasurementValue(
        options?.initialQuantity !== undefined && options.initialQuantity !== null
          ? options.initialQuantity.toString()
          : ''
      );
      setMeasurementModal({
        open: true,
        product,
        cartItemId: options?.cartItemId || product.id
      });
    },
    []
  );

  const closeMeasurementModal = useCallback(() => {
    setMeasurementModal({ open: false, product: null, cartItemId: undefined });
    setMeasurementValue('');
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [selectedBranch]);

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

          if (isMeasurementProduct(product)) {
            const existingItem = cartRef.current.find(item => item.productId === product.id);
            openMeasurementModal(product, {
              cartItemId: existingItem?.productId,
              initialQuantity: existingItem?.quantity
            });
            toast.info(`Enter ${getMeasurementLabel(product)} for ${product.name}`);
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
                price: product.price,
                unit: product.unit || DEFAULT_UNIT
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
  }, [products, isMeasurementProduct, openMeasurementModal, getMeasurementLabel]);

  const fetchCategories = async (): Promise<void> => {
    try {
      if (!currentUser?.shopId) return;

      const q = query(collection(db, getShopCollectionName('productCategories', selectedBranch as BranchName)), orderBy('name'));
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

      const q = query(collection(db, getShopCollectionName('products', selectedBranch as BranchName)), orderBy('name'));
      const querySnapshot = await getDocs(q);
      const productsData: Product[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        productsData.push({ 
          id: doc.id, 
          ...data,
          unit: data.unit || DEFAULT_UNIT,
          requireMeasurement: data.requireMeasurement || false,
          measurementLabel: data.measurementLabel || '',
          capital: data.capital,
          buyingPrice: data.buyingPrice,
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

  const handleMeasurementConfirm = useCallback(() => {
    if (!measurementModal.product) {
      closeMeasurementModal();
      return;
    }
    const parsedValue = parseFloat(measurementValue);
    if (Number.isNaN(parsedValue) || parsedValue <= 0) {
      toast.error('Enter a valid amount greater than zero');
      return;
    }
    if (parsedValue > measurementModal.product.stock) {
      toast.error(`Cannot dispense more than ${measurementModal.product.stock} ${getMeasurementLabel(measurementModal.product)}`);
      return;
    }

    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(item => item.productId === measurementModal.cartItemId);
      if (existingIndex >= 0) {
        return prevCart.map(item =>
          item.productId === measurementModal.cartItemId
            ? { ...item, quantity: parsedValue }
            : item
        );
      }
      return [
        ...prevCart,
        {
          productId: measurementModal.product!.id,
          product: measurementModal.product!,
          quantity: parsedValue,
          price: measurementModal.product!.price,
          unit: measurementModal.product!.unit || DEFAULT_UNIT
        }
      ];
    });
    toast.success(`${measurementModal.product.name} set to ${parsedValue} ${getMeasurementLabel(measurementModal.product)}`);
    closeMeasurementModal();
  }, [measurementModal, measurementValue, closeMeasurementModal, getMeasurementLabel]);

  const addToCart = (product: Product) => {
    // Check if product is out of stock
    if (product.stock <= 0) {
      toast.error(`${product.name} is out of stock and cannot be added to cart`);
      return;
    }

    if (isMeasurementProduct(product)) {
      const existingItem = cart.find(item => item.productId === product.id);
      openMeasurementModal(product, {
        cartItemId: existingItem?.productId,
        initialQuantity: existingItem?.quantity
      });
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
        price: product.price,
        unit: product.unit || DEFAULT_UNIT
      }]);
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const targetItem = cart.find(item => item.productId === productId);
    if (targetItem && isMeasurementProduct(targetItem.product)) {
      openMeasurementModal(targetItem.product, { cartItemId: targetItem.productId, initialQuantity: targetItem.quantity });
      return;
    }

    // Find the product to check stock
    const product = products.find(p => p.id === productId);
    if (!product) {
      return;
    }
    
    // Round to 2 decimal places for meters/litres, whole numbers for pieces
    const roundedQuantity = product.unit === 'pieces' ? Math.floor(quantity) : Math.round(quantity * 100) / 100;
    
    if (roundedQuantity > product.stock) {
      toast.error(`Cannot add more ${product.name}. Only ${product.stock} ${getUnitShortLabel(product.unit)} available in stock`);
      // Set to max available stock
    setCart(cart.map(item => 
      item.productId === productId 
          ? { ...item, quantity: product.stock }
          : item
      ));
      return;
    }
    
    setCart(cart.map(item => 
      item.productId === productId 
        ? { ...item, quantity: roundedQuantity }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const getTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getFinalTotal = () => {
    return getTotal();
  };

  const upsertCustomerProfile = useCallback(
    async (paymentData: any, orderTotal: number): Promise<string | null> => {
      if (!currentUser?.shopId) {
        return paymentData.customerId || null;
      }

      if (
        !paymentData.customerId &&
        !paymentData.customerPhone &&
        !paymentData.customerName
      ) {
        return null;
      }

      const customersCollectionName = getShopCollectionName('customers', selectedBranch as BranchName);
      const customersRef = collection(db, customersCollectionName);

      let customerRef = paymentData.customerId
        ? doc(db, customersCollectionName, paymentData.customerId)
        : null;
      let customerSnapshot = customerRef ? await getDoc(customerRef) : null;

      if ((!customerSnapshot || !customerSnapshot.exists()) && paymentData.customerPhone) {
        const existingQuery = query(customersRef, where('phone', '==', paymentData.customerPhone));
        const existingSnapshot = await getDocs(existingQuery);
        if (!existingSnapshot.empty) {
          customerRef = existingSnapshot.docs[0].ref;
          customerSnapshot = existingSnapshot.docs[0];
        }
      }

      if (!customerSnapshot || !customerSnapshot.exists()) {
        if (!paymentData.customerName && !paymentData.customerPhone) {
          return paymentData.customerId || null;
        }

        const newCustomer = {
          name: paymentData.customerName || 'Customer',
          phone: paymentData.customerPhone || '',
          email: paymentData.customerEmail || '',
          loyaltyPoints: 0,
          totalSpent: 0,
          totalPurchases: 0,
          orderCount: 0,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };

        const newDocRef = await addDoc(customersRef, newCustomer);
        customerRef = newDocRef;
        customerSnapshot = await getDoc(newDocRef);
      }

      if (!customerRef) {
        return null;
      }

      const existingData = customerSnapshot?.data() || {};
      const earnedPoints = Math.max(0, Math.floor((orderTotal || 0) / 200));

      await updateDoc(customerRef, {
        name: paymentData.customerName || existingData.name || 'Customer',
        phone: paymentData.customerPhone || existingData.phone || '',
        email: paymentData.customerEmail || existingData.email || '',
        totalSpent: (existingData.totalSpent || 0) + orderTotal,
        orderCount: (existingData.orderCount || existingData.totalPurchases || 0) + 1,
        totalPurchases: (existingData.totalPurchases || existingData.orderCount || 0) + 1,
        loyaltyPoints: (existingData.loyaltyPoints || 0) + earnedPoints,
        lastPurchaseAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      return customerRef.id;
    },
    [currentUser?.shopId]
  );

  /*
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
            <img src="/icons/CentalLightmode.png" alt="CENTRAL SHOP Logo" style="max-width: 60px; max-height: 60px; object-fit: contain; margin: 0 auto;" />
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
  */

  const handleCheckout = async (paymentData: any) => {
    // Capture cart snapshot before clearing
    const cartSnapshot = [...cart];
    
    // Close modals immediately for instant response
    setIsCustomerInfoOpen(false);
    setPendingPaymentData(null);
    setIsCheckoutOpen(false);
  
    
    // Clear cart immediately for instant UI response
    setCart([]);
    
    // Show immediate success feedback
    toast.success('Processing order...', { autoClose: 1000 });
    
    // Process order in background (non-blocking)
    processOrderInBackground(paymentData, cartSnapshot);
  };

  const processOrderInBackground = async (paymentData: any, cartSnapshot: OrderItem[]) => {
    try {
      setIsProcessing(true);
      
      if (!currentUser?.shopId) {
        toast.error('No shop assigned to your account');
        setIsProcessing(false);
        return;
      }

      if (cartSnapshot.length === 0) {
        toast.error('Cart is empty');
        setIsProcessing(false);
        return;
      }

      // Calculate totals
      const subtotal = getTotal();
      const tax = 0; // Tax removed
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

      const customerIdForStats = await upsertCustomerProfile(paymentData, total);

      // Create order - filter out undefined values
      const orderData: any = {
        items: cartSnapshot.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          unit: item.product.unit || DEFAULT_UNIT,
          measurementLabel: item.product.measurementLabel || ''
        })),
        subtotal,
        tax,
        total,
        status: orderStatus,
        paymentMethod: paymentData.paymentMethod,
        createdAt: new Date(),
        employeeId: currentUser.customId || currentUser.uid,
        employeeName: currentUser.name || 'Cashier',
        ...(paymentData.amountReceived && { amountReceived: paymentData.amountReceived }),
        ...(paymentData.change && { change: paymentData.change }),
        customerName: paymentData.customerName || 'Walk In Customer',
        ...(paymentData.customerEmail && { customerEmail: paymentData.customerEmail }),
        ...(paymentData.customerPhone && { customerPhone: paymentData.customerPhone }),
        ...(paymentData.mpesaCode && { mpesaCode: paymentData.mpesaCode }),
        ...(paymentData.debtAmount && { debtAmount: paymentData.debtAmount }),
        ...(paymentData.partialAmount && { partialAmount: paymentData.partialAmount }),
        ...(paymentData.remainingAmount && { remainingAmount: paymentData.remainingAmount }),
        ...(paymentData.dueDate && { dueDate: paymentData.dueDate }),
        // Split payment fields
        ...(paymentData.paymentMethod === 'split' && {
          cashAmount: paymentData.cashAmount,
          mpesaAmount: paymentData.mpesaAmount,
          amountReceived: (paymentData.cashAmount || 0) + (paymentData.mpesaAmount || 0),
          change: Math.max(0, ((paymentData.cashAmount || 0) + (paymentData.mpesaAmount || 0)) - total)
        }),
        // Track who issued debt/partial payment
        ...((paymentData.paymentMethod === 'debt' || paymentData.paymentMethod === 'partial') && {
          debtIssuedBy: currentUser.name || 'Cashier',
          debtIssuedById: currentUser.customId || currentUser.uid
        })
      };

      if (paymentData.customerId) {
        orderData.customerId = paymentData.customerId;
      } else if (customerIdForStats) {
        orderData.customerId = customerIdForStats;
      }

      // Save order to Firebase - use shop-specific collection
      const { getShopOrdersCollectionNameCached } = await import('../utils/orderCollectionHelper');
      const ordersCollectionName = await getShopOrdersCollectionNameCached(currentUser.shopId!);
      await addDoc(collection(db, ordersCollectionName), orderData);

      // If debt or partial payment, create invoice
      if (paymentData.paymentMethod === 'debt' && paymentData.customerName && paymentData.customerPhone) {
        let customerId = customerIdForStats || paymentData.customerId || null;
        if (!customerId) {
          customerId = await upsertCustomerProfile(paymentData, total);
        }

        if (customerId) {
          try {
          const invoiceNumber = `INV-${Date.now()}`;
          const invoiceItems = cartSnapshot.map(item => ({
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

          await addDoc(collection(db, getShopCollectionName('invoices', selectedBranch as BranchName)), invoiceData);
          
          const paymentType = paymentData.partialAmount ? 'Partial payment' : 'Debt';
          toast.success(`${paymentType} invoice ${invoiceNumber} created and customer saved!`);
        } catch (error) {
          console.error('Error creating invoice/customer:', error);
          toast.error('Order created but failed to create invoice. Please create manually.');
        }
        } else {
          toast.error('Unable to create invoice because customer information is missing.');
        }
      }

      // Update product stock
      for (const item of cartSnapshot) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const newStock = product.stock - item.quantity;
          await updateDoc(doc(db, getShopCollectionName('products', selectedBranch as BranchName), item.productId), {
            stock: newStock,
            updatedAt: new Date()
          });
        }
      }

      // Prepare receipt data
      const receiptData = {
        orderId: `ORD-${Date.now()}`,
        items: cartSnapshot.map(item => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
          unit: item.product.unit || DEFAULT_UNIT
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
        // Split payment fields
        cashAmount: paymentData.cashAmount,
        mpesaAmount: paymentData.mpesaAmount,
        employeeName: currentUser.name || 'Cashier',
        timestamp: new Date(),
        businessName: 'CENTRAL SHOP',
        businessAddress: '',
        businessPhone: ''
      };

      // Process receipt printing in parallel (non-blocking)
      BusinessSettingsService.getBusinessInfo(currentUser.shopId!).then(businessInfo => {
        ReceiptService.handleReceiptFlow(
        receiptData,
        paymentSettings,
        businessInfo
        ).then(receiptResult => {
      if (receiptResult.success) {
            // Silent success - receipt printed
            console.log('Receipt printed successfully');
      } else {
            console.warn('Receipt printing issue:', receiptResult.message);
      }
        }).catch(err => {
          console.error('Receipt printing error:', err);
        });
      });
      
      // Add notification in background
      addNotification({
        title: 'New Order Completed',
        message: `Order ${receiptData.orderId} has been completed for KSH ${total.toLocaleString()}`,
        type: 'success'
      }).catch(err => {
        console.error('Notification error:', err);
      });

      // Show success message
      if (paymentData.paymentMethod === 'debt') {
        toast.success('Debt order created successfully!');
      } else if (paymentData.paymentMethod === 'partial') {
        toast.success('Partial payment order created!');
      } else {
        toast.success('Order completed! Receipt printing...');
      }
      
      // Refresh products in background
      fetchProducts();
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Point of Sale</h1>
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300">Process customer orders and payments</p>
        </div>
        {(currentUser?.shopName === 'CentralShop' || currentUser?.role === 'mainAdmin' || currentUser?.role === 'Admin') && (
          <Dropdown
            value={selectedBranch}
            onChange={setSelectedBranch}
            options={[
              { value: BRANCHES.CENTRAL, label: 'Central Shop' },
              { value: BRANCHES.KAMWENE, label: 'Kamwene Shop' }
            ]}
            placeholder="Select Branch"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Products Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Category Dropdown, Search & Controls */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center relative z-50">
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              {/* Category Dropdown */}
              <div className="w-full sm:w-40 flex-shrink-0 relative z-50">
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
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#4A90A4] focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2">
          {/* View Mode Toggle */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-[#4A90A4] text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  aria-label="Grid view"
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === 'list'
                      ? 'bg-[#4A90A4] text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  aria-label="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Checkout Button */}
              <Button
                onClick={openCheckout}
                variant="primary"
                className="h-9 px-3 text-sm flex items-center gap-1.5"
                disabled={cart.length === 0}
              >
                <ShoppingCart className="w-4 h-4" />
                Checkout ({cartItemCount})
              </Button>
            </div>
          </div>

          {/* Products Grid */}
          <ProductsGrid
            products={filteredProducts}
            mode="pos"
            viewMode={viewMode}
            loading={loading}
            onAddToCart={addToCart}
            getStockStatus={(stock: number) => {
              if (stock === 0) return { text: 'Out of Stock', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900' };
              if (stock < 20) return { text: 'Low Stock', color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900' };
              return { text: 'In Stock', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900' };
            }}
          />
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
                  {cart.map(item => {
                    const measurementItem = isMeasurementProduct(item.product);
                    const unitLabel = measurementItem ? getMeasurementLabel(item.product) : getUnitShortLabel(item.product.unit);
                    return (
                    <div key={item.productId} className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white">{item.product.name}</h4>
                          <p className="text-sm text-gray-500">
                            {item.quantity} {unitLabel} × KSH {item.price.toLocaleString()} / {unitLabel}
                          </p>
                      </div>
                      
                        {measurementItem ? (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => openMeasurementModal(item.product, { cartItemId: item.productId, initialQuantity: item.quantity })}
                              className="px-3 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
                            >
                              Edit Qty
                            </button>
                            <button
                              onClick={() => removeFromCart(item.productId)}
                              className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900 flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-800 text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        
                        <input
                          type="number"
                          min="0.01"
                          step={item.product.unit === 'pieces' ? '1' : '0.01'}
                          value={item.quantity}
                          onChange={(e) => {
                            const newValue = parseFloat(e.target.value);
                            if (!isNaN(newValue) && newValue >= 0) {
                              updateQuantity(item.productId, newValue);
                            }
                          }}
                          onBlur={(e) => {
                            const newValue = parseFloat(e.target.value);
                            if (isNaN(newValue) || newValue <= 0) {
                              updateQuantity(item.productId, 1);
                            }
                          }}
                          className="w-16 text-center font-medium border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4A90A4]"
                        />
                        
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + (item.product.unit === 'pieces' ? 1 : 0.01))}
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
                        )}
                    </div>
                    );
                  })}
                </div>

                {/* Order Summary */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>KSH {getFinalTotal().toLocaleString()}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 mt-6">
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
                    variant="secondary"
                    className="w-full flex items-center justify-center text-red-600 hover:text-red-700 hover:border-red-300"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear Cart
                  </Button>
                </div>
              </>
            )}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                Powered By Astraronix Solutions
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Measurement Modal */}
      <Modal
        open={measurementModal.open}
        onClose={closeMeasurementModal}
        title={`Enter ${getMeasurementLabel(measurementModal.product)}`}
      >
        {measurementModal.product && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleMeasurementConfirm();
            }}
          >
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Specify the exact {getMeasurementLabel(measurementModal.product)} for <strong>{measurementModal.product.name}</strong>.
            </p>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Amount in {getMeasurementLabel(measurementModal.product)}
              </label>
              <input
                type="number"
                name="measurementValue"
                min="0"
                step="0.01"
                value={measurementValue}
                onChange={(e) => setMeasurementValue(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4A90A4]"
                required
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Available: {measurementModal.product.stock} {getMeasurementLabel(measurementModal.product)}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={closeMeasurementModal}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Save
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onConfirm={() => {}}
        onContinue={(paymentData) => {
          setPendingPaymentData(paymentData);
          setIsCheckoutOpen(false);
          setIsCustomerInfoOpen(true);
        }}
        cart={cart.map(item => ({
          id: item.productId,
          name: item.product.name,
          price: item.price,
          quantity: item.quantity,
          unit: item.product.unit || DEFAULT_UNIT
        }))}
        total={getFinalTotal()}
        isLoading={isProcessing}
      />

      {/* Customer Info Modal */}
      <CustomerInfoModal
        isOpen={isCustomerInfoOpen}
        onClose={() => {
          setIsCustomerInfoOpen(false);
          setPendingPaymentData(null);
        }}
        onConfirm={(finalPaymentData) => {
          handleCheckout(finalPaymentData);
          setIsCustomerInfoOpen(false);
          setPendingPaymentData(null);
        }}
        paymentData={pendingPaymentData || {}}
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
