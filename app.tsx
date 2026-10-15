import { DarkTheme, DefaultTheme, DrawerActions, NavigationContainer } from "@react-navigation/native";
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
import { appStyles } from "./src/styles/app/style";
import { commonStyles } from "./src/styles/style";
import { Image, Pressable, StatusBar, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Local from "./src/app/local/index";
import Ftp from "./src/app/ftp/index";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import OverflowMenu from "./src/app/_overflow-menu";
import UserMenu from "./src/app/_user-menu";
import { handleNavigationPress, openStorage } from "./src/utils/navigation-utils";
import ThemeProvider, { useTheme } from "./src/components/theme-provider";

const Drawer = createDrawerNavigator();

const AppDrawerContent = (props: DrawerContentComponentProps) => {
    const { navigation, state } = props;
    const context = useAppContext();
    const { mode, theme } = useTheme();
    const app = appStyles[mode];
    const common = commonStyles[mode];
    const { externalRoots, internalRoot, user } = context;
    const [userMenuVisible, setUserMenuVisible] = React.useState<boolean>(false);
    const safeArea = useSafeAreaInsets();
    const storage = state.routes[state.index].name as StorageType;

    return (
        <View style={app.drawerBackground}>
            <Image
                source={require("./assets/images/back-nav.jpg")}
                resizeMode="cover"
                style={[common.absoluteImage, common.backgroundImage]}
            />
            <View style={[app.drawerContent, { paddingTop: safeArea.top + 12 }]}>
                <DrawerContentScrollView contentContainerStyle={app.drawerScrollContent}>
                    <DrawerItem
                        label={() => (
                            <Text numberOfLines={3} style={app.drawerItemText}>
                                {internalRoot.name}
                            </Text>
                        )}
                        activeTintColor={theme.text}
                        activeBackgroundColor={theme.accentMuted}
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
                            label={() => (
                                <Text numberOfLines={3} style={app.drawerItemText}>
                                    {root.name}
                                </Text>
                            )}
                            activeTintColor={theme.text}
                            activeBackgroundColor={theme.accentMuted}
                            onPress={() => {
                                openStorage(context, root);
                                navigation.navigate("local");
                                navigation.closeDrawer();
                                handleNavigationPress(context, "local");
                            }}
                        />
                    ))}
                    <DrawerItem
                        label={() => <Text style={app.drawerItemText}>FTP</Text>}
                        activeTintColor={theme.text}
                        activeBackgroundColor={theme.accentMuted}
                        onPress={() => {
                            navigation.navigate("ftp", { screen: "login" });
                            navigation.closeDrawer();
                            handleNavigationPress(context, "ftp");
                        }}
                    />
                </DrawerContentScrollView>
                {storage === "ftp" && context.isAuthenticated && (
                    <View style={[app.drawerFooter, { paddingBottom: safeArea.bottom }]}>
                        <Pressable style={app.drawerUser} onPress={() => setUserMenuVisible(true)}>
                            <Text style={app.drawerUserName}>{user?.username ?? "Usuario"}</Text>
                            <Ionicons name="open-outline" color={theme.text} size={24} />
                        </Pressable>
                    </View>
                )}
                <UserMenu
                    visible={userMenuVisible}
                    onClose={() => setUserMenuVisible(false)}
                    onLogout={() => navigation.closeDrawer()}
                />
            </View>
        </View>
    );
};
const AppHeader = (props: DrawerHeaderProps) => {
    const { navigation, route } = props;
    const { isAuthenticated } = useAppContext();
    const { mode, theme } = useTheme();
    const app = appStyles[mode];
    const storage = route.name as StorageType;
    const safeArea = useSafeAreaInsets().top;
    const showActions = storage !== "ftp" || isAuthenticated;

    return (
        <View style={[app.header, { paddingTop: safeArea }]}>
            <Pressable style={app.headerButton} onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}>
                <Ionicons name="menu" color={theme.text} size={30} />
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
    const { mode, theme } = useTheme();
    const app = appStyles[mode];
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
                    <Text style={app.breadcrumbText}>
                        /{" "}
                        {currentDir !== " " && (
                            <Ionicons name="chevron-forward-outline" color={theme.text} size={10} />
                        )}{" "}
                    </Text>
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
                        <Text style={app.breadcrumbText}>
                            {path}{" "}
                            {path !== " " && index !== paths.length - 1 && (
                                <Ionicons name="chevron-forward-outline" color={theme.text} size={10} />
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
        <ThemeProvider>
            <ThemedApp />
        </ThemeProvider>
    );
}

function ThemedApp() {
    const { mode, theme } = useTheme();
    const app = appStyles[mode];
    const common = commonStyles[mode];
    const navigationTheme = mode === "dark" ? DarkTheme : DefaultTheme;
    return (
        <AppContextProvider>
            <PaperProvider>
                <GestureHandlerRootView style={common.root}>
                    <View style={common.background}>
                        <Image
                            source={require("./assets/images/background.jpg")}
                            resizeMode="cover"
                            style={[common.absoluteImage, common.contentBackgroundImage]}
                        />
                        <View pointerEvents="none" style={common.backgroundOverlay} />
                        <StatusBar barStyle={mode === "dark" ? "light-content" : "dark-content"} />
                        <NavigationContainer
                            theme={{
                                ...navigationTheme,
                                colors: {
                                    ...navigationTheme.colors,
                                    background: "transparent",
                                    card: "transparent",
                                    text: theme.text
                                }
                            }}
                        >
                            <Drawer.Navigator
                                drawerContent={(props) => <AppDrawerContent {...props} />}
                                screenOptions={{
                                    drawerStyle: app.drawer,
                                    header: (props) => <AppHeader {...props} />
                                }}
                            >
                                <Drawer.Screen name="local" component={Local} />
                                <Drawer.Screen name="ftp" component={Ftp} />
                            </Drawer.Navigator>
                        </NavigationContainer>
                    </View>
                </GestureHandlerRootView>
            </PaperProvider>
        </AppContextProvider>
    );
}
