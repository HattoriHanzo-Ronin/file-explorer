import type { PropsWithChildren } from "react";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import type { ImageSourcePropType } from "react-native";
import type { DirContent, LocalDirectoryUpdate, StorageRoot } from "./files";
import type { CreateDirectoryResponse, FtpEntry } from "./ftp";
import type { StorageType } from "./navigation";
import type { ListViewMode, OperationAction } from "./ui";

export interface SharedFilesReceiverProps {
    onRequireLogin: () => void;
}

export interface DrawerNavigationItemProps {
    navigation: DrawerContentComponentProps["navigation"];
    root?: StorageRoot;
    storage: "local" | "ftp";
}

export interface UserMenuProps {
    visible: boolean;
    onClose: () => void;
    onLogout: () => void;
}

export type FileContent = DirContent | FtpEntry;
export type FileAction<T extends FileContent = FileContent> = (name: string, type: T["type"]) => void;
export interface ContentCardProps {
    content: FileContent;
    storage: StorageType;
    doubleTapAction: () => void;
    longPressAction: () => void;
    oneTapAction: () => void;
    selected: boolean;
    viewMode: ListViewMode;
}

export interface ListProps<T extends FileContent = FileContent> {
    dirContent: T[];
    storage: StorageType;
    doubleTapAction: FileAction<T>;
    longPressAction: FileAction<T>;
    oneTapAction: FileAction<T>;
    selectAll: (selectAll: boolean) => void;
}

export interface ContentThumbnailProps {
    content: FileContent;
    storage: StorageType;
    viewMode: ListViewMode;
}

export interface ThumbnailState {
    isLoading: boolean;
    source: ImageSourcePropType | null;
}

export type DialogProps = PropsWithChildren<{
    visible: boolean;
    acceptDisabled?: boolean;
    title?: string;
    onCancel: () => void;
    onAccept: () => void;
}>;

export interface BreadcrumbProps {
    dir: string;
    onNavigate: (dir: string) => void;
}

export type CreateDirectoryDialogProps =
    | {
          dir: string;
          onClose: (cancelled: boolean) => void;
          onCreated: (data: CreateDirectoryResponse) => void;
          rootPath: string;
          storage: "ftp";
          visible: boolean;
      }
    | {
          dir: string;
          onClose: (cancelled: boolean) => void;
          onCreated: (data: LocalDirectoryUpdate[]) => void;
          rootPath: string;
          storage: "local";
          visible: boolean;
      };

export interface DestinationOperationModalProps {
    action: OperationAction;
    acceptDisabled?: boolean;
    acceptText?: string;
    onClose: () => void;
    onCancel?: () => void;
    onOperationFinished?: () => void;
    selectedCount?: number;
    visible: boolean;
}

export interface DestinationStoragePickerProps {
    remoteDestination: boolean;
    root: StorageRoot;
    roots: StorageRoot[];
    showRoots: boolean;
    onSelectRoot: (root: StorageRoot) => void;
    onToggleRoots: () => void;
}

export interface DestinationDirectoryListProps {
    directories: string[];
    isLoading: boolean;
    onOpenDirectory: (name: string) => void;
    onNavigateToParent: () => void;
}
