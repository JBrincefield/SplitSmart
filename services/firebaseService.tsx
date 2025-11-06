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
      activity: [`Group "${name}" created`],
      createdAt: new Date().toISOString(),
    });

    // Back-link this group on each member document using arrayUnion to avoid overwrites
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
      // Support both legacy string ids and DocumentReference entries
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

// Get a specific group by ID
export async function getGroupById(groupId: string) {
  const ref = doc(db, "groups", groupId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  
  const groupData = snap.data();
  
  // Resolve member references to get user details
  const memberRefs = groupData.members || [];
  const resolvedMembers = await Promise.all(
    memberRefs.map(async (memberRef: any) => {
      try {
        // If it's already a string (legacy format), return it
        if (typeof memberRef === 'string') {
          return { id: memberRef, name: memberRef };
        }
        
        // If it's a DocumentReference, fetch the user data
        if (memberRef?.id) {
          const memberSnap = await getDoc(memberRef);
          if (memberSnap.exists()) {
            const userData = memberSnap.data() as any;
            return {
              id: memberSnap.id,
              name: userData.name || userData.email || memberSnap.id,
              email: userData.email,
            };
          }
        }
        
        return null;
      } catch (error) {
        console.error("Error resolving member reference:", error);
        return null;
      }
    })
  );
  
  // Filter out any null values from failed resolutions
  const validMembers = resolvedMembers.filter(m => m !== null);
  
  return { 
    id: snap.id, 
    ...groupData,
    members: validMembers,
  };
}

/**
 * Add an activity entry to a group's activity log.
 *
 * This appends a new activity string to the group's `activity` array using
 * arrayUnion to avoid race conditions. Activity entries are typically
 * human-readable strings describing what changed (e.g., "User joined",
 * "New expense added", etc.).
 *
 * @param groupId - id of the group to add activity to
 * @param activityText - the activity message to log
 * @throws Propagates Firestore errors
 */
export async function addGroupActivity(groupId: string, activityText: string) {
  try {
    const groupDocRef = doc(db, "groups", groupId);
    await updateDoc(groupDocRef, {
      activity: arrayUnion(activityText)
    });
  } catch (error) {
    console.error("Error adding group activity:", error);
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
 * @param name - name/description of the expense
 * @param amount - numeric amount (store currency/precision at the caller)
 * @param paidBy - uid of the user who paid
 * @param sharedWith - array of uids sharing the expense
 * @param notes - optional notes for the expense
 * @returns The id of the created expense document
 * @throws Propagates Firestore errors
 */
export async function addExpense(groupId: string, title: string, name: string, amount: number, paidBy: string, sharedWith: string[], notes = "") {
  try {
    const paidByRef = userRef(paidBy);
    const sharedWithRefs = sharedWith.map((id) => userRef(id));
    // Build participants status array from sharedWith only; if the payer is included, mark their portion as paid.
    const participants = sharedWithRefs.map((ref) => ({
      user: ref,
      status: ref.id === paidByRef.id ? "paid" : "unpaid",
      paidAt: ref.id === paidByRef.id ? new Date().toISOString() : null,
    }));

    const expenseRef = await addDoc(collection(db, "groups", groupId, "expenses"), {
      title,
      name,
      amount,
      paidBy: paidByRef,
      sharedWith: sharedWithRefs,
      participants,
      completed: false,
      notes,
      date: new Date().toISOString(),
    });

    // Log activity
    await addGroupActivity(groupId, `New expense added: ${title} ($${amount.toFixed(2)})`);

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
    // Return Firestore unsubscribe function so callers can detach listeners
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
 * Get a specific expense by ID from a group's expenses subcollection.
 * 
 * This resolves the paidBy and sharedWith DocumentReferences to actual user data.
 * 
 * @param groupId - id of the group
 * @param expenseId - id of the expense to fetch
 * @returns The expense object with resolved user references, or null if not found
 * @throws Propagates Firestore errors
 */
export async function getExpenseById(groupId: string, expenseId: string) {
  try {
    const expenseRef = doc(db, "groups", groupId, "expenses", expenseId);
    const expenseSnap = await getDoc(expenseRef);
    
    if (!expenseSnap.exists()) return null;
    
    const expenseData = expenseSnap.data() as any;

    // Normalize date to ISO string regardless of storage type (Timestamp|string|number)
    let dateIso: string | null = null;
    const rawDate = expenseData.date;
    try {
      if (rawDate && typeof (rawDate as any).toDate === "function") {
        // Firestore Timestamp
        dateIso = (rawDate as any).toDate().toISOString();
      } else if (typeof rawDate === "string") {
        dateIso = new Date(rawDate).toISOString();
      } else if (typeof rawDate === "number") {
        dateIso = new Date(rawDate).toISOString();
      }
    } catch {
      dateIso = null;
    }
    
    // Resolve paidBy reference
    let paidByUser = null;
    if (expenseData.paidBy) {
      try {
        // If it's a DocumentReference, use it directly. If it's a string, create a ref.
        let ref;
        if (typeof expenseData.paidBy === "string") {
          ref = userRef(expenseData.paidBy);
        } else if (expenseData.paidBy.type === "document") {
          ref = expenseData.paidBy as DocumentReference;
        } else {
          ref = expenseData.paidBy;
        }

        const paidBySnap = await getDoc(ref);
        if (paidBySnap.exists()) {
          const userData = paidBySnap.data() as any;
          paidByUser = {
            id: paidBySnap.id,
            name: userData?.name || userData?.email || paidBySnap.id,
            email: userData?.email,
          };
        }
      } catch (e) {
        console.error("Error resolving paidBy:", e);
      }
    }
    
    const sharedWithRefs = expenseData.sharedWith || [];
    const sharedWithUsers = await Promise.all(
      sharedWithRefs.map(async (refLike: any, idx: number) => {
        try {
          let ref;
          if (typeof refLike === "string") {
            ref = userRef(refLike);
          } else if (refLike.type === "document") {
            ref = refLike as DocumentReference;
          } else {
            ref = refLike;
          }

          const userSnap = await getDoc(ref);
          if (userSnap.exists()) {
            const userData = userSnap.data() as any;
            return {
              id: userSnap.id,
              name: userData.name || userData.email,
              email: userData.email,
            };
          }
          return null;
        } catch (error) {
          console.error(`Error resolving sharedWith user[${idx}]:`, error);
          return null;
        }
      })
    );
    
    let participantsResolved: any[] = [];
    const rawParticipants = expenseData.participants || null;
    if (rawParticipants && Array.isArray(rawParticipants)) {
      // Resolve normalized participants array with user details
      participantsResolved = await Promise.all(
        rawParticipants.map(async (p: any) => {
          try {
            let ref;
            if (typeof p.user === "string") {
              ref = userRef(p.user);
            } else if (p.user?.type === "document") {
              ref = p.user as DocumentReference;
            } else {
              ref = p.user;
            }
            const userSnap = await getDoc(ref);
            if (userSnap.exists()) {
              const u = userSnap.data() as any;
              return {
                id: userSnap.id,
                name: u.name || u.email || userSnap.id,
                email: u.email,
                status: p.status || "unpaid",
                paidAt: p.paidAt || null,
              };
            }
            return null;
          } catch (e) {
            console.error("Error resolving participant:", e);
            return null;
          }
        })
      );
      participantsResolved = participantsResolved.filter(Boolean) as any[];
    } else {
      // Fallback: synthesize participants from sharedWith + paidBy (legacy data)
      const list: any[] = [];
      for (const u of sharedWithUsers) {
        if (!u) continue;
        const isPayer = paidByUser && u.id === paidByUser.id;
        list.push({ ...u, status: isPayer ? "paid" : "unpaid", paidAt: isPayer ? (dateIso || new Date().toISOString()) : null });
      }
      participantsResolved = list;
    }
    
    const result = {
      id: expenseSnap.id,
      title: expenseData.title,
      amount: expenseData.amount,
      notes: expenseData.notes,
      date: dateIso ?? expenseData.date,
      paidBy: paidByUser,
      sharedWith: sharedWithUsers.filter(u => u !== null),
      participants: participantsResolved,
      completed: !!expenseData.completed,
      completedAt: expenseData.completedAt || null,
    };
    return result;
  } catch (error) {
    console.error("Error getting expense:", error);
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
    const expenseDoc = await getDoc(doc(db, "groups", groupId, "expenses", expenseId));
    const expenseData = expenseDoc.exists() ? expenseDoc.data() : null;
    
    await deleteDoc(doc(db, "groups", groupId, "expenses", expenseId));
    
    if (expenseData) {
      await addGroupActivity(groupId, `Expense deleted: ${expenseData.title}`);
    } else {
      await addGroupActivity(groupId, `Expense deleted`);
    }
  } catch (error) {
    console.error("Error deleting expense:", error);
    throw error;
  }
}

export async function markPortionPaid(groupId: string, expenseId: string, userId: string) {
  try {
    const expenseDocRef = doc(db, "groups", groupId, "expenses", expenseId);
    const expSnap = await getDoc(expenseDocRef);
    if (!expSnap.exists()) throw new Error("Expense not found");
    const data = expSnap.data() as any;

    let participants: any[] = Array.isArray(data.participants) ? [...data.participants] : [];
    if (participants.length === 0) {
      // If no participants array yet (legacy), initialize it from sharedWith/paidBy
      const sharedWithRefs = (data.sharedWith || []).map((refLike: any) => {
        if (typeof refLike === "string") return userRef(refLike);
        return refLike;
      });
      const paidBy = data.paidBy?.id ? data.paidBy : (typeof data.paidBy === "string" ? userRef(data.paidBy) : data.paidBy);
      participants = sharedWithRefs.map((ref: any) => ({
        user: ref,
        status: paidBy && ref.id === paidBy.id ? "paid" : "unpaid",
        paidAt: paidBy && ref.id === paidBy.id ? new Date().toISOString() : null,
      }));
    }

    const idx = participants.findIndex((p: any) => (typeof p.user === "string" ? p.user === userId : p.user?.id === userId));
    if (idx === -1) throw new Error("User is not a participant of this expense");
    if (participants[idx].status === "paid") return;
    participants[idx] = { ...participants[idx], status: "paid", paidAt: new Date().toISOString() };

    await updateDoc(expenseDocRef, { participants });

    const userSnap = await getDoc(userRef(userId));
    const userName = userSnap.exists() ? ((userSnap.data() as any).name || (userSnap.data() as any).email || "A user") : "A user";
    await addGroupActivity(groupId, `${userName} marked their share as paid`);
  } catch (error) {
    console.error("Error marking portion paid:", error);
    throw error;
  }
}

export async function markExpenseComplete(groupId: string, expenseId: string, completedByUserId: string) {
  try {
    const expenseDocRef = doc(db, "groups", groupId, "expenses", expenseId);
    const expSnap = await getDoc(expenseDocRef);
    if (!expSnap.exists()) throw new Error("Expense not found");
    const data = expSnap.data() as any;

    const payerId = data.paidBy?.id ? data.paidBy.id : (typeof data.paidBy === "string" ? data.paidBy : undefined);
    if (payerId && payerId !== completedByUserId) {
      throw new Error("Only the original payer can complete this expense");
    }

    await updateDoc(expenseDocRef, {
      completed: true,
      completedAt: new Date().toISOString(),
      completedBy: userRef(completedByUserId),
    });

    const userSnap = await getDoc(userRef(completedByUserId));
    const userName = userSnap.exists() ? ((userSnap.data() as any).name || (userSnap.data() as any).email || "User") : "User";
    await addGroupActivity(groupId, `${userName} marked an expense as complete`);
  } catch (error) {
    console.error("Error completing expense:", error);
    throw error;
  }
}

/**
 * Add a user to a group's members array.
 *
 * This adds the user's DocumentReference to the group's `members` array
 * and adds the group's DocumentReference to the user's `groups` array.
 * Also logs activity about the user joining.
 *
 * @param groupId - id of the group
 * @param userId - uid of the user to add
 * @throws Propagates Firestore errors
 */
export async function addMemberToGroup(groupId: string, userId: string) {
  try {
    const groupDocRef = groupRef(groupId);
    const userDocRef = userRef(userId);

    const userSnap = await getDoc(userDocRef);
    const userName = userSnap.exists() ? (userSnap.data() as any).name || (userSnap.data() as any).email : "User";
    
    await updateDoc(groupDocRef, {
      members: arrayUnion(userDocRef)
    });
    
    await updateDoc(userDocRef, {
      groups: arrayUnion(groupDocRef)
    });
    
    await addGroupActivity(groupId, `${userName} joined the group`);
  } catch (error) {
    console.error("Error adding member to group:", error);
    throw error;
  }
}

/**
 * Remove a user from a group's members array.
 *
 * Note: Firestore doesn't have arrayRemove for DocumentReferences that works
 * reliably, so this function reads the current members, filters out the user,
 * and writes the updated array back. Also logs activity about the user leaving.
 *
 * @param groupId - id of the group
 * @param userId - uid of the user to remove
 * @throws Propagates Firestore errors
 */
export async function removeMemberFromGroup(groupId: string, userId: string) {
  try {
    const groupDocRef = groupRef(groupId);
    const userDocRef = userRef(userId);
    
    const groupSnap = await getDoc(groupDocRef);
    const userSnap = await getDoc(userDocRef);
    
    if (!groupSnap.exists() || !userSnap.exists()) {
      throw new Error("Group or user not found");
    }
    
    const userName = (userSnap.data() as any).name || (userSnap.data() as any).email || "User";
    const groupData = groupSnap.data();
    
    const updatedMembers = (groupData.members || []).filter((memberRef: any) => {
      // memberRef is a DocumentReference; compare ids to remove target user
      return memberRef.id !== userId;
    });
    
    const userData = userSnap.data();
    const updatedGroups = (userData.groups || []).filter((gRef: any) => {
      // Similarly remove this group from the user's `groups` array
      return gRef.id !== groupId;
    });

    await updateDoc(groupDocRef, { members: updatedMembers });
    await updateDoc(userDocRef, { groups: updatedGroups });
    
    await addGroupActivity(groupId, `${userName} left the group`);
  } catch (error) {
    console.error("Error removing member from group:", error);
    throw error;
  }
}

export { db };

