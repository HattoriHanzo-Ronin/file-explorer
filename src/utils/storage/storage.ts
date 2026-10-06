/** Persistent key-value storage contract */
export interface Storage {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, payload: T): Promise<void>;
    delete(key: string): Promise<void>;
}
