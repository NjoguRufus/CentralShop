/**
 * Offline Notifier Component
 * Shows a banner when the app goes offline
 */
import React, { useState, useEffect } from 'react';
import Card from './UI/Card';
import { WifiOff, Wifi } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BRANCHES, BranchName } from '../config/shopConfig';
import { safeSync, syncOfflineOrdersForBranch } from '../offline';
import { toast } from 'react-toastify';

const OfflineNotifier: React.FC = () => {
  const { currentUser } = useAuth();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [countdown, setCountdown] = useState(6);
  const [offlineCountdown, setOfflineCountdown] = useState(5);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowBanner(true);
      setCountdown(6); // Reset countdown when coming back online
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowBanner(true);
      setOfflineCountdown(5); // Reset countdown when going offline
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Countdown timer for "Back Online" notification (6 seconds)
  useEffect(() => {
    if (showBanner && !isOffline && !isSyncing) {
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setShowBanner(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [showBanner, isOffline, isSyncing]);

  // Countdown timer for "Working Offline" notification (5 seconds)
  useEffect(() => {
    if (showBanner && isOffline && !isSyncing) {
      const interval = setInterval(() => {
        setOfflineCountdown((prev) => {
          if (prev <= 1) {
            setShowBanner(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [showBanner, isOffline, isSyncing]);

  if (!showBanner) return null;

  const handleSyncClick = async () => {
    if (isSyncing) return;
    try {
      setIsSyncing(true);
      setCountdown(0); // Stop countdown when user clicks sync

      // Generic pending writes sync (products, customers, etc.)
      await safeSync();

      // Also sync offline orders for the current user's primary shop, if available
      if (currentUser?.shopName) {
        const key = currentUser.shopName.toLowerCase().replace(/\s+/g, '');
        let branch: BranchName = BRANCHES.CENTRAL;
        if (key.includes('kamwene')) {
          branch = BRANCHES.KAMWENE;
        }
        const { syncedCount, errorCount } = await syncOfflineOrdersForBranch(branch);
        if (syncedCount === 0 && errorCount === 0) {
          toast.info('No offline changes to sync');
        } else {
          toast.success(`Synced ${syncedCount} offline orders${errorCount > 0 ? ` (${errorCount} errors)` : ''}`);
        }
      } else {
        toast.success('Synced pending changes');
      }

      setShowBanner(false);
    } catch (error) {
      console.error('Error syncing changes from banner:', error);
      toast.error('Failed to sync changes');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-40 max-w-md w-full px-4">
      <Card className={`p-3 md:p-4 shadow-lg ${
        isOffline 
          ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' 
          : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      }`}>
        <div className="flex items-center justify-between gap-2 md:gap-3">
          {isOffline ? (
            <>
              <WifiOff className="w-4 h-4 md:w-5 md:h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-semibold text-orange-900 dark:text-orange-100">
                  Working Offline
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-300">
                  Changes will be saved and can be synced when you're back online.
                  {offlineCountdown > 0 && (
                    <span className="ml-1 font-medium">({offlineCountdown}s)</span>
                  )}
                </p>
              </div>
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 md:w-5 md:h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-semibold text-green-900 dark:text-green-100">
                  Back Online
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Click "Sync changes" to upload offline updates.
                  {countdown > 0 && (
                    <span className="ml-1 font-medium">({countdown}s)</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                disabled={isSyncing}
                onClick={handleSyncClick}
                className="px-3 py-1 text-[10px] md:text-xs font-medium rounded-full bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
              >
                {isSyncing ? 'Syncing…' : 'Sync changes'}
              </button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

export default OfflineNotifier;

