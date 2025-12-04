import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getShopCollectionName, BRANCHES, BranchName } from '../config/shopConfig';
import { syncOfflineOrdersForBranch } from '../offline/offlineOrders';
import { db } from '../offline/db';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Table from '../components/UI/Table';
import Dropdown from '../components/UI/Dropdown';
import FormInput from '../components/UI/FormInput';
import { Upload, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';

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
      const cacheKey = `offline-orders-${branch}`;
      
      const cached = await db.localCache.get(cacheKey);
      const cachedOrders: OfflineOrder[] = cached && Array.isArray(cached.data) ? cached.data : [];
      
      cachedOrders.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 
                     (a.createdAt instanceof Date ? a.createdAt.getTime() : 
                     (a.createdAt ? new Date(a.createdAt).getTime() : 0));
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 
                     (b.createdAt instanceof Date ? b.createdAt.getTime() : 
                     (b.createdAt ? new Date(b.createdAt).getTime() : 0));
        return dateB - dateA;
      });
      
      setOfflineOrders(cachedOrders);
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
              }
            ]}
            data={filteredOrders}
            emptyMessage="No offline orders found"
          />
        )}
      </Card>
    </div>
  );
};

export default OfflineOrders;
