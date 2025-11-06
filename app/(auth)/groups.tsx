import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { Colors } from "../../constants/theme";
import { useAuth } from "../../contexts/auth-context";
import { addMemberToGroup, createGroup, getUserGroups } from "../../services/firebaseService";
import { useGlobalStyles } from "../../styles/global-styles";

export default function GroupsScreen() {
  const { user, refreshUserData } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const globalStyles = useGlobalStyles();

  useEffect(() => {
    if (!user) return;
    (async () => {
      const data = await getUserGroups(user.uid);
      setGroups(data);
      setLoading(false);
    })();
  }, [user]);

  const refresh = async () => {
    if (!user) return;
    const data = await getUserGroups(user.uid);
    setGroups(data);
  };

  const handleCreateGroup = async () => {
    if (!user) return;
    const name = newGroupName.trim();
    if (!name) {
      Alert.alert("Group name required", "Please enter a name for your group.");
      return;
    }
    try {
      setCreating(true);
      const groupId = await createGroup(name, user.uid, [user.uid]);
      setShowCreateModal(false);
      setNewGroupName("");
      await refreshUserData();
      await refresh();
      router.push({ pathname: "/groups/[id]", params: { id: groupId } });
    } catch (e: any) {
      Alert.alert("Couldn't create group", e?.message ?? "Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!user) return;
    const code = joinCode.trim();
    if (!code) {
      Alert.alert("Group code required", "Enter the group's code (ID) to join.");
      return;
    }
    try {
      setJoining(true);
      await addMemberToGroup(code, user.uid);
      setShowJoinModal(false);
      setJoinCode("");
      await refreshUserData();
      await refresh();
      router.push({ pathname: "/groups/[id]", params: { id: code } });
    } catch (e: any) {
      Alert.alert("Couldn't join group", e?.message ?? "Please check the code and try again.");
    } finally {
      setJoining(false);
    }
  };

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
        <View style={globalStyles.emptyContainer}>
          <Ionicons 
            name="people-outline" 
            size={64} 
            color={isDark ? "#3a3a3c" : "#dee2e6"} 
            style={globalStyles.emptyIcon}
          />
          <Text style={globalStyles.emptyText}>No groups yet</Text>
          <Text style={globalStyles.emptySubtext}>
            Create or join a group to start splitting expenses with friends
          </Text>
          <TouchableOpacity style={[globalStyles.button, { marginTop: 16, width: "100%" }]} onPress={() => setShowCreateModal(true)}>
            <Text style={globalStyles.buttonText}>Create a Group</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[globalStyles.button, { backgroundColor: isDark ? "#3a3a3c" : "#6c757d", width: "100%" }]} onPress={() => setShowJoinModal(true)}>
            <Text style={globalStyles.buttonText}>Join with Code</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 }}>
            <View style={[globalStyles.card]}> 
              <Text style={globalStyles.cardTitle}>Create Group</Text>
              <TextInput
                placeholder="Group name"
                placeholderTextColor={isDark ? "#9BA1A6" : "#6c757d"}
                style={globalStyles.input}
                value={newGroupName}
                onChangeText={setNewGroupName}
                autoFocus
              />
              <TouchableOpacity style={globalStyles.button} onPress={handleCreateGroup} disabled={creating}>
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={globalStyles.buttonText}>Create</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[globalStyles.button, { backgroundColor: isDark ? "#3a3a3c" : "#adb5bd" }]} onPress={() => setShowCreateModal(false)} disabled={creating}>
                <Text style={globalStyles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showJoinModal} transparent animationType="slide" onRequestClose={() => setShowJoinModal(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 }}>
            <View style={[globalStyles.card]}> 
              <Text style={globalStyles.cardTitle}>Join Group</Text>
              <TextInput
                placeholder="Enter group code (ID)"
                placeholderTextColor={isDark ? "#9BA1A6" : "#6c757d"}
                style={globalStyles.input}
                value={joinCode}
                onChangeText={setJoinCode}
                autoCapitalize="none"
              />
              <TouchableOpacity style={globalStyles.button} onPress={handleJoinGroup} disabled={joining}>
                {joining ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={globalStyles.buttonText}>Join</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[globalStyles.button, { backgroundColor: isDark ? "#3a3a3c" : "#adb5bd" }]} onPress={() => setShowJoinModal(false)} disabled={joining}>
                <Text style={globalStyles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={globalStyles.screen}>
      <Text style={globalStyles.title}>Your Groups</Text>
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
        <TouchableOpacity style={[globalStyles.button, { flex: 1 }]} onPress={() => setShowCreateModal(true)}>
          <Text style={globalStyles.buttonText}>Create Group</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[globalStyles.button, { flex: 1, backgroundColor: isDark ? "#3a3a3c" : "#6c757d" }]} onPress={() => setShowJoinModal(true)}>
          <Text style={globalStyles.buttonText}>Join with Code</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={globalStyles.listContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={globalStyles.card}
            onPress={() => router.push({ pathname: "/groups/[id]", params: { id: item.id } })}
            activeOpacity={0.7}
          >
            <Text style={globalStyles.cardTitle}>{item.name}</Text>
            <View style={globalStyles.rowContainer}>
              <Ionicons 
                name="people" 
                size={16} 
                color={isDark ? "#9BA1A6" : "#6c757d"} 
              />
              <Text style={globalStyles.metaText}>
                {item.members?.length || 0} {item.members?.length === 1 ? "member" : "members"}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 }}>
          <View style={[globalStyles.card]}> 
            <Text style={globalStyles.cardTitle}>Create Group</Text>
            <TextInput
              placeholder="Group name"
              placeholderTextColor={isDark ? "#9BA1A6" : "#6c757d"}
              style={globalStyles.input}
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
            />
            <TouchableOpacity style={globalStyles.button} onPress={handleCreateGroup} disabled={creating}>
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={globalStyles.buttonText}>Create</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[globalStyles.button, { backgroundColor: isDark ? "#3a3a3c" : "#adb5bd" }]} onPress={() => setShowCreateModal(false)} disabled={creating}>
              <Text style={globalStyles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showJoinModal} transparent animationType="slide" onRequestClose={() => setShowJoinModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 }}>
          <View style={[globalStyles.card]}> 
            <Text style={globalStyles.cardTitle}>Join Group</Text>
            <TextInput
              placeholder="Enter group code (ID)"
              placeholderTextColor={isDark ? "#9BA1A6" : "#6c757d"}
              style={globalStyles.input}
              value={joinCode}
              onChangeText={setJoinCode}
              autoCapitalize="none"
            />
            <TouchableOpacity style={globalStyles.button} onPress={handleJoinGroup} disabled={joining}>
              {joining ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={globalStyles.buttonText}>Join</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[globalStyles.button, { backgroundColor: isDark ? "#3a3a3c" : "#adb5bd" }]} onPress={() => setShowJoinModal(false)} disabled={joining}>
              <Text style={globalStyles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
