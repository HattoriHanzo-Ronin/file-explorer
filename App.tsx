import { DrawerActions, NavigationContainer, useNavigation } from "@react-navigation/native";
import {
    createDrawerNavigator,
    DrawerContentScrollView,
    DrawerItem,
    DrawerNavigationProp,
    DrawerContentComponentProps,
    DrawerHeaderProps
} from "@react-navigation/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import React, { useEffect, useState } from "react";
import { Menu, PaperProvider } from "react-native-paper";
import AppContextProvider, { ContextType, useAppContext } from "./src/components/AppContextProvider";
import Background from "./src/components/Background";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Local from "./src/app/local";
import Ftp from "./src/app/ftp";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
    CopyMenu,
    DownloadMenu,
    MakeDir,
    MoveMenu,
    RemoveMenu,
    RenameMenu,
    UploadMenu
} from "./src/components/MenuItems";

type NavigationType = DrawerNavigationProp<{ local: undefined; ftp: undefined }>;

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
const OverflowMenu = () => {
    const [visible, setVisible] = useState<boolean>(false);
    const [copyTitle, setCopyTitle] = useState<string>("Copiar");
    const [moveTitle, setMoveTitle] = useState<string>("Mover");
    const context = useAppContext();
    const navigation = useNavigation<NavigationType>();

    useEffect(() => {
        if (copyTitle === "Pegar") {
            setCopyTitle("Copiar");
        }

        if (moveTitle === "Pegar") {
            setMoveTitle("Mover");
        }

        context.setOnCopy(false);
    }, [context.resetTitle]);

    return (
        <Menu
            visible={visible}
            onDismiss={() => setVisible(false)}
            anchor={<Ionicons name="ellipsis-vertical-outline" size={25} onPress={() => setVisible(true)} />}
        >
            {(context.lastComponent === "local" || context.modifyLocalFile.length > 0) &&
                context.modifyFtpFile.length < 1 && (
                    <UploadMenu navigation={navigation} setVisible={setVisible} context={context} />
                )}
            {(context.lastComponent === "ftp" || context.modifyFtpFile.length > 0) &&
                context.modifyLocalFile.length < 1 && (
                    <DownloadMenu navigation={navigation} setVisible={setVisible} context={context} />
                )}
            {context.lastComponent === "local" && (
                <>
                    <CopyMenu
                        setVisible={setVisible}
                        title={copyTitle}
                        setTitle={(title: string) => setCopyTitle(title)}
                        context={context}
                    />
                    <MoveMenu
                        setVisible={setVisible}
                        title={moveTitle}
                        setTitle={(title: string) => setMoveTitle(title)}
                        context={context}
                    />
                </>
            )}
            <MakeDir setVisible={setVisible} context={context} />
            <RenameMenu setVisible={setVisible} context={context} />
            <RemoveMenu setVisible={setVisible} context={context} />
        </Menu>
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
const handleNavigationPress = (context: ContextType, name: string) => {
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
