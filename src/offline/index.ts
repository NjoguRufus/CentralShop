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
 */
export async function syncAllToFirestore(): Promise<void> {
  try {
    if (!navigator.onLine) {
      console.log('Offline: Cannot sync to Firestore');
      return;
    }
    
    // Use the new sync module for orders
    await syncOfflineOrdersToFirebase();
    
    await Promise.all([
      syncCustomersToFirestore(),
      syncSettingsToFirestore()
    ]);
  } catch (error) {
    console.error('Error syncing all to Firestore:', error);
  }
}

/**
 * Initialize offline sync on app start
 */
export async function initializeOfflineSync(): Promise<void> {
  // Sync from Firestore on startup if online
  if (navigator.onLine) {
    await syncAllFromFirestore();
  }
  
  // Set up periodic sync
  setInterval(async () => {
    if (navigator.onLine) {
      await syncAllToFirestore();
      await syncAllFromFirestore();
    }
  }, 5 * 60 * 1000); // Every 5 minutes
  
  // Listen for online event
  window.addEventListener('online', async () => {
    console.log('Online: Syncing data...');
    await syncAllToFirestore();
    await syncAllFromFirestore();
  });
}

