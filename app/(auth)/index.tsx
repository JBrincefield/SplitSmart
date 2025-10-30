import React from "react";
import { Text, View } from "react-native";
import { useAuth } from "../../contexts/auth-context";
import { useGlobalStyles } from "../../styles/global-styles";

export default function AuthHomeScreen() {
    const { user, userData } = useAuth();
    const styles = useGlobalStyles();

    return (
        <View style={styles.screen}>
            <Text style={styles.title}>Welcome back, {userData?.name || user?.email}!</Text>
            <Text style={styles.subtitle}>
                You are in {userData?.groups?.length || 0} group(s)
            </Text>
        </View>
    );
}
