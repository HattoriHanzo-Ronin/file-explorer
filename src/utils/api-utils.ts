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
import type { SocketNotification, SocketSession } from "../types/socket-session";
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
    private static readonly FTP_VERSIONS = new Map<string, string>();
    private readonly remoteFileManager: RemoteFileManager;
    private readonly storage: Storage;
    private readonly apiUrl: string;
    private socket: WebSocket | null = null;
    private socketSession: SocketSession | null = null;
    private socketConnection: Promise<void> | null = null;
    private readonly ftpChangeListeners = new Set<(notification: SocketNotification) => void>();
    private readonly socketReconnectListeners = new Set<() => void>();
    private socketSessionRequest: Promise<ApiResponse<void>> | null = null;
    private isSocketSessionSuspended = true;

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
    async refreshSocketSession(): Promise<ApiResponse<void>> {
        if (this.socketSessionRequest) {
            return this.socketSessionRequest;
        }

        this.socketSessionRequest = this.executeSocketSessionRefresh().finally(() => {
            this.socketSessionRequest = null;
        });
        return this.socketSessionRequest;
    }

    /**
     * Closes the current socket session
     */
    async closeSocketSession(): Promise<void> {
        const session = this.socketSession;
        this.suspendSocketSession();
        this.socketSession = null;
        ApiUtils.FTP_VERSIONS.clear();
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
        ApiUtils.FTP_VERSIONS.clear();
    }

    /** Suspends the socket session */
    suspendSocketSession(): void {
        this.isSocketSessionSuspended = true;
        this.closeSocket();
    }

    /** Adds an FTP change listener */
    addFtpChangeListener(listener: (notification: SocketNotification) => void): () => void {
        this.ftpChangeListeners.add(listener);
        return () => this.ftpChangeListeners.delete(listener);
    }

    /** Adds a socket reconnection listener */
    addSocketReconnectListener(listener: () => void): () => void {
        this.socketReconnectListeners.add(listener);
        return () => this.socketReconnectListeners.delete(listener);
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

            this.updateFtpVersion(remoteDir, result.data.version);
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
            this.updateFtpVersion(dir, headers["data-version"]);
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
            this.updateFtpVersion(request.dir, version);
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
            this.updateFtpVersion(request.destination, version);
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
            this.updateFtpVersion(request.dir, version);
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
            this.updateFtpVersion(request.dir, version);
            return changes;
        });
    }

    /** Returns the stored FTP directory version */
    static getFtpVersion(dir?: string): string {
        return ApiUtils.FTP_VERSIONS.get(ApiUtils.getFtpDirectoryKey(dir)) ?? "";
    }

    private buildUrl(entity: string): string {
        return `${this.apiUrl}/${entity}`;
    }

    private async executeSocketSessionRefresh(): Promise<ApiResponse<void>> {
        this.isSocketSessionSuspended = false;
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
        if (!session.success && this.socketSession && session.error.code === "SOCKET_SESSION_NOT_FOUND") {
            this.socketSession = null;
            this.closeSocket();
            return this.executeSocketSessionRefresh();
        }

        if (!session.success) {
            return { success: false, error: session.error };
        }

        this.socketSession = session.data;
        void this.openSocket().catch(() => undefined);
        return { success: true, data: undefined };
    }

    private async openSocket(): Promise<void> {
        if (!this.socketSession) {
            throw new Error("Socket session not found");
        }

        if (this.socket?.readyState === WebSocket.OPEN) {
            return;
        }

        if (this.socketConnection) {
            await this.socketConnection;
            return;
        }

        const accessToken = await this.storage.get<string>(STORAGE_KEYS.accessToken);
        if (!accessToken) {
            throw new Error("Access token not found");
        }

        const socket = new WebSocket(this.buildSocketUrl(this.socketSession.id));
        let opened = false;
        this.socket = socket;
        this.socketConnection = new Promise((resolve, reject) => {
            socket.onopen = () => {
                opened = true;
                this.socketConnection = null;
                socket.send(JSON.stringify({ accessToken, entities: ["ftp"] }));
                resolve();
            };
            socket.onmessage = ({ data }) => this.handleSocketMessage(data);
            socket.onerror = () => {
                this.socketConnection = null;
                reject();
            };
            socket.onclose = () => {
                this.socketConnection = null;
                if (!opened) {
                    if (this.socket === socket) {
                        this.socket = null;
                    }

                    reject();
                    return;
                }

                if (this.socket !== socket) {
                    return;
                }

                this.socket = null;
                if (!this.isSocketSessionSuspended && this.socketSession) {
                    this.socketReconnectListeners.forEach((listener) => listener());
                }
            };
        });
        await this.socketConnection;
    }

    private handleSocketMessage(data: string): void {
        try {
            const response = JSON.parse(data) as SocketNotification | ApiError;
            if ("code" in response) {
                this.socketSession = null;
                this.closeSocket();
                return;
            }

            if (response.entity !== "ftp" || typeof response.dir !== "string" || typeof response.version !== "string") {
                return;
            }

            if (this.remoteFileManager.isRemoteDirectoryBusy(response.dir)) {
                return;
            }

            this.ftpChangeListeners.forEach((listener) => listener(response));
        } catch {
            return;
        }
    }

    private closeSocket(): void {
        const socket = this.socket;
        this.socket = null;
        this.socketConnection = null;
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

    private updateFtpVersion(dir: string | undefined, version: unknown): void {
        if (version !== undefined) {
            ApiUtils.FTP_VERSIONS.set(ApiUtils.getFtpDirectoryKey(dir), String(version));
        }
    }

    private static getFtpDirectoryKey(dir?: string): string {
        return dir?.trim() ? dir : " ";
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
