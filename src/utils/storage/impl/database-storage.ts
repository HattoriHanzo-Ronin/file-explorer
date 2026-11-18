import type { UiPreference } from "../../../types/storage";
import type { Database } from "../../database/database";
import type { Storage } from "../storage";
import type { StorageSetParams } from "../../../types/storage";

/**
 * Provides persistent non-sensitive storage through the native database
 *
 * @author HattoriHanzo-Ronin
 */
export default class DatabaseStorage implements Storage {
    private static readonly TABLE = "ui_preferences";
    private readonly database: Database;

    constructor(database: Database) {
        this.database = database;
    }

    /**
     * Stores a value
     *
     * @param params.key Storage key
     * @param params.payload Value to store
     */
    async set<T>(params: StorageSetParams<T>) {
        const { key, payload } = params;
        const value = JSON.stringify(payload);
        const updated = await this.database.update({ table: DatabaseStorage.TABLE, values: { value }, where: { key } });
        if (updated === 0) {
            await this.database.insert({ table: DatabaseStorage.TABLE, values: { key, value } });
        }
    }

    /**
     * Returns a stored value
     *
     * @param key Storage key
     * @returns Stored value or null
     */
    async get<T>(key: string) {
        const preference = await this.database.getById<UiPreference>({
            table: DatabaseStorage.TABLE,
            id: key,
            column: "key"
        });
        return preference === null ? null : (JSON.parse(preference.value) as T);
    }

    /**
     * Deletes a stored value
     *
     * @param key Storage key
     */
    async delete(key: string) {
        await this.database.delete({ table: DatabaseStorage.TABLE, where: { key } });
    }
}
