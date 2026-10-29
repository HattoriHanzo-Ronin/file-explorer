export interface SocketSession {
    readonly id: string;
    readonly expiresAt: string;
}

export interface SocketNotification {
    readonly entity: "ftp";
    readonly dir: string;
    readonly version: string;
}
