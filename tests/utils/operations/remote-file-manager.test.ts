import RemoteFileManager from "../../../src/utils/operations/remote-file-manager";
import type { FileOperationSnapshot } from "../../../src/types/file-operations";

function createManager() {
    let listener!: (operation: FileOperationSnapshot) => void;
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
        startMkdir: jest.fn(),
        startRename: jest.fn(),
        cancel: jest.fn()
    };
    const storage = { get: jest.fn().mockResolvedValue("access-token"), set: jest.fn(), delete: jest.fn() };
    const permission = {
        ensureNotificationPermission: jest.fn().mockResolvedValue(true),
        ensureStoragePermission: jest.fn()
    };
    return {
        listener: () => listener,
        manager: new RemoteFileManager(
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
    it.each(["REMOTE_MKDIR", "REMOTE_RENAME"] as const)(
        "returns the native directory result for %s",
        async (operation) => {
            const { listener, manager, remoteFileOperation } = createManager();
            const start =
                operation === "REMOTE_MKDIR" ? remoteFileOperation.startMkdir : remoteFileOperation.startRename;
            start.mockImplementation(async () => {
                void Promise.resolve().then(() =>
                    listener()({
                        id: "operation-1",
                        operation,
                        status: "COMPLETED",
                        bytesTransferred: 0,
                        totalBytes: 0,
                        revision: 1,
                        remoteDir: "",
                        destinationDir: "",
                        localDir: "",
                        result: { entries: [], version: "12" }
                    })
                );
                return "operation-1";
            });
            const result =
                operation === "REMOTE_MKDIR"
                    ? await manager.createDirectory({ name: "folder", dir: " " })
                    : await manager.rename({ entry: { name: "old", type: "FILE" }, newName: "new", dir: " " });
            expect(result).toEqual({ success: true, data: { entries: [], version: "12" } });
            expect(start.mock.calls[0][0]).not.toHaveProperty("remoteDir");
        }
    );

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

    it("passes selected local entries to the native upload operation", async () => {
        const { listener, manager, remoteFileOperation } = createManager();
        const entries = [{ path: "/storage/photo.jpg", type: "file" as const }];
        remoteFileOperation.startUpload.mockImplementation(async () => {
            void Promise.resolve().then(() =>
                listener()({
                    ...completedOperation("REMOTE_MOVE"),
                    id: "upload-1",
                    operation: "UPLOAD",
                    result: { entries: [], version: "10" }
                })
            );
            return "upload-1";
        });
        await expect(manager.upload(entries, " ")).resolves.toEqual({ success: true, data: { entries: [], version: "10" } });
        expect(remoteFileOperation.startUpload).toHaveBeenCalledWith(expect.objectContaining({ entries }));
    });

    it("normalizes root paths and returns completed remote move changes", async () => {
        const { listener, manager, remoteFileOperation } = createManager();
        remoteFileOperation.startMove.mockImplementation(async () => {
            void Promise.resolve().then(() => listener()(completedOperation("REMOTE_MOVE")));
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
            revision: 2,
            remoteDir: "photos",
            destinationDir: "",
            localDir: "/storage/photos",
            result: { entries: [], version: "10" }
        });
        expect(manager.isRemoteDirectoryBusy("photos")).toBe(false);
    });

    it("completes each download independently when they share a destination", async () => {
        const { listener, manager, remoteFileOperation } = createManager();
        remoteFileOperation.startDownload.mockResolvedValueOnce("download-1").mockResolvedValueOnce("download-2");
        const first = manager.download([{ path: "one.txt", type: "FILE" }], " ", "/storage", " ");
        const second = manager.download([{ path: "two.txt", type: "FILE" }], " ", "/storage", " ");
        await new Promise<void>((resolve) => setImmediate(resolve));

        const running: FileOperationSnapshot = {
            id: "download-1",
            operation: "DOWNLOAD",
            status: "RUNNING",
            bytesTransferred: 0,
            totalBytes: 1,
            revision: 1,
            remoteDir: "",
            destinationDir: "/storage",
            localDir: "/storage"
        };
        listener()(running);
        listener()({ ...running, id: "download-2", revision: 2 });
        listener()({ ...running, status: "COMPLETED", bytesTransferred: 1, revision: 3 });
        await expect(first).resolves.toEqual({ success: true, data: undefined });
        expect(manager.isLocalDirectoryBusy("/storage")).toBe(true);

        listener()({ ...running, id: "download-2", status: "COMPLETED", bytesTransferred: 1, revision: 4 });
        await expect(second).resolves.toEqual({ success: true, data: undefined });
        expect(manager.isLocalDirectoryBusy("/storage")).toBe(false);
    });

    it("accepts a completion event already observed during restoration before the operation ID arrives", async () => {
        const { listener, manager, remoteFileOperation } = createManager();
        let resolveStart!: (id: string) => void;
        remoteFileOperation.startDownload.mockReturnValue(
            new Promise<string>((resolve) => {
                resolveStart = resolve;
            })
        );
        const completed: FileOperationSnapshot = {
            id: "download-1",
            operation: "DOWNLOAD",
            status: "COMPLETED",
            bytesTransferred: 1,
            totalBytes: 1,
            revision: 2,
            remoteDir: "",
            destinationDir: "/storage",
            localDir: "/storage"
        };
        remoteFileOperation.listOperations.mockResolvedValue([completed]);
        const download = manager.download([{ path: "one.txt", type: "FILE" }], " ", "/storage", " ");
        await new Promise<void>((resolve) => setImmediate(resolve));
        await manager.restore();
        listener()(completed);
        resolveStart(completed.id);
        await expect(download).resolves.toEqual({ success: true, data: undefined });
    });

    it("does not mark a directory busy again when a restored snapshot is older than a completion event", async () => {
        const { listener, manager, remoteFileOperation } = createManager();
        let resolveList!: (operations: FileOperationSnapshot[]) => void;
        remoteFileOperation.listOperations.mockReturnValue(
            new Promise<FileOperationSnapshot[]>((resolve) => {
                resolveList = resolve;
            })
        );
        const running: FileOperationSnapshot = {
            id: "upload-1",
            operation: "UPLOAD",
            status: "RUNNING",
            bytesTransferred: 0,
            totalBytes: 1,
            revision: 1,
            remoteDir: "photos",
            destinationDir: "",
            localDir: "/storage"
        };
        const restore = manager.restore();
        listener()({ ...running, status: "COMPLETED", revision: 2, result: { entries: [], version: "1" } });
        resolveList([running]);
        await restore;
        expect(manager.isRemoteDirectoryBusy("photos")).toBe(false);
    });
});
