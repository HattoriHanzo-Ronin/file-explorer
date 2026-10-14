import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from "react";
import Config from "react-native-config";
import { STORAGE_KEYS } from "../constants/storage";
import { STORAGE_ROOT_NAMES } from "../constants/storage-roots";
import type { ApiRequestOptions, ApiResponse } from "../types/api-response";
import type { AuthUser } from "../types/auth";
import type { AppContextType } from "../types/context";
import type { LocalDirectoryState, LocalModifyElement, ModifyElement, StorageRoot } from "../types/files";
import type { FtpDirectoryState, FtpEntryType } from "../types/ftp";
import type { LocalRequestOptions, LocalResponse } from "../types/local-response";
import type { FileActionMode, ListViewMode } from "../types/ui";
import ApiUtils from "../utils/api-utils";
import AuthUtils from "../utils/auth-utils";
import RNFSFileSystem from "../utils/files/impl/rnfs-file-system";
import NativeLocalFileOperation from "../utils/files/impl/native-local-file-operation";
import NativeRemoteFileOperation from "../utils/files/impl/native-remote-file-operation";
import LoadingUtils from "../utils/loading-utils";
import LocalFileManager from "../utils/operations/local-file-manager";
import RemoteFileManager from "../utils/operations/remote-file-manager";
import ReactNativePermission from "../utils/permissions/impl/react-native-permission";
import KeychainStorage from "../utils/storage/impl/keychain-storage";
import AsyncStorageStorage from "../utils/storage/impl/async-storage";
import NativeThumbnailGenerator from "../utils/thumbnails/impl/native-thumbnail-generator";
import UiUtils from "../utils/ui-utils";

const AppContext = createContext<AppContextType>({} as AppContextType);
const API_URL = Config.API_URL.replace(/\/+$/, "");

export const useAppContext = () => useContext(AppContext);

