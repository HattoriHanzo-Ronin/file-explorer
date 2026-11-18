import { ToastAndroid } from "react-native";
import type { LocalDirectoryUpdatesParams, MessageParams, ValidationErrors } from "../types/ui";
import type { ValidationErrorDetail } from "../types/response";
import type { FileOperationSnapshot } from "../types/file-operations";
import { FILE_OPERATION_COMPLETED_MESSAGES, FILE_OPERATION_NOTIFICATION_TEXTS } from "../constants/file-operations";

/**
 * Manages application messages
 *
 * @author HattoriHanzo-Ronin
 */
export default class UiUtils {
    /** Returns a listener for foreground operation messages */
    static createFileOperationMessageListener(): (operation: FileOperationSnapshot) => void {
        const operations = new Map<string, { revision: number; started: boolean; finished: boolean }>();
        return ({ error, id, operation, revision, status }) => {
            const previous = operations.get(id);
            if (previous && (previous.finished || revision <= previous.revision)) {
                return;
            }

            const active = ["PENDING", "RUNNING"].includes(status);
            if (active && !previous?.started) {
                UiUtils.showMessage({ message: FILE_OPERATION_NOTIFICATION_TEXTS.running, duration: "SHORT" });
            }

            UiUtils.showOperationResult({ error, operation, status });

            operations.set(id, { revision, started: active || !!previous?.started, finished: !active });
        };
    }

    /**
     * Applies a result when it matches the current local directory
     *
     * @param params.setLocalDirectory Directory state updater
     * @param params.updates Updated directories
     */
    static applyLocalDirectoryUpdates(params: LocalDirectoryUpdatesParams): void {
        const { setLocalDirectory, updates } = params;
        setLocalDirectory((current) => {
            const path = current.dir === " " ? current.rootPath : `${current.rootPath}/${current.dir}`;
            const update = updates.find(({ path: updatePath }) => updatePath === path);
            return update ? { ...current, content: update.entries } : current;
        });
    }

    /**
     * Displays a message
     *
     * @param params.message Message
     * @param params.duration Display duration
     */
    static showMessage(params: MessageParams): void {
        const { message, duration = "LONG" } = params;
        ToastAndroid.show(message, duration === "LONG" ? ToastAndroid.LONG : ToastAndroid.SHORT);
    }

    /**
     * Maps API validation details to their input fields
     *
     * @param details API validation details
     * @returns Validation messages by field
     */
    static mapValidationErrors<T extends object>(details: ValidationErrorDetail[]): ValidationErrors<T> {
        const validationErrors: ValidationErrors<T> = {};
        for (const { field, message } of details) {
            if (field) {
                const key = field as keyof T;
                validationErrors[key] = [...(validationErrors[key] ?? []), `- ${message}`];
            }
        }

        return validationErrors;
    }

    private static showOperationResult(result: Pick<FileOperationSnapshot, "error" | "operation" | "status">): void {
        const { error, operation, status } = result;
        if (status === "COMPLETED" && !["LOCAL_MKDIR", "LOCAL_RENAME"].includes(operation)) {
            UiUtils.showMessage({ message: FILE_OPERATION_COMPLETED_MESSAGES[operation] });
        }

        if (status === "CANCELLED") {
            UiUtils.showMessage({ message: FILE_OPERATION_NOTIFICATION_TEXTS.cancelled });
        }

        if (status === "FAILED") {
            UiUtils.showOperationFailure(operation, error);
        }
    }

    private static showOperationFailure(
        operation: FileOperationSnapshot["operation"],
        error: FileOperationSnapshot["error"]
    ): void {
        if (["INVALID_TOKEN", "VALIDATION_FAILED"].includes(error?.code ?? "")) {
            return;
        }

        const dialogOperation = ["REMOTE_MKDIR", "REMOTE_RENAME", "LOCAL_MKDIR", "LOCAL_RENAME"].includes(operation);
        if (dialogOperation || !error?.message) {
            UiUtils.showMessage({ message: error?.message || FILE_OPERATION_NOTIFICATION_TEXTS.failed });
        }
    }
}
