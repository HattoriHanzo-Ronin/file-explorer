import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from "react";
import Config from "react-native-config";
import { STORAGE_KEYS } from "../constants/storage";
import { STORAGE_ROOT_NAMES } from "../constants/storage-roots";
import { THUMBNAIL_CACHE } from "../constants/thumbnails";
import type { ApiRequestOptions, ApiResponse } from "../types/api-response";
import type { OperationContextType } from "../types/context";
import type { StorageRoot } from "../types/files";
import type { LocalRequestOptions, LocalResponse } from "../types/local-response";
import type { ListViewMode } from "../types/ui";
import ApiUtils from "../utils/api-utils";
import AuthUtils from "../utils/auth-utils";
import NativeLocalFileOperation from "../utils/files/impl/native-local-file-operation";
import NativeRemoteFileOperation from "../utils/files/impl/native-remote-file-operation";
import LoadingUtils from "../utils/loading-utils";
import LocalFileManager from "../utils/operations/local-file-manager";
import RemoteFileManager from "../utils/operations/remote-file-manager";
import KeychainStorage from "../utils/storage/impl/keychain-storage";
import NativeDatabase from "../utils/database/impl/native-database";
import DatabaseStorage from "../utils/storage/impl/database-storage";
import NativeThumbnailGenerator from "../utils/thumbnails/impl/native-thumbnail-generator";
import NativeSharing from "../utils/sharing/impl/native-sharing";
import UiUtils from "../utils/ui-utils";
import { useAppStateContext } from "./app-context-provider";

const OperationContext = createContext<OperationContextType>({} as OperationContextType);
const API_URL = Config.API_URL.replace(/\/+$/, "");
const ACTIVITY_TIMEOUT = 900000;

export const useOperationContext = () => useContext(OperationContext);

