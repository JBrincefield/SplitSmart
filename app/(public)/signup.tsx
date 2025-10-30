import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { registerUser } from "../../services/firebaseService";
import { useGlobalStyles } from "../../styles/global-styles";

export default function SignupScreen() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const styles = useGlobalStyles();

    const handleSignup = async () => {
        try {
        await registerUser(email, password, name);
        Alert.alert("Success", "Account created! You can now log in.");
        router.push("/(public)/login");
        } catch (err: any) {
        Alert.alert("Signup Failed", err.message);
        }
    };

    return (
        <View style={styles.screen}>
        <Text style={styles.title}>Create Account</Text>
        <TextInput placeholder="Name" value={name} onChangeText={setName} style={styles.input} />
        <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} />
        <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
        />
        <TouchableOpacity style={styles.button} onPress={handleSignup}>
            <Text style={styles.buttonText}>Sign Up</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => router.push("/(public)/login")}>
            <Text style={styles.linkText}>Already have an account? Log in</Text>
        </TouchableOpacity>
        </View>
    );
}
