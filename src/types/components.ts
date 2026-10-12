import type { DirContent } from "./files";
import type { FtpEntry } from "./ftp";

export type FileContent = DirContent | FtpEntry;
export type FileAction<T extends FileContent = FileContent> = (name: string, type: T["type"]) => void;

export interface ContentCardProps {
    content: FileContent;
    doubleTapAction: () => void;
    longPressAction: () => void;
    oneTapAction: () => void;
    notSelectable: boolean;
}

export interface ListProps<T extends FileContent = FileContent> {
    dirContent: T[];
    doubleTapAction: FileAction<T>;
    longPressAction: FileAction<T>;
    oneTapAction: FileAction<T>;
    notSelectable: boolean;
}

export interface DialogProps {
    show: boolean;
    onCancel: () => void;
    onOk: () => void;
    description: string;
    name: string;
    setName: (name: string) => void;
}
