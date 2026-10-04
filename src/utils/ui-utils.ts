import { ToastAndroid } from "react-native";
import type { MessageDuration } from "../types/ui";

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
     * Shows the empty selection message
     *
     * @param setVisible Updates menu visibility
     */
    static noElements(setVisible?: (visible: boolean) => void): void {
        UiUtils.showMessage("No hay elementos seleccionados");
        if (setVisible) {
            setVisible(false);
        }
    }
}
