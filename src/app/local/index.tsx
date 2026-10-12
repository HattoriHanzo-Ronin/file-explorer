import { useCallback, useEffect } from "react";
import { useIsFocused } from "@react-navigation/native";
import { Alert, View } from "react-native";
import Background from "../../components/background";
import { useAppContext } from "../../components/app-context-provider";
import type { DirContent } from "../../types/files";
import List from "../../components/list";
import Breadcrumb from "../../components/breadcrumb";
import Loading from "../../components/loading";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React from "react";
import UiUtils from "../../utils/ui-utils";
import useBackButtonEvent from "../../hooks/use-back-button-event";
import FileUtils from "../../utils/file-utils";
import LocalFileManager from "../../utils/operations/local-file-manager";
import { explorer } from "../style";

export default function Local() {
    const context = useAppContext();
    const { activeStorageRoot, executeLocalRequest, isLoading, localDirectory, setLocalDirectory } = context;
    const { content: dirContent, dir: lastLocalDir } = localDirectory;
    const isFocused = useIsFocused();
    const safeBottom = useSafeAreaInsets().bottom;
    const contentStyle = [explorer.content, { paddingBottom: safeBottom }];
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
        await executeLocalRequest(
            (localFileManager) => localFileManager.extract(activeStorageRoot.path, lastLocalDir, name),
            { isBackground: true, showError: true }
        );
    }

    async function openFile(name: string) {
        if (FileUtils.getTypeFile(name) === "compress") {
            Alert.alert("", "Se va a descomprimir el archivo", [
                { text: "Cancel", style: "cancel" },
                { text: "Ok", onPress: () => void extractArchive(name) }
            ]);
            return;
        }

        await executeLocalRequest(
            (localFileManager) => localFileManager.openFile(activeStorageRoot.path, lastLocalDir, name),
            { isBackground: true, showError: true }
        );
    }

    useBackButtonEvent("local");

    useEffect(() => {
        void (async () => {
            await context.permission.ensureStoragePermission();
        })();
    }, [context.permission]);

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

    if (context.isLoading) {
        return <Loading />;
    }

    return (
        <Background>
            <Breadcrumb
                paths={lastLocalDir}
                onPress={(dir: string) => {
                    if (context.modifyLocalFile.length > 0 && !context.fileAction) {
                        context.setModifyLocalFile([]);
                    }

                    setLocalDirectory((current) => ({ ...current, dir }));
                }}
            />
            <View style={contentStyle}>
                <List
                    dirContent={dirContent.map((it) => ({
                        name: it.name,
                        type: it.isDirectory() ? "dir" : "file"
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

                        if (context.modifyLocalFile.length > 0 && !context.fileAction) {
                            context.setModifyLocalFile([]);
                        }
                    }}
                    longPressAction={(name: string, type: DirContent["type"]) => {
                        const path = `${lastLocalDir}/${name}`;
                        const absolutePath = `${activeStorageRoot.path}/${lastLocalDir === " " ? name : path}`;
                        if (path.includes("Android/data") || path.includes("Android/obb")) {
                            UiUtils.showMessage(`No se puede seleccionar la carpeta ${name}`);
                            return;
                        }

                        if (context.modifyFtpFile.length > 0) {
                            UiUtils.showMessage("Acción no disponible");
                            return;
                        }

                        if (!context.modifyLocalFile.some((item) => item.path === absolutePath)) {
                            context.setModifyLocalFile([
                                ...context.modifyLocalFile,
                                {
                                    path: absolutePath,
                                    type
                                }
                            ]);
                        } else {
                            context.setModifyLocalFile(
                                context.modifyLocalFile.filter((item) => item.path !== absolutePath)
                            );
                        }
                    }}
                    oneTapAction={async (name: string, type: DirContent["type"]) => {
                        const size = context.modifyLocalFile.length;
                        if (type === "file" && size === 0) {
                            await openFile(name);
                        }

                        context.setModifyLocalFile(
                            context.modifyLocalFile.filter(
                                (item) =>
                                    item.path !==
                                    `${activeStorageRoot.path}/${lastLocalDir === " " ? name : `${lastLocalDir}/${name}`}`
                            )
                        );
                    }}
                    notSelectable={context.modifyFtpFile.length > 0}
                />
            </View>
        </Background>
    );
}
