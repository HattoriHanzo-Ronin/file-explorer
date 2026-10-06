import axios, { isAxiosError } from "axios";
import type { ApiError } from "../types/api-error";
import type { ApiResponse } from "../types/api-response";
import type { LocalModifyElement } from "../types/files";
import type {
    LoginRequest,
    LoginResponse,
    LogoutRequest,
    RefreshTokenRequest,
    RefreshTokenResponse
} from "../types/auth";
import type {
    CreateDirectoryRequest,
    CreateDirectoryResponse,
    DeleteEntriesRequest,
    DeleteEntriesResponse,
    FtpVersionRequest,
    FtpVersionResponse,
    GetDirectoryResponse,
    MoveEntriesRequest,
    MoveEntriesResponse,
    RenameEntryRequest,
    RenameEntryResponse,
    ThumbnailRequest,
    ThumbnailStatus
} from "../types/ftp";
import type { UpdatePasswordRequest, UpdateUsernameRequest, UpdateUsernameResponse } from "../types/users";
import type { FileOperationSelection, RemoteDirectoryOperationResult } from "../types/file-operations";
import type RemoteFileManager from "./operations/remote-file-manager";

/**
 * API client
 *
 * @author HattoriHanzo-Ronin
 */
export default class ApiUtils {
    static FTP_VERSION = "";
    private readonly remoteFileManager: RemoteFileManager;
    private readonly apiUrl: string;

    constructor(remoteFileManager: RemoteFileManager, apiUrl: string) {
        this.remoteFileManager = remoteFileManager;
        this.apiUrl = apiUrl;
    }

    /**
     * Restores persisted transfer state
     */
    async restoreOperations(): Promise<void> {
        await this.remoteFileManager.restore();
    }

    clearSettledOperations(): void {
        this.remoteFileManager.clearSettled();
    }

    /**
     * Uploads local entries to a remote directory
     *
     * @param items Local entries
     * @param remoteDir Remote directory
     * @returns Updated remote directory
     */
    async upload(items: LocalModifyElement[], remoteDir: string): Promise<ApiResponse<RemoteDirectoryOperationResult>> {
        const result = await this.remoteFileManager.upload(items, remoteDir);
        if (result.success) {
            this.updateFtpVersion(result.data.version);
        }

        return result;
    }

    /**
     * Downloads remote entries to a local directory
     *
     * @param items Remote entries
     * @param remoteDir Remote directory
     * @param localRoot Local storage root
     * @param localDir Local directory
     * @returns Download response
     */
    download(
        items: FileOperationSelection[],
        remoteDir: string,
        localRoot: string,
        localDir: string
    ): Promise<ApiResponse<void>> {
        return this.remoteFileManager.download(items, remoteDir, localRoot, localDir);
    }

    /**
     * Returns whether a remote directory is receiving files
     *
     * @param dir Remote directory
     * @returns Whether the directory is busy
     */
    isRemoteDirectoryBusy(dir: string): boolean {
        return this.remoteFileManager.isRemoteDirectoryBusy(dir);
    }

    /**
     * Returns the current FTP directory version
     *
     * @param request FTP directory
     * @returns FTP directory version
     */
    async getVersion(request: FtpVersionRequest): Promise<ApiResponse<FtpVersionResponse>> {
        return this.executeRequest(async () => {
            const { dir } = request;
            const { data } = await axios.get<FtpVersionResponse>(this.buildUrl("data-versions/ftp"), {
                params: { dir: this.normalizeDir(dir) }
            });
            return data;
        });
    }

    /**
     * Returns the login result
     *
     * @param request Login credentials
     * @returns Login response
     */
    async login(request: LoginRequest): Promise<ApiResponse<LoginResponse>> {
        return this.executeRequest(async () => {
            const { data } = await axios.post<LoginResponse>(this.buildUrl("auth"), request);
            return data;
        });
    }

    /**
     * Returns refreshed authentication tokens
     *
     * @param request Refresh token
     * @returns Refresh token response
     */
    async refreshToken(request: RefreshTokenRequest): Promise<ApiResponse<RefreshTokenResponse>> {
        return this.executeRequest(async () => {
            const { data } = await axios.post<RefreshTokenResponse>(this.buildUrl("auth/refresh"), request);
            return data;
        });
    }

    /**
     * Closes the current session
     *
     * @param request Logout token
     * @returns Logout response
     */
    async logout(request: LogoutRequest): Promise<ApiResponse<void>> {
        return this.executeRequest(async () => {
            await axios.delete<void>(this.buildUrl("auth"), { data: request });
        });
    }

    /**
     * Updates the current username
     *
     * @param request Username data
     * @returns Updated username
     */
    async updateUsername(request: UpdateUsernameRequest): Promise<ApiResponse<UpdateUsernameResponse>> {
        return this.executeRequest(async () => {
            const { data } = await axios.put<UpdateUsernameResponse>(this.buildUrl("users"), request);
            return data;
        });
    }

