import type { Dispatch, SetStateAction } from "react";
import type { ExecuteApiRequest } from "./api-response";
import type { AuthUser } from "./auth";
import type { ModifyElement } from "./files";
import type AuthUtils from "../utils/auth-utils";
import type LoadingUtils from "../utils/loading-utils";
import type TransferManager from "../utils/transfers/transfer-manager";

export interface AppContextType {
    isAuthenticated: boolean;
    user: AuthUser | null;
    authUtils: AuthUtils;
    executeApiRequest: ExecuteApiRequest;
    loadingUtils: LoadingUtils;
    transferManager: TransferManager;
    lastFtpDir: string;
    setLastFtpDir: Dispatch<SetStateAction<string>>;
    lastLocalDir: string;
    setLastLocalDir: Dispatch<SetStateAction<string>>;
    modifyLocalFile: ModifyElement[];
    setModifyLocalFile: Dispatch<SetStateAction<ModifyElement[]>>;
    onCopy: boolean;
    setOnCopy: Dispatch<SetStateAction<boolean>>;
    modifyFtpFile: ModifyElement[];
    setModifyFtpFile: Dispatch<SetStateAction<ModifyElement[]>>;
    lastComponent: string;
    setLastComponent: Dispatch<SetStateAction<string>>;
    dirSelected: boolean;
    setDirSelected: Dispatch<SetStateAction<boolean>>;
    refresh: boolean;
    setRefresh: Dispatch<SetStateAction<boolean>>;
    resetTitle: boolean;
    setResetTitle: Dispatch<SetStateAction<boolean>>;
    isLoading: boolean;
    setIsLoading: Dispatch<SetStateAction<boolean>>;
    url: string;
}
