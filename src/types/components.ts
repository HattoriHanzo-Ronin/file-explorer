import type { DirContent } from "./files";

export type FileAction = (name: string, type: DirContent["type"]) => void;

export interface ContentCardProps {
    content: DirContent;
    doubleTapAction: () => void;
    longPressAction: () => void;
    oneTapAction: () => void;
    notSelectable: boolean;
}

export interface ListProps {
    dirContent: DirContent[];
    doubleTapAction: FileAction;
    longPressAction: FileAction;
    oneTapAction: FileAction;
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
