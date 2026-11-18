import type { StorageSetParams } from "../../types/storage";

/** Persistent key-value storage contract */
export interface Storage {
    get<T>(key: string): Promise<T | null>;
    set<T>(params: StorageSetParams<T>): Promise<void>;
    delete(key: string): Promise<void>;
}
