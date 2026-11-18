import { FILE_OPERATION_NOTIFICATION_TEXTS } from "../../constants/file-operations";
import { EXTRACTABLE_ARCHIVE_EXTENSIONS } from "../../constants/archives";
import type {
    LocalCopyMoveRequest,
    LocalDirectoryRequest,
    LocalDirectoryUpdate,
    LocalModifyElement,
    LocalNamedEntryRequest,
    LocalRenameRequest
} from "../../types/files";
import type { FileOperationSnapshot } from "../../types/file-operations";
import type { LocalResponse } from "../../types/local-response";
import type { FileSystemEntry } from "../../types/files";
import type { LocalFileOperation } from "../files/local-file-operation";
import type { Permission } from "../permissions/permission";
import FileUtils from "../file-utils";

/**
 * Coordinates local file operations
 *
 * @author HattoriHanzo-Ronin
 */
export default class LocalFileManager {
    private static LOCAL_VERSION = "";
    private readonly localFileOperation: LocalFileOperation;
    private readonly permission: Permission;
    private readonly activeDirectories = new Map<string, Set<string>>();
    private readonly operationRevisions = new Map<string, number>();
    private readonly completionListeners = new Map<string, (operation: FileOperationSnapshot) => void>();
    private readonly completedOperations = new Map<string, FileOperationSnapshot>();

    constructor(localFileOperation: LocalFileOperation, permission: Permission) {
        this.localFileOperation = localFileOperation;
        this.permission = permission;
        this.localFileOperation.addChangeListener((operation) => this.handleChange(operation));
    }

    /** Restores persisted local operations */
    async restore(): Promise<void> {
        const operations = await this.localFileOperation.listOperations();
        operations.forEach((operation) => this.handleChange(operation));
    }

    /**
     * Returns directory entries and their version
     *
     * @param params.rootPath Storage root path
     * @param params.path Directory path
     * @returns Directory entries and version
     */
    async dir(params: LocalDirectoryRequest): Promise<LocalResponse<{ entries: FileSystemEntry[]; version: string }>> {
        const { rootPath, path } = params;
        try {
            const entries = await this.readDirectory(this.absolutePath(rootPath, path));
            const version = FileUtils.hashDirectory(entries);
            LocalFileManager.LOCAL_VERSION = version;
            return { success: true, data: { entries, version } };
        } catch {
            return this.operationError("Error al listar");
        }
    }

    /**
     * Returns a directory version
     *
     * @param params.rootPath Storage root path
     * @param params.path Directory path
     * @returns Directory version
     */
    async getVersion(params: LocalDirectoryRequest): Promise<LocalResponse<{ version: string }>> {
        const { rootPath, path } = params;
        if (this.isDirectoryBusy(rootPath, path)) {
            return { success: true, data: { version: LocalFileManager.LOCAL_VERSION } };
        }

        try {
            const entries = await this.readDirectory(this.absolutePath(rootPath, path));
            return { success: true, data: { version: FileUtils.hashDirectory(entries) } };
        } catch {
            return this.operationError("Error al comprobar la carpeta");
        }
    }

    /**
     * Creates a local directory
     *
     * @param params.rootPath Storage root path
     * @param params.dir Directory path
     * @param params.name Directory name
     * @returns Local operation response
     */
    async createDirectory(params: LocalNamedEntryRequest): Promise<LocalResponse<LocalDirectoryUpdate[]>> {
        const { rootPath, dir, name } = params;
        const error = FileUtils.validateOperationName({ name, field: "name" });
        if (error) {
            return { success: false, error };
        }

        const normalizedName = name.trim();
        try {
            const destination = this.absolutePath(rootPath, dir);
            if (await this.localFileOperation.tryCreateDirectory({ destination, name: normalizedName })) {
                return this.getDirectoryUpdates([destination]);
            }

            const permission = await this.prepareOperation();
            if (!permission.success) {
                return permission;
            }
            const id = await this.localFileOperation.createDirectory({
                destination,
                name: normalizedName,
                notificationTexts: FILE_OPERATION_NOTIFICATION_TEXTS
            });
            const result = await this.waitForCompletion(id);
            return result.success ? this.getDirectoryUpdates([destination]) : result;
        } catch {
            return this.operationError("Error al crear carpeta");
        }
    }

