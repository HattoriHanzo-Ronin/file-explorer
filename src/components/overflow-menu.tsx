import { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { Menu } from "react-native-paper";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useAppContext } from "./app-context-provider";
import { cpmvPath, download, makeDir, makePathWithRoot, remove, rename, upload } from "../utils/file-utils";
import AppDialog from "./dialog";
import { noElements, showToast } from "../utils/ui-utils";

import type { CopyMoveMenuProps, MenuProps, TransferMenuProps } from "../types/menu";
import type { DrawerNavigation } from "../types/navigation";

export const UploadMenu = (props: TransferMenuProps) => {
    const { navigation, setVisible } = props;
    const context = useAppContext();
    const {
        dirSelected,
        lastComponent,
        lastFtpDir,
        modifyLocalFile: toUpload,
        refresh,
        setDirSelected,
        setLastComponent,
        setModifyLocalFile,
        setRefresh
    } = context;

    return (
        <Menu.Item
            title={"Subir"}
            onPress={async () => {
                if (toUpload.length < 1) {
                    return noElements(setVisible);
                }

                if (lastComponent === "local") {
                    navigation.navigate("ftp");
                    setLastComponent("ftp");
                    showToast("Elija directorio donde desea subir los archivos");
                } else {
                    await upload(toUpload, lastFtpDir, context);
                    setModifyLocalFile([]);
                    setDirSelected(!dirSelected);
                    setRefresh(!refresh);
                }

                setVisible(false);
            }}
        />
    );
};
export const DownloadMenu = (props: TransferMenuProps) => {
    const { navigation, setVisible } = props;
    const context = useAppContext();
    const {
        dirSelected,
        lastComponent,
        lastLocalDir,
        modifyFtpFile: toDownload,
        refresh,
        setDirSelected,
        setLastComponent,
        setModifyFtpFile,
        setRefresh
    } = context;

    return (
        <Menu.Item
            title={"Descargar"}
            onPress={async () => {
                setVisible(false);
                if (toDownload.length < 1) {
                    return noElements(setVisible);
                }

                if (lastComponent === "ftp") {
                    navigation.navigate("local");
                    setLastComponent("local");
                    showToast("Elija directorio donde desea descargar los archivos");
                } else {
                    await download(toDownload, lastLocalDir, context);
                    setModifyFtpFile([]);
                    setDirSelected(!dirSelected);
                    setRefresh(!refresh);
                }
            }}
        />
    );
};
export const CopyMenu = (props: CopyMoveMenuProps) => {
    const { setVisible, title, setTitle } = props;
    const context = useAppContext();

    return <Menu.Item title={title} onPress={async () => await cpmvPath(context, setVisible, title, setTitle, true)} />;
};
export const MoveMenu = (props: CopyMoveMenuProps) => {
    const { setVisible, title, setTitle } = props;
    const context = useAppContext();

    return <Menu.Item title={title} onPress={async () => await cpmvPath(context, setVisible, title, setTitle)} />;
};
export const MakeDir = (props: MenuProps) => {
    const { setVisible } = props;
    const context = useAppContext();
    const { dirSelected, modifyFtpFile, modifyLocalFile, setDirSelected, setModifyLocalFile } = context;
    const [show, setShow] = useState<boolean>(false);
    const [name, setName] = useState<string>("");

    return (
        <>
            <Menu.Item
                title="Crear carpeta"
                onPress={async () => {
                    if (modifyFtpFile.length > 0 || modifyLocalFile.length > 0) {
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
                    setDirSelected(!dirSelected);
                    setModifyLocalFile([]);
                }}
                onOk={async () => await makeDir(context, name, setVisible)}
            />
        </>
    );
};
export const RenameMenu = (props: MenuProps) => {
    const { setVisible } = props;
    const context = useAppContext();
    const {
        dirSelected,
        lastComponent,
        lastLocalDir,
        modifyLocalFile: toRename,
        setDirSelected,
        setModifyLocalFile
    } = context;
    const [show, setShow] = useState<boolean>(false);
    const [name, setName] = useState<string>("");
    const lastDir = makePathWithRoot(lastLocalDir);
    return (
        <>
            <Menu.Item
                title="Renombrar"
                onPress={async () => {
                    if (lastComponent === "ftp") {
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
                    setDirSelected(!dirSelected);
                    setModifyLocalFile([]);
                }}
                onOk={async () => await rename(toRename, name, lastDir, context, setVisible)}
            />
        </>
    );
};
export const RemoveMenu = (props: MenuProps) => {
    const { setVisible } = props;
    const context = useAppContext();
    const { lastComponent: last, modifyFtpFile, modifyLocalFile } = context;
    const toRemove = last === "local" ? modifyLocalFile : modifyFtpFile;
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

export default function OverflowMenu() {
    const [visible, setVisible] = useState<boolean>(false);
    const [copyTitle, setCopyTitle] = useState<string>("Copiar");
    const [moveTitle, setMoveTitle] = useState<string>("Mover");
    const context = useAppContext();
    const { lastComponent, modifyFtpFile, modifyLocalFile, resetTitle, setOnCopy } = context;
    const navigation = useNavigation<DrawerNavigation>();

    useEffect(() => {
        if (copyTitle === "Pegar") {
            setCopyTitle("Copiar");
        }

        if (moveTitle === "Pegar") {
            setMoveTitle("Mover");
        }

        setOnCopy(false);
    }, [resetTitle]);

    return (
        <Menu
            visible={visible}
            onDismiss={() => setVisible(false)}
            anchor={<Ionicons name="ellipsis-vertical-outline" size={25} onPress={() => setVisible(true)} />}
        >
            {(lastComponent === "local" || modifyLocalFile.length > 0) && modifyFtpFile.length < 1 && (
                <UploadMenu navigation={navigation} setVisible={setVisible} />
            )}
            {(lastComponent === "ftp" || modifyFtpFile.length > 0) && modifyLocalFile.length < 1 && (
                <DownloadMenu navigation={navigation} setVisible={setVisible} />
            )}
            {lastComponent === "local" && (
                <>
                    <CopyMenu
                        setVisible={setVisible}
                        title={copyTitle}
                        setTitle={(title: string) => setCopyTitle(title)}
                    />
                    <MoveMenu
                        setVisible={setVisible}
                        title={moveTitle}
                        setTitle={(title: string) => setMoveTitle(title)}
                    />
                </>
            )}
            <MakeDir setVisible={setVisible} />
            <RenameMenu setVisible={setVisible} />
            <RemoveMenu setVisible={setVisible} />
        </Menu>
    );
}
