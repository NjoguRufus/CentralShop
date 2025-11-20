/**
 * Offline Sync Module
 * Handles syncing offline data to Firestore
 */
import { collection, doc, setDoc, Timestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { getShopCollectionName } from '../config/shopConfig';
import { db } from './db';

/**
 * Sync offline orders to Firestore
 */
export async function syncOfflineOrdersToFirebase(): Promise<{ synced: number; errors: number }> {
  if (!navigator.onLine) {
    console.log('Offline: Cannot sync orders');
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
 * Sync all offline data
 */
export async function syncAllOfflineData(): Promise<{ synced: number; errors: number }> {
  const orderResult = await syncOfflineOrdersToFirebase();
  await syncProductsFromFirestore();
  await syncCustomersFromFirestore();
  
  return orderResult;
}

