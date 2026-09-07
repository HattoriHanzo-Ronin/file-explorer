import { useState } from "react";
import * as Diag from "react-native-dialog";

export default function Dialg(props: { show: boolean, onCancel: Function, onOk: Function, description: string, name: string, setName: Function}) {
    const Dialog = Diag.default, [val, setVal] = useState("")

    return (
        <Dialog.Container visible={props.show}>
            <Dialog.Description>{props.description}</Dialog.Description>
            <Dialog.Input value={props.name} onChangeText={text => props.setName(text)} />
            <Dialog.Button label="Cancelar" onPress={() => props.onCancel()}/>
            <Dialog.Button label="Ok" onPress={() => props.onOk()} />    
        </Dialog.Container>
    )
}