/**
 * Offline Sync Module
 * Handles syncing offline data to Firestore with Background Sync support
 */
import { collection, doc, setDoc, addDoc, updateDoc, deleteDoc, Timestamp, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { getShopCollectionName } from '../config/shopConfig';
import { db } from './db';
import { registerBackgroundSync } from '../utils/backgroundSync';

/**
 * Sync offline orders to Firestore
 * DISABLED: Orders should only be created through POS checkout, not automatically synced
 * This prevents automatic order creation for KamweneShop or any other shop
 */
export async function syncOfflineOrdersToFirebase(): Promise<{ synced: number; errors: number }> {
  // Orders are now only created through the POS checkout flow
  // This automatic sync has been disabled to prevent unwanted order creation
  console.log('Order sync disabled: Orders must be created through POS checkout only');
  return { synced: 0, errors: 0 };
}

/**
 * Sync products from Firestore to IndexedDB cache
 */
export async function syncProductsFromFirestore(): Promise<void> {
  if (!navigator.onLine) {
    console.log('Offline: Cannot sync products');
    return;
  }

  try {
    const productsCollection = getShopCollectionName('products');
    const q = query(collection(firestoreDb, productsCollection), orderBy('name'));
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
    console.log(`Synced ${products.length} products to cache`);
  } catch (error) {
    console.error('Error syncing products from Firestore:', error);
  }
}

/**
 * Sync customers from Firestore to IndexedDB cache
 */
export async function syncCustomersFromFirestore(): Promise<void> {
  if (!navigator.onLine) {
    console.log('Offline: Cannot sync customers');
    return;
  }

  try {
    const customersCollection = getShopCollectionName('customers');
    const q = query(collection(firestoreDb, customersCollection), orderBy('name'));
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
    console.log(`Synced ${customers.length} customers to cache`);
  } catch (error) {
    console.error('Error syncing customers from Firestore:', error);
  }
}

/**
 * Sync pending writes from IndexedDB to Firestore
 * Replays all queued write operations (add/update/delete)
 */
export async function syncPendingWrites(): Promise<{ synced: number; errors: number }> {
  if (!navigator.onLine) {
    console.log('Offline: Cannot sync pending writes');
    return { synced: 0, errors: 0 };
  }

  try {
    // Get all pending writes
    const pendingWrites = await db.pendingWrites
      .where('status')
      .equals('pending')
      .toArray();

    if (pendingWrites.length === 0) {
      return { synced: 0, errors: 0 };
    }

    let synced = 0;
    let errors = 0;

    for (const write of pendingWrites) {
      try {
        // Mark as syncing
        if (write.id) {
          await db.pendingWrites.update(write.id.toString(), { status: 'syncing' });
        }

        // Validate and fix collection path
        let collectionSegments = write.collection.split('/').filter(s => s);
        
        // For update/delete operations, check if collection path already includes the docId
        // This can happen with old writes that stored the full document path
        if ((write.type === 'update' || write.type === 'delete') && write.docId) {
          // If the last segment matches the docId, remove it (it's part of the document path, not collection)
          if (collectionSegments.length > 0 && collectionSegments[collectionSegments.length - 1] === write.docId) {
            collectionSegments = collectionSegments.slice(0, -1);
            console.warn(`Fixed collection path for write ${write.id}: removed duplicate docId`);
          }
          
          // Validate: collection path should have odd number of segments (1, 3, 5...)
          // After appending docId, document path should have even number (2, 4, 6...)
          if (collectionSegments.length % 2 === 0) {
            throw new Error(`Invalid collection path: ${write.collection} has even number of segments. Collections must have odd number of segments.`);
          }
        } else if (write.type === 'add') {
          // For add operations, collection path should have odd number of segments
          if (collectionSegments.length % 2 === 0 && collectionSegments.length > 0) {
            throw new Error(`Invalid collection path: ${write.collection} has even number of segments. Collections must have odd number of segments.`);
          }
        }

        // Execute the write operation based on type
        switch (write.type) {
          case 'add': {
            // For add operations, check if a duplicate already exists
            // This prevents creating multiple documents with the same data
            const collectionRef = collection(firestoreDb, ...collectionSegments);
            
            // Check for potential duplicates by querying for similar documents
            // Only check if the data has unique identifiers (like email, phone, etc.)
            let shouldCreate = true;
            if (write.data && typeof write.data === 'object') {
              // Check for customers with same phone/email
              if (write.data.phone || write.data.email) {
                const existingQuery = query(
                  collectionRef,
                  where(write.data.phone ? 'phone' : 'email', '==', write.data.phone || write.data.email)
                );
                const existingDocs = await getDocs(existingQuery);
                if (!existingDocs.empty) {
                  console.warn(`Skipping duplicate ${write.collection} write: document with ${write.data.phone ? 'phone' : 'email'} already exists`);
                  shouldCreate = false;
                }
              }
              // Check for products with same name/barcode
              else if (write.data.name && (write.data.barcode || write.data.name)) {
                const existingQuery = query(
                  collectionRef,
                  where(write.data.barcode ? 'barcode' : 'name', '==', write.data.barcode || write.data.name)
                );
                const existingDocs = await getDocs(existingQuery);
                if (!existingDocs.empty) {
                  console.warn(`Skipping duplicate ${write.collection} write: document with ${write.data.barcode ? 'barcode' : 'name'} already exists`);
                  shouldCreate = false;
                }
              }
            }
            
            if (shouldCreate) {
              await addDoc(collectionRef, write.data);
            } else {
              // Mark as synced even though we skipped it (to prevent retries)
              if (write.id) {
                await db.pendingWrites.delete(write.id.toString());
              }
              continue; // Skip to next write
            }
            break;
          }
          case 'update': {
            if (!write.docId) {
              throw new Error('docId is required for update operations');
            }
            const docRef = doc(firestoreDb, ...collectionSegments, write.docId);
            await updateDoc(docRef, write.data);
            break;
          }
          case 'delete': {
            if (!write.docId) {
              throw new Error('docId is required for delete operations');
            }
            const docRef = doc(firestoreDb, ...collectionSegments, write.docId);
            await deleteDoc(docRef);
            break;
          }
          default:
            throw new Error(`Unknown write type: ${write.type}`);
        }

        // Mark as synced and remove from queue IMMEDIATELY to prevent duplicates
        // This ensures the same write is never processed twice
        if (write.id) {
          await db.pendingWrites.delete(write.id.toString());
        }

        synced++;
        console.log(`Synced ${write.type} operation to ${write.collection}`);
      } catch (error: any) {
        console.error(`Error syncing write ${write.id}:`, error);
        errors++;

        // Update error status and increment retry count
        if (write.id) {
          const isPermissionError =
            error?.code === 'permission-denied' ||
            error?.message?.includes('Missing or insufficient permissions');

          // For permission errors, mark as error immediately to avoid endless retries
          const retryCount = isPermissionError ? 5 : (write.retryCount || 0) + 1;

          await db.pendingWrites.update(write.id.toString(), {
            status: retryCount >= 5 ? 'error' : 'pending', // Mark as error after 5 retries
            retryCount,
            error: error instanceof Error ? error.message : 'Sync failed'
          });
        }
      }
    }

    return { synced, errors };
  } catch (error) {
    console.error('Error syncing pending writes:', error);
    return { synced: 0, errors: 0 };
  }
}

/**
 * Sync all offline data
 */
export async function syncAllOfflineData(): Promise<{ synced: number; errors: number }> {
  // First sync pending writes
  const pendingResult = await syncPendingWrites();
  
  // Then sync other offline data
  const orderResult = await syncOfflineOrdersToFirebase();
  await syncProductsFromFirestore();
  await syncCustomersFromFirestore();
  
  return {
    synced: pendingResult.synced + orderResult.synced,
    errors: pendingResult.errors + orderResult.errors
  };
}

