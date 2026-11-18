import { createContext, PropsWithChildren, useContext } from "react";
import { useColorScheme } from "react-native";
import { DARK_THEME, LIGHT_THEME, type ThemeMode } from "../styles/style";
import type { ThemeContextValue } from "../types/context";

const ThemeContext = createContext<ThemeContextValue>({ mode: "dark", theme: DARK_THEME });

export const useTheme = () => useContext(ThemeContext);

export default function ThemeProvider(props: PropsWithChildren) {
    const mode: ThemeMode = useColorScheme() === "light" ? "light" : "dark";
    const value: ThemeContextValue = { mode, theme: mode === "dark" ? DARK_THEME : LIGHT_THEME };

    return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}
