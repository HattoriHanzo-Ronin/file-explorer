import { Modal, Pressable, Text, View } from "react-native";
import type { DialogProps } from "../types/components";
import { appDialog } from "../styles/components/style";
import { useTheme } from "./theme-provider";

export default function AppDialog(props: DialogProps) {
    const { children, onAccept, onCancel, title, visible } = props;
    const { theme } = useTheme();

    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
            <View style={appDialog.backdrop}>
                <View style={[appDialog.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    {title ? <Text style={[appDialog.description, { color: theme.text }]}>{title}</Text> : null}
                    {children}
                    <View style={appDialog.actions}>
                        <Pressable style={appDialog.button} onPress={onCancel}>
                            <Text style={[appDialog.cancelText, { color: theme.danger }]}>Cancelar</Text>
                        </Pressable>
                        <Pressable style={appDialog.button} onPress={onAccept}>
                            <Text style={[appDialog.acceptText, { color: theme.accent }]}>Aceptar</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
