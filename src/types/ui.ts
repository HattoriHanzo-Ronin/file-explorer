export type MessageDuration = "LONG" | "SHORT";

export type FileActionMode = "copy" | "move" | "upload" | "download" | null;

export type ListViewMode = "LIST" | "SMALL_ICONS" | "LARGE_ICONS";

export type ValidationErrors<T extends object> = Partial<Record<keyof T, string[]>>;
