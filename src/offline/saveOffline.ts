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
    
    // Register background sync if service worker is available
    // Note: Background sync requires HTTPS (or localhost) and user gesture
    // We'll catch permission errors gracefully
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('firebase-sync');
      } catch (error: any) {
        // Background sync may fail due to:
        // - Not on HTTPS/localhost
        // - Permission denied
        // - Service worker not ready
        // This is non-critical - writes are still queued
        if (error.name !== 'NotAllowedError' && error.name !== 'TypeError') {
          console.warn('Background sync registration failed:', error);
        }
      }
    }

    console.log(`Queued offline write: ${action.type} to ${action.collection}`);
    return id.toString();
  } catch (error) {
    console.error('Error saving offline write:', error);
    throw error;
  }
}

