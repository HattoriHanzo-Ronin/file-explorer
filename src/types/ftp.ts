import type { RemoteFileChange } from "./file-operations";

export type FtpEntryType = "DIR" | "FILE";

export interface FtpEntry {
    name: string;
    type: FtpEntryType;
    supportsThumbnail?: boolean;
}

export interface FtpDirectoryState {
    dir: string;
    content: FtpEntry[];
}

interface FtpDirectoryRequest {
    dir?: string;
}

export interface ThumbnailRequest extends FtpDirectoryRequest {
    name: string;
}

export type ThumbnailStatus = "AVAILABLE" | "UNAVAILABLE" | "PENDING";

export type FtpVersionRequest = FtpDirectoryRequest;

export interface FtpVersionResponse {
    version: string;
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

export type GetDirectoryResponse = FtpEntry[];
export type CreateDirectoryResponse = FtpEntry[];
export type MoveEntriesResponse = RemoteFileChange[];
export type RenameEntryResponse = FtpEntry[];
export type DeleteEntriesResponse = RemoteFileChange[];
