import { DocumentReference } from "firebase/firestore";

export type Expense = {
    id?: string;
    title: string;
    amount: number;
    paidBy: DocumentReference | string;
    sharedWith: Array<DocumentReference | string>;
    notes?: string;
    date?: string;
};