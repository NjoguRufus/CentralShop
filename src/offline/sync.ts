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
/**
 * Clean up invalid order writes from the queue
 * Removes any order writes that don't have OFF- prefix (not from POS checkout)
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
        // Allow OfflineOrders collection writes - these are legitimate offline orders
        if (write.collection.includes('OfflineOrders')) {
          // This is a legitimate offline order - keep it
          continue;
        }
        
        // Check if this is a legitimate offline order from POS checkout in main orders collection
        const isOfflineOrder = write.docId && write.docId.startsWith('OFF-');
        
        if (!isOfflineOrder) {
          // This is NOT an offline order from POS checkout - remove it
          console.warn(`Cleaning up invalid order write ${write.id}: order ${write.docId || 'unknown'} is not from POS checkout`);
          if (write.id) {
            await db.pendingWrites.delete(write.id.toString());
            cleaned++;
          }
        }
      }
    }
    
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} invalid order writes from queue`);
    }
    
    return cleaned;
  } catch (error) {
    console.error('Error cleaning up invalid order writes:', error);
    return 0;
  }
}

export async function syncPendingWrites(): Promise<{ synced: number; errors: number }> {
  if (!navigator.onLine) {
    console.log('Offline: Cannot sync pending writes');
    return { synced: 0, errors: 0 };
  }

  try {
    // First, clean up any invalid order writes (orders without OFF- prefix)
    await cleanupInvalidOrderWrites();
    
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
        // Allow orders to sync - orders from POS checkout when offline should be synced when back online
        const collectionLower = write.collection.toLowerCase();
        
        // Skip any notifications writes - notifications should not be saved to Firestore
        if (collectionLower.includes('notifications') || collectionLower.includes('notification')) {
          console.warn(`Skipping notification write in pending queue: ${write.collection}. Notifications are local-only.`);
          // Delete the pending write to prevent retries
          if (write.id) {
            await db.pendingWrites.delete(write.id.toString());
          }
          continue;
        }
        
        // Skip employee_activities writes - automatic creation is disabled
        if (collectionLower.includes('employee_activities') || collectionLower.includes('employeeactivities')) {
          console.warn(`Skipping employee_activities write in pending queue: ${write.collection}. Employee activities are no longer automatically created.`);
          // Delete the pending write to prevent retries
          if (write.id) {
            await db.pendingWrites.delete(write.id.toString());
          }
          continue;
        }
        
        // Allow OfflineOrders collection writes - these are legitimate offline orders
        // Block automatic order creation in main orders collections - only allow orders with OFF- prefix (from offline POS checkout)
        if ((collectionLower.includes('orders') || collectionLower.includes('order')) && write.type === 'add') {
          // Allow writes to OfflineOrders collections (separate collection for offline orders)
          if (write.collection.includes('OfflineOrders')) {
            // This is a legitimate offline order - allow it to sync
            console.log(`Allowing OfflineOrders write: ${write.collection}`);
          } else {
            // Check if this is a legitimate offline order from POS checkout in main orders collection
            // Orders from POS checkout when offline have an OFF- prefix in their docId
            const isOfflineOrder = write.docId && write.docId.startsWith('OFF-');
            
            if (!isOfflineOrder) {
              // This is NOT an offline order from POS checkout - skip it immediately
              // Orders should ONLY be created through POS checkout, not automatically
              console.warn(`BLOCKED automatic order write: order ${write.docId || 'unknown'} is not from POS checkout. Orders must be created through POS checkout only. Removing from queue.`);
              // Delete immediately to prevent retries
              if (write.id) {
                await db.pendingWrites.delete(write.id.toString());
              }
              continue;
            }
          }
        }

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
              const collectionLower = write.collection.toLowerCase();
              
              // For orders, validate that it's a legitimate order from POS checkout
              // Only orders with OFF- prefix (from offline POS checkout) should be synced
              // Note: This check should already be done above, but keeping it here as a double-check
              if (collectionLower.includes('orders') || collectionLower.includes('order')) {
                // Check if this is a legitimate offline order from POS checkout
                // Orders from POS checkout when offline have an OFF- prefix in their docId
                const isOfflineOrder = write.docId && write.docId.startsWith('OFF-');
                
                if (!isOfflineOrder && write.type === 'add') {
                  // This is NOT an offline order from POS checkout - skip it
                  // Orders should ONLY be created through POS checkout, not automatically
                  console.warn(`BLOCKED automatic order write (double-check): order ${write.docId || 'unknown'} is not from POS checkout. Orders must be created through POS checkout only.`);
                  shouldCreate = false;
                  
                  // Remove from queue to prevent retries
                  if (write.id) {
                    await db.pendingWrites.delete(write.id.toString());
                  }
                  continue;
                }
                
                // Validate order has required fields per Firestore rules
                // Firestore rules require: items, subtotal, tax, total, status, paymentMethod, createdAt, employeeId
                const requiredFields = ['items', 'subtotal', 'tax', 'total', 'status', 'paymentMethod', 'createdAt', 'employeeId'];
                const missingFields = requiredFields.filter(field => {
                  if (field === 'items') {
                    return !write.data.items && !write.data.products;
                  }
                  return write.data[field] === undefined || write.data[field] === null;
                });
                
                if (missingFields.length > 0) {
                  console.warn(`Skipping invalid order write: order missing required fields: ${missingFields.join(', ')}`);
                  shouldCreate = false;
                } else {
                  // Ensure items array exists and is not empty (Firestore rule requirement)
                  const items = write.data.items || write.data.products || [];
                  if (!Array.isArray(items) || items.length === 0) {
                    console.warn(`Skipping invalid order write: order must have at least one item`);
                    shouldCreate = false;
                  } else {
                    // Validate total calculation (Firestore rule: total == subtotal + tax)
                    const subtotal = write.data.subtotal || 0;
                    const tax = write.data.tax || 0;
                    const total = write.data.total || 0;
                    if (Math.abs(total - (subtotal + tax)) > 0.01) { // Allow small floating point differences
                      console.warn(`Skipping invalid order write: total (${total}) does not equal subtotal (${subtotal}) + tax (${tax})`);
                      shouldCreate = false;
                    }
                  }
                }
                
                // Only proceed with duplicate check if order is valid
                if (!shouldCreate) {
                  if (write.id) {
                    await db.pendingWrites.delete(write.id.toString());
                  }
                  continue;
                }
                
                // For orders, check by multiple criteria to prevent duplicates
                // Check if an order with the same characteristics already exists
                // This prevents duplicate orders from being created
                if (write.data.createdAt && write.data.total !== undefined && write.data.employeeId) {
                  try {
                    const createdAt = write.data.createdAt;
                    const total = write.data.total;
                    const employeeId = write.data.employeeId;
                    
                    // Convert createdAt to Timestamp if needed
                    let createdAtTimestamp: Timestamp;
                    if (createdAt && typeof createdAt.toDate === 'function') {
                      createdAtTimestamp = createdAt;
                    } else if (createdAt instanceof Timestamp) {
                      createdAtTimestamp = createdAt;
                    } else {
                      createdAtTimestamp = Timestamp.fromDate(new Date(createdAt));
                    }
                    
                    // Build query to check for duplicate orders
                    // Check by employeeId, total, and createdAt (within 10 seconds) to catch duplicates
                    const startTime = new Date(createdAtTimestamp.toDate().getTime() - 10000);
                    const endTime = new Date(createdAtTimestamp.toDate().getTime() + 10000);
                    
                    // Check by employeeId and total (most reliable for duplicate detection)
                    const existingOrderQuery = query(
                      collectionRef,
                      where('employeeId', '==', employeeId),
                      where('total', '==', total),
                      where('createdAt', '>=', Timestamp.fromDate(startTime)),
                      where('createdAt', '<=', Timestamp.fromDate(endTime))
                    );
                    
                    const existingOrderDocs = await getDocs(existingOrderQuery);
                    
                    if (!existingOrderDocs.empty) {
                      console.warn(`Skipping duplicate order write: order with same employeeId (${employeeId}), total (${total}), and createdAt (within 10s) already exists`);
                      shouldCreate = false;
                    }
                  } catch (queryError: any) {
                    // If query fails (e.g., permission error), log but don't block the write
                    console.warn('Error checking for duplicate orders (non-blocking):', queryError);
                    // Continue with creation - better to have a potential duplicate than block legitimate orders
                  }
                }
              }
              // Check for customers with same phone/email
              else if (write.data.phone || write.data.email) {
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
            
            // Check if document exists before trying to update
            const { getDoc } = await import('firebase/firestore');
            const docSnapshot = await getDoc(docRef);
            if (!docSnapshot.exists()) {
              console.warn(`Skipping update to non-existent document: ${write.collection}/${write.docId}. Document does not exist.`);
              // Delete the pending write to prevent retries
              if (write.id) {
                await db.pendingWrites.delete(write.id.toString());
              }
              continue; // Skip to next write
            }
            
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
        
        // Handle specific error types that should be skipped immediately
        const isPermissionError =
          error?.code === 'permission-denied' ||
          error?.message?.includes('Missing or insufficient permissions');
        
        const isNotFoundError =
          error?.code === 'not-found' ||
          error?.message?.includes('No document to update') ||
          error?.message?.includes('No document to delete');
        
        if (isPermissionError || isNotFoundError) {
          // For Staff collection writes, check if it's a duplicate before skipping
          const collectionLower = write.collection.toLowerCase();
          if (isPermissionError && collectionLower.includes('staff') && write.type === 'add') {
            try {
              // Check if document already exists (might be a duplicate)
              const collectionRef = collection(firestoreDb, write.collection);
              if (write.data && write.data.uid) {
                const existingQuery = query(
                  collectionRef,
                  where('uid', '==', write.data.uid)
                );
                const existingDocs = await getDocs(existingQuery);
                if (!existingDocs.empty) {
                  console.warn(`Skipping duplicate Staff write: document with uid ${write.data.uid} already exists in ${write.collection}`);
                  // Mark as synced (duplicate, so it's effectively "done")
                  if (write.id) {
                    await db.pendingWrites.delete(write.id.toString());
                  }
                  continue;
                }
              }
            } catch (checkError) {
              // If duplicate check fails, proceed with normal error handling
              console.warn('Error checking for duplicate Staff document:', checkError);
            }
          }
          
          console.warn(`Skipping write ${write.id} to ${write.collection}: ${isPermissionError ? 'Permission denied' : 'Document not found'}. Removing from queue.`);
          // Delete immediately - these errors won't succeed on retry
          if (write.id) {
            await db.pendingWrites.delete(write.id.toString());
          }
          errors++;
          continue;
        }

        errors++;

        // Update error status and increment retry count for other errors
        if (write.id) {
          const retryCount = (write.retryCount || 0) + 1;

          await db.pendingWrites.update(write.id.toString(), {
            status: retryCount >= 5 ? 'error' : 'pending', // Mark as error after 5 retries
            retryCount,
            error: error instanceof Error ? error.message : 'Sync failed',
            lastErrorAt: new Date()
          });
          
          // Delete after too many retries
          if (retryCount > 5) {
            await db.pendingWrites.delete(write.id.toString());
            console.log(`Deleted write ${write.id} after ${retryCount} failed attempts`);
          }
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

