/**
 * Group Details Screen
 *
 * Displays a single group's overview: group code, list of expenses with quick status,
 * recent activity, and member roster. Also provides a modal to add a new expense
 * shared among selected group members.
 *
 * Data flow
 * - On mount: fetches group details (members resolved to basic user info) and
 *   subscribes to the group's expenses collection for live updates.
 * - Adding expense: writes a new expense with the current user as payer and the
 *   selected member ids as participants.
 *
 * UX notes
 * - "Copy Code" attempts to copy to clipboard on web; otherwise falls back to share.
 * - Expense items show a status icon: completed, everyone paid, or still pending.
 * - The layout switches to two/three columns on wide screens.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, useColorScheme, useWindowDimensions, View } from "react-native";
import { Colors } from "../../../constants/theme";
import { useAuth } from "../../../contexts/auth-context";
import { addExpense, getGroupById, getGroupExpenses } from "../../../services/firebaseService";
import { useGlobalStyles } from "../../../styles/global-styles";

export default function GroupDetails() {
    // Route params: group id comes from the dynamic route [id]
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const { width } = useWindowDimensions();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
    // Basic group data and expenses list
    const [group, setGroup] = useState<any>(null);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    // Add-expense modal state
    const [showAddExpense, setShowAddExpense] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newAmount, setNewAmount] = useState("");
    const [newNotes, setNewNotes] = useState("");
    const [savingExpense, setSavingExpense] = useState(false);
    // User ids selected to share the new expense with
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const styles = useGlobalStyles();

    const isWide = width > 900;

    useEffect(() => {
        // Fetch group details and start realtime subscription to expenses.
        // Returns an unsubscribe function for the listener.
        let unsubscribe: undefined | (() => void);
        (async () => {
            const data = await getGroupById(id as string);
            setGroup(data);
            if (data?.members) {
                const all = data.members.map((m: any) => m.id).filter(Boolean);
                if (user?.uid && all.includes(user.uid)) {
                    setSelectedMemberIds(all);
                } else {
                    setSelectedMemberIds(all);
                }
            }
            setLoading(false);

            try {
                // Subscribe to expenses for this group; update local state on changes
                const unsubPromise = getGroupExpenses(id as string, (items) => setExpenses(items));
                unsubscribe = await unsubPromise;
            } catch (e) {
                unsubscribe = undefined;
            }
        })();
        return () => {
            // Clean up the subscription when leaving the screen
            if (unsubscribe) unsubscribe();
        };
    }, [id]);

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={isDark ? Colors.dark.tint : Colors.light.tint} />
            </View>
        );
    }

    if (!group) {
        return (
            <View style={styles.container}>
                <Text style={styles.subtitle}>Group not found.</Text>
            </View>
        );
    }

    const layoutStyles = StyleSheet.create({
        columnsContainer: {
            flexDirection: isWide ? "row" : "column",
            gap: 16,
            justifyContent: "space-between",
        },
        expensesColumn: {
            flex: 1,
        },
        activityColumn: {
            flex: 1,
        },
        membersColumn: {
            flex: isWide ? 0.5 : 1,
        },
    });

    return (
        <ScrollView style={[styles.screen, { flex: 1 }]}>
            <Text style={styles.title}>{group.name}</Text>

            <View style={[styles.section, { marginBottom: 16 }]}> 
            <Text style={styles.sectionTitle}>Group Code</Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.itemSubtitle}>Use this code to let others join your group:</Text>
                    <Text style={[styles.itemTitle, { marginTop: 6 }]}>{String(id)}</Text>
                </View>
                <View style={{ gap: 8 }}>
                    <TouchableOpacity
                        style={[styles.button, { alignSelf: "flex-end" }]}
                        onPress={async () => {
                            try {
                                // On web, try clipboard API; otherwise share as fallback
                                const code = String(id);
                                if (Platform.OS === "web" && (globalThis as any)?.navigator?.clipboard?.writeText) {
                                    await (globalThis as any).navigator.clipboard.writeText(code);
                                    Alert.alert("Copied", "Group code copied to clipboard.");
                                } else {
                                    await Share.share({
                                        message: `Join my SplitSmart group: ${group.name}\nCode: ${code}`,
                                    });
                                }
                            } catch (e: any) {
                                Alert.alert("Couldn't copy/share", e?.message ?? "Please try again.");
                            }
                        }}
                    >
                        <Text style={styles.buttonText}>Copy Code</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: "#6c757d", alignSelf: "flex-end" }]}
                        onPress={async () => {
                            try {
                                // Explicit share flow regardless of platform
                                const code = String(id);
                                await Share.share({
                                    message: `Join my SplitSmart group: ${group.name}\nCode: ${code}`,
                                });
                            } catch (e: any) {
                                Alert.alert("Share failed", e?.message ?? "Please try again.");
                            }
                        }}
                    >
                        <Text style={styles.buttonText}>Share Code</Text>
                    </TouchableOpacity>
                </View>
            </View>
            </View>

            <View style={layoutStyles.columnsContainer}>
                <View style={[styles.section, layoutStyles.expensesColumn]}>
                    <Text style={styles.sectionTitle}>Expenses</Text>
                    {!!user && (
                        <TouchableOpacity style={[styles.button, { alignSelf: "flex-start", marginBottom: 12 }]} onPress={() => setShowAddExpense(true)}>
                            <Text style={styles.buttonText}>Add Expense</Text>
                        </TouchableOpacity>
                    )}
                    <FlatList
                        data={expenses}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.itemCard}
                                onPress={() => router.push({ pathname: "/expenses/[id]", params: { id: item.id, groupId: id as string } })}
                                activeOpacity={0.7}
                            >
                                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                    {/* Status Icon: completed, everyone paid, or waiting */}
                                    {(() => {
                                        const completed = !!item.completed;
                                        const participants = Array.isArray(item.participants) ? item.participants : [];
                                        const total = participants.length;
                                        const paidCount = participants.filter((p: any) => p?.status === "paid").length;
                                        const iconName = completed
                                            ? "checkmark-circle"
                                            : total > 0 && paidCount === total
                                            ? "checkmark-done-circle-outline"
                                            : "time-outline";
                                        const iconColor = completed ? "#28a745" : total > 0 && paidCount === total ? "#28a745" : (isDark ? "#f0ad4e" : "#fd7e14");
                                        return <Ionicons name={iconName as any} size={20} color={iconColor} />;
                                    })()}
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                                    <Text style={styles.itemSubtitle}>${item.amount}</Text>
                                    {Array.isArray(item.participants) && item.participants.length > 0 ? (
                                        <Text style={styles.itemSubtitle}>
                                            {item.participants.filter((p: any) => p?.status === "paid").length}/{item.participants.length} paid
                                        </Text>
                                    ) : null}
                                </View>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={styles.itemSubtitle}>No expenses yet.</Text>}
                        scrollEnabled={false}
                    />
                </View>

                <View style={[styles.section, layoutStyles.activityColumn]}>
                    <Text style={styles.sectionTitle}>Activity</Text>
                    {group.activity && group.activity.length > 0 ? (
                        group.activity.map((a: any, idx: number) => {
                            const text = typeof a === "string" ? a : a?.text ?? "";
                            const date = typeof a === "string" ? undefined : a?.date;
                            return (
                                <View key={idx} style={styles.activityItem}>
                                    <Text style={styles.activityText}>{text}</Text>
                                    {date ? <Text style={styles.activityDate}>{date}</Text> : null}
                                </View>
                            );
                        })
                    ) : (
                        <Text style={styles.itemSubtitle}>No recent activity.</Text>
                    )}
                </View>

                <View style={[styles.section, layoutStyles.membersColumn]}>
                    <Text style={styles.sectionTitle}>Members</Text>
                    {group.members && group.members.length > 0 ? (
                        group.members.map((m: any, idx: number) => (
                            <View key={m.id || idx} style={styles.memberCard}>
                                <Text style={styles.memberName}>{m.name}</Text>
                                {m.email && <Text style={styles.itemSubtitle}>{m.email}</Text>}
                            </View>
                        ))
                    ) : (
                        <Text style={styles.itemSubtitle}>No members yet.</Text>
                    )}
                </View>
            </View>

            <Modal visible={showAddExpense} transparent animationType="slide" onRequestClose={() => setShowAddExpense(false)}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 }}>
                    <View style={[styles.section]}>
                        <Text style={styles.sectionTitle}>Add Expense</Text>
                        <TextInput
                            placeholder="Title"
                            placeholderTextColor={isDark ? "#9BA1A6" : "#6c757d"}
                            style={styles.input}
                            value={newTitle}
                            onChangeText={setNewTitle}
                        />
                        <TextInput
                            placeholder="Amount"
                            keyboardType="decimal-pad"
                            placeholderTextColor={isDark ? "#9BA1A6" : "#6c757d"}
                            style={styles.input}
                            value={newAmount}
                            onChangeText={setNewAmount}
                        />
                        <TextInput
                            placeholder="Notes (optional)"
                            placeholderTextColor={isDark ? "#9BA1A6" : "#6c757d"}
                            style={styles.input}
                            value={newNotes}
                            onChangeText={setNewNotes}
                        />
                        <Text style={[styles.label, { marginTop: 4 }]}>Shared between</Text>
                        <View style={{ maxHeight: 220, marginBottom: 8 }}>
                            <FlatList
                                data={group.members || []}
                                keyExtractor={(m: any) => m.id}
                                renderItem={({ item: m }) => {
                                    const isCurrent = !!user && m.id === user.uid;
                                    const selected = isCurrent || selectedMemberIds.includes(m.id);
                                    return (
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (isCurrent) return;
                                                // Toggle selection for the member
                                                setSelectedMemberIds((prev) =>
                                                    prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]
                                                );
                                            }}
                                            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}
                                        >
                                            <Ionicons
                                                name={selected ? "checkbox-outline" : "square-outline"}
                                                size={20}
                                                color={selected ? (isDark ? "#0dcaf0" : Colors.light.tint) : (isDark ? "#9BA1A6" : "#6c757d")}
                                            />
                                            <Text style={{ marginLeft: 8, color: isDark ? "#fff" : "#212529" }}>
                                                {m.name || m.email || m.id}
                                                {isCurrent ? "  (You)" : ""}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                                <TouchableOpacity
                                    style={[styles.button, { flex: 1 }]}
                                    // Quickly select all members in the group
                                    onPress={() => setSelectedMemberIds((group.members || []).map((m: any) => m.id))}
                                >
                                    <Text style={styles.buttonText}>Select All</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.button, { flex: 1, backgroundColor: isDark ? "#3a3a3c" : "#adb5bd" }]}
                                    onPress={() => {
                                        // Clear selection, but keep current user selected if they are a member
                                        if (user?.uid && (group.members || []).some((m: any) => m.id === user.uid)) {
                                            setSelectedMemberIds([user.uid]);
                                        } else {
                                            setSelectedMemberIds([]);
                                        }
                                    }}
                                >
                                    <Text style={styles.buttonText}>Clear</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={{ flexDirection: "row", gap: 12 }}>
                            <TouchableOpacity
                                style={[styles.button, { flex: 1 }]}
                                disabled={savingExpense}
                                onPress={async () => {
                                    if (!user) return;
                                    const title = newTitle.trim();
                                    const amountNum = parseFloat(newAmount);
                                    // Validate inputs: require title, positive amount, at least one member
                                    if (!title || !isFinite(amountNum) || amountNum <= 0) return;
                                    if (!selectedMemberIds || selectedMemberIds.length === 0) {
                                        Alert.alert("Select members", "Choose at least one member to share this expense.");
                                        return;
                                    }
                                    try {
                                        setSavingExpense(true);
                                        // Ensure payer is included in sharing list
                                        const shareIds = selectedMemberIds.includes(user.uid)
                                            ? selectedMemberIds
                                            : [...selectedMemberIds, user.uid];
                                        await addExpense(id as string, title, title, amountNum, user.uid, shareIds, newNotes.trim());
                                        setShowAddExpense(false);
                                        setNewTitle("");
                                        setNewAmount("");
                                        setNewNotes("");
                                    } finally {
                                        setSavingExpense(false);
                                    }
                                }}
                            >
                                <Text style={styles.buttonText}>{savingExpense ? "Saving..." : "Save"}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, { flex: 1, backgroundColor: isDark ? "#3a3a3c" : "#adb5bd" }]}
                                onPress={() => setShowAddExpense(false)}
                                disabled={savingExpense}
                            >
                                <Text style={styles.buttonText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}
