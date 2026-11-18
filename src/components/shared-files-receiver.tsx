import { useCallback, useEffect, useRef, useState } from "react";
import { useAppContext } from "./app-context-provider";
import { useOperationContext } from "./operation-provider";
import OperationDestinationModal from "./operation-destination-modal";
import UiUtils from "../utils/ui-utils";
import type { SharedFile } from "../types/sharing";
import type { SharedFilesReceiverProps } from "../types/components";

export default function SharedFilesReceiver(props: SharedFilesReceiverProps) {
    const { onRequireLogin } = props;
    const {
        isAuthenticated, modifyLocalFile, setModifyLocalFile, setSharedFiles, sharedFiles, sharedLoginRequested
    } = useAppContext();
    const { authUtils, sharing } = useOperationContext();
    const [visible, setVisible] = useState<boolean>(false);
    const discardedIds = useRef<Set<string>>(new Set());
    const isPreparing = sharedFiles.some(({ status }) => status === "PREPARING");

    const receiveFiles = useCallback(
        (receivedFiles: SharedFile[]) => {
            const failedIds = new Set(receivedFiles.filter(({ status }) => status === "ERROR").map(({ id }) => id));
            const acceptedFiles = receivedFiles.filter(({ id, path, status }) => {
                if (failedIds.has(id)) {
                    return false;
                }

                if (!discardedIds.current.has(id)) {
                    return true;
                }

                if (status === "READY" && path) {
                    void sharing.cleanupReceivedFiles([path]).catch(() => undefined);
                }
                return false;
            });
            setSharedFiles((current) => {
                const files = new Map(current.map((file) => [file.id, file]));
                failedIds.forEach((id) => files.delete(id));
                acceptedFiles.forEach((file) => files.set(file.id, file));
                return [...files.values()];
            });
        },
        [setSharedFiles, sharing]
    );

    useEffect(() => {
        const removeListener = sharing.addReceivedFilesListener(receiveFiles);
        void sharing
            .getReceivedFiles()
            .then(receiveFiles, () => UiUtils.showMessage("No se pudieron recibir los archivos"));
        return removeListener;
    }, [receiveFiles, sharing]);

    useEffect(() => {
        if (sharedFiles.length === 0) {
            sharedLoginRequested.current = false;
            setVisible(false);
            return;
        }

        if (visible) {
            return;
        }

        if (isAuthenticated) {
            sharedLoginRequested.current = false;
            setModifyLocalFile(
                sharedFiles
                    .filter(({ path, status }) => status === "READY" && path !== null)
                    .map(({ path }) => ({ path: path as string, type: "file" }))
            );
            setVisible(true);
            return;
        }

        if (sharedLoginRequested.current) {
            return;
        }

        sharedLoginRequested.current = true;
        void authUtils.restoreSession().then((restored) => {
            if (!restored) {
                UiUtils.showMessage("Debe iniciar sesión para subir archivos");
                onRequireLogin();
            }
        });
    }, [authUtils, isAuthenticated, onRequireLogin, setModifyLocalFile, sharedFiles, sharedLoginRequested, visible]);

    useEffect(() => {
        if (!visible || !isAuthenticated) {
            return;
        }

        setModifyLocalFile(
            sharedFiles
                .filter(({ path, status }) => status === "READY" && path !== null)
                .map(({ path }) => ({ path: path as string, type: "file" }))
        );
    }, [isAuthenticated, setModifyLocalFile, sharedFiles, visible]);

    function close() {
        setVisible(false);
        setSharedFiles([]);
        setModifyLocalFile([]);
    }

    function cleanup() {
        sharedFiles.forEach(({ id }) => discardedIds.current.add(id));
        const paths = sharedFiles.flatMap(({ path }) => (path ? [path] : []));
        if (paths.length > 0) {
            void sharing.cleanupReceivedFiles(paths).catch(() => undefined);
        }
    }

    return (
        <OperationDestinationModal
            action="upload"
            acceptDisabled={isPreparing || modifyLocalFile.length === 0}
            acceptText={isPreparing ? "Preparando archivos..." : undefined}
            visible={visible}
            onClose={close}
            onCancel={cleanup}
            selectedCount={sharedFiles.length}
        />
    );
}
