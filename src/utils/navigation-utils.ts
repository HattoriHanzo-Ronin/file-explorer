import type { AppContextType } from "../types/context";
import type { StorageRoot } from "../types/files";
import type { StorageType } from "../types/navigation";
import UiUtils from "./ui-utils";

type StorageContext = Pick<AppContextType, "activeStorageRoot" | "setActiveStorageRoot" | "setLocalDirectory">;

export function openStorage(context: StorageContext, root: StorageRoot) {
    const isCurrentRoot = context.activeStorageRoot.id === root.id;
    context.setActiveStorageRoot(root);
    context.setLocalDirectory((current) =>
        isCurrentRoot && current.dir === " " ? current : { dir: " ", content: [] }
    );
}

export function handleNavigationPress(context: AppContextType, storage: StorageType): void {
    if (context.fileAction && storage !== getFileActionTarget(context)) {
        UiUtils.completeFileAction(context);
    } else if (!context.fileAction && (context.modifyFtpFile.length > 0 || context.modifyLocalFile.length > 0)) {
        context.setModifyFtpFile([]);
        context.setModifyLocalFile([]);
        context.setDirSelected((current) => !current);
    }

    if (!context.fileAction && context.ftpDirectory.dir !== " ") {
        context.setFtpDirectory((current) => ({ ...current, dir: " " }));
    }
}

function getFileActionTarget(context: AppContextType): StorageType {
    if (context.fileAction === "upload" || (context.fileAction === "move" && context.modifyFtpFile.length > 0)) {
        return "ftp";
    }

    return "local";
}
