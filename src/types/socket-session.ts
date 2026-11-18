/** Server session used to receive socket notifications */
export interface SocketSession {
    readonly id: string;
    readonly expiresAt: string;
}

/** Version change notification for an FTP directory */
export interface SocketNotification {
    readonly entity: "ftp";
    readonly dir: string;
    readonly version: string;
}
