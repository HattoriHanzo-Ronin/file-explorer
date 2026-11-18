import { NativeEventEmitter, NativeModules } from "react-native";
import type {
    FileOperationSnapshot,
    NativeLocalCopyMoveRequest,
    NativeLocalImmediateMkdirRequest,
    NativeLocalImmediateRenameRequest,
    NativeLocalDeleteRequest,
    NativeLocalMkdirRequest,
    NativeLocalRenameRequest,
    NativeLocalExtractRequest
} from "../../../types/file-operations";
import type { LocalFileOperation } from "../local-file-operation";
import type { StorageRoot, StorageRootNames } from "../../../types/files";

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

interface NativeStorageVolumeModule {
    internalRootPath: string;
    getExternalRoots(externalStorageName: string): Promise<StorageRoot[]>;
}

/**
 * Provides background local file operations through Android
 *
 * @author HattoriHanzo-Ronin
 */
export default class NativeLocalFileOperation implements LocalFileOperation {
    private readonly module = NativeModules.FileOperation as NativeFileOperationModule;
    private readonly eventEmitter = new NativeEventEmitter(NativeModules.FileOperation);
    private readonly storageVolume = NativeModules.StorageVolume as NativeStorageVolumeModule;
    private readonly storageVolumeEmitter = new NativeEventEmitter(NativeModules.StorageVolume);
    private readonly storageRootNames: StorageRootNames;
    private readonly root: StorageRoot;

    constructor(storageRootNames: StorageRootNames) {
        this.storageRootNames = storageRootNames;
        this.root = {
            id: "internal",
            name: storageRootNames.internal,
            path: this.storageVolume.internalRootPath,
            type: "INTERNAL"
        };
    }

    /** Returns mounted removable storage roots */
    async getExternalRoots() {
        return this.storageVolume.getExternalRoots(this.storageRootNames.external);
    }

    /** Adds a removable storage change listener */
    addStorageRootsChangeListener(listener: (roots: StorageRoot[]) => void) {
        const subscription = this.storageVolumeEmitter.addListener("StorageVolumesChanged", (roots) =>
            listener(roots as unknown as StorageRoot[])
        );
        return () => subscription.remove();
    }

    /** Returns the entries in a local directory */
    async readDir(path: string) {
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
     * @param params.destination Parent directory
     * @param params.name Directory name
     * @returns Whether the operation was executed
     */
    async tryCreateDirectory(params: NativeLocalImmediateMkdirRequest) {
        return this.module.tryLocalMkdir(params.destination, params.name);
    }

    /**
     * Renames an entry immediately if its path is available
     *
     * @param params.source Entry path
     * @param params.name New name
     * @returns Whether the operation was executed
     */
    async tryRename(params: NativeLocalImmediateRenameRequest) {
        return this.module.tryLocalRename(params.source, params.name);
    }

    /** Creates a uniquely named directory */
    async createDirectory(request: NativeLocalMkdirRequest) {
        return this.module.startLocalMkdir(request);
    }

    /** Renames an entry to a uniquely named destination */
    async rename(request: NativeLocalRenameRequest) {
        return this.module.startLocalRename(request);
    }

    /**
     * Starts a local copy operation
     *
     * @param request.notificationTexts Operation notification texts
     * @param request.sources Source paths
     * @param request.destination Destination directory
     * @returns Operation identifier
     */
    async startCopy(request: NativeLocalCopyMoveRequest) {
        return this.module.startLocalCopy(request);
    }

    /**
     * Starts a local move operation
     *
     * @param request.notificationTexts Operation notification texts
     * @param request.sources Source paths
     * @param request.destination Destination directory
     * @returns Operation identifier
     */
    async startMove(request: NativeLocalCopyMoveRequest) {
        return this.module.startLocalMove(request);
    }

    /**
     * Starts a local delete operation
     *
     * @param request.notificationTexts Operation notification texts
     * @param request.sources Source paths
     * @param request.destination Affected directory
     * @returns Operation identifier
     */
    async startDelete(request: NativeLocalDeleteRequest) {
        return this.module.startLocalDelete(request);
    }

    /**
     * Starts a local archive extraction
     *
     * @param request.notificationTexts Operation notification texts
     * @param request.source Archive path
     * @param request.destination Destination directory
     * @returns Operation identifier
     */
    async startExtract(request: NativeLocalExtractRequest) {
        return this.module.startLocalExtract(request);
    }

    /**
     * Opens a local file
     *
     * @param path File path
     */
    async openFile(path: string) {
        await NativeModules.FileOpener.openFile(path);
    }

    /**
     * Cancels an operation
     *
     * @param id Operation identifier
     */
    cancel(id: string) {
        this.module.cancel(id);
    }

    /**
     * Returns persisted operations
     *
     * @returns File operation snapshots
     */
    async listOperations() {
        return JSON.parse(await this.module.listOperations()) as FileOperationSnapshot[];
    }

    /**
     * Adds an operation change listener
     *
     * @param listener Operation listener
     * @returns Listener cleanup
     */
    addChangeListener(listener: (operation: FileOperationSnapshot) => void) {
        const subscription = this.eventEmitter.addListener("FileOperationChanged", (operation) =>
            listener(operation as unknown as FileOperationSnapshot)
        );
        return () => subscription.remove();
    }

    get internalRoot(): StorageRoot {
        return this.root;
    }
}
