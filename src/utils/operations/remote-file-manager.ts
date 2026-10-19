import mime from "mime";
import { STORAGE_KEYS } from "../../constants/storage";
import { FILE_OPERATION_NOTIFICATION_TEXTS } from "../../constants/file-operations";
import type { EntryType, LocalModifyElement } from "../../types/files";
import type { FtpEntry } from "../../types/ftp";
import type {
    CreateDirectoryRequest,
    DeleteEntriesRequest,
    MoveEntriesRequest,
    RenameEntryRequest
} from "../../types/ftp";
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
    private readonly operationRevisions = new Map<string, { revision: number; unclaimed: boolean }>();
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

            if (this.handleChange(operation, true)) {
                this.listeners.forEach((listener) => listener(operation));
            }
        });
    }

    /** Restores persisted remote operations */
    async restore(): Promise<void> {
        const operations = await this.remoteFileOperation.listOperations();
        operations
            .filter((operation) => this.isRemoteOperation(operation))
            .forEach((operation) => this.handleChange(operation, false));
    }

    /** Clears completed remote operations */
    clearSettled(): void {
        this.remoteFileOperation.clearSettled();
    }

    /**
     * Uploads local entries
     *
     * @param items Local entries
     * @param remoteDir Remote directory
     * @returns Remote operation response
     */
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

    /**
     * Downloads remote entries
     *
     * @param items Remote entries
     * @param remoteDir Remote directory
     * @param localRoot Local storage root
     * @param localDir Local directory
     * @returns Remote operation response
     */
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

    /** Creates a remote directory */
    async createDirectory(request: CreateDirectoryRequest): Promise<ApiResponse<RemoteDirectoryOperationResult>> {
        const accessToken = await this.prepareOperation();
        if (!accessToken.success) {
            return accessToken;
        }

        try {
            const { dir, name } = request;
            const id = await this.remoteFileOperation.startMkdir({
                apiUrl: this.apiUrl,
                accessToken: accessToken.data,
                notificationTexts: FILE_OPERATION_NOTIFICATION_TEXTS,
                ...(dir === undefined || dir === " " ? {} : { remoteDir: dir }),
                name
            });
            return this.waitForDirectoryResult(id, "REMOTE_MKDIR");
        } catch {
            return this.operationError();
        }
    }

    /** Renames a remote entry */
    async rename(request: RenameEntryRequest): Promise<ApiResponse<RemoteDirectoryOperationResult>> {
        const accessToken = await this.prepareOperation();
        if (!accessToken.success) {
            return accessToken;
        }

        try {
            const { dir, entry, newName } = request;
            const id = await this.remoteFileOperation.startRename({
                apiUrl: this.apiUrl,
                accessToken: accessToken.data,
                notificationTexts: FILE_OPERATION_NOTIFICATION_TEXTS,
                ...(dir === undefined || dir === " " ? {} : { remoteDir: dir }),
                entry,
                newName
            });
            return this.waitForDirectoryResult(id, "REMOTE_RENAME");
        } catch {
            return this.operationError();
        }
    }

    /**
     * Deletes remote entries
     *
     * @param request Delete request
     * @returns Remote operation response
     */
    async delete(request: DeleteEntriesRequest): Promise<ApiResponse<RemoteChangeOperationResult>> {
        const { dir, entries } = request;
        const accessToken = await this.prepareOperation();
        if (!accessToken.success) {
            return accessToken;
        }

        try {
            const id = await this.remoteFileOperation.startDelete({
                apiUrl: this.apiUrl,
                accessToken: accessToken.data,
                notificationTexts: FILE_OPERATION_NOTIFICATION_TEXTS,
                ...(dir === undefined || dir === " " ? {} : { remoteDir: dir }),
                entries
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

    /**
     * Moves remote entries
     *
     * @param request Move request
     * @returns Remote operation response
     */
    async move(request: MoveEntriesRequest): Promise<ApiResponse<RemoteChangeOperationResult>> {
        const { destination, dir, entries } = request;
        const accessToken = await this.prepareOperation();
        if (!accessToken.success) {
            return accessToken;
        }

        try {
            const id = await this.remoteFileOperation.startMove({
                apiUrl: this.apiUrl,
                accessToken: accessToken.data,
                notificationTexts: FILE_OPERATION_NOTIFICATION_TEXTS,
                ...(dir === undefined || dir === " " ? {} : { remoteDir: dir }),
                destination: destination === " " ? "" : destination,
                entries
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

    /**
     * Cancels a remote operation
     *
     * @param id Operation identifier
     */
    cancel(id: string): void {
        this.remoteFileOperation.cancel(id);
    }

    /**
     * Returns persisted remote operations
     *
     * @returns File operation snapshots
     */
    async listOperations(): Promise<FileOperationSnapshot[]> {
        return this.remoteFileOperation.listOperations();
    }

    /**
     * Adds an operation change listener
     *
     * @param listener Operation listener
     * @returns Listener cleanup
     */
    addChangeListener(listener: (operation: FileOperationSnapshot) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Returns whether a remote directory is busy
     *
     * @param dir Remote directory
     * @returns Whether the directory is busy
     */
    isRemoteDirectoryBusy(dir: string): boolean {
        const directory = dir === " " ? "" : dir;
        return (
            (this.activeUploads.get(directory)?.size ?? 0) > 0 ||
            (this.activeRemoteChanges.get(directory)?.size ?? 0) > 0
        );
    }

    /**
     * Returns whether a local directory is receiving downloads
     *
     * @param dir Local directory
     * @returns Whether the directory is busy
     */
    isLocalDirectoryBusy(dir: string): boolean {
        return (this.activeDownloads.get(dir)?.size ?? 0) > 0;
    }

    private handleChange(operation: FileOperationSnapshot, notifyError: boolean): boolean {
        const { destinationDir, id, operation: type, remoteDir, revision, status } = operation;
        if (!this.acceptRevision(id, revision, notifyError)) {
            return false;
        }

        const active = ["PENDING", "RUNNING"].includes(status);
        this.operationRevisions.set(id, {
            revision,
            unclaimed: !active && !notifyError && !this.completionListeners.has(id)
        });
        if (["REMOTE_MOVE", "REMOTE_DELETE", "REMOTE_MKDIR", "REMOTE_RENAME"].includes(type)) {
            const directories = [remoteDir];
            if (type === "REMOTE_MOVE") {
                directories.push(destinationDir);
            }

            directories.forEach((directory) =>
                this.updateActiveOperations(this.activeRemoteChanges, directory, id, active)
            );
            if (!active) {
                this.completeOperation(operation, notifyError);
            }

            return true;
        }

        this.updateTransfer(operation, active);
        if (!active) {
            this.completeOperation(operation, notifyError);
        }

        return true;
    }

    private updateTransfer(operation: FileOperationSnapshot, active: boolean): void {
        const { id, localDir, operation: type, remoteDir } = operation;
        const directory = type === "UPLOAD" ? remoteDir : localDir;
        const operations = type === "UPLOAD" ? this.activeUploads : this.activeDownloads;
        const ids = operations.get(directory) ?? new Set<string>();
        if (active) {
            ids.add(id);
            operations.set(directory, ids);
            return;
        }

        ids.delete(id);
        if (ids.size === 0) {
            operations.delete(directory);
        }
    }

    private acceptRevision(id: string, revision: number, notifyError: boolean): boolean {
        const previous = this.operationRevisions.get(id);
        if (!previous) {
            return true;
        }

        return revision > previous.revision || (revision === previous.revision && notifyError && previous.unclaimed);
    }

    private completeOperation(operation: FileOperationSnapshot, notifyError: boolean): void {
        const { id } = operation;
        const completionListener = this.completionListeners.get(id);
        if (completionListener) {
            this.completionListeners.delete(id);
            completionListener(operation);
        } else if (notifyError) {
            this.completedOperations.set(id, operation);
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

    private async waitForDirectoryResult(
        id: string,
        type: "REMOTE_MKDIR" | "REMOTE_RENAME"
    ): Promise<ApiResponse<RemoteDirectoryOperationResult>> {
        const result = await this.waitForCompletion(id);
        if (!result.success) {
            return result;
        }

        const operation = result.data;
        if (operation.operation !== type || !operation.result || !("entries" in operation.result)) {
            return this.operationError();
        }

        return { success: true, data: operation.result };
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
        const { error, status } = operation;
        if (status === "COMPLETED") {
            return { success: true, data: operation };
        }

        return error ? { success: false, error } : this.operationError();
    }

    private operationError(): ApiResponse<never> {
        return { success: false, error: { code: "FILE_OPERATION_FAILED", message: "" } };
    }

    private getRemoteChangeResult(
        operation: FileOperationSnapshot,
        type: "REMOTE_MOVE" | "REMOTE_DELETE"
    ): RemoteChangeOperationResult | undefined {
        const { operation: operationType, result } = operation;
        if (operationType !== type || !result) {
            return undefined;
        }

        return "changes" in result && "version" in result ? result : undefined;
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
        for (const { path: localPath, type } of items) {
            await this.appendUploadEntries(entries, localPath, localPath.split("/").pop() ?? localPath, type);
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
        for (const { isDirectory, name, path: entryPath } of await this.fileSystem.readDir(localPath)) {
            await this.appendUploadEntries(entries, entryPath, `${path}/${name}`, isDirectory() ? "dir" : "file");
        }
    }

    private toFtpEntry(item: FileOperationSelection): FtpEntry {
        const { path, type } = item;
        return { name: path, type: type.toUpperCase() as FtpEntry["type"] };
    }

    private isRemoteOperation(operation: FileOperationSnapshot): boolean {
        return ["UPLOAD", "DOWNLOAD", "REMOTE_MOVE", "REMOTE_DELETE", "REMOTE_MKDIR", "REMOTE_RENAME"].includes(
            operation.operation
        );
    }
}
