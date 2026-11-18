import * as Keychain from "react-native-keychain";
import type { Storage } from "../storage";
import type { StorageSetParams } from "../../../types/storage";

/**
 * Provides secure storage through the native keychain
 *
 * @author HattoriHanzo-Ronin
 */
export default class KeychainStorage implements Storage {
    private static readonly SERVICE_PREFIX = "com.hhrcore.file-explorer";

    /**
     * Stores a value securely
     *
     * @param params.key Storage key
     * @param params.payload Value to store
     */
    async set<T>(params: StorageSetParams<T>) {
        const { key, payload } = params;
        await Keychain.setGenericPassword(key, JSON.stringify(payload), { service: this.getService(key) });
    }

    /**
     * Returns a securely stored value
     *
     * @param key Storage key
     * @returns Stored value or null
     */
    async get<T>(key: string) {
        const credentials = await Keychain.getGenericPassword({ service: this.getService(key) });
        if (credentials) {
            return JSON.parse(credentials.password) as T;
        }

        return null;
    }

    /**
     * Deletes a securely stored value
     *
     * @param key Storage key
     */
    async delete(key: string) {
        await Keychain.resetGenericPassword({ service: this.getService(key) });
    }

    private getService(key: string): string {
        return `${KeychainStorage.SERVICE_PREFIX}.${key}`;
    }
}
