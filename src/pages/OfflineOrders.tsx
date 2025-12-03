/**
 * Offline Orders Page
 * Manages orders created while offline
 * These orders are stored in a separate Firebase collection and synced when online
 */
import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getShopCollectionName, BRANCHES, BranchName } from '../config/shopConfig';
import { db as indexedDb } from '../offline/db';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Table from '../components/UI/Table';
import Modal from '../components/Modal';
import { toast } from 'react-toastify';
import { Download, Trash2, Upload, WifiOff } from 'lucide-react';
import { ReceiptService } from '../services/ReceiptService';

interface OfflineOrder {
  id?: string;
  items: any[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  paymentMethod: string;
  createdAt: Date | Timestamp;
  employeeId: string;
  employeeName?: string;
  customerName?: string;
  customerPhone?: string;
  shopName?: string;
  synced?: boolean;
  syncedAt?: Date;
}

const OfflineOrders: React.FC = () => {
  const { currentUser } = useAuth();
  const [offlineOrders, setOfflineOrders] = useState<OfflineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string>('CentralShop');
  const [selectedOrder, setSelectedOrder] = useState<OfflineOrder | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (currentUser?.shopId) {
      fetchOfflineOrders();
    }
  }, [currentUser?.shopId, selectedBranch]);

  const fetchOfflineOrders = async () => {
    try {
      setLoading(true);
      const branch = selectedBranch as BranchName;
      
      // Load from IndexedDB first (local storage)
      const cacheKey = `offline-orders-${branch}`;
      const cached = await indexedDb.localCache.get(cacheKey);
      let localOrders: OfflineOrder[] = cached && Array.isArray(cached.data) ? cached.data : [];
      
      // Also fetch from Firebase offline orders collection if online
      if (navigator.onLine) {
        try {
          const offlineOrdersCollection = `OfflineOrders${branch}`;
          const q = query(
            collection(db, offlineOrdersCollection),
            orderBy('createdAt', 'desc')
          );
          const snapshot = await getDocs(q);
          const firestoreOrders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : doc.data().createdAt
          })) as OfflineOrder[];
          
          // Merge local and Firestore orders, removing duplicates
          const orderMap = new Map();
          localOrders.forEach(order => {
            if (order.id) orderMap.set(order.id, order);
          });
          firestoreOrders.forEach(order => {
            if (order.id) orderMap.set(order.id, order);
          });
          
          localOrders = Array.from(orderMap.values());
          
          // Update cache
          await indexedDb.localCache.put({
            id: cacheKey,
            collection: offlineOrdersCollection,
            data: localOrders,
            lastSynced: new Date()
          });
        } catch (error: any) {
          // Handle permission errors gracefully
          if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
            console.warn('Permission denied fetching offline orders from Firestore. Using local cache only.');
            // Continue with local orders only
          } else {
            console.warn('Error fetching offline orders from Firestore:', error);
          }
        }
      }
      
      setOfflineOrders(localOrders);
    } catch (error) {
      console.error('Error fetching offline orders:', error);
      toast.error('Failed to load offline orders');
    } finally {
      setLoading(false);
    }
  };

  const syncOfflineOrdersToFirestore = async () => {
    if (!navigator.onLine) {
      toast.error('Cannot sync while offline');
      return;
    }

    try {
      setIsSyncing(true);
      const branch = selectedBranch as BranchName;
      const ordersCollectionName = getShopCollectionName('orders', branch);
      const offlineOrdersCollection = `OfflineOrders${branch}`;
      
      let syncedCount = 0;
      let errorCount = 0;
      
      for (const order of offlineOrders) {
        try {
          // Validate order has required fields before syncing
          if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
            console.warn(`Skipping invalid order: missing or empty items array`);
            errorCount++;
            continue;
          }
          
          if (order.total === undefined || order.total === null || order.total < 0) {
            console.warn(`Skipping invalid order: invalid total value`);
            errorCount++;
            continue;
          }
          
          if (!order.employeeId) {
            console.warn(`Skipping invalid order: missing employeeId`);
            errorCount++;
            continue;
          }
          
          // Check for duplicate order before creating
          // Check by employeeId, total, and createdAt (within 10 seconds)
          try {
            // Normalize createdAt to a valid Timestamp for duplicate checking
            let createdAtTimestamp: Timestamp | null = null;
            if (order.createdAt instanceof Timestamp) {
              createdAtTimestamp = order.createdAt;
            } else if (order.createdAt instanceof Date) {
              createdAtTimestamp = Timestamp.fromDate(order.createdAt);
            } else if (order.createdAt) {
              const parsed = new Date(order.createdAt);
              if (!isNaN(parsed.getTime())) {
                createdAtTimestamp = Timestamp.fromDate(parsed);
              }
            }

            if (createdAtTimestamp) {
              const baseDate = createdAtTimestamp.toDate();
              if (!isNaN(baseDate.getTime())) {
                const startTime = new Date(baseDate.getTime() - 10000);
                const endTime = new Date(baseDate.getTime() + 10000);
                
                const duplicateCheck = query(
                  collection(db, ordersCollectionName),
                  where('employeeId', '==', order.employeeId),
                  where('total', '==', order.total),
                  where('createdAt', '>=', Timestamp.fromDate(startTime)),
                  where('createdAt', '<=', Timestamp.fromDate(endTime))
                );
                
                const existing = await getDocs(duplicateCheck);
                if (!existing.empty) {
                  console.warn(`Skipping duplicate order: order already exists in main collection`);
                  // Remove from offline orders since it's already synced
                  if (order.id) {
                    try {
                      await deleteDoc(doc(db, offlineOrdersCollection, order.id));
                    } catch (deleteError) {
                      console.warn('Error deleting duplicate from offline orders:', deleteError);
                    }
                  }
                  continue;
                }
              }
            }
          } catch (duplicateCheckError) {
            console.warn('Error checking for duplicate (non-blocking):', duplicateCheckError);
            // Continue with sync even if duplicate check fails
          }
          
          // Filter out undefined values to prevent Firestore errors
          const orderData: any = {
            items: order.items,
            subtotal: order.subtotal || 0,
            tax: order.tax || 0,
            total: order.total,
            status: order.status || 'completed',
            paymentMethod: order.paymentMethod || 'cash',
            createdAt: order.createdAt instanceof Timestamp ? order.createdAt : Timestamp.fromDate(new Date(order.createdAt)),
            employeeId: order.employeeId,
            customerName: order.customerName || 'Walk In Customer',
            shopName: order.shopName || branch,
            syncedFromOffline: true,
            syncedAt: Timestamp.now()
          };
          
          // Only add optional fields if they exist and are not undefined
          if (order.employeeName) {
            orderData.employeeName = order.employeeName;
          }
          if (order.customerPhone) {
            orderData.customerPhone = order.customerPhone;
          }
          if (order.customerEmail) {
            orderData.customerEmail = order.customerEmail;
          }
          if (order.customerId) {
            orderData.customerId = order.customerId;
          }
          
          // Add to main orders collection (this is the ONLY place where orders should be added to main collection)
          await addDoc(collection(db, ordersCollectionName), orderData);
          
          // Remove from offline orders collection if it has an ID
          if (order.id) {
            try {
              await deleteDoc(doc(db, offlineOrdersCollection, order.id));
            } catch (deleteError) {
              console.warn('Error deleting from offline orders collection:', deleteError);
            }
          }
          
          syncedCount++;
        } catch (error: any) {
          console.error('Error syncing order:', error);
          errorCount++;
          
          // Handle quota exceeded - stop syncing to avoid more errors
          if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded')) {
            toast.warn('Firestore quota exceeded. Please try again later.');
            break; // Stop syncing to avoid more quota errors
          }
          
          // If it's a duplicate or permission error, remove from offline orders anyway
          if (error.message?.includes('already exists') || error.code === 'permission-denied') {
            if (order.id) {
              try {
                await deleteDoc(doc(db, offlineOrdersCollection, order.id));
              } catch (deleteError) {
                console.warn('Error deleting duplicate order:', deleteError);
              }
            }
          }
        }
      }
      
      // Clear local cache
      const cacheKey = `offline-orders-${branch}`;
      await indexedDb.localCache.put({
        id: cacheKey,
        collection: offlineOrdersCollection,
        data: [],
        lastSynced: new Date()
      });
      
      toast.success(`Synced ${syncedCount} orders${errorCount > 0 ? ` (${errorCount} errors)` : ''}`);
      await fetchOfflineOrders();
    } catch (error) {
      console.error('Error syncing offline orders:', error);
      toast.error('Failed to sync offline orders');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteOrder = async (order: OfflineOrder) => {
    if (!order.id) return;
    
    try {
      const branch = selectedBranch as BranchName;
      const offlineOrdersCollection = `OfflineOrders${branch}`;
      
      // Delete from Firestore if online
      if (navigator.onLine) {
        try {
          await deleteDoc(doc(db, offlineOrdersCollection, order.id));
        } catch (error) {
          console.warn('Error deleting from Firestore:', error);
        }
      }
      
      // Remove from local cache
      const cacheKey = `offline-orders-${branch}`;
      const cached = await indexedDb.localCache.get(cacheKey);
      if (cached && Array.isArray(cached.data)) {
        const updatedOrders = cached.data.filter((o: any) => o.id !== order.id);
        await indexedDb.localCache.put({
          id: cacheKey,
          collection: offlineOrdersCollection,
          data: updatedOrders,
          lastSynced: new Date()
        });
      }
      
      toast.success('Order deleted');
      await fetchOfflineOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Failed to delete order');
    }
  };

  const formatCurrency = (amount: number) => {
    return `KSH ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: Date | Timestamp) => {
    const dateObj = date instanceof Timestamp ? date.toDate() : new Date(date);
    return dateObj.toLocaleString('en-KE');
  };

  const tableHeaders = ['Order ID', 'Date', 'Customer', 'Items', 'Total', 'Payment', 'Status', 'Actions'];
  const tableRows = offlineOrders.map((order) => [
    order.id?.substring(0, 8) || 'N/A',
    formatDate(order.createdAt),
    order.customerName || 'Walk In Customer',
    order.items?.length || 0,
    formatCurrency(order.total),
    order.paymentMethod || 'N/A',
    order.status || 'pending',
    <div key={order.id} className="flex gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setSelectedOrder(order);
          setIsDetailModalOpen(true);
        }}
      >
        View
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={() => handleDeleteOrder(order)}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  ]);

  return (
    <div className="space-y-4 md:space-y-6 px-2 md:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0 mb-4">
        <div>
          <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <WifiOff className="w-5 h-5 md:w-6 md:h-6" />
            Offline Orders
          </h1>
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 mt-1">
            Orders created while offline. Sync them to the main orders collection when online.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value={BRANCHES.CENTRAL}>Central Shop</option>
            <option value={BRANCHES.KAMWENE}>Kamwene Shop</option>
          </select>
          <Button
            onClick={syncOfflineOrdersToFirestore}
            disabled={isSyncing || !navigator.onLine || offlineOrders.length === 0}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {isSyncing ? 'Syncing...' : `Sync ${offlineOrders.length} Orders`}
          </Button>
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <Card className="p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">Loading offline orders...</p>
        </Card>
      ) : offlineOrders.length === 0 ? (
        <Card className="p-8 text-center">
          <WifiOff className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400">No offline orders found</p>
        </Card>
      ) : (
        <Card>
          <Table headers={tableHeaders} rows={tableRows} />
        </Card>
      )}

      {/* Order Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Order Details - ${selectedOrder?.id?.substring(0, 8) || 'N/A'}`}
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Date</p>
                <p className="font-medium">{formatDate(selectedOrder.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                <p className="font-medium">{selectedOrder.status || 'pending'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Customer</p>
                <p className="font-medium">{selectedOrder.customerName || 'Walk In Customer'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Payment Method</p>
                <p className="font-medium">{selectedOrder.paymentMethod || 'N/A'}</p>
              </div>
            </div>
            
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Items</p>
              <div className="space-y-2">
                {selectedOrder.items?.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <span>{item.name || `Item ${index + 1}`}</span>
                    <span className="font-medium">
                      {item.quantity}x {formatCurrency(item.price || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="border-t pt-4">
              <div className="flex justify-between mb-2">
                <span>Subtotal:</span>
                <span className="font-medium">{formatCurrency(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Tax:</span>
                <span className="font-medium">{formatCurrency(selectedOrder.tax)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>{formatCurrency(selectedOrder.total)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default OfflineOrders;

