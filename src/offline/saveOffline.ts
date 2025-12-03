/**
 * Save Offline Write Operations
 * Stores Firestore write operations in IndexedDB when offline or when write fails
 */
import { db, PendingWrite } from './db';

export interface OfflineWriteAction {
  type: 'add' | 'update' | 'delete';
  collection: string;
  payload: any;
  docId?: string; // Required for update/delete operations
}

/**
 * Save a write operation to the offline queue
 */
export async function saveOfflineWrite(action: OfflineWriteAction): Promise<string> {
  try {
    const pendingWrite: PendingWrite = {
      collection: action.collection,
      data: action.payload,
      type: action.type,
      status: 'pending',
      docId: action.docId,
      timestamp: new Date(),
      retryCount: 0
    };

    const id = await db.pendingWrites.add(pendingWrite);
    
    // Register background sync ONCE per offline write (event-based)
    // Only register if online (background sync will trigger when connection restored)
    if (navigator.onLine && 'serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        // Register sync tag - this will trigger sync when connection is restored
        await registration.sync.register('sync-pending-writes');
      } catch (error: any) {
        // Background sync may fail - non-critical
        if (error.name !== 'NotAllowedError' && error.name !== 'TypeError') {
          console.warn('Background sync registration failed:', error);
        }
      }
    }
    
    // If online, trigger sync immediately (but only if not already syncing)
    if (navigator.onLine) {
      // Use safeSync to prevent double-sync
      const { safeSync } = await import('./index');
      safeSync().catch(console.error);
    }

    console.log(`Queued offline write: ${action.type} to ${action.collection}`);
    return id.toString();
  } catch (error) {
    console.error('Error saving offline write:', error);
    throw error;
  }
}

