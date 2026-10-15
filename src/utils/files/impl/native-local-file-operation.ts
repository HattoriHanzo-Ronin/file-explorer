import { NativeEventEmitter, NativeModules } from "react-native";
import type {
    FileOperationSnapshot,
    NativeLocalCopyMoveRequest,
    NativeLocalDeleteRequest,
    NativeLocalExtractRequest
} from "../../../types/file-operations";
import type { LocalFileOperation } from "../local-file-operation";

interface NativeFileOperationModule {
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
