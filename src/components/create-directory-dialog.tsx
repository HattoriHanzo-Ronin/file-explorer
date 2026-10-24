import { useRef, useState } from "react";
import { Text, TextInput } from "react-native";
import type { CreateDirectoryRequest } from "../types/ftp";
import type { CreateDirectoryDialogProps } from "../types/components";
import type { ValidationErrors } from "../types/ui";
import { appDialog, overflowMenu } from "../styles/components/style";
import { useTheme } from "./theme-provider";
import { useOperationContext } from "./operation-provider";
import AppDialog from "./dialog";
import UiUtils from "../utils/ui-utils";

/**
 * Creates a directory in a selected destination
 *
 * @author HattoriHanzo-Ronin
 */
export default function CreateDirectoryDialog(props: CreateDirectoryDialogProps) {
    const { dir, onClose, onCreated, rootPath, storage, visible } = props;
    const { theme } = useTheme();
    const { executeApiRequest, executeLocalRequest } = useOperationContext();
    const [name, setName] = useState<string>("");
    const [validationErrors, setValidationErrors] = useState<ValidationErrors<CreateDirectoryRequest>>({});
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const submitting = useRef<boolean>(false);

    async function createDirectory() {
        if (submitting.current) {
            return;
        }

        submitting.current = true;
        setIsSubmitting(true);
        try {
            if (storage === "ftp") {
                const result = await executeApiRequest((apiUtils) => apiUtils.createDirectory({ name, dir }), {
                    isBackground: true
                });
                if (!result.success) {
                    const errors = UiUtils.mapValidationErrors<CreateDirectoryRequest>(result.error.details ?? []);
                    if (Object.keys(errors).length > 0) {
                        setValidationErrors(errors);
                    }

                    return;
                }

                setName("");
                onCreated(result.data);
                onClose(false);
                return;
            }

            const result = await executeLocalRequest(
                (localFileManager) => localFileManager.createDirectory(rootPath, dir, name),
                { isBackground: true }
            );
            if (!result.success) {
                const errors = UiUtils.mapValidationErrors<CreateDirectoryRequest>(result.error.details ?? []);
                if (Object.keys(errors).length > 0) {
                    setValidationErrors(errors);
                }

                return;
            }

            setName("");
            onCreated(result.data);
            onClose(false);
        } finally {
            submitting.current = false;
            setIsSubmitting(false);
        }
    }

    function close() {
        setName("");
        setValidationErrors({});
        onClose(true);
    }

    return (
        <AppDialog
            title="Nueva carpeta"
            visible={visible}
            acceptDisabled={isSubmitting}
            onCancel={close}
            onAccept={() => void createDirectory()}
        >
            <TextInput
                autoFocus
                editable={!isSubmitting}
                returnKeyType="done"
                style={[overflowMenu.input, { borderBottomColor: theme.border, color: theme.text }]}
                value={name}
                onSubmitEditing={() => void createDirectory()}
                onChangeText={(value) => {
                    setName(value);
                    setValidationErrors({});
                }}
            />
            {validationErrors.name?.map((message) => (
                <Text key={message} style={[appDialog.description, { color: theme.danger }]}>
                    {message}
                </Text>
            ))}
        </AppDialog>
    );
}
