import type { FileSystemEntry, StorageRoot } from "../../types/files";

export type { FileSystemEntry } from "../../types/files";

export interface FileSystemStat {
    size: number;
}

export interface FileSystem {
    readonly internalRoot: StorageRoot;

    getExternalRoots(): Promise<StorageRoot[]>;

    addStorageRootsChangeListener(listener: (roots: StorageRoot[]) => void): () => void;

    exists(path: string): Promise<boolean>;

    readDir(path: string): Promise<FileSystemEntry[]>;

    stat(path: string): Promise<FileSystemStat>;

    mkdir(path: string): Promise<void>;

    copyFile(origin: string, destination: string): Promise<void>;

    moveFile(origin: string, destination: string): Promise<void>;

    remove(path: string): Promise<void>;
}
