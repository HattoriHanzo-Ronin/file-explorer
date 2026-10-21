import { useCallback, useEffect } from "react";
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { View } from "react-native";
import { useAppContext } from "../../../components/app-context-provider";
import { useOperationContext } from "../../../components/operation-provider";
import type { FtpEntry } from "../../../types/ftp";
import type { FtpStackParamList } from "../../../types/navigation";
import List from "../../../components/list";
import LoadingWindow from "../../../components/loading-window";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React from "react";
import useBackButtonEvent from "../../../hooks/use-back-button-event";
import ApiUtils from "../../../utils/api-utils";
import { commonStyles } from "../../../styles/style";
import { useTheme } from "../../../components/theme-provider";

export default function Files() {
    const {
        ftpDirectory,
        isAuthenticated,
        isLoading,
        setFtpDirectory,
        setModifyFtpFile,
        setFtpSelectionDir,
        fileAction,
        modifyFtpFile
    } = useAppContext();
    const { executeApiRequest } = useOperationContext();
    const { mode } = useTheme();
    const common = commonStyles[mode];
    const { content: ftpDirContent, dir: lastFtpDir } = ftpDirectory;
    const navigation = useNavigation<NativeStackNavigationProp<FtpStackParamList>>();
    const isFocused = useIsFocused();
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
                        const result = await executeApiRequest((apiUtils) => apiUtils.getVersion({ dir: lastFtpDir }), {
                            isBackground: true
                        });
                        if (result.success && result.data.version !== ApiUtils.FTP_VERSION) {
                            void loadDirectory(true);
                        }
                    }
                })();
            }, 2000);
            return () => clearInterval(interval);
        }, [executeApiRequest, isLoading, lastFtpDir, loadDirectory])
    );

    return (
        <View style={common.root}>
            {isFocused && <LoadingWindow />}
            <View style={contentStyle}>
                <List
                    storage="ftp"
                    dirContent={ftpDirContent}
                    doubleTapAction={(name: string, type: FtpEntry["type"]) => {
                        if (type === "DIR") {
                            setFtpDirectory((current) => ({
                                ...current,
                                dir: current.dir === " " ? name : `${current.dir}/${name}`
                            }));
                        }

                        if (modifyFtpFile.length > 0 && !fileAction) {
                            setModifyFtpFile([]);
                        }
                    }}
                    longPressAction={(name: string, type: FtpEntry["type"]) => {
                        if (!modifyFtpFile.some(({ path }) => path === name)) {
                            if (modifyFtpFile.length === 0) {
                                setFtpSelectionDir(lastFtpDir);
                            }

                            setModifyFtpFile([...modifyFtpFile, { path: name, type }]);
                        } else {
                            setModifyFtpFile(modifyFtpFile.filter(({ path }) => path !== name));
                        }
                    }}
                    oneTapAction={(name: string, type: FtpEntry["type"]) => {
                        if (modifyFtpFile.length > 0) {
                            setModifyFtpFile((current) => {
                                const hasName = current.find(({ path }) => path === name);
                                return hasName
                                    ? current.filter(({ path }) => path !== name)
                                    : [...current, { path: name, type }];
                            });
                        }
                    }}
                    selectAll={(selectAll) => {
                        if (!selectAll) {
                            setModifyFtpFile([]);
                            return;
                        }

                        setFtpSelectionDir(lastFtpDir);
                        setModifyFtpFile(ftpDirectory.content.map(({ name, type }) => ({ path: name, type })));
                    }}
                />
            </View>
        </View>
    );
}
