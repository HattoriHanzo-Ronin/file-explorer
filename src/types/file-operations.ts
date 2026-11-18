import type { FtpEntry, FtpEntryType } from "./ftp";
import type { EntryType, LocalModifyElement } from "./files";
import type { ApiError } from "./api-error";

export type FileOperationType =
    | "UPLOAD"
    | "DOWNLOAD"
    | "REMOTE_MKDIR"
    | "REMOTE_RENAME"
    | "REMOTE_MOVE"
    | "REMOTE_COPY"
    | "REMOTE_DELETE"
    | "LOCAL_MKDIR"
    | "LOCAL_RENAME"
    | "LOCAL_COPY"
    | "LOCAL_MOVE"
    | "LOCAL_DELETE"
    | "LOCAL_EXTRACT";
export type FileOperationStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "INTERRUPTED";

/** Local or FTP entry selected for an operation */
export interface FileOperationSelection {
    path: string;
    type: EntryType | FtpEntryType;
}

export interface FileOperationNotificationTexts {
    channelName: string;
    pending: string;
    running: string;
    uploadActive: string;
    uploadCompleted: string;
    uploadFailed: string;
    uploadCancelled: string;
    uploadInterrupted: string;
    downloadActive: string;
    downloadCompleted: string;
    downloadFailed: string;
    downloadCancelled: string;
    downloadInterrupted: string;
    remoteMkdirActive: string;
    remoteMkdirCompleted: string;
    remoteMkdirFailed: string;
    remoteMkdirInterrupted: string;
    remoteRenameActive: string;
    remoteRenameCompleted: string;
    remoteRenameFailed: string;
    remoteRenameInterrupted: string;
    remoteCopyActive: string;
    remoteCopyCompleted: string;
    remoteCopyFailed: string;
    remoteCopyInterrupted: string;
    remoteMoveActive: string;
    remoteMoveCompleted: string;
    remoteMoveFailed: string;
    remoteMoveInterrupted: string;
    remoteDeleteActive: string;
    remoteDeleteCompleted: string;
    remoteDeleteFailed: string;
    remoteDeleteInterrupted: string;
    localMkdirActive: string;
    localMkdirCompleted: string;
    localMkdirFailed: string;
    localMkdirInterrupted: string;
    localRenameActive: string;
    localRenameCompleted: string;
    localRenameFailed: string;
    localRenameInterrupted: string;
    localCopyActive: string;
    localCopyCompleted: string;
    localCopyFailed: string;
    localCopyCancelled: string;
    localCopyInterrupted: string;
    localMoveActive: string;
    localMoveCompleted: string;
    localMoveFailed: string;
    localMoveCancelled: string;
    localMoveInterrupted: string;
    localDeleteActive: string;
    localDeleteCompleted: string;
    localDeleteFailed: string;
    localDeleteInterrupted: string;
    localExtractActive: string;
    localExtractCompleted: string;
    localExtractFailed: string;
    localExtractCancelled: string;
    localExtractInterrupted: string;
    completed: string;
    failed: string;
    cancelled: string;
    interrupted: string;
    cancelAction: string;
}

/** Updated contents and version of a remote directory */
export interface RemoteDirectoryOperationResult {
    entries: FtpEntry[];
    version: string;
}

export interface RemoteFileChange {
    path: string;
    targetPath?: string;
    type: FtpEntryType;
    completed: number;
    total: number;
}

/** Deleted remote entries and resulting directory version */
export interface RemoteDeleteOperationResult {
    changes: RemoteFileChange[];
    version: string;
}

export interface RemoteDirectoryVersion {
    dir: string;
    version: string;
}

/** Copied entries and resulting destination version */
export interface RemoteCopyOperationResult {
    changes: RemoteFileChange[];
    destination: RemoteDirectoryVersion;
}

/** Moved entries and resulting source and destination versions */
export interface RemoteMoveOperationResult extends RemoteCopyOperationResult {
    source: RemoteDirectoryVersion;
}

/** Persisted state and progress of a native file operation */
export interface FileOperationSnapshot {
    id: string;
    operation: FileOperationType;
    status: FileOperationStatus;
    bytesTransferred: number;
    totalBytes: number;
    revision: number;
    error?: ApiError;
    result?: RemoteDirectoryOperationResult | RemoteDeleteOperationResult | RemoteCopyOperationResult | RemoteMoveOperationResult;
    remoteDir: string;
    destinationDir: string;
    localDir: string;
}

interface NativeRemoteRequest {
    apiUrl: string;
    accessToken: string;
    notificationTexts: FileOperationNotificationTexts;
    remoteDir?: string;
}

export interface UploadOperationRequest {
    items: LocalModifyElement[];
    remoteDir: string;
}

export interface DownloadOperationRequest {
    items: FileOperationSelection[];
    remoteDir: string;
    localRoot: string;
    localDir: string;
}

export interface NativeLocalImmediateMkdirRequest {
    destination: string;
    name: string;
}

export interface NativeLocalImmediateRenameRequest {
    source: string;
    name: string;
}

export interface NativeUploadRequest extends NativeRemoteRequest {
    entries: LocalModifyElement[];
}

export interface NativeDownloadRequest extends NativeRemoteRequest {
    destination: string;
    entries: FtpEntry[];
}

export interface NativeRemoteMkdirRequest extends NativeRemoteRequest {
    name: string;
}

export interface NativeRemoteRenameRequest extends NativeRemoteRequest {
    entry: FtpEntry;
    newName: string;
}

export interface NativeRemoteDeleteRequest extends NativeRemoteRequest {
    entries: FtpEntry[];
}

export interface NativeRemoteMoveRequest extends NativeRemoteRequest {
    destination: string;
    entries: FtpEntry[];
}

export type NativeRemoteCopyRequest = NativeRemoteMoveRequest;

interface NativeLocalRequest {
    notificationTexts: FileOperationNotificationTexts;
    sources: string[];
}

export interface NativeLocalCopyMoveRequest extends NativeLocalRequest {
    destination: string;
}

export interface NativeLocalDeleteRequest extends NativeLocalRequest {
    destination: string;
}

export interface NativeLocalExtractRequest {
    notificationTexts: FileOperationNotificationTexts;
    source: string;
    destination: string;
}

export interface NativeLocalMkdirRequest {
    notificationTexts: FileOperationNotificationTexts;
    destination: string;
    name: string;
}

export interface NativeLocalRenameRequest {
    notificationTexts: FileOperationNotificationTexts;
    source: string;
    name: string;
}
