import type { AppContextType } from "../src/types/context";
import type { FileSystemEntry, StorageRoot } from "../src/types/files";
import { openStorage } from "../src/utils/navigation-utils";

test("keeps the current root content when its drawer item is pressed again", () => {
    const root: StorageRoot = { id: "internal", name: "Internal", path: "/storage", type: "INTERNAL" };
    const content = [{ name: "file.txt" }] as FileSystemEntry[];
    const setActiveStorageRoot = jest.fn();
    const setLocalDirectory = jest.fn();
    const context = {
        activeStorageRoot: root,
        setActiveStorageRoot,
        setLocalDirectory
    } as Pick<AppContextType, "activeStorageRoot" | "setActiveStorageRoot" | "setLocalDirectory">;

    openStorage(context, root);

    expect(setActiveStorageRoot).toHaveBeenCalledWith(root);
    const updateDirectory = setLocalDirectory.mock.calls[0][0];
    const currentDirectory = { dir: " ", content };
    expect(updateDirectory(currentDirectory)).toBe(currentDirectory);
});
