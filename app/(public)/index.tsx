import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { useGlobalStyles } from "../../styles/global-styles";

export default function PublicHome() {
  const styles = useGlobalStyles();
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>SplitSmart</Text>
      <Text style={styles.subtitle}>
        Track shared expenses. Settle up fairly. Save the headache.
      </Text>

      <TouchableOpacity style={styles.button} onPress={() => router.push("/(public)/signup")}>
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(public)/login")}>
        <Text style={styles.linkText}>Already have an account? Sign in</Text>
      </TouchableOpacity>
    </View>
  );
}
