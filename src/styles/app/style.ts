import { StyleSheet } from "react-native";

export const app = StyleSheet.create({
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 2
    },
    headerButton: { padding: 6 },
    breadcrumb: {
        flex: 1,
        flexDirection: "row",
        padding: 8,
        marginHorizontal: 2,
        marginVertical: 6,
        backgroundColor: "rgba(255, 255, 255, 0.25)",
        borderRadius: 10
    },
    drawerContent: { flex: 1 },
    drawerFooter: { alignSelf: "flex-end" }
});
