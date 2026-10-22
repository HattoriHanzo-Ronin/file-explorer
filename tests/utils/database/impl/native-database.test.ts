const mockDatabase = {
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    query: jest.fn(),
    getById: jest.fn(),
    executeTransaction: jest.fn()
};

import { NativeModules } from "react-native";
import NativeDatabase from "../../../../src/utils/database/impl/native-database";

describe("NativeDatabase", () => {
    let database: NativeDatabase;

    beforeEach(() => {
        jest.clearAllMocks();
        (NativeModules as { Database: typeof mockDatabase }).Database = mockDatabase;
        database = new NativeDatabase();
    });

    it("delegates parameterized mutations to the native database", async () => {
        mockDatabase.insert.mockResolvedValue(3);
        mockDatabase.update.mockResolvedValue(2);
        mockDatabase.delete.mockResolvedValue(1);
        await expect(database.insert("entries", { name: "report.txt" })).resolves.toBe(3);
        await expect(database.update("entries", { name: "report-final.txt" }, { id: 3 })).resolves.toBe(2);
        await expect(database.delete("entries", { id: 3 })).resolves.toBe(1);
        expect(mockDatabase.insert).toHaveBeenCalledWith("entries", { name: "report.txt" });
        expect(mockDatabase.update).toHaveBeenCalledWith("entries", { name: "report-final.txt" }, { id: 3 });
        expect(mockDatabase.delete).toHaveBeenCalledWith("entries", { id: 3 });
    });

    it("delegates queries and wraps the identifier for the native bridge", async () => {
        const row = { id: "entry-1", name: "report.txt" };
        mockDatabase.query.mockResolvedValue([row]);
        mockDatabase.getById.mockResolvedValue(row);
        await expect(database.query("entries", { where: { name: "report.txt" }, limit: 1 })).resolves.toEqual([row]);
        await expect(database.getById("entries", "entry-1")).resolves.toEqual(row);
        expect(mockDatabase.query).toHaveBeenCalledWith("entries", { where: { name: "report.txt" }, limit: 1 });
        expect(mockDatabase.getById).toHaveBeenCalledWith("entries", { value: "entry-1" }, "id");
    });

    it("delegates transaction mutations as a single native request", async () => {
        const operations = [
            { type: "insert" as const, table: "entries", values: { id: "entry-1", name: "report.txt" } },
            { type: "delete" as const, table: "entries", where: { id: "entry-2" } }
        ];
        mockDatabase.executeTransaction.mockResolvedValue(undefined);
        await expect(database.executeTransaction(operations)).resolves.toBeUndefined();
        expect(mockDatabase.executeTransaction).toHaveBeenCalledWith(operations);
    });
});
