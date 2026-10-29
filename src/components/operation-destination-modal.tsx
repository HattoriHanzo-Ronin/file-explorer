import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useAppContext } from "./app-context-provider";
import { useOperationContext } from "./operation-provider";
import { useTheme } from "./theme-provider";
import type {
    DestinationDirectoryListProps,
    DestinationOperationModalProps,
    DestinationStoragePickerProps
} from "../types/components";
import type { FileSystemEntry, LocalDirectoryUpdate, StorageRoot } from "../types/files";
import type { CreateDirectoryResponse, FtpEntry } from "../types/ftp";
import { operationDestination } from "../styles/components/style";
import UiUtils from "../utils/ui-utils";
import Breadcrumb from "./breadcrumb";
import CreateDirectoryDialog from "./create-directory-dialog";

const ACTION_LABELS: Record<DestinationOperationModalProps["action"], string> = {
    copy: "Copiar",
    download: "Descargar",
    move: "Mover",
    upload: "Subir"
};

function DestinationStoragePicker(props: DestinationStoragePickerProps) {
    const { onSelectRoot, onToggleRoots, remoteDestination, root, roots, showRoots } = props;
    const { theme } = useTheme();

    return (
        <>
            <Text style={[operationDestination.label, { color: theme.textMuted }]}>Almacenamiento</Text>
            <Pressable
                disabled={remoteDestination}
                style={[operationDestination.storage, { backgroundColor: theme.surfaceMuted }]}
                onPress={onToggleRoots}
            >
                <Ionicons
                    name={remoteDestination ? "cloud-outline" : "phone-portrait-outline"}
                    color={theme.text}
                    size={18}
                />
                <Text style={[operationDestination.storageText, { color: theme.text }]}>
                    {remoteDestination ? "Red" : root.name}
                </Text>
                {!remoteDestination && <Ionicons name="chevron-down" color={theme.text} size={18} />}
            </Pressable>
            {showRoots && (
                <View
                    style={[operationDestination.roots, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                    {roots.map((item) => (
                        <Pressable key={item.id} style={operationDestination.root} onPress={() => onSelectRoot(item)}>
                            <Text style={[operationDestination.rootText, { color: theme.text }]}>{item.name}</Text>
                        </Pressable>
                    ))}
                </View>
            )}
        </>
    );
}

function DestinationDirectoryList(props: DestinationDirectoryListProps) {
    const { directories, isLoading, onNavigateToParent, onOpenDirectory } = props;
    const { theme } = useTheme();

    return (
        <View style={[operationDestination.directoryList, { borderColor: theme.border }]}>
            {isLoading ? (
                <ActivityIndicator color={theme.accent} size="large" style={operationDestination.loading} />
            ) : (
                <ScrollView>
                    <Pressable style={operationDestination.directory} onPress={onNavigateToParent}>
                        <Ionicons name="arrow-up-outline" color={theme.textMuted} size={18} />
                        <Text style={[operationDestination.directoryText, { color: theme.text }]}>
                            ..{" "}
                            <Text style={[operationDestination.parentDirectoryText, { color: theme.textMuted }]}>
                                (Carpeta anterior)
                            </Text>
                        </Text>
                    </Pressable>
                    {directories.map((name) => (
                        <Pressable
                            key={name}
                            style={operationDestination.directory}
                            onPress={() => onOpenDirectory(name)}
                        >
                            <Ionicons name="folder-outline" color={theme.textMuted} size={18} />
                            <Text style={[operationDestination.directoryText, { color: theme.text }]}>{name}</Text>
                            <Ionicons name="chevron-forward" color={theme.textMuted} size={18} />
                        </Pressable>
                    ))}
                </ScrollView>
            )}
        </View>
    );
}

function isRemoteDestination(action: DestinationOperationModalProps["action"], ftpEntryCount: number): boolean {
    if (action === "upload") {
        return true;
    }

    return action === "move" && ftpEntryCount > 0;
}

function getDirectories(entries: FtpEntry[] | FileSystemEntry[], remote: boolean): string[] {
    if (remote) {
        return (entries as FtpEntry[]).filter(({ type }) => type === "DIR").map(({ name }) => name);
    }

    return (entries as FileSystemEntry[]).filter(({ isDirectory }) => isDirectory()).map(({ name }) => name);
}

export default function OperationDestinationModal(props: DestinationOperationModalProps) {
    const {
        acceptDisabled = false,
        acceptText,
        action,
        onCancel,
        onClose,
        onOperationFinished,
        selectedCount,
        visible
    } = props;
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
    const remoteDestination = isRemoteDestination(action, modifyFtpFile.length);
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
            if (remoteDestination) {
                const result = await executeApiRequest((apiUtils) => apiUtils.getDirectory(dir), {
                    isBackground: true
                });
                if (result.success) {
                    setEntries(result.data.entries);
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
    }, [dir, executeApiRequest, executeLocalRequest, remoteDestination, root.path]);

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
                current.dir === dir
                    ? { ...current, content: result.data.entries, version: result.data.version }
                    : current
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
                const { changes, destination, source } = result.data;
                if (current.dir === ftpSelectionDir) {
                    return {
                        ...current,
                        content: current.content.filter(
                            ({ name }) => !changes.some(({ path }) => path === name)
                        ),
                        version: source.version
                    };
                }

                if (current.dir === dir) {
                    return {
                        ...current,
                        content: [
                            ...current.content,
                            ...changes.map(({ path, targetPath, type }) => ({ name: targetPath ?? path, type }))
                        ],
                        version: destination.version
                    };
                }

                return current;
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

    function updateCreatedDirectory(content: CreateDirectoryResponse | LocalDirectoryUpdate[]) {
        if (remoteDestination) {
            const { entries: createdEntries, version } = content as CreateDirectoryResponse;
            setEntries(createdEntries);
            setFtpDirectory((current) =>
                current.dir === dir ? { ...current, content: createdEntries, version } : current
            );
            return;
        }

        const path = dir === " " ? root.path : `${root.path}/${dir}`;
        const update = (content as LocalDirectoryUpdate[]).find(({ path: updatePath }) => updatePath === path);
        if (update) {
            setEntries(update.entries);
        }
    }

    const directories = getDirectories(entries, remoteDestination);
    const roots = [internalRoot, ...externalRoots];
    const operationSelectedCount = selectedCount ?? (modifyLocalFile.length || modifyFtpFile.length);
    const actionLabel = ACTION_LABELS[action];

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
                            {actionLabel} {operationSelectedCount}{" "}
                            {operationSelectedCount === 1 ? "archivo" : "archivos"}
                        </Text>
                    </View>
                    <DestinationStoragePicker
                        remoteDestination={remoteDestination}
                        root={root}
                        roots={roots}
                        showRoots={showRoots}
                        onSelectRoot={selectRoot}
                        onToggleRoots={() => setShowRoots((current) => !current)}
                    />
                    <View style={operationDestination.pathRow}>
                        <Breadcrumb dir={dir} onNavigate={navigateTo} />
                    </View>
                    <DestinationDirectoryList
                        directories={directories}
                        isLoading={isLoading}
                        onNavigateToParent={navigateToParent}
                        onOpenDirectory={openDirectory}
                    />
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
            <CreateDirectoryDialog
                visible={showCreateDirectory}
                storage={remoteDestination ? "ftp" : "local"}
                rootPath={root.path}
                dir={dir}
                onClose={() => setShowCreateDirectory(false)}
                onCreated={updateCreatedDirectory}
            />
        </Modal>
    );
}
