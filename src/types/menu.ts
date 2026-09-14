import type { AppContextType } from "./context";
import type { DrawerNavigation } from "./navigation";

export type SetVisible = (visible: boolean) => void;

export interface MenuProps {
    setVisible: SetVisible;
    context: AppContextType;
}

export interface TransferMenuProps extends MenuProps {
    navigation: DrawerNavigation;
}

export interface CopyMoveMenuProps extends MenuProps {
    title: string;
    setTitle: (title: string) => void;
}
