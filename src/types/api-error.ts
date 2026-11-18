import type { ResponseError, ValidationErrorDetail } from "./response";

export type ApiValidationErrorDetail = ValidationErrorDetail;

/**
 * API error
 */
export interface ApiError extends ResponseError {
    details?: ApiValidationErrorDetail[];
}
