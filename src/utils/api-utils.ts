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
    ThumbnailResponse,
    ThumbnailStatus
} from "../types/ftp";
import type { UpdatePasswordRequest, UpdateUsernameRequest, UpdateUsernameResponse } from "../types/users";
import type { FileOperationSelection, RemoteDirectoryOperationResult } from "../types/file-operations";
import type { SocketSession, SocketVersions } from "../types/socket-session";
import type RemoteFileManager from "./operations/remote-file-manager";
import type { Storage } from "./storage/storage";
import { STORAGE_KEYS } from "../constants/storage";
import FileUtils from "./file-utils";

/**
 * API client
 *
 * @author HattoriHanzo-Ronin
 */
export default class ApiUtils {
    static FTP_VERSION = "";
    private readonly remoteFileManager: RemoteFileManager;
    private readonly storage: Storage;
    private readonly apiUrl: string;
    private socket: WebSocket | null = null;
    private socketSession: SocketSession | null = null;
    private socketConnection: Promise<void> | null = null;
    private socketRequest: Promise<ApiResponse<SocketVersions>> | null = null;
    private resolveSocketRequest: ((response: ApiResponse<SocketVersions>) => void) | null = null;
    private isSocketSessionSuspended = true;
    private isSocketTokenInvalid = false;
    private resumeSocketRequest: Promise<void> | null = null;

    constructor(remoteFileManager: RemoteFileManager, storage: Storage, apiUrl: string) {
        this.remoteFileManager = remoteFileManager;
        this.storage = storage;
        this.apiUrl = apiUrl;
    }

    /**
     * Restores persisted transfer state
     */
    async restoreOperations(): Promise<void> {
        await this.remoteFileManager.restore();
    }

    /**
     * Creates or renews the socket session
     */
    async refreshSocketSession(): Promise<void> {
        this.isSocketSessionSuspended = false;
        this.isSocketTokenInvalid = false;
        const session = this.socketSession
            ? await this.executeRequest(async () => {
                  const { data } = await axios.post<SocketSession>(
                      this.buildUrl(`socket-sessions/${this.socketSession!.id}/refresh`)
                  );
                  return data;
              })
            : await this.executeRequest(async () => {
                  const { data } = await axios.post<SocketSession>(this.buildUrl("socket-sessions"));
                  return data;
              });
        if (!session.success && this.socketSession) {
            this.socketSession = null;
            this.closeSocket();
            await this.refreshSocketSession();
            return;
        }

        if (!session.success) {
            return;
        }

        this.socketSession = session.data;
        void this.openSocket().catch(() => undefined);
    }

    /**
     * Closes the current socket session
     */
    async closeSocketSession(): Promise<void> {
        const session = this.socketSession;
        this.suspendSocketSession();
        this.socketSession = null;
        if (!session) {
            return;
        }

        await this.executeRequest(async () => {
            await axios.delete(this.buildUrl(`socket-sessions/${session.id}`));
        });
    }

    /** Clears the local socket state */
    clearSocketSession(): void {
        this.suspendSocketSession();
        this.socketSession = null;
    }

    /**
     * Resumes the socket session
     */
    async resumeSocketSession(): Promise<void> {
        if (this.resumeSocketRequest) {
            await this.resumeSocketRequest;
            return;
        }

        if (!this.isSocketSessionSuspended) {
            return;
        }

        this.isSocketSessionSuspended = false;
        this.resumeSocketRequest = this.refreshSocketSession().finally(() => {
            this.resumeSocketRequest = null;
        });
        await this.resumeSocketRequest;
    }

    /** Suspends the socket session */
    suspendSocketSession(): void {
        this.isSocketSessionSuspended = true;
        this.closeSocket();
    }

