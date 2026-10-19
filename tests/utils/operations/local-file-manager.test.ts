import LocalFileManager from "../../../src/utils/operations/local-file-manager";
import type { FileOperationSnapshot } from "../../../src/types/file-operations";

function createManager() {
    let listener!: (operation: FileOperationSnapshot) => void;
    const fileSystem = {
        internalRoot: { id: "internal", name: "Internal", path: "/storage", type: "INTERNAL" as const },
        exists: jest.fn(),
        readDir: jest.fn(),
        stat: jest.fn(),
        mkdir: jest.fn(),
        moveFile: jest.fn()
    };
    const localFileOperation = {
        tryCreateDirectory: jest.fn(),
        tryRename: jest.fn(),
        createDirectory: jest.fn(),
        rename: jest.fn(),
        addChangeListener: jest.fn((callback) => {
            listener = callback;
            return jest.fn();
        }),
        listOperations: jest.fn(),
        startDelete: jest.fn(),
        startExtract: jest.fn(),
        startCopy: jest.fn(),
        startMove: jest.fn(),
        cancel: jest.fn(),
        openFile: jest.fn()
    };
    const permission = {
        ensureNotificationPermission: jest.fn().mockResolvedValue(true),
        ensureStoragePermission: jest.fn()
    };
    return {
        fileSystem,
        listener: () => listener,
        localFileOperation,
        manager: new LocalFileManager(fileSystem as never, localFileOperation as never, permission as never)
    };
}

describe("LocalFileManager", () => {
    beforeEach(() => {
        LocalFileManager.LOCAL_VERSION = "";
    });

    it("lists a directory and stores its version", async () => {
        const { fileSystem, manager } = createManager();
        fileSystem.readDir.mockResolvedValue([
            { name: "a.txt", path: "/storage/a.txt", size: 1, isDirectory: () => false }
        ]);
        const result = await manager.dir("/storage", " ");
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.entries).toHaveLength(1);
            expect(LocalFileManager.LOCAL_VERSION).toBe(result.data.version);
        }
        expect(fileSystem.readDir).toHaveBeenCalledWith("/storage");
    });

    it("creates a non-colliding directory name", async () => {
        const { fileSystem, localFileOperation, manager } = createManager();
        localFileOperation.tryCreateDirectory.mockResolvedValue(true);
        fileSystem.readDir.mockResolvedValue([]);
        await expect(manager.createDirectory("/storage", "docs", "Report")).resolves.toEqual({
            success: true,
            data: [{ path: "/storage/docs", entries: [] }]
        });
        expect(localFileOperation.tryCreateDirectory).toHaveBeenCalledWith("/storage/docs", "Report");
        expect(localFileOperation.createDirectory).not.toHaveBeenCalled();
    });

    it("starts a foreground operation when creating a directory is blocked", async () => {
        const { fileSystem, listener, localFileOperation, manager } = createManager();
        fileSystem.readDir.mockResolvedValue([]);
        localFileOperation.tryCreateDirectory.mockResolvedValue(false);
        localFileOperation.createDirectory.mockImplementation(async () => {
            void Promise.resolve().then(() =>
                listener()({
                    id: "mkdir-1",
                    operation: "LOCAL_MKDIR",
                    status: "COMPLETED",
                    bytesTransferred: 0,
                    totalBytes: 0,
                    revision: 1,
                    remoteDir: "",
                    destinationDir: "",
                    localDir: "/storage/docs"
                })
            );
            return "mkdir-1";
        });
        await expect(manager.createDirectory("/storage", "docs", "Report")).resolves.toEqual({
            success: true,
            data: [{ path: "/storage/docs", entries: [] }]
        });
        expect(localFileOperation.createDirectory).toHaveBeenCalledTimes(1);
    });

    it("rejects invalid names and unchanged renames before starting an operation", async () => {
        const { localFileOperation, manager } = createManager();
        const invalid = await manager.createDirectory("/storage", " ", "bad/name");
        const unchanged = await manager.rename({ path: "/storage/report.txt", type: "file" }, " report.txt ");
        expect(invalid.success).toBe(false);
        expect(unchanged.success).toBe(false);
        if (!invalid.success && !unchanged.success) {
            expect(invalid.error.details?.[0].field).toBe("name");
            expect(unchanged.error.details?.[0].field).toBe("newName");
        }
        expect(localFileOperation.tryCreateDirectory).not.toHaveBeenCalled();
        expect(localFileOperation.tryRename).not.toHaveBeenCalled();
    });

    it("rejects unsupported archive formats before starting a native operation", async () => {
        const { localFileOperation, manager } = createManager();
        await expect(manager.extract("/storage", " ", "archive.rar")).resolves.toEqual({
            success: false,
            error: { code: "ARCHIVE_FORMAT_NOT_SUPPORTED", message: "Formato de archivo no compatible" }
        });
        expect(localFileOperation.startExtract).not.toHaveBeenCalled();
    });

    it("waits for a native delete completion", async () => {
        const { fileSystem, listener, localFileOperation, manager } = createManager();
        fileSystem.readDir.mockResolvedValue([]);
        listener()({
            id: "download-1",
            operation: "DOWNLOAD",
            status: "RUNNING",
            bytesTransferred: 0,
            totalBytes: 1,
            revision: 1,
            remoteDir: "",
            destinationDir: "",
            localDir: "/storage/docs"
        });
        localFileOperation.startDelete.mockImplementation(async () => {
            void Promise.resolve().then(() =>
                listener()({
                    id: "delete-1",
                    operation: "LOCAL_DELETE",
                    status: "COMPLETED",
                    bytesTransferred: 1,
                    totalBytes: 1,
                    revision: 1,
                    remoteDir: "",
                    destinationDir: "",
                    localDir: "/storage/docs"
                })
            );
            return "delete-1";
        });
        await expect(manager.delete([{ path: "/storage/docs/a.txt", type: "file" }])).resolves.toEqual({
            success: true,
            data: [{ path: "/storage/docs", entries: [] }]
        });
        expect(fileSystem.readDir).toHaveBeenCalledWith("/storage/docs");
        fileSystem.readDir.mockClear();
        await manager.getVersion("/storage", "docs");
        expect(fileSystem.readDir).not.toHaveBeenCalled();
    });
});
