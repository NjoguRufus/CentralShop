/**
 * Offline Sync Module
 * Handles syncing offline data to Firestore with Background Sync support
 */
import { collection, doc, setDoc, addDoc, updateDoc, deleteDoc, Timestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { getShopCollectionName } from '../config/shopConfig';
import { db } from './db';
import { registerBackgroundSync } from '../utils/backgroundSync';

/**
 * Sync offline orders to Firestore
 */
export async function syncOfflineOrdersToFirebase(): Promise<{ synced: number; errors: number }> {
  if (!navigator.onLine) {
    console.log('Offline: Registering background sync for orders');
    // Register background sync for when connection is restored
    await registerBackgroundSync('sync-orders');
    return { synced: 0, errors: 0 };
  }

  try {
    // Get all orders and filter for unsynced ones (handles undefined/null synced values)
    const allOrders = await db.orders.toArray();
    const unsyncedOrders = allOrders.filter(order => order.synced !== true);
    const ordersCollection = getShopCollectionName('orders');
    
    let synced = 0;
    let errors = 0;

    for (const order of unsyncedOrders) {
      try {
        // Convert to Firestore format
        const firestoreOrder = {
          customerId: order.customerId,
          items: order.items,
          subtotal: order.subtotal,
          tax: order.tax,
          total: order.total,
          status: order.status,
          paymentMethod: order.paymentMethod,
          createdAt: Timestamp.fromDate(order.createdAt),
          employeeId: order.employeeId,
          employeeName: order.employeeName,
          category: 'multiple' // Default category
        };

        // Use order ID if available, otherwise generate new doc
        const orderRef = order.id 
          ? doc(firestoreDb, ordersCollection, order.id.toString())
          : doc(collection(firestoreDb, ordersCollection));

        await setDoc(orderRef, firestoreOrder);

        // Mark as synced
        if (order.id) {
          await db.orders.update(order.id.toString(), { 
            synced: true,
            syncError: undefined
          });
        }

        synced++;
      } catch (error) {
        console.error(`Error syncing order ${order.id}:`, error);
        errors++;
        
        // Update error message
        if (order.id) {
          await db.orders.update(order.id.toString(), {
            syncError: error instanceof Error ? error.message : 'Sync failed'
          });
        }
      }
    }

    return { synced, errors };
  } catch (error) {
    console.error('Error syncing offline orders:', error);
    return { synced: 0, errors: 0 };
  }
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

        // Execute the write operation based on type
        switch (write.type) {
          case 'add': {
            const collectionRef = collection(firestoreDb, write.collection);
            await addDoc(collectionRef, write.data);
            break;
          }
          case 'update': {
            if (!write.docId) {
              throw new Error('docId is required for update operations');
            }
            const docRef = doc(firestoreDb, write.collection, write.docId);
            await updateDoc(docRef, write.data);
            break;
          }
          case 'delete': {
            if (!write.docId) {
              throw new Error('docId is required for delete operations');
            }
            const docRef = doc(firestoreDb, write.collection, write.docId);
            await deleteDoc(docRef);
            break;
          }
          default:
            throw new Error(`Unknown write type: ${write.type}`);
        }

        // Mark as synced and remove from queue
        if (write.id) {
          await db.pendingWrites.delete(write.id.toString());
        }

        synced++;
        console.log(`Synced ${write.type} operation to ${write.collection}`);
      } catch (error) {
        console.error(`Error syncing write ${write.id}:`, error);
        errors++;

        // Update error status and increment retry count
        if (write.id) {
          const retryCount = (write.retryCount || 0) + 1;
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

