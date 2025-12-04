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
import Dropdown from '../components/UI/Dropdown';

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
  firestoreId?: string; // Firestore document ID for synced orders
}

const OfflineOrders: React.FC = () => {
  const { currentUser } = useAuth();
  const [offlineOrders, setOfflineOrders] = useState<OfflineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string>('CentralShop');
  const [selectedOrder, setSelectedOrder] = useState<OfflineOrder | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'today' | 'day'>('all');
  const [showSynced, setShowSynced] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = window.localStorage.getItem('offlineOrders-showSynced');
      return saved === 'true';
    } catch {
      return false;
    }
  });
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [filterDate, setFilterDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  useEffect(() => {
    if (currentUser?.shopId) {
      const branch = selectedBranch as BranchName;
      fetchOfflineOrders();
      refreshPendingCount(branch);
    }
  }, [currentUser?.shopId, selectedBranch]);

  // Persist activation switch preference
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('offlineOrders-showSynced', showSynced ? 'true' : 'false');
    } catch {
      // ignore storage errors
    }
  }, [showSynced]);

  const fetchOfflineOrders = async () => {
    try {
      setLoading(true);
      const branch = selectedBranch as BranchName;

      // Always start from local cache: this includes unsynced queue and any entries we have marked as synced
      const cacheKey = `offline-orders-${branch}`;
      const offlineOrdersCollection = `OfflineOrders${branch}`;
      const cached = await indexedDb.localCache.get(cacheKey);
      const localOrders: OfflineOrder[] = cached && Array.isArray(cached.data) ? cached.data : [];

      // If offline, just show local queue
      if (!navigator.onLine) {
        setOfflineOrders(localOrders);
        return;
      }

      // When online, also load history from main Orders where syncedFromOffline == true
      const ordersCollectionName = getShopCollectionName('orders', branch);
      const qMain = query(
        collection(db, ordersCollectionName),
        where('syncedFromOffline', '==', true),
        where('shopName', '==', branch),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(qMain);
      const syncedFromServer: OfflineOrder[] = snapshot.docs.map((docSnap) => {
        const data: any = docSnap.data();
        const created = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date());
        return {
          id: docSnap.id,
          firestoreId: docSnap.id, // Store Firestore ID for reference
          items: data.items || [],
          subtotal: data.subtotal || 0,
          tax: data.tax || 0,
          total: data.total,
          status: data.status || 'completed',
          paymentMethod: data.paymentMethod || 'cash',
          createdAt: created,
          employeeId: data.employeeId || '',
          employeeName: data.employeeName,
          customerName: data.customerName || 'Walk In Customer',
          customerPhone: data.customerPhone,
          shopName: data.shopName || branch,
          synced: true,
          syncedAt: data.syncedAt?.toDate ? data.syncedAt.toDate() : undefined
        };
      });

      // Merge: keep all local orders (unsynced + locally-synced markers),
      // and add any server-synced orders that don't already exist in cache.
      const localIds = new Set([
        ...localOrders.map(o => o.id).filter(Boolean) as string[],
        ...localOrders.map(o => o.firestoreId).filter(Boolean) as string[]
      ]);
      const extras = syncedFromServer.filter(o => {
        const orderId = o.id || o.firestoreId;
        return !orderId || !localIds.has(orderId);
      });
      const combined = [...localOrders, ...extras];

      // Cache synced orders from Firestore into IndexedDB for offline viewing
      // This ensures synced orders are available when the user goes offline
      if (extras.length > 0) {
        const updatedLocalOrders = [...localOrders];
        extras.forEach(extra => {
          // Check if this order already exists in local cache by comparing IDs
          const exists = localOrders.some(lo => 
            (lo.id && extra.id && lo.id === extra.id) ||
            (lo.firestoreId && extra.firestoreId && lo.firestoreId === extra.firestoreId) ||
            (lo.firestoreId && extra.id && lo.firestoreId === extra.id) ||
            (lo.id && extra.firestoreId && lo.id === extra.firestoreId)
          );
          if (!exists) {
            updatedLocalOrders.push(extra);
          }
        });
        
        // Update cache with merged orders (synced + unsynced)
        await indexedDb.localCache.put({
          id: cacheKey,
          collection: offlineOrdersCollection,
          data: updatedLocalOrders,
          lastSynced: new Date()
        });
      }

      setOfflineOrders(combined);
    } catch (error) {
      console.error('Error fetching offline orders:', error);
      toast.error('Failed to load offline orders');
    } finally {
      setLoading(false);
    }
  };

  // Load how many pending (unsynced) offline orders exist in local cache
  const refreshPendingCount = async (branch: BranchName) => {
    try {
      const cacheKey = `offline-orders-${branch}`;
      const cached = await indexedDb.localCache.get(cacheKey);
      const cachedOrders: OfflineOrder[] = cached && Array.isArray(cached.data) ? cached.data : [];
      const count = cachedOrders.filter((o: OfflineOrder) => !o.synced).length;
      setPendingCount(count);
    } catch (error) {
      console.warn('Error loading pending offline orders count:', error);
      setPendingCount(0);
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
      const { syncOfflineOrdersForBranch } = await import('../offline/offlineOrders');
      const { syncedCount, errorCount } = await syncOfflineOrdersForBranch(branch);

      if (syncedCount === 0 && errorCount === 0) {
        toast.info('No offline orders to sync');
      } else {
        toast.success(`Synced ${syncedCount} orders${errorCount > 0 ? ` (${errorCount} errors)` : ''}`);
      }

      await fetchOfflineOrders();
      await refreshPendingCount(branch);
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

  const getOrderDateString = (date: Date | Timestamp) => {
    const dateObj = date instanceof Timestamp ? date.toDate() : new Date(date);
    if (isNaN(dateObj.getTime())) return '';
    return dateObj.toISOString().split('T')[0];
  };

  const filteredOrders = offlineOrders.filter((order) => {
    // Synced visibility filter
    if (!showSynced && order.synced) {
      return false;
    }

    // Status filter
    if (statusFilter !== 'all' && (order.status || 'pending') !== statusFilter) {
      return false;
    }

    const orderDate = getOrderDateString(order.createdAt);

    // Date filter (today / specific day)
    if (dateFilterMode === 'today') {
      const todayStr = getOrderDateString(new Date() as any);
      if (!orderDate || orderDate !== todayStr) return false;
    } else if (dateFilterMode === 'day') {
      if (!orderDate || orderDate !== filterDate) return false;
    }

    return true;
  });

  const tableHeaders = ['Order ID', 'Date', 'Customer', 'Items', 'Total', 'Payment', 'Status', 'Actions'];
  const tableRows = filteredOrders.map((order) => [
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
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <div className="flex items-center gap-2">
              <Dropdown
                value={selectedBranch}
                onChange={setSelectedBranch}
                options={[
                  { value: BRANCHES.CENTRAL, label: 'Central Shop' },
                  { value: BRANCHES.KAMWENE, label: 'Kamwene Shop' }
                ]}
                placeholder="Select Branch"
              />
              <Button
                onClick={syncOfflineOrdersToFirestore}
                disabled={isSyncing || !navigator.onLine || pendingCount === 0}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {isSyncing ? 'Syncing...' : `Sync ${pendingCount} Orders`}
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Dropdown
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'partial', label: 'Partial' }
                ]}
                placeholder="Filter Status"
              />

              <Dropdown
                value={dateFilterMode}
                onChange={(v) => setDateFilterMode(v as 'all' | 'today' | 'day')}
                options={[
                  { value: 'all', label: 'All days' },
                  { value: 'today', label: 'Today' },
                  { value: 'day', label: 'Specific day' }
                ]}
                placeholder="Filter Date"
              />

              {dateFilterMode === 'day' && (
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs md:text-sm"
                />
              )}

              {/* Show/hide offline orders switch */}
              <button
                type="button"
                onClick={() => setShowSynced(prev => !prev)}
                className={`relative inline-flex items-center h-6 rounded-full w-14 border border-gray-300 dark:border-gray-600 transition-colors ${
                  showSynced ? 'bg-[#4A90A4]' : 'bg-gray-200 dark:bg-gray-700'
                }`}
                aria-label="Toggle offline orders visibility"
              >
                <span
                  className={`inline-block w-5 h-5 transform bg-white rounded-full shadow transition-transform ${
                    showSynced ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
                <span className="ml-2 text-[10px] md:text-xs text-gray-700 dark:text-gray-300">
                  {showSynced ? 'Show' : 'Hide'}
                </span>
              </button>
            </div>
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
          {/* Table component expects 'data', not 'rows' */}
          <Table headers={tableHeaders} data={tableRows} />
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

