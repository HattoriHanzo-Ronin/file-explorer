import type { ImageSourcePropType } from "react-native";

export type EntryType = "dir" | "file";

export type FileIconType =
    | EntryType
    | "image"
    | "video"
    | "audio"
    | "compress"
    | "pdf"
    | "word"
    | "excel"
    | "power"
    | "apk"
    | "exe"
    | "code"
    | "text"
    | "system";

export type FileIcons = Record<FileIconType, ImageSourcePropType>;

export interface DirContent {
    name: string;
    type: EntryType;
    thumbnailPath?: string;
}

export interface FileSystemEntry {
    name: string;
    path: string;
    size: number;
    mtime?: Date;
    isDirectory(): boolean;
}

export interface StorageRoot {
    id: string;
    name: string;
    path: string;
    type: "INTERNAL" | "REMOVABLE";
}

export interface StorageRootNames {
    internal: string;
    external: string;
}

export interface LocalDirectoryState {
    rootPath: string;
    dir: string;
    content: FileSystemEntry[];
}

export interface LocalDirectoryUpdate {
    path: string;
    entries: FileSystemEntry[];
}

export interface ModifyElement<T extends string = EntryType> {
    path: string;
    type: T;
}

export interface LocalModifyElement extends ModifyElement {
    path: string;
}
