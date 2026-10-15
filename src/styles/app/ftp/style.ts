import { StyleSheet } from "react-native";

export const login = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        gap: 8,
        padding: 32
    },
    title: { color: "black", fontSize: 28, fontWeight: "600", marginBottom: 8 },
    label: { color: "black", fontSize: 16 },
    input: { borderWidth: 1, borderColor: "#777", borderRadius: 6, color: "black", paddingHorizontal: 12, paddingVertical: 10 },
    passwordField: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#777",
        borderRadius: 6,
        paddingRight: 12
    },
    passwordInput: { flex: 1, color: "black", paddingHorizontal: 12, paddingVertical: 10 },
    submitButton: { alignItems: "center", marginTop: 8, paddingVertical: 12, borderRadius: 6, backgroundColor: "#1976d2" },
    submitText: { color: "white", fontSize: 16, fontWeight: "600" },
    error: { color: "#ba1a1a" }
});
