/**
 * Offline Module Exports
 * Central export point for all offline functionality
 */
export * from './db';
export * from './offlineProducts';
export * from './offlineOrders';
export * from './offlineCustomers';
export * from './offlineSettings';
export * from './saveOffline';
export * from './safeFirestoreWrite';
export * from './firestoreWrappers';
export * from './cacheFirstLoader';
export * from './offlineAuth';
export { syncPendingWrites } from './sync';

import { syncProductsFromFirestore } from './offlineProducts';
import { syncCustomersFromFirestore, syncCustomersToFirestore } from './offlineCustomers';
import { syncSettingsFromFirestore, syncSettingsToFirestore } from './offlineSettings';
import { syncOfflineOrdersToFirebase } from './sync';

/**
 * Sync all data from Firestore to IndexedDB
 */
export async function syncAllFromFirestore(): Promise<void> {
  try {
    if (!navigator.onLine) {
      console.log('Offline: Cannot sync from Firestore');
      return;
    }
    
    await Promise.all([
      syncProductsFromFirestore(),
      syncCustomersFromFirestore(),
      syncSettingsFromFirestore()
    ]);
  } catch (error) {
    console.error('Error syncing all from Firestore:', error);
  }
}

/**
 * Sync all dirty data to Firestore
 * DISABLED: Only pending writes (from offline operations) are synced
 * All other data must be created/updated through manual user input to prevent duplicates
 */
export async function syncAllToFirestore(): Promise<void> {
  try {
    if (!navigator.onLine) {
      console.log('Offline: Cannot sync to Firestore');
      return;
    }
    
    // Only sync pending writes (queued when offline)
    // All other automatic syncing is disabled to prevent unwanted data creation
    await syncOfflineOrdersToFirebase(); // Already disabled, just returns
    
    // Customer and Settings sync disabled - they must be created/updated manually
    // await syncCustomersToFirestore(); // DISABLED
    // await syncSettingsToFirestore(); // DISABLED
  } catch (error) {
    console.error('Error syncing all to Firestore:', error);
  }
}

/**
 * Initialize offline sync on app start
 * Only syncs FROM Firestore (read-only caching), never TO Firestore automatically
 */
export async function initializeOfflineSync(): Promise<void> {
  // Sync from Firestore on startup if online (read-only, for caching)
  if (navigator.onLine) {
    await syncAllFromFirestore();
  }
  
  // Set up periodic sync FROM Firestore only (read-only caching)
  // No automatic writes to prevent unwanted data creation
  setInterval(async () => {
    if (navigator.onLine) {
      // Only sync pending writes (from offline operations queued by user actions)
      await syncAllToFirestore(); // Only processes pending writes, no automatic creation
      // Sync FROM Firestore for caching (read-only)
      await syncAllFromFirestore();
    }
  }, 5 * 60 * 1000); // Every 5 minutes
  
  // Listen for online event
  window.addEventListener('online', async () => {
    console.log('Online: Syncing pending writes and refreshing cache...');
    // Only sync pending writes (from offline operations)
    await syncAllToFirestore(); // Only processes pending writes, no automatic creation
    // Sync FROM Firestore for caching (read-only)
    await syncAllFromFirestore();
  });
}

