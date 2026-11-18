import { StyleSheet } from "react-native";
import { DARK_THEME } from "../style";

export const CONTENT_CARD = StyleSheet.create({
    large: {
        width: "32%",
        alignItems: "center",
        padding: 8,
        margin: 2
    },
    small: {
        width: "24%",
        alignItems: "center",
        padding: 6,
        margin: 2
    },
    list: {
        width: "48%",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 6,
        gap: 12,
        margin: 2
    },
    selected: { backgroundColor: DARK_THEME.accentMuted, borderRadius: 8 },
    thumbnailLarge: { height: 86, width: 86, alignItems: "center", justifyContent: "center" },
    thumbnailSmall: { height: 64, width: 64, alignItems: "center", justifyContent: "center" },
    thumbnailList: { height: 48, width: 48, alignItems: "center", justifyContent: "center" },
    iconLarge: { height: 86, width: 86 },
    iconSmall: { height: 64, width: 64 },
    iconList: { height: 48, width: 48 },
    videoOverlay: {
        position: "absolute",
        alignItems: "center",
        justifyContent: "center",
        height: 32,
        width: 32,
        borderRadius: 16,
        backgroundColor: "rgba(0, 0, 0, 0.55)"
    },
    text: { width: "100%", color: DARK_THEME.text, fontSize: 16, lineHeight: 18, textAlign: "center" },
    listText: { flex: 1, color: DARK_THEME.text, fontSize: 16, lineHeight: 20 }
});
export const FILE_LIST = StyleSheet.create({
    content: { flex: 1 },
    toolbar: {
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 6
    },
    selectAll: { height: 32, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 6 },
    selectAllText: { color: DARK_THEME.text, lineHeight: 20, textAlignVertical: "center", includeFontPadding: false },
    selectAllIcon: { height: 20, lineHeight: 20 },
    viewActions: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
    viewButton: { padding: 6, borderRadius: 6 },
    activeViewButton: { backgroundColor: DARK_THEME.accentMuted }
});
export const APP_DIALOG = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.5)" },
    container: {
        width: "82%",
        padding: 20,
        borderRadius: 8,
        backgroundColor: DARK_THEME.surface,
        borderWidth: 1,
        borderColor: DARK_THEME.border
    },
    description: { marginBottom: 12, color: DARK_THEME.text, fontSize: 16 },
    message: { color: DARK_THEME.text, fontSize: 18 },
    input: { borderBottomWidth: 1, borderBottomColor: DARK_THEME.border, color: DARK_THEME.text, paddingVertical: 6 },
    actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 18 },
    button: { paddingHorizontal: 10, paddingVertical: 8 },
    cancelText: { color: "#a65d66", fontWeight: "600" },
    acceptText: { color: DARK_THEME.accent, fontWeight: "600" }
});
export const OVERFLOW_MENU = StyleSheet.create({
    backdrop: { flex: 1, alignItems: "flex-end", paddingTop: 52, paddingRight: 8, backgroundColor: "transparent" },
    container: {
        minWidth: 190,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: DARK_THEME.surface,
        borderWidth: 1,
        borderColor: DARK_THEME.border,
        elevation: 6
    },
    item: { paddingHorizontal: 18, paddingVertical: 12 },
    itemText: { color: DARK_THEME.text, fontSize: 16 },
    input: { borderBottomWidth: 1, borderBottomColor: DARK_THEME.border, color: DARK_THEME.text, paddingVertical: 6 },
    validationError: { marginTop: 6, color: "#a65d66" }
});
export const USER_MENU = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: "flex-end",
        alignItems: "flex-start",
        backgroundColor: "rgba(0, 0, 0, 0.25)"
    },
    container: {
        width: "80%",
        marginBottom: 72,
        marginLeft: 8,
        padding: 16,
        borderRadius: 12,
        backgroundColor: DARK_THEME.surface,
        borderWidth: 1,
        borderColor: DARK_THEME.border,
        elevation: 6
    },
    username: { marginBottom: 12, color: DARK_THEME.text, fontSize: 18, fontWeight: "600" },
    option: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
    optionText: { color: DARK_THEME.text, fontSize: 16 },
    logoutText: { color: "#a65d66", fontSize: 16 },
    cancelText: { color: "#a65d66", fontSize: 16 },
    acceptText: { color: DARK_THEME.text, fontSize: 16 },
    dialogBackdrop: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0, 0, 0, 0.65)" },
    dialog: {
        padding: 16,
        borderRadius: 12,
        backgroundColor: DARK_THEME.surface,
        borderWidth: 1,
        borderColor: DARK_THEME.border,
        gap: 12
    },
    dialogTitle: { color: DARK_THEME.text, fontSize: 18, fontWeight: "600" },
    input: { padding: 10, borderWidth: 1, borderColor: DARK_THEME.border, borderRadius: 6, color: DARK_THEME.text },
    fieldLabel: { color: DARK_THEME.text, fontSize: 16 },
    validationError: { marginTop: 6, color: "#a65d66" },
    lineInput: { borderBottomWidth: 1, borderBottomColor: DARK_THEME.border, color: DARK_THEME.text, paddingVertical: 6 },
    passwordField: {
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: DARK_THEME.border
    },
    passwordInput: { flex: 1, color: DARK_THEME.text },
    dialogActions: { flexDirection: "row", justifyContent: "flex-end", gap: 20 }
});
export const LOADING = StyleSheet.create({
    parent: { flex: 1, justifyContent: "center", alignItems: "center" },
    image: { width: 200, height: 200 },
    backgroundImage: { opacity: 0.1 }
});
export const OPERATION_DESTINATION = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "center", padding: 16, backgroundColor: "rgba(0, 0, 0, 0.56)" },
    container: { maxHeight: "88%", padding: 14, borderRadius: 12, borderWidth: 1 },
    titleRow: { marginBottom: 16 },
    title: { fontSize: 17, fontWeight: "700" },
    label: { marginBottom: 6, fontSize: 13 },
    storage: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 10 },
    storageText: { flex: 1, fontSize: 15, fontWeight: "600" },
    roots: { marginTop: 4, borderWidth: 1, borderRadius: 8, overflow: "hidden" },
    root: { paddingHorizontal: 14, paddingVertical: 10 },
    rootText: { fontSize: 15 },
    pathRow: { width: "100%", marginTop: 12 },
    create: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 8 },
    createText: { fontSize: 13, fontWeight: "600" },
    directoryList: { height: 220, marginTop: 8, borderWidth: 1, borderRadius: 10, overflow: "hidden" },
    directory: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14 },
    directoryText: { flex: 1, fontSize: 15 },
    parentDirectoryText: { color: DARK_THEME.textMuted },
    loading: { flex: 1, minHeight: 150 },
    footer: { marginTop: 4 },
    actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
    cancel: { paddingHorizontal: 14, paddingVertical: 10 },
    cancelText: { fontWeight: "600" },
    accept: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
    acceptText: { color: "#ffffff", fontWeight: "700" }
});
