import type LocalFileManager from "../utils/operations/local-file-manager";
import type { RequestOptions, Response, ResponseError } from "./response";

/** Local operation error */
export interface LocalError extends ResponseError {}

/** Local operation response */
export type LocalResponse<T> = Response<T, LocalError>;

/** Local request execution settings */
export type LocalRequestOptions = RequestOptions;

export type ExecuteLocalRequest = <T>(
    request: (localFileManager: LocalFileManager) => Promise<LocalResponse<T>>,
    options?: LocalRequestOptions
) => Promise<LocalResponse<T>>;