    /**
     * Updates the current password
     *
     * @param request Password data
     * @returns Update response
     */
    async updatePassword(request: UpdatePasswordRequest): Promise<ApiResponse<void>> {
        return this.executeRequest(async () => {
            await axios.patch<void>(this.buildUrl("users/password"), request);
        });
    }

    /**
     * Returns the entries in a remote directory
     *
     * @param dir Remote directory
     * @returns Directory entries
     */
    async getDirectory(dir?: string): Promise<ApiResponse<GetDirectoryResponse>> {
        return this.executeRequest(async () => {
            const { data, headers } = await axios.get<GetDirectoryResponse>(this.buildUrl("ftp"), {
                params: { dir: this.normalizeDir(dir) }
            });
            this.updateFtpVersion(headers["data-version"]);
            return data;
        });
    }

    /**
     * Returns the current FTP thumbnail status
     *
     * @param request Thumbnail data
     * @returns Thumbnail status
     */
    async getThumbnailStatus(request: ThumbnailRequest): Promise<ApiResponse<ThumbnailStatus>> {
        return this.executeRequest(async () => {
            const { dir, name } = request;
            const { headers, status } = await axios.head(this.buildUrl(`ftp/thumbnail/${encodeURIComponent(name)}`), {
                params: { dir: this.normalizeDir(dir) },
                validateStatus: (responseStatus) => [200, 204, 404].includes(responseStatus)
            });
            if (status === 404) {
                return "PENDING";
            }

            if (status === 204) {
                return "UNAVAILABLE";
            }

            const contentType = headers["content-type"];
            return typeof contentType === "string" && contentType.startsWith("image/jpeg")
                ? "AVAILABLE"
                : "UNAVAILABLE";
        });
    }

    /**
     * Creates a remote directory
     *
     * @param request Directory data
     * @returns Updated directory entries
     */
    async createDirectory(request: CreateDirectoryRequest): Promise<ApiResponse<CreateDirectoryResponse>> {
        return this.executeRequest(async () => {
            const { name, dir } = request;
            const { data, headers } = await axios.post<CreateDirectoryResponse>(this.buildUrl("ftp/mkdir"), {
                name,
                dir: this.normalizeDir(dir)
            });
            this.updateFtpVersion(headers["data-version"]);
            return data;
        });
    }

    /**
     * Moves remote entries
     *
     * @param request Entries and destination
     * @returns Confirmed moved entries
     */
    async moveEntries(request: MoveEntriesRequest): Promise<ApiResponse<MoveEntriesResponse>> {
        const result = await this.remoteFileManager.move(request);
        if (!result.success) {
            return result;
        }

        this.updateFtpVersion(result.data.version);
        return { success: true, data: result.data.changes };
    }

    /**
     * Renames a remote entry
     *
     * @param request Entry and new name
     * @returns Updated directory entries
     */
    async renameEntry(request: RenameEntryRequest): Promise<ApiResponse<RenameEntryResponse>> {
        return this.executeRequest(async () => {
            const { entry, newName, dir } = request;
            const { data, headers } = await axios.post<RenameEntryResponse>(this.buildUrl("ftp/rename"), {
                entry,
                newName,
                dir: this.normalizeDir(dir)
            });
            this.updateFtpVersion(headers["data-version"]);
            return data;
        });
    }

    /**
     * Deletes remote entries
     *
     * @param request Entries to delete
     * @returns Confirmed deleted entries
     */
    async deleteEntries(request: DeleteEntriesRequest): Promise<ApiResponse<DeleteEntriesResponse>> {
        const result = await this.remoteFileManager.delete(request);
        if (!result.success) {
            return result;
        }

        this.updateFtpVersion(result.data.version);
        return { success: true, data: result.data.changes };
    }

    private buildUrl(entity: string): string {
        return `${this.apiUrl}/${entity}`;
    }

    private normalizeDir(dir?: string): string | undefined {
        return dir?.trim() ? dir : undefined;
    }

    private updateFtpVersion(version: unknown): void {
        if (version !== undefined) {
            ApiUtils.FTP_VERSION = String(version);
        }
    }

    /**
     * Returns a normalized API response
     *
     * @param callback API request
     * @returns Normalized API response
     */
    private async executeRequest<T>(callback: () => Promise<T>): Promise<ApiResponse<T>> {
        try {
            return { success: true, data: await callback() };
        } catch (err) {
            let error: ApiError = { code: "NETWORK_ERROR", message: "No se pudo conectar con el servidor" };
            if (isAxiosError<ApiError>(err) && err.response) {
                error = err.response.data;
            }

            return { success: false, error };
        }
    }
}
