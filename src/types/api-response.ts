import type ApiUtils from "../utils/api-utils";
import type { ApiError } from "./api-error";
import type { RequestOptions, Response } from "./response";

/**
 * Base API response
 */
export type ApiResponse<T> = Response<T, ApiError>;

export type ApiRequestOptions = RequestOptions;

export type ExecuteApiRequest = <T>(
    request: (apiUtils: ApiUtils) => Promise<ApiResponse<T>>,
    options?: ApiRequestOptions
) => Promise<ApiResponse<T>>;
