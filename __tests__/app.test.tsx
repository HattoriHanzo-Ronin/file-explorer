/**
 * @format
 */

import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("@react-navigation/native", () => ({
    DarkTheme: { colors: {} },
    DefaultTheme: { colors: {} },
    DrawerActions: { toggleDrawer: jest.fn() },
    NavigationContainer: ({ children }: React.PropsWithChildren) => <>{children}</>
}));

jest.mock("@react-navigation/drawer", () => ({
    createDrawerNavigator: () => ({
        Navigator: ({ children }: React.PropsWithChildren) => <>{children}</>,
        Screen: () => null
    }),
    DrawerContentScrollView: ({ children }: React.PropsWithChildren) => <>{children}</>
}));

jest.mock("react-native-gesture-handler", () => ({
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
    ScrollView: ({ children }: { children: React.ReactNode }) => children
}));

jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));

jest.mock("@react-native-vector-icons/ionicons", () => ({
    __esModule: true,
    default: () => null,
    Ionicons: () => null
}));

jest.mock("../src/components/app-context-provider", () => ({
    __esModule: true,
    default: ({ children }: React.PropsWithChildren) => <>{children}</>,
    useAppContext: jest.fn()
}));

jest.mock("../src/components/theme-provider", () => ({
    __esModule: true,
    default: ({ children }: React.PropsWithChildren) => <>{children}</>,
    useTheme: () => ({ mode: "dark", theme: { text: "white" } })
}));

jest.mock("../src/app/local/index", () => () => null);
jest.mock("../src/app/ftp/index", () => () => null);
jest.mock("../src/components/overflow-menu", () => () => null);
jest.mock("../src/components/user-menu", () => () => null);
jest.mock("../src/components/drawer-navigation-item", () => () => null);
jest.mock("../src/components/shared-files-receiver", () => () => null);

import App from "../app";

test("renders the app shell", () => {
    render(<App />);
});
