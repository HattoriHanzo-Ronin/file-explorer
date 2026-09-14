import type { DrawerNavigationProp } from "@react-navigation/drawer";

export type RootDrawerParamList = {
    local: undefined;
    ftp: undefined;
};

export type DrawerNavigation = DrawerNavigationProp<RootDrawerParamList>;
