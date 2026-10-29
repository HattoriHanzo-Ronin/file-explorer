import type { AppContextType } from "../types/context";
import type { StorageRoot } from "../types/files";
import type { StorageType } from "../types/navigation";

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
    setLocalDirectory((current) =>
        isCurrentRoot && current.dir === " " ? current : { rootPath: root.path, dir: " ", content: [] }
    );
}

/**
 * Handles a drawer navigation action
 *
 * @param context Application context
 * @param storage Destination storage
 */
export function handleNavigationPress(context: AppContextType, storage: StorageType): void {
    const { ftpDirectory, setFtpDirectory, setModifyFtpFile, setModifyLocalFile } = context;
    setModifyFtpFile([]);
    setModifyLocalFile([]);
    if (storage === "local" && ftpDirectory.dir !== " ") {
        setFtpDirectory((current) => ({ ...current, dir: " ", version: "" }));
    }
}
