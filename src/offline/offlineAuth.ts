/**
 * Offline Authentication & User Data Cache
 * Handles caching user data for offline access
 */
import { db, LocalCache } from './db';
import { User as FirebaseUser } from 'firebase/auth';

export interface CachedUserData {
  uid: string;
  id: string;
  name: string;
  email: string;
  role: 'astraronix' | 'mainAdmin' | 'Admin' | 'Cashier' | 'Stock Manager';
  status: 'Active' | 'Inactive';
  avatar?: string;
  customId?: string;
  shopId?: string;
  shopName?: string;
  assignedShops?: string[];
  createdAt: Date;
  updatedAt: Date;
  lastSynced: Date;
}

const USER_CACHE_KEY = 'current-user';

/**
 * Cache user data for offline access
 */
export async function cacheUserData(userData: CachedUserData): Promise<void> {
  try {
    await db.localCache.put({
      id: USER_CACHE_KEY,
      collection: 'users',
      data: userData,
      lastSynced: new Date()
    });
    console.log('User data cached for offline access');
  } catch (error) {
    console.error('Error caching user data:', error);
  }
}

/**
 * Load cached user data
 */
export async function loadCachedUserData(): Promise<CachedUserData | null> {
  try {
    const cached = await db.localCache.get(USER_CACHE_KEY);
    if (cached && cached.data) {
      return cached.data as CachedUserData;
    }
    return null;
  } catch (error) {
    console.error('Error loading cached user data:', error);
    return null;
  }
}

/**
 * Clear cached user data (on logout)
 */
export async function clearCachedUserData(): Promise<void> {
  try {
    await db.localCache.delete(USER_CACHE_KEY);
  } catch (error) {
    console.error('Error clearing cached user data:', error);
  }
}

/**
 * Check if user is cached
 */
export async function isUserCached(uid: string): Promise<boolean> {
  try {
    const cached = await loadCachedUserData();
    return cached !== null && cached.uid === uid;
  } catch (error) {
    return false;
  }
}

