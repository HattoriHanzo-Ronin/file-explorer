export type UserMenuSectionProps = { onClose: () => void };

interface Username {
    username: string;
}

export interface UpdateUsernameRequest extends Username {
    id: string;
}

export interface UpdatePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

export type UpdateUsernameResponse = Username;
