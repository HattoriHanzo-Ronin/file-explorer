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

    async startCopy(request: NativeLocalCopyMoveRequest): Promise<string> {
        return this.module.startLocalCopy(request);
    }

    async startMove(request: NativeLocalCopyMoveRequest): Promise<string> {
        return this.module.startLocalMove(request);
    }

    async startDelete(request: NativeLocalDeleteRequest): Promise<string> {
        return this.module.startLocalDelete(request);
    }

    async startExtract(request: NativeLocalExtractRequest): Promise<string> {
        return this.module.startLocalExtract(request);
    }

    async openFile(path: string): Promise<void> {
        await NativeModules.FileOpener.openFile(path);
    }

    cancel(id: string): void {
        this.module.cancel(id);
    }

    async listOperations(): Promise<FileOperationSnapshot[]> {
        return JSON.parse(await this.module.listOperations()) as FileOperationSnapshot[];
    }

    addChangeListener(listener: (operation: FileOperationSnapshot) => void): () => void {
        const subscription = this.eventEmitter.addListener("FileOperationChanged", (operation) =>
            listener(operation as unknown as FileOperationSnapshot)
        );
        return () => subscription.remove();
    }
}
