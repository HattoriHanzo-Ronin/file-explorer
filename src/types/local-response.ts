import type LocalFileManager from "../utils/operations/local-file-manager";
import type { RequestOptions, Response, ResponseError } from "./response";

export interface LocalError extends ResponseError {}

export type LocalResponse<T> = Response<T, LocalError>;

export type LocalRequestOptions = RequestOptions;

export type ExecuteLocalRequest = <T>(
    request: (localFileManager: LocalFileManager) => Promise<LocalResponse<T>>,
    options?: LocalRequestOptions
) => Promise<LocalResponse<T>>;
