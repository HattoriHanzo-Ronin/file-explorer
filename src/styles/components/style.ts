import { StyleSheet } from "react-native";

export const contentCard = StyleSheet.create({
    parent: {
        height: 100,
        width: "33.33%",
        alignItems: "center",
        padding: 8
    },
    selected: { backgroundColor: "rgba(255, 255, 255, 0.36)" },
    icon: { height: 64, width: 64 }
});
export const breadcrumb = StyleSheet.create({
    parent: {
        flexDirection: "row",
        padding: 8,
        marginHorizontal: 6,
        backgroundColor: "rgba(255, 255, 255, 0.25)",
        borderRadius: 10
    }
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
