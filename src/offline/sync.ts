/**
 * Offline Sync Module
 * SAFE + INTELLIGENT OFFLINE SYNC SYSTEM
 * - Controlled syncing (no spamming Firebase)
 * - No intervals or loops
 * - Sync only real pending writes
 * - Sync once per online event
 * - Automatic cleanup of invalid queue entries
 * - Never re-sync already synced data
 */
import { collection, doc, addDoc, updateDoc, deleteDoc, Timestamp, getDocs, query, where, getDoc } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { getShopCollectionName } from '../config/shopConfig';
import { db } from './db';

// Global sync lock to prevent double-sync
let isSyncing = false;

// Debug logging helper (only in development)
const isDevelopment = import.meta.env.DEV;
function logSync(...args: any[]): void {
  if (isDevelopment) {
    console.log('[SYNC]', ...args);
  }
}

/**
 * Clean up broken/invalid sync entries from the queue
 * Removes entries that are missing required fields
 */
export async function cleanBrokenSyncEntries(): Promise<number> {
  try {
    logSync('Cleaning up broken sync entries...');
    const queue = await db.pendingWrites.toArray();
    let cleaned = 0;
    
    for (const item of queue) {
      // Validate entry has required fields
      if (!item || !item.data || !item.collection || !item.type) {
        logSync('Deleting invalid entry:', item);
        if (item.id) {
          await db.pendingWrites.delete(item.id.toString());
          cleaned++;
        }
        continue;
      }
      
      // Remove entries that are already synced
      if (item.status === 'synced' || item.synced === true) {
        logSync('Deleting already synced entry:', item.id);
        if (item.id) {
          await db.pendingWrites.delete(item.id.toString());
          cleaned++;
        }
        continue;
      }
    }
    
    if (cleaned > 0) {
      logSync(`Cleaned up ${cleaned} broken/invalid sync entries`);
    }
    
    return cleaned;
  } catch (error) {
    console.error('Error cleaning broken sync entries:', error);
    return 0;
  }
}

/**
 * Clean up invalid order writes from the queue
 * Removes any order writes to main orders collections (should only go to OfflineOrders)
 */
async function cleanupInvalidOrderWrites(): Promise<number> {
  try {
    const allPendingWrites = await db.pendingWrites
      .where('status')
      .anyOf(['pending', 'syncing', 'error'])
      .toArray();
    
    let cleaned = 0;
    for (const write of allPendingWrites) {
      const collectionLower = write.collection.toLowerCase();
      if ((collectionLower.includes('orders') || collectionLower.includes('order')) && write.type === 'add') {
        // We no longer sync ANY orders (including OfflineOrders) via pendingWrites
        // Orders must be handled by the dedicated offlineOrders → syncHistory pipeline
        logSync(`Cleaning up invalid order write: ${write.collection} (orders are not synced via pendingWrites)`);
        if (write.id) {
          await db.pendingWrites.delete(write.id.toString());
          cleaned++;
        }
      }
    }
    
    if (cleaned > 0) {
      logSync(`Cleaned up ${cleaned} invalid order writes from queue`);
    }
    
    return cleaned;
  } catch (error) {
    console.error('Error cleaning up invalid order writes:', error);
    return 0;
  }
}

/**
 * Sync pending writes from IndexedDB to Firestore
 * SAFE VERSION: Only syncs valid, unsynced entries once
 */
