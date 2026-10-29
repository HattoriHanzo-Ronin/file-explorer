import axios, { isAxiosError } from "axios";
import ApiUtils from "../../src/utils/api-utils";

jest.mock("axios");

const API_URL = "https://api.example.test";
const ENTRIES = [{ name: "photo.jpg", type: "FILE" as const }];
const SOCKET_SESSION = { id: "socket-1", expiresAt: "2026-10-28T20:00:00.000Z" };

class MockWebSocket {
    static OPEN = 1;
    static autoOpen = true;
    static instances: MockWebSocket[] = [];
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onopen: (() => void) | null = null;
    readyState = MockWebSocket.OPEN;
    send = jest.fn();
    readonly url: string;

    constructor(url: string) {
        this.url = url;
        MockWebSocket.instances.push(this);
        if (MockWebSocket.autoOpen) {
            void Promise.resolve().then(() => this.onopen?.());
        }
    }

    close = jest.fn(() => {
        this.onclose?.();
    });
}

function createApiUtils() {
    const remoteFileManager = {
        restore: jest.fn(),
        clearSettled: jest.fn(),
        upload: jest.fn(),
        download: jest.fn(),
        createDirectory: jest.fn(),
        rename: jest.fn(),
        isRemoteDirectoryBusy: jest.fn(),
        move: jest.fn(),
        delete: jest.fn()
    };
    const storage = { get: jest.fn() };
    return {
        apiUtils: new ApiUtils(remoteFileManager as never, storage as never, API_URL),
        remoteFileManager,
        storage
    };
}

