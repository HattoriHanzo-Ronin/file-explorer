import { Modal, Pressable, Text, TextInput, View } from "react-native";
import React from "react";
import { useAppContext } from "../components/app-context-provider";
import { userMenu } from "../styles/components/style";
import { useTheme } from "../components/theme-provider";
import AppDialog from "../components/dialog";
import Ionicons from "@react-native-vector-icons/ionicons";
import UiUtils from "../utils/ui-utils";
import type { UpdatePasswordRequest, UpdateUsernameRequest } from "../types/users";
import type { ValidationErrors } from "../types/ui";

interface UserMenuProps {
    visible: boolean;
    onClose: () => void;
    onLogout: () => void;
}

export default function UserMenu(props: UserMenuProps) {
    const { onClose, onLogout, visible } = props;
    const { theme } = useTheme();
    const { authUtils, executeApiRequest, loadingUtils, setUser, user } = useAppContext();
    const [dialog, setDialog] = React.useState<"username" | "password" | null>(null);
    const [username, setUsername] = React.useState<string>("");
    const [currentPassword, setCurrentPassword] = React.useState<string>("");
    const [newPassword, setNewPassword] = React.useState<string>("");
    const [showCurrentPassword, setShowCurrentPassword] = React.useState<boolean>(false);
    const [showNewPassword, setShowNewPassword] = React.useState<boolean>(false);
    const [usernameErrors, setUsernameErrors] = React.useState<ValidationErrors<UpdateUsernameRequest>>({});
    const [passwordErrors, setPasswordErrors] = React.useState<ValidationErrors<UpdatePasswordRequest>>({});

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
        const result = await executeApiRequest((apiUtils) =>
            apiUtils.updateUsername({ id: user?.id ?? "", username: username.trim() })
        );
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

    return (
        <>
            <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
                <Pressable style={userMenu.backdrop} onPress={onClose}>
                    <View
                        style={[userMenu.container, { backgroundColor: theme.surface, borderColor: theme.border }]}
                        onStartShouldSetResponder={() => true}
                    >
                        <Pressable style={userMenu.option} onPress={() => setDialog("username")}>
                            <Text style={[userMenu.optionText, { color: theme.text }]}>Cambiar nombre de usuario</Text>
                        </Pressable>
                        <Pressable style={userMenu.option} onPress={() => setDialog("password")}>
                            <Text style={[userMenu.optionText, { color: theme.text }]}>Cambiar contraseña</Text>
                        </Pressable>
                        <Pressable style={userMenu.option} onPress={() => void logout()}>
                            <Text style={userMenu.logoutText}>Cerrar sesión</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>
            <AppDialog
                visible={dialog !== null}
                title={dialog === "username" ? "Nuevo nombre de usuario" : undefined}
                onCancel={closeDialog}
                onAccept={() => void (dialog === "username" ? saveUsername() : savePassword())}
            >
                {dialog === "username" ? (
                    <>
                        <TextInput
                            style={[userMenu.lineInput, { borderBottomColor: theme.border, color: theme.text }]}
                            value={username}
                            onChangeText={(value) => {
                                setUsername(value);
                                setUsernameErrors({});
                            }}
                            autoFocus
                        />
                        {usernameErrors.username?.map((message) => (
                            <Text key={message} style={[userMenu.validationError, { color: theme.danger }]}>
                                {message}
                            </Text>
                        ))}
                    </>
                ) : (
                    <>
                        <Text style={[userMenu.fieldLabel, { color: theme.text }]}>Contraseña actual:</Text>
                        <View style={[userMenu.passwordField, { borderBottomColor: theme.border }]}>
                            <TextInput
                                style={[userMenu.passwordInput, { color: theme.text }]}
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
                            <Text key={message} style={[userMenu.validationError, { color: theme.danger }]}>
                                {message}
                            </Text>
                        ))}
                        <Text style={[userMenu.fieldLabel, { color: theme.text }]}>Nueva contraseña:</Text>
                        <View style={[userMenu.passwordField, { borderBottomColor: theme.border }]}>
                            <TextInput
                                style={[userMenu.passwordInput, { color: theme.text }]}
                                value={newPassword}
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
                            <Text key={message} style={[userMenu.validationError, { color: theme.danger }]}>
                                {message}
                            </Text>
                        ))}
                    </>
                )}
            </AppDialog>
        </>
    );
}
