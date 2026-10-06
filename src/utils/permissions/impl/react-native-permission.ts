import { NativeModules, PermissionsAndroid, Platform } from "react-native";
import type { Permission } from "../permission";

interface StoragePermissionModule {
    isExternalStorageManager(): Promise<boolean>;
    openAllFilesAccess(): void;
}

/**
 * Provides permissions through React Native
 *
 * @author HattoriHanzo-Ronin
 */
export default class ReactNativePermission implements Permission {
    private readonly storagePermission = NativeModules.StoragePermission as StoragePermissionModule;

    /**
     * Ensures access to shared storage
     *
     * @returns Whether access is available
     */
    async ensureStoragePermission(): Promise<boolean> {
        const granted = await this.storagePermission.isExternalStorageManager();
        if (granted) {
            return true;
        }

        this.storagePermission.openAllFilesAccess();
        return false;
    }

    /**
     * Ensures permission to display notifications
     *
     * @returns Whether notifications are available
     */
    async ensureNotificationPermission(): Promise<boolean> {
        if (Platform.OS !== "android" || Platform.Version < 33) {
            return true;
        }

        const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
        if (await PermissionsAndroid.check(permission)) {
            return true;
        }

        return (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED;
    }
}
