import { NativeModules } from "react-native";
import type { DatabaseMutation, DatabaseQuery, DatabaseRow, DatabaseValue } from "../../../types/database";
import type { Database } from "../database";

interface NativeDatabaseModule {
    insert(table: string, values: DatabaseRow): Promise<number>;
    update(table: string, values: DatabaseRow, where: DatabaseRow): Promise<number>;
    delete(table: string, where: DatabaseRow): Promise<number>;
    query(table: string, options: DatabaseQuery | null): Promise<DatabaseRow[]>;
    getById(table: string, id: { value: DatabaseValue }, column: string): Promise<DatabaseRow | null>;
    executeTransaction(operations: DatabaseMutation[]): Promise<void>;
}

/**
 * Native database implementation
 *
 * @author HattoriHanzo-Ronin
 */
export default class NativeDatabase implements Database {
    private readonly module: NativeDatabaseModule;

    constructor() {
        this.module = NativeModules.Database as NativeDatabaseModule;
    }

    /**
     * Inserts a row
     *
     * @param table Table name
     * @param values Row values
     * @returns Inserted row identifier
     */
    async insert(table: string, values: DatabaseRow): Promise<number> {
        return this.module.insert(table, values);
    }

    /**
     * Updates rows
     *
     * @param table Table name
     * @param values Values to update
     * @param where Row condition
     * @returns Updated row count
     */
    async update(table: string, values: DatabaseRow, where: DatabaseRow): Promise<number> {
        return this.module.update(table, values, where);
    }

    /**
     * Deletes rows
     *
     * @param table Table name
     * @param where Row condition
     * @returns Deleted row count
     */
    async delete(table: string, where: DatabaseRow): Promise<number> {
        return this.module.delete(table, where);
    }

    /**
     * Returns matching rows
     *
     * @param table Table name
     * @param options Query options
     * @returns Matching rows
     */
    async query<T extends DatabaseRow>(table: string, options?: DatabaseQuery): Promise<T[]> {
        return (await this.module.query(table, options ?? null)) as T[];
    }

    /**
     * Returns a row by identifier
     *
     * @param table Table name
     * @param id Row identifier
     * @param column Identifier column
     * @returns Matching row
     */
    async getById<T extends DatabaseRow>(table: string, id: DatabaseValue, column = "id"): Promise<T | null> {
        return (await this.module.getById(table, { value: id }, column)) as T | null;
    }

    /**
     * Executes mutations atomically
     *
     * @param operations Database mutations
     * @returns Transaction completion
     */
    async executeTransaction(operations: DatabaseMutation[]): Promise<void> {
        return this.module.executeTransaction(operations);
    }
}
