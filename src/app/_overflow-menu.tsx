import { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { Menu } from "react-native-paper";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useAppContext } from "../components/app-context-provider";
import AppDialog from "../components/dialog";
import UiUtils from "../utils/ui-utils";
import type {
    CopyMoveActionProps,
    CopyMoveMenuProps,
    MenuProps,
    OverflowMenuProps,
    TransferMenuProps
} from "../types/menu";
import type { DrawerNavigation } from "../types/navigation";
import type { FileActionMode } from "../types/ui";

export const UploadMenu = (props: TransferMenuProps) => {
    const { navigation, setVisible } = props;
    const context = useAppContext();
    const {
        executeApiRequest,
        fileAction,
        ftpDirectory,
        modifyLocalFile: toUpload,
        setDirSelected,
        setFileAction,
        setFtpDirectory
    } = context;

    async function upload(remoteDir: string) {
        const result = await executeApiRequest((apiUtils) => apiUtils.upload([...toUpload], remoteDir), {
            isBackground: true,
            showError: true
        });
        if (result.success) {
            setFtpDirectory((current) => {
                const currentDir = current.dir === " " ? "" : current.dir;
                return currentDir === (remoteDir === " " ? "" : remoteDir)
                    ? { ...current, content: result.data.entries }
                    : current;
            });
        }
    }

    return (
        <Menu.Item
            title="Subir"
            onPress={() => {
                if (fileAction !== "upload") {
                    setFileAction("upload");
                    setDirSelected((current) => !current);
                    setFtpDirectory((current) => ({ ...current, dir: " " }));
                    navigation.navigate("ftp", { screen: "login" });
                    UiUtils.showMessage("Elija directorio donde desea subir los archivos");
                } else {
                    const remoteDir = ftpDirectory.dir;
                    void upload(remoteDir);
                    UiUtils.completeFileAction(context);
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
        activeStorageRoot,
        executeApiRequest,
        fileAction,
        ftpDirectory,
        localDirectory,
        modifyFtpFile: toDownload,
        setDirSelected,
        setFileAction
    } = context;

    async function download(remoteDir: string, localDir: string) {
        const result = await executeApiRequest(
            (apiUtils) => apiUtils.download([...toDownload], remoteDir, activeStorageRoot.path, localDir),
            {
                isBackground: true,
                showError: true
            }
        );
        if (result.success) {
            UiUtils.showMessage("Descarga finalizada");
        }
    }

    return (
        <Menu.Item
            title="Descargar"
            onPress={() => {
                setVisible(false);
                if (fileAction !== "download") {
                    setFileAction("download");
                    setDirSelected((current) => !current);
                    navigation.navigate("local");
                    UiUtils.showMessage("Elija directorio donde desea descargar los archivos");
                } else {
                    void download(ftpDirectory.dir, localDirectory.dir);
                    UiUtils.completeFileAction(context);
                }
            }}
        />
    );
};
export const CopyMenu = (props: CopyMoveMenuProps) => <CopyMoveAction {...props} copy />;
export const MoveMenu = (props: CopyMoveMenuProps) => <CopyMoveAction {...props} copy={false} />;

const CopyMoveAction = (props: CopyMoveActionProps) => {
    const { copy, setVisible } = props;
    const context = useAppContext();
    const {
        activeStorageRoot,
        executeApiRequest,
        executeLocalRequest,
        fileAction,
        ftpDirectory,
        ftpSelectionDir,
        localDirectory,
        modifyFtpFile,
        modifyLocalFile,
        setDirSelected,
        setFileAction,
        setFtpDirectory
    } = context;
    const action = copy ? "copy" : "move";

    async function copyMoveLocal() {
        const destination =
            localDirectory.dir === " " ? activeStorageRoot.path : `${activeStorageRoot.path}/${localDirectory.dir}`;
        await executeLocalRequest(
            (localFileManager) =>
                copy
                    ? localFileManager.copy(modifyLocalFile, destination)
                    : localFileManager.move(modifyLocalFile, destination),
            { isBackground: true, showError: true }
        );
    }

    async function moveRemote() {
        const destination = ftpDirectory.dir;
        if (ftpSelectionDir === destination) {
            UiUtils.showMessage("El directorio de origen y destino es el mismo");
            return;
        }

        const entries = modifyFtpFile.map((item) => ({ name: item.path, type: item.type }));
        const result = await executeApiRequest(
            (apiUtils) => apiUtils.moveEntries({ dir: ftpSelectionDir, entries, destination }),
            { isBackground: true, showError: true }
        );
        if (result.success) {
            setFtpDirectory((current) => {
                let content = current.content;
                if (current.dir === ftpSelectionDir) {
                    content = content.filter((entry) => !result.data.some((change) => change.path === entry.name));
                }

                if (current.dir === destination) {
                    const moved = result.data.map((change) => ({
                        name: change.targetPath ?? change.path,
                        type: change.type
                    }));
                    content = [...content, ...moved];
                }

                return { ...current, content };
            });
        }
    }

    function handlePress() {
        if (fileAction !== action) {
            UiUtils.showMessage(`Elija el directorio donde ${copy ? "copiar" : "mover"}`);
            setVisible(false);
            setFileAction(action);
            setDirSelected((current) => !current);
            return;
        }

        if (modifyFtpFile.length > 0) {
            void moveRemote();
        } else {
            void copyMoveLocal();
        }

        setVisible(false);
        UiUtils.completeFileAction(context);
    }

    return <Menu.Item title={fileAction === action ? "Pegar" : copy ? "Copiar" : "Mover"} onPress={handlePress} />;
};
export const MakeDir = (props: MenuProps) => {
    const { setVisible, storage } = props;
    const {
        dirSelected,
        activeStorageRoot,
        executeApiRequest,
        executeLocalRequest,
        ftpDirectory,
        localDirectory,
        setDirSelected,
        setFtpDirectory,
        setModifyLocalFile
    } = useAppContext();
    const [show, setShow] = useState<boolean>(false);
    const [name, setName] = useState<string>("");

    async function createDirectory() {
        if (storage === "ftp") {
            const result = await executeApiRequest((apiUtils) =>
                apiUtils.createDirectory({ name, dir: ftpDirectory.dir })
            );
            if (result.success) {
                setFtpDirectory((current) =>
                    current.dir === ftpDirectory.dir ? { ...current, content: result.data } : current
                );
            }
        } else {
            await executeLocalRequest((localFileManager) =>
                localFileManager.createDirectory(activeStorageRoot.path, localDirectory.dir, name)
            );
        }

        setShow(false);
        setVisible(false);
    }

    return (
        <>
            <Menu.Item
                title="Crear carpeta"
                onPress={() => {
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
                onOk={createDirectory}
            />
        </>
    );
};
export const RenameMenu = (props: MenuProps) => {
    const { setVisible, storage } = props;
    const {
        executeApiRequest,
        executeLocalRequest,
        ftpDirectory,
        modifyFtpFile,
        modifyLocalFile: toRename,
        setDirSelected,
        setFtpDirectory,
        setModifyFtpFile,
        setModifyLocalFile
    } = useAppContext();
    const [show, setShow] = useState<boolean>(false);
    const [name, setName] = useState<string>("");
    return (
        <>
            <Menu.Item
                title="Renombrar"
                onPress={() => {
                    const selected = storage === "ftp" ? modifyFtpFile : toRename;
                    setName(selected[0].path.split("/").pop() ?? "");
                    setShow(true);
                }}
            />
            <AppDialog
                description="Escriba el nuevo nombre:"
                name={name}
                setName={setName}
                show={show}
                onCancel={() => {
                    setShow(false);
                    setVisible(false);
                    setDirSelected((current) => !current);
                    setModifyFtpFile([]);
                    setModifyLocalFile([]);
                }}
                onOk={async () => {
                    if (storage === "ftp") {
                        const entry = modifyFtpFile[0];
                        const result = await executeApiRequest((apiUtils) =>
                            apiUtils.renameEntry({
                                dir: ftpDirectory.dir,
                                entry: { name: entry.path, type: entry.type },
                                newName: name
                            })
                        );
                        if (result.success) {
                            setFtpDirectory((current) =>
                                current.dir === ftpDirectory.dir ? { ...current, content: result.data } : current
                            );
                        }
                    } else {
                        await executeLocalRequest((localFileManager) => localFileManager.rename(toRename[0], name));
                    }

                    setShow(false);
                    setVisible(false);
                    setDirSelected((current) => !current);
                    setModifyFtpFile([]);
                    setModifyLocalFile([]);
                }}
            />
        </>
    );
};
export const RemoveMenu = (props: MenuProps) => {
    const { setVisible, storage } = props;
    const {
        executeApiRequest,
        executeLocalRequest,
        ftpDirectory,
        modifyFtpFile,
        modifyLocalFile,
        setFtpDirectory,
        setModifyFtpFile,
        setModifyLocalFile
    } = useAppContext();

    async function removeLocalEntries() {
        await executeLocalRequest((localFileManager) => localFileManager.delete(modifyLocalFile), {
            isBackground: true,
            showError: true
        });
    }

    async function removeRemoteEntries() {
        const remoteDir = ftpDirectory.dir;
        const entries = modifyFtpFile.map((item) => ({ name: item.path, type: item.type }));
        const result = await executeApiRequest((apiUtils) => apiUtils.deleteEntries({ dir: remoteDir, entries }), {
            isBackground: true,
            showError: true
        });
        if (result.success) {
            setFtpDirectory((current) =>
                current.dir === remoteDir
                    ? {
                          ...current,
                          content: current.content.filter(
                              (entry) => !result.data.some((change) => change.path === entry.name)
                          )
                      }
                    : current
            );
        }
    }

    async function removeEntries() {
        if (storage === "ftp") {
            void removeRemoteEntries();
            setModifyFtpFile([]);
        } else {
            void removeLocalEntries();
            setModifyLocalFile([]);
        }

        setVisible(false);
    }

    return <Menu.Item onPress={removeEntries} title="Eliminar" />;
};

function getMenuVisibility(
    storage: "local" | "ftp",
    localSelectionCount: number,
    ftpSelectionCount: number,
    fileAction: FileActionMode
) {
    if (fileAction) {
        return getActiveMenuVisibility(storage, ftpSelectionCount, fileAction);
    }

    return getDefaultMenuVisibility(storage, localSelectionCount, ftpSelectionCount);
}

function getActiveMenuVisibility(
    storage: "local" | "ftp",
    ftpSelectionCount: number,
    fileAction: Exclude<FileActionMode, null>
) {
    const visibility = {
        showUpload: false,
        showDownload: false,
        showCopy: false,
        showMove: false,
        showMakeDir: false,
        showRename: false,
        showRemove: false
    };
    if (fileAction === "upload") {
        return { ...visibility, showUpload: storage === "ftp" };
    }

    if (fileAction === "download") {
        return { ...visibility, showDownload: storage === "local" };
    }

    if (fileAction === "copy") {
        return { ...visibility, showCopy: storage === "local" };
    }

    const destination = ftpSelectionCount > 0 ? "ftp" : "local";
    return { ...visibility, showMove: storage === destination };
}

function getDefaultMenuVisibility(storage: "local" | "ftp", localSelectionCount: number, ftpSelectionCount: number) {
    const hasLocalSelection = localSelectionCount > 0;
    const hasFtpSelection = ftpSelectionCount > 0;
    const hasSelection = hasLocalSelection || hasFtpSelection;
    const activeSelectionCount = storage === "local" ? localSelectionCount : ftpSelectionCount;
    return {
        showUpload: hasLocalSelection && !hasFtpSelection,
        showDownload: hasFtpSelection && !hasLocalSelection,
        showCopy: storage === "local" && hasLocalSelection,
        showMove: activeSelectionCount > 0,
        showMakeDir: !hasSelection,
        showRename: activeSelectionCount === 1,
        showRemove: activeSelectionCount > 0
    };
}

export default function OverflowMenu(props: OverflowMenuProps) {
    const { storage } = props;
    const [visible, setVisible] = useState<boolean>(false);
    const { fileAction, modifyFtpFile, modifyLocalFile } = useAppContext();
    const navigation = useNavigation<DrawerNavigation>();
    const { showCopy, showDownload, showMakeDir, showMove, showRemove, showRename, showUpload } = getMenuVisibility(
        storage,
        modifyLocalFile.length,
        modifyFtpFile.length,
        fileAction
    );

    return (
        <Menu
            visible={visible}
            onDismiss={() => setVisible(false)}
            anchor={<Ionicons name="ellipsis-vertical-outline" size={25} onPress={() => setVisible(true)} />}
        >
            {showUpload && <UploadMenu navigation={navigation} setVisible={setVisible} storage={storage} />}
            {showDownload && <DownloadMenu navigation={navigation} setVisible={setVisible} storage={storage} />}
            {showCopy && <CopyMenu setVisible={setVisible} storage={storage} />}
            {showMove && <MoveMenu setVisible={setVisible} storage={storage} />}
            {showMakeDir && <MakeDir setVisible={setVisible} storage={storage} />}
            {showRename && <RenameMenu setVisible={setVisible} storage={storage} />}
            {showRemove && <RemoveMenu setVisible={setVisible} storage={storage} />}
        </Menu>
    );
}
