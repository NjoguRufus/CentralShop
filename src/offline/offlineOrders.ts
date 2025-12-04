/**
 * Offline Orders Management
 * Handles queuing orders for sync when offline
 */
import { db, OfflineOrder } from './db';
import { collection, addDoc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { getShopCollectionName, BranchName } from '../config/shopConfig';

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

/**
 * Sync offline orders from IndexedDB local cache to the main Orders collection
 * for a specific branch. This is the shared engine used by both the Offline Orders
 * page and the Orders page "Sync Offline Orders" button.
 */
export async function syncOfflineOrdersForBranch(
  branch: BranchName
): Promise<{ syncedCount: number; errorCount: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Cannot sync while offline');
  }

  const ordersCollectionName = getShopCollectionName('orders', branch);
  const offlineOrdersCollection = `OfflineOrders${branch}`;

  // Load current cached offline orders (unsynced queue)
  const cacheKey = `offline-orders-${branch}`;
  const cached = await db.localCache.get(cacheKey);
  const cachedOrders: any[] = cached && Array.isArray(cached.data) ? cached.data : [];
  const pendingOrders = cachedOrders.filter((o: any) => !o.synced);

  let syncedCount = 0;
  let errorCount = 0;

  for (const order of pendingOrders) {
    try {
      // Basic validation
      if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
        errorCount++;
        continue;
      }
      if (order.total === undefined || order.total === null || order.total < 0) {
        errorCount++;
        continue;
      }
      if (!order.employeeId) {
        errorCount++;
        continue;
      }

      // Duplicate check within ±10 seconds for same employee/total
      try {
        let createdAtTimestamp: Timestamp | null = null;
        if (order.createdAt instanceof Timestamp) {
          createdAtTimestamp = order.createdAt;
        } else if (order.createdAt instanceof Date) {
          createdAtTimestamp = Timestamp.fromDate(order.createdAt);
        } else if (order.createdAt) {
          const parsed = new Date(order.createdAt);
          if (!isNaN(parsed.getTime())) {
            createdAtTimestamp = Timestamp.fromDate(parsed);
          }
        }

        if (createdAtTimestamp) {
          const baseDate = createdAtTimestamp.toDate();
          if (!isNaN(baseDate.getTime())) {
            const startTime = new Date(baseDate.getTime() - 10000);
            const endTime = new Date(baseDate.getTime() + 10000);

            const duplicateCheck = query(
              collection(firestoreDb, ordersCollectionName),
              where('employeeId', '==', order.employeeId),
              where('total', '==', order.total),
              where('createdAt', '>=', Timestamp.fromDate(startTime)),
              where('createdAt', '<=', Timestamp.fromDate(endTime))
            );

            const existing = await getDocs(duplicateCheck);
            if (!existing.empty) {
              // Duplicate already in main collection, skip
              continue;
            }
          }
        }
      } catch (duplicateError) {
        console.warn('Duplicate check failed (non-blocking):', duplicateError);
      }

      const createdAt =
        order.createdAt instanceof Timestamp
          ? order.createdAt
          : Timestamp.fromDate(
              order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt || new Date())
            );

      // Build order data for Firestore
      const orderData: any = {
        items: order.items,
        subtotal: order.subtotal || 0,
        tax: order.tax || 0,
        total: order.total,
        status: order.status || 'completed',
        paymentMethod: order.paymentMethod || 'cash',
        createdAt,
        employeeId: order.employeeId,
        customerName: order.customerName || 'Walk In Customer',
        shopName: order.shopName || branch,
        syncedFromOffline: true,
        syncedAt: Timestamp.now()
      };

      if (order.employeeName) orderData.employeeName = order.employeeName;
      if (order.customerPhone) orderData.customerPhone = order.customerPhone;
      if (order.customerEmail) orderData.customerEmail = order.customerEmail;
      if (order.customerId) orderData.customerId = order.customerId;

      await addDoc(collection(firestoreDb, ordersCollectionName), orderData);

      // Mark as synced in local cache (do not drop history)
      if (order.id) {
        const idx = cachedOrders.findIndex((o: any) => o.id === order.id);
        if (idx !== -1) {
          cachedOrders[idx] = {
            ...cachedOrders[idx],
            synced: true,
            syncedAt: new Date()
          };
        }
      }

      syncedCount++;
    } catch (error: any) {
      console.error('Error syncing offline order:', error);
      errorCount++;

      if (error?.code === 'resource-exhausted' || error?.message?.includes('Quota exceeded')) {
        break;
      }
    }
  }

  // Persist updated cache
  await db.localCache.put({
    id: cacheKey,
    collection: offlineOrdersCollection,
    data: cachedOrders,
    lastSynced: new Date()
  });

  return { syncedCount, errorCount };
}

