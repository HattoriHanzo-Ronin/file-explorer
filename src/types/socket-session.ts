export interface SocketSession {
    readonly id: string;
    readonly expiresAt: string;
    readonly activityInterval: number;
}

export interface SocketVersions {
    readonly ftp: string;
}
