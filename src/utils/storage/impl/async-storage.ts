import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Storage } from "../storage";

/**
 * Provides persistent non-sensitive storage through AsyncStorage
 *
 * @author HattoriHanzo-Ronin
 */
export default class AsyncStorageStorage implements Storage {
    /**
     * Stores a value
     *
     * @param key Storage key
     * @param payload Value to store
     */
    async set<T>(key: string, payload: T): Promise<void> {
        await AsyncStorage.setItem(key, JSON.stringify(payload));
    }

    /**
     * Returns a stored value
     *
     * @param key Storage key
     * @returns Stored value or null
     */
    async get<T>(key: string): Promise<T | null> {
        const value = await AsyncStorage.getItem(key);
        return value === null ? null : (JSON.parse(value) as T);
    }

    /**
     * Deletes a stored value
     *
     * @param key Storage key
     */
    async delete(key: string): Promise<void> {
        await AsyncStorage.removeItem(key);
    }
}
