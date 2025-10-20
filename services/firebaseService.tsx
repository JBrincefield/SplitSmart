// src/services/firebaseService.js

import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
    query,
    setDoc,
    updateDoc
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

// -------------------- AUTH FUNCTIONS --------------------

// Register a new user
export async function registerUser(email: string, password: string, name: string): Promise<any> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Create user document in Firestore
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

// Login existing user
export async function loginUser(email: string, password: string): Promise<any> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error logging in:", error);
    throw error;
  }
}

// Logout user
export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error logging out:", error);
    throw error;
  }
}

// -------------------- GROUP FUNCTIONS --------------------

// Create a new group
//TODO: Change members/createdBy to user IDs/references
export async function createGroup(name: string, createdBy: string, members: string[]) {
  try {
    const groupRef = await addDoc(collection(db, "groups"), {
      name,
      createdBy,
      members,
      createdAt: new Date().toISOString(),
    });

    // Add this group to each member’s user document
    for (const userId of members) {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userGroups = userSnap.data().groups || [];
        await updateDoc(userRef, { groups: [...userGroups, groupRef.id] });
      }
    }

    return groupRef.id;
  } catch (error) {
    console.error("Error creating group:", error);
    throw error;
  }
}

// Get all groups for a user
//TODO: Change members/createdBy to user IDs/references
export async function getUserGroups(userId: string) {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return [];
    const groupIds = userDoc.data().groups || [];

    // Fetch group details
    const groups = [];
    for (const id of groupIds) {
      const groupDoc = await getDoc(doc(db, "groups", id));
      if (groupDoc.exists()) {
        groups.push({ id, ...groupDoc.data() });
      }
    }
    return groups;
  } catch (error) {
    console.error("Error fetching user groups:", error);
    throw error;
  }
}

// -------------------- EXPENSE FUNCTIONS --------------------

// Add an expense to a group
//TODO: Change members/createdBy to user IDs/references
export async function addExpense(groupId: string, title: string, amount: number, paidBy: string, sharedWith: string[], notes = "") {
  try {
    const expenseRef = await addDoc(collection(db, "groups", groupId, "expenses"), {
      title,
      amount,
      paidBy,
      sharedWith,
      notes,
      date: new Date().toISOString(),
    });
    return expenseRef.id;
  } catch (error) {
    console.error("Error adding expense:", error);
    throw error;
  }
}

// Get all expenses for a group
export async function getGroupExpenses(groupId: string, onUpdate: (expenses: any[]) => void) {
  try {
    const q = query(collection(db, "groups", groupId, "expenses"));
    return onSnapshot(q, (snapshot) => {
      const expenses = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      onUpdate(expenses);
    });
  } catch (error) {
    console.error("Error getting expenses:", error);
    throw error;
  }
}

// Delete an expense
//TODO: Change members/createdBy to user IDs/references
export async function deleteExpense(groupId: string, expenseId: string) {
  try {
    await deleteDoc(doc(db, "groups", groupId, "expenses", expenseId));
  } catch (error) {
    console.error("Error deleting expense:", error);
    throw error;
  }
}
