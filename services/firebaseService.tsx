import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  DocumentReference,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { ExpenseSplit } from "../components/model/expense";
import { auth, db } from "../firebaseConfig";


// Firebase service layer: wrappers for auth and Firestore operations.
// Stores DocumentReferences when possible; handles legacy string IDs for backward compatibility.

export function userRef(userId: string) {
  return doc(db, "users", userId);
}

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


export async function loginUser(email: string, password: string): Promise<any> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error logging in:", error);
    throw error;
  }
}


export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error logging out:", error);
    throw error;
  }
}

// Create a new group and link it to all members' user documents.
// Owner gets all permissions; others default to limited access.
export async function createGroup(name: string, createdBy: string, members: string[]) {
  try {
    const createdByRef = userRef(createdBy);
    const memberRefs = members.map((m) => userRef(m));

    const nowIso = new Date().toISOString();
    const memberPermissions: Record<string, { canCreateExpenses?: boolean; canInvite?: boolean; canKick?: boolean }> = {};
    memberPermissions[createdBy] = { canCreateExpenses: true, canInvite: true, canKick: true };
    for (const m of members) {
      if (m === createdBy) continue;
      memberPermissions[m] = { canCreateExpenses: true, canInvite: false, canKick: false };
    }

    const groupDocumentRef = await addDoc(collection(db, "groups"), {
      name,
      createdBy: createdByRef,
      members: memberRefs,
      memberPermissions,
      activity: [{ text: `Group "${name}" created`, createdAt: nowIso }],
      createdAt: nowIso,
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
 * Set or update permissions for a specific member within a group.
 *
 * Permissions:
 * - canCreateExpenses: whether the member can create expenses in the group
 * - canInvite: whether the member can invite/add others to the group
 * - canKick: whether the member can remove other members
 */
export async function setMemberPermissions(
  groupId: string,
  userId: string,
  permissions: { canCreateExpenses?: boolean; canInvite?: boolean; canKick?: boolean }
) {
  try {
    const groupDocRef = groupRef(groupId);
    const gSnap = await getDoc(groupDocRef);
    if (!gSnap.exists()) throw new Error("Group not found");
    const data = gSnap.data() as any;
    const current: Record<string, any> = data.memberPermissions || {};
    const prev = current[userId] || {};
    const updated = { ...prev, ...permissions };
    const newMap = { ...current, [userId]: updated };
    await updateDoc(groupDocRef, { memberPermissions: newMap });
  } catch (error) {
    console.error("Error setting member permissions:", error);
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

// Fetch group by ID and resolve member references to user details
export async function getGroupById(groupId: string) {
  const ref = doc(db, "groups", groupId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  
  const groupData = snap.data();
  const memberRefs = groupData.members || [];
  const resolvedMembers = await Promise.all(
    memberRefs.map(async (memberRef: any) => {
      try {
        if (typeof memberRef === 'string') {
          return { id: memberRef, name: memberRef };
        }
        
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
      activity: arrayUnion({ text: activityText, createdAt: new Date().toISOString() })
    });
  } catch (error) {
    console.error("Error adding group activity:", error);
    throw error;
  }
}

/**
 * Aggregate recent activity across all groups a user belongs to.
 *
 * Supports legacy activity entries that are simple strings by wrapping them
 * in objects with a null createdAt (they will sort last relative to dated entries).
 *
 * @param userId - uid of the user
 * @param limit - maximum number of activity entries to return (default 10)
 * @returns Array of { groupId, groupName, text, createdAt } sorted descending by createdAt
 */
export async function getUserRecentActivity(userId: string, limit = 10) {
  try {
    const groups = await getUserGroups(userId);
    const all: Array<{ groupId: string; groupName: string; text: string; createdAt: string | null }> = [];
    for (const g of groups) {
      const groupId = g.id;
      const groupName = g.name || "Unnamed group";
      const activityArray: any[] = Array.isArray(g.activity) ? g.activity : [];
      for (const entry of activityArray) {
        if (typeof entry === "string") {
          all.push({ groupId, groupName, text: entry, createdAt: null });
        } else if (entry && typeof entry === "object") {
          all.push({ groupId, groupName, text: entry.text || "", createdAt: entry.createdAt || null });
        }
      }
    }
    all.sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return all.slice(0, limit);
  } catch (error) {
    console.error("Error getting recent activity:", error);
    return [];
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
export async function addExpense(
  groupId: string,
  title: string,
  name: string,
  amount: number,
  paidBy: string,
  sharedWith: string[],
  notes = "",
  split?: ExpenseSplit
) {
  try {
    const paidByRef = userRef(paidBy);
    const sharedWithRefs = sharedWith.map((id) => userRef(id));
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
      split: split ? normalizeSplitForWrite(split) : undefined,
      completed: false,
      notes,
      date: new Date().toISOString(),
    });

    await addGroupActivity(groupId, `New expense added: ${title} ($${amount.toFixed(2)})`);
    return expenseRef.id;
  } catch (error) {
    console.error("Error adding expense:", error);
    throw error;
  }
}

// Convert split allocations to use DocumentReferences for Firestore
function normalizeSplitForWrite(split: ExpenseSplit): any {
  const out: any = { type: split.type, allocations: [] as any[] };
  for (const a of split.allocations || []) {
    const user = typeof (a as any).user === "string" ? userRef((a as any).user) : (a as any).user;
    out.allocations.push({ user, value: Number(a.value) || 0 });
  }
  return out;
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

    let dateIso: string | null = null;
    const rawDate = expenseData.date;
    try {
      if (rawDate && typeof (rawDate as any).toDate === "function") {
        dateIso = (rawDate as any).toDate().toISOString();
      } else if (typeof rawDate === "string") {
        dateIso = new Date(rawDate).toISOString();
      } else if (typeof rawDate === "number") {
        dateIso = new Date(rawDate).toISOString();
      }
    } catch {
      dateIso = null;
    }
    
    let paidByUser = null;
    if (expenseData.paidBy) {
      try {
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
      split: expenseData.split || undefined,
      completed: !!expenseData.completed,
      completedAt: expenseData.completedAt || null,
    };
    return result;
  } catch (error) {
    console.error("Error getting expense:", error);
    throw error;
  }
}


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
 * If the group becomes empty (no members remain), the group document and all its
 * subcollections (expenses) are deleted.
 *
 * @param groupId - id of the group
 * @param userId - uid of the user to remove
 * @returns true if the group was deleted (no members left), false otherwise
 * @throws Propagates Firestore errors
 */
export async function removeMemberFromGroup(groupId: string, userId: string, removedByUserId?: string): Promise<boolean> {
  try {
    const groupDocRef = groupRef(groupId);
    const userDocRef = userRef(userId);
    
    const groupSnap = await getDoc(groupDocRef);
    const userSnap = await getDoc(userDocRef);
    
    if (!groupSnap.exists() || !userSnap.exists()) {
      throw new Error("Group or user not found");
    }
    
    const userName = (userSnap.data() as any).name || (userSnap.data() as any).email || "User";
    let removedByName: string | null = null;
    if (removedByUserId && removedByUserId !== userId) {
      try {
        const removedBySnap = await getDoc(userRef(removedByUserId));
        removedByName = removedBySnap.exists()
          ? ((removedBySnap.data() as any).name || (removedBySnap.data() as any).email || "User")
          : null;
      } catch {}
    }
    const groupData = groupSnap.data();
    
    const updatedMembers = (groupData.members || []).filter((memberRef: any) => {
      return memberRef.id !== userId;
    });
    
    const userData = userSnap.data();
    const updatedGroups = (userData.groups || []).filter((gRef: any) => {
      return gRef.id !== groupId;
    });

    await updateDoc(userDocRef, { groups: updatedGroups });
    
    if (updatedMembers.length === 0) {
      const expensesQuery = query(collection(db, "groups", groupId, "expenses"));
      const expensesSnap = await getDocs(expensesQuery);
      const deleteExpensePromises = expensesSnap.docs.map((expenseDoc: any) => 
        deleteDoc(expenseDoc.ref)
      );
      await Promise.all(deleteExpensePromises);
      await deleteDoc(groupDocRef);
      return true;
    } else {
      await updateDoc(groupDocRef, { members: updatedMembers });
      
      const memberPermissions = groupData.memberPermissions || {};
      if (memberPermissions[userId]) {
        const updatedPermissions = { ...memberPermissions };
        delete updatedPermissions[userId];
        await updateDoc(groupDocRef, { memberPermissions: updatedPermissions });
      }
      
      if (removedByName) {
        await addGroupActivity(groupId, `${userName} was removed by ${removedByName}`);
      } else {
        await addGroupActivity(groupId, `${userName} left the group`);
      }
      return false;
    }
  } catch (error) {
    console.error("Error removing member from group:", error);
    throw error;
  }
}

export { db };

