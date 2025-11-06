import AsyncStorage from "@react-native-async-storage/async-storage";
import { signOut as firebaseSignOut, onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebaseConfig";

type AuthContextType = {
    user: User | null;
    userData: any | null;
    loading: boolean;
    refreshUserData: () => Promise<void>;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    userData: null,
    loading: true,
    refreshUserData: async () => {},
    signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        setUser(firebaseUser);
        if (firebaseUser) {
            await AsyncStorage.setItem("user", JSON.stringify(firebaseUser));
            await fetchUserData(firebaseUser.uid);
        } else {
            await AsyncStorage.removeItem("user");
            setUserData(null);
        }
        setLoading(false);
        });
        return unsubscribe;
    }, []);

    const fetchUserData = async (uid: string) => {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) setUserData(userDoc.data());
    };

    const refreshUserData = async () => {
        if (user?.uid) await fetchUserData(user.uid);
    };

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            await AsyncStorage.removeItem("user");
            setUser(null);
            setUserData(null);
        } catch (e) {
            console.error("Error signing out:", e);
        }
    };

    return (
        <AuthContext.Provider value={{ user, userData, loading, refreshUserData, signOut }}>
        {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
