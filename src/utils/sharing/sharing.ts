import type { SharedFile } from "../../types/sharing";

/** Shares files with external applications and receives shared files */
export interface Sharing {
    share(paths: string[]): Promise<void>;

    getReceivedFiles(): Promise<SharedFile[]>;

    cleanupReceivedFiles(paths: string[]): Promise<void>;

    addReceivedFilesListener(listener: (files: SharedFile[]) => void): () => void;
}
