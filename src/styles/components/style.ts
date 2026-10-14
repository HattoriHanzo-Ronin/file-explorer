import { StyleSheet } from "react-native";

export const contentCard = StyleSheet.create({
    large: {
        width: "32%",
        alignItems: "center",
        padding: 8,
        margin: 2,
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
    selected: { backgroundColor: "rgba(255, 255, 255, 0.36)" },
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
    text: { width: "100%", lineHeight: 16, textAlign: "center" },
    listText: { flex: 1, lineHeight: 18 }
});
export const fileList = StyleSheet.create({
    content: { flex: 1 },
    toolbar: {
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 6
    },
    selectAll: { height: 32, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 6 },
    selectAllText: { lineHeight: 20, textAlignVertical: "center", includeFontPadding: false },
    selectAllIcon: { height: 20, lineHeight: 20 },
    viewActions: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
    viewButton: { padding: 6, borderRadius: 6 },
    activeViewButton: { backgroundColor: "rgba(255, 255, 255, 0.36)" }
});
export const background = StyleSheet.create({
    parent: { flex: 1 },
    navImage: { opacity: 0.1 },
    image: { opacity: 0.2 }
});
export const loading = StyleSheet.create({
    parent: { flex: 1, justifyContent: "center", alignItems: "center" },
    image: { width: 200, height: 200 }
});
