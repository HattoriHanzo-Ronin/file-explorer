import { createContext, PropsWithChildren, useCallback, useContext, useState } from "react";
import type { ApiResponse } from "../types/api-response";
import type { AuthUser } from "../types/auth";
import type { AppContextType } from "../types/context";
import type { ModifyElement } from "../types/files";
import ApiUtils from "../utils/api-utils";
import AuthUtils from "../utils/auth-utils";
import LoadingUtils from "../utils/loading-utils";
import KeychainStorage from "../utils/storage/impl/keychain-storage";
import UiUtils from "../utils/ui-utils";

const AppContext = createContext<AppContextType>({} as AppContextType);

export const useAppContext = () => useContext(AppContext);

export default function AppContextProvider(props: PropsWithChildren) {
    const { children } = props;
    const [lastFtpDir, setLastFtpDir] = useState<string>(" ");
    const [lastLocalDir, setLastLocalDir] = useState<string>(" ");
    const [modifyLocalFile, setModifyLocalFile] = useState<ModifyElement[]>([]);
    const [onCopy, setOnCopy] = useState<boolean>(false);
    const [modifyFtpFile, setModifyFtpFile] = useState<ModifyElement[]>([]);
    const [lastComponent, setLastComponent] = useState<string>("local");
    const [dirSelected, setDirSelected] = useState<boolean>(false);
    const [refresh, setRefresh] = useState<boolean>(false);
    const [resetTitle, setResetTitle] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const url = "http://10.8.200.8:60001/ftp";
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [user, setUser] = useState<AuthUser | null>(null);
    const [apiUtils] = useState<ApiUtils>(() => new ApiUtils());
    const [storage] = useState<KeychainStorage>(() => new KeychainStorage());
    const [authUtils] = useState<AuthUtils>(() => new AuthUtils(setIsAuthenticated, setUser, apiUtils, storage));
    const [loadingUtils] = useState<LoadingUtils>(() => new LoadingUtils(setIsLoading));

    /**
     * Executes an API request and retries it once after restoring the session
     *
     * @param request API request
     * @param isBackground Whether to execute without changing the loading state
     * @returns API response
     */
    const executeApiRequest = useCallback(
        async function executeApiRequest<T>(
            request: (apiUtils: ApiUtils) => Promise<ApiResponse<T>>,
            isBackground = false
        ): Promise<ApiResponse<T>> {
            return (async function execute(canRetry: boolean): Promise<ApiResponse<T>> {
                const executeRequest = async (): Promise<ApiResponse<T>> => {
                    const result = await request(apiUtils);
                    if (!result.success) {
                        const { code, message } = result.error;
                        if (canRetry && code === "INVALID_TOKEN" && (await authUtils.restoreSession())) {
                            return execute(false);
                        }

                        if (!isBackground) {
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
    const contextValues: AppContextType = {
        isAuthenticated,
        user,
        authUtils,
        executeApiRequest,
        loadingUtils,
        lastFtpDir,
        setLastFtpDir,
        lastLocalDir,
        setLastLocalDir,
        onCopy,
        setOnCopy,
        modifyLocalFile,
        setModifyLocalFile,
        modifyFtpFile,
        setModifyFtpFile,
        lastComponent,
        setLastComponent,
        dirSelected,
        setDirSelected,
        refresh,
        setRefresh,
        resetTitle,
        setResetTitle,
        isLoading,
        setIsLoading,
        url
    };

    return <AppContext.Provider value={contextValues}>{children}</AppContext.Provider>;
}
