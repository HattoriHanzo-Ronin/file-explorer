import type {
    RemoteDeleteOperationResult,
    RemoteDirectoryOperationResult,
    RemoteMoveOperationResult
} from "./file-operations";

export type FtpEntryType = "DIR" | "FILE";

export interface FtpEntry {
    name: string;
    type: FtpEntryType;
    supportsThumbnail?: boolean;
}

export interface FtpDirectoryState {
    dir: string;
    content: FtpEntry[];
    version: string;
}

interface FtpDirectoryRequest {
    dir?: string;
}

export interface ThumbnailRequest extends FtpDirectoryRequest {
    name: string;
}

export type ThumbnailStatus = "AVAILABLE" | "UNAVAILABLE" | "PENDING";

export interface ThumbnailResponse {
    status: ThumbnailStatus;
    uri?: string;
    headers?: Record<string, string>;
}

export interface CreateDirectoryRequest extends FtpDirectoryRequest {
    name: string;
}

export interface MoveEntriesRequest extends FtpDirectoryRequest {
    entries: FtpEntry[];
    destination: string;
}

export interface RenameEntryRequest extends FtpDirectoryRequest {
    entry: FtpEntry;
    newName: string;
}

export interface TransferEntry {
    path: string;
    type: FtpEntryType;
    size?: number;
}

interface EntriesRequest extends FtpDirectoryRequest {
    entries: FtpEntry[];
}

export type DeleteEntriesRequest = EntriesRequest;

export type GetDirectoryResponse = RemoteDirectoryOperationResult;
export type CreateDirectoryResponse = RemoteDirectoryOperationResult;
export type MoveEntriesResponse = RemoteMoveOperationResult;
export type RenameEntryResponse = RemoteDirectoryOperationResult;
export type DeleteEntriesResponse = RemoteDeleteOperationResult;
