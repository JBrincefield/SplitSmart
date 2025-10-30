import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../../contexts/auth-context";
import { logoutUser } from "../../../services/firebaseService";
import { SIZES, useGlobalStyles } from "../../../styles/global-styles";

export default function ProfileScreen() {
  const { user, userData, refreshUserData } = useAuth();
  const router = useRouter();
  const styles = useGlobalStyles();
  const localStyles = useLocalStyles();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(userData?.name || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleLogout = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await logoutUser();
            router.replace("/(public)");
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      const { db } = await import("../../../firebaseConfig");
      
      await updateDoc(doc(db, "users", user!.uid), {
        name: name.trim(),
      });

      await refreshUserData();
      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setName(userData?.name || "");
    setIsEditing(false);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <ScrollView style={styles.screen}>
      <View style={localStyles.container}>
        <Text style={styles.title}>Profile</Text>

        {/* Profile Info Card */}
        <View style={localStyles.card}>
          <View style={localStyles.infoSection}>
            <Text style={localStyles.infoLabel}>Name</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, localStyles.editInput]}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                autoCapitalize="words"
                editable={!isSaving}
              />
            ) : (
              <Text style={localStyles.infoValue}>
                {userData?.name || "Not set"}
              </Text>
            )}
          </View>

          <View style={localStyles.divider} />

          <View style={localStyles.infoSection}>
            <Text style={localStyles.infoLabel}>Email</Text>
            <Text style={localStyles.infoValue}>{user?.email}</Text>
          </View>

          <View style={localStyles.divider} />

          <View style={localStyles.infoSection}>
            <Text style={localStyles.infoLabel}>Member Since</Text>
            <Text style={localStyles.infoValue}>
              {formatDate(userData?.createdAt)}
            </Text>
          </View>

          <View style={localStyles.divider} />

          <View style={localStyles.infoSection}>
            <Text style={localStyles.infoLabel}>Groups</Text>
            <Text style={localStyles.infoValue}>
              {userData?.groups?.length || 0}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={localStyles.buttonContainer}>
          {isEditing ? (
            <>
              <TouchableOpacity
                style={[styles.button, localStyles.saveButton]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, localStyles.cancelButton]}
                onPress={handleCancel}
                disabled={isSaving}
              >
                <Text style={[styles.buttonText, localStyles.cancelButtonText]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.button, localStyles.editButton]}
                onPress={() => setIsEditing(true)}
              >
                <Text style={styles.buttonText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, localStyles.logoutButton]}
                onPress={handleLogout}
              >
                <Text style={styles.buttonText}>Sign Out</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const useLocalStyles = () => {
  const globalStyles = useGlobalStyles();

  return StyleSheet.create({
    container: {
      paddingVertical: SIZES.lg,
    },
    card: {
      backgroundColor: globalStyles.input.backgroundColor,
      borderRadius: 12,
      padding: SIZES.lg,
      marginBottom: SIZES.xl,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    infoSection: {
      paddingVertical: SIZES.md,
    },
    infoLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: globalStyles.subtitle.color,
      marginBottom: SIZES.xs,
    },
    infoValue: {
      fontSize: 16,
      color: globalStyles.title.color,
      fontWeight: "400",
    },
    divider: {
      height: 1,
      backgroundColor: globalStyles.input.borderColor,
    },
    editInput: {
      marginBottom: 0,
      marginTop: SIZES.xs,
    },
    buttonContainer: {
      gap: SIZES.md,
    },
    editButton: {
      backgroundColor: globalStyles.button.backgroundColor,
    },
    saveButton: {
      backgroundColor: "#28a745",
    },
    cancelButton: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: globalStyles.input.borderColor,
    },
    cancelButtonText: {
      color: globalStyles.title.color,
    },
    logoutButton: {
      backgroundColor: "#dc3545",
    },
  });
};
