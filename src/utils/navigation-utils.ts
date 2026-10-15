import type { AppContextType } from "../types/context";
import type { StorageRoot } from "../types/files";
import type { DrawerNavigation, StorageType } from "../types/navigation";
import UiUtils from "./ui-utils";

type StorageContext = Pick<AppContextType, "activeStorageRoot" | "setActiveStorageRoot" | "setLocalDirectory">;

/**
 * Opens a storage root
 *
 * @param context Storage state
 * @param root Storage root
 */
export function openStorage(context: StorageContext, root: StorageRoot): void {
    const { activeStorageRoot, setActiveStorageRoot, setLocalDirectory } = context;
    const isCurrentRoot = activeStorageRoot.id === root.id;
    setActiveStorageRoot(root);
    setLocalDirectory((current) => (isCurrentRoot && current.dir === " " ? current : { dir: " ", content: [] }));
}

/**
 * Handles a drawer navigation action
 *
 * @param context Application context
 * @param storage Destination storage
 */
export function handleNavigationPress(context: AppContextType, storage: StorageType): void {
    const {
        fileAction,
        ftpDirectory,
        modifyFtpFile,
        modifyLocalFile,
        setDirSelected,
        setFtpDirectory,
        setModifyFtpFile,
        setModifyLocalFile
    } = context;
    if (fileAction && storage !== getFileActionTarget(context)) {
        UiUtils.completeFileAction(context);
    } else if (!fileAction && (modifyFtpFile.length > 0 || modifyLocalFile.length > 0)) {
        setModifyFtpFile([]);
        setModifyLocalFile([]);
        setDirSelected((current) => !current);
    }

    if (!fileAction && ftpDirectory.dir !== " ") {
        setFtpDirectory((current) => ({ ...current, dir: " " }));
    }
}

/**
 * Cancels the current file action and navigates to its source
 *
 * @param context Application context
 * @param navigation Drawer navigation
 * @returns Whether an action was cancelled
 */
export function cancelFileAction(context: AppContextType, navigation: DrawerNavigation): boolean {
    if (!context.fileAction) {
        return false;
    }

    const target = UiUtils.cancelFileAction(context);
    if (target === "ftp") {
        navigation.navigate("ftp", { screen: "files" });
    } else {
        navigation.navigate("local");
    }

    return true;
}

function getFileActionTarget(context: AppContextType): StorageType {
    const { fileAction, modifyFtpFile } = context;
    if (fileAction === "upload" || (fileAction === "move" && modifyFtpFile.length > 0)) {
        return "ftp";
    }

    return "local";
}
