import type { DrawerNavigation, StorageType } from "./navigation";

export type SetVisible = (visible: boolean) => void;

export interface StorageMenuProps {
    storage: StorageType;
}

export interface MenuProps extends StorageMenuProps {
    setVisible: SetVisible;
}

export type OverflowMenuProps = StorageMenuProps;

export interface TransferMenuProps extends MenuProps {
    navigation: DrawerNavigation;
}

export type CopyMoveMenuProps = MenuProps;

export interface CopyMoveActionProps extends CopyMoveMenuProps {
    copy: boolean;
}
