/**
 * Offline Orders Management
 * Handles queuing orders for sync when offline
 */
import { db, OfflineOrder } from './db';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { getShopCollectionName } from '../config/shopConfig';

/**
 * Save order offline (queue for sync)
 */
export async function saveOrderOffline(order: Omit<OfflineOrder, 'id' | 'synced'>): Promise<string> {
  try {
    const orderId = await db.orders.add({
      ...order,
      synced: false,
      createdAt: order.createdAt || new Date()
    });
    
    // Add to sync queue
    await db.syncQueue.add({
      type: 'order',
      data: { ...order, id: orderId.toString() },
      timestamp: new Date()
    });
    
    return orderId.toString();
  } catch (error) {
    console.error('Error saving order offline:', error);
    throw error;
  }
}

/**
 * Queue order for sync
 */
export async function queueOrderForSync(order: OfflineOrder): Promise<void> {
  try {
    await db.syncQueue.add({
      type: 'order',
      data: order,
      timestamp: new Date()
    });
    
    // Mark order as not synced
    if (order.id) {
      await db.orders.update(order.id, { synced: false });
    }
  } catch (error) {
    console.error('Error queueing order for sync:', error);
    throw error;
  }
}

/**
 * Sync orders to Firestore
 */
export async function syncOrdersToFirestore(): Promise<void> {
  try {
    if (!navigator.onLine) {
      console.log('Offline: Cannot sync orders');
      return;
    }
    
    const unsyncedOrders = await db.orders.where('synced').equals(false).toArray();
    const ordersCollection = getShopCollectionName('orders');
    
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
        
        await addDoc(collection(firestoreDb, ordersCollection), firestoreOrder);
        
        // Mark as synced
        if (order.id) {
          await db.orders.update(order.id, { synced: true });
        }
        
        // Remove from sync queue
        const queueItem = await db.syncQueue.where('type').equals('order').first();
        if (queueItem?.id) {
          await db.syncQueue.delete(queueItem.id);
        }
      } catch (error) {
        console.error(`Error syncing order ${order.id}:`, error);
        if (order.id) {
          await db.orders.update(order.id, {
            synced: false,
            syncError: error instanceof Error ? error.message : 'Sync failed'
          });
        }
      }
    }
  } catch (error) {
    console.error('Error syncing orders to Firestore:', error);
    throw error;
  }
}

/**
 * Get pending orders count
 */
export async function getPendingOrdersCount(): Promise<number> {
  try {
    return await db.orders.where('synced').equals(false).count();
  } catch (error) {
    console.error('Error getting pending orders count:', error);
    return 0;
  }
}

/**
 * Get all orders (synced and unsynced)
 */
export async function getAllOfflineOrders(): Promise<OfflineOrder[]> {
  try {
    return await db.orders.orderBy('createdAt').reverse().toArray();
  } catch (error) {
    console.error('Error getting offline orders:', error);
    return [];
  }
}

