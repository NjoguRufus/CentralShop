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
    // If write fails, queue it for offline sync
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

