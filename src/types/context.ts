import type { Dispatch, SetStateAction } from "react";
import type { ExecuteApiRequest } from "./api-response";
import type { AuthUser } from "./auth";
import type { LocalDirectoryState, LocalModifyElement, ModifyElement, StorageRoot } from "./files";
import type { FtpDirectoryState, FtpEntryType } from "./ftp";
import type { ExecuteLocalRequest } from "./local-response";
import type { ListViewMode } from "./ui";
import type AuthUtils from "../utils/auth-utils";
import type LoadingUtils from "../utils/loading-utils";
import type { Permission } from "../utils/permissions/permission";
import type { ThumbnailGenerator } from "../utils/thumbnails/thumbnail-generator";

/** Shared application state */
export interface AppStateContextType {
    internalRoot: StorageRoot;
    setInternalRoot: Dispatch<SetStateAction<StorageRoot>>;
    externalRoots: StorageRoot[];
    setExternalRoots: Dispatch<SetStateAction<StorageRoot[]>>;
    activeStorageRoot: StorageRoot;
    setActiveStorageRoot: Dispatch<SetStateAction<StorageRoot>>;
    lastLocalRootId: string;
    setLastLocalRootId: Dispatch<SetStateAction<string>>;
    lastLocalDir: string;
    setLastLocalDir: Dispatch<SetStateAction<string>>;
    ftpDirectory: FtpDirectoryState;
    setFtpDirectory: Dispatch<SetStateAction<FtpDirectoryState>>;
    localDirectory: LocalDirectoryState;
    setLocalDirectory: Dispatch<SetStateAction<LocalDirectoryState>>;
    modifyLocalFile: LocalModifyElement[];
    setModifyLocalFile: Dispatch<SetStateAction<LocalModifyElement[]>>;
    modifyFtpFile: ModifyElement<FtpEntryType>[];
    setModifyFtpFile: Dispatch<SetStateAction<ModifyElement<FtpEntryType>[]>>;
    ftpSelectionDir: string;
    setFtpSelectionDir: Dispatch<SetStateAction<string>>;
    viewMode: ListViewMode;
    setViewMode: Dispatch<SetStateAction<ListViewMode>>;
    isLoading: boolean;
    setIsLoading: Dispatch<SetStateAction<boolean>>;
    isAuthenticated: boolean;
    setIsAuthenticated: Dispatch<SetStateAction<boolean>>;
    user: AuthUser | null;
    setUser: Dispatch<SetStateAction<AuthUser | null>>;
    permission: Permission;
}

/** Shared application operations */
export interface OperationContextType {
    authUtils: AuthUtils;
    executeApiRequest: ExecuteApiRequest;
    executeLocalRequest: ExecuteLocalRequest;
    loadingUtils: LoadingUtils;
    thumbnailGenerator: ThumbnailGenerator;
}

/** Shared application state */
export type AppContextType = AppStateContextType;