    /** Clears completed remote operations */
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
        return this.executeRequest(async () => {
            const result = await this.remoteFileManager.upload(items, remoteDir);
            if (!result.success) {
                throw result.error;
            }

            this.updateFtpVersion(result.data.version);
            return result.data;
        });
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
        return this.executeRequest(async () => {
            const result = await this.remoteFileManager.download(items, remoteDir, localRoot, localDir);
            if (!result.success) {
                throw result.error;
            }

            return result.data;
        });
    }

    /**
     * Returns the current FTP directory version
     *
     * @param request FTP directory
     * @returns FTP directory version
     */
    async getVersion(request: FtpVersionRequest): Promise<ApiResponse<FtpVersionResponse>> {
        if (this.remoteFileManager.isRemoteDirectoryBusy(request.dir ?? " ")) {
            return { success: true, data: { version: ApiUtils.FTP_VERSION } };
        }

        if (this.isSocketSessionSuspended) {
            return { success: true, data: { version: ApiUtils.FTP_VERSION } };
        }

        const response = await this.getSocketVersions(request.dir);
        if (!response.success) {
            return response;
        }

        return { success: true, data: { version: response.data.ftp } };
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
            const { data } = await axios.put<UpdateUsernameResponse>(this.buildUrl("users"), {
                ...request,
                username: request.username.trim()
            });
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
     * Returns the current FTP thumbnail state and authenticated image source
     *
     * @param request Thumbnail data
     * @returns Thumbnail response
     */
    async getThumbnail(request: ThumbnailRequest): Promise<ApiResponse<ThumbnailResponse>> {
        const result = await this.getThumbnailStatus(request);
        if (!result.success) {
            return result;
        }

        const { data: status } = result;
        if (status !== "AVAILABLE") {
            return { success: true, data: { status } };
        }

        const accessToken = await this.storage.get<string>(STORAGE_KEYS.accessToken);
        const { dir, name } = request;
        const normalizedDir = this.normalizeDir(dir);
        const query = normalizedDir ? `?dir=${encodeURIComponent(normalizedDir)}` : "";
        return {
            success: true,
            data: {
                status: "AVAILABLE",
                uri: `${this.buildUrl(`ftp/thumbnail/${encodeURIComponent(name)}`)}${query}`,
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
            }
        };
    }

    /**
     * Creates a remote directory
     *
     * @param request Directory data
     * @returns Updated directory entries
     */
    async createDirectory(request: CreateDirectoryRequest): Promise<ApiResponse<CreateDirectoryResponse>> {
        const error = FileUtils.validateOperationName(request.name, "name");
        if (error) {
            return { success: false, error };
        }

        return this.executeRequest(async () => {
            const result = await this.remoteFileManager.createDirectory({ ...request, name: request.name.trim() });
            if (!result.success) {
                throw result.error;
            }

            const { version, entries } = result.data;
            this.updateFtpVersion(version);
            return entries;
        });
    }

    /**
     * Moves remote entries
     *
     * @param request Entries and destination
     * @returns Confirmed moved entries
     */
    async moveEntries(request: MoveEntriesRequest): Promise<ApiResponse<MoveEntriesResponse>> {
        if (this.normalizeDir(request.dir) === this.normalizeDir(request.destination)) {
            return {
                success: false,
                error: { code: "INVALID_DESTINATION", message: "El directorio de origen y destino es el mismo" }
            };
        }

        return this.executeRequest(async () => {
            const result = await this.remoteFileManager.move(request);
            if (!result.success) {
                throw result.error;
            }

            const { version, changes } = result.data;
            this.updateFtpVersion(version);
            return changes;
        });
    }

    /**
     * Renames a remote entry
     *
     * @param request Entry and new name
     * @returns Updated directory entries
     */
    async renameEntry(request: RenameEntryRequest): Promise<ApiResponse<RenameEntryResponse>> {
        const error = FileUtils.validateOperationName(request.newName, "newName", request.entry.name.split("/").pop());
        if (error) {
            return { success: false, error };
        }

        return this.executeRequest(async () => {
            const result = await this.remoteFileManager.rename({ ...request, newName: request.newName.trim() });
            if (!result.success) {
                throw result.error;
            }

            const { version, entries } = result.data;
            this.updateFtpVersion(version);
            return entries;
        });
    }

    /**
     * Deletes remote entries
     *
     * @param request Entries to delete
     * @returns Confirmed deleted entries
     */
    async deleteEntries(request: DeleteEntriesRequest): Promise<ApiResponse<DeleteEntriesResponse>> {
        return this.executeRequest(async () => {
            const result = await this.remoteFileManager.delete(request);
            if (!result.success) {
                throw result.error;
            }

            const { version, changes } = result.data;
            this.updateFtpVersion(version);
            return changes;
        });
    }

    private buildUrl(entity: string): string {
        return `${this.apiUrl}/${entity}`;
    }

    private async getSocketVersions(dir?: string): Promise<ApiResponse<SocketVersions>> {
        if (this.socketRequest) {
            return this.socketRequest;
        }

        this.socketRequest = this.requestSocketVersions(dir).finally(() => {
            this.socketRequest = null;
        });
        return this.socketRequest;
    }

    private async requestSocketVersions(dir?: string): Promise<ApiResponse<SocketVersions>> {
        const accessToken = await this.storage.get<string>(STORAGE_KEYS.accessToken);
        if (!accessToken || !this.socketSession) {
            return { success: false, error: { code: "SOCKET_SESSION_NOT_FOUND", message: "Sesión de versiones no disponible" } };
        }

        try {
            await this.openSocket();
        } catch {
            return { success: false, error: { code: "SOCKET_CONNECTION_FAILED", message: "No se pudo conectar al socket" } };
        }

        const socket = this.socket;
        if (!socket) {
            return { success: false, error: { code: "SOCKET_CONNECTION_FAILED", message: "No se pudo conectar al socket" } };
        }

        return new Promise((resolve) => {
            this.resolveSocketRequest = resolve;
            socket.onmessage = ({ data }) => {
                try {
                    const response = JSON.parse(data) as SocketVersions | ApiError;
                    if ("code" in response) {
                        if (response.code === "INVALID_TOKEN") {
                            this.isSocketTokenInvalid = true;
                        }

                        this.completeSocketRequest({ success: false, error: response });
                        return;
                    }

                    if (typeof response.ftp !== "string") {
                        this.completeSocketRequest({
                            success: false,
                            error: { code: "SOCKET_RESPONSE_INVALID", message: "El socket devolvió una respuesta no válida" }
                        });
                        return;
                    }

                    this.completeSocketRequest({ success: true, data: response });
                } catch {
                    this.completeSocketRequest({
                        success: false,
                        error: { code: "SOCKET_RESPONSE_INVALID", message: "El socket devolvió una respuesta no válida" }
                    });
                }
            };
            socket.send(JSON.stringify({ accessToken, entities: ["ftp"], dir: this.normalizeDir(dir) }));
        });
    }

    private completeSocketRequest(response: ApiResponse<SocketVersions>): void {
        const resolve = this.resolveSocketRequest;
        this.resolveSocketRequest = null;
        if (resolve) {
            resolve(response);
        }
    }

    private openSocket(): Promise<void> {
        if (!this.socketSession) {
            return Promise.reject();
        }

        if (this.socket?.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }

        if (this.socketConnection) {
            return this.socketConnection;
        }

        const socket = new WebSocket(this.buildSocketUrl(this.socketSession.id));
        let opened = false;
        this.socket = socket;
        this.socketConnection = new Promise((resolve, reject) => {
            socket.onopen = () => {
                opened = true;
                this.socketConnection = null;
                resolve();
            };
            socket.onerror = () => {
                this.socketConnection = null;
                reject();
            };
            socket.onclose = () => {
                this.socketConnection = null;
                if (!opened) {
                    reject();
                }

                if (this.socket !== socket) {
                    return;
                }

                this.socket = null;
                this.completeSocketRequest({
                    success: false,
                    error: { code: "SOCKET_CONNECTION_FAILED", message: "No se pudo conectar al socket" }
                });
                if (!this.isSocketSessionSuspended && !this.isSocketTokenInvalid && this.socketSession) {
                    void this.refreshSocketSession();
                }
            };
        });
        return this.socketConnection;
    }

    private closeSocket(): void {
        const socket = this.socket;
        this.socket = null;
        this.socketConnection = null;
        this.completeSocketRequest({
            success: false,
            error: { code: "SOCKET_CONNECTION_FAILED", message: "No se pudo conectar al socket" }
        });
        socket?.close();
    }

    private buildSocketUrl(id: string): string {
        const url = new URL(this.apiUrl);
        const protocol = url.protocol === "https:" ? "wss:" : "ws:";
        return `${protocol}//${url.host}/events/${encodeURIComponent(id)}`;
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
            if (
                typeof err === "object" &&
                err !== null &&
                "code" in err &&
                typeof err.code === "string" &&
                "message" in err &&
                typeof err.message === "string"
            ) {
                error = err as ApiError;
            }

            if (isAxiosError<ApiError>(err) && err.response) {
                error = err.response.data;
            }

            return { success: false, error };
        }
    }
}
