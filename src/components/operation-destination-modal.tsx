import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useAppContext } from "./app-context-provider";
import { useOperationContext } from "./operation-provider";
import { useTheme } from "./theme-provider";
import type { DestinationOperationModalProps } from "../types/components";
import type { FileSystemEntry, LocalDirectoryUpdate, StorageRoot } from "../types/files";
import type { FtpEntry } from "../types/ftp";
import { operationDestination } from "../styles/components/style";
import UiUtils from "../utils/ui-utils";
import Breadcrumb from "./breadcrumb";
import CreateDirectoryDialog from "./create-directory-dialog";

export default function OperationDestinationModal(props: DestinationOperationModalProps) {
    const { acceptDisabled = false, acceptText, action, onCancel, onClose, onOperationFinished, selectedCount, visible } = props;
    const {
        externalRoots,
        ftpSelectionDir,
        internalRoot,
        modifyFtpFile,
        modifyLocalFile,
        setFtpDirectory,
        setLocalDirectory,
        setModifyFtpFile,
        setModifyLocalFile
    } = useAppContext();
    const { executeApiRequest, executeLocalRequest } = useOperationContext();
    const { theme } = useTheme();
    const isRemoteDestination = action === "upload" || (action === "move" && modifyFtpFile.length > 0);
    const [root, setRoot] = useState<StorageRoot>(() => internalRoot);
    const [dir, setDir] = useState<string>(" ");
    const [entries, setEntries] = useState<FtpEntry[] | FileSystemEntry[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [showRoots, setShowRoots] = useState<boolean>(false);
    const [showCreateDirectory, setShowCreateDirectory] = useState<boolean>(false);
    const isNavigating = useRef<boolean>(false);

    const loadDirectory = useCallback(async () => {
        setIsLoading(true);
        try {
            if (isRemoteDestination) {
                const result = await executeApiRequest((apiUtils) => apiUtils.getDirectory(dir), {
                    isBackground: true
                });
                if (result.success) {
                    setEntries(result.data);
                }

                return;
            }

            const result = await executeLocalRequest((localFileManager) => localFileManager.dir(root.path, dir), {
                isBackground: true
            });
            if (result.success) {
                setEntries(result.data.entries);
            }
        } finally {
            setIsLoading(false);
            isNavigating.current = false;
        }
    }, [dir, executeApiRequest, executeLocalRequest, isRemoteDestination, root.path]);

    useEffect(() => {
        if (visible) {
            void loadDirectory();
        }
    }, [loadDirectory, visible]);

    function selectRoot(nextRoot: StorageRoot) {
        if (isNavigating.current) {
            return;
        }

        isNavigating.current = true;
        setRoot(nextRoot);
        setDir(" ");
        setShowRoots(false);
    }

    function navigateTo(nextDir: string) {
        if (isNavigating.current) {
            return;
        }

        isNavigating.current = true;
        setDir(nextDir);
    }

    function openDirectory(name: string) {
        if (isNavigating.current) {
            return;
        }

        isNavigating.current = true;
        setDir((current) => (current === " " ? name : `${current}/${name}`));
    }

    function navigateToParent() {
        if (isNavigating.current) {
            return;
        }

        isNavigating.current = true;
        setDir((current) => {
            const paths = current.split("/").slice(0, -1);
            return paths.length > 0 ? paths.join("/") : " ";
        });
    }

    async function upload() {
        const result = await executeApiRequest((apiUtils) => apiUtils.upload([...modifyLocalFile], dir), {
            isBackground: true,
            showError: true
        });
        if (result.success) {
            setFtpDirectory((current) =>
                current.dir === dir ? { ...current, content: result.data.entries } : current
            );
        }
    }

    async function download(destination: string) {
        const result = await executeApiRequest(
            (apiUtils) => apiUtils.download([...modifyFtpFile], ftpSelectionDir, root.path, dir),
            { isBackground: true, showError: true }
        );
        if (result.success) {
            const updates = await executeLocalRequest((manager) => manager.getDirectoryUpdates([destination]), {
                isBackground: true
            });
            if (updates.success) {
                UiUtils.applyLocalDirectoryUpdates(setLocalDirectory, updates.data);
            }
        }
    }

    async function moveRemote() {
        const selectedEntries = modifyFtpFile.map(({ path, type }) => ({ name: path, type }));
        const result = await executeApiRequest(
            (apiUtils) => apiUtils.moveEntries({ dir: ftpSelectionDir, entries: selectedEntries, destination: dir }),
            { isBackground: true, showError: true }
        );
        if (result.success) {
            setFtpDirectory((current) => {
                let content = current.content;
                if (current.dir === ftpSelectionDir) {
                    content = content.filter(({ name }) => !result.data.some(({ path }) => path === name));
                }

                if (current.dir === dir) {
                    content = [
                        ...content,
                        ...result.data.map(({ path, targetPath, type }) => ({ name: targetPath ?? path, type }))
                    ];
                }

                return { ...current, content };
            });
        }
    }

    async function copyMoveLocal(destination: string, move: boolean) {
        const result = await executeLocalRequest(
            (manager) =>
                move ? manager.move(modifyLocalFile, destination) : manager.copy(modifyLocalFile, destination),
            { isBackground: true, showError: true }
        );
        if (result.success) {
            UiUtils.applyLocalDirectoryUpdates(setLocalDirectory, result.data);
        }
    }

    async function executeOperation() {
        const destination = dir === " " ? root.path : `${root.path}/${dir}`;
        switch (action) {
            case "upload":
                await upload();
                break;
            case "download":
                await download(destination);
                break;
            case "copy":
                await copyMoveLocal(destination, false);
                break;
            case "move":
                if (modifyFtpFile.length > 0) {
                    await moveRemote();
                } else {
                    await copyMoveLocal(destination, true);
                }

                break;
        }

        setModifyFtpFile([]);
        setModifyLocalFile([]);
    }

    async function confirm() {
        onClose();
        try {
            await executeOperation();
        } finally {
            onOperationFinished?.();
        }
    }

    function cancel() {
        onClose();
        onCancel?.();
    }

    function updateCreatedDirectory(content: FtpEntry[] | LocalDirectoryUpdate[]) {
        if (isRemoteDestination) {
            setEntries(content as FtpEntry[]);
            return;
        }

        const path = dir === " " ? root.path : `${root.path}/${dir}`;
        const update = (content as LocalDirectoryUpdate[]).find(({ path: updatePath }) => updatePath === path);
        if (update) {
            setEntries(update.entries);
        }
    }

    const directories = isRemoteDestination
        ? (entries as FtpEntry[]).filter(({ type }) => type === "DIR").map(({ name }) => name)
        : (entries as FileSystemEntry[]).filter((entry) => entry.isDirectory()).map(({ name }) => name);
    const roots = [internalRoot, ...externalRoots];
    const operationSelectedCount = selectedCount ?? (modifyLocalFile.length || modifyFtpFile.length);
    const actionLabel =
        action === "upload" ? "Subir" : action === "download" ? "Descargar" : action === "copy" ? "Copiar" : "Mover";

    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={cancel}>
            <View style={operationDestination.backdrop}>
                <View
                    style={[
                        operationDestination.container,
                        { backgroundColor: theme.surface, borderColor: theme.border }
                    ]}
                >
                    <View style={operationDestination.titleRow}>
                        <Text style={[operationDestination.title, { color: theme.text }]}>
                            {actionLabel} {operationSelectedCount} {operationSelectedCount === 1 ? "archivo" : "archivos"}
                        </Text>
                    </View>
                    <Text style={[operationDestination.label, { color: theme.textMuted }]}>Almacenamiento</Text>
                    <Pressable
                        disabled={isRemoteDestination}
                        style={[operationDestination.storage, { backgroundColor: theme.surfaceMuted }]}
                        onPress={() => setShowRoots((current) => !current)}
                    >
                        <Ionicons
                            name={isRemoteDestination ? "cloud-outline" : "phone-portrait-outline"}
                            color={theme.text}
                            size={18}
                        />
                        <Text style={[operationDestination.storageText, { color: theme.text }]}>
                            {isRemoteDestination ? "Red" : root.name}
                        </Text>
                        {!isRemoteDestination && <Ionicons name="chevron-down" color={theme.text} size={18} />}
                    </Pressable>
                    {showRoots && (
                        <View
                            style={[
                                operationDestination.roots,
                                { backgroundColor: theme.surface, borderColor: theme.border }
                            ]}
                        >
                            {roots.map((item) => (
                                <Pressable
                                    key={item.id}
                                    style={operationDestination.root}
                                    onPress={() => selectRoot(item)}
                                >
                                    <Text style={[operationDestination.rootText, { color: theme.text }]}>
                                        {item.name}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    )}
                    <View style={operationDestination.pathRow}>
                        <Breadcrumb dir={dir} onNavigate={navigateTo} />
                    </View>
                    <View style={[operationDestination.directoryList, { borderColor: theme.border }]}>
                        {isLoading ? (
                            <ActivityIndicator color={theme.accent} size="large" style={operationDestination.loading} />
                        ) : (
                            <ScrollView>
                                <Pressable style={operationDestination.directory} onPress={navigateToParent}>
                                    <Ionicons name="arrow-up-outline" color={theme.textMuted} size={18} />
                                    <Text style={[operationDestination.directoryText, { color: theme.text }]}>
                                        .. <Text style={{ color: theme.textMuted }}>(Carpeta anterior)</Text>
                                    </Text>
                                </Pressable>
                                {directories.map((name) => (
                                    <Pressable
                                        key={name}
                                        style={operationDestination.directory}
                                        onPress={() => openDirectory(name)}
                                    >
                                        <Ionicons name="folder-outline" color={theme.textMuted} size={18} />
                                        <Text style={[operationDestination.directoryText, { color: theme.text }]}>
                                            {name}
                                        </Text>
                                        <Ionicons name="chevron-forward" color={theme.textMuted} size={18} />
                                    </Pressable>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                    <View style={operationDestination.footer}>
                        <Pressable style={operationDestination.create} onPress={() => setShowCreateDirectory(true)}>
                            <Ionicons name="folder-open-outline" color={theme.text} size={18} />
                            <Text style={[operationDestination.createText, { color: theme.text }]}>Nueva carpeta</Text>
                        </Pressable>
                        <View style={operationDestination.actions}>
                            <Pressable style={operationDestination.cancel} onPress={cancel}>
                                <Text style={[operationDestination.cancelText, { color: theme.danger }]}>Cancelar</Text>
                            </Pressable>
                            <Pressable
                                disabled={acceptDisabled}
                                style={[operationDestination.accept, { backgroundColor: theme.accent }]}
                                onPress={() => void confirm()}
                            >
                                <Text style={operationDestination.acceptText}>
                                    {acceptText ?? `${actionLabel} aquí`}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </View>
            {isRemoteDestination ? (
                <CreateDirectoryDialog
                    visible={showCreateDirectory}
                    storage="ftp"
                    rootPath={root.path}
                    dir={dir}
                    onClose={() => setShowCreateDirectory(false)}
                    onCreated={updateCreatedDirectory}
                />
            ) : (
                <CreateDirectoryDialog
                    visible={showCreateDirectory}
                    storage="local"
                    rootPath={root.path}
                    dir={dir}
                    onClose={() => setShowCreateDirectory(false)}
                    onCreated={updateCreatedDirectory}
                />
            )}
        </Modal>
    );
}
