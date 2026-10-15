import type { Dispatch, SetStateAction } from "react";
import type { ExecuteApiRequest } from "./api-response";
import type { ExecuteLocalRequest } from "./local-response";
import type { AuthUser } from "./auth";
import type { LocalDirectoryState, LocalModifyElement, ModifyElement, StorageRoot } from "./files";
import type { FtpDirectoryState, FtpEntryType } from "./ftp";
import type AuthUtils from "../utils/auth-utils";
import type LoadingUtils from "../utils/loading-utils";
import type { Permission } from "../utils/permissions/permission";
import type { ThumbnailGenerator } from "../utils/thumbnails/thumbnail-generator";
import type { FileActionMode, ListViewMode } from "./ui";

/** Shared application state and services */
export interface AppContextType {
    isAuthenticated: boolean;
    user: AuthUser | null;
    setUser: Dispatch<SetStateAction<AuthUser | null>>;
    authUtils: AuthUtils;
    executeApiRequest: ExecuteApiRequest;
    executeLocalRequest: ExecuteLocalRequest;
    loadingUtils: LoadingUtils;
    permission: Permission;
    thumbnailGenerator: ThumbnailGenerator;
    internalRoot: StorageRoot;
    externalRoots: StorageRoot[];
    activeStorageRoot: StorageRoot;
    setActiveStorageRoot: Dispatch<SetStateAction<StorageRoot>>;
    lastLocalRootId: string;
    lastLocalDir: string;
    ftpDirectory: FtpDirectoryState;
    setFtpDirectory: Dispatch<SetStateAction<FtpDirectoryState>>;
    localDirectory: LocalDirectoryState;
    setLocalDirectory: Dispatch<SetStateAction<LocalDirectoryState>>;
    modifyLocalFile: LocalModifyElement[];
    setModifyLocalFile: Dispatch<SetStateAction<LocalModifyElement[]>>;
    fileAction: FileActionMode;
    setFileAction: Dispatch<SetStateAction<FileActionMode>>;
    modifyFtpFile: ModifyElement<FtpEntryType>[];
    setModifyFtpFile: Dispatch<SetStateAction<ModifyElement<FtpEntryType>[]>>;
    ftpSelectionDir: string;
    setFtpSelectionDir: Dispatch<SetStateAction<string>>;
    dirSelected: boolean;
    setDirSelected: Dispatch<SetStateAction<boolean>>;
    viewMode: ListViewMode;
    setViewMode: Dispatch<SetStateAction<ListViewMode>>;
    isLoading: boolean;
    setIsLoading: Dispatch<SetStateAction<boolean>>;
}
