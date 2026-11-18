import type { DatabaseRow } from "./database";

/** Row used to persist a UI preference */
export interface UiPreference extends DatabaseRow {
    key: string;
    value: string;
}

/** Value and key to persist */
export interface StorageSetParams<T> {
    key: string;
    payload: T;
}
