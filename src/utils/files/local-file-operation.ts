import type {
    FileOperationSnapshot,
    NativeLocalCopyMoveRequest,
    NativeLocalDeleteRequest,
    NativeLocalMkdirRequest,
    NativeLocalRenameRequest,
    NativeLocalExtractRequest
} from "../../types/file-operations";

/** Local background file operation contract */
export interface LocalFileOperation {
    tryCreateDirectory(destination: string, name: string): Promise<boolean>;

    tryRename(source: string, name: string): Promise<boolean>;

    createDirectory(request: NativeLocalMkdirRequest): Promise<string>;

    rename(request: NativeLocalRenameRequest): Promise<string>;

    startCopy(request: NativeLocalCopyMoveRequest): Promise<string>;

    startMove(request: NativeLocalCopyMoveRequest): Promise<string>;

    startDelete(request: NativeLocalDeleteRequest): Promise<string>;

    startExtract(request: NativeLocalExtractRequest): Promise<string>;

    openFile(path: string): Promise<void>;

    cancel(id: string): void;

    listOperations(): Promise<FileOperationSnapshot[]>;

    addChangeListener(listener: (operation: FileOperationSnapshot) => void): () => void;
}
