/**
 * Safe Firestore Write Wrapper
 * Wraps Firestore write operations to handle offline scenarios
 */
import { saveOfflineWrite, OfflineWriteAction } from './saveOffline';

/**
 * Wraps a Firestore write operation with offline support
 * If offline or write fails, the operation is queued for later sync
 */
export async function safeFirestoreWrite<T>(
  action: () => Promise<T>,
  writeAction: OfflineWriteAction
): Promise<T> {
  // BLOCK notifications and automatic order creation
  // Notifications should be local-only
  // Orders should ONLY be created through POS checkout - offline orders go to OfflineOrders collection
  const collectionLower = writeAction.collection.toLowerCase();
  if (collectionLower.includes('notifications') || collectionLower.includes('notification')) {
    console.warn(`Blocked notification write to Firestore: ${writeAction.collection}. Notifications are local-only.`);
    // Return mock result without queuing
    if (writeAction.type === 'add') {
      const mockId = `blocked-${Date.now()}`;
      return {
        id: mockId,
        path: `${writeAction.collection}/${mockId}`,
        parent: null,
        type: 'document'
      } as T;
    }
    return undefined as T;
  }
  
  // BLOCK ALL automatic order syncing
  // Orders should ONLY be created through:
  // 1. Direct POS checkout when online (not queued, not wrapped)
  // 2. Manual sync from OfflineOrders page (not queued, not wrapped)
  // OfflineOrders can be queued when offline, but they should NOT automatically sync to main orders
  if ((collectionLower.includes('orders') || collectionLower.includes('order')) && writeAction.type === 'add') {
    // Only allow OfflineOrders collections to be queued when offline
    // But they should NOT automatically sync - they stay in OfflineOrders until manually synced
    if (writeAction.collection.includes('OfflineOrders')) {
      // Allow OfflineOrders to be queued when offline - they'll stay in OfflineOrders collection
      // They will NOT automatically sync to main orders - only manual sync from OfflineOrders page
      console.log(`Allowing OfflineOrders write to queue: ${writeAction.collection} (will stay in OfflineOrders, not auto-sync)`);
    } else {
      // BLOCK writes to main orders collections - these should NEVER be queued
      console.error(`BLOCKED: Attempted to queue order to main orders collection: ${writeAction.collection}. Orders must be created through POS checkout only.`);
      // Return mock result without queuing - this prevents the write
      if (writeAction.type === 'add') {
        const mockId = `blocked-${Date.now()}`;
        return {
          id: mockId,
          path: `${writeAction.collection}/${mockId}`,
          parent: null,
          type: 'document'
        } as T;
      }
      return undefined as T;
    }
  }

  // Check if we're online
  if (!navigator.onLine) {
    console.log('Offline: Queuing write operation');
    // For add operations, generate appropriate ID prefix
    let mockId: string | undefined;
    if (writeAction.type === 'add') {
      // Only use OFF- prefix for orders (OfflineOrders collections)
      // Other collections (categories, products, etc.) get regular IDs
      if (writeAction.collection.includes('OfflineOrders') || 
          (writeAction.collection.toLowerCase().includes('orders') && 
           !writeAction.collection.includes('OfflineOrders'))) {
        mockId = `OFF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      } else {
        // Regular ID for non-order collections
        mockId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      // Store the mock ID in the write action
      writeAction.docId = mockId;
    }
    await saveOfflineWrite(writeAction);
    // Return a mock result that matches the expected type
    // For addDoc, return a DocumentReference-like object
    if (writeAction.type === 'add' && mockId) {
      return {
        id: mockId,
        path: `${writeAction.collection}/${mockId}`,
        parent: null,
        type: 'document'
      } as T;
    }
    // For update/delete, return void-like result
    return undefined as T;
  }

  try {
    // Try to execute the write operation
    return await action();
  } catch (err) {
    // If write fails, check if it's a notification - don't queue those
    if (collectionLower.includes('notifications') || collectionLower.includes('notification')) {
      console.warn(`Notification write failed and will not be queued: ${writeAction.collection}. Notifications are local-only.`);
      throw err; // Re-throw to let the caller handle it
    }
    
    // For orders and other writes, queue it for offline sync
    console.log('Write failed, queuing for offline sync:', err);
    // For add operations, generate appropriate ID prefix
    let mockId: string | undefined;
    if (writeAction.type === 'add') {
      // Only use OFF- prefix for orders (OfflineOrders collections)
      // Other collections (categories, products, etc.) get regular IDs
      if (writeAction.collection.includes('OfflineOrders') || 
          (writeAction.collection.toLowerCase().includes('orders') && 
           !writeAction.collection.includes('OfflineOrders'))) {
        mockId = `OFF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      } else {
        // Regular ID for non-order collections
        mockId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      // Store the mock ID in the write action
      writeAction.docId = mockId;
    }
    await saveOfflineWrite(writeAction);
    
    // Return a mock result
    if (writeAction.type === 'add' && mockId) {
      return {
        id: mockId,
        path: `${writeAction.collection}/${mockId}`,
        parent: null,
        type: 'document'
      } as T;
    }
    return undefined as T;
  }
}

/**
 * Helper function to create write action for addDoc
 */
export function createAddAction(collection: string, data: any): OfflineWriteAction {
  return {
    type: 'add',
    collection,
    payload: data
  };
}

/**
 * Helper function to create write action for updateDoc
 */
export function createUpdateAction(collection: string, docId: string, data: any): OfflineWriteAction {
  return {
    type: 'update',
    collection,
    docId,
    payload: data
  };
}

/**
 * Helper function to create write action for deleteDoc
 */
export function createDeleteAction(collection: string, docId: string): OfflineWriteAction {
  return {
    type: 'delete',
    collection,
    docId,
    payload: null
  };
}

/**
 * Helper function to create write action for setDoc
 */
export function createSetAction(collection: string, docId: string, data: any): OfflineWriteAction {
  return {
    type: 'update', // setDoc is treated as update for offline purposes
    collection,
    docId,
    payload: data
  };
}

