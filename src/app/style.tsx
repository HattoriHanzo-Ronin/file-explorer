import { StyleSheet } from "react-native";

export const contentCard = StyleSheet.create({
    parent: {
        height: 100,
        width: "26.33%",
        alignItems: "center",
        margin: "4%",
        padding: "1%"
    },
    selected: { backgroundColor: "rgba(255, 255, 255, 0.36)" },
    icon: { height: "80%", width: "80%" }
});
export const breadcrumb = StyleSheet.create({
    parent: {
        flexDirection: "row",
        padding: "2%",
        marginRight: "1.5%",
        marginLeft: "1.5%",
        backgroundColor: "rgba(255, 255, 255, 0.25)",
        borderRadius: 10
    }
});
export const background = StyleSheet.create({
    parent: { flex: 1 },
    navImage: { opacity: 0.1 },
    image: { opacity: 0.2 }
});
export const explorer = StyleSheet.create({
    content: { flex: 1, padding: "2%" }
});
export const loading = StyleSheet.create({
    parent: { flex: 1, justifyContent: "center", alignItems: "center" },
    image: { width: 200, height: 200 }
});
