import { createContext, PropsWithChildren, useContext, useState } from "react";
import type { AuthUser } from "../types/auth";
import type { AppContextType, AppStateContextType } from "../types/context";
import type { LocalDirectoryState, LocalModifyElement, ModifyElement, StorageRoot } from "../types/files";
import type { FtpDirectoryState, FtpEntryType } from "../types/ftp";
import type { ListViewMode } from "../types/ui";
import type { SharedFile } from "../types/sharing";
import ReactNativePermission from "../utils/permissions/impl/react-native-permission";
import OperationProvider from "./operation-provider";
import ThemeProvider from "./theme-provider";

const EMPTY_STORAGE_ROOT: StorageRoot = { id: "", name: "", path: "", type: "INTERNAL" };
const AppStateContext = createContext<AppStateContextType>({} as AppStateContextType);

export const useAppStateContext = () => useContext(AppStateContext);

export const useAppContext = (): AppContextType => useAppStateContext();

export default function AppContextProvider(props: PropsWithChildren) {
    const { children } = props;
    const [internalRoot, setInternalRoot] = useState<StorageRoot>(EMPTY_STORAGE_ROOT);
    const [externalRoots, setExternalRoots] = useState<StorageRoot[]>([]);
    const [activeStorageRoot, setActiveStorageRoot] = useState<StorageRoot>(EMPTY_STORAGE_ROOT);
    const [lastLocalRootId, setLastLocalRootId] = useState<string>("");
    const [lastLocalDir, setLastLocalDir] = useState<string>(" ");
    const [ftpDirectory, setFtpDirectory] = useState<FtpDirectoryState>({ dir: " ", content: [], version: "" });
    const [localDirectory, setLocalDirectory] = useState<LocalDirectoryState>({ rootPath: "", dir: " ", content: [] });
    const [modifyLocalFile, setModifyLocalFile] = useState<LocalModifyElement[]>([]);
    const [modifyFtpFile, setModifyFtpFile] = useState<ModifyElement<FtpEntryType>[]>([]);
    const [ftpSelectionDir, setFtpSelectionDir] = useState<string>(" ");
    const [viewMode, setViewMode] = useState<ListViewMode>("LARGE_ICONS");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [user, setUser] = useState<AuthUser | null>(null);
    const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
    const [permission] = useState<ReactNativePermission>(() => new ReactNativePermission());

    const contextValues: AppStateContextType = {
        internalRoot,
        setInternalRoot,
        externalRoots,
        setExternalRoots,
        activeStorageRoot,
        setActiveStorageRoot,
        lastLocalRootId,
        setLastLocalRootId,
        lastLocalDir,
        setLastLocalDir,
        ftpDirectory,
        setFtpDirectory,
        localDirectory,
        setLocalDirectory,
        modifyLocalFile,
        setModifyLocalFile,
        modifyFtpFile,
        setModifyFtpFile,
        ftpSelectionDir,
        setFtpSelectionDir,
        viewMode,
        setViewMode,
        isLoading,
        setIsLoading,
        isAuthenticated,
        setIsAuthenticated,
        user,
        setUser,
        sharedFiles,
        setSharedFiles,
        permission
    };

    return (
        <AppStateContext.Provider value={contextValues}>
            <ThemeProvider>
                <OperationProvider>{children}</OperationProvider>
            </ThemeProvider>
        </AppStateContext.Provider>
    );
}