export default function AppContextProvider(props: PropsWithChildren) {
    const { children } = props;
    const [fileSystem] = useState<RNFSFileSystem>(() => new RNFSFileSystem(STORAGE_ROOT_NAMES));
    const [externalRoots, setExternalRoots] = useState<StorageRoot[]>([]);
    const [activeStorageRoot, setActiveStorageRoot] = useState<StorageRoot>(fileSystem.internalRoot);
    const [lastLocalRootId, setLastLocalRootId] = useState<string>(fileSystem.internalRoot.id);
    const [lastLocalDir, setLastLocalDir] = useState<string>(" ");
    const [ftpDirectory, setFtpDirectory] = useState<FtpDirectoryState>({ dir: " ", content: [] });
    const [localDirectory, setLocalDirectory] = useState<LocalDirectoryState>({ dir: " ", content: [] });
    const [modifyLocalFile, setModifyLocalFile] = useState<LocalModifyElement[]>([]);
    const [fileAction, setFileAction] = useState<FileActionMode>(null);
    const [modifyFtpFile, setModifyFtpFile] = useState<ModifyElement<FtpEntryType>[]>([]);
    const [ftpSelectionDir, setFtpSelectionDir] = useState<string>(" ");
    const [dirSelected, setDirSelected] = useState<boolean>(false);
    const [viewMode, setViewMode] = useState<ListViewMode>("LARGE_ICONS");
    const viewModeRestored = useRef<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [user, setUser] = useState<AuthUser | null>(null);

    const [storage] = useState<KeychainStorage>(() => new KeychainStorage());
    const [preferenceStorage] = useState<AsyncStorageStorage>(() => new AsyncStorageStorage());
    const [permission] = useState<ReactNativePermission>(() => new ReactNativePermission());
    const [thumbnailGenerator] = useState<NativeThumbnailGenerator>(() => new NativeThumbnailGenerator());
    const [localFileOperation] = useState<NativeLocalFileOperation>(() => new NativeLocalFileOperation());
    const [remoteFileOperation] = useState<NativeRemoteFileOperation>(() => new NativeRemoteFileOperation());
    const [localFileManager] = useState<LocalFileManager>(
        () => new LocalFileManager(fileSystem, localFileOperation, permission)
    );
    const [remoteFileManager] = useState<RemoteFileManager>(
        () => new RemoteFileManager(fileSystem, remoteFileOperation, storage, permission, API_URL)
    );
    const [apiUtils] = useState<ApiUtils>(() => new ApiUtils(remoteFileManager, storage, API_URL));
    const [authUtils] = useState<AuthUtils>(() => new AuthUtils(setIsAuthenticated, setUser, apiUtils, storage));
    const [loadingUtils] = useState<LoadingUtils>(() => new LoadingUtils(setIsLoading));

    /**
     * Executes an API request and retries it once after restoring the session
     *
     * @param request API request
     * @param options.isBackground Whether to execute without changing the loading state
     * @param options.showError Whether to display returned error messages
     * @returns API response
     */
    const executeApiRequest = useCallback(
        async function executeApiRequest<T>(
            request: (apiUtils: ApiUtils) => Promise<ApiResponse<T>>,
            options: ApiRequestOptions = {}
        ): Promise<ApiResponse<T>> {
            const { isBackground = false, showError = !isBackground } = options;
            return (async function execute(canRetry: boolean): Promise<ApiResponse<T>> {
                const executeRequest = async (): Promise<ApiResponse<T>> => {
                    const result = await request(apiUtils);
                    if (!result.success) {
                        const { code, message } = result.error;
                        if (canRetry && code === "INVALID_TOKEN" && (await authUtils.restoreSession())) {
                            return execute(false);
                        }

                        if (showError && message) {
                            UiUtils.showMessage(message);
                        }
                    }

                    return result;
                };
                return isBackground ? executeRequest() : loadingUtils.run(executeRequest);
            })(true);
        },
        [apiUtils, authUtils, loadingUtils]
    );

    /**
     * Executes a local file request
     *
     * @param request Local file request
     * @param options.isBackground Whether to execute without changing the loading state
     * @param options.showError Whether to display returned error messages
     * @returns Local file response
     */
    const executeLocalRequest = useCallback(
        async function executeLocalRequest<T>(
            request: (localFileManager: LocalFileManager) => Promise<LocalResponse<T>>,
            options: LocalRequestOptions = {}
        ): Promise<LocalResponse<T>> {
            const { isBackground = false, showError = !isBackground } = options;
            const executeRequest = async (): Promise<LocalResponse<T>> => {
                const result = await request(localFileManager);
                if (!result.success && showError && result.error.message) {
                    UiUtils.showMessage(result.error.message);
                }

                return result;
            };
            return isBackground ? executeRequest() : loadingUtils.run(executeRequest);
        },
        [loadingUtils, localFileManager]
    );

    const contextValues: AppContextType = {
        isAuthenticated,
        user,
        setUser,
        authUtils,
        executeApiRequest,
        executeLocalRequest,
        loadingUtils,
        permission,
        thumbnailGenerator,
        internalRoot: fileSystem.internalRoot,
        externalRoots,
        activeStorageRoot,
        setActiveStorageRoot,
        lastLocalRootId,
        lastLocalDir,
        ftpDirectory,
        setFtpDirectory,
        localDirectory,
        setLocalDirectory,
        fileAction,
        setFileAction,
        modifyLocalFile,
        setModifyLocalFile,
        modifyFtpFile,
        setModifyFtpFile,
        ftpSelectionDir,
        setFtpSelectionDir,
        dirSelected,
        setDirSelected,
        viewMode,
        setViewMode,
        isLoading,
        setIsLoading
    };

    useEffect(() => {
        let mounted = true;
        void preferenceStorage.get<ListViewMode>(STORAGE_KEYS.viewMode).then(
            (storedViewMode) => {
                if (mounted && isListViewMode(storedViewMode)) {
                    setViewMode(storedViewMode);
                }

                viewModeRestored.current = true;
            },
            () => {
                viewModeRestored.current = true;
            }
        );
        return () => {
            mounted = false;
        };
    }, [preferenceStorage]);

    useEffect(() => {
        if (viewModeRestored.current) {
            void preferenceStorage.set(STORAGE_KEYS.viewMode, viewMode);
        }
    }, [preferenceStorage, viewMode]);

    useEffect(() => {
        const updateExternalRoots = (roots: StorageRoot[]) => setExternalRoots(roots);
        void fileSystem.getExternalRoots().then(updateExternalRoots, () => setExternalRoots([]));
        return fileSystem.addStorageRootsChangeListener(updateExternalRoots);
    }, [fileSystem]);

    useEffect(() => {
        if (activeStorageRoot.type === "REMOVABLE" && !externalRoots.some((root) => root.id === activeStorageRoot.id)) {
            setActiveStorageRoot(fileSystem.internalRoot);
            setLocalDirectory({ dir: " ", content: [] });
        }

        const rootPaths = [fileSystem.internalRoot.path, ...externalRoots.map((root) => root.path)];
        setModifyLocalFile((items) =>
            items.filter((item) => rootPaths.some((path) => item.path.startsWith(`${path}/`)))
        );
    }, [activeStorageRoot, externalRoots, fileSystem]);

    useEffect(() => {
        if (modifyLocalFile.length === 0) {
            setLastLocalRootId(activeStorageRoot.id);
            setLastLocalDir(localDirectory.dir);
        }
    }, [activeStorageRoot.id, localDirectory.dir, modifyLocalFile.length]);

    useEffect(() => {
        void (async () => {
            await apiUtils.restoreOperations();
            await localFileManager.restore();
            apiUtils.clearSettledOperations();
        })();
    }, [apiUtils, localFileManager]);

    return <AppContext.Provider value={contextValues}>{children}</AppContext.Provider>;
}

function isListViewMode(value: unknown): value is ListViewMode {
    return value === "LIST" || value === "SMALL_ICONS" || value === "LARGE_ICONS";
}
