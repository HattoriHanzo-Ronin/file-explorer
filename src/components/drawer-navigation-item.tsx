import { Pressable, Text } from "react-native";
import { useAppContext } from "./app-context-provider";
import { useTheme } from "./theme-provider";
import type { DrawerNavigationItemProps } from "../types/components";
import { appStyles } from "../styles/app/style";
import { handleNavigationPress, openStorage } from "../utils/navigation-utils";

export default function DrawerNavigationItem(props: DrawerNavigationItemProps) {
    const { navigation, root, storage } = props;
    const context = useAppContext();
    const { activeStorageRoot } = context;
    const { mode } = useTheme();
    const app = appStyles[mode];
    const isFtp = !root;
    const label = root?.name ?? "Red";
    const active = root ? storage === "local" && activeStorageRoot.id === root.id : storage === "ftp";

    function navigate() {
        if (root) {
            openStorage(context, root);
            navigation.navigate("local");
            navigation.closeDrawer();
            handleNavigationPress(context, "local");
            return;
        }

        navigation.navigate("ftp", { screen: "login" });
        navigation.closeDrawer();
        handleNavigationPress(context, "ftp");
    }

    return (
        <Pressable style={[app.drawerItem, active && app.activeDrawerItem]} onPress={navigate}>
            <Text numberOfLines={isFtp ? 1 : 3} style={app.drawerItemText}>
                {label}
            </Text>
        </Pressable>
    );
}
