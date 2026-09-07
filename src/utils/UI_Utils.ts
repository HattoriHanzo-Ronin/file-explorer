import { useFocusEffect } from "@react-navigation/native";
import React from "react";
import { ContextType } from "../components/AppContextProvider";
import { BackHandler, ToastAndroid } from "react-native";

export const
    /**
       * Cambiará la acción del botón hacia atrás y la usará para retroceder entre directorios
       * 
       * @param context Contexto de la aplicación
       * @param storage En que tipo de almacenamiento se está trabajando local u otro
       */
    backButtonEvent = (context: ContextType, storage: string) => {
        useFocusEffect(
            React.useCallback(() => {
                const onBackPress = () => {
                    const lastDir = storage === "local" ? context.lastLocalDir : context.lastFtpDir

                    if (lastDir !== " ") {
                        let dir = " ";
                        if (lastDir.includes("/")) {
                            let sptLastDir = lastDir.split("/").slice(0, -1)
                            dir = sptLastDir[0]
                            if (sptLastDir.length > 1) dir = sptLastDir.join("/")
                        }

                        if (storage === "local") {
                            if (context.modifyLocalFile.length > 0 && !context.onCopy) context.setModifyLocalFile([])
                            context.setLastLocalDir(dir)
                        }
                        else {
                            if (context.modifyFtpFile.length > 0 && !context.onCopy) context.setModifyFtpFile([])
                            context.setLastFtpDir(dir)
                        }

                        return true
                    }

                    return false
                }

                const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress)

                return () => {
                    subscription.remove()
                }
            }, [context, storage])
        )
    },

    // mostrará un toast con el texto que se le pasa
    showToast = (mess: string) => ToastAndroid.show(mess, ToastAndroid.LONG),

    // mostrará un toast avisando de que no hay elementos seleccionados
    noElements = (setVisible?: Function) => {
        showToast("No hay elementos seleccionados")
        if (setVisible) setVisible(false)
    }