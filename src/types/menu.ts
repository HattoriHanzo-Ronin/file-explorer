import type { StorageType } from "./navigation";

export type SetVisible = (visible: boolean) => void;

export interface MenuItemProps {
    title: string;
    onPress: () => void;
}

export interface StorageMenuProps {
    storage: StorageType;
}

export interface MenuProps extends StorageMenuProps {
    setVisible: SetVisible;
}

export interface RenameMenuProps extends MenuProps {
    onFinish: () => void;
}

export type OverflowMenuProps = StorageMenuProps;
