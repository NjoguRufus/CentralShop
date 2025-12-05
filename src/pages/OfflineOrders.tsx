import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getShopCollectionName, BRANCHES, BranchName } from '../config/shopConfig';
import { syncOfflineOrdersForBranch } from '../offline/offlineOrders';
import { db } from '../offline/db';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Table from '../components/UI/Table';
import Dropdown from '../components/UI/Dropdown';
import FormInput from '../components/UI/FormInput';
import { Upload, RefreshCw, AlertCircle, CheckCircle2, Eye, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/UI/ConfirmationModal';

interface OfflineOrder {
  id: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
    name?: string;
  }>;
  total: number;
  subtotal?: number;
  tax?: number;
  status?: string;
  paymentMethod?: string;
  customerName?: string;
  customerPhone?: string;
  employeeId?: string;
  employeeName?: string;
  createdAt?: any;
  synced?: boolean;
  syncedAt?: Date;
  firestoreId?: string;
  shopName?: string;
}

const OfflineOrders: React.FC = () => {
  const { currentUser } = useAuth();
  const [offlineOrders, setOfflineOrders] = useState<OfflineOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<BranchName>(BRANCHES.CENTRAL);
  const [selectedOrder, setSelectedOrder] = useState<OfflineOrder | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [orderToDelete, setOrderToDelete] = useState<OfflineOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const canSwitchBranches =
    (Array.isArray((currentUser as any)?.assignedShops) &&
      new Set(
        ((currentUser as any).assignedShops as string[]).map(s => s.replace(/\s+/g, '').toLowerCase())
      ).size > 1) ||
    currentUser?.role === 'mainAdmin' ||
    currentUser?.role === 'Admin' ||
    currentUser?.role === 'astraronix';

  useEffect(() => {
    if (currentUser?.shopName) {
      const saved = localStorage.getItem('selectedBranch');
      if (saved) {
        setSelectedBranch(saved as BranchName);
      }
    }
  }, [currentUser?.shopName]);

  useEffect(() => {
    if (!currentUser?.shopId) return;
    loadOfflineOrders();
  }, [currentUser?.shopId, selectedBranch]);

  const loadOfflineOrders = async () => {
    try {
      setLoading(true);
      const branch = selectedBranch;
      const offlineOrdersCollection = `OfflineOrders${branch}`;
      const cacheKey = `offline-orders-${branch}`;
      
      // Fetch from Firestore (shared across all devices)
      let firestoreOrders: OfflineOrder[] = [];
      if (navigator.onLine) {
        try {
          const q = query(
            collection(firestoreDb, offlineOrdersCollection),
            orderBy('createdAt', 'desc')
          );
          const snapshot = await getDocs(q);
          firestoreOrders = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt,
              synced: data.synced || false,
              syncedAt: data.syncedAt?.toDate ? data.syncedAt.toDate() : (data.syncedAt instanceof Date ? data.syncedAt : undefined),
              firestoreId: doc.id
            } as OfflineOrder;
          });
        } catch (error) {
          console.error('Error fetching offline orders from Firestore:', error);
          // Continue with IndexedDB data if Firestore fails
        }
      }
      
      // Also fetch from IndexedDB (local cache, may have orders not yet synced to Firestore)
      const cached = await db.localCache.get(cacheKey);
      const cachedOrders: OfflineOrder[] = cached && Array.isArray(cached.data) ? cached.data : [];
      
      // Merge orders from both sources, deduplicating by ID
      const ordersMap = new Map<string, OfflineOrder>();
      
      // Add Firestore orders first (they are the source of truth)
      firestoreOrders.forEach(order => {
        if (order.id) {
          ordersMap.set(order.id, order);
        }
      });
      
      // Add IndexedDB orders, but don't overwrite Firestore orders
      cachedOrders.forEach(order => {
        if (order.id && !ordersMap.has(order.id)) {
          ordersMap.set(order.id, order);
        }
      });
      
      // Convert map to array and sort by createdAt descending
      const allOrders = Array.from(ordersMap.values());
      allOrders.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 
                     (a.createdAt instanceof Date ? a.createdAt.getTime() : 
                     (a.createdAt ? new Date(a.createdAt).getTime() : 0));
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 
                     (b.createdAt instanceof Date ? b.createdAt.getTime() : 
                     (b.createdAt ? new Date(b.createdAt).getTime() : 0));
        return dateB - dateA;
      });
      
      setOfflineOrders(allOrders);
    } catch (error) {
      console.error('Error loading offline orders:', error);
      toast.error('Failed to load offline orders');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!navigator.onLine) {
      toast.error('Cannot sync while offline. Please check your internet connection.');
      return;
    }

    try {
      setIsSyncing(true);
      const branch = selectedBranch;
      const result = await syncOfflineOrdersForBranch(branch);
      
      if (result.syncedCount > 0) {
        toast.success(`Successfully synced ${result.syncedCount} order(s)`);
      }
      
      if (result.errorCount > 0) {
        toast.warn(`${result.errorCount} order(s) failed to sync. Check console for details.`);
      }
      
      if (result.syncedCount === 0 && result.errorCount === 0) {
        toast.info('No pending orders to sync');
      }
      
      await loadOfflineOrders();
    } catch (error: any) {
      console.error('Error syncing offline orders:', error);
      toast.error(error.message || 'Failed to sync offline orders');
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredOrders = offlineOrders.filter(order => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        order.id?.toLowerCase().includes(searchLower) ||
        order.customerName?.toLowerCase().includes(searchLower) ||
        order.customerPhone?.toLowerCase().includes(searchLower) ||
        order.employeeName?.toLowerCase().includes(searchLower) ||
        order.total?.toString().includes(searchTerm)
      );
    }
    return true;
  });

  const pendingOrders = filteredOrders.filter(order => !order.synced);
  const syncedOrders = filteredOrders.filter(order => order.synced);

  const formatDate = (date: any): string => {
    if (!date) return '-';
    try {
      const d = date?.toDate ? date.toDate() : (date instanceof Date ? date : new Date(date));
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
    } catch {
      return '-';
    }
  };

  const formatCurrency = (value: number) => `KSH ${value.toLocaleString()}`;

  const viewOrderDetails = (order: OfflineOrder): void => {
    setSelectedOrder(order);
    setIsDetailModalOpen(true);
  };

  const handleDeleteOrder = (order: OfflineOrder): void => {
    setOrderToDelete(order);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteOrder = async (): Promise<void> => {
    if (!orderToDelete) return;

    try {
      setIsDeleting(true);
      const branch = selectedBranch;
      const offlineOrdersCollection = `OfflineOrders${branch}`;
      const cacheKey = `offline-orders-${branch}`;
      
      // Delete from Firestore if online and order has a Firestore ID
      if (navigator.onLine && orderToDelete.firestoreId) {
        try {
          await deleteDoc(doc(firestoreDb, offlineOrdersCollection, orderToDelete.firestoreId));
        } catch (error) {
          console.error('Error deleting order from Firestore:', error);
          // Continue with local deletion even if Firestore deletion fails
        }
      }
      
      // Also delete using the order ID if firestoreId is not available
      if (navigator.onLine && orderToDelete.id && !orderToDelete.firestoreId) {
        try {
          await deleteDoc(doc(firestoreDb, offlineOrdersCollection, orderToDelete.id));
        } catch (error) {
          console.error('Error deleting order from Firestore by ID:', error);
          // Continue with local deletion even if Firestore deletion fails
        }
      }
      
      // Get current cached orders
      const cached = await db.localCache.get(cacheKey);
      const cachedOrders: OfflineOrder[] = cached && Array.isArray(cached.data) ? cached.data : [];
      
      // Remove the order from cache
      const updatedOrders = cachedOrders.filter((o: any) => o.id !== orderToDelete.id);
      
      // Update cache
      await db.localCache.put({
        id: cacheKey,
        collection: offlineOrdersCollection,
        data: updatedOrders,
        lastSynced: cached?.lastSynced || new Date()
      });

      // Also try to remove from db.orders if it exists there
      if (orderToDelete.id) {
        try {
          await db.orders.delete(orderToDelete.id);
        } catch (error) {
          // Ignore if order doesn't exist in db.orders
        }
      }
      
      toast.success('Order deleted successfully');
      setIsDeleteModalOpen(false);
      setOrderToDelete(null);
      await loadOfflineOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Failed to delete order');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">Offline Orders</h1>
        <div className="flex items-center gap-3">
          {canSwitchBranches && (
            <Dropdown
              value={selectedBranch}
              onChange={(value) => {
                setSelectedBranch(value as BranchName);
                localStorage.setItem('selectedBranch', value);
              }}
              options={[
                { value: BRANCHES.CENTRAL, label: 'Central Shop' },
                { value: BRANCHES.KAMWENE, label: 'Kamwene Shop' }
              ]}
              placeholder="Select Branch"
            />
          )}
          <Button
            variant="primary"
            onClick={handleSync}
            disabled={isSyncing || !navigator.onLine}
            className="flex items-center space-x-2"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Syncing...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Sync Orders</span>
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={loadOfflineOrders}
            disabled={loading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {!navigator.onLine && (
        <div className="mb-4 p-4 bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 dark:border-yellow-700 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-800 dark:text-yellow-200" />
          <p className="text-yellow-800 dark:text-yellow-200">
            You are currently offline. Orders will be synced when you come back online.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Orders</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{filteredOrders.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Pending Sync</div>
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{pendingOrders.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Synced</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{syncedOrders.length}</div>
        </Card>
      </div>

      <Card className="p-3 md:p-4">
        <div className="mb-4">
          <FormInput
            name="search"
            type="text"
            placeholder="Search orders by ID, customer, phone, or amount..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">No offline orders found</p>
          </div>
        ) : (
          <Table
            columns={[
              {
                header: 'Status',
                accessor: 'synced',
                render: (row: OfflineOrder) => (
                  <div className="flex items-center gap-2">
                    {row.synced ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-xs text-green-600 dark:text-green-400">Synced</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                        <span className="text-xs text-yellow-600 dark:text-yellow-400">Pending</span>
                      </>
                    )}
                  </div>
                )
              },
              {
                header: 'Order ID',
                accessor: 'id',
                render: (row: OfflineOrder) => (
                  <span className="font-mono text-sm">{row.id || '-'}</span>
                )
              },
              {
                header: 'Customer',
                accessor: 'customerName',
                render: (row: OfflineOrder) => row.customerName || 'Walk In Customer'
              },
              {
                header: 'Phone',
                accessor: 'customerPhone',
                render: (row: OfflineOrder) => row.customerPhone || '-'
              },
              {
                header: 'Items',
                accessor: 'items',
                render: (row: OfflineOrder) => row.items?.length || 0
              },
              {
                header: 'Total',
                accessor: 'total',
                render: (row: OfflineOrder) => formatCurrency(row.total || 0)
              },
              {
                header: 'Payment',
                accessor: 'paymentMethod',
                render: (row: OfflineOrder) => (
                  <span className="capitalize">{row.paymentMethod || 'cash'}</span>
                )
              },
              {
                header: 'Employee',
                accessor: 'employeeName',
                render: (row: OfflineOrder) => row.employeeName || row.employeeId || '-'
              },
              {
                header: 'Created At',
                accessor: 'createdAt',
                render: (row: OfflineOrder) => formatDate(row.createdAt)
              },
              {
                header: 'Synced At',
                accessor: 'syncedAt',
                render: (row: OfflineOrder) => row.synced ? formatDate(row.syncedAt) : '-'
              },
              {
                header: 'Actions',
                accessor: 'actions',
                render: (row: OfflineOrder) => (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => viewOrderDetails(row)}
                      className="flex items-center gap-1 px-2 py-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium transition-colors"
                      title="View Order Details"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">View</span>
                    </button>
                    <button
                      onClick={() => handleDeleteOrder(row)}
                      className="flex items-center gap-1 px-2 py-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium transition-colors"
                      title="Delete Order"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  </div>
                )
              }
            ]}
            data={filteredOrders}
            emptyMessage="No offline orders found"
          />
        )}
      </Card>

      {/* Order Details Modal */}
      <Modal
        open={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Offline Order Details - ${selectedOrder?.id || ''}`}
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-4 p-2 md:p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Order ID</h3>
                <p className="text-gray-900 dark:text-white font-mono text-sm">{selectedOrder.id || '-'}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Status</h3>
                {selectedOrder.synced ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-green-600 dark:text-green-400 font-medium">Synced</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <span className="text-yellow-600 dark:text-yellow-400 font-medium">Pending Sync</span>
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Customer</h3>
                <p className="text-gray-900 dark:text-white">{selectedOrder.customerName || 'Walk In Customer'}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Phone</h3>
                <p className="text-gray-900 dark:text-white">{selectedOrder.customerPhone || '-'}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Created At</h3>
                <p className="text-gray-900 dark:text-white">{formatDate(selectedOrder.createdAt)}</p>
              </div>
              {selectedOrder.synced && (
                <div>
                  <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Synced At</h3>
                  <p className="text-gray-900 dark:text-white">{formatDate(selectedOrder.syncedAt)}</p>
                </div>
              )}
              <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Payment Method</h3>
                <p className="text-gray-900 dark:text-white capitalize">{selectedOrder.paymentMethod || 'cash'}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Employee</h3>
                <p className="text-gray-900 dark:text-white">{selectedOrder.employeeName || selectedOrder.employeeId || 'N/A'}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Subtotal</h3>
                <p className="text-gray-900 dark:text-white">{formatCurrency(selectedOrder.subtotal || 0)}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Tax</h3>
                <p className="text-gray-900 dark:text-white">{formatCurrency(selectedOrder.tax || 0)}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Total</h3>
                <p className="text-gray-900 dark:text-white font-bold text-lg">{formatCurrency(selectedOrder.total || 0)}</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Order Items</h3>
              <div className="border rounded-lg overflow-hidden dark:border-gray-600 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-2 md:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">Product</th>
                      <th className="px-2 md:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">Quantity</th>
                      <th className="px-2 md:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">Price</th>
                      <th className="px-2 md:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-2 md:px-4 py-2 text-sm text-gray-900 dark:text-white">
                            {item.name || `Product ${item.productId}`}
                          </td>
                          <td className="px-2 md:px-4 py-2 text-sm text-gray-900 dark:text-white">
                            {item.quantity}
                          </td>
                          <td className="px-2 md:px-4 py-2 text-sm text-gray-900 dark:text-white">
                            {formatCurrency(item.price)}
                          </td>
                          <td className="px-2 md:px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(item.price * item.quantity)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">
                          No items found
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <td colSpan={3} className="px-2 md:px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">
                        Total:
                      </td>
                      <td className="px-2 md:px-4 py-2 font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(selectedOrder.total || 0)}
                      </td>
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
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setOrderToDelete(null);
        }}
        onConfirm={confirmDeleteOrder}
        title="Delete Offline Order"
        message={orderToDelete ? `Are you sure you want to delete order ${orderToDelete.id}? This action cannot be undone and the order will be permanently removed from local storage.` : ''}
        type="danger"
        confirmText="Delete Order"
        cancelText="Cancel"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default OfflineOrders;
