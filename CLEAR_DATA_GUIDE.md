# Clear All Data Guide

This guide will help you clear all data to start from a clean database.

## ✅ Firebase Configuration Verified

Your Firebase configuration is correct:
- **Project ID**: `central-shop-34d1b`
- **Auth Domain**: `central-shop-34d1b.firebaseapp.com`
- **Storage Bucket**: `central-shop-34d1b.firebasestorage.app`

## 🧹 Clear Local Data (IndexedDB, localStorage, cache)

### Option 1: Using the UI (Recommended)

1. Navigate to: `http://localhost:5173/clear-data` (or your app URL + `/clear-data`)
2. Click "Clear All Local Data"
3. Confirm the action
4. The page will automatically reload

### Option 2: Using Browser Console

1. Open browser console (F12)
2. Run:
```javascript
// Clear IndexedDB
indexedDB.deleteDatabase('CentralShopDB');
indexedDB.deleteDatabase('OfflineUsersDB');

// Clear localStorage
localStorage.clear();

// Clear cache
caches.keys().then(names => {
  names.forEach(name => caches.delete(name));
});

// Reload page
location.reload();
```

### Option 3: Using Browser DevTools

1. **Chrome/Edge:**
   - F12 → Application tab
   - Clear Storage → Check all → Clear site data

2. **Firefox:**
   - F12 → Storage tab
   - Right-click → Clear All

## 🔥 Clear Firestore Data

### Option 1: Firebase Console (Recommended)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `central-shop-34d1b`
3. Go to Firestore Database
4. Delete collections manually:
   - `shops`
   - `CentralShopStaff`
   - `CentralShopOrders`
   - `CentralShopProducts`
   - `CentralShopCustomers`
   - `CentralShopSettings`
   - `KamweneOrders`
   - `KamweneProducts`
   - `KamweneCustomers`
   - `users`
   - Any other collections

### Option 2: Using Browser Console (After Login)

Run this in browser console after logging in:

```javascript
import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './src/firebase';

async function clearFirestore() {
  const collections = [
    'shops',
    'CentralShopStaff',
    'CentralShopOrders',
    'CentralShopProducts',
    'CentralShopCustomers',
    'CentralShopSettings',
    'KamweneOrders',
    'KamweneProducts',
    'KamweneCustomers',
    'users'
  ];
  
  for (const collName of collections) {
    try {
      const snapshot = await getDocs(collection(db, collName));
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      console.log(`✅ Cleared ${snapshot.size} documents from ${collName}`);
    } catch (error) {
      console.error(`❌ Error clearing ${collName}:`, error);
    }
  }
  
  console.log('✅ Firestore data cleared!');
}

clearFirestore();
```

## 🎯 Complete Clean Start

To start completely fresh:

1. **Clear Local Data:**
   - Visit `/clear-data` page OR use browser console
   
2. **Clear Firestore:**
   - Use Firebase Console OR browser console script
   
3. **Hard Refresh Browser:**
   - Press `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
   
4. **Create First Admin:**
   - Visit `/setup` page
   - Create your first admin account

## ⚠️ Important Notes

- **Local data clearing** is safe and reversible (data is still in Firestore)
- **Firestore data clearing** is permanent and cannot be undone
- Always backup important data before clearing Firestore
- After clearing, you'll need to create a new admin account via `/setup`

## 🔍 Verify Clean State

After clearing, verify:
- ✅ No data in IndexedDB (check Application tab in DevTools)
- ✅ No data in localStorage (check Application tab in DevTools)
- ✅ No collections in Firestore (check Firebase Console)
- ✅ App loads fresh (visit `/setup` to create admin)


