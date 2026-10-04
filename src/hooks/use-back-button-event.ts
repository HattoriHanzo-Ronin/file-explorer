import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { BackHandler } from "react-native";
import { useAppContext } from "../components/app-context-provider";

/**
 * Uses the Android back button to navigate to the parent directory
 *
 * @param storage Active storage
 */
export default function useBackButtonEvent(storage: string): void {
    const context = useAppContext();
    const {
        lastFtpDir,
        lastLocalDir,
        modifyFtpFile,
        modifyLocalFile,
        onCopy,
        setLastFtpDir,
        setLastLocalDir,
        setModifyFtpFile,
        setModifyLocalFile
    } = context;

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                const lastDir = storage === "local" ? lastLocalDir : lastFtpDir;

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
                        if (modifyLocalFile.length > 0 && !onCopy) {
                            setModifyLocalFile([]);
                        }

                        setLastLocalDir(dir);
                    } else {
                        if (modifyFtpFile.length > 0 && !onCopy) {
                            setModifyFtpFile([]);
                        }

                        setLastFtpDir(dir);
                    }

                    return true;
                }

                return false;
            };

            const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);

            return () => {
                subscription.remove();
            };
        }, [
            lastFtpDir,
            lastLocalDir,
            modifyFtpFile,
            modifyLocalFile,
            onCopy,
            setLastFtpDir,
            setLastLocalDir,
            setModifyFtpFile,
            setModifyLocalFile,
            storage
        ])
    );
}
