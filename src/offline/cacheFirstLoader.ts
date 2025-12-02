/**
 * Cache-First Data Loader
 * Loads data from IndexedDB cache first, then syncs from Firestore when online
 */
import { db, LocalCache } from './db';
import { collection, getDocs, query, orderBy, where, limit, Timestamp } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { getShopCollectionName, BranchName } from '../config/shopConfig';

/**
 * Generic cache-first loader
 * Loads from IndexedDB first, then syncs from Firestore if online
 */
export async function loadDataCacheFirst<T>(
  cacheKey: string,
  collectionName: string,
  branch?: BranchName,
  transformFn?: (data: any) => T[]
): Promise<T[]> {
  try {
    // Try to load from cache first
    const cached = await db.localCache.get(cacheKey);
    if (cached && cached.data) {
      console.log(`Loaded ${cacheKey} from cache (${Array.isArray(cached.data) ? cached.data.length : 'N/A'} items)`);
      
      // Return cached data immediately
      const cachedData = Array.isArray(cached.data) ? cached.data : [];
      
      // If online, sync in background (don't wait)
      if (navigator.onLine) {
        syncDataToCache(cacheKey, collectionName, branch, transformFn).catch(console.error);
      }
      
      return cachedData as T[];
    }
    
    // If no cache and online, fetch from Firestore
    if (navigator.onLine) {
      return await syncDataToCache(cacheKey, collectionName, branch, transformFn);
    }
    
    // Offline and no cache - return empty array
    console.warn(`No cache available for ${cacheKey} and offline`);
    return [];
  } catch (error) {
    console.error(`Error loading ${cacheKey}:`, error);
    // Try to return cached data even if sync fails
    try {
      const cached = await db.localCache.get(cacheKey);
      if (cached && cached.data) {
        return Array.isArray(cached.data) ? (cached.data as T[]) : [];
      }
    } catch (e) {
      console.error('Error loading from cache fallback:', e);
    }
    return [];
  }
}

/**
 * Sync data from Firestore to cache
 */
async function syncDataToCache<T>(
  cacheKey: string,
  collectionName: string,
  branch?: BranchName,
  transformFn?: (data: any) => T[]
): Promise<T[]> {
  try {
    if (!navigator.onLine) {
      console.log(`Cannot sync ${cacheKey} - offline`);
      return [];
    }

    const fullCollectionName = getShopCollectionName(collectionName, branch);
    const q = query(collection(firestoreDb, fullCollectionName), orderBy('name'));
    const snapshot = await getDocs(q);
    
    const data: T[] = [];
    snapshot.forEach((doc) => {
      const docData = doc.data();
      if (transformFn) {
        const transformed = transformFn({ id: doc.id, ...docData });
        data.push(...transformed);
      } else {
        data.push({ id: doc.id, ...docData } as T);
      }
    });
    
    // Save to cache
    await db.localCache.put({
      id: cacheKey,
      collection: fullCollectionName,
      data,
      lastSynced: new Date()
    });
    
    console.log(`Synced ${data.length} items for ${cacheKey} to cache`);
    return data;
  } catch (error) {
    console.error(`Error syncing ${cacheKey} to cache:`, error);
    // Return cached data if sync fails
    try {
      const cached = await db.localCache.get(cacheKey);
      if (cached && cached.data) {
        return Array.isArray(cached.data) ? (cached.data as T[]) : [];
      }
    } catch (e) {
      // Ignore cache read errors
    }
    return [];
  }
}

/**
 * Load products with cache-first strategy
 */
export async function loadProductsCacheFirst(branch?: BranchName): Promise<any[]> {
  return loadDataCacheFirst(
    `products-${branch || 'default'}`,
    'products',
    branch,
    (data) => {
      const DEFAULT_UNIT = 'pieces';
      return [{
        id: data.id,
        ...data,
        unit: data.unit || DEFAULT_UNIT,
        requireMeasurement: data.requireMeasurement || false,
        measurementLabel: data.measurementLabel || '',
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date())
      }];
    }
  );
}

/**
 * Load orders with cache-first strategy
 */
