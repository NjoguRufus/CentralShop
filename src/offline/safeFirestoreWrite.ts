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
  // BLOCK notifications and orders from being queued or written
  // Notifications should be local-only, orders should only come from POS checkout
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
  
  if (collectionLower.includes('orders') || collectionLower.includes('order')) {
    // Only allow orders if they're coming from POS checkout (online and successful)
    // Block offline order writes and failed order writes from being queued
    if (!navigator.onLine) {
      console.warn(`Blocked offline order write: ${writeAction.collection}. Orders must be created through POS checkout when online.`);
      const mockId = `blocked-${Date.now()}`;
      return {
        id: mockId,
        path: `${writeAction.collection}/${mockId}`,
        parent: null,
        type: 'document'
      } as T;
    }
  }

  // Check if we're online
  if (!navigator.onLine) {
    console.log('Offline: Queuing write operation');
    await saveOfflineWrite(writeAction);
    // Return a mock result that matches the expected type
    // For addDoc, return a DocumentReference-like object
    if (writeAction.type === 'add') {
      const mockId = `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
    // If write fails, check if it's an order or notification - don't queue those
    if (collectionLower.includes('orders') || collectionLower.includes('order')) {
      console.warn(`Order write failed and will not be queued: ${writeAction.collection}. Orders must be created through POS checkout.`);
      throw err; // Re-throw to let the caller handle it
    }
    if (collectionLower.includes('notifications') || collectionLower.includes('notification')) {
      console.warn(`Notification write failed and will not be queued: ${writeAction.collection}. Notifications are local-only.`);
      throw err; // Re-throw to let the caller handle it
    }
    
    // For other writes, queue it for offline sync
    console.log('Write failed, queuing for offline sync:', err);
    await saveOfflineWrite(writeAction);
    
    // Return a mock result
    if (writeAction.type === 'add') {
      const mockId = `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

