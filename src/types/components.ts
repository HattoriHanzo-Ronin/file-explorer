import type { PropsWithChildren } from "react";
import type { ImageSourcePropType } from "react-native";
import type { DirContent } from "./files";
import type { FtpEntry } from "./ftp";
import type { StorageType } from "./navigation";
import type { ListViewMode } from "./ui";

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
