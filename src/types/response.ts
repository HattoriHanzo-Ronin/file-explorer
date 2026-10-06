/**
 * Base response error
 */
export interface ResponseError {
    message: string;
    code: string;
}

export type SuccessResponse<T> = {
    success: true;
    data: T;
};

export type ErrorResponse<TError extends ResponseError> = {
    success: false;
    error: TError;
};

export type Response<T, TError extends ResponseError> = SuccessResponse<T> | ErrorResponse<TError>;

export interface RequestOptions {
    isBackground?: boolean;
    showError?: boolean;
}