export async function syncPendingWrites(): Promise<{ synced: number; errors: number }> {
  // Check sync lock
  if (isSyncing) {
    logSync('Sync already in progress, skipping...');
    return { synced: 0, errors: 0 };
  }
  
  // Check if online
  if (!navigator.onLine) {
    logSync('Offline: Cannot sync pending writes');
    return { synced: 0, errors: 0 };
  }
  
  // Set sync lock
  isSyncing = true;
  
  try {
    logSync('Sync starting...');
    
    // Step 1: Clean up broken entries
    await cleanBrokenSyncEntries();
    await cleanupInvalidOrderWrites();
    
    // Step 2: Fetch pending entries (only unsynced)
    const queue = await db.pendingWrites
      .where('status')
      .equals('pending')
      .toArray();
    
    if (!queue || queue.length === 0) {
      logSync('No pending writes to sync');
      isSyncing = false;
      return { synced: 0, errors: 0 };
    }
    
    logSync(`Queue size: ${queue.length}`);
    
    let synced = 0;
    let errors = 0;
    
    // Step 3: Process each entry once
    for (const write of queue) {
      try {
        // Validate entry before syncing
        if (!write || !write.data || !write.collection || !write.type) {
          logSync('Invalid pending write. Deleting:', write);
          if (write.id) {
            await db.pendingWrites.delete(write.id.toString());
          }
          continue;
        }
        
        // Skip if already synced
        if (write.status === 'synced' || write.synced === true) {
          logSync('Skipping already synced entry:', write.id);
          if (write.id) {
            await db.pendingWrites.delete(write.id.toString());
          }
          continue;
        }
        
        // Mark as syncing
        if (write.id) {
          await db.pendingWrites.update(write.id.toString(), { status: 'syncing' });
        }
        
        // Block automatic syncing for ANY orders via pendingWrites
        // Orders (including OfflineOrders) must be handled by the dedicated offlineOrders → syncHistory pipeline
        const collectionLower = write.collection.toLowerCase();
        
        // Skip notifications (local-only)
        if (collectionLower.includes('notifications') || collectionLower.includes('notification')) {
          logSync(`Skipping notification write: ${write.collection} (local-only)`);
          if (write.id) {
            await db.pendingWrites.delete(write.id.toString());
          }
          continue;
        }
        
        // Skip employee_activities (disabled)
        if (collectionLower.includes('employee_activities') || collectionLower.includes('employeeactivities')) {
          logSync(`Skipping employee_activities write: ${write.collection} (disabled)`);
          if (write.id) {
            await db.pendingWrites.delete(write.id.toString());
          }
          continue;
        }
        
        // Completely block ANY order writes from pendingWrites (including OfflineOrders)
        // This prevents duplicate order creation and quota spikes
        if ((collectionLower.includes('orders') || collectionLower.includes('order')) && write.type === 'add') {
          logSync(`BLOCKED: Attempted to sync order via pendingWrites: ${write.collection}. Orders are handled by offlineOrders → syncHistory pipeline.`);
          if (write.id) {
            await db.pendingWrites.delete(write.id.toString());
          }
          continue;
        }
        
        // Validate and fix collection path
        let collectionSegments = write.collection.split('/').filter(s => s);
        
        // For update/delete operations, validate docId exists
        if ((write.type === 'update' || write.type === 'delete') && write.docId) {
          // If the last segment matches the docId, remove it
          if (collectionSegments.length > 0 && collectionSegments[collectionSegments.length - 1] === write.docId) {
            collectionSegments = collectionSegments.slice(0, -1);
          }
          
          // Validate collection path has odd number of segments
          if (collectionSegments.length % 2 === 0) {
            throw new Error(`Invalid collection path: ${write.collection} has even number of segments`);
          }
        } else if (write.type === 'add') {
          // For add operations, collection path should have odd number of segments
          if (collectionSegments.length % 2 === 0 && collectionSegments.length > 0) {
            throw new Error(`Invalid collection path: ${write.collection} has even number of segments`);
          }
        }
        
        // Execute the write operation
        switch (write.type) {
          case 'add': {
            const collectionRef = collection(firestoreDb, ...collectionSegments);
            
            // Validate order data if it's an order
            if (write.collection.includes('Orders') || write.collection.includes('Order')) {
              if (!write.data.items || !Array.isArray(write.data.items) || write.data.items.length === 0) {
                logSync('Skipping invalid order: missing or empty items');
                if (write.id) {
                  await db.pendingWrites.delete(write.id.toString());
                }
                continue;
              }
              
              // Validate total calculation
              const subtotal = write.data.subtotal || 0;
              const tax = write.data.tax || 0;
              const total = write.data.total || 0;
              if (Math.abs(total - (subtotal + tax)) > 0.01) {
                logSync(`Skipping invalid order: total mismatch (${total} != ${subtotal + tax})`);
                if (write.id) {
                  await db.pendingWrites.delete(write.id.toString());
                }
                continue;
              }
            }
            
            // Add document to Firestore
            await addDoc(collectionRef, write.data);
            logSync(`Synced add operation to ${write.collection}`);
            break;
          }
          
          case 'update': {
            if (!write.docId) {
              throw new Error('docId is required for update operations');
            }
            
            const docRef = doc(firestoreDb, ...collectionSegments, write.docId);
            
            // Check if document exists
            const docSnapshot = await getDoc(docRef);
            if (!docSnapshot.exists()) {
              logSync(`Skipping update to non-existent document: ${write.collection}/${write.docId}`);
              if (write.id) {
                await db.pendingWrites.delete(write.id.toString());
              }
              continue;
            }
            
            await updateDoc(docRef, write.data);
            logSync(`Synced update operation to ${write.collection}/${write.docId}`);
            break;
          }
          
          case 'delete': {
            if (!write.docId) {
              throw new Error('docId is required for delete operations');
            }
            
            const docRef = doc(firestoreDb, ...collectionSegments, write.docId);
            await deleteDoc(docRef);
            logSync(`Synced delete operation to ${write.collection}/${write.docId}`);
            break;
          }
          
          default:
            logSync(`Unknown write type: ${write.type}`);
            if (write.id) {
              await db.pendingWrites.delete(write.id.toString());
            }
            continue;
        }
        
        // Delete from queue after successful sync (DO NOT re-write)
        if (write.id) {
          await db.pendingWrites.delete(write.id.toString());
        }
        
        synced++;
      } catch (error: any) {
        console.error(`Error syncing write ${write.id}:`, error);
        errors++;
        
        // Mark as error (but keep in queue for manual retry)
        if (write.id) {
          await db.pendingWrites.update(write.id.toString(), {
            status: 'error',
            error: error.message || 'Unknown error',
            retryCount: (write.retryCount || 0) + 1
          });
        }
        
        // If permission denied or not found, remove from queue
        if (error.code === 'permission-denied' || error.code === 'not-found') {
          logSync(`Removing ${error.code} write from queue: ${write.id}`);
          if (write.id) {
            await db.pendingWrites.delete(write.id.toString());
          }
        }
      }
    }
    
    logSync(`Sync complete: ${synced} synced, ${errors} errors`);
    return { synced, errors };
  } catch (error) {
    console.error('Error during syncPendingWrites:', error);
    return { synced: 0, errors: 0 };
  } finally {
    // Always release sync lock
    isSyncing = false;
  }
}