describe("ApiUtils", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        MockWebSocket.autoOpen = true;
        MockWebSocket.instances = [];
        globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    });

    it("subscribes to FTP notifications and publishes changed directories", async () => {
        const { apiUtils, storage } = createApiUtils();
        const listener = jest.fn();
        apiUtils.addFtpChangeListener(listener);
        storage.get.mockResolvedValue("access-token");
        jest.mocked(axios.post).mockResolvedValue({ data: SOCKET_SESSION });
        await apiUtils.refreshSocketSession();
        await Promise.resolve();
        expect(MockWebSocket.instances[0].url).toBe("wss://api.example.test/events/socket-1");
        expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
            JSON.stringify({ accessToken: "access-token", entities: ["ftp"] })
        );
        MockWebSocket.instances[0].onmessage?.({ data: JSON.stringify({ entity: "ftp", dir: "docs", version: "3" }) });
        expect(listener).toHaveBeenCalledWith({ entity: "ftp", dir: "docs", version: "3" });
        MockWebSocket.instances[0].onmessage?.({ data: JSON.stringify({ entity: "ftp", dir: " ", version: "4" }) });
        expect(listener).toHaveBeenCalledWith({ entity: "ftp", dir: " ", version: "4" });
    });

    it("closes the socket when it becomes inactive", async () => {
        const { apiUtils, storage } = createApiUtils();
        storage.get.mockResolvedValue("access-token");
        jest.mocked(axios.post).mockResolvedValue({ data: SOCKET_SESSION });
        await apiUtils.refreshSocketSession();
        apiUtils.suspendSocketSession();
        expect(MockWebSocket.instances[0].close).toHaveBeenCalled();
    });

    it("ignores FTP notifications while the directory is being modified", async () => {
        const { apiUtils, remoteFileManager, storage } = createApiUtils();
        const listener = jest.fn();
        apiUtils.addFtpChangeListener(listener);
        storage.get.mockResolvedValue("access-token");
        remoteFileManager.isRemoteDirectoryBusy.mockReturnValue(true);
        jest.mocked(axios.post).mockResolvedValue({ data: SOCKET_SESSION });
        await apiUtils.refreshSocketSession();
        await Promise.resolve();
        MockWebSocket.instances[0].onmessage?.({ data: JSON.stringify({ entity: "ftp", dir: "docs", version: "3" }) });
        expect(listener).not.toHaveBeenCalled();
    });

    it("does not reconnect a rejected socket session", async () => {
        const { apiUtils, storage } = createApiUtils();
        storage.get.mockResolvedValue("access-token");
        jest.mocked(axios.post).mockResolvedValue({ data: SOCKET_SESSION });
        await apiUtils.refreshSocketSession();
        MockWebSocket.instances[0].onmessage?.({
            data: JSON.stringify({ code: "INVALID_TOKEN", message: "Sesión no válida" })
        });
        expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it("creates a socket session when its renewal fails", async () => {
        const { apiUtils, storage } = createApiUtils();
        storage.get.mockResolvedValue("access-token");
        jest.mocked(axios.post)
            .mockResolvedValueOnce({ data: SOCKET_SESSION })
            .mockRejectedValueOnce({ code: "SOCKET_SESSION_NOT_FOUND", message: "No existe" })
            .mockResolvedValueOnce({ data: { ...SOCKET_SESSION, id: "socket-2" } });
        await apiUtils.refreshSocketSession();
        await apiUtils.refreshSocketSession();
        expect(axios.post).toHaveBeenLastCalledWith(`${API_URL}/socket-sessions`);
        expect(MockWebSocket.instances[1].url).toBe("wss://api.example.test/events/socket-2");
    });

    it("keeps the session and waits for the next refresh when the socket handshake is rejected", async () => {
        const { apiUtils, storage } = createApiUtils();
        storage.get.mockResolvedValue("access-token");
        jest.mocked(axios.post).mockResolvedValue({ data: SOCKET_SESSION });
        MockWebSocket.autoOpen = false;
        await apiUtils.refreshSocketSession();
        MockWebSocket.instances[0].onerror?.();
        MockWebSocket.instances[0].onclose?.();
        await Promise.resolve();
        expect(axios.post).toHaveBeenCalledTimes(1);
        expect(MockWebSocket.instances).toHaveLength(1);
        MockWebSocket.autoOpen = true;
        await apiUtils.refreshSocketSession();
        expect(axios.post).toHaveBeenCalledTimes(2);
        expect(MockWebSocket.instances).toHaveLength(2);
    });

    it("shares a socket session refresh already in progress", async () => {
        const { apiUtils } = createApiUtils();
        let resolveRequest: ((response: { data: typeof SOCKET_SESSION }) => void) | undefined;
        jest.mocked(axios.post).mockReturnValue(
            new Promise((resolve) => {
                resolveRequest = resolve;
            })
        );
        const first = apiUtils.refreshSocketSession();
        const second = apiUtils.refreshSocketSession();
        expect(axios.post).toHaveBeenCalledTimes(1);
        resolveRequest?.({ data: SOCKET_SESSION });
        await Promise.all([first, second]);
    });

    it("lists an FTP directory", async () => {
        const { apiUtils } = createApiUtils();
        jest.mocked(axios.get).mockResolvedValue({ data: ENTRIES, headers: { "data-version": "4" } });
        await expect(apiUtils.getDirectory("pictures")).resolves.toEqual({
            success: true,
            data: { entries: ENTRIES, version: "4" }
        });
        expect(axios.get).toHaveBeenCalledWith(`${API_URL}/ftp`, { params: { dir: "pictures" } });
    });

    it("maps thumbnail status responses without downloading the image", async () => {
        const { apiUtils } = createApiUtils();
        jest.mocked(axios.head).mockResolvedValue({ status: 200, headers: { "content-type": "image/jpeg" } });
        await expect(apiUtils.getThumbnailStatus({ dir: "pictures", name: "photo.jpg" })).resolves.toEqual({
            success: true,
            data: "AVAILABLE"
        });
        expect(axios.head).toHaveBeenCalledWith(`${API_URL}/ftp/thumbnail/photo.jpg`, {
            params: { dir: "pictures" },
            validateStatus: expect.any(Function)
        });
    });

    it("builds an authenticated thumbnail source only when the thumbnail is available", async () => {
        const { apiUtils, storage } = createApiUtils();
        jest.mocked(axios.head).mockResolvedValue({ status: 200, headers: { "content-type": "image/jpeg" } });
        storage.get.mockResolvedValue("access-token");
        await expect(apiUtils.getThumbnail({ dir: "pictures", name: "photo.jpg" })).resolves.toEqual({
            success: true,
            data: {
                status: "AVAILABLE",
                uri: `${API_URL}/ftp/thumbnail/photo.jpg?dir=pictures`,
                headers: { Authorization: "Bearer access-token" }
            }
        });
    });

    it("keeps API errors returned by Axios", async () => {
        const { apiUtils } = createApiUtils();
        const error = { code: "INVALID_TOKEN", message: "Sesión inválida" };
        jest.mocked(axios.get).mockRejectedValue({ response: { data: error } });
        jest.mocked(isAxiosError).mockReturnValue(true);
        await expect(apiUtils.getDirectory()).resolves.toEqual({ success: false, error });
    });

    it.each(["createDirectory", "rename"] as const)("updates the version from %s results", async (operation) => {
        const { apiUtils, remoteFileManager } = createApiUtils();
        remoteFileManager[operation].mockResolvedValue({ success: true, data: { entries: ENTRIES, version: "12" } });
        const result =
            operation === "createDirectory"
                ? await apiUtils.createDirectory({ name: "folder", dir: "pictures" })
                : await apiUtils.renameEntry({ entry: ENTRIES[0], newName: "new.jpg", dir: "pictures" });
        expect(result).toEqual({ success: true, data: { entries: ENTRIES, version: "12" } });
    });

    it("preserves native API errors and validation details", async () => {
        const { apiUtils, remoteFileManager } = createApiUtils();
        const error = {
            code: "INVALID_TOKEN",
            message: "Sesión inválida",
            details: [{ field: "name", message: "No válido" }]
        };
        remoteFileManager.createDirectory.mockResolvedValue({ success: false, error });
        await expect(apiUtils.createDirectory({ name: "folder" })).resolves.toEqual({ success: false, error });
    });

    it("validates names before starting remote directory operations", async () => {
        const { apiUtils, remoteFileManager } = createApiUtils();
        const invalid = await apiUtils.createDirectory({ name: "bad/name" });
        const unchanged = await apiUtils.renameEntry({ entry: ENTRIES[0], newName: " photo.jpg " });
        expect(invalid.success).toBe(false);
        expect(unchanged.success).toBe(false);
        if (!invalid.success && !unchanged.success) {
            expect(invalid.error.details?.[0].field).toBe("name");
            expect(unchanged.error.details?.[0].field).toBe("newName");
        }
        expect(remoteFileManager.createDirectory).not.toHaveBeenCalled();
        expect(remoteFileManager.rename).not.toHaveBeenCalled();
    });

    it("updates the version from remote move results", async () => {
        const { apiUtils, remoteFileManager } = createApiUtils();
        remoteFileManager.move.mockResolvedValue({
            success: true,
            data: {
                source: { dir: ".", version: "7" },
                destination: { dir: "target", version: "8" },
                changes: [{ path: "photo.jpg", type: "FILE", completed: 1, total: 1 }]
            }
        });
        await expect(apiUtils.moveEntries({ dir: "source", destination: "target", entries: ENTRIES })).resolves.toEqual(
            {
                success: true,
                data: {
                    source: { dir: ".", version: "7" },
                    destination: { dir: "target", version: "8" },
                    changes: [{ path: "photo.jpg", type: "FILE", completed: 1, total: 1 }]
                }
            }
        );
    });

    it("rejects a remote move to the source directory", async () => {
        const { apiUtils, remoteFileManager } = createApiUtils();
        const result = await apiUtils.moveEntries({ dir: " ", destination: "", entries: ENTRIES });
        expect(result.success).toBe(false);
        expect(remoteFileManager.move).not.toHaveBeenCalled();
    });
});
