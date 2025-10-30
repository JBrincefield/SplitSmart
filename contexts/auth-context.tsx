import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebaseConfig";

type AuthContextType = {
    user: User | null;
    userData: any | null;
    loading: boolean;
    refreshUserData: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    userData: null,
    loading: true,
    refreshUserData: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Listen for Firebase Auth state changes
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

    // Fetch extended user data from Firestore (groups, name, etc.)
    const fetchUserData = async (uid: string) => {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) setUserData(userDoc.data());
    };

    const refreshUserData = async () => {
        if (user?.uid) await fetchUserData(user.uid);
    };

    return (
        <AuthContext.Provider value={{ user, userData, loading, refreshUserData }}>
        {children}
        </AuthContext.Provider>
    );
};

// Custom hook to access the context easily
export const useAuth = () => useContext(AuthContext);
