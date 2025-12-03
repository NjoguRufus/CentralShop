/**
 * Sync Queue Manager Component
 * Shows pending sync operations and allows manual retry
 */
import React, { useState, useEffect } from 'react';
import Card from './UI/Card';
import Button from './UI/Button';
import { RefreshCw, AlertCircle, CheckCircle, X } from 'lucide-react';
import { db } from '../offline/db';
import { syncAllOfflineData } from '../offline/sync';
import { toast } from 'react-toastify';

interface SyncItem {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  status?: 'pending' | 'syncing' | 'success' | 'error';
  error?: string;
}

const SyncQueueManager: React.FC = () => {
  const [pendingOrders, setPendingOrders] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [syncItems, setSyncItems] = useState<SyncItem[]>([]);

  useEffect(() => {
    const checkPendingSync = async () => {
      try {
        const orders = await db.orders.toArray();
        const unsynced = orders.filter(o => o.synced !== true);
        setPendingOrders(unsynced.length);

        // Get sync queue items
        const queueItems = await db.syncQueue.toArray();
        setSyncItems(queueItems.map(item => ({
          id: item.id?.toString() || '',
          type: item.type,
          data: item.data,
          timestamp: item.timestamp,
          status: 'pending'
        })));
      } catch (error) {
        console.error('Error checking sync queue:', error);
      }
    };

    checkPendingSync();
    // NO INTERVALS - only check when component mounts or when manually triggered
    // Sync happens event-based: on online event or when new write is created
  }, []);

  const handleSync = async () => {
    if (isSyncing || !navigator.onLine) {
      if (!navigator.onLine) {
        toast.error('You are offline. Please connect to the internet to sync.');
      }
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncAllOfflineData();
      
      if (result.errors > 0) {
        toast.warning(`Synced ${result.synced} items with ${result.errors} errors`);
      } else if (result.synced > 0) {
        toast.success(`Successfully synced ${result.synced} items`);
      } else {
        toast.info('All items are already synced');
      }

      // Refresh pending count
      const orders = await db.orders.toArray();
      const unsynced = orders.filter(o => o.synced !== true);
      setPendingOrders(unsynced.length);
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  if (pendingOrders === 0 && syncItems.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 max-w-sm">
      <Card className="p-3 shadow-lg border-2 border-orange-200 dark:border-orange-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
            ) : (
              <AlertCircle className="w-4 h-4 text-orange-500" />
            )}
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Pending Sync
            </h3>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Toggle details"
          >
            {showDetails ? (
              <X className="w-4 h-4" />
            ) : (
              <span className="text-xs">Details</span>
            )}
          </button>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          {pendingOrders} {pendingOrders === 1 ? 'order' : 'orders'} waiting to sync
        </p>

        {showDetails && syncItems.length > 0 && (
          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
            {syncItems.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"
              >
                <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                {item.type} - {new Date(item.timestamp).toLocaleTimeString()}
              </div>
            ))}
            {syncItems.length > 5 && (
              <div className="text-xs text-gray-400 italic">
                +{syncItems.length - 5} more...
              </div>
            )}
          </div>
        )}

        <Button
          onClick={handleSync}
          disabled={isSyncing || !navigator.onLine}
          className="w-full mt-2"
          size="sm"
        >
          <RefreshCw className={`w-3 h-3 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </Card>
    </div>
  );
};

export default SyncQueueManager;

