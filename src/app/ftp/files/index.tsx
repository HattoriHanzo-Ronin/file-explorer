import { useCallback, useEffect } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { View } from "react-native";
import { useAppContext } from "../../../components/app-context-provider";
import type { FtpEntry } from "../../../types/ftp";
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
import { common } from "../../../styles/style";

export default function Files() {
    const context = useAppContext();
    const { executeApiRequest, ftpDirectory, isAuthenticated, isLoading, setFtpDirectory } = context;
    const { content: ftpDirContent, dir: lastFtpDir } = ftpDirectory;
    const navigation = useNavigation<NativeStackNavigationProp<FtpStackParamList>>();
    const safeBottom = useSafeAreaInsets().bottom;
    const contentStyle = [common.explorerContent, { paddingBottom: safeBottom }];

    const loadDirectory = useCallback(
        async (isBackground = false) => {
            const result = await executeApiRequest((apiUtils) => apiUtils.getDirectory(lastFtpDir), { isBackground });
            if (result.success) {
                setFtpDirectory((current) =>
                    current.dir === lastFtpDir ? { ...current, content: result.data } : current
                );
            }
        },
        [executeApiRequest, lastFtpDir, setFtpDirectory]
    );

    useBackButtonEvent("ftp");

    useEffect(() => {
        if (!isAuthenticated) {
            navigation.replace("login");
        }
    }, [isAuthenticated, navigation]);

    useEffect(() => {
        void loadDirectory();
    }, [loadDirectory]);

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
                            void loadDirectory(true);
                        }
                    }
                })();
            }, 2000);
            return () => clearInterval(interval);
        }, [executeApiRequest, isLoading, lastFtpDir, loadDirectory])
    );

    if (isLoading) {
        return <Loading />;
    }

    return (
        <Background>
            <Breadcrumb
                paths={lastFtpDir}
                onPress={(path: string) => {
                    if (context.modifyFtpFile.length > 0 && !context.fileAction) {
                        context.setModifyFtpFile([]);
                    }

                    setFtpDirectory((current) => ({ ...current, dir: path }));
                }}
            />
            <View style={contentStyle}>
                <List
                    dirContent={ftpDirContent}
                    doubleTapAction={(name: string, type: FtpEntry["type"]) => {
                        if (type === "DIR") {
                            setFtpDirectory((current) => ({
                                ...current,
                                dir: current.dir === " " ? name : `${current.dir}/${name}`
                            }));
                        }

                        if (context.modifyFtpFile.length > 0 && !context.fileAction) {
                            context.setModifyFtpFile([]);
                        }
                    }}
                    longPressAction={(name: string, type: FtpEntry["type"]) => {
                        if (context.modifyLocalFile.length > 0) {
                            UiUtils.showMessage("Acción no disponible");
                            return;
                        }

                        if (!context.modifyFtpFile.some((item) => item.path === name)) {
                            if (context.modifyFtpFile.length === 0) {
                                context.setFtpSelectionDir(lastFtpDir);
                            }

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
