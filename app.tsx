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
import { Pressable, StyleSheet, View } from "react-native";
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
            <View style={styles.drawerContent}>
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
                            navigation.navigate("ftp", { screen: "login" });
                            handleNavigationPress(context, "ftp");
                        }}
                    />
                </DrawerContentScrollView>
                {context.lastComponent === "ftp" && context.isAuthenticated && (
                    <View style={styles.drawerFooter}>
                        <DrawerItem
                            label="Cerrar sesión"
                            icon={LogoutIcon}
                            onPress={async () => {
                                navigation.closeDrawer();
                                await context.loadingUtils.run(() => context.authUtils.logout());
                            }}
                        />
                    </View>
                )}
            </View>
        </Background>
    );
};
const AppHeader = (props: DrawerHeaderProps) => {
    const { navigation } = props;
    const { isAuthenticated, lastComponent } = useAppContext();
    const safeArea = useSafeAreaInsets().top;

    return (
        <Background type="tab">
            <View style={{ flexDirection: "row", padding: "2%", paddingTop: safeArea }}>
                <Pressable onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}>
                    <Ionicons name="menu" size={30} />
                </Pressable>
                {(lastComponent !== "ftp" || isAuthenticated) && (
                    <View style={{ alignSelf: "flex-end", marginLeft: "85%" }}>
                        <OverflowMenu />
                    </View>
                )}
            </View>
        </Background>
    );
};

const LogoutIcon = (props: { color: string; size: number }) => {
    const { color, size } = props;
    return <Ionicons name="log-out-outline" color={color} size={size} />;
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

const styles = StyleSheet.create({
    drawerContent: {
        flex: 1
    },
    drawerFooter: {
        alignSelf: "flex-end"
    }
});
