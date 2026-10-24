import { useRef, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { useAppContext } from "../components/app-context-provider";
import { useOperationContext } from "../components/operation-provider";
import AppDialog from "../components/dialog";
import CreateDirectoryDialog from "../components/create-directory-dialog";
import UiUtils from "../utils/ui-utils";
import { cancelFileAction } from "../utils/navigation-utils";
import type {
    CopyMoveActionProps,
    CopyMoveMenuProps,
    MenuProps,
    OverflowMenuProps,
    TransferMenuProps
} from "../types/menu";
import type { DrawerNavigation } from "../types/navigation";
import type { FileActionMode, ValidationErrors } from "../types/ui";
import type { RenameEntryRequest } from "../types/ftp";
import { overflowMenu } from "../styles/components/style";
import { useTheme } from "../components/theme-provider";
import { FILE_OPERATION_COMPLETED_MESSAGES } from "../constants/file-operations";

interface MenuItemProps {
    title: string;
    onPress: () => void;
}

function MenuItem(props: MenuItemProps) {
    const { onPress, title } = props;
    const { theme } = useTheme();
    return (
        <Pressable style={overflowMenu.item} onPress={onPress}>
            <Text style={[overflowMenu.itemText, { color: theme.text }]}>{title}</Text>
        </Pressable>
    );
}

export const UploadMenu = (props: TransferMenuProps) => {
    const { navigation, setVisible } = props;
    const context = useAppContext();
    const {
        fileAction,
        ftpDirectory,
        modifyLocalFile: toUpload,
        setDirSelected,
        setFileAction,
        setFtpDirectory
    } = context;
    const { executeApiRequest } = useOperationContext();

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
        <MenuItem
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
        fileAction,
        ftpDirectory,
        localDirectory,
        modifyFtpFile: toDownload,
        setDirSelected,
        setFileAction,
        setLocalDirectory
    } = context;
    const { executeApiRequest, executeLocalRequest } = useOperationContext();

    async function download(remoteDir: string, localDir: string) {
        const result = await executeApiRequest(
            (apiUtils) => apiUtils.download([...toDownload], remoteDir, activeStorageRoot.path, localDir),
            {
                isBackground: true,
                showError: true
            }
        );
        if (result.success) {
            const destination = localDir === " " ? activeStorageRoot.path : `${activeStorageRoot.path}/${localDir}`;
            const updates = await executeLocalRequest((manager) => manager.getDirectoryUpdates([destination]), {
                isBackground: true
            });
            if (updates.success) {
                UiUtils.applyLocalDirectoryUpdates(setLocalDirectory, updates.data);
            }
        }
    }

    return (
        <MenuItem
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
        fileAction,
        ftpDirectory,
        ftpSelectionDir,
        localDirectory,
        modifyFtpFile,
        modifyLocalFile,
        setDirSelected,
        setFileAction,
        setFtpDirectory,
        setLocalDirectory
    } = context;
    const { executeApiRequest, executeLocalRequest } = useOperationContext();
    const action = copy ? "copy" : "move";

    async function copyMoveLocal() {
        const destination =
            localDirectory.dir === " " ? activeStorageRoot.path : `${activeStorageRoot.path}/${localDirectory.dir}`;
        const result = await executeLocalRequest(
            (localFileManager) =>
                copy
                    ? localFileManager.copy(modifyLocalFile, destination)
                    : localFileManager.move(modifyLocalFile, destination),
            { isBackground: true, showError: true }
        );
        if (result.success) {
            UiUtils.applyLocalDirectoryUpdates(setLocalDirectory, result.data);
        }
    }

    async function moveRemote() {
        const destination = ftpDirectory.dir;
        const entries = modifyFtpFile.map(({ path, type }) => ({ name: path, type }));
        const result = await executeApiRequest(
            (apiUtils) => apiUtils.moveEntries({ dir: ftpSelectionDir, entries, destination }),
            { isBackground: true, showError: true }
        );
        if (result.success) {
            setFtpDirectory((current) => {
                let content = current.content;
                if (current.dir === ftpSelectionDir) {
                    content = content.filter(({ name }) => !result.data.some(({ path }) => path === name));
                }

                if (current.dir === destination) {
                    const moved = result.data.map(({ path, targetPath, type }) => ({
                        name: targetPath ?? path,
                        type
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

    return <MenuItem title={fileAction === action ? "Pegar" : copy ? "Copiar" : "Mover"} onPress={handlePress} />;
};
export const RenameMenu = (props: MenuProps & { onFinish: () => void }) => {
    const { onFinish, setVisible, storage } = props;
    const { theme } = useTheme();
    const {
        ftpDirectory,
        modifyFtpFile,
        modifyLocalFile: toRename,
        setDirSelected,
        setFtpDirectory,
        setLocalDirectory,
        setModifyFtpFile,
        setModifyLocalFile
    } = useAppContext();
    const { executeApiRequest, executeLocalRequest } = useOperationContext();
    const [show, setShow] = useState<boolean>(true);
    const [name, setName] = useState<string>(
        () => (storage === "ftp" ? modifyFtpFile[0] : toRename[0])?.path.split("/").pop() ?? ""
    );
    const [validationErrors, setValidationErrors] = useState<ValidationErrors<RenameEntryRequest>>({});
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const submitting = useRef<boolean>(false);
    const ftpEntry = useRef(storage === "ftp" ? modifyFtpFile[0] : undefined);
    const localEntry = useRef(storage !== "ftp" ? toRename[0] : undefined);
    const ftpDir = useRef<string>(ftpDirectory.dir);

    async function rename() {
        if (submitting.current) {
            return;
        }

        const entry = storage === "ftp" ? ftpEntry.current : localEntry.current;
        if (!entry) {
            setShow(false);
            onFinish();
            return;
        }

        submitting.current = true;
        setIsSubmitting(true);
        setShow(false);
        setVisible(false);

        try {
            if (storage === "ftp" && ftpEntry.current) {
                const selectedEntry = ftpEntry.current;
                const dir = ftpDir.current;
                const request = executeApiRequest(
                    (apiUtils) =>
                        apiUtils.renameEntry({
                            dir,
                            entry: { name: selectedEntry.path, type: selectedEntry.type },
                            newName: name
                        }),
                    { isBackground: true }
                );
                setDirSelected(false);
                setModifyFtpFile([]);
                setModifyLocalFile([]);
                const result = await request;
                if (!result.success) {
                    const errors = UiUtils.mapValidationErrors<RenameEntryRequest>(result.error.details ?? []);
                    if (Object.keys(errors).length > 0) {
                        setValidationErrors(errors);
                        setShow(true);
                    } else {
                        onFinish();
                    }

                    return;
                }

                setFtpDirectory((current) => (current.dir === dir ? { ...current, content: result.data } : current));
            } else if (localEntry.current) {
                const selectedEntry = localEntry.current;
                const request = executeLocalRequest(
                    (localFileManager) => localFileManager.rename(selectedEntry, name),
                    {
                        isBackground: true
                    }
                );
                setDirSelected(false);
                setModifyFtpFile([]);
                setModifyLocalFile([]);
                const result = await request;
                if (result.success) {
                    UiUtils.applyLocalDirectoryUpdates(setLocalDirectory, result.data);
                    UiUtils.showMessage(FILE_OPERATION_COMPLETED_MESSAGES.LOCAL_RENAME);
                } else {
                    const errors = UiUtils.mapValidationErrors<RenameEntryRequest>(result.error.details ?? []);
                    if (Object.keys(errors).length > 0) {
                        setValidationErrors(errors);
                        setShow(true);
                        return;
                    }
                }
            }

            setName("");
            onFinish();
        } finally {
            submitting.current = false;
            setIsSubmitting(false);
        }
    }

    return (
        <>
            <AppDialog
                title="Nuevo nombre"
                visible={show}
                acceptDisabled={isSubmitting}
                onCancel={() => {
                    setName("");
                    setValidationErrors({});
                    setShow(false);
                    setVisible(false);
                    setDirSelected(false);
                    setModifyFtpFile([]);
                    setModifyLocalFile([]);
                    onFinish();
                }}
                onAccept={() => void rename()}
            >
                <TextInput
                    autoFocus
                    editable={!isSubmitting}
                    returnKeyType="done"
                    style={[overflowMenu.input, { borderBottomColor: theme.border, color: theme.text }]}
                    value={name}
                    onSubmitEditing={() => void rename()}
                    onChangeText={(value) => {
                        setName(value);
                        setValidationErrors({});
                    }}
                />
                {validationErrors.newName?.map((message) => (
                    <Text key={message} style={[overflowMenu.validationError, { color: theme.danger }]}>
                        {message}
                    </Text>
                ))}
            </AppDialog>
        </>
    );
};
export const RemoveMenu = (props: MenuProps) => {
    const { setVisible, storage } = props;
    const {
        ftpDirectory,
        modifyFtpFile,
        modifyLocalFile,
        setFtpDirectory,
        setLocalDirectory,
        setModifyFtpFile,
        setModifyLocalFile
    } = useAppContext();
    const { executeApiRequest, executeLocalRequest } = useOperationContext();

    async function removeLocalEntries() {
        const result = await executeLocalRequest((localFileManager) => localFileManager.delete(modifyLocalFile), {
            isBackground: true,
            showError: true
        });
        if (result.success) {
            UiUtils.applyLocalDirectoryUpdates(setLocalDirectory, result.data);
        }
    }

    async function removeRemoteEntries() {
        const remoteDir = ftpDirectory.dir;
        const entries = modifyFtpFile.map(({ path, type }) => ({ name: path, type }));
        const result = await executeApiRequest((apiUtils) => apiUtils.deleteEntries({ dir: remoteDir, entries }), {
            isBackground: true,
            showError: true
        });
        if (result.success) {
            setFtpDirectory((current) =>
                current.dir === remoteDir
                    ? {
                          ...current,
                          content: current.content.filter(({ name }) => !result.data.some(({ path }) => path === name))
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

    return <MenuItem onPress={removeEntries} title="Eliminar" />;
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
    const [makeDirDialogs, setMakeDirDialogs] = useState<number[]>([]);
    const [renameDialogs, setRenameDialogs] = useState<number[]>([]);
    const dialogId = useRef<number>(0);
    const { theme } = useTheme();
    const context = useAppContext();
    const {
        activeStorageRoot,
        dirSelected,
        fileAction,
        ftpDirectory,
        localDirectory,
        modifyFtpFile,
        modifyLocalFile,
        setDirSelected,
        setFtpDirectory,
        setLocalDirectory,
        setModifyLocalFile
    } = context;
    const navigation = useNavigation<DrawerNavigation>();
    const { showCopy, showDownload, showMakeDir, showMove, showRemove, showRename, showUpload } = getMenuVisibility(
        storage,
        modifyLocalFile.length,
        modifyFtpFile.length,
        fileAction
    );

    function handleCancelFileAction() {
        cancelFileAction(context, navigation);
        setVisible(false);
    }

    return (
        <>
            <Ionicons name="ellipsis-vertical-outline" color={theme.text} size={25} onPress={() => setVisible(true)} />
            <Modal animationType="fade" transparent visible={visible} onRequestClose={() => setVisible(false)}>
                <Pressable style={overflowMenu.backdrop} onPress={() => setVisible(false)}>
                    <View
                        style={[overflowMenu.container, { backgroundColor: theme.surface, borderColor: theme.border }]}
                        onStartShouldSetResponder={() => true}
                    >
                        {showUpload && <UploadMenu navigation={navigation} setVisible={setVisible} storage={storage} />}
                        {showDownload && (
                            <DownloadMenu navigation={navigation} setVisible={setVisible} storage={storage} />
                        )}
                        {showCopy && <CopyMenu setVisible={setVisible} storage={storage} />}
                        {showMove && <MoveMenu setVisible={setVisible} storage={storage} />}
                        {showMakeDir && (
                            <MenuItem
                                title="Crear carpeta"
                                onPress={() => {
                                    setVisible(false);
                                    const id = ++dialogId.current;
                                    setMakeDirDialogs((current) => [...current, id]);
                                }}
                            />
                        )}
                        {showRename && (
                            <MenuItem
                                title="Renombrar"
                                onPress={() => {
                                    setVisible(false);
                                    const id = ++dialogId.current;
                                    setRenameDialogs((current) => [...current, id]);
                                }}
                            />
                        )}
                        {showRemove && <RemoveMenu setVisible={setVisible} storage={storage} />}
                        {fileAction && <MenuItem title="Cancelar" onPress={handleCancelFileAction} />}
                    </View>
                </Pressable>
            </Modal>
            {makeDirDialogs.map((id) =>
                storage === "ftp" ? (
                    <CreateDirectoryDialog
                        key={id}
                        visible
                        storage="ftp"
                        rootPath={activeStorageRoot.path}
                        dir={ftpDirectory.dir}
                        onClose={(cancelled) => {
                            if (cancelled) {
                                setDirSelected(!dirSelected);
                                setModifyLocalFile([]);
                            }

                            setMakeDirDialogs((current) => current.filter((value) => value !== id));
                        }}
                        onCreated={(content) => {
                            setFtpDirectory((current) =>
                                current.dir === ftpDirectory.dir ? { ...current, content } : current
                            );
                        }}
                    />
                ) : (
                    <CreateDirectoryDialog
                        key={id}
                        visible
                        storage="local"
                        rootPath={activeStorageRoot.path}
                        dir={localDirectory.dir}
                        onClose={(cancelled) => {
                            if (cancelled) {
                                setDirSelected(!dirSelected);
                                setModifyLocalFile([]);
                            }

                            setMakeDirDialogs((current) => current.filter((value) => value !== id));
                        }}
                        onCreated={(updates) => UiUtils.applyLocalDirectoryUpdates(setLocalDirectory, updates)}
                    />
                )
            )}
            {renameDialogs.map((id) => (
                <RenameMenu
                    key={id}
                    setVisible={setVisible}
                    storage={storage}
                    onFinish={() => setRenameDialogs((current) => current.filter((value) => value !== id))}
                />
            ))}
        </>
    );
}
