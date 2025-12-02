# Delete Old Collections

This guide will help you delete the old collections from Firestore:
- `CentralShopNotifications`
- `CentralShopUsers`
- `KamweneShopOrders`

## New Collection Names

The system now uses these new collection names:
- **Users**: `CentralShopStaff`, `KamweneStaff` (changed from `CentralShopUsers`)
- **Notifications**: Disabled (local-only, no Firestore collection)
- **Orders**: `CentralShopOrders`, `KamweneOrders` (changed from `KamweneShopOrders`)

## Method 1: Browser Console (Recommended)

1. Open your app in the browser
2. Open Developer Tools (F12)
3. Go to Console tab
4. Paste and run this code:

```javascript
import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './src/firebase';

async function deleteCollection(collectionName) {
  console.log(`Starting deletion of ${collectionName}...`);
  const collectionRef = collection(db, collectionName);
  const snapshot = await getDocs(collectionRef);
  if (snapshot.empty) {
    console.log(`Collection ${collectionName} is already empty.`);
    return;
  }
  console.log(`Found ${snapshot.size} documents in ${collectionName}`);
  const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);
  console.log(`✅ Successfully deleted ${snapshot.size} documents from ${collectionName}`);
}

async function deleteOldCollections() {
  const collections = ['CentralShopNotifications', 'CentralShopUsers', 'KamweneShopOrders'];
  for (const name of collections) {
    try {
      await deleteCollection(name);
    } catch (error) {
      console.error(`Failed to delete ${name}:`, error);
    }
  }
  console.log('✅ Finished deleting old collections');
}

deleteOldCollections();
```

## Method 2: Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `central-shop-34d1b`
3. Go to Firestore Database
4. For each collection (`CentralShopNotifications`, `CentralShopUsers`, `KamweneShopOrders`):
   - Click on the collection
   - Select all documents
   - Click Delete
   - Confirm deletion

## Method 3: Firebase CLI

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Delete collections using Firestore delete command
# Note: This requires Firebase Admin SDK setup
```

## Verification

After deletion, verify:
1. Collections no longer appear in Firestore Console
2. App still works correctly with new collection names
3. No errors in browser console

## Important Notes

- **Backup First**: If you have important data, export it before deleting
- **New Collections**: The app will automatically create new collections with the new names when needed
- **Users**: Existing users will need to be re-added to the new `CentralShopStaff` collection
- **Orders**: Old orders in `KamweneShopOrders` will be lost (if you need them, export first)

