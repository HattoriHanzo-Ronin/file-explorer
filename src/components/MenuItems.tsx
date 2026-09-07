import { Menu } from "react-native-paper";
import { ContextType } from "./AppContextProvider";
import { cpmv, cpmvPath, download, getFileName, makeDir, makePathWithRoot, remove, rename, upload } from "../utils/FileUtils";
import RNFS from 'react-native-fs'
import Dialg from "./Dialog";
import { useState } from "react";
import axios from "axios";
import { noElements, showToast } from "../utils/UI_Utils";



export const
    UploadMenu = (props: { navigation: any, setVisible: Function, context: ContextType }) => {
        const context = props.context, toUpload = context.modifyLocalFile
        return (
            <Menu.Item title={"Subir"} onPress={async () => {
                if (toUpload.length < 1) return noElements(props.setVisible)
                if (context.lastComponent === "local") {
                    props.navigation.navigate("ftp")
                    context.setLastComponent("ftp")
                    showToast("Elija directorio donde desea subir los archivos")
                } else {
                    await upload(toUpload, context.lastFtpDir, context)
                    context.setModifyLocalFile([])
                    context.setDirSelected(!context.dirSelected)
                    context.setRefresh(!context.refresh)
                }
                props.setVisible(false)
            }} />)
    },
    DownloadMenu = (props: { navigation: any, setVisible: Function, context: ContextType }) => {
        const context = props.context, toDownload = context.modifyFtpFile

        return (
            <Menu.Item title={"Descargar"} onPress={async () => {
                props.setVisible(false)
                if (toDownload.length < 1) return noElements(props.setVisible)
                if (context.lastComponent === "ftp") {
                    props.navigation.navigate("local")
                    context.setLastComponent("local")
                    showToast("Elija directorio donde desea descargar los archivos")
                } else {
                    await download(toDownload, context.lastLocalDir, context)
                    context.setModifyFtpFile([])
                    context.setDirSelected(!context.dirSelected)
                    context.setRefresh(!context.refresh)
                }

            }} />)
    },
    CopyMenu = (props: { setVisible: Function, title: string, setTitle: Function, context: ContextType }) => {

        return (
            <Menu.Item title={props.title} onPress={async () =>
                await cpmvPath(props.context, props.setVisible, props.title, props.setTitle, true)} />)
    },
    MoveMenu = (props: { setVisible: Function, title: string, setTitle: Function, context: ContextType }) => {

        return (
            <Menu.Item title={props.title} onPress={async () =>
                await cpmvPath(props.context, props.setVisible, props.title, props.setTitle)} />)
    },
    MakeDir = (props: { setVisible: Function, context: ContextType }) => {
        const context = props.context, [show, setShow] = useState(false), [name, setName] = useState("")

        return (
            <>
                <Menu.Item title="Crear carpeta" onPress={async () => {
                    if (context.modifyFtpFile.length > 0 || context.modifyLocalFile.length > 0) showToast("Acción no disponible")
                    setShow(true)
                }

                } />
                <Dialg description="Escriba el nombre de la carpeta:" name={name} setName={setName} show={show} onCancel={() => {
                    setShow(false)
                    props.setVisible(false)
                    context.setDirSelected(!context.dirSelected)
                    context.setModifyLocalFile([])
                }}
                    onOk={async () => await makeDir(context, name, props.setVisible)} />
            </>
        )
    },
    RenameMenu = (props: { setVisible: Function, context: ContextType }) => {
        const context = props.context, [show, setShow] = useState(false), [name, setName] = useState(""), lastDir = makePathWithRoot(context.lastLocalDir),
            toRename = context.modifyLocalFile
        return (
            <>
                <Menu.Item title="Renombrar" onPress={async () => {
                    if (context.lastComponent === "ftp") return showToast("Función no disponible")
                    if (toRename.length < 1) return noElements(props.setVisible)
                    if (toRename.length > 1) {
                        props.setVisible(false)
                        return showToast("Solo se puede renombrar un elemento a la vez")
                    }
                    setName(toRename[0].path.split("/").pop() ?? "")
                    setShow(true)
                }} />
                <Dialg description="Escriba el nuevo nombre:" name={name} setName={setName} show={show} onCancel={() => {
                    props.setVisible(false)
                    context.setDirSelected(!context.dirSelected)
                    context.setModifyLocalFile([])
                }}
                    onOk={async () => await rename(toRename, name, lastDir, context, props.setVisible)} />
            </>
        )
    },
    RemoveMenu = (props: { setVisible: Function, context: ContextType }) => {
        const context = props.context, last = context.lastComponent, toRemove = last === "local" ? context.modifyLocalFile : context.modifyFtpFile
        return (
            <Menu.Item onPress={async () => {
                if (toRemove.length < 1) return noElements(props.setVisible)
                await remove(toRemove, last, context, props.setVisible)
            }} title="Eliminar" />)
    }