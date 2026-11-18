import { Modal, Pressable, Text, View } from "react-native";
import type { DialogProps } from "../types/components";
import { APP_DIALOG } from "../styles/components/style";
import { useTheme } from "./theme-provider";

export default function AppDialog(props: DialogProps) {
    const { acceptDisabled, children, onAccept, onCancel, title, visible } = props;
    const { theme } = useTheme();

    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
            <View style={APP_DIALOG.backdrop}>
                <View style={[APP_DIALOG.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    {title ? <Text style={[APP_DIALOG.description, { color: theme.text }]}>{title}</Text> : null}
                    {children}
                    <View style={APP_DIALOG.actions}>
                        <Pressable style={APP_DIALOG.button} onPress={onCancel}>
                            <Text style={[APP_DIALOG.cancelText, { color: theme.danger }]}>Cancelar</Text>
                        </Pressable>
                        <Pressable
                            style={APP_DIALOG.button}
                            onPress={onAccept}
                            disabled={acceptDisabled}
                            accessibilityState={{ disabled: !!acceptDisabled }}
                        >
                            <Text style={[APP_DIALOG.acceptText, { color: theme.accent }]}>Aceptar</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
