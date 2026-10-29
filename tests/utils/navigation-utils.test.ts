import type { AppContextType } from "../../src/types/context";
import type { FileSystemEntry, StorageRoot } from "../../src/types/files";
import { handleNavigationPress, openStorage } from "../../src/utils/navigation-utils";
import UiUtils from "../../src/utils/ui-utils";

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
    const currentDirectory = { rootPath: root.path, dir: " ", content };
    expect(updateDirectory(currentDirectory)).toBe(currentDirectory);
});

test("applies completed operation results only to the matching storage and directory", () => {
    const setLocalDirectory = jest.fn();
    const entries = [{ name: "new.txt" }] as FileSystemEntry[];
    UiUtils.applyLocalDirectoryUpdates(setLocalDirectory, [{ path: "/storage/docs", entries }]);
    const update = setLocalDirectory.mock.calls[0][0];
    const current = { rootPath: "/storage", dir: "docs", content: [] };
    const otherStorage = { rootPath: "/sdcard", dir: "docs", content: [] };
    const otherDirectory = { rootPath: "/storage", dir: "other", content: [] };
    expect(update(current)).toEqual({ ...current, content: entries });
    expect(update(otherStorage)).toBe(otherStorage);
    expect(update(otherDirectory)).toBe(otherDirectory);
});

test("clears selections when navigating through the drawer", () => {
    const context = {
        ftpDirectory: { dir: "docs", content: [], version: "1" },
        setFtpDirectory: jest.fn(),
        setModifyFtpFile: jest.fn(),
        setModifyLocalFile: jest.fn()
    } as unknown as AppContextType;

    handleNavigationPress(context, "local");

    expect(context.setModifyFtpFile).toHaveBeenCalledWith([]);
    expect(context.setModifyLocalFile).toHaveBeenCalledWith([]);
    expect(context.setFtpDirectory).toHaveBeenCalled();
});
