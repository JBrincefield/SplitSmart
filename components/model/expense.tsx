import { DocumentReference } from "firebase/firestore";

export type SplitType = "equal" | "percent" | "amount";

export type SplitAllocation = {
    user: DocumentReference | string;
    // For type "percent": value is percent (0-100). For type "amount": value is currency amount.
    value: number;
};

export type ExpenseSplit = {
    type: SplitType;
    allocations: SplitAllocation[]; // One entry per participant in sharedWith
};

export type Expense = {
    id?: string;
    title: string;
    amount: number;
    paidBy: DocumentReference | string;
    sharedWith: Array<DocumentReference | string>; // includes payer if they share the cost
    split?: ExpenseSplit; // optional: default equal if omitted
    notes?: string;
    date?: string;
};