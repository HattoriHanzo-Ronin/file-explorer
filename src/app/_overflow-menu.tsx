import { useRef, useState } from "react";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAppContext } from "../components/app-context-provider";
import { useOperationContext } from "../components/operation-provider";
import AppDialog from "../components/dialog";
import CreateDirectoryDialog from "../components/create-directory-dialog";
import OperationDestinationModal from "../components/operation-destination-modal";
import UiUtils from "../utils/ui-utils";
import type { MenuProps, OverflowMenuProps } from "../types/menu";
import type { OperationAction, ValidationErrors } from "../types/ui";
import type { RenameEntryRequest } from "../types/ftp";
import type { DrawerNavigation } from "../types/navigation";
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

export const RenameMenu = (props: MenuProps & { onFinish: () => void }) => {
    const { onFinish, setVisible, storage } = props;
    const { theme } = useTheme();
    const {
        ftpDirectory,
        modifyFtpFile,
        modifyLocalFile: toRename,
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

function getMenuVisibility(storage: "local" | "ftp", localSelectionCount: number, ftpSelectionCount: number) {
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
    const [destinationAction, setDestinationAction] = useState<OperationAction | null>(null);
    const dialogId = useRef<number>(0);
    const { theme } = useTheme();
    const navigation = useNavigation<DrawerNavigation>();
    const { authUtils } = useOperationContext();
    const context = useAppContext();
    const {
        activeStorageRoot,
        ftpDirectory,
        isAuthenticated,
        localDirectory,
        modifyFtpFile,
        modifyLocalFile,
        setFtpDirectory,
        setLocalDirectory,
        setModifyLocalFile
    } = context;
    const { showCopy, showDownload, showMakeDir, showMove, showRemove, showRename, showUpload } = getMenuVisibility(
        storage,
        modifyLocalFile.length,
        modifyFtpFile.length
    );

    async function openUploadDestination() {
        setVisible(false);
        if (!isAuthenticated && !(await authUtils.restoreSession())) {
            UiUtils.showMessage("Debe iniciar sesión para subir archivos");
            navigation.navigate("ftp", { screen: "login" });
            return;
        }

        setDestinationAction("upload");
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
                        {showUpload && <MenuItem title="Subir" onPress={() => void openUploadDestination()} />}
                        {showDownload && (
                            <MenuItem
                                title="Descargar"
                                onPress={() => {
                                    setVisible(false);
                                    setDestinationAction("download");
                                }}
                            />
                        )}
                        {showCopy && (
                            <MenuItem
                                title="Copiar"
                                onPress={() => {
                                    setVisible(false);
                                    setDestinationAction("copy");
                                }}
                            />
                        )}
                        {showMove && (
                            <MenuItem
                                title="Mover"
                                onPress={() => {
                                    setVisible(false);
                                    setDestinationAction("move");
                                }}
                            />
                        )}
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
                    </View>
                </Pressable>
            </Modal>
            {destinationAction && (
                <OperationDestinationModal
                    visible
                    action={destinationAction}
                    onClose={() => setDestinationAction(null)}
                />
            )}
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
