export interface ApiValidationErrorDetail {
    field?: string;
    message: string;
}

/**
 * API error
 */
export interface ApiError extends ResponseError {
    message: string;
    code: string;
    details?: ApiValidationErrorDetail[];
}
import type { ResponseError } from "./response";
