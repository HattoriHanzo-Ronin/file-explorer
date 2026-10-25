import { createContext, PropsWithChildren, useContext } from "react";
import { useColorScheme } from "react-native";
import { darkTheme, lightTheme, type ThemeMode } from "../styles/style";
import type { ThemeContextValue } from "../types/context";

const ThemeContext = createContext<ThemeContextValue>({ mode: "dark", theme: darkTheme });

export const useTheme = () => useContext(ThemeContext);

export default function ThemeProvider(props: PropsWithChildren) {
    const mode: ThemeMode = useColorScheme() === "light" ? "light" : "dark";
    const value: ThemeContextValue = { mode, theme: mode === "dark" ? darkTheme : lightTheme };

    return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}
