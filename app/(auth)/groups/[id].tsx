// Group Details: displays expenses, activity, members with expandable balance breakdowns.
// Responsive layout switches to columns on wide screens.
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, useColorScheme, useWindowDimensions, View } from "react-native";
import { ExpenseSplit } from "../../../components/model/expense";
import SplitEditor from "../../../components/split-editor";
import { Colors } from "../../../constants/theme";
import { useAuth } from "../../../contexts/auth-context";
import { addExpense, addMemberToGroup, getGroupById, getGroupExpenses, removeMemberFromGroup, setMemberPermissions } from "../../../services/firebaseService";
import { useGlobalStyles } from "../../../styles/global-styles";
import { computeShares } from "../../../utils/split";

export default function GroupDetails() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const { width } = useWindowDimensions();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
    const [group, setGroup] = useState<any>(null);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddExpense, setShowAddExpense] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newAmount, setNewAmount] = useState("");
    const [newNotes, setNewNotes] = useState("");
    const [savingExpense, setSavingExpense] = useState(false);
    const [split, setSplit] = useState<ExpenseSplit | undefined>(undefined);
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [leavingGroup, setLeavingGroup] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
    const [showAddMember, setShowAddMember] = useState(false);
    const [newMemberUserId, setNewMemberUserId] = useState("");
    const [savingPerm, setSavingPerm] = useState<string | null>(null);
    const styles = useGlobalStyles();

    const isWide = width > 900;
    useEffect(() => {
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
                const unsubPromise = getGroupExpenses(id as string, (items) => setExpenses(items));
                unsubscribe = await unsubPromise;
            } catch (e) {
                unsubscribe = undefined;
            }
        })();
        return () => {
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

    const isUserMember = user && group.members?.some((m: any) => m.id === user.uid);
    const currentUserId = user?.uid;
    const ownerId = (group?.createdBy?.id || group?.createdBy) as string | undefined;
    
    const getPerms = (uid?: string) => {
        if (!uid) return { canCreateExpenses: false, canInvite: false, canKick: false };
        const map = (group as any)?.memberPermissions || {};
        const base = map[uid] || {};
        const isOwner = ownerId === uid;
        const perms = {
            canCreateExpenses: isOwner || !!base.canCreateExpenses,
            canInvite: isOwner || !!base.canInvite,
            canKick: isOwner || !!base.canKick,
        };
        return perms;
    };

    const myPerms = getPerms(currentUserId);
    const toggleBg = (on: boolean) => (on ? (isDark ? "#198754" : "#28a745") : (isDark ? "#3a3a3c" : "#6c757d"));

    // Calculate per-member balance: what they owe, what they paid, and net balance
    const calculateMemberExpenses = (memberId: string) => {
        let totalOwed = 0;
        let totalPaid = 0;
        const owedTo: { [key: string]: { name: string; amount: number } } = {};
        const owedBy: { [key: string]: { name: string; amount: number } } = {};
        const memberById: Record<string, { id: string; name?: string; email?: string }> = {};
        (group.members || []).forEach((m: any) => {
            if (m?.id) memberById[m.id] = m;
        });

        const getUserId = (u: any): string | undefined => {
            if (!u) return undefined;
            if (typeof u === "string") return u;
            if (typeof u.id === "string") return u.id; // Firestore DocumentReference or user object
            if (typeof u.user === "string") return u.user; // occasional nested shape
            if (u.user && typeof u.user.id === "string") return u.user.id;
            return undefined;
        };

        expenses.forEach((expense, idx) => {
            const rawParticipants: any[] = Array.isArray(expense.participants) ? expense.participants : [];
            const participants = rawParticipants.map((p) => ({
                id: getUserId(p.user) || getUserId(p) || "",
                status: p.status || "unpaid",
            })).filter((p) => !!p.id);

            const payerId: string | undefined = getUserId(expense.paidBy);
            const payerName: string = (payerId && (memberById[payerId]?.name || memberById[payerId]?.email)) || "Unknown";
            const shareMap = computeShares(Number(expense.amount) || 0, participants.map((p) => p.id), expense.split);

            const memberParticipant = participants.find((p: any) => p.id === memberId);

            if (!memberParticipant) return;
            if (payerId === memberId) {
                totalPaid += Number(expense.amount || 0);
                participants.forEach((p) => {
                    if (p.id !== memberId && p.status !== "paid") {
                        const amt = shareMap[p.id] || 0;
                        if (owedBy[p.id]) owedBy[p.id].amount += amt; else {
                            const otherName = memberById[p.id]?.name || memberById[p.id]?.email || p.id;
                            owedBy[p.id] = { name: otherName, amount: amt };
                        }
                    }
                });
            } else if (memberParticipant.status !== "paid" && payerId && payerId !== memberId) {
                const amt = shareMap[memberId] || 0;
                totalOwed += amt;
                if (owedTo[payerId]) owedTo[payerId].amount += amt; else {
                    owedTo[payerId] = { name: payerName, amount: amt };
                }
            }
        });

        const totalIsOwed = Object.values(owedBy).reduce((sum, v) => sum + v.amount, 0);
        const netBalance = totalIsOwed - totalOwed;
        return { totalOwed, totalPaid, owedTo, owedBy, totalIsOwed, netBalance };
    };

    const toggleMemberExpanded = (memberId: string) => {
        setExpandedMembers((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(memberId)) {
                newSet.delete(memberId);
            } else {
                newSet.add(memberId);
            }
            return newSet;
        });
    };

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

            {(myPerms.canInvite) && (
                <View style={[styles.section, { marginBottom: 16 }]}> 
                    <Text style={styles.sectionTitle}>Invite/Join</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.itemSubtitle}>Share this code to let others join your group:</Text>
                            <Text style={[styles.itemTitle, { marginTop: 6 }]}>{String(id)}</Text>
                        </View>
                        <View style={{ gap: 8 }}>
                            <TouchableOpacity
                                style={[styles.button, { alignSelf: "flex-end" }]}
                                onPress={async () => {
                                    try {
                                        const code = String(id);
                                        if (Platform.OS === "web" && (globalThis as any)?.navigator?.clipboard?.writeText) {
                                            await (globalThis as any).navigator.clipboard.writeText(code);
                                            Alert.alert("Copied", "Group code copied to clipboard.");
                                        } else {
                                            await Share.share({ message: `Join my SplitSmart group: ${group.name}\nCode: ${code}` });
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
                                        const code = String(id);
                                        await Share.share({ message: `Join my SplitSmart group: ${group.name}\nCode: ${code}` });
                                    } catch (e: any) {
                                        Alert.alert("Share failed", e?.message ?? "Please try again.");
                                    }
                                }}
                            >
                                <Text style={styles.buttonText}>Share Code</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: isDark ? "#3a3a3c" : "#0d6efd" }]}
                                onPress={() => setShowAddMember(true)}
                            >
                                <Text style={styles.buttonText}>Add Member</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            <View style={layoutStyles.columnsContainer}>
                <View style={[styles.section, layoutStyles.expensesColumn]}>
                    <Text style={styles.sectionTitle}>Expenses</Text>
                    {!!user && myPerms.canCreateExpenses && (
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
                        group.members.map((m: any, idx: number) => {
                            const isExpanded = expandedMembers.has(m.id);
                            const expenseData = calculateMemberExpenses(m.id);
                            
                            return (
                                <View key={m.id || idx}>
                                    <TouchableOpacity
                                        style={styles.memberCard}
                                        onPress={() => toggleMemberExpanded(m.id)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.memberName}>{m.name}</Text>
                                                {m.email && <Text style={styles.itemSubtitle}>{m.email}</Text>}
                                            </View>
                                            <Ionicons
                                                name={isExpanded ? "chevron-up" : "chevron-down"}
                                                size={20}
                                                color={isDark ? "#9BA1A6" : "#6c757d"}
                                            />
                                        </View>
                                    </TouchableOpacity>
                                    
                                    {isExpanded && (
                                        <View style={{ 
                                            backgroundColor: isDark ? "#2a2a2c" : "#f8f9fa",
                                            padding: 12,
                                            marginTop: -8,
                                            marginBottom: 8,
                                            borderBottomLeftRadius: 8,
                                            borderBottomRightRadius: 8,
                                        }}>
                                            <View style={{ gap: 8 }}>
                                                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                                    <Text style={[styles.itemSubtitle, { fontWeight: "600" }]}>Total Paid:</Text>
                                                    <Text style={[styles.itemSubtitle, { color: "#28a745" }]}>
                                                        ${expenseData.totalPaid.toFixed(2)}
                                                    </Text>
                                                </View>
                                                
                                                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                                    <Text style={[styles.itemSubtitle, { fontWeight: "600" }]}>Total Owed:</Text>
                                                    <Text style={[styles.itemSubtitle, { color: expenseData.totalOwed > 0 ? "#dc3545" : (isDark ? "#fff" : "#212529") }]}>
                                                        ${expenseData.totalOwed.toFixed(2)}
                                                    </Text>
                                                </View>
                                                
                                                {Object.keys(expenseData.owedTo).length > 0 && (
                                                    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: isDark ? "#3a3a3c" : "#dee2e6" }}>
                                                        <Text style={[styles.itemSubtitle, { fontWeight: "600", marginBottom: 4 }]}>Owes to:</Text>
                                                        {Object.entries(expenseData.owedTo).map(([payerId, data]) => (
                                                            <View key={payerId} style={{ flexDirection: "row", justifyContent: "space-between", marginLeft: 8, marginTop: 2 }}>
                                                                <Text style={styles.itemSubtitle}>{data.name}</Text>
                                                                <Text style={[styles.itemSubtitle, { color: "#dc3545" }]}>
                                                                    ${data.amount.toFixed(2)}
                                                                </Text>
                                                            </View>
                                                        ))}
                                                    </View>
                                                )}
                                                {Object.keys(expenseData.owedBy || {}).length > 0 && (
                                                    <View style={{ marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: isDark ? "#3a3a3c" : "#dee2e6" }}>
                                                        <Text style={[styles.itemSubtitle, { fontWeight: "600", marginBottom: 4 }]}>Is owed by:</Text>
                                                        {Object.entries(expenseData.owedBy).map(([otherId, data]) => (
                                                            <View key={otherId} style={{ flexDirection: "row", justifyContent: "space-between", marginLeft: 8, marginTop: 2 }}>
                                                                <Text style={styles.itemSubtitle}>{data.name}</Text>
                                                                <Text style={[styles.itemSubtitle, { color: "#198754" }]}>
                                                                    ${data.amount.toFixed(2)}
                                                                </Text>
                                                            </View>
                                                        ))}
                                                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                                                            <Text style={[styles.itemSubtitle, { fontWeight: "600" }]}>Net Balance:</Text>
                                                            <Text style={[styles.itemSubtitle, { color: expenseData.netBalance >= 0 ? "#198754" : "#dc3545" }]}>${expenseData.netBalance.toFixed(2)}</Text>
                                                        </View>
                                                    </View>
                                                )}
                                                
                                                {expenseData.totalOwed === 0 && Object.keys(expenseData.owedTo).length === 0 && (
                                                    <Text style={[styles.itemSubtitle, { fontStyle: "italic", textAlign: "center", marginTop: 4 }]}>
                                                        All settled up!
                                                    </Text>
                                                )}
                                                {(ownerId === currentUserId && m.id !== ownerId) && (
                                                    <View style={{ marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: isDark ? "#3a3a3c" : "#dee2e6" }}>
                                                        <Text style={[styles.itemSubtitle, { fontWeight: "600", marginBottom: 6 }]}>Permissions</Text>
                                                        {(() => {
                                                            const map = (group as any)?.memberPermissions || {};
                                                            const perms = map[m.id] || {};
                                                            const row = (label: string, key: "canCreateExpenses" | "canInvite" | "canKick", color: string) => (
                                                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 4 }}>
                                                                    <Text style={styles.itemSubtitle}>{label}</Text>
                                                                    <TouchableOpacity
                                                                        disabled={!!savingPerm}
                                                                        onPress={async () => {
                                                                            try {
                                                                                setSavingPerm(m.id + key);
                                                                                const next = !perms[key];
                                                                                await setMemberPermissions(String(id), m.id, { [key]: next } as any);
                                                                                // update local group state
                                                                                setGroup((prev: any) => {
                                                                                    const mp = { ...(prev?.memberPermissions || {}) };
                                                                                    const cur = { ...(mp[m.id] || {}) };
                                                                                    mp[m.id] = { ...cur, [key]: next };
                                                                                    return { ...prev, memberPermissions: mp };
                                                                                });
                                                                            } finally {
                                                                                setSavingPerm(null);
                                                                            }
                                                                        }}
                                                                        style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: toggleBg(!!perms[key]) }}
                                                                    >
                                                                        <Text style={{ color: "#fff" }}>{perms[key] ? "On" : "Off"}</Text>
                                                                    </TouchableOpacity>
                                                                </View>
                                                            );
                                                            return (
                                                                <View>
                                                                    {row("Can create expenses", "canCreateExpenses", "#0d6efd")}
                                                                    {row("Can invite members", "canInvite", "#6f42c1")}
                                                                    {row("Can kick members", "canKick", "#d63384")}
                                                                </View>
                                                            );
                                                        })()}
                                                    </View>
                                                )}
                                                {(() => {
                                                    const canKick = getPerms(currentUserId).canKick;
                                                    const isNotOwner = m.id !== ownerId;
                                                    const isNotSelf = m.id !== currentUserId;
                                                    return canKick && isNotOwner && isNotSelf;
                                                })() && (
                                                    <TouchableOpacity
                                                        style={[styles.button, { backgroundColor: "#dc3545", marginTop: 8 }]}
                                                        onPress={async () => {
                                                            // Web: Alert buttons are not supported; use window.confirm
                                                            if (Platform.OS === "web") {
                                                                const confirmFn = (globalThis as any)?.confirm;
                                                                if (typeof confirmFn === "function") {
                                                                    const ok = confirmFn(`Remove ${m.name || m.email}?`);
                                                                    if (!ok) return;
                                                                } else {
                                                                    // proceed without confirmation if not available
                                                                }
                                                                try {
                                                                    await removeMemberFromGroup(String(id), m.id, currentUserId || undefined);
                                                                    const updated = await getGroupById(String(id));
                                                                    setGroup(updated);
                                                                } catch (e: any) {
                                                                    Alert.alert("Error", e?.message || "Failed to remove member");
                                                                }
                                                                return;
                                                            }

                                                            // Native platforms: use Alert with buttons
                                                            Alert.alert("Remove Member", `Remove ${m.name || m.email}?`, [
                                                                { text: "Cancel", style: "cancel" },
                                                                { text: "Remove", style: "destructive", onPress: async () => {
                                                                    try {
                                                                        await removeMemberFromGroup(String(id), m.id, currentUserId || undefined);
                                                                        // Refresh group data
                                                                        const updated = await getGroupById(String(id));
                                                                        setGroup(updated);
                                                                    } catch (e: any) {
                                                                        Alert.alert("Error", e?.message || "Failed to remove member");
                                                                    }
                                                                }}
                                                            ]);
                                                        }}
                                                    >
                                                        <Text style={styles.buttonText}>Kick from group</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    )}
                                </View>
                            );
                        })
                    ) : (
                        <Text style={styles.itemSubtitle}>No members yet.</Text>
                    )}
                    
                    {user && group.members?.some((m: any) => m.id === user.uid) && (
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: "#dc3545", marginTop: 16 }]}
                            disabled={leavingGroup}
                            onPress={() => {
                                setShowLeaveConfirm(true);
                            }}
                        >
                            <Text style={styles.buttonText}>
                                {leavingGroup ? "Leaving..." : "Leave Group"}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <Modal visible={showLeaveConfirm} transparent animationType="fade" onRequestClose={() => setShowLeaveConfirm(false)}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}>
                    <View style={[styles.card, { padding: 20 }]}>
                        <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Leave Group</Text>
                        <Text style={[styles.itemSubtitle, { marginBottom: 20 }]}>
                            {group.members.length === 1
                                ? "You are the only member. Leaving will delete this group and all its expenses. Are you sure?"
                                : "Are you sure you want to leave this group? You will lose access to all expenses."}
                        </Text>
                        <View style={{ flexDirection: "row", gap: 12 }}>
                            <TouchableOpacity
                                style={[styles.button, { flex: 1, backgroundColor: isDark ? "#3a3a3c" : "#6c757d" }]}
                                onPress={() => setShowLeaveConfirm(false)}
                                disabled={leavingGroup}
                            >
                                <Text style={styles.buttonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, { flex: 1, backgroundColor: "#dc3545" }]}
                                disabled={leavingGroup}
                                onPress={async () => {
                                    if (!user || leavingGroup) return;
                                    try {
                                        setLeavingGroup(true);
                                        const groupDeleted = await removeMemberFromGroup(id as string, user.uid);
                                        setShowLeaveConfirm(false);
                                        router.replace("/(auth)");
                                        setTimeout(() => {
                                            Alert.alert(
                                                "Success",
                                                groupDeleted 
                                                    ? "The group has been deleted as no members remain."
                                                    : "You have successfully left the group."
                                            );
                                        }, 300);
                                    } catch (e: any) {
                                        setLeavingGroup(false);
                                        setShowLeaveConfirm(false);
                                        Alert.alert("Error", e?.message ?? "Could not leave group. Please try again.");
                                    }
                                }}
                            >
                                <Text style={styles.buttonText}>
                                    {leavingGroup ? "Leaving..." : "Leave"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

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
                                    onPress={() => setSelectedMemberIds((group.members || []).map((m: any) => m.id))}
                                >
                                    <Text style={styles.buttonText}>Select All</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.button, { flex: 1, backgroundColor: isDark ? "#3a3a3c" : "#adb5bd" }]}
                                    onPress={() => {
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
                                                <SplitEditor
                                                    members={(group.members || []).filter((m: any) => selectedMemberIds.includes(m.id))}
                                                    totalAmount={parseFloat(newAmount) || 0}
                                                    value={split}
                                                    onChange={setSplit}
                                                />
                        <View style={{ flexDirection: "row", gap: 12 }}>
                            <TouchableOpacity
                                style={[styles.button, { flex: 1 }]}
                                disabled={savingExpense}
                                onPress={async () => {
                                    if (!user) return;
                                    if (!myPerms.canCreateExpenses) {
                                        Alert.alert("Not allowed", "You don't have permission to create expenses in this group.");
                                        return;
                                    }
                                    const title = newTitle.trim();
                                    const amountNum = parseFloat(newAmount);
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
                                        await addExpense(id as string, title, title, amountNum, user.uid, shareIds, newNotes.trim(), split);
                                        setShowAddExpense(false);
                                        setNewTitle("");
                                        setNewAmount("");
                                        setNewNotes("");
                                        setSplit(undefined);
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

            <Modal visible={showAddMember} transparent animationType="slide" onRequestClose={() => setShowAddMember(false)}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 }}>
                    <View style={[styles.section]}>
                        <Text style={styles.sectionTitle}>Add Member</Text>
                        <TextInput
                            placeholder="Enter user UID"
                            placeholderTextColor={isDark ? "#9BA1A6" : "#6c757d"}
                            style={styles.input}
                            value={newMemberUserId}
                            onChangeText={setNewMemberUserId}
                        />
                        <View style={{ flexDirection: "row", gap: 12 }}>
                            <TouchableOpacity
                                style={[styles.button, { flex: 1 }]}
                                onPress={async () => {
                                    const uid = newMemberUserId.trim();
                                    if (!uid) return;
                                    try {
                                        await addMemberToGroup(String(id), uid);
                                        // Default perms for new member: canCreateExpenses true
                                        await setMemberPermissions(String(id), uid, { canCreateExpenses: true, canInvite: false, canKick: false });
                                        const updated = await getGroupById(String(id));
                                        setGroup(updated);
                                        setNewMemberUserId("");
                                        setShowAddMember(false);
                                    } catch (e: any) {
                                        Alert.alert("Error", e?.message || "Failed to add member");
                                    }
                                }}
                            >
                                <Text style={styles.buttonText}>Add</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, { flex: 1, backgroundColor: isDark ? "#3a3a3c" : "#adb5bd" }]}
                                onPress={() => setShowAddMember(false)}
                            >
                                <Text style={styles.buttonText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.itemSubtitle, { marginTop: 8 }]}>Note: we can extend this to search by email/user list.</Text>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}
