import axios, { isAxiosError } from "axios";
import ApiUtils from "../../src/utils/api-utils";

jest.mock("axios");

const API_URL = "https://api.example.test";
const ENTRIES = [{ name: "photo.jpg", type: "FILE" as const }];

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
    });

    it("normalizes the root directory when requesting its version", async () => {
        const { apiUtils } = createApiUtils();
        jest.mocked(axios.get).mockResolvedValue({ data: { version: "3" } });
        await expect(apiUtils.getVersion({ dir: " " })).resolves.toEqual({ success: true, data: { version: "3" } });
        expect(axios.get).toHaveBeenCalledWith(`${API_URL}/data-versions/ftp`, { params: { dir: undefined } });
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
});
