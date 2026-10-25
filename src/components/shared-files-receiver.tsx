import { useCallback, useEffect, useRef, useState } from "react";
import { useAppContext } from "./app-context-provider";
import { useOperationContext } from "./operation-provider";
import OperationDestinationModal from "./operation-destination-modal";
import UiUtils from "../utils/ui-utils";
import type { SharedFile } from "../types/sharing";

interface SharedFilesReceiverProps {
    onRequireLogin: () => void;
}

export default function SharedFilesReceiver(props: SharedFilesReceiverProps) {
    const { onRequireLogin } = props;
    const { isAuthenticated, modifyLocalFile, setModifyLocalFile, setSharedFiles, sharedFiles } = useAppContext();
    const { authUtils, sharing } = useOperationContext();
    const [visible, setVisible] = useState<boolean>(false);
    const receivedIds = useRef<Set<string>>(new Set());
    const receivedPaths = useRef<string[]>([]);
    const discardedIds = useRef<Set<string>>(new Set());
    const isPreparing = sharedFiles.some(({ status }) => status === "PREPARING");

    const receiveFiles = useCallback(
        (receivedFiles: SharedFile[]) => {
            const acceptedFiles = receivedFiles.filter(({ id, path, status }) => {
                if (!discardedIds.current.has(id)) {
                    return true;
                }

                if (status === "READY" && path) {
                    void sharing.cleanupReceivedFiles([path]).catch(() => undefined);
                }
                return false;
            });
            acceptedFiles.forEach(({ id, path, status }) => {
                receivedIds.current.add(id);
                if (status === "READY" && path && !receivedPaths.current.includes(path)) {
                    receivedPaths.current = [...receivedPaths.current, path];
                }
            });
            setSharedFiles((current) => {
                const files = new Map(current.map((file) => [file.id, file]));
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
        if (sharedFiles.length === 0 || visible) {
            return;
        }

        if (isAuthenticated) {
            setModifyLocalFile(
                sharedFiles
                    .filter(({ path, status }) => status === "READY" && path !== null)
                    .map(({ path }) => ({ path: path as string, type: "file" }))
            );
            setVisible(true);
            return;
        }

        void authUtils.restoreSession().then((restored) => {
            if (!restored) {
                UiUtils.showMessage("Debe iniciar sesión para subir archivos");
                onRequireLogin();
            }
        });
    }, [authUtils, isAuthenticated, onRequireLogin, setModifyLocalFile, sharedFiles, visible]);

    function close() {
        setVisible(false);
        setSharedFiles([]);
        setModifyLocalFile([]);
    }

    function cleanup() {
        receivedIds.current.forEach((id) => discardedIds.current.add(id));
        const paths = receivedPaths.current;
        receivedPaths.current = [];
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
            onOperationFinished={cleanup}
            selectedCount={sharedFiles.length}
        />
    );
}
