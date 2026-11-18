import type { AppContextType } from "./context";
import type { LocalDirectoryUpdate } from "./files";

export type MessageDuration = "LONG" | "SHORT";

export type OperationAction = "copy" | "move" | "upload" | "download";

export type ListViewMode = "LIST" | "SMALL_ICONS" | "LARGE_ICONS";

export type ValidationErrors<T extends object> = Partial<Record<keyof T, string[]>>;

export interface MessageParams {
    message: string;
    duration?: MessageDuration;
}

export interface LocalDirectoryUpdatesParams {
    setLocalDirectory: AppContextType["setLocalDirectory"];
    updates: LocalDirectoryUpdate[];
}
