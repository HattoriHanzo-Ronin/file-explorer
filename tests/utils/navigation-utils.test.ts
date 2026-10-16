import type { AppContextType } from "../../src/types/context";
import type { FileSystemEntry, StorageRoot } from "../../src/types/files";
import { handleNavigationPress, openStorage } from "../../src/utils/navigation-utils";

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

test.each([
    ["upload", "local"],
    ["download", "ftp"]
] as const)("clears a pending %s when navigating to the other storage mode", (fileAction, storage) => {
    const context = navigationContext(fileAction);

    handleNavigationPress(context, storage);

    expect(context.setFileAction).toHaveBeenCalledWith(null);
    expect(context.setModifyFtpFile).toHaveBeenCalledWith([]);
    expect(context.setModifyLocalFile).toHaveBeenCalledWith([]);
});

test.each([
    ["upload", "ftp"],
    ["download", "local"]
] as const)("keeps a pending %s while navigating within its destination mode", (fileAction, storage) => {
    const context = navigationContext(fileAction);

    handleNavigationPress(context, storage);

    expect(context.setFileAction).not.toHaveBeenCalled();
    expect(context.setModifyFtpFile).not.toHaveBeenCalled();
    expect(context.setModifyLocalFile).not.toHaveBeenCalled();
});

function navigationContext(fileAction: "upload" | "download"): AppContextType {
    return {
        fileAction,
        ftpDirectory: { dir: " ", content: [] },
        modifyFtpFile: fileAction === "download" ? [{ path: "remote", type: "FILE" }] : [],
        modifyLocalFile: fileAction === "upload" ? [{ path: "/local", type: "file" }] : [],
        setDirSelected: jest.fn(),
        setFileAction: jest.fn(),
        setFtpDirectory: jest.fn(),
        setModifyFtpFile: jest.fn(),
        setModifyLocalFile: jest.fn()
    } as unknown as AppContextType;
}
