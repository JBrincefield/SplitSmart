// Expense Details: shows status, payer, participants with computed per-person shares.
// Users can mark their share paid; payer can complete the entire expense.
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, useColorScheme, View } from "react-native";
import { Colors } from "../../../constants/theme";
import { useAuth } from "../../../contexts/auth-context";
import { getExpenseById, markExpenseComplete, markPortionPaid } from "../../../services/firebaseService";
import { useGlobalStyles } from "../../../styles/global-styles";
import { computeShares } from "../../../utils/split";

export default function ExpenseDetails() {
  const { id, groupId } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [expense, setExpense] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const styles = useGlobalStyles();
  const { user } = useAuth();

  const participants = React.useMemo(() => {
    if (!expense) return [] as any[];
    if (Array.isArray(expense.participants) && expense.participants.length > 0) {
      return expense.participants;
    }
    const list = [...(expense.sharedWith || [])];
    if (expense.paidBy && !list.find((u: any) => u?.id === expense.paidBy.id)) {
      list.unshift(expense.paidBy);
    }
    return list.map((u: any) => ({ ...u, status: u.id === expense.paidBy?.id ? "paid" : "unpaid" }));
  }, [expense]);

  useEffect(() => {
    if (!groupId || !id) return;
    
    (async () => {
      try {
        const data = await getExpenseById(groupId as string, id as string);
  setExpense(data);
      } catch (error) {
        console.error("Error loading expense:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId, id]);

  const refresh = async () => {
    if (!groupId || !id) return;
    const data = await getExpenseById(groupId as string, id as string);
    setExpense(data);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={isDark ? Colors.dark.tint : Colors.light.tint} />
      </View>
    );
  }

  if (!expense) {
    return (
      <View style={styles.container}>
        <Text style={styles.subtitle}>Expense not found.</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const shareMap: Record<string, number> = React.useMemo(() => {
    const ids = participants.map((p: any) => p.id).filter(Boolean);
    return computeShares(Number(expense.amount) || 0, ids, expense.split);
  }, [participants, expense?.amount, expense?.split]);

  return (
    <ScrollView style={styles.screen}>
      <View style={styles.expenseHeader}>
        <View style={styles.expenseTitleContainer}>
          <Text style={styles.title}>{expense.title || "Untitled"}</Text>
        </View>
        <Text style={styles.expenseAmount}>${expense.amount?.toFixed(2) || "0.00"}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status</Text>
        <Text style={styles.itemSubtitle}>
          {expense.completed ? "Completed" : "In progress"}
        </Text>
        {!expense.completed && user?.uid ? (
          <View style={{ flexDirection: "row", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            {participants.find((p: any) => p.id === user.uid && p.status !== "paid") && (
              <TouchableOpacity
                style={styles.button}
                disabled={actionLoading}
                onPress={async () => {
                  try {
                    setActionLoading(true);
                    await markPortionPaid(groupId as string, id as string, user.uid);
                    await refresh();
                  } catch (e: any) {
                    Alert.alert("Couldn't update", e?.message ?? "Please try again.");
                  } finally {
                    setActionLoading(false);
                  }
                }}
              >
                <Text style={styles.buttonText}>Mark my share paid</Text>
              </TouchableOpacity>
            )}

            {expense.paidBy?.id === user.uid && (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: participants.every((p: any) => p.status === "paid") ? styles.button.backgroundColor : "#6c757d" }]}
                disabled={actionLoading}
                onPress={async () => {
                  try {
                    setActionLoading(true);
                    if (!participants.every((p: any) => p.status === "paid")) {
                      const proceed = true;
                    }
                    await markExpenseComplete(groupId as string, id as string, user.uid);
                    await refresh();
                  } catch (e: any) {
                    Alert.alert("Couldn't complete", e?.message ?? "Please try again.");
                  } finally {
                    setActionLoading(false);
                  }
                }}
              >
                <Text style={styles.buttonText}>Mark expense complete</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color={isDark ? "#9BA1A6" : "#6c757d"} />
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>
              {expense.date ? dayjs(expense.date).format("MMM D, YYYY") : "—"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="wallet-outline" size={20} color={isDark ? "#9BA1A6" : "#6c757d"} />
            <Text style={styles.infoLabel}>Paid by</Text>
            <Text style={styles.infoValue}>{expense.paidBy?.name || "Unknown"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={20} color={isDark ? "#9BA1A6" : "#6c757d"} />
            <Text style={styles.infoLabel}>Split between</Text>
            <Text style={styles.infoValue}>
              {participants.length} {participants.length === 1 ? "person" : "people"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Notes</Text>
        <View style={styles.notesBox}>
          <Text style={styles.notesText}>{expense.notes || "No notes provided."}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Split Breakdown</Text>
        {participants.length > 0 ? (
          participants.map((p: any) => (
            <View key={p?.id || Math.random()} style={styles.participantCard}>
              <View style={styles.participantInfo}>
                <Text style={styles.participantName}>{p?.name || "Unknown"}</Text>
                {p?.email && (
                  <Text style={styles.participantEmail}>{p.email}</Text>
                )}
                <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                  {p?.id === expense.paidBy?.id && (
                    <View style={styles.paidBadge}>
                      <Text style={styles.paidBadgeText}>PAYER</Text>
                    </View>
                  )}
                  <View style={[styles.paidBadge, { backgroundColor: p.status === "paid" ? styles.paidBadge.backgroundColor : "#adb5bd" }]}>
                    <Text style={styles.paidBadgeText}>{p.status === "paid" ? "PAID" : "UNPAID"}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.participantAmount}>${(shareMap[p.id] ?? 0).toFixed(2)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.itemSubtitle}>No participants found</Text>
        )}
      </View>
    </ScrollView>
  );
}
