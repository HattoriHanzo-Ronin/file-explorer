import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { useAppContext } from "../../components/app-context-provider";
import type { DirContent } from "../../types/files";
import axios from "axios";
import Background from "../../components/background";
import Breadcrumb from "../../components/breadcrumb";
import List from "../../components/list";
import Loading from "../../components/loading";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React from "react";
import UiUtils from "../../utils/ui-utils";
import useBackButtonEvent from "../../hooks/use-back-button-event";

export default function Ftp() {
    const context = useAppContext();
    const [dirContent, setDirContent] = useState<DirContent[]>([]);
    const safeBottom = useSafeAreaInsets().bottom;
    const getDirContent = async (dir: string) => {
        try {
            context.setLoad(true);
            const { data } =
                dir !== " " ? await axios.get(`${context.url}?dir=${encodeURI(dir)}`) : await axios.get(context.url);
            setDirContent(data);
        } catch {
            Alert.alert("Error al listar");
        } finally {
            context.setLoad(false);
        }
    };

    useBackButtonEvent(context, "ftp");

    useEffect(() => {
        getDirContent(context.lastFtpDir);
    }, [context.lastFtpDir, context.refresh]);

    if (context.load) {
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
