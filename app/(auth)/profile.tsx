import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../contexts/auth-context";
import { logoutUser } from "../../services/firebaseService";
import { useGlobalStyles } from "../../styles/global-styles";

export default function ProfileScreen() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const styles = useGlobalStyles();

  const handleLogout = async () => {
    await logoutUser();
    router.replace("/(public)");
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>{userData?.name || user?.email}</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={handleLogout}
      >
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}
