import type LocalFileManager from "../utils/operations/local-file-manager";
import type { RequestOptions, Response, ResponseError, ValidationErrorDetail } from "./response";

/** Local operation error */
export interface LocalError extends ResponseError {
    details?: ValidationErrorDetail[];
}

/** Local operation response */
export type LocalResponse<T> = Response<T, LocalError>;

/** Local request execution settings */
export type LocalRequestOptions = RequestOptions;

export type ExecuteLocalRequest = <T>(
    request: (localFileManager: LocalFileManager) => Promise<LocalResponse<T>>,
    options?: LocalRequestOptions
) => Promise<LocalResponse<T>>;
