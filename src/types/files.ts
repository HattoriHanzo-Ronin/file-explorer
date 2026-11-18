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

/** Local file or directory shown in the explorer */
export interface DirContent {
    name: string;
    type: EntryType;
    thumbnailPath?: string;
}

/** File or directory returned by the local storage bridge */
export interface FileSystemEntry {
    name: string;
    path: string;
    size: number;
    mtime?: Date;
    isDirectory(): boolean;
}

/** Available storage volume and its root path */
export interface StorageRoot {
    id: string;
    name: string;
    path: string;
    type: "INTERNAL" | "REMOVABLE";
}

/** Labels for internal and removable storage */
export interface StorageRootNames {
    internal: string;
    external: string;
}

/** Current local directory and its contents */
export interface LocalDirectoryState {
    rootPath: string;
    dir: string;
    content: FileSystemEntry[];
}

/** Refreshed contents of a local directory */
export interface LocalDirectoryUpdate {
    path: string;
    entries: FileSystemEntry[];
}

/** Selected entry and its type */
export interface ModifyElement<T extends string = EntryType> {
    path: string;
    type: T;
}

/** Selected local entry with its absolute path */
export interface LocalModifyElement extends ModifyElement {
    path: string;
}

/** Local directory and storage root used by a file operation */
export interface LocalDirectoryRequest {
    rootPath: string;
    path: string;
}

/** Named entry within a local directory */
export interface LocalNamedEntryRequest {
    rootPath: string;
    dir: string;
    name: string;
}

/** Local entry and its requested name */
export interface LocalRenameRequest {
    entry: LocalModifyElement;
    name: string;
}

/** Local entries and their destination */
export interface LocalCopyMoveRequest {
    items: LocalModifyElement[];
    destination: string;
}

/** Name and validation context for a file operation */
export interface FileOperationNameParams {
    name: string;
    field: string;
    currentName?: string;
}
