/**
 * Script to delete old collections from Firestore
 * Run this in Node.js or browser console after importing Firebase
 * 
 * Collections to delete:
 * - CentralShopNotifications
 * - CentralShopUsers
 * - KamweneShopOrders
 */

// For Node.js (Firebase Admin SDK)
// const admin = require('firebase-admin');
// const db = admin.firestore();

// For Browser Console (Firebase Web SDK)
// Copy and paste this into browser console after importing Firebase

async function deleteCollection(collectionName) {
  console.log(`Starting deletion of ${collectionName}...`);
  
  try {
    // Get all documents in the collection
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    
    if (snapshot.empty) {
      console.log(`Collection ${collectionName} is already empty.`);
      return;
    }
    
    console.log(`Found ${snapshot.size} documents in ${collectionName}`);
    
    // Delete all documents
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    console.log(`✅ Successfully deleted ${snapshot.size} documents from ${collectionName}`);
  } catch (error) {
    console.error(`❌ Error deleting ${collectionName}:`, error);
    throw error;
  }
}

async function deleteOldCollections() {
  console.log('🗑️  Starting deletion of old collections...\n');
  
  const collectionsToDelete = [
    'CentralShopNotifications',
    'CentralShopUsers',
    'KamweneShopOrders'
  ];
  
  for (const collectionName of collectionsToDelete) {
    try {
      await deleteCollection(collectionName);
      console.log('');
    } catch (error) {
      console.error(`Failed to delete ${collectionName}:`, error);
    }
  }
  
  console.log('✅ Finished deleting old collections');
}

// Uncomment to run:
// deleteOldCollections();

// Browser Console Version (paste this into browser console):
/*
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
  console.log('✅ Finished');
}

deleteOldCollections();
*/

