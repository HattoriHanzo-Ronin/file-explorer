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

    async startUpload(request: NativeUploadRequest): Promise<string> {
        return this.module.startUpload(request);
    }

    async startDownload(request: NativeDownloadRequest): Promise<string> {
        return this.module.startDownload(request);
    }

    async startDelete(request: NativeRemoteDeleteRequest): Promise<string> {
        return this.module.startRemoteDelete(request);
    }

    async startMove(request: NativeRemoteMoveRequest): Promise<string> {
        return this.module.startRemoteMove(request);
    }

    cancel(id: string): void {
        this.module.cancel(id);
    }

    async listOperations(): Promise<FileOperationSnapshot[]> {
        return JSON.parse(await this.module.listOperations()) as FileOperationSnapshot[];
    }

    clearSettled(): void {
        this.module.clearSettled();
    }

    addChangeListener(listener: (operation: FileOperationSnapshot) => void): () => void {
        const subscription = this.eventEmitter.addListener("FileOperationChanged", (operation) =>
            listener(operation as unknown as FileOperationSnapshot)
        );
        return () => subscription.remove();
    }
}
