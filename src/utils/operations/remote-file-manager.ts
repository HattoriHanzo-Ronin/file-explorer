import mime from "mime";
import { STORAGE_KEYS } from "../../constants/storage";
import { FILE_OPERATION_NOTIFICATION_TEXTS } from "../../constants/file-operations";
import type { EntryType, LocalModifyElement } from "../../types/files";
import type { FtpEntry } from "../../types/ftp";
import type { DeleteEntriesRequest, MoveEntriesRequest } from "../../types/ftp";
import type { ApiResponse } from "../../types/api-response";
import type {
    NativeUploadEntry,
    FileOperationSelection,
    FileOperationSnapshot,
    RemoteChangeOperationResult,
    RemoteDirectoryOperationResult
} from "../../types/file-operations";
import type { RemoteFileOperation } from "../files/remote-file-operation";
import type { FileSystem } from "../files/file-system";
import type { Permission } from "../permissions/permission";
import type { Storage } from "../storage/storage";

/**
 * Coordinates native background remote file operations
 *
 * @author HattoriHanzo-Ronin
 */
export default class RemoteFileManager {
    private readonly fileSystem: FileSystem;
    private readonly remoteFileOperation: RemoteFileOperation;
    private readonly storage: Storage;
    private readonly permission: Permission;
    private readonly apiUrl: string;
    private readonly activeUploads = new Map<string, Set<string>>();
    private readonly activeDownloads = new Map<string, Set<string>>();
    private readonly activeRemoteChanges = new Map<string, Set<string>>();
    private readonly listeners = new Set<(operation: FileOperationSnapshot) => void>();
    private readonly completionListeners = new Map<string, (operation: FileOperationSnapshot) => void>();
    private readonly completedOperations = new Map<string, FileOperationSnapshot>();

    constructor(
        fileSystem: FileSystem,
        remoteFileOperation: RemoteFileOperation,
        storage: Storage,
        permission: Permission,
        apiUrl: string
    ) {
        this.fileSystem = fileSystem;
        this.remoteFileOperation = remoteFileOperation;
        this.storage = storage;
        this.permission = permission;
        this.apiUrl = apiUrl;
        this.remoteFileOperation.addChangeListener((operation) => {
            if (!this.isRemoteOperation(operation)) {
                return;
            }

            this.handleChange(operation, true);
            this.listeners.forEach((listener) => listener(operation));
        });
    }

    async restore(): Promise<void> {
        const operations = await this.remoteFileOperation.listOperations();
        operations
            .filter((operation) => this.isRemoteOperation(operation))
            .forEach((operation) => this.handleChange(operation, false));
    }

    clearSettled(): void {
        this.remoteFileOperation.clearSettled();
    }

    async upload(items: LocalModifyElement[], remoteDir: string): Promise<ApiResponse<RemoteDirectoryOperationResult>> {
        const accessToken = await this.prepareOperation();
        if (!accessToken.success) {
            return accessToken;
        }

        try {
            const id = await this.remoteFileOperation.startUpload({
                apiUrl: this.apiUrl,
                accessToken: accessToken.data,
                notificationTexts: FILE_OPERATION_NOTIFICATION_TEXTS,
                ...(remoteDir === " " ? {} : { remoteDir }),
                entries: await this.getUploadEntries(items)
            });
            const result = await this.waitForCompletion(id);
            if (!result.success) {
                return result;
            }

            if (result.data.operation !== "UPLOAD" || !result.data.result || !("entries" in result.data.result)) {
                return this.operationError();
            }

            return { success: true, data: result.data.result };
        } catch {
            return this.operationError();
        }
    }

    async download(
        items: FileOperationSelection[],
        remoteDir: string,
        localRoot: string,
        localDir: string
    ): Promise<ApiResponse<void>> {
        const accessToken = await this.prepareOperation();
        if (!accessToken.success) {
            return accessToken;
        }

        try {
            const id = await this.remoteFileOperation.startDownload({
                apiUrl: this.apiUrl,
                accessToken: accessToken.data,
                notificationTexts: FILE_OPERATION_NOTIFICATION_TEXTS,
                ...(remoteDir === " " ? {} : { remoteDir }),
                destination: localDir === " " ? localRoot : `${localRoot}/${localDir}`,
                entries: items.map((item) => this.toFtpEntry(item))
            });
            const result = await this.waitForCompletion(id);
            return result.success ? { success: true, data: undefined } : result;
        } catch {
            return this.operationError();
        }
    }

