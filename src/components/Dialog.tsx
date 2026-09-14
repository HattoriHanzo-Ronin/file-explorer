import * as Diag from "react-native-dialog";

export default function AppDialog(props: {
    show: boolean;
    onCancel: () => void;
    onOk: () => void;
    description: string;
    name: string;
    setName: (name: string) => void;
}) {
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
