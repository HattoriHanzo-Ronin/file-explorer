import axios from "axios";
import type { AuthUser, LoginResponse, RefreshTokenRequest } from "../../src/types/auth";
import AuthUtils from "../../src/utils/auth-utils";
import UiUtils from "../../src/utils/ui-utils";
import { STORAGE_KEYS } from "../../src/constants/storage";

const USER: AuthUser = { id: "user-1", username: "ronin", roles: ["FTP"] };
const RESPONSE: LoginResponse = { user: USER, accessToken: "access", refreshToken: "refresh" };

function createAuthUtils() {
    const setIsAuthenticated = jest.fn();
    const setUser = jest.fn();
    const apiUtils = {
        login: jest.fn(),
        refreshToken: jest.fn(),
        logout: jest.fn(),
        closeSocketSession: jest.fn(),
        clearSocketSession: jest.fn()
    };
    const storage = {
        get: jest.fn(),
        set: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined)
    };
    return {
        apiUtils,
        authUtils: new AuthUtils(setIsAuthenticated, setUser, apiUtils as never, storage),
        setIsAuthenticated,
        setUser,
        storage
    };
}

describe("AuthUtils", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(axios.interceptors.request, "use").mockReturnValue(1);
        jest.spyOn(axios.interceptors.request, "eject").mockImplementation();
        jest.spyOn(UiUtils, "showMessage").mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("persists tokens and authenticates after a successful login", async () => {
        const { apiUtils, authUtils, setIsAuthenticated, setUser, storage } = createAuthUtils();
        apiUtils.login.mockResolvedValue({ success: true, data: RESPONSE });
        await expect(authUtils.login({ username: "ronin", password: "secret" })).resolves.toBeUndefined();
        expect(storage.set).toHaveBeenCalledWith(STORAGE_KEYS.accessToken, "access");
        expect(storage.set).toHaveBeenCalledWith(STORAGE_KEYS.refreshToken, { refreshToken: "refresh" });
        expect(setUser).toHaveBeenCalledWith(USER);
        expect(setIsAuthenticated).toHaveBeenCalledWith(true);
    });

    it("returns validation details without showing a message", async () => {
        const { apiUtils, authUtils } = createAuthUtils();
        const details = [{ field: "username", message: "Obligatorio" }];
        apiUtils.login.mockResolvedValue({
            success: false,
            error: { code: "VALIDATION_FAILED", message: "", details }
        });
        await expect(authUtils.login({ username: "ronin", password: "secret" })).resolves.toEqual(details);
        expect(UiUtils.showMessage).not.toHaveBeenCalled();
    });

    it("forwards credentials to the API", async () => {
        const { apiUtils, authUtils } = createAuthUtils();
        const credentials = { username: " ", password: "" };
        apiUtils.login.mockResolvedValue({
            success: false,
            error: { code: "VALIDATION_FAILED", message: "", details: [] }
        });
        await expect(authUtils.login(credentials)).resolves.toEqual([]);
        expect(apiUtils.login).toHaveBeenCalledWith(credentials);
    });

    it("clears a missing persisted session", async () => {
        const { apiUtils, authUtils, setIsAuthenticated, setUser, storage } = createAuthUtils();
        storage.get.mockResolvedValue(null);
        await expect(authUtils.restoreSession()).resolves.toBe(false);
        expect(apiUtils.refreshToken).not.toHaveBeenCalled();
        expect(storage.delete).not.toHaveBeenCalled();
        expect(setUser).toHaveBeenCalledWith(null);
        expect(setIsAuthenticated).toHaveBeenCalledWith(false);
    });

    it("restores a persisted refresh token", async () => {
        const { apiUtils, authUtils, storage } = createAuthUtils();
        const refreshToken: RefreshTokenRequest = { refreshToken: "stored" };
        storage.get.mockResolvedValue(refreshToken);
        apiUtils.refreshToken.mockResolvedValue({ success: true, data: RESPONSE });
        await expect(authUtils.restoreSession()).resolves.toBe(true);
        expect(apiUtils.refreshToken).toHaveBeenCalledWith(refreshToken);
    });

    it("refreshes an expired access token before retrying logout", async () => {
        const { apiUtils, authUtils, storage } = createAuthUtils();
        const refreshToken = { refreshToken: "stored" };
        storage.get
            .mockResolvedValueOnce(refreshToken)
            .mockResolvedValueOnce(refreshToken)
            .mockResolvedValueOnce({ refreshToken: "renewed" });
        apiUtils.logout
            .mockResolvedValueOnce({ success: false, error: { code: "INVALID_TOKEN", message: "Caducado" } })
            .mockResolvedValueOnce({ success: true, data: undefined });
        apiUtils.refreshToken.mockResolvedValue({ success: true, data: { ...RESPONSE, refreshToken: "renewed" } });
        await authUtils.logout();
        expect(apiUtils.refreshToken).toHaveBeenCalledWith(refreshToken);
        expect(apiUtils.logout).toHaveBeenNthCalledWith(2, { refreshToken: "renewed" });
        expect(storage.delete).toHaveBeenCalledWith(STORAGE_KEYS.accessToken);
        expect(storage.delete).toHaveBeenCalledWith(STORAGE_KEYS.refreshToken);
    });
});
