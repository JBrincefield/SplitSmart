import { useRouter } from "expo-router";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useGlobalStyles } from "../../styles/global-styles";

export default function PublicHomeScreen() {
  const router = useRouter();
  const styles = useGlobalStyles();

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Welcome To SplitSmart!</Text>
      <Text style={styles.subtitle}>
        This is a Cost Sharing App. Please log in to continue.
      </Text>
      <TouchableOpacity style={styles.button} onPress={() => router.push("/(public)/login")}>
        <Text style={styles.buttonText}>Log In</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push("/(public)/signup")}>
        <Text style={styles.linkText}>Don't have an account? Sign up</Text>
      </TouchableOpacity>
    </View>
  );
}
