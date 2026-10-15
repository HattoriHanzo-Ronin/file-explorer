import { StyleSheet } from "react-native";
import { darkTheme, lightTheme, type ThemeColors, type ThemeMode } from "../style";

function createAppStyles(theme: ThemeColors, mode: ThemeMode) {
    const isDark = mode === "dark";
    return StyleSheet.create({
        header: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 2,
            backgroundColor: theme.header,
            borderBottomWidth: 1,
            borderBottomColor: theme.border
        },
        headerButton: { padding: 6 },
        breadcrumb: {
            flex: 1,
            flexDirection: "row",
            padding: 8,
            marginHorizontal: 2,
            marginVertical: 6,
            backgroundColor: theme.surfaceMuted,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: theme.border
        },
        drawer: { backgroundColor: isDark ? "#0a0d0c" : "#f0f3f0" },
        drawerBackground: { flex: 1, backgroundColor: isDark ? "#0a0d0c" : "#f0f3f0", overflow: "hidden" },
        drawerContent: {
            flex: 1,
            width: "70%",
            backgroundColor: isDark ? "rgba(10, 13, 12, 0.62)" : "rgba(250, 252, 250, 0.75)",
            borderTopRightRadius: 10,
            borderBottomRightRadius: 10,
            overflow: "hidden"
        },
        drawerScrollContent: { paddingTop: 8 },
        drawerItem: { marginHorizontal: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
        activeDrawerItem: { backgroundColor: theme.accentMuted },
        drawerItemText: { color: theme.text, fontSize: 20 },
        drawerFooter: { width: "100%" },
        drawerUser: {
            width: "100%",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingHorizontal: 16,
            paddingVertical: 14
        },
        drawerUserName: { marginRight: 6, color: theme.text, fontSize: 18 },
        breadcrumbText: { color: theme.text }
    });
}

export const appStyles = {
    dark: createAppStyles(darkTheme, "dark"),
    light: createAppStyles(lightTheme, "light")
};

export const app = appStyles.dark;
