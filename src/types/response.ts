/**
 * Base response error
 */
export interface ResponseError {
    message: string;
    code: string;
}

/** Successful operation response */
export type SuccessResponse<T> = {
    success: true;
    data: T;
};

/** Failed operation response */
export type ErrorResponse<TError extends ResponseError> = {
    success: false;
    error: TError;
};

/** Base operation response */
export type Response<T, TError extends ResponseError> = SuccessResponse<T> | ErrorResponse<TError>;

/** Request execution settings */
export interface RequestOptions {
    isBackground?: boolean;
    showError?: boolean;
}
