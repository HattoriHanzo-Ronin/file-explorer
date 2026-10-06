export interface Permission {
    ensureStoragePermission(): Promise<boolean>;

    ensureNotificationPermission(): Promise<boolean>;
}