/**
 * Sync offline orders to Firestore
 * DISABLED: Orders should only be created through POS checkout
 */
export async function syncOfflineOrdersToFirebase(): Promise<{ synced: number; errors: number }> {
  logSync('Order sync disabled: Orders must be created through POS checkout only');
  return { synced: 0, errors: 0 };
}

/**
 * Sync products from Firestore to IndexedDB cache (read-only)
 */
export async function syncProductsFromFirestore(): Promise<void> {
  if (!navigator.onLine) {
    return;
  }

  try {
    const productsCollection = getShopCollectionName('products');
    const q = query(collection(firestoreDb, productsCollection));
    const snapshot = await getDocs(q);
    
    const products = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      products.push({
        id: doc.id,
        name: data.name || '',
        price: data.price || 0,
        stock: data.stock || 0,
        category: data.category || '',
        image: data.image || '',
        barcode: data.barcode || '',
        description: data.description || '',
        lastSynced: new Date(),
        isDirty: false
      });
    });
    
    await db.products.bulkPut(products);
    logSync(`Synced ${products.length} products to cache`);
  } catch (error) {
    console.error('Error syncing products from Firestore:', error);
  }
}

/**
 * Sync customers from Firestore to IndexedDB cache (read-only)
 */
export async function syncCustomersFromFirestore(): Promise<void> {
  if (!navigator.onLine) {
    return;
  }

  try {
    const customersCollection = getShopCollectionName('customers');
    const q = query(collection(firestoreDb, customersCollection));
    const snapshot = await getDocs(q);
    
    const customers = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      customers.push({
        id: doc.id,
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        lastSynced: new Date(),
        isDirty: false
      });
    });
    
    await db.customers.bulkPut(customers);
    logSync(`Synced ${customers.length} customers to cache`);
  } catch (error) {
    console.error('Error syncing customers from Firestore:', error);
  }
}

/**
 * Sync settings from Firestore to IndexedDB cache (read-only)
 */
export async function syncSettingsFromFirestore(): Promise<void> {
  if (!navigator.onLine) {
    return;
  }

  try {
    const settingsCollection = getShopCollectionName('settings');
    const snapshot = await getDocs(collection(firestoreDb, settingsCollection));
    
    const settings = [];
    snapshot.forEach((doc) => {
      settings.push({
        id: doc.id,
        ...doc.data(),
        lastSynced: new Date(),
        isDirty: false
      });
    });
    
    await db.settings.bulkPut(settings);
    logSync(`Synced ${settings.length} settings to cache`);
  } catch (error) {
    console.error('Error syncing settings from Firestore:', error);
  }
}

/**
 * Sync all data from Firestore to IndexedDB (read-only caching)
 */
export async function syncAllFromFirestore(): Promise<void> {
  if (!navigator.onLine) {
    return;
  }
  
  try {
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
 * Legacy function - redirects to syncPendingWrites
 */
export async function syncAllOfflineData(): Promise<{ synced: number; errors: number }> {
  return syncPendingWrites();
}
