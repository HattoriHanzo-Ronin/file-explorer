import type { ValidationErrorDetail } from "./response";

export type ApiValidationErrorDetail = ValidationErrorDetail;

/**
 * API error
 */
export interface ApiError extends ResponseError {
    message: string;
    code: string;
    details?: ApiValidationErrorDetail[];
}
import type { ResponseError } from "./response";
