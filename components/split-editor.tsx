import React, { useEffect, useMemo, useState } from "react";
import { Text, TextInput, TouchableOpacity, View, useColorScheme } from "react-native";
import { useGlobalStyles } from "../styles/global-styles";
import { computeShares } from "../utils/split";
import { ExpenseSplit, SplitAllocation, SplitType } from "./model/expense";

export type Member = { id: string; name?: string; email?: string };

type Props = {
  members: Member[]; // selected participants
  totalAmount: number;
  value: ExpenseSplit | undefined;
  onChange: (split: ExpenseSplit) => void;
};

export default function SplitEditor({ members, totalAmount, value, onChange }: Props) {
  const styles = useGlobalStyles();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const ids = useMemo(() => members.map((m) => m.id), [members]);
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!value) {
      const allocs = members.map((m) => ({ user: m.id, value: 0 }));
      onChange({ type: "equal", allocations: allocs });
      setRawInputs(Object.fromEntries(allocs.map((a) => [String(a.user), ""])));
      return;
    }
    if (value && members.length > 0) {
      const setIds = new Set(value.allocations.map((a) => String((a as any).user?.id || a.user)));
      const missing = members.filter((m) => !setIds.has(m.id));
      if (missing.length > 0) {
        const newAllocs = [...value.allocations, ...missing.map((m) => ({ user: m.id, value: 0 }))];
        onChange({ ...value, allocations: newAllocs });
      }
      setRawInputs((prev) => {
        const copy = { ...prev };
        for (const m of members) {
          if (copy[m.id] == null) copy[m.id] = String((value.allocations.find((a) => String((a as any).user?.id || a.user) === m.id)?.value ?? ""));
        }
        return copy;
      });
    }
  }, [members, value]);

  const shares = useMemo(() => computeShares(Number(totalAmount) || 0, ids, value), [totalAmount, ids, value]);

  const sumPercent = useMemo(() => {
    if (!value || value.type !== "percent") return 0;
    return (value.allocations || [])
      .filter((a) => ids.includes(String((a as any).user?.id || a.user)))
      .reduce((s, a) => s + (Number(a.value) || 0), 0);
  }, [value, ids]);

  const sumAmount = useMemo(() => {
    if (!value || value.type !== "amount") return 0;
    return (value.allocations || [])
      .filter((a) => ids.includes(String((a as any).user?.id || a.user)))
      .reduce((s, a) => s + Math.max(0, Number(a.value) || 0), 0);
  }, [value, ids]);

  const setType = (type: SplitType) => {
    const base: ExpenseSplit = { type, allocations: members.map((m) => ({ user: m.id, value: 0 })) };
    if (type === "percent") {
      const equal = members.length > 0 ? 100 / members.length : 0;
      base.allocations = members.map((m) => ({ user: m.id, value: Number(equal.toFixed(2)) }));
    }
    if (type === "amount") {
      const equal = members.length > 0 ? (Number(totalAmount) || 0) / members.length : 0;
      base.allocations = members.map((m) => ({ user: m.id, value: Number(equal.toFixed(2)) }));
    }
    setRawInputs(Object.fromEntries(base.allocations.map((a) => [String(a.user), String(a.value)])));
    onChange(base);
  };

  const updateValue = (memberId: string, raw: string) => {
    if (!value) return;
    let sanitized = raw.replace(/[^0-9.]/g, "");
    const firstDot = sanitized.indexOf(".");
    if (firstDot !== -1) {
      sanitized = sanitized.slice(0, firstDot + 1) + sanitized.slice(firstDot + 1).replace(/\./g, "");
    }
    setRawInputs((prev) => ({ ...prev, [memberId]: sanitized }));
    const numericStr = sanitized.endsWith(".") ? sanitized.slice(0, -1) : sanitized;
    const nextVal = numericStr === "" || numericStr === "." ? NaN : Number(numericStr);
    if (!isFinite(nextVal)) return;
    const allocations = (value.allocations || []).map((a) => {
      const id = String((a as any).user?.id || a.user);
      if (id !== memberId) return a;
      return { ...a, value: nextVal } as SplitAllocation;
    });
    onChange({ ...value, allocations });
  };

  const labelColor = isDark ? "#9BA1A6" : "#6c757d";
  const mutedBg = isDark ? "#2a2a2c" : "#f8f9fa";

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.label}>Split method</Text>
      <View style={{ flexDirection: "row", gap: 8, marginVertical: 8 }}>
        {([
          { key: "equal", label: "Equal" },
          { key: "percent", label: "Percent" },
          { key: "amount", label: "Amount" },
        ] as const).map((opt) => {
          const active = value?.type === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setType(opt.key)}
              style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: active ? (isDark ? "#0dcaf0" : "#0d6efd") : (isDark ? "#3a3a3c" : "#adb5bd") }}
            >
              <Text style={{ color: "#fff" }}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {value?.type !== "equal" && (
        <View style={{ backgroundColor: mutedBg, borderRadius: 8, padding: 8 }}>
          {members.map((m) => {
            const alloc = (value?.allocations || []).find((a) => String((a as any).user?.id || a.user) === m.id);
            const val = rawInputs[m.id] != null ? rawInputs[m.id] : (alloc ? String(alloc.value ?? "") : "");
            return (
              <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{m.name || m.email || m.id}</Text>
                  <Text style={[styles.itemSubtitle, { color: labelColor }]}>Owes: ${shares[m.id]?.toFixed(2) || "0.00"}</Text>
                </View>
                <TextInput
                  style={[styles.input, { width: 120 }]}
                  keyboardType="decimal-pad"
                  placeholder={value?.type === "percent" ? "%" : "$"}
                  placeholderTextColor={labelColor}
                  value={val}
                  onChangeText={(t) => updateValue(m.id, t)}
                />
                <Text style={styles.itemSubtitle}>{value?.type === "percent" ? "%" : "$"}</Text>
              </View>
            );
          })}
          {value?.type === "percent" && (
            <Text style={[styles.itemSubtitle, { marginTop: 6, color: sumPercent > 100.01 || sumPercent < 99.99 ? "#dc3545" : (isDark ? "#fff" : "#212529") }]}>Total: {sumPercent.toFixed(2)}%</Text>
          )}
          {value?.type === "amount" && (
            <Text style={[styles.itemSubtitle, { marginTop: 6, color: Math.abs(sumAmount - Number(totalAmount || 0)) > 0.01 ? "#fd7e14" : (isDark ? "#fff" : "#212529") }]}>Assigned: ${sumAmount.toFixed(2)} / ${Number(totalAmount || 0).toFixed(2)}</Text>
          )}
        </View>
      )}

      {value?.type === "equal" && (
        <View style={{ backgroundColor: mutedBg, borderRadius: 8, padding: 8 }}>
          {members.map((m) => (
            <View key={m.id} style={{ flexDirection: "row", justifyContent: "space-between", marginVertical: 4 }}>
              <Text style={styles.itemTitle}>{m.name || m.email || m.id}</Text>
              <Text style={styles.itemSubtitle}>${shares[m.id]?.toFixed(2) || "0.00"}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