export async function loadOrdersCacheFirst(branch?: BranchName, employeeId?: string): Promise<any[]> {
  const cacheKey = `orders-${branch || 'default'}${employeeId ? `-${employeeId}` : ''}`;
  
  try {
    // Try cache first
    const cached = await db.localCache.get(cacheKey);
    if (cached && cached.data) {
      console.log(`Loaded orders from cache (${Array.isArray(cached.data) ? cached.data.length : 'N/A'} items)`);
      
      const cachedData = Array.isArray(cached.data) ? cached.data : [];
      
      // Sync in background if online
      if (navigator.onLine) {
        syncOrdersToCache(cacheKey, branch, employeeId).catch(console.error);
      }
      
      return cachedData;
    }
    
    // If online, fetch from Firestore
    if (navigator.onLine) {
      return await syncOrdersToCache(cacheKey, branch, employeeId);
    }
    
    return [];
  } catch (error) {
    console.error('Error loading orders:', error);
    return [];
  }
}

async function syncOrdersToCache(cacheKey: string, branch?: BranchName, employeeId?: string): Promise<any[]> {
  try {
    if (!navigator.onLine) return [];
    
    const ordersCollectionName = getShopCollectionName('orders', branch);
    let q;
    
    if (employeeId) {
      q = query(
        collection(firestoreDb, ordersCollectionName),
        where('employeeId', '==', employeeId),
        orderBy('createdAt', 'desc'),
        limit(300) // limit to most recent orders for this employee
      );
    } else {
      q = query(
        collection(firestoreDb, ordersCollectionName),
        orderBy('createdAt', 'desc'),
        limit(500) // limit to most recent orders per branch to keep loads fast
      );
    }
    
    const snapshot = await getDocs(q);
    const orders: any[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      orders.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        date: data.createdAt?.toDate ? data.createdAt.toDate().toISOString().split('T')[0] : (data.date || new Date().toISOString().split('T')[0])
      });
    });
    
    await db.localCache.put({
      id: cacheKey,
      collection: ordersCollectionName,
      data: orders,
      lastSynced: new Date()
    });
    
    console.log(`Synced ${orders.length} orders to cache`);
    return orders;
  } catch (error) {
    console.error('Error syncing orders:', error);
    return [];
  }
}

/**
 * Load customers with cache-first strategy
 */
export async function loadCustomersCacheFirst(branch?: BranchName): Promise<any[]> {
  return loadDataCacheFirst(
    `customers-${branch || 'default'}`,
    'customers',
    branch
  );
}

/**
 * Load categories with cache-first strategy
 */
export async function loadCategoriesCacheFirst(branch?: BranchName): Promise<any[]> {
  return loadDataCacheFirst(
    `categories-${branch || 'default'}`,
    'productCategories',
    branch,
    (data) => [{
      id: data.id,
      name: data.name
    }]
  );
}

/**
 * Load invoices with cache-first strategy
 */
export async function loadInvoicesCacheFirst(branch?: BranchName): Promise<any[]> {
  return loadDataCacheFirst(
    `invoices-${branch || 'default'}`,
    'invoices',
    branch,
    (data) => [{
      id: data.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
      dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : (data.dueDate || new Date()),
      paidDate: data.paidDate?.toDate ? data.paidDate.toDate() : data.paidDate
    }]
  );
}

/**
 * Load suppliers with cache-first strategy
 */
export async function loadSuppliersCacheFirst(branch?: BranchName): Promise<any[]> {
  return loadDataCacheFirst(
    `suppliers-${branch || 'default'}`,
    'suppliers',
    branch
  );
}

/**
 * Load expenses with cache-first strategy
 */
export async function loadExpensesCacheFirst(shopId: string): Promise<any[]> {
  return loadDataCacheFirst(
    `expenses-${shopId}`,
    `shops/${shopId}/expenses`,
    undefined
  );
}

/**
 * Clear cache for a specific key
 */
export async function clearCache(cacheKey: string): Promise<void> {
  try {
    await db.localCache.delete(cacheKey);
  } catch (error) {
    console.error(`Error clearing cache for ${cacheKey}:`, error);
  }
}

/**
 * Clear all caches
 */
export async function clearAllCaches(): Promise<void> {
  try {
    await db.localCache.clear();
  } catch (error) {
    console.error('Error clearing all caches:', error);
  }
}

