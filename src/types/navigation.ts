import type { DrawerNavigationProp } from "@react-navigation/drawer";
import type { NavigatorScreenParams } from "@react-navigation/native";

export type RootDrawerParamList = {
    local: undefined;
    ftp: NavigatorScreenParams<FtpStackParamList>;
};

export type StorageType = keyof RootDrawerParamList;
export type DrawerNavigation = DrawerNavigationProp<RootDrawerParamList>;

export type FtpStackParamList = {
    login: undefined;
    files: undefined;
};
