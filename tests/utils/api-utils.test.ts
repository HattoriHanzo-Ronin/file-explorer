import axios, { isAxiosError } from "axios";
import ApiUtils from "../../src/utils/api-utils";

jest.mock("axios");

const API_URL = "https://api.example.test";
const ENTRIES = [{ name: "photo.jpg", type: "FILE" as const }];
const SOCKET_SESSION = { id: "socket-1", expiresAt: "2026-10-28T20:00:00.000Z", activityInterval: 600000 };

class MockWebSocket {
    static OPEN = 1;
    static instances: MockWebSocket[] = [];
    static response: Record<string, unknown> = { ftp: "3" };
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onopen: (() => void) | null = null;
    readyState = MockWebSocket.OPEN;
    send = jest.fn(() => this.onmessage?.({ data: JSON.stringify(MockWebSocket.response) }));
    readonly url: string;

    constructor(url: string) {
        this.url = url;
        MockWebSocket.instances.push(this);
        void Promise.resolve().then(() => this.onopen?.());
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
        ApiUtils.FTP_VERSION = "";
        MockWebSocket.instances = [];
        MockWebSocket.response = { ftp: "3" };
        globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    });

    it("gets the FTP version through the socket session", async () => {
        const { apiUtils, storage } = createApiUtils();
        storage.get.mockResolvedValue("access-token");
        jest.mocked(axios.post).mockResolvedValue({ data: SOCKET_SESSION });
        await apiUtils.resumeSocketSession();
        await expect(apiUtils.getVersion({ dir: " " })).resolves.toEqual({ success: true, data: { version: "3" } });
        expect(MockWebSocket.instances[0].url).toBe("wss://api.example.test/events/socket-1");
        expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
            JSON.stringify({ accessToken: "access-token", entities: ["ftp"], dir: undefined })
        );
    });

    it("does not check the remote version while the directory is busy", async () => {
        const { apiUtils, remoteFileManager } = createApiUtils();
        remoteFileManager.isRemoteDirectoryBusy.mockReturnValue(true);
        ApiUtils.FTP_VERSION = "4";
        await expect(apiUtils.getVersion({ dir: "docs" })).resolves.toEqual({ success: true, data: { version: "4" } });
        expect(MockWebSocket.instances).toHaveLength(0);
    });

    it("closes the socket when it becomes inactive", async () => {
        const { apiUtils } = createApiUtils();
        jest.mocked(axios.post).mockResolvedValue({ data: SOCKET_SESSION });
        await apiUtils.resumeSocketSession();
        apiUtils.suspendSocketSession();
        expect(MockWebSocket.instances[0].close).toHaveBeenCalled();
    });

    it("does not request versions while the socket session is suspended", async () => {
        const { apiUtils } = createApiUtils();
        ApiUtils.FTP_VERSION = "4";
        await expect(apiUtils.getVersion({ dir: "docs" })).resolves.toEqual({ success: true, data: { version: "4" } });
        expect(MockWebSocket.instances).toHaveLength(0);
    });

    it("returns invalid tokens to the API request executor", async () => {
        const { apiUtils, storage } = createApiUtils();
        storage.get.mockResolvedValue("access-token");
        MockWebSocket.response = { code: "INVALID_TOKEN", message: "Sesión no válida" };
        jest.mocked(axios.post).mockResolvedValue({ data: SOCKET_SESSION });
        await apiUtils.resumeSocketSession();
        await expect(apiUtils.getVersion({ dir: "docs" })).resolves.toEqual({
            success: false,
            error: { code: "INVALID_TOKEN", message: "Sesión no válida" }
        });
        MockWebSocket.instances[0].close();
        expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it("creates a socket session when its renewal fails", async () => {
        const { apiUtils } = createApiUtils();
        jest.mocked(axios.post)
            .mockResolvedValueOnce({ data: SOCKET_SESSION })
            .mockRejectedValueOnce({ code: "SESSION_NOT_FOUND", message: "No existe" })
            .mockResolvedValueOnce({ data: { ...SOCKET_SESSION, id: "socket-2" } });
        await apiUtils.resumeSocketSession();
        await apiUtils.refreshSocketSession();
        expect(axios.post).toHaveBeenLastCalledWith(`${API_URL}/socket-sessions`);
        expect(MockWebSocket.instances[1].url).toBe("wss://api.example.test/events/socket-2");
    });

    it("updates the FTP version after listing a directory", async () => {
        const { apiUtils } = createApiUtils();
        jest.mocked(axios.get).mockResolvedValue({ data: ENTRIES, headers: { "data-version": "4" } });
        await expect(apiUtils.getDirectory("pictures")).resolves.toEqual({ success: true, data: ENTRIES });
        expect(ApiUtils.FTP_VERSION).toBe("4");
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
        expect(result).toEqual({ success: true, data: ENTRIES });
        expect(ApiUtils.FTP_VERSION).toBe("12");
    });

    it("preserves native API errors and validation details", async () => {
        const { apiUtils, remoteFileManager } = createApiUtils();
        const error = {
            code: "INVALID_TOKEN",
            message: "Sesión inválida",
            details: [{ field: "name", message: "No válido" }]
        };
        remoteFileManager.createDirectory.mockResolvedValue({ success: false, error });
        ApiUtils.FTP_VERSION = "previous";
        await expect(apiUtils.createDirectory({ name: "folder" })).resolves.toEqual({ success: false, error });
        expect(ApiUtils.FTP_VERSION).toBe("previous");
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
            data: { version: "8", changes: [{ path: "photo.jpg", type: "FILE", completed: 1, total: 1 }] }
        });
        await expect(apiUtils.moveEntries({ dir: "source", destination: "target", entries: ENTRIES })).resolves.toEqual(
            {
                success: true,
                data: [{ path: "photo.jpg", type: "FILE", completed: 1, total: 1 }]
            }
        );
        expect(ApiUtils.FTP_VERSION).toBe("8");
    });

    it("rejects a remote move to the source directory", async () => {
        const { apiUtils, remoteFileManager } = createApiUtils();
        const result = await apiUtils.moveEntries({ dir: " ", destination: "", entries: ENTRIES });
        expect(result.success).toBe(false);
        expect(remoteFileManager.move).not.toHaveBeenCalled();
    });
});
