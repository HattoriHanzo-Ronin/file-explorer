import { Modal, Pressable, Text, TextInput, View } from "react-native";
import React from "react";
import { useAppContext } from "../components/app-context-provider";
import { userMenu } from "../styles/components/style";
import AppDialog from "../components/dialog";
import Ionicons from "@react-native-vector-icons/ionicons";

interface UserMenuProps {
    visible: boolean;
    onClose: () => void;
}

export default function UserMenu(props: UserMenuProps) {
    const { onClose, visible } = props;
    const { authUtils, executeApiRequest, loadingUtils, setUser, user } = useAppContext();
    const [dialog, setDialog] = React.useState<"username" | "password" | null>(null);
    const [username, setUsername] = React.useState("");
    const [currentPassword, setCurrentPassword] = React.useState("");
    const [newPassword, setNewPassword] = React.useState("");
    const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
    const [showNewPassword, setShowNewPassword] = React.useState(false);

    function closeDialog() {
        setDialog(null);
        setUsername("");
        setCurrentPassword("");
        setNewPassword("");
        setShowCurrentPassword(false);
        setShowNewPassword(false);
    }

    async function logout() {
        onClose();
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
    }

    async function savePassword() {
        const result = await executeApiRequest((apiUtils) => apiUtils.updatePassword({ currentPassword, newPassword }));
        if (result.success) {
            closeDialog();
            await authUtils.logout();
        }
    }

    return (
        <>
            <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
                <Pressable style={userMenu.backdrop} onPress={onClose}>
                    <View style={userMenu.container} onStartShouldSetResponder={() => true}>
                        <Pressable style={userMenu.option} onPress={() => setDialog("username")}>
                            <Text style={userMenu.optionText}>Cambiar nombre de usuario</Text>
                        </Pressable>
                        <Pressable style={userMenu.option} onPress={() => setDialog("password")}>
                            <Text style={userMenu.optionText}>Cambiar contraseña</Text>
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
                    <TextInput style={userMenu.lineInput} value={username} onChangeText={setUsername} autoFocus />
                ) : (
                    <>
                        <Text style={userMenu.fieldLabel}>Contraseña actual:</Text>
                        <View style={userMenu.passwordField}>
                            <TextInput
                                style={userMenu.passwordInput}
                                value={currentPassword}
                                onChangeText={setCurrentPassword}
                                secureTextEntry={!showCurrentPassword}
                            />
                            <Pressable onPress={() => setShowCurrentPassword((current) => !current)}>
                                <Ionicons name={showCurrentPassword ? "eye-off-outline" : "eye-outline"} size={22} />
                            </Pressable>
                        </View>
                        <Text style={userMenu.fieldLabel}>Nueva contraseña:</Text>
                        <View style={userMenu.passwordField}>
                            <TextInput
                                style={userMenu.passwordInput}
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry={!showNewPassword}
                            />
                            <Pressable onPress={() => setShowNewPassword((current) => !current)}>
                                <Ionicons name={showNewPassword ? "eye-off-outline" : "eye-outline"} size={22} />
                            </Pressable>
                        </View>
                    </>
                )}
            </AppDialog>
        </>
    );
}
