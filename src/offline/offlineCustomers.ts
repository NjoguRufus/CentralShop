/**
 * Offline Customers Management
 * Handles caching and syncing customers
 */
import { db, OfflineCustomer } from './db';
import { collection, getDocs, query, orderBy, addDoc } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { getShopCollectionName } from '../config/shopConfig';

/**
 * Save customer offline
 */
export async function saveCustomerOffline(customer: OfflineCustomer): Promise<void> {
  try {
    await db.customers.put({
      ...customer,
      lastSynced: new Date(),
      isDirty: false
    });
  } catch (error) {
    console.error('Error saving customer offline:', error);
    throw error;
  }
}

/**
 * Load cached customers from IndexedDB
 */
export async function loadCachedCustomers(): Promise<OfflineCustomer[]> {
  try {
    return await db.customers.toArray();
  } catch (error) {
    console.error('Error loading cached customers:', error);
    return [];
  }
}

/**
 * Sync customers from Firestore to IndexedDB
 */
export async function syncCustomersFromFirestore(): Promise<void> {
  try {
    const customersCollection = getShopCollectionName('customers');
    const q = query(collection(firestoreDb, customersCollection), orderBy('name'));
    const snapshot = await getDocs(q);
    
    const customers: OfflineCustomer[] = [];
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
  } catch (error) {
    console.error('Error syncing customers from Firestore:', error);
    throw error;
  }
}

/**
 * Get customer by phone (checks cache first)
 */
export async function getCustomerByPhone(phone: string): Promise<OfflineCustomer | null> {
  try {
    const customer = await db.customers.where('phone').equals(phone).first();
    return customer || null;
  } catch (error) {
    console.error('Error getting customer by phone:', error);
    return null;
  }
}

/**
 * Create customer offline (will sync when online)
 */
export async function createCustomerOffline(customer: Omit<OfflineCustomer, 'id' | 'lastSynced' | 'isDirty'>): Promise<string> {
  try {
    const customerId = await db.customers.add({
      ...customer,
      lastSynced: new Date(),
      isDirty: true
    });
    
    // Add to sync queue
    await db.syncQueue.add({
      type: 'customer',
      data: { ...customer, id: customerId.toString() },
      timestamp: new Date()
    });
    
    return customerId.toString();
  } catch (error) {
    console.error('Error creating customer offline:', error);
    throw error;
  }
}

/**
 * Sync dirty customers to Firestore
 * DISABLED: Customers should only be created through manual user input, not automatically synced
 * This prevents automatic customer creation and duplicate documents
 */
export async function syncCustomersToFirestore(): Promise<void> {
  // Customers are now only created through manual user input in the Customers page
  // This automatic sync has been disabled to prevent unwanted customer creation and duplicates
  console.log('Customer sync disabled: Customers must be created through manual user input only');
  return;
}

