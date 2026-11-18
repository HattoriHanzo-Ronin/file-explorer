import { Modal, Pressable, Text, TextInput, View } from "react-native";
import React from "react";
import { useAppContext } from "./app-context-provider";
import { useOperationContext } from "./operation-provider";
import { USER_MENU } from "../styles/components/style";
import { useTheme } from "./theme-provider";
import AppDialog from "./dialog";
import Ionicons from "@react-native-vector-icons/ionicons";
import UiUtils from "../utils/ui-utils";
import type { UpdatePasswordRequest, UpdateUsernameRequest } from "../types/users";
import type { ValidationErrors } from "../types/ui";
import type { UserMenuProps } from "../types/components";

export default function UserMenu(props: UserMenuProps) {
    const { onClose, onLogout, visible } = props;
    const { theme } = useTheme();
    const { setUser, user } = useAppContext();
    const { authUtils, executeApiRequest, loadingUtils } = useOperationContext();
    const [dialog, setDialog] = React.useState<"username" | "password" | null>(null);
    const [username, setUsername] = React.useState<string>("");
    const [currentPassword, setCurrentPassword] = React.useState<string>("");
    const [newPassword, setNewPassword] = React.useState<string>("");
    const [showCurrentPassword, setShowCurrentPassword] = React.useState<boolean>(false);
    const [showNewPassword, setShowNewPassword] = React.useState<boolean>(false);
    const [usernameErrors, setUsernameErrors] = React.useState<ValidationErrors<UpdateUsernameRequest>>({});
    const [passwordErrors, setPasswordErrors] = React.useState<ValidationErrors<UpdatePasswordRequest>>({});
    const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
    const submitting = React.useRef<boolean>(false);

    function closeDialog() {
        setDialog(null);
        setUsername("");
        setCurrentPassword("");
        setNewPassword("");
        setShowCurrentPassword(false);
        setShowNewPassword(false);
        setUsernameErrors({});
        setPasswordErrors({});
    }

    async function logout() {
        onClose();
        onLogout();
        await loadingUtils.run(() => authUtils.logout());
    }

    async function saveUsername() {
        const result = await executeApiRequest((apiUtils) => apiUtils.updateUsername({ id: user?.id ?? "", username }));
        if (result.success) {
            setUser((current) => (current ? { ...current, username: result.data.username } : null));
            closeDialog();
            return;
        }

        setUsernameErrors(UiUtils.mapValidationErrors<UpdateUsernameRequest>(result.error.details ?? []));
    }

    async function savePassword() {
        const result = await executeApiRequest((apiUtils) => apiUtils.updatePassword({ currentPassword, newPassword }));
        if (result.success) {
            closeDialog();
            onLogout();
            await authUtils.logout();
            return;
        }

        setPasswordErrors(UiUtils.mapValidationErrors<UpdatePasswordRequest>(result.error.details ?? []));
    }

    async function acceptDialog(): Promise<void> {
        if (submitting.current || dialog === null) {
            return;
        }

        submitting.current = true;
        setIsSubmitting(true);
        try {
            if (dialog === "username") {
                await saveUsername();
            } else {
                await savePassword();
            }
        } finally {
            submitting.current = false;
            setIsSubmitting(false);
        }
    }

    return (
        <>
            <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
                <Pressable style={USER_MENU.backdrop} onPress={onClose}>
                    <View
                        style={[USER_MENU.container, { backgroundColor: theme.surface, borderColor: theme.border }]}
                        onStartShouldSetResponder={() => true}
                    >
                        <Pressable style={USER_MENU.option} onPress={() => setDialog("username")}>
                            <Text style={[USER_MENU.optionText, { color: theme.text }]}>Cambiar nombre de usuario</Text>
                        </Pressable>
                        <Pressable style={USER_MENU.option} onPress={() => setDialog("password")}>
                            <Text style={[USER_MENU.optionText, { color: theme.text }]}>Cambiar contraseña</Text>
                        </Pressable>
                        <Pressable style={USER_MENU.option} onPress={() => void logout()}>
                            <Text style={USER_MENU.logoutText}>Cerrar sesión</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>
            <AppDialog
                visible={dialog !== null}
                title={dialog === "username" ? "Nuevo nombre de usuario" : undefined}
                acceptDisabled={isSubmitting}
                onCancel={closeDialog}
                onAccept={() => void acceptDialog()}
            >
                {dialog === "username" ? (
                    <>
                        <TextInput
                            style={[USER_MENU.lineInput, { borderBottomColor: theme.border, color: theme.text }]}
                            value={username}
                            returnKeyType="done"
                            onSubmitEditing={() => void acceptDialog()}
                            onChangeText={(value) => {
                                setUsername(value);
                                setUsernameErrors({});
                            }}
                            autoFocus
                        />
                        {usernameErrors.username?.map((message) => (
                            <Text key={message} style={[USER_MENU.validationError, { color: theme.danger }]}>
                                {message}
                            </Text>
                        ))}
                    </>
                ) : (
                    <>
                        <Text style={[USER_MENU.fieldLabel, { color: theme.text }]}>Contraseña actual:</Text>
                        <View style={[USER_MENU.passwordField, { borderBottomColor: theme.border }]}>
                            <TextInput
                                style={[USER_MENU.passwordInput, { color: theme.text }]}
                                value={currentPassword}
                                onChangeText={(value) => {
                                    setCurrentPassword(value);
                                    setPasswordErrors((current) => ({ ...current, currentPassword: undefined }));
                                }}
                                secureTextEntry={!showCurrentPassword}
                            />
                            <Pressable onPress={() => setShowCurrentPassword((current) => !current)}>
                                <Ionicons
                                    name={showCurrentPassword ? "eye-off-outline" : "eye-outline"}
                                    color={theme.text}
                                    size={22}
                                />
                            </Pressable>
                        </View>
                        {passwordErrors.currentPassword?.map((message) => (
                            <Text key={message} style={[USER_MENU.validationError, { color: theme.danger }]}>
                                {message}
                            </Text>
                        ))}
                        <Text style={[USER_MENU.fieldLabel, { color: theme.text }]}>Nueva contraseña:</Text>
                        <View style={[USER_MENU.passwordField, { borderBottomColor: theme.border }]}>
                            <TextInput
                                style={[USER_MENU.passwordInput, { color: theme.text }]}
                                value={newPassword}
                                returnKeyType="done"
                                onSubmitEditing={() => void acceptDialog()}
                                onChangeText={(value) => {
                                    setNewPassword(value);
                                    setPasswordErrors((current) => ({ ...current, newPassword: undefined }));
                                }}
                                secureTextEntry={!showNewPassword}
                            />
                            <Pressable onPress={() => setShowNewPassword((current) => !current)}>
                                <Ionicons
                                    name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                                    color={theme.text}
                                    size={22}
                                />
                            </Pressable>
                        </View>
                        {passwordErrors.newPassword?.map((message) => (
                            <Text key={message} style={[USER_MENU.validationError, { color: theme.danger }]}>
                                {message}
                            </Text>
                        ))}
                    </>
                )}
            </AppDialog>
        </>
    );
}
