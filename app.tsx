import { DrawerActions, NavigationContainer } from "@react-navigation/native";
import {
    createDrawerNavigator,
    DrawerContentScrollView,
    DrawerItem,
    DrawerContentComponentProps,
    DrawerHeaderProps
} from "@react-navigation/drawer";
import { GestureHandlerRootView, ScrollView } from "react-native-gesture-handler";
import React, { useRef, type ComponentRef } from "react";
import { PaperProvider } from "react-native-paper";
import AppContextProvider, { useAppContext } from "./src/components/app-context-provider";
import type { StorageType } from "./src/types/navigation";
import { app } from "./src/styles/app/style";
import { common } from "./src/styles/style";
import Background from "./src/components/background";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Local from "./src/app/local/index";
import Ftp from "./src/app/ftp/index";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import OverflowMenu from "./src/app/_overflow-menu";
import UserMenu from "./src/app/_user-menu";
import { handleNavigationPress, openStorage } from "./src/utils/navigation-utils";

const Drawer = createDrawerNavigator();

const AppDrawerContent = (props: DrawerContentComponentProps) => {
    const { navigation, state } = props;
    const context = useAppContext();
    const { externalRoots, internalRoot, user } = context;
    const [userMenuVisible, setUserMenuVisible] = React.useState<boolean>(false);
    const safeArea = useSafeAreaInsets();
    const storage = state.routes[state.index].name as StorageType;

    return (
        <Background type="nav">
            <View style={app.drawerContent}>
                <DrawerContentScrollView>
                    <DrawerItem
                        label={internalRoot.name}
                        onPress={() => {
                            openStorage(context, internalRoot);
                            navigation.navigate("local");
                            navigation.closeDrawer();
                            handleNavigationPress(context, "local");
                        }}
                    />
                    {externalRoots.map((root) => (
                        <DrawerItem
                            key={root.id}
                            label={root.name}
                            onPress={() => {
                                openStorage(context, root);
                                navigation.navigate("local");
                                navigation.closeDrawer();
                                handleNavigationPress(context, "local");
                            }}
                        />
                    ))}
                    <DrawerItem
                        label="FTP"
                        onPress={() => {
                            navigation.navigate("ftp", { screen: "login" });
                            handleNavigationPress(context, "ftp");
                        }}
                    />
                </DrawerContentScrollView>
                {storage === "ftp" && context.isAuthenticated && (
                    <View style={[app.drawerFooter, { paddingBottom: safeArea.bottom }]}>
                        <Pressable
                            style={app.drawerUser}
                            onPress={() => setUserMenuVisible(true)}
                        >
                            <Text style={app.drawerUserName}>{user?.username ?? "Usuario"}</Text>
                            <Ionicons name="open-outline" color="black" size={24} />
                        </Pressable>
                    </View>
                )}
                <UserMenu visible={userMenuVisible} onClose={() => setUserMenuVisible(false)} />
            </View>
        </Background>
    );
};
const AppHeader = (props: DrawerHeaderProps) => {
    const { navigation, route } = props;
    const { isAuthenticated } = useAppContext();
    const storage = route.name as StorageType;
    const safeArea = useSafeAreaInsets().top;
    const showActions = storage !== "ftp" || isAuthenticated;

    return (
        <View style={[app.header, { paddingTop: safeArea }]}>
            <Pressable style={app.headerButton} onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}>
                <Ionicons name="menu" size={30} />
            </Pressable>
            {showActions && (
                <>
                    <AppBreadcrumb storage={storage} />
                    <View style={app.headerButton}>
                        <OverflowMenu storage={storage} />
                    </View>
                </>
            )}
        </View>
    );
};

const AppBreadcrumb = (props: { storage: StorageType }) => {
    const {
        fileAction,
        ftpDirectory,
        localDirectory,
        modifyFtpFile,
        modifyLocalFile,
        setFtpDirectory,
        setLocalDirectory,
        setModifyFtpFile,
        setModifyLocalFile
    } = useAppContext();
    const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
    const currentDir = props.storage === "ftp" ? ftpDirectory.dir : localDirectory.dir;
    const paths = currentDir.split("/");

    function navigateTo(dir: string) {
        if (props.storage === "ftp") {
            if (modifyFtpFile.length > 0 && !fileAction) {
                setModifyFtpFile([]);
            }

            setFtpDirectory((current) => ({ ...current, dir }));
            return;
        }

        if (modifyLocalFile.length > 0 && !fileAction) {
            setModifyLocalFile([]);
        }

        setLocalDirectory((current) => ({ ...current, dir }));
    }

    return (
        <View style={app.breadcrumb}>
            <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
                <Pressable onPress={() => navigateTo(" ")}>
                    <Text>/ {currentDir !== " " && <Ionicons name="chevron-forward-outline" size={10} />} </Text>
                </Pressable>
                {paths.map((path, index) => (
                    <Pressable
                        key={`${path}${index}`}
                        onPress={() => {
                            if (index !== paths.length - 1) {
                                navigateTo(paths.slice(0, index + 1).join("/"));
                            }
                        }}
                    >
                        <Text>
                            {path}{" "}
                            {path !== " " && index !== paths.length - 1 && (
                                <Ionicons name="chevron-forward-outline" size={10} />
                            )}{" "}
                        </Text>
                    </Pressable>
                ))}
            </ScrollView>
        </View>
    );
};

export default function App() {
    return (
        <AppContextProvider>
            <PaperProvider>
                <GestureHandlerRootView style={common.root}>
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
