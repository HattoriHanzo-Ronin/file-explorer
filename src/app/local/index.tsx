import { useCallback, useEffect } from "react";
import { useIsFocused } from "@react-navigation/native";
import { Text, View } from "react-native";
import { useAppContext } from "../../components/app-context-provider";
import { useOperationContext } from "../../components/operation-provider";
import type { DirContent } from "../../types/files";
import List from "../../components/list";
import LoadingWindow from "../../components/loading-window";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React from "react";
import UiUtils from "../../utils/ui-utils";
import useBackButtonEvent from "../../hooks/use-back-button-event";
import FileUtils from "../../utils/file-utils";
import LocalFileManager from "../../utils/operations/local-file-manager";
import { commonStyles } from "../../styles/style";
import { useTheme } from "../../components/theme-provider";
import AppDialog from "../../components/dialog";
import { appDialog } from "../../styles/components/style";

export default function Local() {
    const {
        activeStorageRoot,
        fileAction,
        isLoading,
        localDirectory,
        modifyLocalFile,
        permission,
        setLocalDirectory,
        setModifyLocalFile
    } = useAppContext();
    const { executeLocalRequest } = useOperationContext();
    const { mode, theme } = useTheme();
    const common = commonStyles[mode];
    const { content: dirContent, dir: lastLocalDir } = localDirectory;
    const [archiveName, setArchiveName] = React.useState<string | null>(null);
    const isFocused = useIsFocused();
    const safeBottom = useSafeAreaInsets().bottom;
    const contentStyle = [common.explorerContent, { paddingBottom: safeBottom }];
    const loadDirectory = useCallback(
        async (dir: string, isBackground = false) => {
            const result = await executeLocalRequest(
                (localFileManager) => localFileManager.dir(activeStorageRoot.path, dir),
                { isBackground }
            );
            if (result.success) {
                setLocalDirectory((current) =>
                    current.dir === dir ? { ...current, content: result.data.entries } : current
                );
            }
        },
        [activeStorageRoot.path, executeLocalRequest, setLocalDirectory]
    );

    async function extractArchive(name: string) {
        const result = await executeLocalRequest(
            (localFileManager) => localFileManager.extract(activeStorageRoot.path, lastLocalDir, name),
            { isBackground: true, showError: true }
        );
        if (result.success) {
            UiUtils.applyLocalDirectoryUpdates(setLocalDirectory, result.data);
        }
    }

    async function openFile(name: string) {
        if (FileUtils.getTypeFile(name) === "compress") {
            setArchiveName(name);
            return;
        }

        await executeLocalRequest(
            (localFileManager) => localFileManager.openFile(activeStorageRoot.path, lastLocalDir, name),
            { isBackground: true, showError: true }
        );
    }

    useBackButtonEvent("local");

    useEffect(() => {
        void permission.ensureStoragePermission();
    }, [permission]);

    useEffect(() => {
        if (isFocused) {
            void loadDirectory(lastLocalDir);
        }
    }, [isFocused, lastLocalDir, loadDirectory]);

    useEffect(() => {
        const interval = setInterval(() => {
            void (async () => {
                if (!isLoading) {
                    const result = await executeLocalRequest(
                        (localFileManager) => localFileManager.getVersion(activeStorageRoot.path, lastLocalDir),
                        { isBackground: true }
                    );
                    if (result.success && result.data.version !== LocalFileManager.LOCAL_VERSION) {
                        void loadDirectory(lastLocalDir, true);
                    }
                }
            })();
        }, 2000);
        return () => clearInterval(interval);
    }, [activeStorageRoot.path, executeLocalRequest, isLoading, lastLocalDir, loadDirectory]);

    return (
        <View style={common.root}>
            {isFocused && <LoadingWindow />}
            <View style={contentStyle}>
                <List
                    storage="local"
                    dirContent={dirContent.map(({ isDirectory, name, path }) => ({
                        name,
                        type: isDirectory() ? "dir" : "file",
                        thumbnailPath: path
                    }))}
                    doubleTapAction={(name: string, type: DirContent["type"]) => {
                        const path = `${lastLocalDir}/${name}`;
                        if (type === "dir") {
                            if (path.includes("Android/data") || path.includes("Android/obb")) {
                                UiUtils.showMessage(`No se puede abrir la carpeta ${name}`);
                                return;
                            }

                            setLocalDirectory((current) => ({
                                ...current,
                                dir: current.dir === " " ? name : `${current.dir}/${name}`
                            }));
                        }

                        if (type === "file" && modifyLocalFile.length === 0) {
                            void openFile(name);
                        }

                        if (modifyLocalFile.length > 0 && !fileAction) {
                            setModifyLocalFile([]);
                        }
                    }}
                    longPressAction={(name: string, type: DirContent["type"]) => {
                        const path = `${lastLocalDir}/${name}`;
                        const absolutePath = `${activeStorageRoot.path}/${lastLocalDir === " " ? name : path}`;
                        const isRestrictedDir = UiUtils.isActionBlocked(
                            path.includes("Android/data") || path.includes("Android/obb"),
                            `No se puede seleccionar la carpeta ${name}`
                        );
                        if (isRestrictedDir) {
                            return;
                        }

                        if (!modifyLocalFile.some(({ path: entryPath }) => entryPath === absolutePath)) {
                            setModifyLocalFile([
                                ...modifyLocalFile,
                                {
                                    path: absolutePath,
                                    type
                                }
                            ]);
                        } else {
                            setModifyLocalFile(
                                modifyLocalFile.filter(({ path: entryPath }) => entryPath !== absolutePath)
                            );
                        }
                    }}
                    oneTapAction={(name: string, type: DirContent["type"]) => {
                        const size = modifyLocalFile.length;
                        const relativePath = `${lastLocalDir}/${name}`;
                        const absolutePath = `${activeStorageRoot.path}/${lastLocalDir === " " ? name : relativePath}`;
                        if (size > 0) {
                            const isRestrictedDir = UiUtils.isActionBlocked(
                                relativePath.includes("Android/data") || relativePath.includes("Android/obb"),
                                `No se puede seleccionar la carpeta ${name}`
                            );
                            if (isRestrictedDir) {
                                return;
                            }

                            setModifyLocalFile((current) => {
                                const hasName = current.some(({ path }) => path === absolutePath);
                                return hasName
                                    ? current.filter(({ path }) => path !== absolutePath)
                                    : [...current, { path: absolutePath, type }];
                            });
                        }
                    }}
                    selectAll={(selectAll) => {
                        if (!selectAll) {
                            setModifyLocalFile([]);
                            return;
                        }

                        setModifyLocalFile(
                            dirContent
                                .filter(({ name }) => lastLocalDir !== "Android" || (name !== "data" && name !== "obb"))
                                .map(({ path, isDirectory }) => ({
                                    path,
                                    type: isDirectory() ? "dir" : "file"
                                }))
                        );
                    }}
                />
            </View>
            <AppDialog
                visible={archiveName !== null}
                onCancel={() => setArchiveName(null)}
                onAccept={() => {
                    if (archiveName) {
                        void extractArchive(archiveName);
                    }

                    setArchiveName(null);
                }}
            >
                <Text style={[appDialog.message, { color: theme.text }]}>Se va a descomprimir el archivo</Text>
            </AppDialog>
        </View>
    );
}
