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
export { syncPendingWrites, cleanBrokenSyncEntries } from './sync';

import { syncProductsFromFirestore } from './sync';
import { syncCustomersFromFirestore } from './sync';
import { syncSettingsFromFirestore } from './sync';
import { syncAllFromFirestore } from './sync';

/**
 * Safe sync wrapper - only syncs when online
 */
export async function safeSync(): Promise<void> {
  if (!navigator.onLine) {
    return;
  }
  
  const { syncPendingWrites } = await import('./sync');
  await syncPendingWrites();
}

/**
 * Sync all data from Firestore to IndexedDB (read-only caching)
 */
export async function syncAllFromFirestoreToCache(): Promise<void> {
  await syncAllFromFirestore();
}

/**
 * Initialize offline sync on app start
 * NO AUTOMATIC SYNCING - only event-based syncing
 */
export async function initializeOfflineSync(): Promise<void> {
  // Clean up broken entries on startup
  const { cleanBrokenSyncEntries } = await import('./sync');
  await cleanBrokenSyncEntries();
  
  // Sync from Firestore on startup if online (read-only, for caching)
  if (navigator.onLine) {
    await syncAllFromFirestore();
  }
  
  // NO INTERVALS - only event-based syncing
  // Sync will happen on:
  // 1. window.addEventListener('online', safeSync)
  // 2. When new offline write is created (triggers background sync)
  // 3. Manual sync from UI
}
