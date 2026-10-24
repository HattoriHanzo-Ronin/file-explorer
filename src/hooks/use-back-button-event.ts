import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef } from "react";
import { BackHandler } from "react-native";
import { useAppContext } from "../components/app-context-provider";
import { BACK_EXIT_INTERVAL, BACK_EXIT_MESSAGE } from "../constants/ui";
import type { AppContextType } from "../types/context";
import type { StorageType } from "../types/navigation";
import UiUtils from "../utils/ui-utils";

function clearSelection(context: AppContextType, storage: StorageType): boolean {
    const { modifyFtpFile, modifyLocalFile, setModifyFtpFile, setModifyLocalFile } = context;
    const selection = storage === "local" ? modifyLocalFile : modifyFtpFile;
    if (selection.length === 0) {
        return false;
    }

    if (storage === "local") {
        setModifyLocalFile([]);
    } else {
        setModifyFtpFile([]);
    }

    return true;
}

function navigateToParent(context: AppContextType, storage: StorageType): boolean {
    const { ftpDirectory, localDirectory, setFtpDirectory, setLocalDirectory } = context;
    const lastDir = storage === "local" ? localDirectory.dir : ftpDirectory.dir;
    if (lastDir === " ") {
        return false;
    }

    const paths = lastDir.split("/").slice(0, -1);
    const dir = paths.length > 0 ? paths.join("/") : " ";
    if (storage === "local") {
        setLocalDirectory((current) => ({ ...current, dir }));
    } else {
        setFtpDirectory((current) => ({ ...current, dir }));
    }

    return true;
}

/**
 * Uses the Android back button to navigate to the parent directory
 *
 * @param storage Active storage
 */
export default function useBackButtonEvent(storage: StorageType): void {
    const context = useAppContext();
    const lastBackPress = useRef<number | null>(null);

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (clearSelection(context, storage)) {
                    return true;
                }

                if (navigateToParent(context, storage)) {
                    return true;
                }

                const now = Date.now();
                if (lastBackPress.current && now - lastBackPress.current < BACK_EXIT_INTERVAL) {
                    BackHandler.exitApp();
                    return true;
                }

                lastBackPress.current = now;
                UiUtils.showMessage(BACK_EXIT_MESSAGE, "SHORT");
                return true;
            };

            const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);

            return () => {
                lastBackPress.current = null;
                subscription.remove();
            };
        }, [context, storage])
    );
}
