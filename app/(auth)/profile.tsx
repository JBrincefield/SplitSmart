/**
 * Profile Screen
 *
 * Lets the signed-in user view and update basic profile information (name),
 * see account metadata, and sign out. Writes to `users/{uid}` in Firestore and
 * refreshes the in-app user cache on save.
 */
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../contexts/auth-context";
import { SIZES, useGlobalStyles } from "../../styles/global-styles";

export default function ProfileScreen() {
  // Auth context exposes current Firebase user, cached userData document,
  // a refresh method, and a signOut action.
  const { user, userData, refreshUserData, signOut } = useAuth();
  const styles = useGlobalStyles();
  const localStyles = useLocalStyles();

  // Local form state and UI flags
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(userData?.name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);

  // Sign the user out of Firebase Auth
  const handleLogout = async () => {
    setIsLoggingOut(true);
    setMessage(null);
    try {
      await signOut();
    } catch {
      setMessage("Failed to sign out. Please try again.");
      setMessageType("error");
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Persist name change to Firestore and refresh local cache
  const handleSave = async () => {
    if (!name.trim()) {
      setMessage("Name cannot be empty");
      setMessageType("error");
      return;
    }

    setIsSaving(true);
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      const { db } = await import("../../firebaseConfig");
      
      await updateDoc(doc(db, "users", user!.uid), {
        name: name.trim(),
      });

      await refreshUserData();
      setIsEditing(false);
      setMessage("Profile updated successfully");
      setMessageType("success");
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage("Failed to update profile. Please try again.");
      setMessageType("error");
    } finally {
      setIsSaving(false);
    }
  };

  // Revert edits to the last saved value
  const handleCancel = () => {
    setName(userData?.name || "");
    setIsEditing(false);
  };

  // Human-readable date for "Member Since"
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

        {message ? (
          <View style={localStyles.messageBox}>
            <Text
              style={[
                localStyles.messageText,
                messageType === "success" ? localStyles.messageSuccess : undefined,
                messageType === "error" ? localStyles.messageError : undefined,
              ]}
            >
              {message}
            </Text>
          </View>
        ) : null}

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
                editable={!isSaving && !isLoggingOut}
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

        <View style={localStyles.buttonContainer}>
          {isEditing ? (
            <>
              <TouchableOpacity
                style={[styles.button, localStyles.saveButton]}
                onPress={handleSave}
                disabled={isSaving || isLoggingOut}
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
                disabled={isSaving || isLoggingOut}
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
                disabled={isLoggingOut}
              >
                <Text style={styles.buttonText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, localStyles.logoutButton]}
                onPress={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Sign Out</Text>
                )}
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

  // Styles scoped to this screen; uses tokens from global styles for theming
  return StyleSheet.create({
    container: {
      paddingVertical: SIZES.lg,
    },
    messageBox: {
      marginBottom: SIZES.md,
    },
    messageText: {
      fontSize: 14,
      textAlign: "center",
    },
    messageSuccess: {
      color: "#28a745",
    },
    messageError: {
      color: "#dc3545",
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
