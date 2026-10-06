import type { AppContextType } from "../types/context";
import type { StorageRoot } from "../types/files";

type StorageContext = Pick<AppContextType, "activeStorageRoot" | "setActiveStorageRoot" | "setLocalDirectory">;

export function openStorage(context: StorageContext, root: StorageRoot) {
    const isCurrentRoot = context.activeStorageRoot.id === root.id;
    context.setActiveStorageRoot(root);
    context.setLocalDirectory((current) =>
        isCurrentRoot && current.dir === " " ? current : { dir: " ", content: [] }
    );
}