    /**
     * Renames a local entry
     *
     * @param params.entry Entry to rename
     * @param params.name New entry name
     * @returns Local operation response
     */
    async rename(params: LocalRenameRequest): Promise<LocalResponse<LocalDirectoryUpdate[]>> {
        const { entry, name } = params;
        const error = FileUtils.validateOperationName({
            name,
            field: "newName",
            currentName: entry.path.split("/").pop()
        });
        if (error) {
            return { success: false, error };
        }

        const normalizedName = name.trim();
        try {
            const source = entry.path;
            const destination = source.substring(0, source.lastIndexOf("/"));
            if (await this.localFileOperation.tryRename({ source, name: normalizedName })) {
                return this.getDirectoryUpdates([destination]);
            }

            const permission = await this.prepareOperation();
            if (!permission.success) {
                return permission;
            }
            const id = await this.localFileOperation.rename({
                source,
                name: normalizedName,
                notificationTexts: FILE_OPERATION_NOTIFICATION_TEXTS
            });
            const result = await this.waitForCompletion(id);
            return result.success ? this.getDirectoryUpdates([destination]) : result;
        } catch {
            return this.operationError("Error al renombrar");
        }
    }

    /**
     * Opens a local file
     *
     * @param params.rootPath Storage root path
     * @param params.dir Directory path
     * @param params.name File name
     * @returns Local operation response
     */
    async openFile(params: LocalNamedEntryRequest): Promise<LocalResponse<void>> {
        const { rootPath, dir, name } = params;
        try {
            await this.localFileOperation.openFile(`${this.absolutePath(rootPath, dir)}/${name}`);
            return { success: true, data: undefined };
        } catch {
            return this.operationError(`Error al abrir el archivo ${name}`);
        }
    }

    /**
     * Copies local entries
     *
     * @param params.items Entries to copy
     * @param params.destination Destination path
     * @returns Local operation response
     */
    async copy(params: LocalCopyMoveRequest): Promise<LocalResponse<LocalDirectoryUpdate[]>> {
        return this.startCopyMove(params.items, params.destination, false);
    }

    /**
     * Moves local entries
     *
     * @param params.items Entries to move
     * @param params.destination Destination path
     * @returns Local operation response
     */
    async move(params: LocalCopyMoveRequest): Promise<LocalResponse<LocalDirectoryUpdate[]>> {
        return this.startCopyMove(params.items, params.destination, true);
    }

    /**
     * Deletes local entries
     *
     * @param items Entries to delete
     * @returns Local operation response
     */
    async delete(items: LocalModifyElement[]): Promise<LocalResponse<LocalDirectoryUpdate[]>> {
        const permission = await this.prepareOperation();
        if (!permission.success) {
            return permission;
        }

        try {
            const sources = items.map(({ path }) => path);
            const id = await this.localFileOperation.startDelete({
                notificationTexts: FILE_OPERATION_NOTIFICATION_TEXTS,
                sources,
                destination: sources[0]?.substring(0, sources[0].lastIndexOf("/")) ?? ""
            });
            const result = await this.waitForCompletion(id);
            return result.success
                ? this.getDirectoryUpdates(sources.map((path) => path.substring(0, path.lastIndexOf("/"))))
                : result;
        } catch {
            return this.operationError();
        }
    }

    /**
     * Extracts a local archive
     *
     * @param params.rootPath Storage root path
     * @param params.dir Directory path
     * @param params.name Archive name
     * @returns Local operation response
     */
    async extract(params: LocalNamedEntryRequest): Promise<LocalResponse<LocalDirectoryUpdate[]>> {
        const { rootPath, dir, name } = params;
        const extension = name.split(".").pop()?.toLowerCase() ?? "";
        if (!EXTRACTABLE_ARCHIVE_EXTENSIONS.includes(extension)) {
            return {
                success: false,
                error: { code: "ARCHIVE_FORMAT_NOT_SUPPORTED", message: "Formato de archivo no compatible" }
            };
        }

        const permission = await this.prepareOperation();
        if (!permission.success) {
            return permission;
        }

        try {
            const destination = this.absolutePath(rootPath, dir);
            const id = await this.localFileOperation.startExtract({
                notificationTexts: FILE_OPERATION_NOTIFICATION_TEXTS,
                source: `${destination}/${name}`,
                destination
            });
            const result = await this.waitForCompletion(id);
            return result.success ? this.getDirectoryUpdates([destination]) : result;
        } catch {
            return this.operationError();
        }
    }

    /**
     * Cancels a local operation
     *
     * @param id Operation identifier
     */
    cancel(id: string): void {
        this.localFileOperation.cancel(id);
    }

    /** Returns the current contents of the affected directories */
    async getDirectoryUpdates(paths: string[]): Promise<LocalResponse<LocalDirectoryUpdate[]>> {
        const updates = await Promise.all(
            [...new Set(paths)].map(async (path) => {
                try {
                    return { path, entries: await this.readDirectory(path) };
                } catch {
                    return null;
                }
            })
        );
        return { success: true, data: updates.filter((update) => update !== null) };
    }

