import { useCallback, useEffect } from "react";
import { useIsFocused, useNavigation } from "@react-navigation/native";
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
import { commonStyles } from "../../../styles/style";
import { useTheme } from "../../../components/theme-provider";

export default function Files() {
    const {
        ftpDirectory,
        isAuthenticated,
        setFtpDirectory,
        setModifyFtpFile,
        setFtpSelectionDir,
        modifyFtpFile
    } = useAppContext();
    const { addFtpChangeListener, executeApiRequest, setFtpSocketActive } = useOperationContext();
    const { mode } = useTheme();
    const common = commonStyles[mode];
    const { content: ftpDirContent, dir: lastFtpDir, version: ftpVersion } = ftpDirectory;
    const navigation = useNavigation<NativeStackNavigationProp<FtpStackParamList>>();
    const isFocused = useIsFocused();
    const safeBottom = useSafeAreaInsets().bottom;
    const contentStyle = [common.explorerContent, { paddingBottom: safeBottom }];

    const loadDirectory = useCallback(
        async (isBackground = false) => {
            const result = await executeApiRequest((apiUtils) => apiUtils.getDirectory(lastFtpDir), { isBackground });
            if (result.success) {
                setFtpDirectory((current) =>
                    current.dir === lastFtpDir
                        ? { ...current, content: result.data.entries, version: result.data.version }
                        : current
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
        setFtpSocketActive(isAuthenticated && isFocused);
        return () => setFtpSocketActive(false);
    }, [isAuthenticated, isFocused, setFtpSocketActive]);

    useEffect(() => {
        void loadDirectory();
    }, [loadDirectory]);

    useEffect(
        () =>
            addFtpChangeListener(({ dir, version }) => {
                if (dir === lastFtpDir && version !== ftpVersion) {
                    void loadDirectory(true);
                }
            }),
        [addFtpChangeListener, ftpVersion, lastFtpDir, loadDirectory]
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
                                dir: current.dir === " " ? name : `${current.dir}/${name}`,
                                version: ""
                            }));
                        }

                        if (modifyFtpFile.length > 0) {
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
