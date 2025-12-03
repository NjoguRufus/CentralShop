/**
 * React Hook for Offline Sync
 * Automatically syncs offline data when online
 */
import { useEffect, useState, useCallback } from 'react';
import { syncAllOfflineData } from './sync';

export function useOfflineSync(intervalMinutes: number = 5) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const trySync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) {
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const result = await syncAllOfflineData();
      setLastSync(new Date());
      
      if (result.errors > 0) {
        console.warn(`Sync completed with ${result.errors} errors`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      setSyncError(errorMessage);
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  useEffect(() => {
    // NO INITIAL SYNC - only event-based
    // NO INTERVALS - removed periodic sync

    // Listen for online event only
    const handleOnline = () => {
      console.log('Online: Triggering sync...');
      trySync();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      // NO interval to clear
    };
  }, [trySync, isSyncing]);

  return {
    isSyncing,
    lastSync,
    syncError,
    triggerSync: trySync
  };
}

