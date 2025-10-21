import { DocumentReference } from "firebase/firestore";

export type User = {
        id?: string;
    name: string;
    email: string;
    groups?: Array<string | DocumentReference>;
    createdAt?: string;
};