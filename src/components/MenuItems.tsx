import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { Menu } from "react-native-paper";
import { ContextType } from "./AppContextProvider";
import { cpmvPath, download, makeDir, makePathWithRoot, remove, rename, upload } from "../utils/FileUtils";
import AppDialog from "./Dialog";
import { useState } from "react";
import { noElements, showToast } from "../utils/UI_Utils";

type Navigation = DrawerNavigationProp<{ local: undefined; ftp: undefined }>;
type SetVisible = (visible: boolean) => void;
type MenuProps = { setVisible: SetVisible; context: ContextType };
type TransferMenuProps = MenuProps & { navigation: Navigation };
type CopyMoveMenuProps = MenuProps & { title: string; setTitle: (title: string) => void };

export const UploadMenu = (props: TransferMenuProps) => {
    const { navigation, setVisible, context } = props;
    const toUpload = context.modifyLocalFile;
    return (
        <Menu.Item
            title={"Subir"}
            onPress={async () => {
                if (toUpload.length < 1) {
                    return noElements(setVisible);
                }

                if (context.lastComponent === "local") {
                    navigation.navigate("ftp");
                    context.setLastComponent("ftp");
                    showToast("Elija directorio donde desea subir los archivos");
                } else {
                    await upload(toUpload, context.lastFtpDir, context);
                    context.setModifyLocalFile([]);
                    context.setDirSelected(!context.dirSelected);
                    context.setRefresh(!context.refresh);
                }

                setVisible(false);
            }}
        />
    );
};
export const DownloadMenu = (props: TransferMenuProps) => {
    const { navigation, setVisible, context } = props;
    const toDownload = context.modifyFtpFile;

    return (
        <Menu.Item
            title={"Descargar"}
            onPress={async () => {
                setVisible(false);
                if (toDownload.length < 1) {
                    return noElements(setVisible);
                }

                if (context.lastComponent === "ftp") {
                    navigation.navigate("local");
                    context.setLastComponent("local");
                    showToast("Elija directorio donde desea descargar los archivos");
                } else {
                    await download(toDownload, context.lastLocalDir, context);
                    context.setModifyFtpFile([]);
                    context.setDirSelected(!context.dirSelected);
                    context.setRefresh(!context.refresh);
                }
            }}
        />
    );
};
export const CopyMenu = (props: CopyMoveMenuProps) => {
    const { setVisible, title, setTitle, context } = props;

    return <Menu.Item title={title} onPress={async () => await cpmvPath(context, setVisible, title, setTitle, true)} />;
};
export const MoveMenu = (props: CopyMoveMenuProps) => {
    const { setVisible, title, setTitle, context } = props;

    return <Menu.Item title={title} onPress={async () => await cpmvPath(context, setVisible, title, setTitle)} />;
};
export const MakeDir = (props: MenuProps) => {
    const { setVisible, context } = props;
    const [show, setShow] = useState<boolean>(false);
    const [name, setName] = useState<string>("");

    return (
        <>
            <Menu.Item
                title="Crear carpeta"
                onPress={async () => {
                    if (context.modifyFtpFile.length > 0 || context.modifyLocalFile.length > 0) {
                        showToast("Acción no disponible");
                    }

                    setShow(true);
                }}
            />
            <AppDialog
                description="Escriba el nombre de la carpeta:"
                name={name}
                setName={setName}
                show={show}
                onCancel={() => {
                    setShow(false);
                    setVisible(false);
                    context.setDirSelected(!context.dirSelected);
                    context.setModifyLocalFile([]);
                }}
                onOk={async () => await makeDir(context, name, setVisible)}
            />
        </>
    );
};
export const RenameMenu = (props: MenuProps) => {
    const { setVisible, context } = props;
    const [show, setShow] = useState<boolean>(false);
    const [name, setName] = useState<string>("");
    const lastDir = makePathWithRoot(context.lastLocalDir);
    const toRename = context.modifyLocalFile;
    return (
        <>
            <Menu.Item
                title="Renombrar"
                onPress={async () => {
                    if (context.lastComponent === "ftp") {
                        return showToast("Función no disponible");
                    }

                    if (toRename.length < 1) {
                        return noElements(setVisible);
                    }

                    if (toRename.length > 1) {
                        setVisible(false);
                        return showToast("Solo se puede renombrar un elemento a la vez");
                    }

                    setName(toRename[0].path.split("/").pop() ?? "");
                    setShow(true);
                }}
            />
            <AppDialog
                description="Escriba el nuevo nombre:"
                name={name}
                setName={setName}
                show={show}
                onCancel={() => {
                    setVisible(false);
                    context.setDirSelected(!context.dirSelected);
                    context.setModifyLocalFile([]);
                }}
                onOk={async () => await rename(toRename, name, lastDir, context, setVisible)}
            />
        </>
    );
};
export const RemoveMenu = (props: MenuProps) => {
    const { setVisible, context } = props;
    const last = context.lastComponent;
    const toRemove = last === "local" ? context.modifyLocalFile : context.modifyFtpFile;
    return (
        <Menu.Item
            onPress={async () => {
                if (toRemove.length < 1) {
                    return noElements(setVisible);
                }

                await remove(toRemove, last, context, setVisible);
            }}
            title="Eliminar"
        />
    );
};
