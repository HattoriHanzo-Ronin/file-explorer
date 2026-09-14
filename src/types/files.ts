export type EntryType = "dir" | "file";

export interface DirContent {
    name: string;
    type: EntryType;
}

export interface ModifyElement {
    path: string;
    type: EntryType;
}
