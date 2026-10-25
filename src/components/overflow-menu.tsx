import { useRef, useState } from "react";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAppContext } from "./app-context-provider";
import { useOperationContext } from "./operation-provider";
import AppDialog from "./dialog";
import CreateDirectoryDialog from "./create-directory-dialog";
import OperationDestinationModal from "./operation-destination-modal";
import UiUtils from "../utils/ui-utils";
import type { MenuItemProps, MenuProps, OverflowMenuProps } from "../types/menu";
import type { OperationAction, ValidationErrors } from "../types/ui";
import type { RenameEntryRequest } from "../types/ftp";
import type { DrawerNavigation } from "../types/navigation";
import type { ValidationErrorDetail } from "../types/response";
import { overflowMenu } from "../styles/components/style";
import { useTheme } from "./theme-provider";
import { FILE_OPERATION_COMPLETED_MESSAGES } from "../constants/file-operations";

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

    function handleRenameError(details: ValidationErrorDetail[] | undefined): boolean {
        const errors = UiUtils.mapValidationErrors<RenameEntryRequest>(details ?? []);
        if (Object.keys(errors).length === 0) {
            return false;
        }

        setValidationErrors(errors);
        setShow(true);
        return true;
    }

    async function renameRemote(): Promise<boolean> {
        const entry = ftpEntry.current;
        if (!entry) {
            return false;
        }

        const dir = ftpDir.current;
        const result = await executeApiRequest(
            (apiUtils) =>
                apiUtils.renameEntry({
                    dir,
                    entry: { name: entry.path, type: entry.type },
                    newName: name
                }),
            { isBackground: true }
        );
        if (!result.success) {
            return !handleRenameError(result.error.details);
        }

        setFtpDirectory((current) => (current.dir === dir ? { ...current, content: result.data } : current));
        return true;
    }

    async function renameLocal(): Promise<boolean> {
        const entry = localEntry.current;
        if (!entry) {
            return false;
        }

        const result = await executeLocalRequest((localFileManager) => localFileManager.rename(entry, name), {
            isBackground: true
        });
        if (!result.success) {
            return !handleRenameError(result.error.details);
        }

        UiUtils.applyLocalDirectoryUpdates(setLocalDirectory, result.data);
        UiUtils.showMessage(FILE_OPERATION_COMPLETED_MESSAGES.LOCAL_RENAME);
        return true;
    }

    async function rename() {
        if (submitting.current) {
            return;
        }

        if (!(storage === "ftp" ? ftpEntry.current : localEntry.current)) {
            setShow(false);
            onFinish();
            return;
        }

        submitting.current = true;
        setIsSubmitting(true);
        setShow(false);
        setVisible(false);

        try {
            const completed = storage === "ftp" ? await renameRemote() : await renameLocal();
            setModifyFtpFile([]);
            setModifyLocalFile([]);
            if (!completed) {
                return;
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
function getMenuVisibility(
    storage: "local" | "ftp",
    localSelectionCount: number,
    ftpSelectionCount: number,
    canShare: boolean
) {
    const hasLocalSelection = localSelectionCount > 0;
    const hasFtpSelection = ftpSelectionCount > 0;
    const hasSelection = hasLocalSelection || hasFtpSelection;
    const activeSelectionCount = storage === "local" ? localSelectionCount : ftpSelectionCount;
    return {
        showUpload: hasLocalSelection && !hasFtpSelection,
        showShare: storage === "local" && canShare,
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
    const { authUtils, executeApiRequest, executeLocalRequest, sharing } = useOperationContext();
    const {
        activeStorageRoot,
        ftpDirectory,
        isAuthenticated,
        localDirectory,
        modifyFtpFile,
        modifyLocalFile,
        setFtpDirectory,
        setLocalDirectory,
        setModifyFtpFile,
        setModifyLocalFile
    } = useAppContext();
    const { showCopy, showDownload, showMakeDir, showMove, showRemove, showRename, showShare, showUpload } =
        getMenuVisibility(
            storage,
            modifyLocalFile.length,
            modifyFtpFile.length,
            modifyLocalFile.length > 0 && modifyLocalFile.every(({ type }) => type === "file")
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

    async function shareFiles() {
        setVisible(false);
        try {
            await sharing.share(modifyLocalFile.map(({ path }) => path));
        } catch {
            UiUtils.showMessage("No se pudieron compartir los archivos");
        }
    }

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
            setFtpDirectory((current) => {
                if (current.dir !== remoteDir) {
                    return current;
                }

                return {
                    ...current,
                    content: current.content.filter(({ name }) => !result.data.some(({ path }) => path === name))
                };
            });
        }
    }

    function removeEntries() {
        if (storage === "ftp") {
            void removeRemoteEntries();
            setModifyFtpFile([]);
        } else {
            void removeLocalEntries();
            setModifyLocalFile([]);
        }

        setVisible(false);
    }

    function openDestination(action: OperationAction) {
        setVisible(false);
        setDestinationAction(action);
    }

    function openCreateDirectory() {
        setVisible(false);
        const id = ++dialogId.current;
        setMakeDirDialogs((current) => [...current, id]);
    }

    function openRename() {
        setVisible(false);
        const id = ++dialogId.current;
        setRenameDialogs((current) => [...current, id]);
    }

    const menuItems = [
        { visible: showShare, title: "Compartir", onPress: () => void shareFiles() },
        { visible: showUpload, title: "Subir", onPress: () => void openUploadDestination() },
        { visible: showDownload, title: "Descargar", onPress: () => openDestination("download") },
        { visible: showCopy, title: "Copiar", onPress: () => openDestination("copy") },
        { visible: showMove, title: "Mover", onPress: () => openDestination("move") },
        { visible: showMakeDir, title: "Crear carpeta", onPress: openCreateDirectory },
        { visible: showRename, title: "Renombrar", onPress: openRename },
        { visible: showRemove, title: "Eliminar", onPress: removeEntries }
    ];

    return (
        <>
            <Ionicons name="ellipsis-vertical-outline" color={theme.text} size={25} onPress={() => setVisible(true)} />
            <Modal animationType="fade" transparent visible={visible} onRequestClose={() => setVisible(false)}>
                <Pressable style={overflowMenu.backdrop} onPress={() => setVisible(false)}>
                    <View
                        style={[overflowMenu.container, { backgroundColor: theme.surface, borderColor: theme.border }]}
                        onStartShouldSetResponder={() => true}
                    >
                        {menuItems
                            .filter(({ visible: isVisible }) => isVisible)
                            .map(({ onPress, title }) => (
                                <MenuItem key={title} title={title} onPress={onPress} />
                            ))}
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
