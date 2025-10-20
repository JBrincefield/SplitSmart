import {
  collection,
  DocumentData,
  addDoc as firestoreAddDoc,
  deleteDoc as firestoreDeleteDoc,
  doc as firestoreDoc,
  getDoc as firestoreGetDoc,
  getDocs as firestoreGetDocs,
  setDoc as firestoreSetDoc,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * Firestore helpers for quick manual testing.
 * Exports:
 * - createDoc(collectionName, id?, data)
 * - getDocById(collectionName, id)
 * - listDocs(collectionName)
 * - deleteDocById(collectionName, id)
 * - testConnection() -> writes and reads a small doc
 */

export async function createDoc(
  collectionName: string,
  id: string | undefined,
  data: DocumentData
) {
  try {
    if (!db) throw new Error('Firestore not initialized');
    if (id) {
      const ref = firestoreDoc(db, collectionName, id);
      await firestoreSetDoc(ref, data, { merge: true });
      return { id, data };
    } else {
      const ref = await firestoreAddDoc(collection(db, collectionName), data);
      return { id: ref.id, data };
    }
  } catch (error) {
    console.error('createDoc error', error);
    throw error;
  }
}

export async function getDocById(collectionName: string, id: string) {
  try {
    if (!db) throw new Error('Firestore not initialized');
    const ref = firestoreDoc(db, collectionName, id);
    const snap = await firestoreGetDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, data: snap.data() };
  } catch (error) {
    console.error('getDocById error', error);
    throw error;
  }
}

export async function listDocs(collectionName: string) {
  try {
    if (!db) throw new Error('Firestore not initialized');
    const q = collection(db, collectionName);
    const snap = await firestoreGetDocs(q);
    const items: Array<{ id: string; data: DocumentData }> = [];
    snap.forEach((d: QueryDocumentSnapshot) => {
      items.push({ id: d.id, data: d.data() });
    });
    return items;
  } catch (error) {
    console.error('listDocs error', error);
    throw error;
  }
}

export async function deleteDocById(collectionName: string, id: string) {
  try {
    if (!db) throw new Error('Firestore not initialized');
    const ref = firestoreDoc(db, collectionName, id);
    await firestoreDeleteDoc(ref);
    return true;
  } catch (error) {
    console.error('deleteDocById error', error);
    throw error;
  }
}

export async function testConnection() {
  try {
    // use a short-lived test doc id to avoid collisions
    const testId = `test-${Date.now()}`;
    const collectionName = 'testCollection';
    const payload = { ts: Date.now(), ok: true };
    await createDoc(collectionName, testId, payload);
    const read = await getDocById(collectionName, testId);
    // cleanup
    await deleteDocById(collectionName, testId);
    return !!read;
  } catch (error) {
    console.error('testConnection error', error);
    return false;
  }
}
