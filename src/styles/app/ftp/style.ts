import { StyleSheet } from "react-native";
import { darkTheme, lightTheme, type ThemeColors } from "../../style";

function createLoginStyles(theme: ThemeColors) {
    return StyleSheet.create({
        container: {
            flex: 1,
            justifyContent: "center",
            gap: 8,
            padding: 32
        },
        title: { color: theme.text, fontSize: 28, fontWeight: "600", marginBottom: 8 },
        label: { color: theme.text, fontSize: 16 },
        input: {
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 6,
            color: theme.text,
            paddingHorizontal: 12,
            paddingVertical: 10
        },
        passwordField: {
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 6,
            paddingRight: 12
        },
        passwordInput: { flex: 1, color: theme.text, paddingHorizontal: 12, paddingVertical: 10 },
        submitButton: {
            alignItems: "center",
            marginTop: 8,
            paddingVertical: 12,
            borderRadius: 6,
            backgroundColor: theme.accent
        },
        submitText: { color: theme.text, fontSize: 16, fontWeight: "600" },
        error: { color: theme.danger }
    });
}

export const loginStyles = { dark: createLoginStyles(darkTheme), light: createLoginStyles(lightTheme) };
