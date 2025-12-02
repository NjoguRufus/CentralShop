/**
 * Utility to clear all local data (IndexedDB, localStorage, cache)
 * Use this to start from a clean slate
 */

import { db } from '../offline/db';
import { offlineUsersDb } from '../offline/offlineUsersDB';

/**
 * Clear all IndexedDB databases
 */
export async function clearIndexedDB(): Promise<void> {
  try {
    console.log('Clearing IndexedDB databases...');
    
    // Clear main database tables (only if they exist)
    const tables = [
      'pendingWrites',
      'localCache',
      'products',
      'orders',
      'customers',
      'settings',
      'syncQueue'
    ];
    
    for (const tableName of tables) {
      try {
        const table = (db as any)[tableName];
        if (table && typeof table.clear === 'function') {
          await table.clear();
          console.log(`✅ Cleared ${tableName}`);
        }
      } catch (err) {
        console.warn(`⚠️ Could not clear ${tableName}:`, err);
      }
    }
    
    // Clear offline users database
    try {
      if (offlineUsersDb && offlineUsersDb.offlineUsers) {
        await offlineUsersDb.offlineUsers.clear();
        console.log('✅ Cleared offlineUsers');
      }
    } catch (err) {
      console.warn('⚠️ Could not clear offlineUsers:', err);
    }
    
    // Also delete the entire databases to ensure complete cleanup
    try {
      const deleteReq = indexedDB.deleteDatabase('CentralShopDB');
      await new Promise<void>((resolve, reject) => {
        deleteReq.onsuccess = () => {
          console.log('✅ Deleted CentralShopDB database');
          resolve();
        };
        deleteReq.onerror = () => reject(deleteReq.error);
        deleteReq.onblocked = () => {
          console.warn('⚠️ CentralShopDB deletion blocked - close all tabs and try again');
          resolve(); // Don't fail if blocked
        };
      });
    } catch (err) {
      console.warn('⚠️ Could not delete CentralShopDB:', err);
    }
    
    try {
      const deleteReq2 = indexedDB.deleteDatabase('OfflineUsersDB');
      await new Promise<void>((resolve, reject) => {
        deleteReq2.onsuccess = () => {
          console.log('✅ Deleted OfflineUsersDB database');
          resolve();
        };
        deleteReq2.onerror = () => reject(deleteReq2.error);
        deleteReq2.onblocked = () => {
          console.warn('⚠️ OfflineUsersDB deletion blocked - close all tabs and try again');
          resolve(); // Don't fail if blocked
        };
      });
    } catch (err) {
      console.warn('⚠️ Could not delete OfflineUsersDB:', err);
    }
    
    console.log('✅ IndexedDB cleared successfully');
  } catch (error) {
    console.error('Error clearing IndexedDB:', error);
    throw error;
  }
}

/**
 * Clear all localStorage data
 */
export function clearLocalStorage(): void {
  try {
    console.log('Clearing localStorage...');
    
    // Get all keys
    const keys = Object.keys(localStorage);
    
    // Remove each key
    keys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log(`✅ Cleared ${keys.length} localStorage items`);
  } catch (error) {
    console.error('Error clearing localStorage:', error);
    throw error;
  }
}

/**
 * Clear browser cache (requires page reload)
 */
export function clearCache(): void {
  try {
    console.log('Clearing cache...');
    
    // Clear service worker cache if available
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
        console.log(`✅ Cleared ${names.length} cache(s)`);
      });
    }
    
    // Note: Full cache clear requires browser settings or hard refresh
    console.log('⚠️ For full cache clear, use Ctrl+Shift+Delete or hard refresh (Ctrl+F5)');
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

/**
 * Clear all local data (IndexedDB + localStorage + cache)
 */
export async function clearAllLocalData(): Promise<void> {
  try {
    console.log('🧹 Starting complete data clear...');
    
    await clearIndexedDB();
    clearLocalStorage();
    clearCache();
    
    console.log('✅ All local data cleared successfully!');
    console.log('🔄 Please reload the page to complete the process');
    
    // Optionally reload the page
    // window.location.reload();
  } catch (error) {
    console.error('❌ Error clearing local data:', error);
    throw error;
  }
}

/**
 * Clear Firestore data (run this in browser console after importing Firebase)
 * This is a helper function - you'll need to run it manually in the console
 */
export const clearFirestoreDataScript = `
// Run this in browser console to clear Firestore data
// WARNING: This will delete ALL data in Firestore!

import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './src/firebase';

async function clearFirestore() {
  console.log('⚠️ WARNING: This will delete ALL Firestore data!');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds...');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const collections = [
    'shops',
    'CentralShopStaff',
    'CentralShopOrders',
    'CentralShopProducts',
    'CentralShopCustomers',
    'CentralShopSettings',
    'KamweneOrders',
    'KamweneProducts',
    'KamweneCustomers',
    'users'
  ];
  
  for (const collName of collections) {
    try {
      const snapshot = await getDocs(collection(db, collName));
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      console.log(\`✅ Cleared \${snapshot.size} documents from \${collName}\`);
    } catch (error) {
      console.error(\`❌ Error clearing \${collName}:\`, error);
    }
  }
  
  console.log('✅ Firestore data cleared!');
}

clearFirestore();
`;

