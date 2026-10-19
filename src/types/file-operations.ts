import type { FtpEntry, FtpEntryType, TransferEntry } from "./ftp";
import type { EntryType } from "./files";
import type { ResponseError } from "./response";

export type FileOperationType =
    | "UPLOAD"
    | "DOWNLOAD"
    | "REMOTE_MKDIR"
    | "REMOTE_RENAME"
    | "REMOTE_MOVE"
    | "REMOTE_DELETE"
    | "LOCAL_MKDIR"
    | "LOCAL_RENAME"
    | "LOCAL_COPY"
    | "LOCAL_MOVE"
    | "LOCAL_DELETE"
    | "LOCAL_EXTRACT";
export type FileOperationStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "INTERRUPTED";

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

export interface RemoteChangeOperationResult {
    changes: RemoteFileChange[];
    version: string;
}

export interface FileOperationSnapshot {
    id: string;
    operation: FileOperationType;
    status: FileOperationStatus;
    bytesTransferred: number;
    totalBytes: number;
    revision: number;
    error?: ResponseError;
    result?: RemoteDirectoryOperationResult | RemoteChangeOperationResult;
    remoteDir: string;
    destinationDir: string;
    localDir: string;
}

export interface NativeUploadEntry extends TransferEntry {
    localPath?: string;
    mimeType?: string;
}

interface NativeRemoteRequest {
    apiUrl: string;
    accessToken: string;
    notificationTexts: FileOperationNotificationTexts;
    remoteDir?: string;
}

export interface NativeUploadRequest extends NativeRemoteRequest {
    entries: NativeUploadEntry[];
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
