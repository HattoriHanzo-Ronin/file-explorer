import { ToastAndroid } from "react-native";
import type { AppContextType } from "../types/context";
import type { StorageType } from "../types/navigation";
import type { MessageDuration, ValidationErrors } from "../types/ui";
import type { ApiValidationErrorDetail } from "../types/api-error";

/**
 * Manages application messages
 */
export default class UiUtils {
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
        const target = UiUtils.getFileActionSource(context);
        if (target === "local") {
            const roots = [context.internalRoot, ...context.externalRoots];
            const root = roots.find((it) => it.id === context.lastLocalRootId) ?? context.internalRoot;
            context.setActiveStorageRoot(root);
            context.setLocalDirectory((current) => ({ ...current, dir: context.lastLocalDir }));
        } else {
            context.setFtpDirectory((current) => ({ ...current, dir: context.ftpSelectionDir }));
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
        context.setFileAction(null);
        context.setModifyFtpFile([]);
        context.setModifyLocalFile([]);
        context.setDirSelected((current) => !current);
    }

    static isActionBlocked(condition: boolean, message: string): boolean {
        if (condition) {
            UiUtils.showMessage(message);
            return true;
        }

        return false;
    }

    private static getFileActionSource(context: AppContextType): StorageType {
        if (context.fileAction === "download" || (context.fileAction === "move" && context.modifyFtpFile.length > 0)) {
            return "ftp";
        }

        return "local";
    }
}
