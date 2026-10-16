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
        const { fileSystem, manager } = createManager();
        fileSystem.exists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        await expect(manager.createDirectory("/storage", "docs", "Report")).resolves.toEqual({
            success: true,
            data: undefined
        });
        expect(fileSystem.mkdir).toHaveBeenCalledWith("/storage/docs/Report (1)");
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
        const { listener, localFileOperation, manager } = createManager();
        localFileOperation.startDelete.mockImplementation(async () => {
            queueMicrotask(() =>
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
            data: undefined
        });
    });
});