    async delete(request: DeleteEntriesRequest): Promise<ApiResponse<RemoteChangeOperationResult>> {
        const accessToken = await this.prepareOperation();
        if (!accessToken.success) {
            return accessToken;
        }

        try {
            const id = await this.remoteFileOperation.startDelete({
                apiUrl: this.apiUrl,
                accessToken: accessToken.data,
                notificationTexts: FILE_OPERATION_NOTIFICATION_TEXTS,
                ...(request.dir === undefined || request.dir === " " ? {} : { remoteDir: request.dir }),
                entries: request.entries
            });
            const result = await this.waitForCompletion(id);
            if (!result.success) {
                return result;
            }

            const operationResult = this.getRemoteChangeResult(result.data, "REMOTE_DELETE");
            if (!operationResult) {
                return this.operationError();
            }

            return { success: true, data: operationResult };
        } catch {
            return this.operationError();
        }
    }

    async move(request: MoveEntriesRequest): Promise<ApiResponse<RemoteChangeOperationResult>> {
        const accessToken = await this.prepareOperation();
        if (!accessToken.success) {
            return accessToken;
        }

        try {
            const id = await this.remoteFileOperation.startMove({
                apiUrl: this.apiUrl,
                accessToken: accessToken.data,
                notificationTexts: FILE_OPERATION_NOTIFICATION_TEXTS,
                ...(request.dir === undefined || request.dir === " " ? {} : { remoteDir: request.dir }),
                destination: request.destination === " " ? "" : request.destination,
                entries: request.entries
            });
            const result = await this.waitForCompletion(id);
            if (!result.success) {
                return result;
            }

            const operationResult = this.getRemoteChangeResult(result.data, "REMOTE_MOVE");
            if (!operationResult) {
                return this.operationError();
            }

            return { success: true, data: operationResult };
        } catch {
            return this.operationError();
        }
    }

    cancel(id: string): void {
        this.remoteFileOperation.cancel(id);
    }

    async listOperations(): Promise<FileOperationSnapshot[]> {
        return this.remoteFileOperation.listOperations();
    }

