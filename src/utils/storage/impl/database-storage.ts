import type { UiPreference } from "../../../types/storage";
import type { Database } from "../../database/database";
import type { Storage } from "../storage";

/**
 * Provides persistent non-sensitive storage through the native database
 *
 * @author HattoriHanzo-Ronin
 */
export default class DatabaseStorage implements Storage {
    private readonly database: Database;

    constructor(database: Database) {
        this.database = database;
    }

    /**
     * Stores a value
     *
     * @param key Storage key
     * @param payload Value to store
     */
    async set<T>(key: string, payload: T): Promise<void> {
        const value = JSON.stringify(payload);
        const updated = await this.database.update(TABLE, { value }, { key });
        if (updated === 0) {
            await this.database.insert(TABLE, { key, value });
        }
    }

    /**
     * Returns a stored value
     *
     * @param key Storage key
     * @returns Stored value or null
     */
    async get<T>(key: string): Promise<T | null> {
        const preference = await this.database.getById<UiPreference>(TABLE, key, "key");
        return preference === null ? null : (JSON.parse(preference.value) as T);
    }

    /**
     * Deletes a stored value
     *
     * @param key Storage key
     */
    async delete(key: string): Promise<void> {
        await this.database.delete(TABLE, { key });
    }
}

const TABLE = "ui_preferences";
