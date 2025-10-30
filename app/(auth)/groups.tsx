import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { Colors } from "../../constants/theme";
import { useAuth } from "../../contexts/auth-context";
import { getUserGroups } from "../../services/firebaseService";
import { useGlobalStyles } from "../../styles/global-styles";

export default function GroupsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const globalStyles = useGlobalStyles();

  useEffect(() => {
    if (!user) return;
    (async () => {
      const data = await getUserGroups(user.uid);
      setGroups(data);
      setLoading(false);
    })();
  }, [user]);

  const styles = StyleSheet.create({
    groupCard: {
      backgroundColor: isDark ? "#1c1c1e" : "#fff",
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? "#2b2d31" : "#dee2e6",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    groupName: {
      fontSize: 18,
      fontWeight: "600",
      color: isDark ? Colors.dark.text : Colors.light.text,
      marginBottom: 4,
    },
    groupMeta: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
    },
    groupMembers: {
      color: isDark ? "#9BA1A6" : "#6c757d",
      fontSize: 14,
      marginLeft: 4,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: "600",
      color: isDark ? Colors.dark.text : Colors.light.text,
      marginBottom: 8,
      textAlign: "center",
    },
    emptySubtext: {
      color: isDark ? "#9BA1A6" : "#6c757d",
      fontSize: 14,
      textAlign: "center",
    },
    listContainer: {
      paddingBottom: 20,
    },
  });

  if (loading) {
    return (
      <View style={globalStyles.container}>
        <ActivityIndicator size="large" color={isDark ? Colors.dark.tint : Colors.light.tint} />
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <View style={globalStyles.screen}>
        <Text style={globalStyles.title}>Your Groups</Text>
        <View style={styles.emptyContainer}>
          <Ionicons 
            name="people-outline" 
            size={64} 
            color={isDark ? "#3a3a3c" : "#dee2e6"} 
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyText}>No groups yet</Text>
          <Text style={styles.emptySubtext}>
            Create or join a group to start splitting expenses with friends
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={globalStyles.screen}>
      <Text style={globalStyles.title}>Your Groups</Text>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.groupCard}
            onPress={() => router.push({ pathname: "/groups/[id]", params: { id: item.id } })}
            activeOpacity={0.7}
          >
            <Text style={styles.groupName}>{item.name}</Text>
            <View style={styles.groupMeta}>
              <Ionicons 
                name="people" 
                size={16} 
                color={isDark ? "#9BA1A6" : "#6c757d"} 
              />
              <Text style={styles.groupMembers}>
                {item.members?.length || 0} {item.members?.length === 1 ? "member" : "members"}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
