/**
 * Firestore Write Wrappers
 * Drop-in replacements for Firestore write functions with offline support
 */
import { 
  collection, 
  doc, 
  CollectionReference, 
  DocumentReference,
  DocumentData,
  SetOptions,
  WithFieldValue,
  UpdateData
} from 'firebase/firestore';
import { addDoc as firestoreAddDoc, setDoc as firestoreSetDoc, updateDoc as firestoreUpdateDoc, deleteDoc as firestoreDeleteDoc } from 'firebase/firestore';
import { safeFirestoreWrite, createAddAction, createUpdateAction, createDeleteAction, createSetAction } from './safeFirestoreWrite';

/**
 * Wrapped addDoc - automatically handles offline scenarios
 */
export async function addDoc<T extends DocumentData>(
  collectionRef: CollectionReference<T>,
  data: WithFieldValue<T>
): Promise<DocumentReference<T>> {
  const collectionPath = collectionRef.path;
  
  return safeFirestoreWrite(
    () => firestoreAddDoc(collectionRef, data),
    createAddAction(collectionPath, data)
  );
}

/**
 * Wrapped setDoc - automatically handles offline scenarios
 */
export async function setDoc<T extends DocumentData>(
  documentRef: DocumentReference<T>,
  data: WithFieldValue<T>,
  options?: SetOptions
): Promise<void> {
  const collectionPath = documentRef.path;
  const docId = documentRef.id;
  
  return safeFirestoreWrite(
    () => firestoreSetDoc(documentRef, data, options),
    createSetAction(collectionPath, docId, data)
  );
}

/**
 * Wrapped updateDoc - automatically handles offline scenarios
 */
export async function updateDoc<T extends DocumentData>(
  documentRef: DocumentReference<T>,
  data: UpdateData<T>
): Promise<void> {
  const collectionPath = documentRef.path;
  const docId = documentRef.id;
  
  return safeFirestoreWrite(
    () => firestoreUpdateDoc(documentRef, data),
    createUpdateAction(collectionPath, docId, data)
  );
}

/**
 * Wrapped deleteDoc - automatically handles offline scenarios
 */
export async function deleteDoc<T extends DocumentData>(
  documentRef: DocumentReference<T>
): Promise<void> {
  const collectionPath = documentRef.path;
  const docId = documentRef.id;
  
  return safeFirestoreWrite(
    () => firestoreDeleteDoc(documentRef),
    createDeleteAction(collectionPath, docId)
  );
}

// Re-export other Firestore functions that don't need wrapping
export { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  Timestamp,
  onSnapshot,
  type CollectionReference,
  type DocumentReference,
  type DocumentData
} from 'firebase/firestore';