    static get localVersion(): string {
        return LocalFileManager.LOCAL_VERSION;
    }

    private async startCopyMove(
        items: LocalModifyElement[],
        destination: string,
        move: boolean
    ): Promise<LocalResponse<LocalDirectoryUpdate[]>> {
        const permission = await this.prepareOperation();
        if (!permission.success) {
            return permission;
        }

        try {
            const request = {
                notificationTexts: FILE_OPERATION_NOTIFICATION_TEXTS,
                sources: items.map(({ path }) => path),
                destination
            };
            const id = move
                ? await this.localFileOperation.startMove(request)
                : await this.localFileOperation.startCopy(request);
            const result = await this.waitForCompletion(id);
            const paths = move
                ? [destination, ...request.sources.map((path) => path.substring(0, path.lastIndexOf("/")))]
                : [destination];
            return result.success ? this.getDirectoryUpdates(paths) : result;
        } catch {
            return this.operationError();
        }
    }

    private async prepareOperation(): Promise<LocalResponse<void>> {
        if (!(await this.permission.ensureNotificationPermission())) {
            return this.operationError("Se necesita permiso para mostrar el progreso de la operación");
        }

        return { success: true, data: undefined };
    }

    private async readDirectory(path: string): Promise<FileSystemEntry[]> {
        const entries = await this.localFileOperation.readDir(path);
        if (path.substring(path.lastIndexOf("/") + 1) !== "Android") {
            return entries;
        }

        return entries.filter(({ name }) => name !== "data" && name !== "obb");
    }

    private handleChange(operation: FileOperationSnapshot): void {
        const { id, revision, status } = operation;
        if (revision <= (this.operationRevisions.get(id) ?? -1)) {
            return;
        }

        this.operationRevisions.set(id, revision);
        this.updateActiveDirectories(operation);
        if (this.isLocalOperation(operation) && !["PENDING", "RUNNING"].includes(status)) {
            this.completeOperation(operation);
        }
    }

    private completeOperation(operation: FileOperationSnapshot): void {
        const { id } = operation;
        const listener = this.completionListeners.get(id);
        if (listener) {
            this.completionListeners.delete(id);
            listener(operation);
        } else {
            this.completedOperations.set(id, operation);
        }
    }

    private waitForCompletion(id: string): Promise<LocalResponse<void>> {
        const completed = this.completedOperations.get(id);
        if (completed) {
            this.completedOperations.delete(id);
            return Promise.resolve(this.toLocalResponse(completed));
        }

        return new Promise((resolve) => {
            this.completionListeners.set(id, (operation) => resolve(this.toLocalResponse(operation)));
        });
    }

    private toLocalResponse(operation: FileOperationSnapshot): LocalResponse<void> {
        const { error, status } = operation;
        if (status === "COMPLETED") {
            return { success: true, data: undefined };
        }

        return error ? { success: false, error } : this.operationError();
    }

    private operationError(message = ""): LocalResponse<never> {
        return { success: false, error: { code: "FILE_OPERATION_FAILED", message } };
    }

    private absolutePath(rootPath: string, path: string): string {
        return path === " " ? rootPath : `${rootPath}/${path}`;
    }

    private isDirectoryBusy(rootPath: string, path: string): boolean {
        return (this.activeDirectories.get(this.absolutePath(rootPath, path))?.size ?? 0) > 0;
    }

    private updateActiveDirectories(operation: FileOperationSnapshot): void {
        const { id, localDir: directory, operation: type, status } = operation;
        if (!["DOWNLOAD", "LOCAL_COPY", "LOCAL_MOVE", "LOCAL_DELETE", "LOCAL_EXTRACT"].includes(type)) {
            return;
        }

        if (!directory) {
            return;
        }

        const ids = this.activeDirectories.get(directory) ?? new Set<string>();
        if (["PENDING", "RUNNING"].includes(status)) {
            ids.add(id);
            this.activeDirectories.set(directory, ids);
            return;
        }

        ids.delete(id);
        if (ids.size > 0) {
            return;
        }

        this.activeDirectories.delete(directory);
    }

    private isLocalOperation(operation: FileOperationSnapshot): boolean {
        const { operation: type } = operation;
        return ["LOCAL_MKDIR", "LOCAL_RENAME", "LOCAL_COPY", "LOCAL_MOVE", "LOCAL_DELETE", "LOCAL_EXTRACT"].includes(
            type
        );
    }
}
