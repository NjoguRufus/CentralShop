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
 * DISABLED: Orders should only be created through POS checkout, not automatically synced
 * This prevents automatic order creation for KamweneShop or any other shop
 */
export async function syncOrdersToFirestore(): Promise<void> {
  // Orders are now only created through the POS checkout flow
  // This automatic sync has been disabled to prevent unwanted order creation
  console.log('Order sync disabled: Orders must be created through POS checkout only');
  return;
}

/**
 * Get pending orders count
 */
export async function getPendingOrdersCount(): Promise<number> {
  try {
    // Get all orders and filter for unsynced ones (handles undefined/null synced values)
    const allOrders = await db.orders.toArray();
    return allOrders.filter(order => order.synced !== true).length;
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

