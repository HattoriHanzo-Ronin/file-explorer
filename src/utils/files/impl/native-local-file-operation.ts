import { NativeEventEmitter, NativeModules } from "react-native";
import type {
    FileOperationSnapshot,
    NativeLocalCopyMoveRequest,
    NativeLocalDeleteRequest,
    NativeLocalMkdirRequest,
    NativeLocalRenameRequest,
    NativeLocalExtractRequest
} from "../../../types/file-operations";
import type { LocalFileOperation } from "../local-file-operation";
import type { FileSystemEntry } from "../../../types/files";

interface NativeFileSystemEntry {
    name: string;
    path: string;
    size: number;
    mtime: number;
    isDirectory: boolean;
}

interface NativeFileOperationModule {
    readDir(path: string): Promise<NativeFileSystemEntry[]>;
    tryLocalMkdir(destination: string, name: string): Promise<boolean>;
    tryLocalRename(source: string, name: string): Promise<boolean>;
    startLocalMkdir(request: NativeLocalMkdirRequest): Promise<string>;
    startLocalRename(request: NativeLocalRenameRequest): Promise<string>;
    startLocalCopy(request: NativeLocalCopyMoveRequest): Promise<string>;
    startLocalMove(request: NativeLocalCopyMoveRequest): Promise<string>;
    startLocalDelete(request: NativeLocalDeleteRequest): Promise<string>;
    startLocalExtract(request: NativeLocalExtractRequest): Promise<string>;
    cancel(id: string): void;
    listOperations(): Promise<string>;
}

/**
 * Provides background local file operations through Android
 *
 * @author HattoriHanzo-Ronin
 */
export default class NativeLocalFileOperation implements LocalFileOperation {
    private readonly module = NativeModules.FileOperation as NativeFileOperationModule;
    private readonly eventEmitter = new NativeEventEmitter(NativeModules.FileOperation);

    /** Returns the entries in a local directory */
    async readDir(path: string): Promise<FileSystemEntry[]> {
        const entries = await this.module.readDir(path);
        return entries.map(({ isDirectory, mtime, name, path: entryPath, size }) => ({
            name,
            path: entryPath,
            size,
            ...(mtime > 0 ? { mtime: new Date(mtime) } : {}),
            isDirectory: () => isDirectory
        }));
    }

    /**
     * Creates a directory immediately if its path is available
     *
     * @param destination Parent directory
     * @param name Directory name
     * @returns Whether the operation was executed
     */
    async tryCreateDirectory(destination: string, name: string): Promise<boolean> {
        return this.module.tryLocalMkdir(destination, name);
    }

    /**
     * Renames an entry immediately if its path is available
     *
     * @param source Entry path
     * @param name New name
     * @returns Whether the operation was executed
     */
    async tryRename(source: string, name: string): Promise<boolean> {
        return this.module.tryLocalRename(source, name);
    }

    /** Creates a uniquely named directory */
    async createDirectory(request: NativeLocalMkdirRequest): Promise<string> {
        return this.module.startLocalMkdir(request);
    }

    /** Renames an entry to a uniquely named destination */
    async rename(request: NativeLocalRenameRequest): Promise<string> {
        return this.module.startLocalRename(request);
    }

    /**
     * Starts a local copy operation
     *
     * @param request Copy request
     * @returns Operation identifier
     */
    async startCopy(request: NativeLocalCopyMoveRequest): Promise<string> {
        return this.module.startLocalCopy(request);
    }

    /**
     * Starts a local move operation
     *
     * @param request Move request
     * @returns Operation identifier
     */
    async startMove(request: NativeLocalCopyMoveRequest): Promise<string> {
        return this.module.startLocalMove(request);
    }

    /**
     * Starts a local delete operation
     *
     * @param request Delete request
     * @returns Operation identifier
     */
    async startDelete(request: NativeLocalDeleteRequest): Promise<string> {
        return this.module.startLocalDelete(request);
    }

    /**
     * Starts a local archive extraction
     *
     * @param request Extraction request
     * @returns Operation identifier
     */
    async startExtract(request: NativeLocalExtractRequest): Promise<string> {
        return this.module.startLocalExtract(request);
    }

    /**
     * Opens a local file
     *
     * @param path File path
     */
    async openFile(path: string): Promise<void> {
        await NativeModules.FileOpener.openFile(path);
    }

    /**
     * Cancels an operation
     *
     * @param id Operation identifier
     */
    cancel(id: string): void {
        this.module.cancel(id);
    }

    /**
     * Returns persisted operations
     *
     * @returns File operation snapshots
     */
    async listOperations(): Promise<FileOperationSnapshot[]> {
        return JSON.parse(await this.module.listOperations()) as FileOperationSnapshot[];
    }

    /**
     * Adds an operation change listener
     *
     * @param listener Operation listener
     * @returns Listener cleanup
     */
    addChangeListener(listener: (operation: FileOperationSnapshot) => void): () => void {
        const subscription = this.eventEmitter.addListener("FileOperationChanged", (operation) =>
            listener(operation as unknown as FileOperationSnapshot)
        );
        return () => subscription.remove();
    }
}
