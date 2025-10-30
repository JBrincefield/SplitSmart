import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { loginUser } from "../../services/firebaseService";
import { useGlobalStyles } from "../../styles/global-styles";

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const styles = useGlobalStyles();

    const handleLogin = async () => {
        try {
        const user = await loginUser(email, password);
        Alert.alert("Welcome", `Logged in as ${user.email}`);
        router.replace("/(auth)");
        } catch (err: any) {
        Alert.alert("Login Failed", err.message);
        }
    };

    return (
        <View style={styles.screen}>
        <Text style={styles.title}>SplitSmart</Text>
        <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
        />
        <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(public)/signup")}>
            <Text style={styles.linkText}>Don't have an account? Sign up</Text>
        </TouchableOpacity>
        </View>
    );
}
