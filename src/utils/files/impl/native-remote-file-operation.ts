import { NativeEventEmitter, NativeModules } from "react-native";
import type {
    FileOperationSnapshot,
    NativeDownloadRequest,
    NativeRemoteDeleteRequest,
    NativeRemoteCopyRequest,
    NativeRemoteMoveRequest,
    NativeRemoteMkdirRequest,
    NativeRemoteRenameRequest,
    NativeUploadRequest
} from "../../../types/file-operations";
import type { RemoteFileOperation } from "../remote-file-operation";

interface NativeFileOperationModule {
    startUpload(request: NativeUploadRequest): Promise<string>;
    startDownload(request: NativeDownloadRequest): Promise<string>;
    startRemoteDelete(request: NativeRemoteDeleteRequest): Promise<string>;
    startRemoteMkdir(request: NativeRemoteMkdirRequest): Promise<string>;
    startRemoteRename(request: NativeRemoteRenameRequest): Promise<string>;
    startRemoteMove(request: NativeRemoteMoveRequest): Promise<string>;
    startRemoteCopy(request: NativeRemoteCopyRequest): Promise<string>;
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
     * @param request.apiUrl API base URL
     * @param request.accessToken Access token
     * @param request.notificationTexts Operation notification texts
     * @param request.remoteDir Remote directory
     * @param request.entries Local entries to upload
     * @returns Operation identifier
     */
    async startUpload(request: NativeUploadRequest) {
        return this.module.startUpload(request);
    }

    /**
     * Starts a download operation
     *
     * @param request.apiUrl API base URL
     * @param request.accessToken Access token
     * @param request.notificationTexts Operation notification texts
     * @param request.remoteDir Remote directory
     * @param request.destination Local destination
     * @param request.entries Remote entries to download
     * @returns Operation identifier
     */
    async startDownload(request: NativeDownloadRequest) {
        return this.module.startDownload(request);
    }

    /**
     * Starts a remote delete operation
     *
     * @param request.apiUrl API base URL
     * @param request.accessToken Access token
     * @param request.notificationTexts Operation notification texts
     * @param request.remoteDir Remote directory
     * @param request.entries Entries to delete
     * @returns Operation identifier
     */
    async startDelete(request: NativeRemoteDeleteRequest) {
        return this.module.startRemoteDelete(request);
    }

    /** Starts a remote directory creation */
    async startMkdir(request: NativeRemoteMkdirRequest) {
        return this.module.startRemoteMkdir(request);
    }

    /** Starts a remote rename operation */
    async startRename(request: NativeRemoteRenameRequest) {
        return this.module.startRemoteRename(request);
    }

    /**
     * Starts a remote move operation
     *
     * @param request.apiUrl API base URL
     * @param request.accessToken Access token
     * @param request.notificationTexts Operation notification texts
     * @param request.remoteDir Remote directory
     * @param request.destination Destination directory
     * @param request.entries Entries to move
     * @returns Operation identifier
     */
    async startMove(request: NativeRemoteMoveRequest) {
        return this.module.startRemoteMove(request);
    }

    /**
     * Starts a remote copy operation
     *
     * @param request.apiUrl API base URL
     * @param request.accessToken Access token
     * @param request.notificationTexts Operation notification texts
     * @param request.remoteDir Remote directory
     * @param request.destination Destination directory
     * @param request.entries Entries to copy
     * @returns Operation identifier
     */
    async startCopy(request: NativeRemoteCopyRequest) {
        return this.module.startRemoteCopy(request);
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

    /** Clears completed operations */
    clearSettled() {
        this.module.clearSettled();
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
}
