import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  DocumentReference,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

/**
 * services/firebaseService
 *
 * Convenience wrappers around Firebase Authentication and Firestore for
 * the SplitSmart app. Uses the modular Firebase SDK (v9+ style imports).
 *
 * Design notes:
 * - Groups and expenses store DocumentReference objects for users when
 *   possible (e.g. `createdBy` and `members`) to keep normalized relationships.
 * - Some fields may still be stored as plain strings (legacy). Consumers
 *   should handle both string ids and DocumentReference objects when reading.
 * - These functions intentionally return raw Firestore objects/ids so the
 *   calling UI layer can decide how to hydrate or cache referenced documents.
 */


/**
 * Create a DocumentReference for a user.
 *
 * @param userId - Firebase Auth UID or users collection document id
 * @returns DocumentReference pointing to `users/{userId}`
 */
export function userRef(userId: string) {
  return doc(db, "users", userId);
}

/**
 * Create a DocumentReference for a group.
 *
 * @param groupId - group document id
 * @returns DocumentReference pointing to `groups/{groupId}`
 */
export function groupRef(groupId: string) {
  return doc(db, "groups", groupId);
}

/**
 * Register a new user using Firebase Authentication and create a Firestore user document.
 *
 * This creates an auth account (email/password) and then adds a document in
 * `users/{uid}` with basic profile fields. The Firestore user document will
 * include an empty `groups` array to be populated when the user joins/creates groups.
 *
 * @param email - user's email address
 * @param password - user's password (must meet Firebase Auth requirements)
 * @param name - display name to store in the users collection
 * @returns The Firebase User object on successful registration
 * @throws Propagates errors from Firebase Auth or Firestore operations
 */
export async function registerUser(email: string, password: string, name: string): Promise<any> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, "users", user.uid), {
      name,
      email,
      groups: [],
      createdAt: new Date().toISOString(),
    });

    return user;
  } catch (error) {
    console.error("Error registering user:", error);
    throw error;
  }
}

/**
 * Sign in an existing user using email and password.
 *
 * @param email - user's email
 * @param password - user's password
 * @returns The Firebase User object on successful sign-in
 * @throws Propagates errors from Firebase Auth
 */
export async function loginUser(email: string, password: string): Promise<any> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error logging in:", error);
    throw error;
  }
}

/**
 * Sign out the currently authenticated user.
 *
 * Returns void. Errors from Firebase Auth are propagated after logging.
 */
export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error logging out:", error);
    throw error;
  }
}

/**
 * Create a new group document and add the group reference to each member's
 * `groups` array in their user document.
 *
 * Implementation details:
 * - `createdBy` and each entry in `members` are passed in as user ids (strings)
 *   and converted to DocumentReference objects before being written to Firestore.
 * - Each member's `users/{uid}.groups` array is updated with the new group DocumentReference
 *   via `arrayUnion` to avoid overwriting concurrent updates.
 *
 * @param name - name of the group
 * @param createdBy - uid of the user creating the group
 * @param members - array of user uids to include as members
 * @returns The id of the newly created group document
 * @throws Propagates Firestore errors
 */
export async function createGroup(name: string, createdBy: string, members: string[]) {
  try {
    const createdByRef = userRef(createdBy);
    const memberRefs = members.map((m) => userRef(m));

    const groupDocumentRef = await addDoc(collection(db, "groups"), {
      name,
      createdBy: createdByRef,
      members: memberRefs,
      createdAt: new Date().toISOString(),
    });

    for (const userId of members) {
      const uRef = userRef(userId);
      const uSnap = await getDoc(uRef);
      if (uSnap.exists()) {
        await updateDoc(uRef, { groups: arrayUnion(groupDocumentRef) });
      }
    }

    return groupDocumentRef.id;
  } catch (error) {
    console.error("Error creating group:", error);
    throw error;
  }
}

/**
 * Retrieve full group documents for a user's `groups` list.
 *
 * This helper supports legacy data where `users/{uid}.groups` may contain
 * string ids as well as modern entries that are DocumentReference objects.
 * It resolves each entry to the full group document and returns an array of
 * objects in the shape { id, ...data }.
 *
 * @param userId - uid of the user whose groups should be fetched
 * @returns Array of resolved group documents (each has `id` and fields)
 * @throws Propagates Firestore errors
 */
export async function getUserGroups(userId: string) {
  try {
    const uRef = userRef(userId);
    const userDoc = await getDoc(uRef);
    if (!userDoc.exists()) return [];

    const groupRefs = userDoc.data().groups || [];

    const groups: any[] = [];
    for (const g of groupRefs) {
      if (!g) continue;
      const gRef = typeof g === "string" ? doc(db, "groups", g) : (g as DocumentReference);
      const groupDoc = await getDoc(gRef);
      if (groupDoc.exists()) groups.push({ id: groupDoc.id, ...(groupDoc.data() as any) });
    }
    return groups;
  } catch (error) {
    console.error("Error fetching user groups:", error);
    throw error;
  }
}

/**
 * Add an expense to a group's `expenses` subcollection.
 *
 * This stores `paidBy` and `sharedWith` as DocumentReference objects to users
 * (converted from the provided user ids). The returned value is the new
 * expense document id.
 *
 * @param groupId - id of the group to add the expense to
 * @param title - expense title
 * @param amount - numeric amount (store currency/precision at the caller)
 * @param paidBy - uid of the user who paid
 * @param sharedWith - array of uids sharing the expense
 * @param notes - optional notes for the expense
 * @returns The id of the created expense document
 * @throws Propagates Firestore errors
 */
export async function addExpense(groupId: string, title: string, amount: number, paidBy: string, sharedWith: string[], notes = "") {
  try {
    const paidByRef = userRef(paidBy);
    const sharedWithRefs = sharedWith.map((id) => userRef(id));

    const expenseRef = await addDoc(collection(db, "groups", groupId, "expenses"), {
      title,
      amount,
      paidBy: paidByRef,
      sharedWith: sharedWithRefs,
      notes,
      date: new Date().toISOString(),
    });
    return expenseRef.id;
  } catch (error) {
    console.error("Error adding expense:", error);
    throw error;
  }
}

/**
 * Subscribe to the expenses collection for a group and call `onUpdate` on every change.
 *
 * The provided `onUpdate` callback will receive an array of expense objects
 * in the shape { id, ...data }. This function returns the unsubscribe
 * function returned by `onSnapshot` to stop listening.
 *
 * @param groupId - id of the group whose expenses should be observed
 * @param onUpdate - callback called with the current array of expenses on each snapshot
 * @returns The unsubscribe function from Firestore `onSnapshot`
 * @throws Propagates Firestore errors
 */
export async function getGroupExpenses(groupId: string, onUpdate: (expenses: any[]) => void) {
  try {
    const q = query(collection(db, "groups", groupId, "expenses"));
    return onSnapshot(q, (snapshot) => {
      const expenses = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
      onUpdate(expenses);
    });
  } catch (error) {
    console.error("Error getting expenses:", error);
    throw error;
  }
}

/**
 * Delete an expense document from a group's `expenses` subcollection.
 *
 * @param groupId - id of the group
 * @param expenseId - id of the expense to delete
 */
export async function deleteExpense(groupId: string, expenseId: string) {
  try {
    await deleteDoc(doc(db, "groups", groupId, "expenses", expenseId));
  } catch (error) {
    console.error("Error deleting expense:", error);
    throw error;
  }
}
