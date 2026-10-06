type UserRole = "ADMIN" | "FTP" | "NET";

export interface LoginRequest {
    username: string;
    password: string;
}

export interface RefreshTokenRequest {
    refreshToken: string;
}

export interface AuthUser {
    id: string;
    username: string;
    roles: UserRole[];
    scope?: UserRole[];
}

interface AuthResponse extends RefreshTokenRequest {
    user: AuthUser;
    accessToken: string;
}

export type LogoutRequest = RefreshTokenRequest;
export type LoginResponse = AuthResponse;
export type RefreshTokenResponse = AuthResponse;
