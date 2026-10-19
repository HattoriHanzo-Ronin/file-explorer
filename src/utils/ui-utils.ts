import { ToastAndroid } from "react-native";
import type { AppContextType } from "../types/context";
import type { StorageType } from "../types/navigation";
import type { MessageDuration, ValidationErrors } from "../types/ui";
import type { ApiValidationErrorDetail } from "../types/api-error";
import type { LocalDirectoryUpdate } from "../types/files";

/**
 * Manages application messages
 */
export default class UiUtils {
    /** Applies a directory result only when it matches the current local directory */
    static applyLocalDirectoryUpdates(
        setLocalDirectory: AppContextType["setLocalDirectory"],
        updates: LocalDirectoryUpdate[]
    ): void {
        setLocalDirectory((current) => {
            const path = current.dir === " " ? current.rootPath : `${current.rootPath}/${current.dir}`;
            const update = updates.find(({ path: updatePath }) => updatePath === path);
            return update ? { ...current, content: update.entries } : current;
        });
    }

    /**
     * Displays a message
     *
     * @param message Message
     * @param duration Display duration
     */
    static showMessage(message: string, duration: MessageDuration = "LONG"): void {
        ToastAndroid.show(message, duration === "LONG" ? ToastAndroid.LONG : ToastAndroid.SHORT);
    }

    /**
     * Maps API validation details to their input fields
     *
     * @param details API validation details
     * @returns Validation messages by field
     */
    static mapValidationErrors<T extends object>(details: ApiValidationErrorDetail[]): ValidationErrors<T> {
        const validationErrors: ValidationErrors<T> = {};
        for (const { field, message } of details) {
            if (field) {
                const key = field as keyof T;
                validationErrors[key] = [...(validationErrors[key] ?? []), `- ${message}`];
            }
        }

        return validationErrors;
    }

    /**
     * Cancels the active file action and restores its source
     *
     * @param context Application context
     * @returns Storage containing the original selection
     */
    static cancelFileAction(context: AppContextType): StorageType {
        const {
            externalRoots,
            ftpSelectionDir,
            internalRoot,
            lastLocalDir,
            lastLocalRootId,
            setActiveStorageRoot,
            setFtpDirectory,
            setLocalDirectory
        } = context;
        const target = UiUtils.getFileActionSource(context);
        if (target === "local") {
            const roots = [internalRoot, ...externalRoots];
            const root = roots.find(({ id }) => id === lastLocalRootId) ?? internalRoot;
            setActiveStorageRoot(root);
            setLocalDirectory((current) => ({ ...current, rootPath: root.path, dir: lastLocalDir }));
        } else {
            setFtpDirectory((current) => ({ ...current, dir: ftpSelectionDir }));
        }

        UiUtils.completeFileAction(context);
        return target;
    }

    /**
     * Clears the active file action and its selection
     *
     * @param context Application context
     */
    static completeFileAction(context: AppContextType): void {
        const { setDirSelected, setFileAction, setModifyFtpFile, setModifyLocalFile } = context;
        setFileAction(null);
        setModifyFtpFile([]);
        setModifyLocalFile([]);
        setDirSelected((current) => !current);
    }

    /**
     * Displays a message when an action is blocked
     *
     * @param condition Whether the action is blocked
     * @param message Blocked action message
     * @returns Whether the action is blocked
     */
    static isActionBlocked(condition: boolean, message: string): boolean {
        if (condition) {
            UiUtils.showMessage(message);
            return true;
        }

        return false;
    }

    private static getFileActionSource(context: AppContextType): StorageType {
        const { fileAction, modifyFtpFile } = context;
        if (fileAction === "download" || (fileAction === "move" && modifyFtpFile.length > 0)) {
            return "ftp";
        }

        return "local";
    }
}
