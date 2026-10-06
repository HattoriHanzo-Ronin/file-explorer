import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { View } from "react-native";
import { useAppContext } from "../../../components/app-context-provider";
import type { DirContent } from "../../../types/files";
import type { FtpStackParamList } from "../../../types/navigation";
import Background from "../../../components/background";
import Breadcrumb from "../../../components/breadcrumb";
import List from "../../../components/list";
import Loading from "../../../components/loading";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React from "react";
import UiUtils from "../../../utils/ui-utils";
import useBackButtonEvent from "../../../hooks/use-back-button-event";
import ApiUtils from "../../../utils/api-utils";

export default function Files() {
    const context = useAppContext();
    const { executeApiRequest, isAuthenticated, lastFtpDir, isLoading, refresh, transferManager } = context;
    const navigation = useNavigation<NativeStackNavigationProp<FtpStackParamList>>();
    const [dirContent, setDirContent] = useState<DirContent[]>([]);
    const safeBottom = useSafeAreaInsets().bottom;

    const loadDirectory = useCallback(async () => {
        const result = await executeApiRequest((apiUtils) => apiUtils.getDirectory(lastFtpDir));
        if (result.success) {
            setDirContent(
                result.data.map((entry) => ({
                    name: entry.name,
                    type: entry.type.toLocaleLowerCase() as DirContent["type"],
                    supportsThumbnail: entry.supportsThumbnail
                }))
            );
        }
    }, [executeApiRequest, lastFtpDir]);

    useBackButtonEvent("ftp");

    useEffect(() => {
        if (!isAuthenticated) {
            navigation.replace("login");
        }
    }, [isAuthenticated, navigation]);

    useEffect(() => {
        void loadDirectory();
    }, [loadDirectory, refresh]);

    useFocusEffect(
        useCallback(() => {
            const interval = setInterval(() => {
                void (async () => {
                    if (!isLoading) {
                        const result = await executeApiRequest(
                            async (apiUtils) => {
                                if (apiUtils.isRemoteDirectoryBusy(lastFtpDir)) {
                                    return {
                                        success: true,
                                        data: { version: ApiUtils.FTP_VERSION }
                                    };
                                }

                                return apiUtils.getVersion({ dir: lastFtpDir });
                            },
                            { isBackground: true }
                        );
                        if (result.success && result.data.version !== ApiUtils.FTP_VERSION) {
                            void loadDirectory();
                        }
                    }
                })();
            }, 2000);
            return () => clearInterval(interval);
        }, [executeApiRequest, isLoading, lastFtpDir, loadDirectory])
    );

    useEffect(
        () =>
            transferManager.addChangeListener(({ direction, status, remoteDir, result }) => {
                const currentRemoteDir = lastFtpDir === " " ? "" : lastFtpDir;
                if (direction === "UPLOAD" && status === "COMPLETED" && remoteDir === currentRemoteDir && result) {
                    ApiUtils.FTP_VERSION = result.version;
                    setDirContent(
                        result.entries.map((entry) => ({
                            name: entry.name,
                            type: entry.type.toLocaleLowerCase() as DirContent["type"]
                        }))
                    );
                }
            }),
        [lastFtpDir, transferManager]
    );

    if (context.isLoading) {
        return <Loading />;
    }

    return (
        <Background>
            <Breadcrumb
                paths={context.lastFtpDir}
                onPress={(dir: string) => {
                    if (context.modifyFtpFile.length > 0) {
                        context.setModifyFtpFile([]);
                    }

                    context.setLastFtpDir(dir);
                }}
            />
            <View style={{ flex: 1, padding: "2%", paddingBottom: safeBottom }}>
                <List
                    dirContent={dirContent}
                    doubleTapAction={async (name: string, type: DirContent["type"]) => {
                        if (type === "dir") {
                            context.setLastFtpDir(context.lastFtpDir === " " ? name : `${context.lastFtpDir}/${name}`);
                        }

                        if (context.modifyFtpFile.length > 0) {
                            context.setModifyFtpFile([]);
                        }
                    }}
                    longPressAction={(name: string, type: DirContent["type"]) => {
                        if (context.modifyLocalFile.length > 0) {
                            return UiUtils.showMessage("Acción no disponible");
                        }

                        if (!context.modifyFtpFile.some((item) => item.path === name)) {
                            context.setModifyFtpFile([...context.modifyFtpFile, { path: name, type }]);
                        } else {
                            context.setModifyFtpFile(context.modifyFtpFile.filter((item) => item.path !== name));
                        }
                    }}
                    oneTapAction={(name: string) =>
                        context.setModifyFtpFile(context.modifyFtpFile.filter((item) => item.path !== name))
                    }
                    notSelectable={context.modifyLocalFile.length > 0}
                />
            </View>
        </Background>
    );
}
