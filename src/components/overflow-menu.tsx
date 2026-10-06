import { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { Menu } from "react-native-paper";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useAppContext } from "./app-context-provider";
import { cpmvPath, makeDir, makePathWithRoot, remove, rename } from "../utils/file-utils";
import AppDialog from "./dialog";
import UiUtils from "../utils/ui-utils";

import type { CopyMoveMenuProps, MenuProps, TransferMenuProps } from "../types/menu";
import type { DrawerNavigation } from "../types/navigation";

export const UploadMenu = (props: TransferMenuProps) => {
    const { navigation, setVisible } = props;
    const context = useAppContext();
    const {
        dirSelected,
        lastFtpDir,
        modifyLocalFile: toUpload,
        setDirSelected,
        setLastComponent,
        setLastFtpDir,
        setLastLocalDir,
        setModifyLocalFile,
        transferManager
    } = context;

    return (
        <Menu.Item
            title={"Subir"}
            onPress={async () => {
                if (toUpload.length < 1) {
                    return UiUtils.noElements(setVisible);
                }

                if (getCurrentDrawerRoute(navigation) === "local") {
                    setLastFtpDir(" ");
                    navigation.navigate("ftp", { screen: "login" });
                    setLastComponent("ftp");
                    UiUtils.showMessage("Elija directorio donde desea subir los archivos");
                } else {
                    await transferManager.upload(toUpload, lastFtpDir);
                    setLastLocalDir(" ");
                    setModifyLocalFile([]);
                    setDirSelected(!dirSelected);
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
        lastFtpDir,
        lastLocalDir,
        modifyFtpFile: toDownload,
        setDirSelected,
        setLastComponent,
        setLastFtpDir,
        setLastLocalDir,
        setModifyFtpFile,
        transferManager
    } = context;

    return (
        <Menu.Item
            title={"Descargar"}
            onPress={async () => {
                setVisible(false);
                if (toDownload.length < 1) {
                    return UiUtils.noElements(setVisible);
                }

                if (getCurrentDrawerRoute(navigation) === "ftp") {
                    setLastLocalDir(" ");
                    navigation.navigate("local");
                    setLastComponent("local");
                    UiUtils.showMessage("Elija directorio donde desea descargar los archivos");
                } else {
                    await transferManager.download(toDownload, lastFtpDir, lastLocalDir);
                    setLastFtpDir(" ");
                    setModifyFtpFile([]);
                    setDirSelected(!dirSelected);
                }
            }}
        />
    );
};

function getCurrentDrawerRoute(navigation: DrawerNavigation): "local" | "ftp" {
    const state = navigation.getState();
    return state.routes[state.index].name as "local" | "ftp";
}
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
                        UiUtils.showMessage("Acción no disponible");
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
                        return UiUtils.showMessage("Función no disponible");
                    }

                    if (toRename.length < 1) {
                        return UiUtils.noElements(setVisible);
                    }

                    if (toRename.length > 1) {
                        setVisible(false);
                        return UiUtils.showMessage("Solo se puede renombrar un elemento a la vez");
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
                    return UiUtils.noElements(setVisible);
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
