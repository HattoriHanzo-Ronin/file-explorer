import * as Diag from "react-native-dialog";
import type { DialogProps } from "../types/components";

export default function AppDialog(props: DialogProps) {
    const { show, onCancel, onOk, description, name, setName } = props;
    const NativeDialog = Diag.default;

    return (
        <NativeDialog.Container visible={show}>
            <NativeDialog.Description>{description}</NativeDialog.Description>
            <NativeDialog.Input value={name} onChangeText={(text) => setName(text)} />
            <NativeDialog.Button label="Cancelar" onPress={() => onCancel()} />
            <NativeDialog.Button label="Ok" onPress={() => onOk()} />
        </NativeDialog.Container>
    );
}
