/**
 * Offline Settings Management
 * Handles caching settings for offline access
 */
import { db, OfflineSetting } from './db';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';
import { getShopCollectionName } from '../config/shopConfig';

/**
 * Save setting offline
 */
export async function saveSettingOffline(key: string, value: any): Promise<void> {
  try {
    await db.settings.put({
      key,
      value,
      lastSynced: new Date()
    });
  } catch (error) {
    console.error('Error saving setting offline:', error);
    throw error;
  }
}

/**
 * Get setting from cache
 */
export async function getSettingOffline(key: string): Promise<any | null> {
  try {
    const setting = await db.settings.get(key);
    return setting ? setting.value : null;
  } catch (error) {
    console.error('Error getting setting offline:', error);
    return null;
  }
}

/**
 * Sync settings from Firestore
 */
export async function syncSettingsFromFirestore(): Promise<void> {
  try {
    const settingsCollection = getShopCollectionName('settings');
    const settingsDoc = await getDoc(doc(firestoreDb, settingsCollection, 'main'));
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      await db.settings.put({
        key: 'main',
        value: data,
        lastSynced: new Date()
      });
    }
  } catch (error: any) {
    // For permission issues, log a concise warning and skip without throwing
    if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
      console.warn('Skipping settings sync: missing or insufficient Firestore permissions for this user.');
      return;
    }
    console.error('Error syncing settings from Firestore:', error);
  }
}

/**
 * Sync settings to Firestore
 * DISABLED: Settings should only be updated through manual user input in Settings page, not automatically synced
 * This prevents automatic settings updates and duplicate documents
 */
export async function syncSettingsToFirestore(): Promise<void> {
  // Settings are now only updated through manual user input in the Settings page
  // This automatic sync has been disabled to prevent unwanted settings updates and duplicates
  console.log('Settings sync disabled: Settings must be updated through manual user input only');
      return;
}

