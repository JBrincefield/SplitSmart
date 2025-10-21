import { DocumentReference } from "firebase/firestore";

export type Group = {
    id?: string;
    name: string;
    createdBy: DocumentReference | string;
    members: Array<DocumentReference | string>;
    createdAt?: string;
};