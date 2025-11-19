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
  } catch (error) {
    console.error('Error syncing settings from Firestore:', error);
  }
}

/**
 * Sync settings to Firestore
 */
export async function syncSettingsToFirestore(): Promise<void> {
  try {
    if (!navigator.onLine) {
      return;
    }
    
    const settings = await db.settings.toArray();
    const settingsCollection = getShopCollectionName('settings');
    
    for (const setting of settings) {
      try {
        if (setting.key === 'main') {
          await setDoc(doc(firestoreDb, settingsCollection, 'main'), setting.value);
        }
      } catch (error) {
        console.error(`Error syncing setting ${setting.key}:`, error);
      }
    }
  } catch (error) {
    console.error('Error syncing settings to Firestore:', error);
  }
}

