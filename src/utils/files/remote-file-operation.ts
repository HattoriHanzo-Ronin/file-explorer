import type {
    FileOperationSnapshot,
    NativeDownloadRequest,
    NativeRemoteDeleteRequest,
    NativeRemoteMoveRequest,
    NativeUploadRequest
} from "../../types/file-operations";

/** Remote background file operation contract */
export interface RemoteFileOperation {
    startUpload(request: NativeUploadRequest): Promise<string>;

    startDownload(request: NativeDownloadRequest): Promise<string>;

    startDelete(request: NativeRemoteDeleteRequest): Promise<string>;

    startMove(request: NativeRemoteMoveRequest): Promise<string>;

    cancel(id: string): void;

    listOperations(): Promise<FileOperationSnapshot[]>;

    clearSettled(): void;

    addChangeListener(listener: (operation: FileOperationSnapshot) => void): () => void;
}
