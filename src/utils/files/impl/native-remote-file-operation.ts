import { NativeEventEmitter, NativeModules } from "react-native";
import type {
    FileOperationSnapshot,
    NativeDownloadRequest,
    NativeRemoteDeleteRequest,
    NativeRemoteMoveRequest,
    NativeUploadRequest
} from "../../../types/file-operations";
import type { RemoteFileOperation } from "../remote-file-operation";

interface NativeFileOperationModule {
    startUpload(request: NativeUploadRequest): Promise<string>;
    startDownload(request: NativeDownloadRequest): Promise<string>;
    startRemoteDelete(request: NativeRemoteDeleteRequest): Promise<string>;
    startRemoteMove(request: NativeRemoteMoveRequest): Promise<string>;
    cancel(id: string): void;
    listOperations(): Promise<string>;
    clearSettled(): void;
}

/**
 * Provides background remote file operations through Android
 *
 * @author HattoriHanzo-Ronin
 */
export default class NativeRemoteFileOperation implements RemoteFileOperation {
    private readonly module = NativeModules.FileOperation as NativeFileOperationModule;
    private readonly eventEmitter = new NativeEventEmitter(NativeModules.FileOperation);

    /**
     * Starts an upload operation
     *
     * @param request Upload request
     * @returns Operation identifier
     */
    async startUpload(request: NativeUploadRequest): Promise<string> {
        return this.module.startUpload(request);
    }

    /**
     * Starts a download operation
     *
     * @param request Download request
     * @returns Operation identifier
     */
    async startDownload(request: NativeDownloadRequest): Promise<string> {
        return this.module.startDownload(request);
    }

    /**
     * Starts a remote delete operation
     *
     * @param request Delete request
     * @returns Operation identifier
     */
    async startDelete(request: NativeRemoteDeleteRequest): Promise<string> {
        return this.module.startRemoteDelete(request);
    }

    /**
     * Starts a remote move operation
     *
     * @param request Move request
     * @returns Operation identifier
     */
    async startMove(request: NativeRemoteMoveRequest): Promise<string> {
        return this.module.startRemoteMove(request);
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

    /** Clears completed operations */
    clearSettled(): void {
        this.module.clearSettled();
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
