import { NativeModules } from "react-native";

const { StoragePermission } = NativeModules;

export const ensureStoragePermission = async () => {
    const granted = await StoragePermission.isExternalStorageManager();

    if (granted) {
        return true;
    }

    StoragePermission.openAllFilesAccess();
    return false;
};