    addChangeListener(listener: (operation: FileOperationSnapshot) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    isRemoteDirectoryBusy(dir: string): boolean {
        const directory = dir === " " ? "" : dir;
        return (
            (this.activeUploads.get(directory)?.size ?? 0) > 0 ||
            (this.activeRemoteChanges.get(directory)?.size ?? 0) > 0
        );
    }

    isLocalDirectoryBusy(dir: string): boolean {
        return (this.activeDownloads.get(dir)?.size ?? 0) > 0;
    }

    private handleChange(operation: FileOperationSnapshot, notifyError: boolean): void {
        const active = ["PENDING", "RUNNING"].includes(operation.status);
        if (["REMOTE_MOVE", "REMOTE_DELETE"].includes(operation.operation)) {
            const directories = [operation.remoteDir];
            if (operation.operation === "REMOTE_MOVE") {
                directories.push(operation.destinationDir);
            }

            directories.forEach((directory) =>
                this.updateActiveOperations(this.activeRemoteChanges, directory, operation.id, active)
            );
            if (!active) {
                this.completeOperation(operation, notifyError);
            }

            return;
        }

        const directory = operation.operation === "UPLOAD" ? operation.remoteDir : operation.localDir;
        const operations = operation.operation === "UPLOAD" ? this.activeUploads : this.activeDownloads;
        const ids = operations.get(directory) ?? new Set<string>();
        if (active) {
            ids.add(operation.id);
            operations.set(directory, ids);
            return;
        }

        ids.delete(operation.id);
        if (ids.size > 0) {
            return;
        }

        operations.delete(directory);
        this.completeOperation(operation, notifyError);
    }

    private completeOperation(operation: FileOperationSnapshot, notifyError: boolean): void {
        const completionListener = this.completionListeners.get(operation.id);
        if (completionListener) {
            this.completionListeners.delete(operation.id);
            completionListener(operation);
        } else if (notifyError) {
            this.completedOperations.set(operation.id, operation);
        }
    }

    private updateActiveOperations(
        operations: Map<string, Set<string>>,
        directory: string,
        id: string,
        active: boolean
    ): void {
        const ids = operations.get(directory) ?? new Set<string>();
        if (active) {
            ids.add(id);
            operations.set(directory, ids);
            return;
        }

        ids.delete(id);
        if (ids.size > 0) {
            return;
        }

        operations.delete(directory);
    }

    private waitForCompletion(id: string): Promise<ApiResponse<FileOperationSnapshot>> {
        const completedOperation = this.completedOperations.get(id);
        if (completedOperation) {
            this.completedOperations.delete(id);
            return Promise.resolve(this.toApiResponse(completedOperation));
        }

        return new Promise((resolve) => {
            this.completionListeners.set(id, (operation) => resolve(this.toApiResponse(operation)));
        });
    }

    private toApiResponse(operation: FileOperationSnapshot): ApiResponse<FileOperationSnapshot> {
        if (operation.status === "COMPLETED") {
            return { success: true, data: operation };
        }

        return operation.error ? { success: false, error: operation.error } : this.operationError();
    }

    private operationError(): ApiResponse<never> {
        return { success: false, error: { code: "FILE_OPERATION_FAILED", message: "" } };
    }

    private getRemoteChangeResult(
        operation: FileOperationSnapshot,
        type: "REMOTE_MOVE" | "REMOTE_DELETE"
    ): RemoteChangeOperationResult | undefined {
        if (operation.operation !== type || !operation.result) {
            return undefined;
        }

        return "changes" in operation.result && "version" in operation.result ? operation.result : undefined;
    }

    private async prepareOperation(): Promise<ApiResponse<string>> {
        const accessToken = await this.storage.get<string>(STORAGE_KEYS.accessToken);
        if (!accessToken) {
            return {
                success: false,
                error: { code: "SESSION_NOT_AVAILABLE", message: "La sesión no está disponible" }
            };
        }

        if (!(await this.permission.ensureNotificationPermission())) {
            return {
                success: false,
                error: {
                    code: "NOTIFICATION_PERMISSION_DENIED",
                    message: "Se necesita permiso para mostrar el progreso de la transferencia"
                }
            };
        }

        return { success: true, data: accessToken };
    }

    private async getUploadEntries(items: LocalModifyElement[]): Promise<NativeUploadEntry[]> {
        const entries: NativeUploadEntry[] = [];
        for (const item of items) {
            const localPath = item.path;
            await this.appendUploadEntries(entries, localPath, item.path.split("/").pop() ?? item.path, item.type);
        }

        return entries;
    }

    private async appendUploadEntries(
        entries: NativeUploadEntry[],
        localPath: string,
        path: string,
        type: EntryType
    ): Promise<void> {
        if (type === "file") {
            const { size } = await this.fileSystem.stat(localPath);
            entries.push({
                path,
                type: "FILE",
                size,
                localPath,
                mimeType: mime.getType(localPath) ?? "application/octet-stream"
            });
            return;
        }

        entries.push({ path, type: "DIR" });
        for (const entry of await this.fileSystem.readDir(localPath)) {
            await this.appendUploadEntries(
                entries,
                entry.path,
                `${path}/${entry.name}`,
                entry.isDirectory() ? "dir" : "file"
            );
        }
    }

    private toFtpEntry(item: FileOperationSelection): FtpEntry {
        return { name: item.path, type: item.type.toUpperCase() as FtpEntry["type"] };
    }

    private isRemoteOperation(operation: FileOperationSnapshot): boolean {
        return ["UPLOAD", "DOWNLOAD", "REMOTE_MOVE", "REMOTE_DELETE"].includes(operation.operation);
    }
}
