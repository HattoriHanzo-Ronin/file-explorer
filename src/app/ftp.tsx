import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { DirContent, useAppContext } from "../components/AppContextProvider";
import axios from "axios";
import Background from "../components/Background";
import Breadcrumb from "../components/Breadcrumb";
import List from "../components/List";
import Loading from "../components/Loading";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React from "react";
import { backButtonEvent, showToast } from "../utils/UI_Utils";

export default function Ftp() {
    const context = useAppContext(),
        // maneja el estado contenido del directorio
        [dirContent, setDirContent] = useState<DirContent[]>([]), safeBottom = useSafeAreaInsets().bottom,
        // obtiene el listado de archivos dentro de la carpeta
        getDirContent = async (dir: string) => {
            try {
                context.setLoad(true)
                // si se le pasa alguna obtendrá esa, sino obtendra root por defecto
                const { data } = dir !== " " ? await axios.get(`${context.url}?dir=${encodeURI(dir)}`) : await axios.get(context.url)
                setDirContent(data)
            } catch {
                Alert.alert("Error al listar")
            } finally {
                // cambiara el estado de load a false
                context.setLoad(false)
            }
        }

    backButtonEvent(context, "ftp")

    useEffect(() => {
        getDirContent(context.lastFtpDir)
    }, [context.lastFtpDir, context.refresh])

    if (context.load) return <Loading />

    return (
        <Background>
            <Breadcrumb paths={context.lastFtpDir} onPress={(dir: string) => {
                if (context.modifyFtpFile.length > 0) context.setModifyFtpFile([])
                context.setLastFtpDir(dir)
            }} />
            <View style={{ flex: 1, padding: "2%", paddingBottom: safeBottom }}>
                <List dirContent={dirContent}
                    doubleTapAction={async (name: string, type: string) => {
                        if (type === "dir") context.setLastFtpDir(context.lastFtpDir === " " ? name : `${context.lastFtpDir}/${name}`)
                        if (context.modifyFtpFile.length > 0) context.setModifyFtpFile([])
                    }}
                    longPressAction={(name: string, type: string) => {
                        if (context.modifyLocalFile.length > 0) return showToast("Acción no disponible")
                        if (!context.modifyFtpFile.some(item => item.path === name)) context.setModifyFtpFile([...context.modifyFtpFile,
                        { path: name, type: type }])
                        else context.setModifyFtpFile(context.modifyFtpFile.filter(item => item.path !== name))
                    }}
                    oneTapAction={(name: string) => context.setModifyFtpFile(context.modifyFtpFile.filter(item => item.path !== name))}
                    notSelectable={context.modifyLocalFile.length > 0}
                />
            </View>
        </Background>
    )
}