import { useAuth } from "@/contexts/auth-context";
import { createGroup, getUserGroups, getUserRecentActivity } from "@/services/firebaseService";
import { SIZES, useGlobalStyles } from "@/styles/global-styles";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function AuthHome() {
    const styles = useGlobalStyles();
    const { user, refreshUserData } = useAuth();
    const router = useRouter();

    // Narrow the group shape just enough for this screen
    type GroupItem = { id: string; name?: string; members?: any[] };
    const [groups, setGroups] = useState<GroupItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [creating, setCreating] = useState(false);
    const [activity, setActivity] = useState<Array<{ groupId: string; groupName: string; text: string; createdAt: string | null }>>([]);
    const [activityLoading, setActivityLoading] = useState<boolean>(true);

    // Data: Load user's groups
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!user) {
                setGroups([]);
                setLoading(false);
                return;
            }

            try {
                const data = await getUserGroups(user.uid);
                if (!cancelled) setGroups(data ?? []);
            } catch (err) {
                // Swallow fetch errors; show empty state
                if (!cancelled) setGroups([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [user]);

    // Data: Load recent activity for the signed-in user
    useEffect(() => {
        let cancelled = false;
        const loadActivity = async () => {
            if (!user) {
                setActivity([]);
                setActivityLoading(false);
                return;
            }
            try {
                setActivityLoading(true);
                const items = await getUserRecentActivity(user.uid, 10);
                if (!cancelled) setActivity(items);
            } catch (e) {
                // Swallow fetch errors; show empty state
                if (!cancelled) setActivity([]);
            } finally {
                if (!cancelled) setActivityLoading(false);
            }
        };
        loadActivity();
        return () => { cancelled = true; };
    }, [user]);

    const refresh = async () => {
        if (!user) return;
        const data = await getUserGroups(user.uid);
        setGroups(data ?? []);
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
            await refreshUserData?.();
            await refresh();
            router.push({ pathname: "/groups/[id]", params: { id: groupId } });
        } catch (e: any) {
            Alert.alert("Couldn't create group", e?.message ?? "Please try again.");
        } finally {
            setCreating(false);
        }
    };

    return (
        <View style={[styles.screen, { flex: 1 }]}> 

            <Text style={styles.title}>
                Welcome back, {user?.displayName || user?.email || "Friend"}
            </Text>

            {/* Quick Actions */}
            <View style={{ flexDirection: "row", gap: SIZES.md, marginBottom: SIZES.lg }}>
                <TouchableOpacity
                    style={[styles.button, { flex: 1 }]}
                    onPress={() => setShowCreateModal(true)}
                    accessibilityRole="button"
                >
                    <Text style={styles.buttonText}>New Group</Text>
                </TouchableOpacity>
            </View>

            {/* Section — Recent Activity */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                {activityLoading ? (
                    <ActivityIndicator size="small" color="#666" />
                ) : activity.length === 0 ? (
                    <Text style={styles.itemSubtitle}>No recent activity yet.</Text>
                ) : (
                    <View style={{ gap: SIZES.xs }}>
                        {activity.slice(0, 5).map((a, idx) => (
                            <Text key={`${a.groupId}-${idx}`} style={styles.metaText} numberOfLines={2}>
                                {a.text} <Text style={{ color: "#6c757d" }}>— {a.groupName}{a.createdAt ? ` • ${formatRelativeTime(a.createdAt)}` : ""}</Text>
                            </Text>
                        ))}
                    </View>
                )}
            </View>

            {/* Section — Your Groups (fills remaining space) */}
            <View style={[styles.section, { flex: 1 }]}> 
                <Text style={styles.sectionTitle}>Your Groups</Text>

                {loading ? (
                    <View style={{ paddingVertical: SIZES.md }}>
                        <ActivityIndicator size="small" color="#666" />
                    </View>
                ) : groups.length === 0 ? (
                    <View>
                        <Text style={styles.itemSubtitle}>You haven’t joined any groups yet.</Text>
                        <View style={{ flexDirection: "row", gap: SIZES.sm, marginTop: SIZES.md }}>
                            <TouchableOpacity style={{ marginRight: SIZES.sm }} onPress={() => setShowCreateModal(true) }>
                                <Text style={styles.linkText}>Create a group</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push("/groups") }>
                                <Text style={styles.linkText}>Browse groups</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <FlatList
                        data={groups}
                        keyExtractor={(item) => String(item.id)}
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingVertical: SIZES.sm }}
                        renderItem={({ item }) => (
                            <Pressable
                                onPress={() => router.push(`/groups/${item.id}`)}
                                style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
                                accessibilityRole="button"
                            >
                                <Text style={styles.cardTitle}>{item.name ?? "Untitled group"}</Text>
                                <Text style={styles.metaText}>{(item.members?.length ?? 0)} members</Text>
                            </Pressable>
                        )}
                    />
                )}

                {!loading && (
                    <TouchableOpacity onPress={() => router.push("/groups") }>
                        <Text style={styles.linkText}>View all groups →</Text>
                    </TouchableOpacity>
                )}
            </View>

                {/* Modal — Create Group */}
            <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 }}>
                    <View style={[styles.card]}> 
                        <Text style={styles.cardTitle}>Create Group</Text>
                        <TextInput
                            placeholder="Group name"
                            placeholderTextColor="#6c757d"
                            style={styles.input}
                            value={newGroupName}
                            onChangeText={setNewGroupName}
                            autoFocus
                        />
                        <TouchableOpacity style={styles.button} onPress={handleCreateGroup} disabled={creating}>
                            {creating ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>Create</Text>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.button, { backgroundColor: "#adb5bd" }]} onPress={() => setShowCreateModal(false)} disabled={creating}>
                            <Text style={styles.buttonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

    // Lightweight relative time formatter (minutes/hours/days)
    function formatRelativeTime(iso: string) {
        try {
            const then = new Date(iso).getTime();
            const now = Date.now();
            const diffMs = Math.max(0, now - then);
            const mins = Math.floor(diffMs / 60000);
            if (mins < 1) return "just now";
            if (mins < 60) return `${mins}m ago`;
            const hrs = Math.floor(mins / 60);
            if (hrs < 24) return `${hrs}h ago`;
            const days = Math.floor(hrs / 24);
            return `${days}d ago`;
        } catch {
            return "";
        }
    }
