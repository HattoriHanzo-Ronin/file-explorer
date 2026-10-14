import { Modal, Pressable, Text, View } from "react-native";
import type { DialogProps } from "../types/components";
import { appDialog } from "../styles/components/style";

export default function AppDialog(props: DialogProps) {
    const { children, onAccept, onCancel, title, visible } = props;

    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
            <View style={appDialog.backdrop}>
                <View style={appDialog.container}>
                    {title ? <Text style={appDialog.description}>{title}</Text> : null}
                    {children}
                    <View style={appDialog.actions}>
                        <Pressable style={appDialog.button} onPress={onCancel}>
                            <Text style={appDialog.cancelText}>Cancelar</Text>
                        </Pressable>
                        <Pressable style={appDialog.button} onPress={onAccept}>
                            <Text style={appDialog.acceptText}>Aceptar</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
