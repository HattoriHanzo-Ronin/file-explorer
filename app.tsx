import { DrawerActions, NavigationContainer } from "@react-navigation/native";
import {
    createDrawerNavigator,
    DrawerContentScrollView,
    DrawerItem,
    DrawerContentComponentProps,
    DrawerHeaderProps
} from "@react-navigation/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import React from "react";
import { PaperProvider } from "react-native-paper";
import AppContextProvider, { useAppContext } from "./src/components/app-context-provider";
import type { AppContextType } from "./src/types/context";
import Background from "./src/components/background";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Local from "./src/app/local/index";
import Ftp from "./src/app/ftp/index";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import OverflowMenu from "./src/components/overflow-menu";

const Drawer = createDrawerNavigator();
const AppDrawerContent = (props: DrawerContentComponentProps) => {
    const { navigation } = props;
    const context = useAppContext();

    return (
        <Background type="nav">
            <DrawerContentScrollView>
                <DrawerItem
                    label="Almacenamiento Local"
                    onPress={() => {
                        navigation.navigate("local");
                        handleNavigationPress(context, "local");
                    }}
                />
                <DrawerItem
                    label="FTP"
                    onPress={() => {
                        navigation.navigate("ftp");
                        handleNavigationPress(context, "ftp");
                    }}
                />
            </DrawerContentScrollView>
        </Background>
    );
};
const AppHeader = (props: DrawerHeaderProps) => {
    const { navigation } = props;
    const safeArea = useSafeAreaInsets().top;

    return (
        <Background type="tab">
            <View style={{ flexDirection: "row", padding: "2%", paddingTop: safeArea }}>
                <Pressable onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}>
                    <Ionicons name="menu" size={30} />
                </Pressable>
                <View style={{ alignSelf: "flex-end", marginLeft: "85%" }}>
                    <OverflowMenu />
                </View>
            </View>
        </Background>
    );
};
const handleNavigationPress = (context: AppContextType, name: string) => {
    context.setLastComponent(name);
    if (context.lastFtpDir !== " ") {
        context.setLastFtpDir(" ");
    }

    if (context.lastLocalDir !== " ") {
        context.setLastLocalDir(" ");
    }

    if (context.modifyFtpFile.length > 0 || context.modifyLocalFile.length > 0) {
        if (context.modifyFtpFile.length > 0) {
            context.setModifyFtpFile([]);
        }

        if (context.modifyLocalFile.length > 0) {
            context.setModifyLocalFile([]);
        }

        context.setResetTitle(!context.resetTitle);
        context.setDirSelected(!context.dirSelected);
    }
};

export default function App() {
    return (
        <AppContextProvider>
            <PaperProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <NavigationContainer>
                        <Drawer.Navigator
                            drawerContent={(props) => <AppDrawerContent {...props} />}
                            screenOptions={{ header: (props) => <AppHeader {...props} /> }}
                        >
                            <Drawer.Screen name="local" component={Local} />
                            <Drawer.Screen name="ftp" component={Ftp} />
                        </Drawer.Navigator>
                    </NavigationContainer>
                </GestureHandlerRootView>
            </PaperProvider>
        </AppContextProvider>
    );
}
