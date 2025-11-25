/**
 * Offline Products Management
 * Handles caching and syncing products from Firestore
 */
import { db, OfflineProduct } from './db';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { getShopCollectionName } from '../config/shopConfig';
import { getDefaultUnit } from '../constants/productUnits';

const DEFAULT_UNIT = getDefaultUnit();

/**
 * Save product to IndexedDB cache
 */
export async function saveProductOffline(product: OfflineProduct): Promise<void> {
  try {
    await db.products.put({
      ...product,
      lastSynced: new Date(),
      isDirty: false
    });
  } catch (error) {
    console.error('Error saving product offline:', error);
    throw error;
  }
}

/**
 * Save multiple products to IndexedDB cache
 */
export async function saveProductsOffline(products: OfflineProduct[]): Promise<void> {
  try {
    await db.products.bulkPut(
      products.map(p => ({
        ...p,
        lastSynced: new Date(),
        isDirty: false
      }))
    );
  } catch (error) {
    console.error('Error saving products offline:', error);
    throw error;
  }
}

/**
 * Load cached products from IndexedDB
 */
export async function loadCachedProducts(): Promise<OfflineProduct[]> {
  try {
    return await db.products.toArray();
  } catch (error) {
    console.error('Error loading cached products:', error);
    return [];
  }
}

/**
 * Sync products from Firestore to IndexedDB
 */
export async function syncProductsFromFirestore(): Promise<void> {
  try {
    const productsCollection = getShopCollectionName('products');
    const q = query(collection(firestoreDb, productsCollection), orderBy('name'));
    const snapshot = await getDocs(q);
    
    const products: OfflineProduct[] = [];
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
        unit: data.unit || DEFAULT_UNIT,
        requireMeasurement: data.requireMeasurement || false,
        measurementLabel: data.measurementLabel || '',
        lastSynced: new Date(),
        isDirty: false
      });
    });
    
    await saveProductsOffline(products);
  } catch (error) {
    console.error('Error syncing products from Firestore:', error);
    throw error;
  }
}

/**
 * Get product by ID (checks cache first, then Firestore if online)
 */
export async function getProductById(productId: string): Promise<OfflineProduct | null> {
  try {
    // Try cache first
    const cached = await db.products.get(productId);
    if (cached) {
      return cached;
    }
    
    // If online, try Firestore
    if (navigator.onLine) {
      const productsCollection = getShopCollectionName('products');
      const docRef = await import('firebase/firestore').then(m => 
        m.getDoc(m.doc(firestoreDb, productsCollection, productId))
      );
      
      if (docRef.exists()) {
        const data = docRef.data();
        const product: OfflineProduct = {
          id: docRef.id,
          name: data.name || '',
          price: data.price || 0,
          stock: data.stock || 0,
          category: data.category || '',
          image: data.image || '',
          barcode: data.barcode || '',
          description: data.description || '',
          unit: data.unit || DEFAULT_UNIT,
          requireMeasurement: data.requireMeasurement || false,
          measurementLabel: data.measurementLabel || '',
          lastSynced: new Date(),
          isDirty: false
        };
        await saveProductOffline(product);
        return product;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting product:', error);
    return null;
  }
}

/**
 * Update product stock offline
 */
export async function updateProductStockOffline(productId: string, newStock: number): Promise<void> {
  try {
    const product = await db.products.get(productId);
    if (product) {
      await db.products.update(productId, {
        stock: newStock,
        isDirty: true
      });
    }
  } catch (error) {
    console.error('Error updating product stock offline:', error);
    throw error;
  }
}

