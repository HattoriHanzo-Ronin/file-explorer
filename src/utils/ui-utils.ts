import { useFocusEffect } from "@react-navigation/native";
import React from "react";
import type { AppContextType } from "../types/context";
import { BackHandler, ToastAndroid } from "react-native";

/**
 * Uses the Android back button to navigate to the parent directory
 *
 * @param context Application context
 * @param storage Active storage
 */
export const useBackButtonEvent = (context: AppContextType, storage: string) => {
    useFocusEffect(
        React.useCallback(() => {
            const onBackPress = () => {
                const lastDir = storage === "local" ? context.lastLocalDir : context.lastFtpDir;

                if (lastDir !== " ") {
                    let dir = " ";
                    if (lastDir.includes("/")) {
                        const sptLastDir = lastDir.split("/").slice(0, -1);
                        dir = sptLastDir[0];
                        if (sptLastDir.length > 1) {
                            dir = sptLastDir.join("/");
                        }
                    }

                    if (storage === "local") {
                        if (context.modifyLocalFile.length > 0 && !context.onCopy) {
                            context.setModifyLocalFile([]);
                        }

                        context.setLastLocalDir(dir);
                    } else {
                        if (context.modifyFtpFile.length > 0 && !context.onCopy) {
                            context.setModifyFtpFile([]);
                        }

                        context.setLastFtpDir(dir);
                    }

                    return true;
                }

                return false;
            };

            const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);

            return () => {
                subscription.remove();
            };
        }, [context, storage])
    );
};

export const showToast = (mess: string) => ToastAndroid.show(mess, ToastAndroid.LONG);

export const noElements = (setVisible?: (visible: boolean) => void) => {
    showToast("No hay elementos seleccionados");
    if (setVisible) {
        setVisible(false);
    }
};
