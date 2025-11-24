import { DocumentReference } from "firebase/firestore";
import { ExpenseSplit } from "../components/model/expense";

export type Shares = Record<string, number>; // userId -> amount

export function refId(u: string | DocumentReference | { id?: string } | undefined | null): string | undefined {
  if (!u) return undefined;
  if (typeof u === "string") return u;
  if ((u as any).id) return (u as any).id as string;
  return undefined;
}

export function computeShares(totalAmount: number, participantIds: string[], split?: ExpenseSplit): Shares {
  const cleanTotal = Number(totalAmount) || 0;
  const ids = (participantIds || []).filter(Boolean);
  const n = ids.length || 1;
  const result: Shares = {};
  if (!split || split.type === "equal") {
    const each = cleanTotal / n;
    ids.forEach((id) => (result[id] = round2(each)));
    return result;
  }

  if (split.type === "percent") {
    const map: Record<string, number> = {};
    const percentSum = (split.allocations || []).reduce((acc, a) => {
      const id = refId(a.user);
      if (!id) return acc;
      const v = Number(a.value) || 0;
      map[id] = v;
      return acc + v;
    }, 0);
    const factor = percentSum === 0 ? 0 : 100 / percentSum;
    ids.forEach((id) => {
      const p = (map[id] ?? 0) * factor;
      result[id] = round2((p / 100) * cleanTotal);
    });
    return result;
  }

  if (split.type === "amount") {
    const map: Record<string, number> = {};
    let sum = 0;
    (split.allocations || []).forEach((a) => {
      const id = refId(a.user);
      if (!id) return;
      const v = Math.max(0, Number(a.value) || 0);
      map[id] = v;
      sum += v;
    });
    const remainder = cleanTotal - sum;
    const leftovers = ids.filter((id) => map[id] == null);
    if (Math.abs(remainder) > 0.009 && leftovers.length > 0) {
      const each = remainder / leftovers.length;
      leftovers.forEach((id) => (map[id] = (map[id] || 0) + each));
      sum = cleanTotal;
    }
    if (Math.abs(sum - cleanTotal) > 0.009) {
      const factor = sum === 0 ? 0 : cleanTotal / sum;
      ids.forEach((id) => {
        const v = map[id] ?? 0;
        result[id] = round2(v * factor);
      });
      return result;
    }
    ids.forEach((id) => (result[id] = round2(map[id] ?? 0)));
    return result;
  }

  const each = cleanTotal / n;
  ids.forEach((id) => (result[id] = round2(each)));
  return result;
}

export function validateSplit(totalAmount: number, participantIds: string[], split?: ExpenseSplit): { ok: boolean; message?: string } {
  if (!split || split.type === "equal") return { ok: true };
  if (split.type === "percent") {
    const sum = (split.allocations || []).reduce((acc, a) => acc + (Number(a.value) || 0), 0);
    if (sum <= 0) return { ok: false, message: "Percentages must sum to > 0" };
    return { ok: true };
  }
  if (split.type === "amount") {
    const sum = (split.allocations || []).reduce((acc, a) => acc + Math.max(0, Number(a.value) || 0), 0);
    if (sum < 0) return { ok: false, message: "Invalid amounts" };
    return { ok: true };
  }
  return { ok: true };
}

export function toPercentages(totalAmount: number, shares: Shares): Record<string, number> {
  const total = Object.values(shares).reduce((s, v) => s + v, 0) || 1;
  const map: Record<string, number> = {};
  Object.keys(shares).forEach((id) => (map[id] = round2((shares[id] / total) * 100)));
  return map;
}

export function toAmountsFromPercent(totalAmount: number, percentages: Record<string, number>): Shares {
  const map: Shares = {};
  Object.keys(percentages).forEach((id) => (map[id] = round2(((percentages[id] || 0) / 100) * totalAmount)));
  return map;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
