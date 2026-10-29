import { DATABASE_KEYS } from "../../../../src/constants/database";
import type { Database } from "../../../../src/utils/database/database";
import DatabaseStorage from "../../../../src/utils/storage/impl/database-storage";

describe("DatabaseStorage", () => {
    const database = {
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        getById: jest.fn(),
        query: jest.fn(),
        executeTransaction: jest.fn()
    } as jest.Mocked<Database>;
    let storage: DatabaseStorage;

    beforeEach(() => {
        jest.clearAllMocks();
        storage = new DatabaseStorage(database);
    });

    it("updates an existing preference", async () => {
        database.update.mockResolvedValue(1);
        await storage.set(DATABASE_KEYS.viewMode, "LARGE_ICONS");
        expect(database.update).toHaveBeenCalledWith("ui_preferences", { value: '"LARGE_ICONS"' }, { key: DATABASE_KEYS.viewMode });
        expect(database.insert).not.toHaveBeenCalled();
    });

    it("inserts a preference when it does not exist", async () => {
        database.update.mockResolvedValue(0);
        database.insert.mockResolvedValue(1);
        await storage.set(DATABASE_KEYS.viewMode, "LIST");
        expect(database.insert).toHaveBeenCalledWith("ui_preferences", {
            key: DATABASE_KEYS.viewMode,
            value: '"LIST"'
        });
    });

    it("deserializes a stored preference", async () => {
        database.getById.mockResolvedValue({ key: DATABASE_KEYS.viewMode, value: '"SMALL_ICONS"' });
        await expect(storage.get<string>(DATABASE_KEYS.viewMode)).resolves.toBe("SMALL_ICONS");
        expect(database.getById).toHaveBeenCalledWith("ui_preferences", DATABASE_KEYS.viewMode, "key");
    });

    it("deletes a preference", async () => {
        database.delete.mockResolvedValue(1);
        await storage.delete(DATABASE_KEYS.viewMode);
        expect(database.delete).toHaveBeenCalledWith("ui_preferences", { key: DATABASE_KEYS.viewMode });
    });
});
