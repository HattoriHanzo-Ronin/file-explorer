import { StyleSheet } from "react-native";

export type ThemeMode = "dark" | "light";

export interface ThemeColors {
    background: string;
    header: string;
    surface: string;
    surfaceMuted: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    accentMuted: string;
    danger: string;
}

export const darkTheme: ThemeColors = {
    background: "#0b0e0d",
    header: "#0e1211",
    surface: "rgba(14, 18, 17, 0.88)",
    surfaceMuted: "rgba(25, 30, 28, 0.8)",
    border: "rgba(230, 235, 232, 0.28)",
    text: "#f4f8f5",
    textMuted: "#b8c4bc",
    accent: "#35ad65",
    accentMuted: "rgba(53, 173, 101, 0.3)",
    danger: "#c8737c"
};

export const lightTheme: ThemeColors = {
    background: "#eef2ef",
    header: "#fafcfa",
    surface: "rgba(250, 252, 250, 0.9)",
    surfaceMuted: "rgba(255, 255, 255, 0.76)",
    border: "rgba(24, 39, 31, 0.22)",
    text: "#101713",
    textMuted: "#526057",
    accent: "#278e52",
    accentMuted: "rgba(39, 142, 82, 0.22)",
    danger: "#a65d66"
};

function createCommonStyles(theme: ThemeColors, mode: ThemeMode) {
    const isDark = mode === "dark";
    const overlay = isDark
        ? ["rgba(10, 13, 12, 0.4)", "rgba(10, 13, 12, 0.64)", "rgba(4, 6, 6, 0.88)"]
        : ["rgba(255, 255, 255, 0.22)", "rgba(245, 248, 245, 0.52)", "rgba(232, 237, 233, 0.8)"];
    return StyleSheet.create({
        root: { flex: 1 },
        background: { flex: 1, backgroundColor: theme.background },
        absoluteImage: {
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%"
        },
        backgroundImage: { opacity: isDark ? 0.14 : 0.26 },
        contentBackgroundImage: {
            opacity: isDark ? 0.32 : 0.38,
            filter: isDark
                ? [{ grayscale: 0.65 }, { saturate: 0.3 }, { contrast: 0.9 }]
                : [{ grayscale: 0.45 }, { saturate: 0.45 }, { contrast: 0.92 }]
        },
        backgroundOverlay: {
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundImage: [
                {
                    type: "radial-gradient",
                    shape: "ellipse",
                    size: "farthest-corner",
                    position: { top: "50%", left: "50%" },
                    colorStops: [
                        { color: overlay[0], positions: ["0%"] },
                        { color: overlay[1], positions: ["58%"] },
                        { color: overlay[2], positions: ["100%"] }
                    ]
                }
            ]
        },
        explorerContent: { flex: 1, padding: 8 }
    });
}

export const commonStyles = {
    dark: createCommonStyles(darkTheme, "dark"),
    light: createCommonStyles(lightTheme, "light")
};

export const common = commonStyles.dark;
