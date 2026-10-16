import RemoteFileManager from "../../../src/utils/operations/remote-file-manager";
import type { FileOperationSnapshot } from "../../../src/types/file-operations";

function createManager() {
    let listener!: (operation: FileOperationSnapshot) => void;
    const fileSystem = { readDir: jest.fn(), stat: jest.fn() };
    const remoteFileOperation = {
        addChangeListener: jest.fn((callback) => {
            listener = callback;
            return jest.fn();
        }),
        listOperations: jest.fn(),
        clearSettled: jest.fn(),
        startUpload: jest.fn(),
        startDownload: jest.fn(),
        startDelete: jest.fn(),
        startMove: jest.fn(),
        cancel: jest.fn()
    };
    const storage = { get: jest.fn().mockResolvedValue("access-token"), set: jest.fn(), delete: jest.fn() };
    const permission = {
        ensureNotificationPermission: jest.fn().mockResolvedValue(true),
        ensureStoragePermission: jest.fn()
    };
    return {
        fileSystem,
        listener: () => listener,
        manager: new RemoteFileManager(
            fileSystem as never,
            remoteFileOperation as never,
            storage,
            permission,
            "https://api.example.test"
        ),
        permission,
        remoteFileOperation,
        storage
    };
}

function completedOperation(operation: "REMOTE_MOVE" | "REMOTE_DELETE"): FileOperationSnapshot {
    return {
        id: `${operation}-1`,
        operation,
        status: "COMPLETED",
        bytesTransferred: 1,
        totalBytes: 1,
        revision: 1,
        remoteDir: "source",
        destinationDir: "target",
        localDir: "",
        result: {
            version: "9",
            changes: [{ path: "file.txt", targetPath: "target/file.txt", type: "FILE", completed: 1, total: 1 }]
        }
    };
}

describe("RemoteFileManager", () => {
    it("does not start an operation without a session token", async () => {
        const { manager, remoteFileOperation, storage } = createManager();
        storage.get.mockResolvedValue(null);
        await expect(manager.delete({ dir: "source", entries: [{ name: "file.txt", type: "FILE" }] })).resolves.toEqual(
            {
                success: false,
                error: { code: "SESSION_NOT_AVAILABLE", message: "La sesión no está disponible" }
            }
        );
        expect(remoteFileOperation.startDelete).not.toHaveBeenCalled();
    });

    it("does not start an operation without notification permission", async () => {
        const { manager, permission, remoteFileOperation } = createManager();
        permission.ensureNotificationPermission.mockResolvedValue(false);
        await expect(manager.delete({ entries: [{ name: "file.txt", type: "FILE" }] })).resolves.toEqual({
            success: false,
            error: {
                code: "NOTIFICATION_PERMISSION_DENIED",
                message: "Se necesita permiso para mostrar el progreso de la transferencia"
            }
        });
        expect(remoteFileOperation.startDelete).not.toHaveBeenCalled();
    });

    it("normalizes root paths and returns completed remote move changes", async () => {
        const { listener, manager, remoteFileOperation } = createManager();
        remoteFileOperation.startMove.mockImplementation(async () => {
            queueMicrotask(() => listener()(completedOperation("REMOTE_MOVE")));
            return "REMOTE_MOVE-1";
        });
        await expect(
            manager.move({ dir: " ", destination: " ", entries: [{ name: "file.txt", type: "FILE" }] })
        ).resolves.toEqual({
            success: true,
            data: completedOperation("REMOTE_MOVE").result
        });
        expect(remoteFileOperation.startMove).toHaveBeenCalledWith(
            expect.objectContaining({ destination: "", entries: [{ name: "file.txt", type: "FILE" }] })
        );
        expect(remoteFileOperation.startMove.mock.calls[0][0]).not.toHaveProperty("remoteDir");
    });

    it("tracks busy directories while an upload is active", () => {
        const { listener, manager } = createManager();
        listener()({
            ...completedOperation("REMOTE_MOVE"),
            id: "upload-1",
            operation: "UPLOAD",
            status: "RUNNING",
            remoteDir: "photos",
            destinationDir: "",
            localDir: "/storage/photos"
        });
        expect(manager.isRemoteDirectoryBusy("photos")).toBe(true);
        listener()({
            ...completedOperation("REMOTE_MOVE"),
            id: "upload-1",
            operation: "UPLOAD",
            status: "COMPLETED",
            remoteDir: "photos",
            destinationDir: "",
            localDir: "/storage/photos",
            result: { entries: [], version: "10" }
        });
        expect(manager.isRemoteDirectoryBusy("photos")).toBe(false);
    });
});