export default function OperationProvider(props: PropsWithChildren) {
    const { children } = props;
    const {
        activeStorageRoot,
        externalRoots,
        localDirectory,
        modifyLocalFile,
        permission,
        setActiveStorageRoot,
        setExternalRoots,
        setInternalRoot,
        setIsAuthenticated,
        setIsLoading,
        setLastLocalDir,
        setLastLocalRootId,
        setLocalDirectory,
        setModifyLocalFile,
        setUser,
        setViewMode,
        viewMode
    } = useAppStateContext();
    const [isInitialized, setIsInitialized] = useState<boolean>(false);
    const viewModeRestored = useRef<boolean>(false);
    const [localFileOperation] = useState<NativeLocalFileOperation>(
        () => new NativeLocalFileOperation(STORAGE_ROOT_NAMES)
    );
    const [storage] = useState<KeychainStorage>(() => new KeychainStorage());
    const [database] = useState<NativeDatabase>(() => new NativeDatabase());
    const [preferenceStorage] = useState<DatabaseStorage>(() => new DatabaseStorage(database));
    const [thumbnailGenerator] = useState<NativeThumbnailGenerator>(
        () => new NativeThumbnailGenerator(THUMBNAIL_CACHE)
    );
    const [sharing] = useState<NativeSharing>(() => new NativeSharing());
    const [remoteFileOperation] = useState<NativeRemoteFileOperation>(() => new NativeRemoteFileOperation());
    const [localFileManager] = useState<LocalFileManager>(() => new LocalFileManager(localFileOperation, permission));
    const [remoteFileManager] = useState<RemoteFileManager>(
        () => new RemoteFileManager(remoteFileOperation, storage, permission, API_URL)
    );
    const [apiUtils] = useState<ApiUtils>(() => new ApiUtils(remoteFileManager, storage, API_URL));
    const [authUtils] = useState<AuthUtils>(() => new AuthUtils(setIsAuthenticated, setUser, apiUtils, storage));
    const [loadingUtils] = useState<LoadingUtils>(() => new LoadingUtils(setIsLoading));
    const activityTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetActivityTimeout = useCallback((): void => {
        if (activityTimeout.current) {
            clearTimeout(activityTimeout.current);
        }

        void apiUtils.resumeSocketSession();
        activityTimeout.current = setTimeout(() => apiUtils.suspendSocketSession(), ACTIVITY_TIMEOUT);
    }, [apiUtils]);

    /**
     * Executes an API request and retries it once after restoring the session
     *
     * @param request API request
     * @param options.isBackground Whether to execute without changing the loading state
     * @param options.showError Whether to display returned error messages
     * @returns API response
     */
    const executeApiRequest = useCallback(
        async function executeApi<T>(
            request: (apiUtils: ApiUtils) => Promise<ApiResponse<T>>,
            options: ApiRequestOptions = {}
        ): Promise<ApiResponse<T>> {
            const { isBackground = false, showError = !isBackground } = options;
            if (!isBackground) {
                resetActivityTimeout();
            }

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
        [apiUtils, authUtils, loadingUtils, resetActivityTimeout]
    );

    const executeLocalRequest = useCallback(
        async function executeLocal<T>(
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

    const contextValues: OperationContextType = {
        authUtils,
        executeApiRequest,
        executeLocalRequest,
        loadingUtils,
        sharing,
        thumbnailGenerator
    };

    useEffect(() => {
        const { internalRoot } = localFileOperation;
        setInternalRoot(internalRoot);
        setActiveStorageRoot(internalRoot);
        setLastLocalRootId(internalRoot.id);
        setLocalDirectory({ rootPath: internalRoot.path, dir: " ", content: [] });
        setIsInitialized(true);
    }, [localFileOperation, setActiveStorageRoot, setInternalRoot, setLastLocalRootId, setLocalDirectory]);

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
    }, [preferenceStorage, setViewMode]);

    useEffect(() => {
        if (viewModeRestored.current) {
            void preferenceStorage.set(STORAGE_KEYS.viewMode, viewMode);
        }
    }, [preferenceStorage, viewMode]);

    useEffect(() => {
        const updateExternalRoots = (roots: StorageRoot[]) => setExternalRoots(roots);
        void localFileOperation.getExternalRoots().then(updateExternalRoots, () => setExternalRoots([]));
        return localFileOperation.addStorageRootsChangeListener(updateExternalRoots);
    }, [localFileOperation, setExternalRoots]);

    useEffect(() => {
        const { id: activeRootId, type: activeRootType } = activeStorageRoot;
        if (activeRootType === "REMOVABLE" && !externalRoots.some(({ id }) => id === activeRootId)) {
            const { internalRoot } = localFileOperation;
            setActiveStorageRoot(internalRoot);
            setLocalDirectory({ rootPath: internalRoot.path, dir: " ", content: [] });
        }

        const rootPaths = [localFileOperation.internalRoot.path, ...externalRoots.map(({ path }) => path)];
        setModifyLocalFile((items) =>
            items.filter(({ path: itemPath }) => rootPaths.some((path) => itemPath.startsWith(`${path}/`)))
        );
    }, [
        activeStorageRoot,
        externalRoots,
        localFileOperation,
        setActiveStorageRoot,
        setLocalDirectory,
        setModifyLocalFile
    ]);

    useEffect(() => {
        if (modifyLocalFile.length === 0) {
            setLastLocalRootId(activeStorageRoot.id);
            setLastLocalDir(localDirectory.dir);
        }
    }, [activeStorageRoot.id, localDirectory.dir, modifyLocalFile.length, setLastLocalDir, setLastLocalRootId]);

    useEffect(
        () => localFileOperation.addChangeListener(UiUtils.createFileOperationMessageListener()),
        [localFileOperation]
    );

    useEffect(() => {
        void (async () => {
            await apiUtils.restoreOperations();
            await localFileManager.restore();
            apiUtils.clearSettledOperations();
        })();
    }, [apiUtils, localFileManager]);

    useEffect(
        () => () => {
            if (activityTimeout.current) {
                clearTimeout(activityTimeout.current);
            }

            apiUtils.suspendSocketSession();
        },
        [apiUtils]
    );

    if (!isInitialized) {
        return null;
    }

    return <OperationContext.Provider value={contextValues}>{children}</OperationContext.Provider>;
}

function isListViewMode(value: unknown): value is ListViewMode {
    return value === "LIST" || value === "SMALL_ICONS" || value === "LARGE_ICONS";
}
