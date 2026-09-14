import { useEffect, useState } from "react";
import { View } from "react-native";
import RNFS from "react-native-fs";
import Background from "../components/Background";
import { DirContent, useAppContext } from "../components/AppContextProvider";
import List from "../components/List";
import Breadcrumb from "../components/Breadcrumb";
import { openFile } from "../utils/FileUtils";
import Loading from "../components/Loading";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React from "react";
import { useBackButtonEvent, showToast } from "../utils/UI_Utils";
import { ensureStoragePermission } from "../utils/PermissionUtils";

export default function Local() {
    const context = useAppContext();
    const [dirContent, setDirContent] = useState<RNFS.ReadDirItem[]>([]);
    const safeBottom = useSafeAreaInsets().bottom;
    const getDirContent = async (dir: string) => {
        try {
            context.setLoad(true);
            const dirContent = await RNFS.readDir(
                dir !== " " ? `${RNFS.ExternalStorageDirectoryPath}/${dir}` : RNFS.ExternalStorageDirectoryPath
            );
            setDirContent(dirContent);
        } catch {
            showToast("Error al listar");
        } finally {
            context.setLoad(false);
        }
    };

    useBackButtonEvent(context, "local");

    useEffect(() => {
        void (async () => {
            await ensureStoragePermission();
        })();
    }, []);

    useEffect(() => {
        void (async () => {
            await getDirContent(context.lastLocalDir);
        })();
    }, [context.lastLocalDir, context.refresh]);

    if (context.load) {
        return <Loading />;
    }

    return (
        <Background>
            <Breadcrumb
                paths={context.lastLocalDir}
                onPress={(dir: string) => {
                    if (context.modifyLocalFile.length > 0 && !context.onCopy) {
                        context.setModifyLocalFile([]);
                    }

                    context.setLastLocalDir(dir);
                }}
            />
            <View style={{ flex: 1, padding: "2%", paddingBottom: safeBottom }}>
                <List
                    dirContent={dirContent.map((it) => ({ name: it.name, type: it.isDirectory() ? "dir" : "file" }))}
                    doubleTapAction={async (name: string, type: DirContent["type"]) => {
                        const path = `${context.lastLocalDir}/${name}`;
                        if (type === "dir") {
                            if (path.includes("Android/data") || path.includes("Android/obb")) {
                                return showToast(`No se puede abrir la carpeta ${name}`);
                            }

                            context.setLastLocalDir(
                                context.lastLocalDir === " " ? name : `${context.lastLocalDir}/${name}`
                            );
                        }

                        if (context.modifyLocalFile.length > 0 && !context.onCopy) {
                            context.setModifyLocalFile([]);
                        }
                    }}
                    longPressAction={(name: string, type: DirContent["type"]) => {
                        const path = `${context.lastLocalDir}/${name}`;
                        if (path.includes("Android/data") || path.includes("Android/obb")) {
                            return showToast(`No se puede seleccionar la carpeta ${name}`);
                        }

                        if (context.modifyFtpFile.length > 0) {
                            return showToast("Acción no disponible");
                        }

                        if (!context.modifyLocalFile.some((item) => item.path === path)) {
                            context.setModifyLocalFile([
                                ...context.modifyLocalFile,
                                {
                                    path: context.lastLocalDir === " " ? name : `${context.lastLocalDir}/${name}`,
                                    type
                                }
                            ]);
                        } else {
                            context.setModifyLocalFile(context.modifyLocalFile.filter((item) => item.path === path));
                        }
                    }}
                    oneTapAction={async (name: string, type: DirContent["type"]) => {
                        const size = context.modifyLocalFile.length;
                        if (type === "file" && size === 0) {
                            await openFile(context.lastLocalDir, name, context);
                        }

                        context.setModifyLocalFile(
                            context.modifyLocalFile.filter((item) => item.path !== `${context.lastLocalDir}/${name}`)
                        );
                    }}
                    notSelectable={context.modifyFtpFile.length > 0}
                />
            </View>
        </Background>
    );
}
